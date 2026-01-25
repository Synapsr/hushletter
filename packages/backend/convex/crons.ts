import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()

/**
 * Record daily metrics at midnight UTC
 * Story 7.1: Task 4.2 - Daily metrics snapshot
 *
 * This cron job captures system statistics daily for trend analysis.
 * The mutation is idempotent - won't duplicate if run multiple times.
 */
crons.daily(
  "record daily metrics",
  { hourUTC: 0, minuteUTC: 0 },
  internal.admin.recordDailyMetrics
)

export default crons
