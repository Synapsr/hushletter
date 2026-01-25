import { query, mutation, internalMutation } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
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

// ============================================================
// Story 7.3: Privacy Content Review
// ============================================================

/**
 * Get privacy statistics
 * Story 7.3 Task 1.1
 *
 * Returns counts of public/private newsletters, users with private senders,
 * and shared content statistics.
 *
 * ⚠️ PERFORMANCE NOTE: Full table scans. At scale, consider caching.
 */
export const getPrivacyStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)

    // Count newsletters by privacy status
    const allUserNewsletters = await ctx.db.query("userNewsletters").collect()
    const publicNewsletters = allUserNewsletters.filter((n) => !n.isPrivate).length
    const privateNewsletters = allUserNewsletters.filter((n) => n.isPrivate).length

    // Count shared content entries
    const sharedContent = await ctx.db.query("newsletterContent").collect()

    // Count users with at least one private sender
    const allSenderSettings = await ctx.db.query("userSenderSettings").collect()
    const usersWithPrivateSenders = new Set(
      allSenderSettings.filter((s) => s.isPrivate).map((s) => s.userId)
    ).size

    // Count total users
    const totalUsers = (await ctx.db.query("users").collect()).length

    // Count unique senders marked private
    const privateSenderIds = new Set(
      allSenderSettings.filter((s) => s.isPrivate).map((s) => s.senderId)
    )

    const totalNewsletters = publicNewsletters + privateNewsletters

    return {
      publicNewsletters,
      privateNewsletters,
      totalNewsletters,
      privatePercentage: totalNewsletters > 0
        ? Math.round((privateNewsletters / totalNewsletters) * 100)
        : 0,
      sharedContentCount: sharedContent.length,
      usersWithPrivateSenders,
      totalUsers,
      uniquePrivateSenders: privateSenderIds.size,
    }
  },
})

/**
 * List senders that have been marked private by at least one user
 * Story 7.3 Task 1.2
 *
 * Returns senders with aggregate privacy counts (no individual user identities).
 */
export const listPrivateSenders = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const limit = Math.min(args.limit ?? 50, 100)

    // Get all sender settings where isPrivate is true
    const privateSenderSettings = await ctx.db
      .query("userSenderSettings")
      .filter((q) => q.eq(q.field("isPrivate"), true))
      .collect()

    // Aggregate by sender
    const senderCounts = new Map<string, number>()
    for (const setting of privateSenderSettings) {
      const current = senderCounts.get(setting.senderId) || 0
      senderCounts.set(setting.senderId, current + 1)
    }

    // Get sender details
    const senderIds = Array.from(senderCounts.keys())
    const senders = await Promise.all(
      senderIds.map((id) => ctx.db.get(id as Id<"senders">))
    )

    // Build result with user counts (no individual identities)
    const result = senders
      .filter((s): s is SenderDoc => s !== null)
      .map((sender) => ({
        senderId: sender._id,
        email: sender.email,
        name: sender.name,
        domain: sender.domain,
        usersMarkedPrivate: senderCounts.get(sender._id) || 0,
        totalSubscribers: sender.subscriberCount,
        privatePercentage:
          sender.subscriberCount > 0
            ? Math.round(
                ((senderCounts.get(sender._id) || 0) / sender.subscriberCount) * 100
              )
            : 0,
      }))
      .sort((a, b) => b.usersMarkedPrivate - a.usersMarkedPrivate)
      .slice(0, limit)

    return result
  },
})

/**
 * Get privacy trends over time
 * Story 7.3 Task 1.3
 *
 * Returns privacy adoption metrics for 7d and 30d periods.
 * Note: This is a simplified implementation using current data.
 * For true historical trends, would need a separate metrics table.
 */
export const getPrivacyTrends = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)

    const now = Date.now()
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000

    // Get newsletters by period
    const allNewsletters = await ctx.db
      .query("userNewsletters")
      .withIndex("by_receivedAt")
      .collect()

    const last7d = allNewsletters.filter((n) => n.receivedAt >= sevenDaysAgo)
    const last30d = allNewsletters.filter((n) => n.receivedAt >= thirtyDaysAgo)

    const calculateStats = (newsletters: typeof allNewsletters) => {
      const total = newsletters.length
      const privateCount = newsletters.filter((n) => n.isPrivate).length
      return {
        total,
        private: privateCount,
        public: total - privateCount,
        privatePercentage: total > 0 ? Math.round((privateCount / total) * 100) : 0,
      }
    }

    return {
      last7Days: calculateStats(last7d),
      last30Days: calculateStats(last30d),
      allTime: calculateStats(allNewsletters),
    }
  },
})

/** Violation type for privacy audit */
interface PrivacyViolation {
  type: "private_with_contentId" | "missing_privateR2Key" | "reader_count_mismatch"
  severity: "warning" | "critical"
  message: string
  details: Record<string, unknown>
}

