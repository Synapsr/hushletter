import { useMemo } from "react"
import { m } from "@/paraglide/messages.js"

/**
 * Metrics history item data structure
 */
interface MetricsHistoryItem {
  /** Date in YYYY-MM-DD format */
  date: string
  /** Total users at this point */
  totalUsers: number
  /** Total newsletter content at this point */
  totalNewsletters: number
  /** Total senders at this point */
  totalSenders: number
  /** Total user-newsletter relationships at this point */
  totalUserNewsletters: number
}

/**
 * Props for the TrendChart component
 * Story 7.1: Task 4.4 - Trend visualization
 */
interface TrendChartProps {
  /** Array of historical metrics data points */
  data: MetricsHistoryItem[]
}

/**
 * TrendItem displays a single growth metric
 */
function TrendItem({ label, value }: { label: string; value: number }) {
  const isPositive = value >= 0

  return (
    <div className="text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={`text-lg font-semibold ${
          isPositive ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
        }`}
        aria-label={m.trendChart_growthLabel({ label, sign: isPositive ? "+" : "", value })}
      >
        {isPositive ? "+" : ""}
        {value}
      </p>
    </div>
  )
}

/**
 * TrendChart displays growth trends over the historical data period
 * Story 7.1: Task 4.4
 *
 * For MVP, shows a simple text-based trend display comparing
 * the first and last data points.
 *
 * Future enhancement: Use a chart library like recharts or @visx/xychart
 * for richer visualizations.
 *
 * @example
 * <TrendChart data={[
 *   { date: "2026-01-01", totalUsers: 100, totalNewsletters: 500, ... },
 *   { date: "2026-01-25", totalUsers: 150, totalNewsletters: 750, ... }
 * ]} />
 */
export function TrendChart({ data }: TrendChartProps) {
  const summary = useMemo(() => {
    if (data.length < 2) return null

    const first = data[0]
    const last = data[data.length - 1]

    return {
      userGrowth: last.totalUsers - first.totalUsers,
      newsletterGrowth: last.totalNewsletters - first.totalNewsletters,
      senderGrowth: last.totalSenders - first.totalSenders,
    }
  }, [data])

  if (!summary) {
    return (
      <p className="text-muted-foreground text-center py-4">
        {m.trendChart_notEnoughData()}
      </p>
    )
  }

  return (
    <div className="space-y-4" role="region" aria-label={m.trendChart_regionLabel()}>
      <div className="grid grid-cols-3 gap-4">
        <TrendItem label={m.trendChart_labelUsers()} value={summary.userGrowth} />
        <TrendItem label={m.trendChart_labelNewsletters()} value={summary.newsletterGrowth} />
        <TrendItem label={m.trendChart_labelSenders()} value={summary.senderGrowth} />
      </div>

      <div className="text-xs text-muted-foreground border-t pt-3">
        <p>
          {m.trendChart_dataRange({ start: data[0].date, end: data[data.length - 1].date })}
        </p>
        <p>{m.trendChart_dataPoints({ count: data.length })}</p>
      </div>
    </div>
  )
}
