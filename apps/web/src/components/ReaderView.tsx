import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useConvex, useMutation } from "convex/react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "@hushletter/backend";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";
import DOMPurify from "dompurify";
import {
  type ReaderBackgroundPreference,
  type ReaderFontPreference,
  type ReaderFontSizePreference,
  type ReaderPreferences,
  READER_BACKGROUND_OPTIONS,
  READER_FONT_SIZE_OPTIONS,
  useReaderPreferences,
} from "@/hooks/useReaderPreferences";
import { useScrollProgress } from "@/hooks/useScrollProgress";
import { estimateReadMinutesFromContent } from "@/lib/readingTime";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

interface ReaderViewProps {
  /** userNewsletter document ID */
  userNewsletterId: Id<"userNewsletters">;
  /** Initial reading progress percentage (0-100) for resume feature */
  initialProgress?: number;
  /** Callback when reading is complete (100% scrolled) */
  onReadingComplete?: () => void;
  /** Optional className override for the scroll container */
  className?: string;
  /** Optional reader appearance overrides from parent-level controls */
  preferences?: ReaderPreferences;
  /** Callback to report estimated read time in minutes */
  onEstimatedReadMinutesChange?: (minutes: number | null) => void;
  /** Callback to report current read progress while scrolling */
  onReadProgressChange?: (progress: number) => void;
  /** Optional explicit scroll container used for read-progress tracking */
  progressContainerElement?: HTMLElement | null;
  /** Optional signal to reset/cancel pending progress reporting state */
  progressResetSignal?: number;
  /** Skip the initial "content fits => 100%" auto-progress check */
  skipInitialProgressCheck?: boolean;
}

/**
 * Reader content cache key namespace for TanStack Query.
 * Content is immutable once ingested, so staleTime can be infinite.
 */
const READER_CONTENT_QUERY_KEY_PREFIX = "readerContent";
const READER_CONTENT_GC_MS = 1000 * 60 * 60 * 6; // 6 hours (session-oriented)
const READER_PERF_LOG_ENABLED =
  import.meta.env.DEV && import.meta.env.MODE !== "test";
const iframeHeightCache = new Map<string, number>();
let activeReaderQueryClient: QueryClient | null = null;
const MIN_IFRAME_HEIGHT = 200;
const DEFAULT_IFRAME_HEIGHT = 480;
const IFRAME_HEIGHT_BUFFER = 4;
const DEFAULT_SCROLL_CLASS = "overflow-y-auto max-h-[calc(100vh-200px)]";

const READER_FONT_STACKS = {
  serif: "ui-serif, Georgia, Cambria, 'Times New Roman', Times, serif",
  sans: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
} as const;

const EMAIL_GUARD_CSS = `
  :root { color-scheme: light; }
  html, body {
    margin: 0;
    padding: 0;
    background: transparent;
    color: #111827;
  }
  body {
    overflow-wrap: break-word;
    word-break: normal;
  }
  img {
    max-width: 100%;
    height: auto;
  }
  table {
    max-width: 100%;
  }
  pre.hushletter-plain-text {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    line-height: 1.5;
  }
`;

const SCRIPT_LIKE_URL_PATTERN = /^(javascript:|vbscript:|data:text\/html)/i;
const EXECUTABLE_URL_ATTRIBUTES = [
  "href",
  "src",
  "srcdoc",
  "action",
  "formaction",
  "xlink:href",
] as const;

function stripResidualExecutableContent(doc: Document): void {
  doc.querySelectorAll("script, noscript").forEach((node) => {
    node.remove();
  });

  doc.querySelectorAll<HTMLElement>("*").forEach((element) => {
    for (const attributeName of element.getAttributeNames()) {
      if (attributeName.toLowerCase().startsWith("on")) {
        element.removeAttribute(attributeName);
      }
    }

    for (const attributeName of EXECUTABLE_URL_ATTRIBUTES) {
      const value = element.getAttribute(attributeName);
      if (!value) continue;
      if (SCRIPT_LIKE_URL_PATTERN.test(value.trim())) {
        element.removeAttribute(attributeName);
      }
    }
  });
}

