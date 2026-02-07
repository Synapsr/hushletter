import { useState, useEffect, useRef } from "react"
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { useAction, useMutation } from "convex/react"
import { api } from "@hushletter/backend"
import type { Id } from "@hushletter/backend/convex/_generated/dataModel"
import DOMPurify from "dompurify"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { ArrowLeft, Plus, Users, Check, Sparkles, Loader2, AlertCircle } from "lucide-react"

export const Route = createFileRoute("/_authed/community/$contentId")({
  component: CommunityReaderPage,
})

/**
 * Simple LRU cache for community content HTML.
 * Newsletter content is immutable, so caching is safe.
 * Limited to MAX_CACHE_SIZE entries to prevent memory leaks in long sessions.
 */
const MAX_CACHE_SIZE = 20
const contentCache = new Map<string, string | null>()

function getFromCache(key: string): string | null | undefined {
  const value = contentCache.get(key)
  if (value !== undefined) {
    // Move to end (most recently used)
    contentCache.delete(key)
    contentCache.set(key, value)
  }
  return value
}

function setInCache(key: string, value: string | null): void {
  // Evict oldest entry if at capacity
  if (contentCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = contentCache.keys().next().value
    if (oldestKey) contentCache.delete(oldestKey)
  }
  contentCache.set(key, value)
}

/**
 * ContentSkeleton - Loading state for content
 */
function ContentSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-4 bg-muted rounded w-full" />
      <div className="h-4 bg-muted rounded w-5/6" />
      <div className="h-4 bg-muted rounded w-4/5" />
      <div className="h-4 bg-muted rounded w-full" />
      <div className="h-32 bg-muted rounded w-full mt-6" />
    </div>
  )
}

/**
 * ContentError - Error state display
 */
