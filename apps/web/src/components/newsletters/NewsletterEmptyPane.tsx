import { BookOpen, Clock, ArrowRight, Keyboard } from "lucide-react";
import { SenderAvatar } from "./SenderAvatar";
import { m } from "@/paraglide/messages.js";

interface MockNewsletter {
  id: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  receivedAt: string;
  isUnread: boolean;
}

const MOCK_UNREAD: MockNewsletter[] = [
  {
    id: "mock-1",
    senderName: "The Hustle",
    senderEmail: "sam@thehustle.co",
    subject: "How a 22-year-old built a $1M side project",
    receivedAt: "2h",
    isUnread: true,
  },
  {
    id: "mock-2",
    senderName: "Dense Discovery",
    senderEmail: "kai@densediscovery.com",
    subject: "Issue #284 — The case for walking meetings",
    receivedAt: "5h",
    isUnread: true,
  },
  {
    id: "mock-3",
    senderName: "TLDR",
    senderEmail: "dan@tldrnewsletter.com",
    subject: "Google releases Gemini 2.5, Apple delays AI features",
    receivedAt: "8h",
    isUnread: true,
  },
];

const MOCK_RECENT: MockNewsletter[] = [
  {
    id: "mock-4",
    senderName: "Morning Brew",
    senderEmail: "crew@morningbrew.com",
    subject: "Markets rally after Fed signals rate cuts",
    receivedAt: "1d",
    isUnread: false,
  },
  {
    id: "mock-5",
    senderName: "Lenny's Newsletter",
    senderEmail: "lenny@substack.com",
    subject: "The art of prioritization: frameworks that work",
    receivedAt: "2d",
    isUnread: false,
  },
];

interface NewsletterEmptyPaneProps {
  onNewsletterSelect?: (id: string) => void;
}

function MockNewsletterCard({
  newsletter,
  onClick,
}: {
  newsletter: MockNewsletter;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full group flex items-center gap-3 rounded-xl border border-border/50 bg-card px-4 py-3 text-left transition-all hover:bg-accent/50 hover:border-border active:scale-[0.995]"
    >
      <SenderAvatar
        senderName={newsletter.senderName}
        senderEmail={newsletter.senderEmail}
        size="sm"
        className="shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {newsletter.isUnread && (
            <span className="shrink-0 size-1.5 rounded-full bg-primary" />
          )}
          <span className="text-xs text-muted-foreground truncate">
            {newsletter.senderName}
          </span>
        </div>
        <p className="text-sm text-foreground truncate mt-0.5 font-medium">
          {newsletter.subject}
        </p>
      </div>
      <div className="shrink-0 flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground">
          {newsletter.receivedAt}
        </span>
        <ArrowRight className="size-3.5 text-muted-foreground/0 group-hover:text-muted-foreground transition-colors" />
      </div>
    </button>
  );
}

/**
 * Rich empty state for the desktop reader pane when no newsletter is selected.
 * Shows reading suggestions with mock data (to be dynamized later).
 */
export function NewsletterEmptyPane({
  onNewsletterSelect,
}: NewsletterEmptyPaneProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-w-0 overflow-auto">
      <div className="w-full max-w-lg px-6 py-12">
        {/* Header visual */}
        <div className="flex flex-col items-center text-center mb-10">
          <div className="mb-4 flex items-center justify-center size-14 rounded-2xl bg-primary/10">
            <BookOpen className="size-7 text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">
            {m.reader_emptyPane_title()}
          </h2>
          <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">
            {m.reader_emptyPane_subtitle()}
          </p>
        </div>

        {/* Unread section */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3 px-1">
            <span className="size-1.5 rounded-full bg-primary" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {m.reader_emptyPane_unread()}
            </h3>
          </div>
          <div className="space-y-2">
            {MOCK_UNREAD.map((newsletter) => (
              <MockNewsletterCard
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
        </div>

        {/* Recently received section */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3 px-1">
            <Clock className="size-3.5 text-muted-foreground" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {m.reader_emptyPane_recentlyReceived()}
            </h3>
          </div>
          <div className="space-y-2">
            {MOCK_RECENT.map((newsletter) => (
              <MockNewsletterCard
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
        </div>

        {/* Quick tip */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground/60">
          <Keyboard className="size-3.5" />
          <span>{m.reader_emptyPane_quickTip()}</span>
        </div>
      </div>
    </div>
  );
}