/** Clear the content cache (exported for testing) */
export function clearContentCache(queryClient?: QueryClient): void {
  const client = queryClient ?? activeReaderQueryClient;
  client?.removeQueries({ queryKey: [READER_CONTENT_QUERY_KEY_PREFIX] });
  iframeHeightCache.clear();
}

/** Clear a specific entry from the cache (for error boundary reset) */
export function clearCacheEntry(
  userNewsletterId: string,
  queryClient?: QueryClient,
): void {
  const client = queryClient ?? activeReaderQueryClient;
  client?.removeQueries({ queryKey: getReaderContentQueryKey(userNewsletterId) });
  iframeHeightCache.delete(userNewsletterId);
}

type NewsletterContentActionResult = {
  contentStatus: "available" | "missing" | "error" | "locked";
  contentUrl?: string | null;
};

type ReaderContentQueryData = {
  baseDocument: string | null;
  estimatedReadMinutes: number | null;
};

type ConvexActionCaller = {
  action: (
    functionReference: unknown,
    args: { userNewsletterId: Id<"userNewsletters"> },
  ) => Promise<NewsletterContentActionResult>;
};

function getReaderContentQueryKey(
  userNewsletterId: Id<"userNewsletters"> | string,
) {
  return [READER_CONTENT_QUERY_KEY_PREFIX, userNewsletterId] as const;
}

function getPerfNowMs(): number {
  if (typeof performance !== "undefined") return performance.now();
  return Date.now();
}

function logReaderPerf(
  event: string,
  details: Record<string, unknown>,
): void {
  if (!READER_PERF_LOG_ENABLED) return;
  console.log(`[ReaderPerf] ${event}`, details);
}

