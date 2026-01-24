import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useAction } from "convex/react"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@newsletter-manager/backend"
import type { Id } from "@newsletter-manager/backend/convex/_generated/dataModel"
import { Button } from "~/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Sparkles, RefreshCw, ChevronDown, ChevronUp, Users } from "lucide-react"
import { ConvexError } from "convex/values"

interface SummaryPanelProps {
  /** userNewsletter document ID - typed for Convex safety */
  userNewsletterId: Id<"userNewsletters">
}

/** Summary data from Convex query */
interface SummaryData {
  summary: string | null
  isShared: boolean
  generatedAt: number | null
}

/**
 * SummaryPanel - Displays AI-generated summary for a newsletter
 * Story 5.1: Task 5 - Summary display component
 *
 * Features:
 * - Collapsible summary view
 * - Generate/Regenerate buttons
 * - Loading state with skeleton
 * - Error state with retry
 * - Community summary indicator for shared summaries
 *
 * Note on useState for isGenerating: This is an ACCEPTED EXCEPTION to project-context.md rules.
 * Convex useAction doesn't provide isPending like useMutation does, so manual loading
 * state management is required here. See ReaderView.tsx for same pattern.
 */
export function SummaryPanel({ userNewsletterId }: SummaryPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  // Exception: useAction doesn't provide isPending, manual state required
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Query for existing summary (resolves shared vs private automatically)
  // Returns: { summary: string | null, isShared: boolean, generatedAt: number | null }
  const { data } = useQuery(
    convexQuery(api.ai.getNewsletterSummary, { userNewsletterId })
  )
  // Type guard to safely narrow the data type
  const summaryData: SummaryData | undefined =
    data && typeof data === "object" && "summary" in data
      ? (data as SummaryData)
      : undefined

  const generateSummaryAction = useAction(api.ai.generateSummary)

  const handleGenerate = async (forceRegenerate = false) => {
    setIsGenerating(true)
    setError(null)

    try {
      await generateSummaryAction({ userNewsletterId, forceRegenerate })
      // Summary will appear via real-time subscription from useQuery
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string; code?: string }
        setError(data.message ?? "Failed to generate summary")
      } else {
        setError("Failed to generate summary. Please try again.")
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const hasSummary = Boolean(summaryData?.summary)
  const isSharedSummary = summaryData?.isShared ?? false

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            AI Summary
          </CardTitle>

          <div className="flex items-center gap-2">
            {/* Collapse/Expand toggle - only show when summary exists */}
            {hasSummary && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setIsCollapsed(!isCollapsed)}
                aria-label={isCollapsed ? "Expand summary" : "Collapse summary"}
                aria-expanded={!isCollapsed}
              >
                {isCollapsed ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronUp className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      {!isCollapsed && (
        <CardContent>
          {/* Error state */}
          {error && (
            <div
              className="text-sm text-destructive mb-4 p-3 bg-destructive/10 rounded-lg"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Loading state - animated skeleton */}
          {isGenerating && (
            <div className="space-y-2 animate-pulse" aria-label="Generating summary...">
              <div className="h-4 bg-muted rounded w-full" />
              <div className="h-4 bg-muted rounded w-5/6" />
              <div className="h-4 bg-muted rounded w-4/5" />
            </div>
          )}

          {/* Summary content */}
          {!isGenerating && hasSummary && summaryData?.summary && (
            <div className="space-y-2">
              {/* Shared summary indicator (community summary) */}
              {isSharedSummary && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" aria-hidden="true" />
                  <span>Community summary</span>
                </div>
              )}
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {summaryData.summary}
                </p>
              </div>
            </div>
          )}

          {/* Generate/Regenerate button */}
          {!isGenerating && (
            <div className="mt-4 flex justify-end">
              <Button
                variant={hasSummary ? "outline" : "default"}
                size="sm"
                onClick={() => handleGenerate(hasSummary)} // forceRegenerate = true if regenerating
                disabled={isGenerating}
                className="gap-2"
              >
                {hasSummary ? (
                  <>
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    Regenerate
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    Summarize
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Empty state guidance - only when no summary and not generating */}
          {!isGenerating && !hasSummary && !error && (
            <p className="text-sm text-muted-foreground mb-4">
              Generate an AI summary to quickly understand the key points of this newsletter.
            </p>
          )}
        </CardContent>
      )}
    </Card>
  )
}
