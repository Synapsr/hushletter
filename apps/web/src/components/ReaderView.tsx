import { useState, useEffect, useRef } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@hushletter/backend";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";
import DOMPurify from "dompurify";
import { useScrollProgress } from "@/hooks/useScrollProgress";
import { m } from "@/paraglide/messages.js";

interface ReaderViewProps {
  /** userNewsletter document ID */
  userNewsletterId: Id<"userNewsletters">;
  /** Initial reading progress percentage (0-100) for resume feature */
  initialProgress?: number;
  /** Callback when reading is complete (100% scrolled) */
  onReadingComplete?: () => void;
}

/**
 * In-memory LRU cache for newsletter content.
 * Newsletter content is immutable once received, so caching is safe.
 * Stores sanitized HTML to avoid re-sanitization on cache hits.
 * Limited to MAX_CACHE_SIZE entries to prevent memory leaks.
 */
const MAX_CACHE_SIZE = 50;
const contentCache = new Map<string, string | null>();

/** Clear the content cache (exported for testing) */
export function clearContentCache(): void {
  contentCache.clear();
}

/** Clear a specific entry from the cache (for error boundary reset) */
export function clearCacheEntry(userNewsletterId: string): void {
  contentCache.delete(userNewsletterId);
}

/**
 * Set a cache entry with LRU eviction.
 * When cache exceeds MAX_CACHE_SIZE, the oldest entry is removed.
 */
function setCacheEntry(key: string, value: string | null): void {
  // If key exists, delete it first so it moves to the end (most recent)
  if (contentCache.has(key)) {
    contentCache.delete(key);
  }
  // Evict oldest entry if at capacity
  if (contentCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = contentCache.keys().next().value;
    if (oldestKey !== undefined) {
      contentCache.delete(oldestKey);
    }
  }
  contentCache.set(key, value);
}

/**
 * Skeleton loader for content
 */