/**
 * Run comprehensive privacy audit
 * Story 7.3 Task 2.1
 *
 * Checks for privacy boundary violations and returns compliance status.
 */
export const runPrivacyAudit = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)

    const violations: PrivacyViolation[] = []

    // Check 1: Private newsletters should NOT have contentId (they should use privateR2Key)
    const privateWithContentId = await ctx.db
      .query("userNewsletters")
      .filter((q) =>
        q.and(
          q.eq(q.field("isPrivate"), true),
          q.neq(q.field("contentId"), undefined)
        )
      )
      .collect()

    if (privateWithContentId.length > 0) {
      violations.push({
        type: "private_with_contentId",
        severity: "critical",
        message: `${privateWithContentId.length} private newsletter(s) incorrectly reference shared content`,
        details: {
          count: privateWithContentId.length,
          sampleIds: privateWithContentId.slice(0, 5).map((n) => n._id),
        },
      })
    }

    // Check 2: Private newsletters should have privateR2Key
    const privateMissingR2Key = await ctx.db
      .query("userNewsletters")
      .filter((q) =>
        q.and(
          q.eq(q.field("isPrivate"), true),
          q.eq(q.field("privateR2Key"), undefined)
        )
      )
      .collect()

    if (privateMissingR2Key.length > 0) {
      violations.push({
        type: "missing_privateR2Key",
        severity: "warning",
        message: `${privateMissingR2Key.length} private newsletter(s) missing privateR2Key`,
        details: {
          count: privateMissingR2Key.length,
          sampleIds: privateMissingR2Key.slice(0, 5).map((n) => n._id),
        },
      })
    }

    // Check 3: Verify newsletterContent table integrity
    // Compare readerCount with actual references
    const allContent = await ctx.db.query("newsletterContent").collect()
    const allPublicNewsletters = await ctx.db
      .query("userNewsletters")
      .filter((q) => q.eq(q.field("isPrivate"), false))
      .collect()

    // Build reference counts from userNewsletters
    const actualReaderCounts = new Map<string, number>()
    for (const newsletter of allPublicNewsletters) {
      if (newsletter.contentId) {
        const current = actualReaderCounts.get(newsletter.contentId) || 0
        actualReaderCounts.set(newsletter.contentId, current + 1)
      }
    }

    // Check for mismatched reader counts
    const mismatchedCounts = allContent.filter(
      (content) =>
        (actualReaderCounts.get(content._id) || 0) !== content.readerCount
    )

    if (mismatchedCounts.length > 0) {
      violations.push({
        type: "reader_count_mismatch",
        severity: "warning",
        message: `${mismatchedCounts.length} content entries have mismatched reader counts`,
        details: {
          count: mismatchedCounts.length,
          note: "May indicate data integrity issue, not necessarily privacy violation",
        },
      })
    }

    // Count totals
    const totalPrivate = await ctx.db
      .query("userNewsletters")
      .filter((q) => q.eq(q.field("isPrivate"), true))
      .collect()

    // Determine overall compliance status
    const hasCritical = violations.some((v) => v.severity === "critical")
    const hasWarning = violations.some((v) => v.severity === "warning")

    const status = hasCritical ? "FAIL" : hasWarning ? "WARNING" : "PASS"

    return {
      status,
      auditedAt: Date.now(),
      totalPrivateNewsletters: totalPrivate.length,
      totalPublicNewsletters: allPublicNewsletters.length,
      violations,
      checks: [
        {
          name: "Private newsletters use privateR2Key (not contentId)",
          passed: privateWithContentId.length === 0,
        },
        {
          name: "Private newsletters have privateR2Key",
          passed: privateMissingR2Key.length === 0,
        },
        {
          name: "Content table integrity (reader counts)",
          passed: mismatchedCounts.length === 0,
        },
      ],
    }
  },
})

/**
 * Search newsletters for admin investigation
 * Story 7.3 Task 3.1
 *
 * Allows searching by sender email, subject, and privacy status.
 */
export const searchNewsletters = query({
  args: {
    senderEmail: v.optional(v.string()),
    subjectContains: v.optional(v.string()),
    isPrivate: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const limit = Math.min(args.limit ?? 50, 100)

    // Start with base query
    let newsletters = await ctx.db
      .query("userNewsletters")
      .withIndex("by_receivedAt")
      .order("desc")
      .take(limit * 3) // Get more for client-side filtering

    // Apply filters
    if (args.isPrivate !== undefined) {
      newsletters = newsletters.filter((n) => n.isPrivate === args.isPrivate)
    }

    if (args.senderEmail) {
      const searchEmail = args.senderEmail.toLowerCase()
      newsletters = newsletters.filter((n) =>
        n.senderEmail.toLowerCase().includes(searchEmail)
      )
    }

    if (args.subjectContains) {
      const search = args.subjectContains.toLowerCase()
      newsletters = newsletters.filter((n) =>
        n.subject.toLowerCase().includes(search)
      )
    }

    // Return limited results with privacy-relevant fields
    return newsletters.slice(0, limit).map((n) => ({
      id: n._id,
      subject: n.subject,
      senderEmail: n.senderEmail,
      senderName: n.senderName,
      receivedAt: n.receivedAt,
      isPrivate: n.isPrivate,
      hasContentId: !!n.contentId,
      hasPrivateR2Key: !!n.privateR2Key,
      userId: n.userId, // Admin can see user ID for investigation
    }))
  },
})

