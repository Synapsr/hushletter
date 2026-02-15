import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import { DeliveryStatsCard } from "@/components/admin/DeliveryStatsCard";
import { DeliveryLogTable } from "@/components/admin/DeliveryLogTable";
import { AnomalyAlertBanner } from "@/components/admin/AnomalyAlertBanner";
import { Card, CardContent, CardHeader, CardTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton } from "@hushletter/ui";
import { m } from "@/paraglide/messages.js";

/**
 * Email Delivery Monitoring Page
 * Story 7.2: Task 4.1 - Delivery monitoring page
 *
 * Displays:
 * - Anomaly alerts for critical issues
 * - Delivery statistics (24h)
 * - Success rates by time period
 * - Delivery logs with filtering
 */
export const Route = createFileRoute("/_authed/_navigation/admin/delivery")({
  component: DeliveryMonitoring,
});

/** Delivery status filter type */
type DeliveryStatusFilter = "all" | "received" | "processing" | "stored" | "failed";

function DeliveryMonitoring() {
  const [statusFilter, setStatusFilter] = useState<DeliveryStatusFilter>("all");

  // Fetch delivery statistics (24h)
  const { data: stats, isPending: statsLoading } = useQuery(
    convexQuery(api.admin.getDeliveryStats, { hoursAgo: 24 }),
  );

  // Fetch success rates by period
  const { data: rateStats, isPending: rateStatsLoading } = useQuery(
    convexQuery(api.admin.getDeliveryRateStats, {}),
  );

  // Fetch delivery logs with status filter
  const { data: logs, isPending: logsLoading } = useQuery(
    convexQuery(api.admin.listDeliveryLogs, {
      status: statusFilter === "all" ? undefined : statusFilter,
      limit: 50,
    }),
  );

  // Fetch anomalies for alert banner
  const { data: anomalies, isPending: anomaliesLoading } = useQuery(
    convexQuery(api.admin.getDeliveryAnomalies, {}),
  );

  // Fetch failed count for badge in header
  const { data: failedDeliveries } = useQuery(
    convexQuery(api.admin.getFailedDeliveries, { includeAcknowledged: false }),
  );

  return (
    <div className="space-y-6">
      {/* Anomaly Alerts */}
      {!anomaliesLoading && anomalies && anomalies.length > 0 && (
        <AnomalyAlertBanner anomalies={anomalies} />
      )}

      {/* Delivery Stats Cards */}
      <section aria-label="Delivery Statistics">
        <h2 className="text-lg font-medium mb-3">{m.adminDelivery_statsTitle()}</h2>
        {statsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[100px]" />
            ))}
          </div>
        ) : stats ? (
          <DeliveryStatsCard stats={stats} />
        ) : null}
      </section>

      {/* Rate Stats by Period */}
      <section aria-label="Success Rates">
        <Card>
          <CardHeader>
            <CardTitle>{m.adminDelivery_successRates()}</CardTitle>
          </CardHeader>
          <CardContent>
            {rateStatsLoading ? (
              <Skeleton className="h-[60px]" />
            ) : rateStats ? (
              <div className="grid grid-cols-3 gap-4">
                {rateStats.map((period) => (
                  <div key={period.period} className="text-center">
                    <p className="text-sm text-muted-foreground">{period.period}</p>
                    <p
                      className={`text-2xl font-bold ${
                        period.successRate >= 95
                          ? "text-green-600 dark:text-green-400"
                          : period.successRate >= 80
                            ? "text-yellow-600 dark:text-yellow-400"
                            : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {period.successRate}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {m.adminDelivery_delivered({ stored: period.stored, total: period.total })}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      {/* Delivery Logs */}
      <section aria-label="Delivery Logs">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>
              {m.adminDelivery_logsTitle()}
              {failedDeliveries && failedDeliveries.length > 0 && (
                <span className="ml-2 text-sm font-normal text-red-600 dark:text-red-400">
                  {m.adminDelivery_failedCount({ count: failedDeliveries.length })}
                </span>
              )}
            </CardTitle>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as DeliveryStatusFilter)}
            >
              <SelectTrigger className="w-[150px]" aria-label={m.adminDelivery_filterByStatus()}>
                <SelectValue placeholder={m.adminDelivery_filterByStatus()} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{m.adminDelivery_allStatus()}</SelectItem>
                <SelectItem value="received">{m.adminDelivery_received()}</SelectItem>
                <SelectItem value="processing">{m.adminDelivery_processing()}</SelectItem>
                <SelectItem value="stored">{m.adminDelivery_stored()}</SelectItem>
                <SelectItem value="failed">{m.adminDelivery_failed()}</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : logs ? (
              <DeliveryLogTable logs={logs.items} hasMore={logs.hasMore} />
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
