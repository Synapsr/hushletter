import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import { StatCard } from "@/components/admin/StatCard";
import { ServiceStatusBadge } from "@/components/admin/ServiceStatusBadge";
import { RecentActivityFeed } from "@/components/admin/RecentActivityFeed";
import { TrendChart } from "@/components/admin/TrendChart";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@hushletter/ui";
import {
  Users,
  Mail,
  Building2,
  FileStack,
  Shield,
  CheckCircle,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { m } from "@/paraglide/messages.js";

/** Date range options for trend chart - Story 7.1 Task 4.5 */
type DateRange = 7 | 30 | 90;

/**
 * Admin Dashboard Page
 * Story 7.1: Task 3.1 - Main admin dashboard
 *
 * Displays:
 * - Service status indicators
 * - Key system metrics (users, newsletters, senders)
 * - Historical trend chart
 * - Recent activity feed
 *
 * All data is fetched via Convex subscriptions for real-time updates.
 */
export const Route = createFileRoute("/_authed/_navigation/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  // Story 7.1 Task 4.5: Date range selector state
  const [dateRange, setDateRange] = useState<DateRange>(30);

  // Fetch system statistics
  const { data: stats, isPending: statsLoading } = useQuery(
    convexQuery(api.admin.getSystemStats, {}),
  );

  // Fetch recent activity (last 24 hours)
  const { data: activity, isPending: activityLoading } = useQuery(
    convexQuery(api.admin.getRecentActivity, { hoursAgo: 24 }),
  );

  // Fetch service status
  const { data: serviceStatus, isPending: statusLoading } = useQuery(
    convexQuery(api.admin.getServiceStatus, {}),
  );

  // Fetch historical metrics for trend chart - respects dateRange selection
  const { data: history, isPending: historyLoading } = useQuery(
    convexQuery(api.admin.getMetricsHistory, { days: dateRange }),
  );

  // Story 7.3: Fetch privacy audit status for summary badge
  const { data: privacyAudit, isPending: privacyLoading } = useQuery(
    convexQuery(api.admin.runPrivacyAudit, {}),
  );

  return (
    <div className="space-y-6">
      {/* Service Status Row */}
      <section aria-label="Service Status">
        <h2 className="text-lg font-medium mb-3">{m.adminOverview_serviceStatus()}</h2>
        <div className="flex gap-4 flex-wrap">
          {statusLoading ? (
            <>
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-8 w-32" />
            </>
          ) : serviceStatus ? (
            <>
              <ServiceStatusBadge service={m.adminOverview_convexDatabase()} status={serviceStatus.convex} />
              <ServiceStatusBadge service={m.adminOverview_emailWorker()} status={serviceStatus.emailWorker} />
            </>
          ) : null}

          {/* Story 7.3: Privacy Compliance Badge */}
          {privacyLoading ? (
            <Skeleton className="h-8 w-40" />
          ) : privacyAudit ? (
            <Link
              to="/admin/privacy"
              className="flex items-center gap-2 px-3 py-1 rounded-full border hover:bg-accent transition-colors"
            >
              <Shield className="h-4 w-4" aria-hidden="true" />
              <span className="text-sm font-medium">{m.adminOverview_privacy()}</span>
              {privacyAudit.status === "PASS" && (
                <Badge
                  variant="default"
                  className="bg-green-600 hover:bg-green-700 flex items-center gap-1"
                >
                  <CheckCircle className="h-3 w-3" aria-hidden="true" />
                  {m.adminOverview_pass()}
                </Badge>
              )}
              {privacyAudit.status === "WARNING" && (
                <Badge
                  variant="default"
                  className="bg-yellow-600 hover:bg-yellow-700 flex items-center gap-1"
                >
                  <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                  {m.adminOverview_warning()}
                </Badge>
              )}
              {privacyAudit.status === "FAIL" && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <XCircle className="h-3 w-3" aria-hidden="true" />
                  {m.adminOverview_fail()}
                </Badge>
              )}
            </Link>
          ) : null}
        </div>
      </section>

      {/* Key Metrics Grid */}
      <section aria-label="System Metrics">
        <h2 className="text-lg font-medium mb-3">{m.adminOverview_systemOverview()}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[120px]" />)
          ) : stats ? (
            <>
              <StatCard
                title={m.adminOverview_totalUsers()}
                value={stats.totalUsers}
                icon={<Users className="h-4 w-4" />}
                trend={activity ? m.adminOverview_todayCount({ count: activity.newUsersCount }) : undefined}
              />
              <StatCard
                title={m.adminOverview_newslettersContent()}
                value={stats.totalNewsletters}
                icon={<Mail className="h-4 w-4" />}
                description={m.adminOverview_uniqueContent()}
              />
              <StatCard
                title={m.adminOverview_totalSenders()}
                value={stats.totalSenders}
                icon={<Building2 className="h-4 w-4" />}
              />
              <StatCard
                title={m.adminOverview_userLinks()}
                value={stats.totalUserNewsletters}
                icon={<FileStack className="h-4 w-4" />}
                trend={activity ? m.adminOverview_todayCount({ count: activity.newNewslettersCount }) : undefined}
              />
            </>
          ) : null}
        </div>
      </section>

      {/* Trend Chart with Date Range Selector - Story 7.1 Task 4.5 */}
      <section aria-label="Historical Trends">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>{m.adminOverview_dayTrends({ days: dateRange })}</CardTitle>
            <div className="flex gap-1" role="group" aria-label={m.adminOverview_selectDateRange()}>
              {([7, 30, 90] as const).map((days) => (
                <Button
                  key={days}
                  variant={dateRange === days ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDateRange(days)}
                  aria-pressed={dateRange === days}
                >
                  {m.adminOverview_daysLabel({ days })}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <Skeleton className="h-[200px]" />
            ) : history && history.length > 0 ? (
              <TrendChart data={history} />
            ) : (
              <p className="text-muted-foreground text-center py-8">
                {m.adminOverview_historicalEmpty()}
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Recent Activity Feed */}
      <section aria-label="Recent Activity">
        <Card>
          <CardHeader>
            <CardTitle>{m.adminOverview_recentActivity()}</CardTitle>
          </CardHeader>
          <CardContent>
            {activityLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : activity ? (
              <RecentActivityFeed items={activity.recentItems} />
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
