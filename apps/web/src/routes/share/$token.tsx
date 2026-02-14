import { createFileRoute } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { api } from "@hushletter/backend";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReaderPreferences, READER_BACKGROUND_OPTIONS } from "@/hooks/useReaderPreferences";
import { buildReaderDocument, withReaderDisplayOverrides } from "@/components/ReaderView";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/share/$token")({
  head: () => ({
    title: "Hushletter",
    meta: [
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: ShareNewsletterRoutePage,
});

type SharedNewsletterWithContent = {
  subject: string;
  senderEmail: string;
  senderName?: string;
  receivedAt: number;
  contentUrl: string | null;
  contentStatus: "available" | "missing" | "error";
};

const MIN_IFRAME_HEIGHT = 200;
const DEFAULT_IFRAME_HEIGHT = 640;
const IFRAME_HEIGHT_BUFFER = 4;

function ShareNewsletterRoutePage() {
  const { token } = Route.useParams();
  return <ShareNewsletterPage token={token} />;
}

export function ShareNewsletterPage({ token }: { token: string }) {
  const cleanedToken = typeof token === "string" ? token.trim() : "";
  const { preferences } = useReaderPreferences();
  const paneBackgroundColor =
    READER_BACKGROUND_OPTIONS[preferences.background].color;

  const getNewsletterByShareTokenWithContent = useAction(
    api.share.getNewsletterByShareTokenWithContent,
  );

  const [meta, setMeta] = useState<SharedNewsletterWithContent | null>(null);
  const [baseDocument, setBaseDocument] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(true);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [iframeHeight, setIframeHeight] = useState(DEFAULT_IFRAME_HEIGHT);

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
    const hasVerticalOverflow =
      viewportHeight > 0 &&
      (bodyScrollHeight > viewportHeight || htmlScrollHeight > viewportHeight);
    const nextHeight = Math.ceil(
      measuredHeight + (hasVerticalOverflow ? IFRAME_HEIGHT_BUFFER : 0),
    );

    setIframeHeight((prev) => (prev === nextHeight ? prev : nextHeight));
  }, []);

  const handleIframeLoad = useCallback(() => {
    syncIframeHeight();

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
  }, [syncIframeHeight]);

  useEffect(() => {
    return () => {
      resizeObserverRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsPending(true);
      setMeta(null);
      setBaseDocument(null);

      try {
        const result = (await getNewsletterByShareTokenWithContent({
          token: cleanedToken,
        })) as SharedNewsletterWithContent | null;

        if (cancelled) return;
        if (!result || result.contentStatus !== "available" || !result.contentUrl) {
          setMeta(null);
          setIsPending(false);
          return;
        }

        setMeta(result);

        const response = await fetch(result.contentUrl);
        if (cancelled) return;
        if (!response.ok) throw new Error(`Failed to fetch content: ${response.status}`);

        const rawContent = await response.text();
        if (cancelled) return;

        setBaseDocument(buildReaderDocument(rawContent));
        setIframeHeight(DEFAULT_IFRAME_HEIGHT);
      } catch (error) {
        console.error("[share] Failed to load shared newsletter:", error);
        if (cancelled) return;
        setMeta(null);
      } finally {
        if (!cancelled) setIsPending(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [cleanedToken, getNewsletterByShareTokenWithContent]);

  const renderedDocument = useMemo(() => {
    if (!baseDocument) return null;
    return withReaderDisplayOverrides(
      baseDocument,
      preferences.font,
      preferences.background,
      preferences.fontSize,
    );
  }, [baseDocument, preferences]);

  if (isPending) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: paneBackgroundColor }}
      />
    );
  }

  if (!meta || !renderedDocument) {
    return (
      <main
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: paneBackgroundColor }}
      >
        <p className="text-sm text-muted-foreground">Not found</p>
      </main>
    );
  }

  const senderDisplay = meta.senderName || meta.senderEmail;
  const dateLabel = new Date(meta.receivedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div style={{ backgroundColor: paneBackgroundColor }}>
      <header className="border-b bg-background/95 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <div className="font-semibold tracking-tight">Hushletter</div>
          <div className="text-xs text-muted-foreground">{dateLabel}</div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">{senderDisplay}</p>
          <h1 className="text-2xl font-semibold text-foreground">{meta.subject}</h1>
        </div>

        <div className="rounded-xl border bg-background shadow-sm overflow-hidden">
          <iframe
            ref={iframeRef}
            title="Shared newsletter"
            className={cn("block w-full bg-transparent")}
            scrolling="no"
            sandbox="allow-same-origin allow-popups"
            srcDoc={renderedDocument}
            style={{
              height: iframeHeight,
              minHeight: MIN_IFRAME_HEIGHT,
              backgroundColor: READER_BACKGROUND_OPTIONS[preferences.background].color,
            }}
            onLoad={handleIframeLoad}
          />
        </div>
      </main>
    </div>
  );
}
