import { Card, CardContent, CardHeader, CardTitle } from "@hushletter/ui";
import { m } from "@/paraglide/messages.js";
import { format } from "date-fns";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { AnalyticsTimelinePoint, DateRange } from "@/lib/analytics/analytics-types";

/**
 * Props for the AnalyticsBandwidthChart component
 */
interface AnalyticsBandwidthChartProps {
  data: AnalyticsTimelinePoint[];
  dateRange: DateRange;
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
 * Area chart showing bandwidth usage over time
 */
export function AnalyticsBandwidthChart({ data, dateRange }: AnalyticsBandwidthChartProps) {
  // Determine date format based on range
  const getDateFormat = (range: DateRange): string => {
    switch (range) {
      case 1:
        return "HH:mm";
      case 7:
      case 30:
        return "MMM d";
      default:
        return "MMM d";
    }
  };

  const dateFormat = getDateFormat(dateRange);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.adminAnalytics_bandwidthOverTime()}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart
            data={data}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="bandwidthGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="bucket"
              tickFormatter={(timestamp) => format(new Date(timestamp), dateFormat)}
              className="text-xs"
            />
            <YAxis
              tickFormatter={(value) => formatBytes(value)}
              className="text-xs"
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload || !payload.length) return null;
                const data = payload[0].payload as AnalyticsTimelinePoint;
                return (
                  <div className="rounded-lg border bg-background p-3 shadow-md">
                    <p className="text-sm font-medium">
                      {format(new Date(data.bucket), "PPpp")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatBytes(data.totalBytes)}
                    </p>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="totalBytes"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#bandwidthGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
