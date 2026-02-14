import { Card, CardContent, CardHeader, CardTitle, Badge } from "@hushletter/ui";
import { m } from "@/paraglide/messages.js";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { AnalyticsAggregate } from "@/lib/analytics/analytics-types";

/**
 * Props for the AnalyticsTopFunctions component
 */
interface AnalyticsTopFunctionsProps {
  data: AnalyticsAggregate[];
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
 * Helper to get badge variant and className for function type
 */
function getFunctionTypeBadge(type: "query" | "mutation" | "action"): {
  variant: "default" | "secondary" | "destructive" | "outline";
  className?: string;
} {
  switch (type) {
    case "query":
      return { variant: "default" }; // blue (primary color)
    case "mutation":
      return { variant: "secondary", className: "bg-amber-500 text-white" }; // amber
    case "action":
      return { variant: "secondary", className: "bg-purple-500 text-white" }; // purple
  }
}

/**
 * Displays top functions by bandwidth with chart and table
 */
export function AnalyticsTopFunctions({ data }: AnalyticsTopFunctionsProps) {
  // Sort data by totalBytes descending
  const sortedData = [...data].sort((a, b) => b.totalBytes - a.totalBytes);
  const topTen = sortedData.slice(0, 10);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.adminAnalytics_topFunctions()}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Bar Chart - Top 10 */}
        <div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={topTen}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
            >
              <XAxis type="number" tickFormatter={(value) => formatBytes(value)} />
              <YAxis
                type="category"
                dataKey="functionName"
                width={110}
                tickFormatter={(name: string) =>
                  name.length > 16 ? `${name.slice(0, 16)}...` : name
                }
                className="text-xs"
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const data = payload[0].payload as AnalyticsAggregate;
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-md">
                      <p className="text-sm font-medium">{data.functionName}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatBytes(data.totalBytes)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {data.callCount.toLocaleString()} calls
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="totalBytes" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Table - All Functions */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr className="text-left">
                <th className="pb-2 pr-4 font-medium text-muted-foreground">
                  {m.adminAnalytics_functionName()}
                </th>
                <th className="pb-2 px-4 font-medium text-muted-foreground">
                  {m.adminAnalytics_functionType()}
                </th>
                <th className="pb-2 px-4 font-medium text-muted-foreground text-right">
                  {m.adminAnalytics_callCount()}
                </th>
                <th className="pb-2 px-4 font-medium text-muted-foreground text-right">
                  {m.adminAnalytics_updateCount()}
                </th>
                <th className="pb-2 pl-4 font-medium text-muted-foreground text-right">
                  {m.adminAnalytics_totalSize()}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sortedData.map((func, index) => (
                <tr key={`${func.functionName}-${index}`} className="hover:bg-muted/50">
                  <td className="py-3 pr-4 font-mono text-xs">{func.functionName}</td>
                  <td className="py-3 px-4">
                    <Badge
                      variant={getFunctionTypeBadge(func.functionType).variant}
                      className={getFunctionTypeBadge(func.functionType).className}
                    >
                      {func.functionType}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums">
                    {func.callCount.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums">
                    {func.reactiveUpdateCount.toLocaleString()}
                  </td>
                  <td className="py-3 pl-4 text-right tabular-nums font-medium">
                    {formatBytes(func.totalBytes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
