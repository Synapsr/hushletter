import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { cn } from "~/lib/utils"

/**
 * Props for the StatCard component
 * Story 7.1: Task 3.2 - Metric display card
 */
interface StatCardProps {
  /** The metric title/label */
  title: string
  /** The numeric value to display */
  value: number
  /** Optional icon to display in the header */
  icon?: React.ReactNode
  /** Optional trend text (e.g., "+5 today") */
  trend?: string
  /** Optional description text */
  description?: string
  /** Optional additional CSS classes */
  className?: string
}

/**
 * StatCard displays a single metric with optional trend and description
 * Story 7.1: Task 3.2
 *
 * @example
 * <StatCard
 *   title="Total Users"
 *   value={1234}
 *   icon={<Users className="h-4 w-4" />}
 *   trend="+5 today"
 * />
 */
export function StatCard({
  title,
  value,
  icon,
  trend,
  description,
  className,
}: StatCardProps) {
  return (
    <Card className={cn("", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon && (
          <div className="text-muted-foreground" aria-hidden="true">
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div
          className="text-2xl font-bold"
          aria-label={`${title}: ${value.toLocaleString()}`}
        >
          {value.toLocaleString()}
        </div>
        {trend && (
          <p
            className={`text-xs ${
              trend.startsWith("-")
                ? "text-red-600 dark:text-red-400"
                : "text-green-600 dark:text-green-400"
            }`}
          >
            {trend}
          </p>
        )}
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}