function ContentSkeleton() {
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
      <p className="text-destructive font-medium mb-2">{m.reader_failedToLoad()}</p>
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
 * Note on useState for loading: This is an ACCEPTED EXCEPTION to project-context.md rules.
 * Convex useAction doesn't provide isPending like useMutation does, so manual loading
 * state management is required here. See Story 3.2 code review for rationale.
 */
export function ReaderView({
  userNewsletterId,
  initialProgress,
  onReadingComplete,
}: ReaderViewProps) {
  const [contentHtml, setContentHtml] = useState<string | null>(null);
  // Exception: useAction doesn't have isPending, manual loading state required
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ref for scrollable container (Story 3.4: AC1)
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Use action for content retrieval (generates signed R2 URL)
  const getNewsletterWithContent = useAction(api.newsletters.getUserNewsletterWithContent);

  // Story 3.4: Mutation for updating read progress
  const updateReadProgress = useMutation(api.newsletters.updateNewsletterReadProgress);

  // Story 3.4: Track scroll progress with debounce
  useScrollProgress({
    containerRef: scrollContainerRef,
    onProgress: (progress) => {
      // Update progress in database
      updateReadProgress({ userNewsletterId, readProgress: progress });

      // Notify parent when reading is complete (AC3)
      if (progress === 100 && onReadingComplete) {
        onReadingComplete();
      }
    },
    debounceMs: 2000,
    thresholdPercent: 5,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchContent() {
      // Check cache first - newsletter content is immutable
      if (contentCache.has(userNewsletterId)) {
        const cached = contentCache.get(userNewsletterId);
        setContentHtml(cached ?? null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Get newsletter with signed content URL
        const result = await getNewsletterWithContent({ userNewsletterId });

        if (cancelled) return;

        // Check content status
        if (result.contentStatus === "missing") {
          setCacheEntry(userNewsletterId, null);
          setContentHtml(null);
          setIsLoading(false);
          return;
        }

        if (result.contentStatus === "error" || !result.contentUrl) {
          // Don't cache errors - allow retry
          setError(m.reader_contentUnavailable());
          setIsLoading(false);
          return;
        }

        // Fetch HTML content from signed R2 URL
        const response = await fetch(result.contentUrl);

        if (cancelled) return;

        if (!response.ok) {
          throw new Error(`Failed to fetch content: ${response.status}`);
        }

        const rawHtml = await response.text();

        if (cancelled) return;

        // Configure DOMPurify hook to add safe link attributes
        // This is more robust than regex post-processing
        // Use try/finally to ensure hook cleanup even if sanitization fails
        let sanitizedHtml: string;
        try {
          DOMPurify.addHook("afterSanitizeAttributes", (node) => {
            if (node.tagName === "A") {
              node.setAttribute("target", "_blank");
              node.setAttribute("rel", "noopener noreferrer");
            }
          });

          // Sanitize HTML to prevent XSS attacks
          sanitizedHtml = DOMPurify.sanitize(rawHtml, {
            ALLOWED_TAGS: [
              "p",
              "div",
              "span",
              "a",
              "img",
              "h1",
              "h2",
              "h3",
              "h4",
              "h5",
              "h6",
              "ul",
              "ol",
              "li",
              "strong",
              "em",
              "b",
              "i",
              "u",
              "br",
              "hr",
              "table",
              "thead",
              "tbody",
              "tfoot",
              "tr",
              "td",
              "th",
              "blockquote",
              "pre",
              "code",
              "sup",
              "sub",
            ],
            ALLOWED_ATTR: [
              "href",
              "src",
              "alt",
              "class",
              "style",
              "width",
              "height",
              "target",
              "rel",
            ],
            FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input"],
            FORBID_ATTR: ["onerror", "onclick", "onload", "onmouseover"],
          });
        } finally {
          // Remove hook to prevent memory leaks (hooks are global)
          DOMPurify.removeHook("afterSanitizeAttributes");
        }

        // Cache the sanitized content (LRU eviction if at capacity)
        setCacheEntry(userNewsletterId, sanitizedHtml);
        setContentHtml(sanitizedHtml);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Unknown error occurred";
        // Don't cache errors - allow retry
        setError(message);
        console.error("[ReaderView] Failed to load content:", err);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchContent();

    return () => {
      cancelled = true;
    };
    // Note: getNewsletterWithContent is excluded from deps intentionally.
    // useAction returns a stable function reference that doesn't need to trigger re-fetches.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userNewsletterId]);

  // Story 3.4 AC2: Scroll to saved position when content loads and initialProgress is provided
  useEffect(() => {
    if (
      !isLoading &&
      contentHtml &&
      initialProgress &&
      initialProgress > 0 &&
      initialProgress < 100
    ) {
      // Small delay to ensure content is rendered and measured
      const timeoutId = setTimeout(() => {
        scrollToProgress(scrollContainerRef, initialProgress);
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [isLoading, contentHtml, initialProgress]);

  // Loading state
  if (isLoading) {
    return <ContentSkeleton />;
  }

  // Error state
  if (error) {
    return <ContentError message={error} />;
  }

  // Empty content state
  if (contentHtml === null) {
    return <ContentEmpty />;
  }

  // Render sanitized HTML content in scrollable container for progress tracking
  return (
    <div ref={scrollContainerRef} className="overflow-y-auto max-h-[calc(100vh-200px)]">
      <article
        className="prose prose-gray dark:prose-invert max-w-none
          prose-a:text-primary prose-a:no-underline hover:prose-a:underline
          prose-img:rounded-lg prose-img:mx-auto
          prose-headings:font-semibold
          prose-p:leading-relaxed"
        dangerouslySetInnerHTML={{ __html: contentHtml }}
      />
    </div>
  );
}

/**
 * Scroll to a specific progress percentage within a container
 * Story 3.4: AC2 - Resume reading from saved position
 */
function scrollToProgress(
  containerRef: React.RefObject<HTMLElement | null>,
  progress: number,
): void {
  const container = containerRef.current;
  if (!container) return;

  const { scrollHeight, clientHeight } = container;
  const scrollableHeight = scrollHeight - clientHeight;
  const targetScroll = (progress / 100) * scrollableHeight;

  container.scrollTo({
    top: targetScroll,
    behavior: "smooth",
  });
}
