import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@newsletter-manager/backend"
import type { Id } from "@newsletter-manager/backend/convex/_generated/dataModel"
import { Link } from "@tanstack/react-router"
import { Button } from "~/components/ui/button"
import { Sparkles, ChevronDown, ChevronUp, Users } from "lucide-react"

interface SummaryPreviewProps {
  /** userNewsletter document ID */
  userNewsletterId: Id<"userNewsletters">
}

/** Response type from getNewsletterSummary query */
interface SummaryData {
  summary: string | null
  isShared: boolean
  generatedAt: number | null
}

/** Max characters to show in preview before truncation */
const PREVIEW_MAX_CHARS = 100

/**
 * SummaryPreview - Compact expandable summary preview for newsletter cards
 * Story 5.2: Task 3 - Optional enhancement for list view
 *
 * Features:
 * - On-demand fetch when expanded (lazy loading)
 * - Loading skeleton while fetching
 * - Truncated preview with "Read more" link
 * - Subtle styling to not distract from list
 *
 * UX Note: Per UX spec, this requires intentional click to expand -
 * NOT auto-expand on hover.
 */
export function SummaryPreview({ userNewsletterId }: SummaryPreviewProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Only fetch when expanded (lazy loading)
  const { data, isPending } = useQuery({
    ...convexQuery(api.ai.getNewsletterSummary, { userNewsletterId }),
    enabled: isExpanded,
  })

  // Code review fix: Trust the query return type, avoid manual type guards
  const summaryData = data as SummaryData | undefined
  const summary = summaryData?.summary
  const isShared = summaryData?.isShared ?? false

  // Truncate summary for preview
  const truncatedSummary =
    summary && summary.length > PREVIEW_MAX_CHARS
      ? `${summary.slice(0, PREVIEW_MAX_CHARS).trim()}...`
      : summary

  const handleToggle = (e: React.MouseEvent) => {
    // Stop propagation to prevent card click (navigation)
    e.preventDefault()
    e.stopPropagation()
    setIsExpanded(!isExpanded)
  }

  return (
    <div className="mt-2">
      {/* Toggle button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleToggle}
        className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
      >
        <Sparkles className="h-3 w-3 text-amber-500" aria-hidden="true" />
        {isExpanded ? "Hide preview" : "Show summary"}
        {isExpanded ? (
          <ChevronUp className="h-3 w-3" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-3 w-3" aria-hidden="true" />
        )}
      </Button>

      {/* Preview content */}
      {isExpanded && (
        <div
          className="mt-2 p-2 bg-muted/50 rounded-md text-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Loading skeleton */}
          {isPending && (
            <div className="space-y-1 animate-pulse" aria-label="Loading summary...">
              <div className="h-3 bg-muted rounded w-full" />
              <div className="h-3 bg-muted rounded w-3/4" />
            </div>
          )}

          {/* Summary content */}
          {!isPending && summary && (
            <div className="space-y-2">
              {/* Shared indicator */}
              {isShared && (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" aria-hidden="true" />
                  Community
                </span>
              )}
              <p className="text-muted-foreground leading-relaxed">
                {truncatedSummary}
              </p>
              {summary.length > PREVIEW_MAX_CHARS && (
                <Link
                  to="/newsletters/$id"
                  params={{ id: userNewsletterId }}
                  className="text-xs text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Read more →
                </Link>
              )}
            </div>
          )}

          {/* No summary available */}
          {!isPending && !summary && (
            <p className="text-muted-foreground text-xs">
              No summary available for this newsletter.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
