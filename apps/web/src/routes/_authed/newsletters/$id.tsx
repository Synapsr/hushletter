import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@newsletter-manager/backend"
import { ErrorBoundary, type FallbackProps } from "react-error-boundary"
import { ReaderView, clearCacheEntry } from "~/components/ReaderView"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { ArrowLeft } from "lucide-react"

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
  isPrivate: boolean
  contentStatus: "available" | "missing" | "error"
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
 * Newsletter header with subject, sender, and date
 */
function NewsletterHeader({
  subject,
  senderName,
  senderEmail,
  receivedAt,
}: {
  subject: string
  senderName?: string
  senderEmail: string
  receivedAt: number
}) {
  const senderDisplay = senderName || senderEmail
  const date = new Date(receivedAt)

  return (
    <header className="border-b pb-6 mb-6">
      <h1 className="text-2xl font-bold text-foreground mb-2">{subject}</h1>
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
    </header>
  )
}

/**
 * Content wrapper with error boundary (NFR11)
 * Clears content cache on reset to ensure fresh fetch on retry
 */
function NewsletterContent({ newsletterId }: { newsletterId: string }) {
  const handleReset = () => {
    // Clear cached content for this newsletter to force refetch
    clearCacheEntry(newsletterId)
  }

  return (
    <ErrorBoundary
      FallbackComponent={ContentErrorFallback}
      onReset={handleReset}
    >
      <ReaderView userNewsletterId={newsletterId} />
    </ErrorBoundary>
  )
}

function NewsletterDetailPage() {
  const { id } = Route.useParams()

  // Validate route param before using - prevents invalid ID errors
  if (!id || typeof id !== "string" || id.trim() === "") {
    return <PageError message="Invalid newsletter ID" />
  }

  // Get newsletter metadata with real-time subscription
  // Type assertion is safe here because we validated id above and Convex validates the ID format server-side
  const { data, isPending, error } = useQuery(
    convexQuery(api.newsletters.getUserNewsletter, { userNewsletterId: id })
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Back navigation - uses history.back() to preserve URL params like ?sender= (AC4) */}
      <Button variant="ghost" className="mb-6" onClick={() => window.history.back()}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to newsletters
      </Button>

      {/* Newsletter header */}
      <NewsletterHeader
        subject={newsletter.subject}
        senderName={newsletter.senderName}
        senderEmail={newsletter.senderEmail}
        receivedAt={newsletter.receivedAt}
      />

      {/* Newsletter content with error boundary (AC3) */}
      <NewsletterContent newsletterId={id} />
    </div>
  )
}
