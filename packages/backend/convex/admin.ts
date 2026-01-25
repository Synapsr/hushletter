import { query, mutation, internalMutation } from "./_generated/server"
import { v } from "convex/values"
import { requireAdmin } from "./_internal/auth"
import { authComponent } from "./auth"

/**
 * Admin queries and mutations for system health dashboard.
 * Story 7.1: Admin Dashboard & System Health
 * Story 7.2: Email Delivery Monitoring
 *
 * CRITICAL: Every function in this file MUST call requireAdmin() first.
 */

/**
 * Format a timestamp into a human-readable "time ago" string
 */
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return "just now"
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

/**
 * Get system-wide statistics
 * Story 7.1 Task 2.2
 *
 * Returns counts of all major entities in the system.
 *
 * ⚠️ PERFORMANCE NOTE: This query loads all records into memory to count them.
 * Convex doesn't have COUNT aggregation, so we use .collect().length.
 * At scale (>10k records per table), consider:
 * - Adding a `systemCounters` table updated by triggers/mutations
 * - Using pagination with estimates
 * - Caching counts in systemMetricsHistory (already collected daily)
 */
export const getSystemStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)

    // Get counts using aggregation patterns
    // WARNING: Full table scans - see performance note above
    const users = await ctx.db.query("users").collect()
    const newsletters = await ctx.db.query("newsletterContent").collect()
    const senders = await ctx.db.query("senders").collect()
    const userNewsletters = await ctx.db.query("userNewsletters").collect()

    return {
      totalUsers: users.length,
      totalNewsletters: newsletters.length,
      totalSenders: senders.length,
      totalUserNewsletters: userNewsletters.length,
      // Note: Storage calculation requires R2 API call (action, not query)
    }
  },
})

/**
 * Get recent platform activity
 * Story 7.1 Task 2.3
 *
 * Returns activity summary for a configurable time window (default 24h).
 *
 * ⚠️ PERFORMANCE NOTE: Uses .filter() which causes full table scans.
 * For better performance at scale, add indexes:
 * - users.index("by_createdAt", ["createdAt"])
 * - userNewsletters already has by_receivedAt index (added below)
 */
export const getRecentActivity = query({
  args: {
    hoursAgo: v.optional(v.number()), // defaults to 24
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const hoursAgo = args.hoursAgo ?? 24
    const cutoff = Date.now() - hoursAgo * 60 * 60 * 1000

    // Count recent users (by _creationTime since createdAt may not exist on all records)
    // TODO: Add by_createdAt index for better performance at scale
    const recentUsers = await ctx.db
      .query("users")
      .filter((q) => q.gte(q.field("_creationTime"), cutoff))
      .collect()

    // Count recent newsletters using by_receivedAt index
    const recentNewsletters = await ctx.db
      .query("userNewsletters")
      .withIndex("by_receivedAt", (q) => q.gte("receivedAt", cutoff))
      .collect()

    // Get sample of recent items for activity feed
    const recentItems = recentNewsletters.slice(0, 10).map((n) => ({
      type: "newsletter" as const,
      subject: n.subject,
      senderEmail: n.senderEmail,
      timestamp: n.receivedAt,
    }))

    return {
      newUsersCount: recentUsers.length,
      newNewslettersCount: recentNewsletters.length,
      recentItems,
      periodHours: hoursAgo,
    }
  },
})

/**
 * Check service connectivity status
 * Story 7.1 Task 2.4
 *
 * Returns health status for key services.
 * Note: R2 and AI status would require actions (external API calls).
 */
export const getServiceStatus = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)

    // Convex is healthy if this query executes
    const convexHealthy = true

    // Check last newsletter received (indicates email worker health)
    const lastNewsletter = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId_receivedAt")
      .order("desc")
      .first()

    const lastNewsletterAge = lastNewsletter
      ? Date.now() - lastNewsletter.receivedAt
      : null

    // Email worker considered healthy if we received a newsletter in last 24h
    // OR if this is a new system with no newsletters yet
    const emailWorkerHealthy =
      lastNewsletterAge === null || lastNewsletterAge < 24 * 60 * 60 * 1000

    return {
      convex: {
        healthy: convexHealthy,
        message: "Connected",
      },
      emailWorker: {
        healthy: emailWorkerHealthy,
        message: lastNewsletter
          ? `Last email: ${formatTimeAgo(lastNewsletter.receivedAt)}`
          : "No emails received yet",
        lastActivity: lastNewsletter?.receivedAt ?? null,
      },
      // Note: R2 and AI status would require actions (external API calls)
    }
  },
})

