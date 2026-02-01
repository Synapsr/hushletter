import { useState } from "react"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { useMutation } from "convex/react"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@newsletter-manager/backend"
import type { Id } from "@newsletter-manager/backend/convex/_generated/dataModel"
import { ErrorBoundary, type FallbackProps } from "react-error-boundary"
import { ReaderView, clearCacheEntry } from "~/components/ReaderView"
import { SummaryPanel } from "~/components/SummaryPanel"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { ArrowLeft, BookOpen, BookMarked, EyeOff, Eye, RefreshCw, Trash2, Mail, Globe } from "lucide-react"
import { Badge } from "~/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog"

export const Route = createFileRoute("/_authed/newsletters/$id")({
  component: NewsletterDetailPage,
})

/** Newsletter metadata from getUserNewsletter query */
interface NewsletterMetadata {
  _id: string
  subject: string
  senderEmail: string
  senderName?: string
  receivedAt: number
  isRead: boolean
  isHidden: boolean
  isPrivate: boolean
  readProgress?: number
  contentStatus: "available" | "missing" | "error"
  /** Story 9.10: Newsletter source for unified folder view display */
  source?: "email" | "gmail" | "manual" | "community"
}

/**
 * Skeleton loader for newsletter detail view
 */
function DetailSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="animate-pulse space-y-6">
        {/* Back button skeleton */}
        <div className="h-9 w-24 bg-muted rounded" />

        {/* Header skeleton */}
        <div className="space-y-3">
          <div className="h-8 bg-muted rounded w-3/4" />
          <div className="h-4 bg-muted rounded w-1/3" />
        </div>

        {/* Content skeleton */}
        <div className="space-y-4 pt-6">
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-4 bg-muted rounded w-5/6" />
          <div className="h-4 bg-muted rounded w-4/5" />
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-4 bg-muted rounded w-2/3" />
        </div>
      </div>
    </div>
  )
}

/**
 * Error fallback specifically for content loading failures
 * More specific than the global ErrorFallback - focused on content issues
 */
function ContentErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  console.error("[NewsletterDetail] Content error:", error)

  return (
    <Card className="text-center">
      <CardHeader>
        <CardTitle className="text-destructive">Failed to load content</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          There was an issue loading the newsletter content. Please try again.
        </p>
        <Button onClick={resetErrorBoundary}>Try Again</Button>
      </CardContent>
    </Card>
  )
}

/**
 * Error fallback for AI Summary feature (NFR11 - AI failure isolation)
 * Story 5.1: Code review fix (MEDIUM-2) - Provides retry capability
 */
function SummaryErrorFallback({ resetErrorBoundary }: FallbackProps) {
  return (
    <div className="mb-6 p-4 bg-muted/50 rounded-lg flex items-center justify-between">
      <span className="text-sm text-muted-foreground">
        AI summary feature is temporarily unavailable.
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={resetErrorBoundary}
        className="gap-1"
      >
        <RefreshCw className="h-3 w-3" />
        Retry
      </Button>
    </div>
  )
}

/**
 * Generic error display for page-level errors
 */
