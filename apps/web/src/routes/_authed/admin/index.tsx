import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@newsletter-manager/backend"
import { StatCard } from "~/components/admin/StatCard"
import { ServiceStatusBadge } from "~/components/admin/ServiceStatusBadge"
import { RecentActivityFeed } from "~/components/admin/RecentActivityFeed"
import { TrendChart } from "~/components/admin/TrendChart"
import { Skeleton } from "~/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Users, Mail, Building2, FileStack } from "lucide-react"

/** Date range options for trend chart - Story 7.1 Task 4.5 */
type DateRange = 7 | 30 | 90

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
export const Route = createFileRoute("/_authed/admin/")({
  component: AdminDashboard,
})

function AdminDashboard() {
  // Story 7.1 Task 4.5: Date range selector state
  const [dateRange, setDateRange] = useState<DateRange>(30)

  // Fetch system statistics
  const { data: stats, isPending: statsLoading } = useQuery(
    convexQuery(api.admin.getSystemStats, {})
  )

  // Fetch recent activity (last 24 hours)
  const { data: activity, isPending: activityLoading } = useQuery(
    convexQuery(api.admin.getRecentActivity, { hoursAgo: 24 })
  )

  // Fetch service status
  const { data: serviceStatus, isPending: statusLoading } = useQuery(
    convexQuery(api.admin.getServiceStatus, {})
  )

  // Fetch historical metrics for trend chart - respects dateRange selection
  const { data: history, isPending: historyLoading } = useQuery(
    convexQuery(api.admin.getMetricsHistory, { days: dateRange })
  )

  return (
    <div className="space-y-6">
      {/* Service Status Row */}
      <section aria-label="Service Status">
        <h2 className="text-lg font-medium mb-3">Service Status</h2>
        <div className="flex gap-4 flex-wrap">
          {statusLoading ? (
            <>
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-8 w-32" />
            </>
          ) : serviceStatus ? (
            <>
              <ServiceStatusBadge
                service="Convex Database"
                status={serviceStatus.convex}
              />
              <ServiceStatusBadge
                service="Email Worker"
                status={serviceStatus.emailWorker}
              />
            </>
          ) : null}
        </div>
      </section>

      {/* Key Metrics Grid */}
      <section aria-label="System Metrics">
        <h2 className="text-lg font-medium mb-3">System Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[120px]" />
            ))
          ) : stats ? (
            <>
              <StatCard
                title="Total Users"
                value={stats.totalUsers}
                icon={<Users className="h-4 w-4" />}
                trend={
                  activity ? `+${activity.newUsersCount} today` : undefined
                }
              />
              <StatCard
                title="Newsletters (Content)"
                value={stats.totalNewsletters}
                icon={<Mail className="h-4 w-4" />}
                description="Unique newsletter content"
              />
              <StatCard
                title="Total Senders"
                value={stats.totalSenders}
                icon={<Building2 className="h-4 w-4" />}
              />
              <StatCard
                title="User Newsletter Links"
                value={stats.totalUserNewsletters}
                icon={<FileStack className="h-4 w-4" />}
                trend={
                  activity
                    ? `+${activity.newNewslettersCount} today`
                    : undefined
                }
              />
            </>
          ) : null}
        </div>
      </section>

      {/* Trend Chart with Date Range Selector - Story 7.1 Task 4.5 */}
      <section aria-label="Historical Trends">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>{dateRange}-Day Trends</CardTitle>
            <div
              className="flex gap-1"
              role="group"
              aria-label="Select date range"
            >
              {([7, 30, 90] as const).map((days) => (
                <Button
                  key={days}
                  variant={dateRange === days ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDateRange(days)}
                  aria-pressed={dateRange === days}
                >
                  {days}d
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
                Historical data will appear after the first daily snapshot.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Recent Activity Feed */}
      <section aria-label="Recent Activity">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity (24h)</CardTitle>
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
  )
}
