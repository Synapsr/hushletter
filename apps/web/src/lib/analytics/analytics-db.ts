import Database from "better-sqlite3"
import path from "path"
import type {
  AnalyticsDashboardData,
  AnalyticsEvent,
  DateRange,
  FunctionTypeFilter,
} from "./analytics-types"

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  function_name TEXT NOT NULL,
  function_type TEXT NOT NULL,
  event_type TEXT NOT NULL,
  estimated_size_bytes INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_events_timestamp ON analytics_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_function ON analytics_events(function_name);

CREATE TABLE IF NOT EXISTS analytics_hourly (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hour_bucket INTEGER NOT NULL,
  function_name TEXT NOT NULL,
  function_type TEXT NOT NULL,
  call_count INTEGER NOT NULL DEFAULT 0,
  reactive_update_count INTEGER NOT NULL DEFAULT 0,
  total_bytes INTEGER NOT NULL DEFAULT 0,
  UNIQUE(hour_bucket, function_name, function_type)
);

CREATE INDEX IF NOT EXISTS idx_hourly_bucket ON analytics_hourly(hour_bucket);

CREATE TABLE IF NOT EXISTS analytics_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day_bucket INTEGER NOT NULL,
  function_name TEXT NOT NULL,
  function_type TEXT NOT NULL,
  call_count INTEGER NOT NULL DEFAULT 0,
  reactive_update_count INTEGER NOT NULL DEFAULT 0,
  total_bytes INTEGER NOT NULL DEFAULT 0,
  UNIQUE(day_bucket, function_name, function_type)
);

CREATE INDEX IF NOT EXISTS idx_daily_bucket ON analytics_daily(day_bucket);

CREATE TABLE IF NOT EXISTS analytics_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`

let _db: Database.Database | null = null

export function getAnalyticsDb(): Database.Database {
  if (_db) return _db

  const dbPath =
    process.env.ANALYTICS_DB_PATH ||
    path.join(process.cwd(), "data", "analytics.db")

  // Ensure directory exists
  const dir = path.dirname(dbPath)
  const fs = require("fs")
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  _db = new Database(dbPath)
  _db.pragma("journal_mode = WAL")
  _db.pragma("synchronous = NORMAL")
  _db.exec(SCHEMA_SQL)

  return _db
}

export function insertEventsBatch(events: AnalyticsEvent[]): void {
  const db = getAnalyticsDb()
  const insert = db.prepare(`
    INSERT INTO analytics_events (timestamp, function_name, function_type, event_type, estimated_size_bytes, duration_ms)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const insertMany = db.transaction((items: AnalyticsEvent[]) => {
    for (const e of items) {
      insert.run(
        e.timestamp,
        e.functionName,
        e.functionType,
        e.eventType,
        e.estimatedSizeBytes,
        e.durationMs ?? null,
      )
    }
  })
  insertMany(events)
}

export function getAnalyticsData(
  dateRange: DateRange,
  functionType: FunctionTypeFilter,
): AnalyticsDashboardData {
  const db = getAnalyticsDb()
  const now = Date.now()
  const rangeMs = dateRange * 24 * 60 * 60 * 1000
  const since = now - rangeMs

  const typeFilter =
    functionType === "all" ? "" : "AND function_type = @functionType"

  // For short ranges (1d), query raw events directly; for longer, use aggregates
  if (dateRange === 1) {
    return queryFromEvents(db, since, functionType, typeFilter)
  }
  return queryFromAggregates(db, since, dateRange, functionType, typeFilter)
}

