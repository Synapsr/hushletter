import { type ReactNode, useMemo } from "react";
import { Clock, Inbox } from "lucide-react";
import { SenderAvatar } from "./SenderAvatar";
import { m } from "@/paraglide/messages.js";
import { BookOpenIcon, ClockCircleIcon } from "@hushletter/ui/icons";

export interface NewsletterEmptyPaneItem {
  id: string;
  senderName?: string;
  senderEmail: string;
  subject: string;
  receivedAt: number;
  isRead: boolean;
}

interface NewsletterEmptyPaneProps {
  newsletters: NewsletterEmptyPaneItem[];
  onNewsletterSelect?: (id: string) => void;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return m.time_justNow();
  if (diffHours < 24) return m.time_hoursAgo({ hours: diffHours });
  if (diffDays === 1) return m.time_yesterday();
  if (diffDays < 7) return m.time_daysAgo({ days: diffDays });

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function NewsletterSuggestionCard({
  newsletter,
  onClick,
}: {
  newsletter: NewsletterEmptyPaneItem;
  onClick?: () => void;
}) {
  const senderDisplay = newsletter.senderName || newsletter.senderEmail;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full cursor-pointer rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-left transition-transform  hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]"
    >
      <div className="flex items-start gap-3">
        <SenderAvatar
          senderName={newsletter.senderName}
          senderEmail={newsletter.senderEmail}
          size="sm"
          className="shrink-0 border"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {!newsletter.isRead && (
              <span className="size-1.5 shrink-0 rounded-full bg-primary" />
            )}
            <span className="truncate text-xs text-muted-foreground">
              {senderDisplay}
            </span>
          </div>
          <p className="mt-1 truncate text-sm font-medium text-foreground">
            {newsletter.subject}
          </p>
        </div>
        <div className=" flex items-center gap-1 text-[11px] text-muted-foreground">
          <ClockCircleIcon className="size-3.5" />
          <span>{formatRelativeTime(newsletter.receivedAt)}</span>
        </div>
      </div>
    </button>
  );
}

function EmptyPaneSection({
  title,
  icon,
  newsletters,
  onNewsletterSelect,
}: {
  title: string;
  icon: ReactNode;
  newsletters: NewsletterEmptyPaneItem[];
  onNewsletterSelect?: (id: string) => void;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2 px-1">
        <div className="text-muted-foreground">{icon}</div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        <span className="rounded-full border border-border/70 px-2 py-0.5 text-[10px] text-muted-foreground">
          {newsletters.length}
        </span>
      </div>

      {newsletters.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-background/50 px-4 py-6 text-center text-xs text-muted-foreground">
          You&apos;re all caught up here.
        </div>
      ) : (
        <div className="space-y-2">
          {newsletters.map((newsletter) => (
            <NewsletterSuggestionCard
              key={newsletter.id}
              newsletter={newsletter}
              onClick={
                onNewsletterSelect
                  ? () => onNewsletterSelect(newsletter.id)
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function NewsletterEmptyPane({
  newsletters,
  onNewsletterSelect,
}: NewsletterEmptyPaneProps) {
  const unreadCount = useMemo(
    () => newsletters.filter((newsletter) => !newsletter.isRead).length,
    [newsletters],
  );

  const unreadSuggestions = useMemo(
    () => newsletters.filter((newsletter) => !newsletter.isRead).slice(0, 4),
    [newsletters],
  );

  const recentSuggestions = useMemo(() => {
    const unreadIds = new Set(
      unreadSuggestions.map((newsletter) => newsletter.id),
    );
    const recent = newsletters
      .filter((newsletter) => !unreadIds.has(newsletter.id))
      .slice(0, 4);

    if (recent.length >= 4) return recent;

    const used = new Set(recent.map((newsletter) => newsletter.id));
    for (const newsletter of newsletters) {
      if (recent.length >= 4) break;
      if (used.has(newsletter.id)) continue;
      recent.push(newsletter);
      used.add(newsletter.id);
    }

    return recent;
  }, [newsletters, unreadSuggestions]);

  const hasSuggestions = newsletters.length > 0;
  const shownSuggestionCount = useMemo(() => {
    const ids = new Set<string>();
    for (const newsletter of unreadSuggestions) ids.add(newsletter.id);
    for (const newsletter of recentSuggestions) ids.add(newsletter.id);
    return ids.size;
  }, [unreadSuggestions, recentSuggestions]);

  return (
    <div className="flex min-w-0 flex-1 items-center justify-center overflow-auto bg-[radial-gradient(120%_90%_at_50%_0%,hsl(var(--primary)/0.08),transparent_55%)]">
      <div className="mx-auto w-full max-w-3xl px-6 py-12">
        <header className="mb-10 flex flex-col items-center text-center">
          <div className="mb-4 inline-flex items-center justify-center rounded-2xl border bg-background/80 p-3">
            <BookOpenIcon className="size-6 text-primary" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            {m.reader_emptyPane_title()}
          </h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            {m.reader_emptyPane_subtitle()}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="rounded-full border border-border/80 bg-background/75 px-3 py-1 text-muted-foreground">
              {shownSuggestionCount} suggestions shown
            </span>
            <span className="rounded-full border border-border/80 bg-background/75 px-3 py-1 text-muted-foreground">
              {unreadCount} unread
            </span>
          </div>
        </header>

        {hasSuggestions ? (
          <div className="mx-auto grid w-full max-w-2xl gap-6 md:grid-cols-2">
            <EmptyPaneSection
              title={m.reader_emptyPane_unread()}
              icon={<span className="size-1.5 rounded-full bg-primary" />}
              newsletters={unreadSuggestions}
              onNewsletterSelect={onNewsletterSelect}
            />
            <EmptyPaneSection
              title={m.reader_emptyPane_recentlyReceived()}
              icon={<Clock className="size-3.5" />}
              newsletters={recentSuggestions}
              onNewsletterSelect={onNewsletterSelect}
            />
          </div>
        ) : (
          <div className="mx-auto max-w-md rounded-2xl border border-dashed border-border/70 bg-background/60 px-6 py-10 text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted">
              <Inbox className="size-5 text-muted-foreground/70" />
            </div>
            <p className="text-sm font-medium text-foreground">
              No newsletters available in this view
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose another folder or filter to explore more messages.
            </p>
          </div>
        )}

        <div className="mt-8 text-center text-[11px] text-muted-foreground/70">
          Suggestions are based on newsletters in your current view.
        </div>
      </div>
    </div>
  );
}
