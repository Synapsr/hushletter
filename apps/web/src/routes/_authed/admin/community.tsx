import { createFileRoute } from "@tanstack/react-router"
import { convexQuery } from "@convex-dev/react-query"
import { useQuery } from "@tanstack/react-query"
import { api } from "@hushletter/backend"
import { useState } from "react"
import { CommunityContentTable } from "~/components/admin/CommunityContentTable"
import { BlockedSendersTable } from "~/components/admin/BlockedSendersTable"
import { ReportsQueue } from "~/components/admin/ReportsQueue"
import { ModerationLogTable } from "~/components/admin/ModerationLogTable"
import { Skeleton } from "~/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { AlertCircle, Eye, EyeOff, Ban, Flag } from "lucide-react"
import { Badge } from "~/components/ui/badge"

/** Community content summary type */
interface CommunitySummary {
  totalContent: number
  hiddenContent: number
  activeContent: number
  blockedSenders: number
  pendingReports: number
}

/**
 * Community Content Management Page - Admin dashboard for content moderation
 * Story 7.4: Task 7.1 - Community management page
 *
 * Displays:
 * 1. Summary statistics (total, hidden, blocked senders, pending reports)
 * 2. Content list with moderation actions (hide/restore)
 * 3. Blocked senders management
 * 4. Content reports queue
 * 5. Moderation audit log
 */
export const Route = createFileRoute("/_authed/admin/community")({
  component: CommunityManagement,
})

function CommunityManagement() {
  const [activeTab, setActiveTab] = useState("content")

  const {
    data: summary,
    isPending: summaryLoading,
    isError: summaryError,
    error: summaryErrorMessage,
  } = useQuery(convexQuery(api.admin.getCommunityContentSummary, {}))

  const { data: pendingReportsCount } = useQuery(
    convexQuery(api.admin.getPendingReportsCount, {})
  )

  // Show error alert if summary query failed
  const hasError = summaryError
  const errorMessage =
    summaryErrorMessage?.message || "An error occurred loading community data"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Community Content</h2>
      </div>

      {/* Error Alert */}
      {hasError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {/* Summary Statistics */}
      <section aria-label="Community Summary Statistics">
        {summaryLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={`summary-skeleton-${i}`} className="h-[100px]" />
            ))}
          </div>
        ) : summary ? (
          <SummaryCards summary={summary as CommunitySummary} />
        ) : null}
      </section>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="blocked">Blocked Senders</TabsTrigger>
          <TabsTrigger value="reports">
            Reports
            {typeof pendingReportsCount === "number" && pendingReportsCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingReportsCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="log">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-4">
          <section aria-label="Community Content List">
            <CommunityContentTable />
          </section>
        </TabsContent>

        <TabsContent value="blocked">
          <section aria-label="Blocked Senders">
            <BlockedSendersTable />
          </section>
        </TabsContent>

        <TabsContent value="reports">
          <section aria-label="Content Reports Queue">
            <ReportsQueue />
          </section>
        </TabsContent>

        <TabsContent value="log">
          <section aria-label="Moderation Audit Log">
            <ModerationLogTable />
          </section>
        </TabsContent>
      </Tabs>
    </div>
  )
}

/** Summary cards component for community statistics */
function SummaryCards({ summary }: { summary: CommunitySummary }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Content
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{summary.totalContent}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
            <Eye className="h-4 w-4" aria-hidden="true" />
            Active
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-green-600">
            {summary.activeContent}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
            <EyeOff className="h-4 w-4" aria-hidden="true" />
            Hidden
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-yellow-600">
            {summary.hiddenContent}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
            <Ban className="h-4 w-4" aria-hidden="true" />
            Blocked Senders
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-red-600">
            {summary.blockedSenders}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
            <Flag className="h-4 w-4" aria-hidden="true" />
            Pending Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-orange-600">
            {summary.pendingReports}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
