import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@hushletter/ui";
import { m } from "@/paraglide/messages.js";
import { Activity, Zap, Code, RefreshCw } from "lucide-react";
import { AnalyticsFilters } from "./AnalyticsFilters";
import { AnalyticsBandwidthChart } from "./AnalyticsBandwidthChart";
import { AnalyticsTopFunctions } from "./AnalyticsTopFunctions";
import type {
  AnalyticsDashboardData,
  DateRange,
  FunctionTypeFilter,
} from "@/lib/analytics/analytics-types";

/**
 * Props for the AnalyticsDashboard component
 */
interface AnalyticsDashboardProps {
  data: AnalyticsDashboardData | undefined;
  isPending: boolean;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  functionType: FunctionTypeFilter;
  onFunctionTypeChange: (type: FunctionTypeFilter) => void;
}

/**
 * Helper function to format bytes into human-readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Main analytics dashboard layout
 */
export function AnalyticsDashboard({
  data,
  isPending,
  dateRange,
  onDateRangeChange,
  functionType,
  onFunctionTypeChange,
}: AnalyticsDashboardProps) {
  // Loading state
  if (isPending) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{m.adminAnalytics_title()}</h1>
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-[400px] w-full" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  // Empty state
  if (!data || data.totals.totalBytes === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{m.adminAnalytics_title()}</h1>
        <AnalyticsFilters
          dateRange={dateRange}
          onDateRangeChange={onDateRangeChange}
          functionType={functionType}
          onFunctionTypeChange={onFunctionTypeChange}
        />
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">{m.adminAnalytics_noData()}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { totals, topFunctions, timeline } = data;

  // Calculate reactive update percentage
  const reactivePercentage =
    totals.totalCalls > 0
      ? ((totals.totalReactiveUpdates / totals.totalCalls) * 100).toFixed(1)
      : "0";

  return (
    <div className="space-y-6">
      {/* Title */}
      <h1 className="text-3xl font-bold">{m.adminAnalytics_title()}</h1>

      {/* Filters */}
      <AnalyticsFilters
        dateRange={dateRange}
        onDateRangeChange={onDateRangeChange}
        functionType={functionType}
        onFunctionTypeChange={onFunctionTypeChange}
      />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Bandwidth */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {m.adminAnalytics_totalBandwidth()}
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(totals.totalBytes)}</div>
          </CardContent>
        </Card>

        {/* Total Calls */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {m.adminAnalytics_totalCalls()}
            </CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.totalCalls.toLocaleString()}</div>
          </CardContent>
        </Card>

        {/* Unique Functions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {m.adminAnalytics_uniqueFunctions()}
            </CardTitle>
            <Code className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.uniqueFunctions.toLocaleString()}</div>
          </CardContent>
        </Card>

        {/* Reactive Updates */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {m.adminAnalytics_reactiveUpdates()}
            </CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reactivePercentage}%</div>
            <p className="text-xs text-muted-foreground">
              {totals.totalReactiveUpdates.toLocaleString()} / {totals.totalCalls.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bandwidth Chart */}
      <AnalyticsBandwidthChart data={timeline} dateRange={dateRange} />

      {/* Top Functions */}
      <AnalyticsTopFunctions data={topFunctions} />
    </div>
  );
}
