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

/**
 * Clean up expired folder merge history records
 * Story 9.5 Code Review Fix HIGH-1/LOW-3: TTL cleanup for folderMergeHistory
 *
 * Runs every 5 minutes to delete merge history records past their 30-second TTL.
 * This prevents unbounded growth of the folderMergeHistory table.
 */
crons.interval(
  "cleanup expired merge history",
  { minutes: 5 },
  internal.folders.cleanupExpiredMergeHistory
)

crons.interval(
  "cleanup expired binned newsletters",
  { hours: 1 },
  (internal as any).newsletters.cleanupExpiredBinnedNewsletters
)

export default crons