function queryFromEvents(
  db: Database.Database,
  since: number,
  functionType: FunctionTypeFilter,
  typeFilter: string,
): AnalyticsDashboardData {
  const params: Record<string, unknown> = { since }
  if (functionType !== "all") params.functionType = functionType

  // Totals
  const totals = db
    .prepare(
      `SELECT
      COALESCE(SUM(estimated_size_bytes), 0) as totalBytes,
      COUNT(*) as totalCalls,
      COUNT(*) FILTER (WHERE event_type = 'reactive_update') as totalReactiveUpdates,
      COUNT(DISTINCT function_name) as uniqueFunctions
    FROM analytics_events
    WHERE timestamp >= @since ${typeFilter}`,
    )
    .get(params) as any

  // Top functions
  const topFunctions = db
    .prepare(
      `SELECT
      function_name as functionName,
      function_type as functionType,
      COUNT(*) FILTER (WHERE event_type != 'reactive_update') as callCount,
      COUNT(*) FILTER (WHERE event_type = 'reactive_update') as reactiveUpdateCount,
      SUM(estimated_size_bytes) as totalBytes
    FROM analytics_events
    WHERE timestamp >= @since ${typeFilter}
    GROUP BY function_name, function_type
    ORDER BY totalBytes DESC
    LIMIT 20`,
    )
    .all(params) as any[]

  // Timeline (hourly buckets for 1-day range)
  const timeline = db
    .prepare(
      `SELECT
      (timestamp / 3600000) * 3600000 as bucket,
      SUM(estimated_size_bytes) as totalBytes,
      COUNT(*) as callCount
    FROM analytics_events
    WHERE timestamp >= @since ${typeFilter}
    GROUP BY bucket
    ORDER BY bucket`,
    )
    .all(params) as any[]

  return {
    totals: {
      totalBytes: totals.totalBytes ?? 0,
      totalCalls: totals.totalCalls ?? 0,
      totalReactiveUpdates: totals.totalReactiveUpdates ?? 0,
      uniqueFunctions: totals.uniqueFunctions ?? 0,
    },
    topFunctions,
    timeline,
  }
}

function queryFromAggregates(
  db: Database.Database,
  since: number,
  dateRange: DateRange,
  functionType: FunctionTypeFilter,
  typeFilter: string,
): AnalyticsDashboardData {
  const params: Record<string, unknown> = { since }
  if (functionType !== "all") params.functionType = functionType

  // Use hourly for 7d, daily for 30d
  const table = dateRange <= 7 ? "analytics_hourly" : "analytics_daily"
  const bucketCol = dateRange <= 7 ? "hour_bucket" : "day_bucket"

  // Also include recent raw events not yet aggregated
  const totalsFromAggregates = db
    .prepare(
      `SELECT
      COALESCE(SUM(total_bytes), 0) as totalBytes,
      COALESCE(SUM(call_count), 0) as totalCalls,
      COALESCE(SUM(reactive_update_count), 0) as totalReactiveUpdates
    FROM ${table}
    WHERE ${bucketCol} >= @since ${typeFilter}`,
    )
    .get(params) as any

  const totalsFromEvents = db
    .prepare(
      `SELECT
      COALESCE(SUM(estimated_size_bytes), 0) as totalBytes,
      COUNT(*) as totalCalls,
      COUNT(*) FILTER (WHERE event_type = 'reactive_update') as totalReactiveUpdates,
      COUNT(DISTINCT function_name) as uniqueFunctions
    FROM analytics_events
    WHERE timestamp >= @since ${typeFilter}`,
    )
    .get(params) as any

  // Unique function count from aggregates
  const uniqueFromAggregates = db
    .prepare(
      `SELECT COUNT(DISTINCT function_name) as count
    FROM ${table}
    WHERE ${bucketCol} >= @since ${typeFilter}`,
    )
    .get(params) as any

  // Top functions from aggregates + recent events
  const topFunctions = db
    .prepare(
      `SELECT functionName, functionType, SUM(callCount) as callCount,
      SUM(reactiveUpdateCount) as reactiveUpdateCount, SUM(totalBytes) as totalBytes
    FROM (
      SELECT function_name as functionName, function_type as functionType,
        call_count as callCount, reactive_update_count as reactiveUpdateCount,
        total_bytes as totalBytes
      FROM ${table}
      WHERE ${bucketCol} >= @since ${typeFilter}
      UNION ALL
      SELECT function_name, function_type,
        CASE WHEN event_type != 'reactive_update' THEN 1 ELSE 0 END,
        CASE WHEN event_type = 'reactive_update' THEN 1 ELSE 0 END,
        estimated_size_bytes
      FROM analytics_events
      WHERE timestamp >= @since ${typeFilter}
    )
    GROUP BY functionName, functionType
    ORDER BY totalBytes DESC
    LIMIT 20`,
    )
    .all(params) as any[]

  // Timeline
  const bucketSize = dateRange <= 7 ? 3600000 : 86400000
  const timeline = db
    .prepare(
      `SELECT bucket, SUM(totalBytes) as totalBytes, SUM(callCount) as callCount
    FROM (
      SELECT ${bucketCol} as bucket, total_bytes as totalBytes,
        call_count + reactive_update_count as callCount
      FROM ${table}
      WHERE ${bucketCol} >= @since ${typeFilter}
      UNION ALL
      SELECT (timestamp / ${bucketSize}) * ${bucketSize} as bucket,
        estimated_size_bytes as totalBytes, 1 as callCount
      FROM analytics_events
      WHERE timestamp >= @since ${typeFilter}
    )
    GROUP BY bucket
    ORDER BY bucket`,
    )
    .all(params) as any[]

  return {
    totals: {
      totalBytes:
        (totalsFromAggregates.totalBytes ?? 0) +
        (totalsFromEvents.totalBytes ?? 0),
      totalCalls:
        (totalsFromAggregates.totalCalls ?? 0) +
        (totalsFromEvents.totalCalls ?? 0),
      totalReactiveUpdates:
        (totalsFromAggregates.totalReactiveUpdates ?? 0) +
        (totalsFromEvents.totalReactiveUpdates ?? 0),
      uniqueFunctions: Math.max(
        uniqueFromAggregates.count ?? 0,
        totalsFromEvents.uniqueFunctions ?? 0,
      ),
    },
    topFunctions,
    timeline,
  }
}