/**
 * Get metrics history for trend display
 * Story 7.1 Task 4.3
 *
 * Returns historical metrics for the specified number of days.
 * Capped at 90 days to prevent excessive data loading.
 */
export const getMetricsHistory = query({
  args: {
    days: v.optional(v.number()), // defaults to 30
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const days = Math.min(args.days ?? 30, 90) // Cap at 90 days
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000

    const history = await ctx.db
      .query("systemMetricsHistory")
      .withIndex("by_recordedAt")
      .filter((q) => q.gte(q.field("recordedAt"), cutoff))
      .order("asc")
      .collect()

    return history
  },
})

/**
 * Record daily metrics snapshot
 * Called by cron job at midnight UTC
 * Story 7.1 Task 4.2
 *
 * This is idempotent - will not duplicate if already recorded today.
 */
export const recordDailyMetrics = internalMutation({
  args: {},
  handler: async (ctx) => {
    const today = new Date().toISOString().split("T")[0] // "2026-01-25"

    // Check if we already recorded today (idempotency)
    const existing = await ctx.db
      .query("systemMetricsHistory")
      .withIndex("by_date", (q) => q.eq("date", today))
      .first()

    if (existing) {
      return { recorded: false, reason: "Already recorded today" }
    }

    // Collect counts
    const users = await ctx.db.query("users").collect()
    const newsletters = await ctx.db.query("newsletterContent").collect()
    const senders = await ctx.db.query("senders").collect()
    const userNewsletters = await ctx.db.query("userNewsletters").collect()

    // Insert snapshot
    await ctx.db.insert("systemMetricsHistory", {
      date: today,
      totalUsers: users.length,
      totalNewsletters: newsletters.length,
      totalSenders: senders.length,
      totalUserNewsletters: userNewsletters.length,
      storageUsedBytes: 0, // Would need R2 API call
      recordedAt: Date.now(),
    })

    return { recorded: true, date: today }
  },
})

/**
 * Check if the current user is an admin
 * Story 7.1 Task 1.4 - For conditional UI rendering
 *
 * Returns { isAdmin: boolean } without throwing for non-admins.
 * This is useful for UI conditional rendering (e.g., showing admin nav link).
 */
export const checkIsAdmin = query({
  args: {},
  handler: async (ctx) => {
    // Try to get auth user - return false if unauthenticated
    let authUser
    try {
      authUser = await authComponent.getAuthUser(ctx)
    } catch {
      return { isAdmin: false }
    }

    if (!authUser) {
      return { isAdmin: false }
    }

    // Find the app user record
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
      .first()

    return { isAdmin: user?.isAdmin ?? false }
  },
})

// ============================================================
// Story 7.2: Email Delivery Monitoring
// ============================================================

/** Delivery status type for reuse */
type DeliveryStatus = "received" | "processing" | "stored" | "failed"

/**
 * Get delivery statistics for a time period
 * Story 7.2 Task 3.1
 *
 * Returns counts by status and success rate for the specified time window.
 */
export const getDeliveryStats = query({
  args: {
    hoursAgo: v.optional(v.number()), // defaults to 24
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const hoursAgo = args.hoursAgo ?? 24
    const cutoff = Date.now() - hoursAgo * 60 * 60 * 1000

    const logs = await ctx.db
      .query("emailDeliveryLogs")
      .withIndex("by_receivedAt", (q) => q.gte("receivedAt", cutoff))
      .collect()

    // Count by status
    const stats: Record<DeliveryStatus, number> = {
      received: 0,
      processing: 0,
      stored: 0,
      failed: 0,
    }

    for (const log of logs) {
      // Status is guaranteed to be a valid DeliveryStatus by the schema
      stats[log.status]++
    }

    const total = logs.length
    const successRate = total > 0 ? Math.round((stats.stored / total) * 100) : 100

    return {
      ...stats,
      total,
      successRate,
      periodHours: hoursAgo,
    }
  },
})

