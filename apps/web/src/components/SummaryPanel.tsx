import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAction } from "convex/react";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@hushletter/ui";
import { Sparkles, RefreshCw, ChevronDown, ChevronUp, Users } from "lucide-react";
import { ConvexError } from "convex/values";
import { useSummaryPreferences } from "@/hooks/useSummaryPreferences";

interface SummaryPanelProps {
  /** userNewsletter document ID - typed for Convex safety */
  userNewsletterId: Id<"userNewsletters">;
}

/** Summary data from Convex query */
interface SummaryData {
  summary: string | null;
  isShared: boolean;
  generatedAt: number | null;
}

/**
 * SummaryPanel - Displays AI-generated summary for a newsletter
 * Story 5.1: Task 5 - Summary display component
 * Story 5.2: Task 2 - Collapse preference persistence
 *
 * Features:
 * - Collapsible summary view with persistent preference
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
  // Story 5.2: Use persisted preference for collapse state
  const { isCollapsed, toggleCollapsed } = useSummaryPreferences();
  // Exception: useAction doesn't provide isPending, manual state required
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Query for existing summary (resolves shared vs private automatically)
  // Returns: { summary: string | null, isShared: boolean, generatedAt: number | null }
  const { data } = useQuery(convexQuery(api.ai.getNewsletterSummary, { userNewsletterId }));
  // Code review fix: Trust the query return type, avoid manual type guards
  const summaryData = data as SummaryData | undefined;

  const generateSummaryAction = useAction(api.ai.generateSummary);

  const handleGenerate = async (forceRegenerate = false) => {
    setIsGenerating(true);
    setError(null);

    try {
      await generateSummaryAction({ userNewsletterId, forceRegenerate });
      // Summary will appear via real-time subscription from useQuery
    } catch (err) {
      if (err instanceof ConvexError) {
        const data = err.data as { message?: string; code?: string };
        setError(data.message ?? "Failed to generate summary");
      } else {
        setError("Failed to generate summary. Please try again.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const hasSummary = Boolean(summaryData?.summary);
  const isSharedSummary = summaryData?.isShared ?? false;

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
                onClick={toggleCollapsed}
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
          {/* Error state - Story 5.2 Task 5.2: Informative error message */}
          {error && (
            <div
              className="text-sm text-destructive mb-4 p-3 bg-destructive/10 rounded-lg"
              role="alert"
            >
              <p className="font-medium">Summary generation encountered an issue</p>
              <p className="text-xs mt-1 opacity-80">{error}</p>
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

          {/* Summary content - Story 5.2 Task 4.3: fade-in animation */}
          {!isGenerating && hasSummary && summaryData?.summary && (
            <div className="space-y-2 animate-in fade-in duration-300">
              {/* Shared summary indicator (community summary) */}
              {isSharedSummary && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="h-3 w-3" aria-hidden="true" />
                  <span>Community summary</span>
                </div>
              )}
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="text-muted-foreground whitespace-pre-wrap">{summaryData.summary}</p>
              </div>
              {/* Story 5.2 Task 4.4: Generated date metadata */}
              {summaryData.generatedAt && (
                <p className="text-xs text-muted-foreground/70 pt-2">
                  Generated on{" "}
                  {new Date(summaryData.generatedAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              )}
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
  );
}