async function fetchReaderContent(
  convex: ConvexActionCaller,
  userNewsletterId: Id<"userNewsletters">,
): Promise<ReaderContentQueryData> {
  const startedAt = getPerfNowMs();
  logReaderPerf("load_start", { userNewsletterId });

  try {
    const actionStartedAt = getPerfNowMs();
    const result = await convex.action(api.newsletters.getUserNewsletterWithContent, {
      userNewsletterId,
    });
    const actionMs = Math.round(getPerfNowMs() - actionStartedAt);
    logReaderPerf("action_complete", {
      userNewsletterId,
      contentStatus: result.contentStatus,
      actionMs,
    });

    if (result.contentStatus === "missing") {
      logReaderPerf("load_complete_missing", {
        userNewsletterId,
        totalMs: Math.round(getPerfNowMs() - startedAt),
      });
      return {
        baseDocument: null,
        estimatedReadMinutes: null,
      };
    }

    if (result.contentStatus === "error" || !result.contentUrl) {
      throw new Error(m.reader_contentUnavailable());
    }

    const fetchStartedAt = getPerfNowMs();
    const response = await fetch(result.contentUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch content: ${response.status}`);
    }
    const responseMs = Math.round(getPerfNowMs() - fetchStartedAt);

    const textStartedAt = getPerfNowMs();
    const rawContent = await response.text();
    const textMs = Math.round(getPerfNowMs() - textStartedAt);

    const buildStartedAt = getPerfNowMs();
    const baseDocument = buildReaderDocument(rawContent);
    const estimatedReadMinutes = estimateReadMinutesFromContent(rawContent);
    const buildMs = Math.round(getPerfNowMs() - buildStartedAt);

    logReaderPerf("load_complete", {
      userNewsletterId,
      responseMs,
      textMs,
      buildMs,
      contentBytes: rawContent.length,
      totalMs: Math.round(getPerfNowMs() - startedAt),
    });

    return {
      baseDocument,
      estimatedReadMinutes,
    };
  } catch (error) {
    logReaderPerf("load_error", {
      userNewsletterId,
      totalMs: Math.round(getPerfNowMs() - startedAt),
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

export function prefetchReaderContent(
  queryClient: QueryClient,
  convex: ConvexActionCaller,
  userNewsletterId: Id<"userNewsletters">,
): void {
  activeReaderQueryClient = queryClient;
  const queryKey = getReaderContentQueryKey(userNewsletterId);
  const hasCachedEntry = queryClient.getQueryData(queryKey) !== undefined;
  const prefetchStartedAt = getPerfNowMs();
  void queryClient
    .prefetchQuery({
      queryKey,
      queryFn: () => fetchReaderContent(convex, userNewsletterId),
      staleTime: Infinity,
      gcTime: READER_CONTENT_GC_MS,
      retry: 1,
      retryDelay: 250,
    })
    .then(() => {
      logReaderPerf("prefetch_complete", {
        userNewsletterId,
        hadCache: hasCachedEntry,
        durationMs: Math.round(getPerfNowMs() - prefetchStartedAt),
      });
    })
    .catch((error) => {
      logReaderPerf("prefetch_error", {
        userNewsletterId,
        hadCache: hasCachedEntry,
        durationMs: Math.round(getPerfNowMs() - prefetchStartedAt),
        message: error instanceof Error ? error.message : String(error),
      });
    });
}

/** Escape plain text for safe HTML fallback rendering */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Convert raw email content into a sanitized full HTML document for iframe srcDoc */
function buildReaderDocument(rawContent: string): string {
  const trimmed = rawContent.trim();
  const looksLikeHtml = /<[a-z][\s\S]*>/i.test(trimmed);
  const sourceContent = looksLikeHtml
    ? rawContent
    : `<pre class="hushletter-plain-text">${escapeHtml(rawContent)}</pre>`;

  let sanitized: string;
  try {
    DOMPurify.addHook("afterSanitizeAttributes", (node) => {
      if (!(node instanceof Element) || node.tagName.toLowerCase() !== "a")
        return;

      const href = node.getAttribute("href");
      if (
        href &&
        /^(javascript:|vbscript:|data:text\/html)/i.test(href.trim())
      ) {
        node.removeAttribute("href");
      }

      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    });

    sanitized = DOMPurify.sanitize(sourceContent, {
      WHOLE_DOCUMENT: true,
      FORBID_TAGS: [
        "script",
        "iframe",
        "object",
        "embed",
        "form",
        "input",
        "button",
        "textarea",
        "select",
        "option",
      ],
      FORBID_ATTR: [
        "onerror",
        "onclick",
        "onload",
        "onmouseover",
        "onfocus",
        "onmouseenter",
        "onmouseleave",
        "onsubmit",
      ],
      ADD_ATTR: ["target", "rel"],
    });
  } finally {
    // Hooks are global in DOMPurify, always clean up to avoid cross-render side effects.
    DOMPurify.removeHook("afterSanitizeAttributes");
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(sanitized, "text/html");
  stripResidualExecutableContent(doc);
  const styleElement = doc.createElement("style");
  styleElement.textContent = EMAIL_GUARD_CSS;
  doc.head.prepend(styleElement);

  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
}

function withReaderDisplayOverrides(
  baseDocument: string,
  font: ReaderFontPreference,
  background: ReaderBackgroundPreference,
  fontSize: ReaderFontSizePreference,
): string {
  const backgroundColor = READER_BACKGROUND_OPTIONS[background].color;
  const fontSizeScale = READER_FONT_SIZE_OPTIONS[fontSize].scale;

  const isWhiteColorToken = (value: string): boolean => {
    const normalized = value.trim().toLowerCase();
    return (
      normalized === "#fff" ||
      normalized === "#ffffff" ||
      normalized === "white" ||
      normalized === "rgb(255,255,255)" ||
      normalized === "rgb(255, 255, 255)" ||
      normalized === "rgba(255,255,255,1)" ||
      normalized === "rgba(255, 255, 255, 1)" ||
      normalized === "rgba(255,255,255,1.0)" ||
      normalized === "rgba(255, 255, 255, 1.0)"
    );
  };

  const replaceBackgroundExpression = (value: string): string => {
    const importantMatch = value.match(/\s*!important\s*$/i);
    const importantSuffix = importantMatch ? " !important" : "";
    const withoutImportant = value.replace(/\s*!important\s*$/i, "").trim();

    if (isWhiteColorToken(withoutImportant)) {
      return `${backgroundColor}${importantSuffix}`;
    }

    const replaced = withoutImportant
      .replace(/\bwhite\b/gi, backgroundColor)
      .replace(/#(?:fff|ffffff)\b/gi, backgroundColor)
      .replace(
        /rgba?\(\s*255\s*,\s*255\s*,\s*255(?:\s*,\s*1(?:\.0+)?)?\s*\)/gi,
        backgroundColor,
      )
      .replace(/hsl\(\s*0(?:deg)?\s*,\s*0%\s*,\s*100%\s*\)/gi, backgroundColor);

    return replaced === withoutImportant
      ? value
      : `${replaced}${importantSuffix}`;
  };

  const scaleFontSizeExpression = (value: string): string => {
    const importantMatch = value.match(/\s*!important\s*$/i);
    const importantSuffix = importantMatch ? " !important" : "";
    const withoutImportant = value.replace(/\s*!important\s*$/i, "").trim();

    if (fontSizeScale === 1 || withoutImportant.length === 0) {
      return value;
    }

    const keywordSizes = new Set([
      "xx-small",
      "x-small",
      "small",
      "medium",
      "large",
      "x-large",
      "xx-large",
      "smaller",
      "larger",
      "inherit",
      "initial",
      "unset",
      "revert",
      "revert-layer",
    ]);

    if (keywordSizes.has(withoutImportant.toLowerCase())) {
      return value;
    }

    const singleSize = withoutImportant.match(
      /^(-?\d*\.?\d+)\s*(px|pt|pc|in|cm|mm|q|rem|em|ex|ch|%|vh|vw|vmin|vmax)$/i,
    );

    if (singleSize) {
      const numericValue = Number(singleSize[1]);
      const scaled = Math.round(numericValue * fontSizeScale * 1000) / 1000;
      const unit = singleSize[2];
      return `${scaled}${unit}${importantSuffix}`;
    }

    return `calc((${withoutImportant}) * ${fontSizeScale})${importantSuffix}`;
  };

  const rewriteStyleDeclarations = (cssText: string): string => {
    const withBackgroundRewrite = cssText.replace(
      /(background(?:-color)?\s*:\s*)([^;}{]+)/gi,
      (full, prefix: string, expression: string) => {
        const nextExpression = replaceBackgroundExpression(expression.trim());
        return nextExpression === expression.trim()
          ? full
          : `${prefix}${nextExpression}`;
      },
    );

    return withBackgroundRewrite.replace(
      /(font-size\s*:\s*)([^;}{]+)/gi,
      (full, prefix: string, expression: string) => {
        const scaledExpression = scaleFontSizeExpression(expression.trim());
        return scaledExpression === expression.trim()
          ? full
          : `${prefix}${scaledExpression}`;
      },
    );
  };

  const parser = new DOMParser();
  const doc = parser.parseFromString(baseDocument, "text/html");

  const elements = doc.querySelectorAll<HTMLElement>("*");
  elements.forEach((element) => {
    const bgColorAttr = element.getAttribute("bgcolor");
    if (bgColorAttr && isWhiteColorToken(bgColorAttr)) {
      element.setAttribute("bgcolor", backgroundColor);
    }

    const inlineStyle = element.getAttribute("style");
    if (inlineStyle) {
      const rewritten = rewriteStyleDeclarations(inlineStyle);
      if (rewritten !== inlineStyle) {
        element.setAttribute("style", rewritten);
      }
    }
  });

  doc.querySelectorAll("style").forEach((styleElement) => {
    const cssText = styleElement.textContent;
    if (!cssText) return;
    const rewritten = rewriteStyleDeclarations(cssText);
    if (rewritten !== cssText) {
      styleElement.textContent = rewritten;
    }
  });

  const fontRule =
    font === "original"
      ? ""
      : `
  body, p, div, span, li, td, th, blockquote, a, h1, h2, h3, h4, h5, h6 {
    font-family: ${READER_FONT_STACKS[font]} !important;
  }
  pre, code, kbd, samp {
    font-family: ${READER_FONT_STACKS.mono} !important;
  }`;

  const fontSizeRule =
    fontSizeScale === 1
      ? ""
      : `
  body, p, div, span, li, td, th, blockquote, a, h1, h2, h3, h4, h5, h6, small {
    font-size: calc(1em * ${fontSizeScale}) !important;
  }`;

  const displayCss = `
  html, body {
    background-color: ${backgroundColor} !important;
    overflow-x: hidden !important;
    overflow-y: hidden !important;
  }
  body {
    min-height: 100vh;
  }${fontRule}${fontSizeRule}
`;

  const overrideStyle = doc.createElement("style");
  overrideStyle.setAttribute("data-hushletter-reader-display-override", "");
  overrideStyle.textContent = displayCss;
  doc.head.append(overrideStyle);

  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
}

/**
 * Skeleton loader for content.
 * Exported so InlineReaderPane can show the same skeleton during metadata loading,
 * avoiding layout shifts between loading phases.
 */
export function ContentSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-4 bg-muted rounded w-full" />
      <div className="h-4 bg-muted rounded w-5/6" />
      <div className="h-4 bg-muted rounded w-4/5" />
      <div className="h-4 bg-muted rounded w-full" />
      <div className="h-4 bg-muted rounded w-2/3" />
      <div className="h-32 bg-muted rounded w-full mt-6" />
      <div className="h-4 bg-muted rounded w-full" />
      <div className="h-4 bg-muted rounded w-3/4" />
    </div>
  );
}

/**
 * Error state display
 */
function ContentError({ message }: { message: string }) {
  return (
    <div className="text-center py-12 border rounded-lg bg-destructive/5">
      <p className="text-destructive font-medium mb-2">
        {m.reader_failedToLoad()}
      </p>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

/**
 * Empty content state
 */
function ContentEmpty() {
  return (
    <div className="text-center py-12 border rounded-lg bg-muted/50">
      <p className="text-muted-foreground">{m.reader_noContent()}</p>
    </div>
  );
}

/**
 * ReaderView - Displays newsletter content with XSS protection
 * Fetches content via action (for signed R2 URLs) and sanitizes HTML
 *
 * Story 3.4: Added scroll progress tracking with auto-mark as read
 *
 */
export function ReaderView({
  userNewsletterId,
  initialProgress,
  onReadingComplete,
  className,
  preferences,
  onEstimatedReadMinutesChange,
  onReadProgressChange,
  progressContainerElement,
  progressResetSignal,
  skipInitialProgressCheck = false,
}: ReaderViewProps) {
  const queryClient = useQueryClient();
  const convex = useConvex();
  activeReaderQueryClient = queryClient;

  const { preferences: persistedPreferences } = useReaderPreferences();
  const readerContentQuery = useQuery({
    queryKey: getReaderContentQueryKey(userNewsletterId),
    queryFn: () => fetchReaderContent(convex, userNewsletterId),
    staleTime: Infinity,
    gcTime: READER_CONTENT_GC_MS,
    retry: 1,
    retryDelay: 250,
    enabled: typeof window !== "undefined",
  });

  const contentDocument = readerContentQuery.data?.baseDocument ?? null;
  const estimatedReadMinutes =
    readerContentQuery.data?.estimatedReadMinutes ?? null;
  const isLoading = readerContentQuery.isPending || readerContentQuery.isFetching;
  const error = readerContentQuery.error
    ? readerContentQuery.error instanceof Error
      ? readerContentQuery.error.message
      : "Unknown error occurred"
    : null;

  const [iframeHeight, setIframeHeight] = useState(
    iframeHeightCache.get(userNewsletterId) ?? DEFAULT_IFRAME_HEIGHT,
  );
  const [iframeMeasured, setIframeMeasured] = useState(false);

  useEffect(() => {
    setIframeHeight(
      iframeHeightCache.get(userNewsletterId) ?? DEFAULT_IFRAME_HEIGHT,
    );
    setIframeMeasured(false);
  }, [userNewsletterId]);

  const waitingForExternalProgressContainer = progressContainerElement === null;
  const progressTrackingEnabled =
    !isLoading && iframeMeasured && !waitingForExternalProgressContainer;

  // Ref for scrollable container (Story 3.4: AC1)
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const contentReadyAtRef = useRef<number | null>(null);

  // Story 3.4: Mutation for updating read progress
  const updateReadProgress = useMutation(api.newsletters.setReadProgress);

  // Story 3.4: Track scroll progress with debounce
  useScrollProgress({
    containerRef: scrollContainerRef,
    containerElement: progressContainerElement,
    enabled: progressTrackingEnabled,
    onProgressPreview: onReadProgressChange,
    onProgress: (progress) => {
      onReadProgressChange?.(progress);

      // Update progress in database
      updateReadProgress({ userNewsletterId, progress });

      // Notify parent when reading is complete (AC3)
      if (progress === 100 && onReadingComplete) {
        onReadingComplete();
      }
    },
    debounceMs: 2000,
    thresholdPercent: 5,
    resetSignal: progressResetSignal,
    skipInitialCheck: skipInitialProgressCheck || !progressTrackingEnabled,
  });

  const syncIframeHeight = useCallback(() => {
    const iframe = iframeRef.current;
    const iframeDoc = iframe?.contentDocument;
    if (!iframeDoc) return;

    const body = iframeDoc.body;
    const html = iframeDoc.documentElement;
    const viewportHeight = iframe?.clientHeight ?? 0;
    const bodyScrollHeight = body?.scrollHeight ?? 0;
    const htmlScrollHeight = html?.scrollHeight ?? 0;
    const measuredHeight = Math.max(
      bodyScrollHeight,
      body?.offsetHeight ?? 0,
      htmlScrollHeight,
      html?.offsetHeight ?? 0,
      MIN_IFRAME_HEIGHT,
    );
    // Only add a small buffer when content actually overflows the iframe viewport.
    // This avoids a ResizeObserver feedback loop where the iframe keeps growing by a few pixels.
    const hasVerticalOverflow =
      viewportHeight > 0 &&
      (bodyScrollHeight > viewportHeight || htmlScrollHeight > viewportHeight);
    const nextHeight = Math.ceil(
      measuredHeight + (hasVerticalOverflow ? IFRAME_HEIGHT_BUFFER : 0),
    );

    iframeHeightCache.set(userNewsletterId, nextHeight);
    setIframeHeight((prev) => (prev === nextHeight ? prev : nextHeight));
  }, [userNewsletterId]);

  const handleIframeLoad = useCallback(() => {
    syncIframeHeight();
    setIframeMeasured(true);

    const contentReadyAt = contentReadyAtRef.current;
    logReaderPerf("iframe_load", {
      userNewsletterId,
      iframeHeight: iframeHeightCache.get(userNewsletterId) ?? iframeHeight,
      contentToFrameMs:
        contentReadyAt === null ? null : Math.round(getPerfNowMs() - contentReadyAt),
    });

    resizeObserverRef.current?.disconnect();
    if (typeof ResizeObserver === "undefined") return;

    const iframe = iframeRef.current;
    const iframeDoc = iframe?.contentDocument;
    if (!iframeDoc?.body || !iframeDoc.documentElement) return;

    const observer = new ResizeObserver(() => {
      syncIframeHeight();
    });

    observer.observe(iframeDoc.body);
    observer.observe(iframeDoc.documentElement);
    resizeObserverRef.current = observer;
  }, [syncIframeHeight, userNewsletterId, iframeHeight]);

  useEffect(() => {
    return () => {
      resizeObserverRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    onEstimatedReadMinutesChange?.(estimatedReadMinutes);
  }, [estimatedReadMinutes, onEstimatedReadMinutesChange]);

  useEffect(() => {
    contentReadyAtRef.current = null;
    logReaderPerf("view_select", { userNewsletterId });
  }, [userNewsletterId]);

  useEffect(() => {
    if (!readerContentQuery.isSuccess) return;
    contentReadyAtRef.current = getPerfNowMs();
    logReaderPerf("view_content_ready", {
      userNewsletterId,
      fromCache: !readerContentQuery.isFetchedAfterMount,
      hasContent: contentDocument !== null,
      dataUpdatedAt: readerContentQuery.dataUpdatedAt,
    });
  }, [
    userNewsletterId,
    readerContentQuery.isSuccess,
    readerContentQuery.isFetchedAfterMount,
    readerContentQuery.dataUpdatedAt,
    contentDocument,
  ]);

  useEffect(() => {
    if (!error) return;
    logReaderPerf("view_error", { userNewsletterId, message: error });
  }, [error, userNewsletterId]);

  // Story 3.4 AC2: Scroll to saved position when content loads and initialProgress is provided
  useEffect(() => {
    if (
      !isLoading &&
      contentDocument &&
      initialProgress &&
      initialProgress > 0 &&
      initialProgress < 100
    ) {
      // Small delay to ensure content is rendered and measured
      const timeoutId = setTimeout(() => {
        scrollToProgress(
          progressContainerElement ?? scrollContainerRef.current,
          initialProgress,
        );
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [isLoading, contentDocument, initialProgress, progressContainerElement]);

  const effectivePreferences = preferences ?? persistedPreferences;

  const renderedDocument = useMemo(() => {
    if (!contentDocument) return null;
    return withReaderDisplayOverrides(
      contentDocument,
      effectivePreferences.font,
      effectivePreferences.background,
      effectivePreferences.fontSize,
    );
  }, [
    contentDocument,
    effectivePreferences.font,
    effectivePreferences.background,
    effectivePreferences.fontSize,
  ]);

  // Loading state
  if (isLoading) {
    return <ContentSkeleton />;
  }

  // Error state
  if (error) {
    return <ContentError message={error} />;
  }

  // Empty content state
  if (contentDocument === null || renderedDocument === null) {
    return <ContentEmpty />;
  }

  // Render sanitized content inside sandboxed iframe for layout fidelity and style isolation.
  // The iframe is hidden until the first height measurement to avoid a flash of clipped content.
  const canRenderCachedFrameImmediately =
    !isLoading &&
    contentDocument !== null &&
    iframeHeightCache.has(userNewsletterId);

  return (
    <div
      ref={scrollContainerRef}
      data-testid="reader-scroll-container"
      className={cn(DEFAULT_SCROLL_CLASS, className)}
      style={{
        backgroundColor:
          READER_BACKGROUND_OPTIONS[effectivePreferences.background].color,
      }}
    >
      {!iframeMeasured && !canRenderCachedFrameImmediately && <ContentSkeleton />}
      <iframe
        ref={iframeRef}
        title="Newsletter content"
        data-testid="reader-content-frame"
        className="block w-full bg-transparent"
        scrolling="no"
        sandbox="allow-same-origin allow-popups"
        srcDoc={renderedDocument}
        style={{
          height: iframeHeight,
          minHeight: MIN_IFRAME_HEIGHT,
          backgroundColor:
            READER_BACKGROUND_OPTIONS[effectivePreferences.background].color,
          opacity: iframeMeasured || canRenderCachedFrameImmediately ? 1 : 0,
          position:
            iframeMeasured || canRenderCachedFrameImmediately
              ? "relative"
              : "absolute",
        }}
        onLoad={handleIframeLoad}
      />
    </div>
  );
}

/**
 * Scroll to a specific progress percentage within a container
 * Story 3.4: AC2 - Resume reading from saved position
 */
function scrollToProgress(
  container: HTMLElement | null,
  progress: number,
): void {
  if (!container) return;

  const { scrollHeight, clientHeight } = container;
  const scrollableHeight = scrollHeight - clientHeight;
  const targetScroll = (progress / 100) * scrollableHeight;

  container.scrollTo({
    top: targetScroll,
    behavior: "smooth",
  });
}

// Reused by the public share route to render the same sanitized email document.
export { buildReaderDocument, withReaderDisplayOverrides };