function PageError({ message }: { message: string }) {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Button variant="ghost" className="mb-6" onClick={() => window.history.back()}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to newsletters
      </Button>
      <Card className="text-center">
        <CardHeader>
          <CardTitle className="text-destructive">Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Newsletter header with subject, sender, date, and read status controls
 * Story 3.4: AC2 (Resume), AC4 (Mark read/unread), AC5 (Progress display)
 * Story 3.5: AC1, AC4 (Hide/Unhide)
 * Story 9.10: Source indicator and delete with community import handling
 */
function NewsletterHeader({
  subject,
  senderName,
  senderEmail,
  receivedAt,
  readProgress,
  isRead,
  isHidden,
  source,
  onResumeClick,
  onMarkRead,
  onMarkUnread,
  onHide,
  onUnhide,
  onDelete,
  isUpdating,
}: {
  subject: string
  senderName?: string
  senderEmail: string
  receivedAt: number
  readProgress?: number
  isRead: boolean
  isHidden: boolean
  source?: "email" | "gmail" | "manual" | "community"
  onResumeClick?: () => void
  onMarkRead: () => void
  onMarkUnread: () => void
  onHide: () => void
  onUnhide: () => void
  onDelete: () => void
  isUpdating: boolean
}) {
  const senderDisplay = senderName || senderEmail
  const date = new Date(receivedAt)

  // Show resume button for partially read newsletters (0 < progress < 100)
  const showResumeButton =
    readProgress !== undefined && readProgress > 0 && readProgress < 100

  // Story 9.10: Determine if this is a community import
  const isCommunity = source === "community"

  return (
    <header className="border-b pb-6 mb-6">
      <div className="flex items-start justify-between gap-4 mb-2">
        <h1 className="text-2xl font-bold text-foreground">{subject}</h1>
        {/* Story 9.10: Source indicator badge */}
        {isCommunity ? (
          <Badge variant="secondary" className="flex items-center gap-1 shrink-0">
            <Globe className="h-3 w-3" aria-hidden="true" />
            <span>From community</span>
          </Badge>
        ) : (
          <Badge variant="outline" className="flex items-center gap-1 shrink-0">
            <Mail className="h-3 w-3" aria-hidden="true" />
            <span>Your collection</span>
          </Badge>
        )}
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="font-medium text-foreground">{senderDisplay}</span>
          {senderName && (
            <span className="text-sm">&lt;{senderEmail}&gt;</span>
          )}
          <span className="text-sm">
            {" \u2022 "}
            <time dateTime={date.toISOString()}>
              {date.toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </time>
          </span>
        </div>

        {/* Story 3.4: Reading progress and controls */}
        <div className="flex items-center gap-2">
          {/* Progress indicator for partially read (AC5) */}
          {showResumeButton && (
            <span className="text-sm text-muted-foreground">
              {readProgress}% read
            </span>
          )}

          {/* Resume reading button (AC2) */}
          {showResumeButton && onResumeClick && (
            <Button
              variant="outline"
              size="sm"
              onClick={onResumeClick}
              className="gap-1"
            >
              <BookOpen className="h-4 w-4" />
              Resume
            </Button>
          )}

          {/* Mark as read/unread button (AC4) */}
          {isRead ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMarkUnread}
              disabled={isUpdating}
              className="gap-1"
            >
              <BookMarked className="h-4 w-4" />
              Mark unread
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMarkRead}
              disabled={isUpdating}
              className="gap-1"
            >
              <BookOpen className="h-4 w-4" />
              Mark as read
            </Button>
          )}

          {/* Story 3.5: Hide/Unhide button (AC1, AC4) */}
          {isHidden ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onUnhide}
              disabled={isUpdating}
              className="gap-1"
            >
              <Eye className="h-4 w-4" />
              Unhide
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={onHide}
              disabled={isUpdating}
              className="gap-1"
            >
              <EyeOff className="h-4 w-4" />
              Hide
            </Button>
          )}

          {/* Story 9.10: Delete button with confirmation */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1">
                <Trash2 className="h-4 w-4" />
                {isCommunity ? "Remove" : "Delete"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {isCommunity
                    ? "Remove from collection?"
                    : "Delete newsletter?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {isCommunity
                    ? "This will remove the newsletter from your personal collection. The newsletter will still be available in the community library."
                    : "This will permanently delete this newsletter from your collection."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                {/* Story 9.10 (code review fix): Destructive styling for permanent delete, default for community remove */}
                <AlertDialogAction
                  onClick={onDelete}
                  className={isCommunity ? undefined : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}
                >
                  {isCommunity ? "Remove" : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </header>
  )
}

/**
 * Content wrapper with error boundary (NFR11)
 * Story 3.4: Added scroll progress tracking and resume feature
 * Clears content cache on reset to ensure fresh fetch on retry
 */
function NewsletterContent({
  newsletterId,
  initialProgress,
  onReadingComplete,
}: {
  newsletterId: Id<"userNewsletters">
  initialProgress?: number
  onReadingComplete?: () => void
}) {
  const handleReset = () => {
    // Clear cached content for this newsletter to force refetch
    clearCacheEntry(newsletterId)
  }

  return (
    <ErrorBoundary
      FallbackComponent={ContentErrorFallback}
      onReset={handleReset}
    >
      <ReaderView
        userNewsletterId={newsletterId}
        initialProgress={initialProgress}
        onReadingComplete={onReadingComplete}
      />
    </ErrorBoundary>
  )
}

function NewsletterDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()

  // Story 3.4: Track if user wants to resume from saved position
  const [shouldResume, setShouldResume] = useState(false)

  // Code review fix (HIGH-1): Track hide/unhide feedback state for AC1 confirmation
  const [hideConfirmation, setHideConfirmation] = useState<string | null>(null)

  // Story 3.4: Mutations for mark read/unread
  const markRead = useMutation(api.newsletters.markNewsletterRead)
  const markUnread = useMutation(api.newsletters.markNewsletterUnread)

  // Story 3.5: Mutations for hide/unhide
  const hideNewsletter = useMutation(api.newsletters.hideNewsletter)
  const unhideNewsletter = useMutation(api.newsletters.unhideNewsletter)

  // Story 9.10: Delete newsletter mutation
  const deleteNewsletter = useMutation(api.newsletters.deleteUserNewsletter)

  // Validate route param before using - prevents invalid ID errors
  if (!id || typeof id !== "string" || id.trim() === "") {
    return <PageError message="Invalid newsletter ID" />
  }

  // Type assertion: Route params come as strings, but Convex expects Id<"userNewsletters">
  // This is safe because: 1) we validated id is a non-empty string above
  // 2) Convex validates the ID format server-side and returns null/error for invalid IDs
  const userNewsletterId = id as Id<"userNewsletters">

  // Get newsletter metadata with real-time subscription
  const { data, isPending, error } = useQuery(
    convexQuery(api.newsletters.getUserNewsletter, { userNewsletterId })
  )
  const newsletter = data as NewsletterMetadata | null | undefined

  // Show loading skeleton while fetching metadata
  if (isPending) {
    return <DetailSkeleton />
  }

  // Handle errors
  if (error) {
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred"
    return <PageError message={errorMessage} />
  }

  // Handle not found
  if (!newsletter) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button variant="ghost" className="mb-6" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to newsletters
        </Button>
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Newsletter not found
          </h2>
          <p className="text-muted-foreground">
            This newsletter may have been deleted or you don&apos;t have access to it.
          </p>
        </div>
      </div>
    )
  }

  // Story 3.4: Handlers for mark read/unread (AC4)
  const handleMarkRead = () => {
    markRead({ userNewsletterId, readProgress: 100 })
  }

  const handleMarkUnread = () => {
    markUnread({ userNewsletterId })
  }

  // Story 3.4: Handler for resume button (AC2)
  const handleResumeClick = () => {
    setShouldResume(true)
  }

  // Story 3.5: Handlers for hide/unhide (AC1, AC4)
  // Code review fix (HIGH-1): Added confirmation feedback per AC1 requirement
  const handleHide = async () => {
    try {
      await hideNewsletter({ userNewsletterId })
      // Show confirmation briefly before navigating (AC1: "confirmation is briefly shown")
      setHideConfirmation("Newsletter hidden")
      // Brief delay to show confirmation, then navigate
      setTimeout(() => {
        navigate({ to: "/newsletters" })
      }, 800)
    } catch (error) {
      console.error("[NewsletterDetail] Failed to hide newsletter:", error)
      setHideConfirmation("Failed to hide newsletter")
      setTimeout(() => setHideConfirmation(null), 2000)
    }
  }

  const handleUnhide = async () => {
    try {
      await unhideNewsletter({ userNewsletterId })
      // Show confirmation (AC1)
      setHideConfirmation("Newsletter restored")
      setTimeout(() => setHideConfirmation(null), 2000)
    } catch (error) {
      console.error("[NewsletterDetail] Failed to unhide newsletter:", error)
      setHideConfirmation("Failed to restore newsletter")
      setTimeout(() => setHideConfirmation(null), 2000)
    }
  }

  // Story 9.10: Handler for delete (AC6)
  const handleDelete = async () => {
    try {
      await deleteNewsletter({ userNewsletterId })
      // Navigate back after delete
      navigate({ to: "/newsletters" })
    } catch (error) {
      console.error("[NewsletterDetail] Failed to delete newsletter:", error)
      setHideConfirmation("Failed to delete newsletter")
      setTimeout(() => setHideConfirmation(null), 2000)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Back navigation - uses history.back() to preserve URL params like ?sender= (AC4) */}
      <Button variant="ghost" className="mb-6" onClick={() => window.history.back()}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to newsletters
      </Button>

      {/* Code review fix (HIGH-1): Confirmation feedback for hide/unhide (AC1) */}
      {hideConfirmation && (
        <div
          className="mb-4 px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm animate-in fade-in duration-200"
          role="status"
          aria-live="polite"
        >
          {hideConfirmation}
        </div>
      )}

      {/* Newsletter header with reading controls (Story 3.4, Story 3.5) */}
      {/* TODO: isUpdating should track mutation pending state, but Convex useMutation
          doesn't expose isPending. Mutations are fast (~100ms) so impact is minimal.
          Consider using optimistic updates or manual state tracking if UX feedback needed. */}
      <NewsletterHeader
        subject={newsletter.subject}
        senderName={newsletter.senderName}
        senderEmail={newsletter.senderEmail}
        receivedAt={newsletter.receivedAt}
        readProgress={newsletter.readProgress}
        isRead={newsletter.isRead}
        isHidden={newsletter.isHidden}
        source={newsletter.source}
        onResumeClick={handleResumeClick}
        onMarkRead={handleMarkRead}
        onMarkUnread={handleMarkUnread}
        onHide={handleHide}
        onUnhide={handleUnhide}
        onDelete={handleDelete}
        isUpdating={false}
      />

      {/* Story 5.1: AI Summary panel (collapsible, above content per UX spec)
          Wrapped in error boundary per NFR11 - AI failure should not block reading
          Code review fix (MEDIUM-2): Uses FallbackComponent with retry capability */}
      <ErrorBoundary FallbackComponent={SummaryErrorFallback}>
        <SummaryPanel userNewsletterId={userNewsletterId} />
      </ErrorBoundary>

      {/* Newsletter content with error boundary and scroll tracking (Story 3.4) */}
      <NewsletterContent
        newsletterId={userNewsletterId}
        initialProgress={shouldResume ? newsletter.readProgress : undefined}
      />
    </div>
  )
}