/**
 * List delivery logs with pagination and filtering
 * Story 7.2 Task 3.2
 *
 * Returns paginated delivery logs, optionally filtered by status.
 */
export const listDeliveryLogs = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("received"),
        v.literal("processing"),
        v.literal("stored"),
        v.literal("failed")
      )
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const limit = Math.min(args.limit ?? 50, 100) // Cap at 100

    let logs

    if (args.status) {
      const statusFilter = args.status // Assign to const for TypeScript narrowing
      logs = await ctx.db
        .query("emailDeliveryLogs")
        .withIndex("by_status_receivedAt", (q) => q.eq("status", statusFilter))
        .order("desc")
        .take(limit + 1) // +1 to detect if more pages exist
    } else {
      logs = await ctx.db
        .query("emailDeliveryLogs")
        .withIndex("by_receivedAt")
        .order("desc")
        .take(limit + 1)
    }

    const hasMore = logs.length > limit
    const items = hasMore ? logs.slice(0, limit) : logs

    return {
      items,
      hasMore,
      nextCursor: hasMore && items.length > 0 ? items[items.length - 1]._id : null,
    }
  },
})

/**
 * Get failed deliveries that need attention
 * Story 7.2 Task 3.3
 *
 * Returns failed delivery logs, optionally including acknowledged ones.
 */
export const getFailedDeliveries = query({
  args: {
    includeAcknowledged: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const failed = await ctx.db
      .query("emailDeliveryLogs")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .collect()

    // Filter acknowledged if needed
    const filtered = args.includeAcknowledged
      ? failed
      : failed.filter((log) => !log.isAcknowledged)

    // Sort by receivedAt desc (most recent first)
    filtered.sort((a, b) => b.receivedAt - a.receivedAt)

    return filtered
  },
})

/**
 * Get delivery rate statistics over multiple time periods
 * Story 7.2 Task 3.4
 *
 * Returns success rates for 1h, 24h, and 7d periods.
 */
export const getDeliveryRateStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)

    const now = Date.now()
    const periods = [
      { label: "1h", cutoff: now - 1 * 60 * 60 * 1000 },
      { label: "24h", cutoff: now - 24 * 60 * 60 * 1000 },
      { label: "7d", cutoff: now - 7 * 24 * 60 * 60 * 1000 },
    ]

    const results = []

    for (const period of periods) {
      const logs = await ctx.db
        .query("emailDeliveryLogs")
        .withIndex("by_receivedAt", (q) => q.gte("receivedAt", period.cutoff))
        .collect()

      const total = logs.length
      const stored = logs.filter((l) => l.status === "stored").length
      const failed = logs.filter((l) => l.status === "failed").length

      results.push({
        period: period.label,
        total,
        stored,
        failed,
        successRate: total > 0 ? Math.round((stored / total) * 100) : 100,
      })
    }

    return results
  },
})

/** Anomaly type definition for type safety */
interface DeliveryAnomaly {
  type: "high_failure_rate" | "no_deliveries" | "volume_spike"
  severity: "warning" | "critical"
  message: string
  details: Record<string, unknown>
}

/**
 * Detect delivery anomalies
 * Story 7.2 Task 6.1
 *
 * Detects anomalies like high failure rate, no deliveries, or volume spikes.
 */