export function runAggregation(): void {
  const db = getAnalyticsDb()
  const now = Date.now()

  // Check when last aggregation ran
  const lastRun = db
    .prepare("SELECT value FROM analytics_meta WHERE key = 'last_aggregation'")
    .get() as { value: string } | undefined
  const lastRunTime = lastRun ? parseInt(lastRun.value, 10) : 0
  const oneHour = 3600000

  if (now - lastRunTime < oneHour) return

  // Aggregate raw events older than 1 hour into hourly buckets
  db.exec(`
    INSERT INTO analytics_hourly (hour_bucket, function_name, function_type, call_count, reactive_update_count, total_bytes)
    SELECT
      (timestamp / 3600000) * 3600000,
      function_name,
      function_type,
      COUNT(*) FILTER (WHERE event_type != 'reactive_update'),
      COUNT(*) FILTER (WHERE event_type = 'reactive_update'),
      SUM(estimated_size_bytes)
    FROM analytics_events
    WHERE timestamp < ${now - oneHour}
    GROUP BY (timestamp / 3600000) * 3600000, function_name, function_type
    ON CONFLICT(hour_bucket, function_name, function_type) DO UPDATE SET
      call_count = call_count + excluded.call_count,
      reactive_update_count = reactive_update_count + excluded.reactive_update_count,
      total_bytes = total_bytes + excluded.total_bytes
  `)

  // Delete aggregated raw events
  db.exec(`DELETE FROM analytics_events WHERE timestamp < ${now - oneHour}`)

  // Aggregate hourly older than 24h into daily
  const oneDay = 86400000
  db.exec(`
    INSERT INTO analytics_daily (day_bucket, function_name, function_type, call_count, reactive_update_count, total_bytes)
    SELECT
      (hour_bucket / 86400000) * 86400000,
      function_name,
      function_type,
      SUM(call_count),
      SUM(reactive_update_count),
      SUM(total_bytes)
    FROM analytics_hourly
    WHERE hour_bucket < ${now - oneDay}
    GROUP BY (hour_bucket / 86400000) * 86400000, function_name, function_type
    ON CONFLICT(day_bucket, function_name, function_type) DO UPDATE SET
      call_count = call_count + excluded.call_count,
      reactive_update_count = reactive_update_count + excluded.reactive_update_count,
      total_bytes = total_bytes + excluded.total_bytes
  `)

  // Cleanup: remove old hourly (90 days) and daily (1 year)
  const ninetyDays = 90 * oneDay
  const oneYear = 365 * oneDay
  db.exec(`DELETE FROM analytics_hourly WHERE hour_bucket < ${now - ninetyDays}`)
  db.exec(`DELETE FROM analytics_daily WHERE day_bucket < ${now - oneYear}`)

  // Update last aggregation timestamp
  db.prepare(
    "INSERT INTO analytics_meta (key, value) VALUES ('last_aggregation', @value) ON CONFLICT(key) DO UPDATE SET value = @value",
  ).run({ value: String(now) })
}
