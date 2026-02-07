import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, AlertCircle, Clock, Download } from "lucide-react";

/**
 * Delivery statistics shape from getDeliveryStats query
 * Story 7.2: Task 4.2
 */
interface DeliveryStats {
  received: number;
  processing: number;
  stored: number;
  failed: number;
  total: number;
  successRate: number;
  periodHours: number;
}

/**
 * Props for the DeliveryStatsCard component
 */
interface DeliveryStatsCardProps {
  /** The delivery statistics to display */
  stats: DeliveryStats;
}

/**
 * DeliveryStatsCard displays delivery statistics in a grid of cards
 * Story 7.2: Task 4.2 - Success/failure rate display
 *
 * Shows four metric cards:
 * - Total received emails
 * - Successfully stored emails with success rate
 * - Currently processing emails
 * - Failed emails needing attention
 *
 * @example
 * <DeliveryStatsCard stats={deliveryStats} />
 */
export function DeliveryStatsCard({ stats }: DeliveryStatsCardProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Total Received Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total Received</CardTitle>
          <Download className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div
            className="text-2xl font-bold"
            aria-label={`Total received: ${stats.total.toLocaleString()}`}
          >
            {stats.total.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">emails in {stats.periodHours}h</p>
        </CardContent>
      </Card>

      {/* Successfully Stored Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Successfully Stored</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-600" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div
            className="text-2xl font-bold text-green-600 dark:text-green-400"
            aria-label={`Successfully stored: ${stats.stored.toLocaleString()}`}
          >
            {stats.stored.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">{stats.successRate}% success rate</p>
        </CardContent>
      </Card>

      {/* Processing Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Processing</CardTitle>
          <Clock className="h-4 w-4 text-yellow-600" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div
            className="text-2xl font-bold text-yellow-600 dark:text-yellow-400"
            aria-label={`Processing: ${(stats.received + stats.processing).toLocaleString()}`}
          >
            {(stats.received + stats.processing).toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">in progress</p>
        </CardContent>
      </Card>

      {/* Failed Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Failed</CardTitle>
          <AlertCircle className="h-4 w-4 text-red-600" aria-hidden="true" />
        </CardHeader>
        <CardContent>
          <div
            className="text-2xl font-bold text-red-600 dark:text-red-400"
            aria-label={`Failed: ${stats.failed.toLocaleString()}`}
          >
            {stats.failed.toLocaleString()}
          </div>
          <p className="text-xs text-muted-foreground">need attention</p>
        </CardContent>
      </Card>
    </div>
  );
}
