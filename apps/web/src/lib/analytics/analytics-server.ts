import { createServerFn } from "@tanstack/react-start"
import type {
  AnalyticsEvent,
  AnalyticsDashboardData,
  DateRange,
  FunctionTypeFilter,
} from "./analytics-types"

export const writeAnalyticsBatch = createServerFn({ method: "POST" })
  .inputValidator(
    (data: unknown): AnalyticsEvent[] => {
      if (!Array.isArray(data)) throw new Error("Expected array")
      return data as AnalyticsEvent[]
    },
  )
  .handler(async ({ data }) => {
    const { insertEventsBatch } = await import("./analytics-db")
    insertEventsBatch(data)
    return { ok: true }
  })

export const getAnalyticsDashboard = createServerFn({ method: "GET" })
  .inputValidator(
    (
      data: unknown,
    ): { dateRange: DateRange; functionType: FunctionTypeFilter } => {
      const d = data as any
      return {
        dateRange: [1, 7, 30].includes(d?.dateRange) ? d.dateRange : 7,
        functionType: ["all", "query", "mutation", "action"].includes(
          d?.functionType,
        )
          ? d.functionType
          : "all",
      }
    },
  )
  .handler(async ({ data }): Promise<AnalyticsDashboardData> => {
    const { getAnalyticsData, runAggregation } = await import("./analytics-db")
    // Lazy aggregation: runs if >1h since last run
    runAggregation()
    return getAnalyticsData(data.dateRange, data.functionType)
  })
