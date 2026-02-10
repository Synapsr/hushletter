import { createFileRoute } from "@tanstack/react-router";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { api } from "@hushletter/backend";
import { ModerationQueueTable } from "@/components/admin/ModerationQueueTable";
import { Alert, AlertDescription, AlertTitle, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@hushletter/ui";
import { AlertCircle, Inbox } from "lucide-react";
import { m } from "@/paraglide/messages.js";

/**
 * Admin Moderation Queue Page
 * Story 9.6: Task 3.1 - Moderation page route
 *
 * Displays the moderation queue for admin to review user newsletters
 * before publishing to community (Story 9.7).
 *
 * Key differences from Community Content (Story 7.4):
 * - This shows USER newsletters (userNewsletters with privateR2Key)
 * - Community Content shows published content (newsletterContent)
 * - This is for PRE-publication review
 */
export const Route = createFileRoute("/_authed/admin/moderation")({
  component: ModerationPage,
});

function ModerationPage() {
  const {
    data: queueCount,
    isPending: countLoading,
    isError: countError,
    error: countErrorMessage,
  } = useQuery(convexQuery(api.admin.getModerationQueueCount, {}));

  // Show error alert if count query failed
  const hasError = countError;
  const errorMessage = countErrorMessage?.message || m.adminModeration_loadError();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{m.adminModeration_title()}</h2>
          <p className="text-muted-foreground mt-1">
            {m.adminModeration_description()}
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {hasError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>{m.common_error()}</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Queue Count Summary */}
      <section aria-label="Moderation Queue Summary">
        {countLoading ? (
          <Skeleton className="h-[100px] w-[200px]" />
        ) : (
          <Card className="w-fit">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Inbox className="h-4 w-4" aria-hidden="true" />
                {m.adminModeration_pendingReview()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{queueCount?.count ?? 0}</p>
              <p className="text-xs text-muted-foreground mt-1">{m.adminModeration_pendingCount({ count: queueCount?.count ?? 0 })}</p>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Moderation Queue Table */}
      <section aria-label="Moderation Queue">
        <ModerationQueueTable />
      </section>
    </div>
  );
}
