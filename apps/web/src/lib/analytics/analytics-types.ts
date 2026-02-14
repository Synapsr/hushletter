export interface AnalyticsEvent {
  timestamp: number
  functionName: string
  functionType: "query" | "mutation" | "action"
  eventType: "initial" | "reactive_update" | "call"
  estimatedSizeBytes: number
  durationMs?: number
}

export interface AnalyticsAggregate {
  functionName: string
  functionType: "query" | "mutation" | "action"
  callCount: number
  reactiveUpdateCount: number
  totalBytes: number
}

export interface AnalyticsTimelinePoint {
  bucket: number
  totalBytes: number
  callCount: number
}

export interface AnalyticsDashboardData {
  totals: {
    totalBytes: number
    totalCalls: number
    totalReactiveUpdates: number
    uniqueFunctions: number
  }
  topFunctions: AnalyticsAggregate[]
  timeline: AnalyticsTimelinePoint[]
}

export type DateRange = 1 | 7 | 30
export type FunctionTypeFilter = "all" | "query" | "mutation" | "action"