function ContentError({ message }: { message: string }) {
  return (
    <div className="text-center py-12 border rounded-lg bg-destructive/5">
      <p className="text-destructive font-medium mb-2">Failed to load content</p>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

/**
 * CommunityReaderPage - View a community newsletter
 * Story 6.1: Task 3.1-3.5
 *
 * Shows:
 * - Newsletter content (HTML sanitized)
 * - Reader count badge ("X readers have this")
 * - AI summary if available
 * - "Add to My Collection" button
 *
 * PRIVACY: This view has NO mark-as-read or hide actions.
 * Those require adding to personal collection first.
 */
function CommunityReaderPage() {
  const { contentId } = Route.useParams()
  const navigate = useNavigate()

  // Content state
  const [contentHtml, setContentHtml] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Newsletter metadata state
  const [metadata, setMetadata] = useState<{
    subject: string
    senderEmail: string
    senderName?: string
    firstReceivedAt: number
    readerCount: number
    hasSummary: boolean
    summary?: string
  } | null>(null)

  // Add to collection state
  const [isAdding, setIsAdding] = useState(false)
  const [alreadyInCollection, setAlreadyInCollection] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // Ref for scroll container
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Action to get content with signed URL
  const getCommunityContent = useAction(api.community.getCommunityNewsletterContent)

  // Mutation to add to collection
  const addToCollection = useMutation(api.community.addToCollection)

  // Fetch content on mount
  useEffect(() => {
    let cancelled = false

    async function fetchContent() {
      // Check LRU cache first
      const cached = getFromCache(contentId)
      if (cached !== undefined) {
        setContentHtml(cached)
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setError(null)

        const result = await getCommunityContent({
          contentId: contentId as Id<"newsletterContent">,
        })

        if (cancelled) return

        // Store metadata
        setMetadata({
          subject: result.subject,
          senderEmail: result.senderEmail,
          senderName: result.senderName,
          firstReceivedAt: result.firstReceivedAt,
          readerCount: result.readerCount,
          hasSummary: result.hasSummary,
          summary: result.summary,
        })

        // Fetch and sanitize HTML content
        if (result.contentUrl && result.contentStatus === "available") {
          const response = await fetch(result.contentUrl)
          if (!response.ok) {
            throw new Error(`Failed to fetch content: ${response.status}`)
          }
          const html = await response.text()

          // Sanitize HTML with DOMPurify
          const sanitized = DOMPurify.sanitize(html, {
            ALLOWED_TAGS: [
              "p", "div", "span", "a", "img", "h1", "h2", "h3", "h4", "h5", "h6",
              "ul", "ol", "li", "br", "hr", "strong", "em", "b", "i", "u",
              "blockquote", "pre", "code", "table", "thead", "tbody", "tr", "th", "td",
              "figure", "figcaption", "section", "article", "header", "footer",
            ],
            ALLOWED_ATTR: ["href", "src", "alt", "title", "class", "style", "target", "rel"],
            ALLOW_DATA_ATTR: false,
            ADD_ATTR: ["target", "rel"],
          })

          // Add target="_blank" and rel="noopener noreferrer" to links
          const parser = new DOMParser()
          const doc = parser.parseFromString(sanitized, "text/html")
          doc.querySelectorAll("a").forEach((link) => {
            link.setAttribute("target", "_blank")
            link.setAttribute("rel", "noopener noreferrer")
          })
          const finalHtml = doc.body.innerHTML

          setInCache(contentId, finalHtml)
          setContentHtml(finalHtml)
        } else {
          setContentHtml(null)
          setError("Content not available")
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Unknown error"
          setError(message)
          console.error("[CommunityReader] Failed to fetch content:", err)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    fetchContent()
    return () => {
      cancelled = true
    }
  }, [contentId, getCommunityContent])

  // Handle add to collection
  const handleAddToCollection = async () => {
    try {
      setIsAdding(true)
      setAddError(null)
      const result = await addToCollection({
        contentId: contentId as Id<"newsletterContent">,
      })

      if (result.alreadyExists) {
        setAlreadyInCollection(true)
      } else {
        // Redirect to personal reader view after success
        navigate({
          to: "/newsletters/$id",
          params: { id: result.userNewsletterId },
        })
      }
    } catch (err) {
      console.error("[CommunityReader] Failed to add to collection:", err)
      setAddError("Could not add this newsletter to your collection.")
    } finally {
      setIsAdding(false)
    }
  }

  // Format date
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      {/* Back button */}
      <div className="mb-4">
        <Link to="/community" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Back to Community
        </Link>
      </div>

      {/* Header with metadata */}
      {metadata && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground mb-1">
                  {metadata.senderName || metadata.senderEmail}
                </p>
                <CardTitle className="text-xl">{metadata.subject}</CardTitle>
                <p className="text-sm text-muted-foreground mt-2">
                  {formatDate(metadata.firstReceivedAt)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                {/* Reader count badge */}
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>
                    {metadata.readerCount} {metadata.readerCount === 1 ? "reader has" : "readers have"} this
                  </span>
                </div>
                {/* Add to collection button */}
                <Button
                  onClick={handleAddToCollection}
                  disabled={isAdding || alreadyInCollection}
                  size="sm"
                >
                  {isAdding ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Adding...
                    </>
                  ) : alreadyInCollection ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      In Collection
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-1" />
                      Add to My Collection
                    </>
                  )}
                </Button>
                {/* Error message */}
                {addError && (
                  <div className="flex items-center gap-1 text-xs text-destructive">
                    <AlertCircle className="h-3 w-3" />
                    <span>{addError}</span>
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* AI Summary (if available) */}
      {metadata?.hasSummary && metadata.summary && (
        <Card className="mb-6 bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                AI Summary
              </span>
            </div>
            <p className="text-sm text-amber-900 dark:text-amber-100">
              {metadata.summary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Newsletter content */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <ContentSkeleton />
          ) : error ? (
            <ContentError message={error} />
          ) : contentHtml ? (
            <div
              ref={scrollContainerRef}
              className="prose prose-gray dark:prose-invert max-w-none overflow-x-hidden"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: contentHtml }}
            />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No content available for this newsletter.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Note about personal actions */}
      <p className="text-center text-xs text-muted-foreground mt-4">
        Add to your collection to mark as read, hide, or track reading progress.
      </p>
    </div>
  )
}