/**
 * Get detailed privacy status for a specific newsletter
 * Story 7.3 Task 3.2
 *
 * Returns comprehensive privacy info for admin investigation.
 */
export const getNewsletterPrivacyStatus = query({
  args: {
    newsletterId: v.id("userNewsletters"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const newsletter = await ctx.db.get(args.newsletterId)
    if (!newsletter) {
      return null
    }

    // Get sender
    const sender = await ctx.db.get(newsletter.senderId)

    // Get user's sender settings
    const senderSettings = await ctx.db
      .query("userSenderSettings")
      .withIndex("by_userId_senderId", (q) =>
        q.eq("userId", newsletter.userId).eq("senderId", newsletter.senderId)
      )
      .first()

    // Get user (for investigation, not exposure)
    const user = await ctx.db.get(newsletter.userId)

    // If public, get content info
    let contentInfo = null
    if (newsletter.contentId) {
      const content = await ctx.db.get(newsletter.contentId)
      if (content) {
        contentInfo = {
          contentHash: content.contentHash,
          readerCount: content.readerCount,
          firstReceivedAt: content.firstReceivedAt,
        }
      }
    }

    return {
      newsletter: {
        id: newsletter._id,
        subject: newsletter.subject,
        receivedAt: newsletter.receivedAt,
        isPrivate: newsletter.isPrivate,
        storageType: newsletter.privateR2Key ? "private_r2" : "shared_content",
        hasContentId: !!newsletter.contentId,
        hasPrivateR2Key: !!newsletter.privateR2Key,
      },
      sender: sender
        ? {
            id: sender._id,
            email: sender.email,
            name: sender.name,
            totalSubscribers: sender.subscriberCount,
          }
        : null,
      userSenderSettings: senderSettings
        ? {
            isPrivate: senderSettings.isPrivate,
          }
        : null,
      user: user
        ? {
            id: user._id,
            email: user.email, // Admin needs this for support investigation
          }
        : null,
      sharedContent: contentInfo,
      privacyCompliance: {
        storageCorrect: newsletter.isPrivate
          ? !!newsletter.privateR2Key && !newsletter.contentId
          : !!newsletter.contentId || !!newsletter.privateR2Key, // Public can have either
        senderSettingsAligned: senderSettings
          ? senderSettings.isPrivate === newsletter.isPrivate
          : true, // No settings means default (public)
      },
    }
  },
})

/**
 * Get privacy details for a sender across all users
 * Story 7.3 Task 3.3
 *
 * Returns aggregate privacy statistics without individual user identities.
 */
export const getSenderPrivacyDetails = query({
  args: {
    senderId: v.id("senders"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const sender = await ctx.db.get(args.senderId)
    if (!sender) {
      return null
    }

    // Get all user settings for this sender
    const allSettings = await ctx.db
      .query("userSenderSettings")
      .withIndex("by_senderId", (q) => q.eq("senderId", args.senderId))
      .collect()

    const privateCount = allSettings.filter((s) => s.isPrivate).length
    const publicCount = allSettings.length - privateCount

    // Get newsletter counts
    const allNewsletters = await ctx.db
      .query("userNewsletters")
      .withIndex("by_senderId", (q) => q.eq("senderId", args.senderId))
      .collect()

    const privateNewsletters = allNewsletters.filter((n) => n.isPrivate).length
    const publicNewsletters = allNewsletters.length - privateNewsletters

    return {
      sender: {
        id: sender._id,
        email: sender.email,
        name: sender.name,
        domain: sender.domain,
        totalSubscribers: sender.subscriberCount,
        totalNewsletters: sender.newsletterCount,
      },
      privacyStats: {
        usersMarkedPrivate: privateCount,
        usersMarkedPublic: publicCount,
        usersWithNoSetting: sender.subscriberCount - allSettings.length,
        privatePercentage:
          privateCount + publicCount > 0
            ? Math.round((privateCount / (privateCount + publicCount)) * 100)
            : 0,
      },
      newsletterStats: {
        privateNewsletters,
        publicNewsletters,
        totalNewsletters: allNewsletters.length,
      },
    }
  },
})