export const getDeliveryAnomalies = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)

    const anomalies: DeliveryAnomaly[] = []

    const now = Date.now()
    const last24h = now - 24 * 60 * 60 * 1000
    const last1h = now - 1 * 60 * 60 * 1000

    // Get last 24h logs
    const logs24h = await ctx.db
      .query("emailDeliveryLogs")
      .withIndex("by_receivedAt", (q) => q.gte("receivedAt", last24h))
      .collect()

    // Check for high failure rate (>5%)
    const failed = logs24h.filter((l) => l.status === "failed").length
    const total = logs24h.length
    const failureRate = total > 0 ? failed / total : 0

    if (total > 10 && failureRate > 0.05) {
      anomalies.push({
        type: "high_failure_rate",
        severity: failureRate > 0.2 ? "critical" : "warning",
        message: `High failure rate: ${Math.round(failureRate * 100)}% of emails failed in last 24h`,
        details: { failed, total, rate: failureRate },
      })
    }

    // Check for no deliveries in 24h (if system should be receiving)
    // Only flag if there's historical data (not a new system)
    const allLogs = await ctx.db.query("emailDeliveryLogs").take(1)
    if (allLogs.length > 0 && logs24h.length === 0) {
      anomalies.push({
        type: "no_deliveries",
        severity: "warning",
        message: "No email deliveries in the last 24 hours",
        details: {},
      })
    }

    // Check for volume spike (>3x average)
    // Compare last 1h to average hourly rate over 24h
    const logs1h = logs24h.filter((l) => l.receivedAt >= last1h)
    const avgHourlyRate = total / 24

    if (avgHourlyRate > 5 && logs1h.length > avgHourlyRate * 3) {
      anomalies.push({
        type: "volume_spike",
        severity: "warning",
        message: `Unusual volume spike: ${logs1h.length} emails in last hour (avg: ${Math.round(avgHourlyRate)}/hour)`,
        details: { lastHour: logs1h.length, avgHourly: avgHourlyRate },
      })
    }

    return anomalies
  },
})

// ============================================================
// Story 7.2: Internal Mutations for Email Worker
// ============================================================

/**
 * Log initial email delivery receipt
 * Called by emailIngestion HTTP action at email receipt
 * Story 7.2 Task 2.5
 *
 * This is idempotent - returns existing logId if messageId already exists.
 */
export const logEmailDelivery = internalMutation({
  args: {
    recipientEmail: v.string(),
    senderEmail: v.string(),
    senderName: v.optional(v.string()),
    subject: v.string(),
    messageId: v.string(),
  },
  handler: async (ctx, args) => {
    // Check for duplicate messageId (idempotency)
    const existing = await ctx.db
      .query("emailDeliveryLogs")
      .withIndex("by_messageId", (q) => q.eq("messageId", args.messageId))
      .first()

    if (existing) {
      return existing._id // Return existing log ID
    }

    // Create delivery log
    const logId = await ctx.db.insert("emailDeliveryLogs", {
      recipientEmail: args.recipientEmail,
      senderEmail: args.senderEmail,
      senderName: args.senderName,
      subject: args.subject,
      messageId: args.messageId,
      status: "received",
      receivedAt: Date.now(),
      retryCount: 0,
      isAcknowledged: false,
    })

    return logId
  },
})

/**
 * Update delivery status
 * Called by emailIngestion HTTP action during processing
 * Story 7.2 Task 2.6
 */
export const updateDeliveryStatus = internalMutation({
  args: {
    logId: v.id("emailDeliveryLogs"),
    status: v.union(v.literal("processing"), v.literal("stored"), v.literal("failed")),
    userId: v.optional(v.id("users")),
    errorMessage: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    contentSizeBytes: v.optional(v.number()),
    hasHtmlContent: v.optional(v.boolean()),
    hasPlainTextContent: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const update: Record<string, unknown> = {
      status: args.status,
    }

    if (args.status === "processing") {
      update.processingStartedAt = Date.now()
      if (args.userId) update.userId = args.userId
    }

    if (args.status === "stored" || args.status === "failed") {
      update.completedAt = Date.now()
    }

    if (args.status === "failed") {
      update.errorMessage = args.errorMessage
      update.errorCode = args.errorCode
    }

    if (args.contentSizeBytes !== undefined) {
      update.contentSizeBytes = args.contentSizeBytes
    }
    if (args.hasHtmlContent !== undefined) {
      update.hasHtmlContent = args.hasHtmlContent
    }
    if (args.hasPlainTextContent !== undefined) {
      update.hasPlainTextContent = args.hasPlainTextContent
    }

    await ctx.db.patch(args.logId, update)
  },
})

// ============================================================
// Story 7.2: Admin Mutations
// ============================================================

/**
 * Acknowledge a failed delivery (admin action)
 * Story 7.2 Task 5.6
 *
 * Marks a failed delivery as acknowledged so it no longer appears
 * in the unacknowledged failures list.
 */
export const acknowledgeFailedDelivery = mutation({
  args: {
    logId: v.id("emailDeliveryLogs"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    await ctx.db.patch(args.logId, {
      isAcknowledged: true,
    })
  },
})
