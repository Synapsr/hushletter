import { m } from "@/paraglide/messages.js";
import { cn } from "@/lib/utils";
import type { DateRange, FunctionTypeFilter } from "@/lib/analytics/analytics-types";

/**
 * Props for the AnalyticsFilters component
 */
interface AnalyticsFiltersProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  functionType: FunctionTypeFilter;
  onFunctionTypeChange: (type: FunctionTypeFilter) => void;
}

/**
 * Filter controls for analytics dashboard
 * Provides date range and function type filtering
 */
export function AnalyticsFilters({
  dateRange,
  onDateRangeChange,
  functionType,
  onFunctionTypeChange,
}: AnalyticsFiltersProps) {
  const dateRanges: { value: DateRange; label: string }[] = [
    { value: 1, label: m.adminAnalytics_1d() },
    { value: 7, label: m.adminAnalytics_7d() },
    { value: 30, label: m.adminAnalytics_30d() },
  ];

  const functionTypes: { value: FunctionTypeFilter; label: string }[] = [
    { value: "all", label: m.adminAnalytics_allTypes() },
    { value: "query", label: m.adminAnalytics_queries() },
    { value: "mutation", label: m.adminAnalytics_mutations() },
    { value: "action", label: m.adminAnalytics_actions() },
  ];

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Date Range Filter */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-muted-foreground">
          {m.adminAnalytics_dateRange()}
        </label>
        <div className="inline-flex rounded-md shadow-sm" role="group">
          {dateRanges.map((range) => (
            <button
              key={range.value}
              type="button"
              onClick={() => onDateRangeChange(range.value)}
              className={cn(
                "px-4 py-2 text-sm font-medium border transition-colors",
                "first:rounded-l-md last:rounded-r-md",
                "focus:z-10 focus:outline-none focus:ring-2 focus:ring-ring",
                dateRange === range.value
                  ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                  : "bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Function Type Filter */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-muted-foreground">
          {m.adminAnalytics_filterType()}
        </label>
        <div className="inline-flex rounded-md shadow-sm" role="group">
          {functionTypes.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => onFunctionTypeChange(type.value)}
              className={cn(
                "px-4 py-2 text-sm font-medium border transition-colors",
                "first:rounded-l-md last:rounded-r-md",
                "focus:z-10 focus:outline-none focus:ring-2 focus:ring-ring",
                functionType === type.value
                  ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                  : "bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
