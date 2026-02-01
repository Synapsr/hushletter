import { query, mutation, internalMutation, internalQuery, action } from "./_generated/server"
import { internal } from "./_generated/api"
import type { Id, Doc } from "./_generated/dataModel"
import { v, ConvexError } from "convex/values"
import { requireAdmin } from "./_internal/auth"
import { authComponent } from "./auth"
import { r2 } from "./r2"
import {
  normalizeForHash,
  computeContentHash,
} from "./_internal/contentNormalization"
import { detectPotentialPII } from "./_internal/piiDetection"

/** Type alias for sender documents */
type SenderDoc = Doc<"senders">

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

// ============================================================
// Story 7.4: Community Content Management
// ============================================================

/** Moderation status type for content */
type ModerationStatus = "active" | "hidden" | "blocked_sender"

/**
 * List community content for moderation
 * Story 7.4 Task 2.1-2.5
 *
 * Returns paginated community content with filters for admin moderation.
 * Includes moderation status (active, hidden, blocked_sender).
 */
export const listCommunityContent = query({
  args: {
    senderEmail: v.optional(v.string()),
    domain: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("active"), v.literal("hidden"), v.literal("blocked_sender"))
    ),
    sortBy: v.optional(
      v.union(
        v.literal("readerCount"),
        v.literal("firstReceivedAt"),
        v.literal("senderEmail")
      )
    ),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const limit = Math.min(args.limit ?? 50, 100)

    // Get all content
    let content = await ctx.db.query("newsletterContent").collect()

    // Apply sender email filter (partial match)
    if (args.senderEmail) {
      const searchEmail = args.senderEmail.toLowerCase()
      content = content.filter((c) =>
        c.senderEmail.toLowerCase().includes(searchEmail)
      )
    }

    // Apply domain filter
    if (args.domain) {
      const searchDomain = args.domain.toLowerCase()
      content = content.filter((c) => {
        const domain = c.senderEmail.split("@")[1]
        return domain?.toLowerCase().includes(searchDomain)
      })
    }

    // Add moderation status to each item
    const contentWithStatus = content.map((c) => {
      const isHidden = c.isHiddenFromCommunity === true
      // Note: blocked_sender status would require senderId on content table
      // For now, we only track hidden vs active
      const moderationStatus: ModerationStatus = isHidden ? "hidden" : "active"

      return {
        ...c,
        moderationStatus,
        domain: c.senderEmail.split("@")[1] || "unknown",
      }
    })

    // Filter by status if specified
    let filtered = contentWithStatus
    if (args.status) {
      filtered = contentWithStatus.filter((c) => c.moderationStatus === args.status)
    }

    // Sort
    const sortBy = args.sortBy ?? "firstReceivedAt"
    const sortOrder = args.sortOrder ?? "desc"
    filtered.sort((a, b) => {
      let comparison = 0
      if (sortBy === "readerCount") {
        comparison = a.readerCount - b.readerCount
      } else if (sortBy === "firstReceivedAt") {
        comparison = a.firstReceivedAt - b.firstReceivedAt
      } else if (sortBy === "senderEmail") {
        comparison = a.senderEmail.localeCompare(b.senderEmail)
      }
      return sortOrder === "desc" ? -comparison : comparison
    })

    // Paginate
    const results = filtered.slice(0, limit)
    const hasMore = filtered.length > limit

    // Get sender IDs for all unique sender emails
    const uniqueSenderEmails = [...new Set(results.map((c) => c.senderEmail))]
    const sendersByEmail = new Map<string, Id<"senders">>()
    for (const email of uniqueSenderEmails) {
      const sender = await ctx.db
        .query("senders")
        .withIndex("by_email", (q) => q.eq("email", email))
        .first()
      if (sender) {
        sendersByEmail.set(email, sender._id)
      }
    }

    return {
      items: results.map((c) => ({
        id: c._id,
        senderId: sendersByEmail.get(c.senderEmail),
        subject: c.subject,
        senderEmail: c.senderEmail,
        senderName: c.senderName,
        domain: c.domain,
        readerCount: c.readerCount,
        firstReceivedAt: c.firstReceivedAt,
        moderationStatus: c.moderationStatus,
        isHiddenFromCommunity: c.isHiddenFromCommunity ?? false,
        hiddenAt: c.hiddenAt,
      })),
      hasMore,
      totalCount: filtered.length,
    }
  },
})

/**
 * Get community content summary for admin dashboard
 * Story 7.4 Task 11.3
 *
 * Returns summary statistics for the community content section.
 */
export const getCommunityContentSummary = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)

    const allContent = await ctx.db.query("newsletterContent").collect()
    const hiddenContent = allContent.filter((c) => c.isHiddenFromCommunity === true)
    const blockedSenders = await ctx.db.query("blockedSenders").collect()
    const pendingReports = await ctx.db
      .query("contentReports")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect()

    return {
      totalContent: allContent.length,
      hiddenContent: hiddenContent.length,
      activeContent: allContent.length - hiddenContent.length,
      blockedSenders: blockedSenders.length,
      pendingReports: pendingReports.length,
    }
  },
})

// ============================================================
// Story 7.4 Task 3: Content Removal Mutations
// ============================================================

/**
 * Hide content from community
 * Story 7.4 Task 3.1
 *
 * Sets isHiddenFromCommunity flag - does NOT delete content.
 * User's personal copies (userNewsletters) remain unaffected.
 */
export const hideContentFromCommunity = mutation({
  args: {
    contentId: v.id("newsletterContent"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)

    const content = await ctx.db.get(args.contentId)
    if (!content) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Content not found" })
    }

    // Update content - soft delete for community
    await ctx.db.patch(args.contentId, {
      isHiddenFromCommunity: true,
      hiddenAt: Date.now(),
      hiddenBy: admin._id,
    })

    // Log moderation action
    await ctx.db.insert("moderationLog", {
      adminId: admin._id,
      actionType: "hide_content",
      targetType: "content",
      targetId: args.contentId,
      reason: args.reason,
      createdAt: Date.now(),
    })

    return { success: true }
  },
})

/**
 * Restore content to community
 * Story 7.4 Task 3.2
 *
 * Reverses hide operation - content becomes visible in community again.
 */
export const restoreContentToCommunity = mutation({
  args: {
    contentId: v.id("newsletterContent"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)

    const content = await ctx.db.get(args.contentId)
    if (!content) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Content not found" })
    }

    // Update content - restore visibility
    await ctx.db.patch(args.contentId, {
      isHiddenFromCommunity: false,
      hiddenAt: undefined,
      hiddenBy: undefined,
    })

    // Log moderation action
    await ctx.db.insert("moderationLog", {
      adminId: admin._id,
      actionType: "restore_content",
      targetType: "content",
      targetId: args.contentId,
      reason: args.reason ?? "Restored to community",
      createdAt: Date.now(),
    })

    return { success: true }
  },
})

// ============================================================
// Story 7.4 Task 4: Sender Blocking Mutations
// ============================================================

/**
 * Block sender from community
 * Story 7.4 Task 4.1
 *
 * Adds sender to blockedSenders table and hides ALL their content.
 * User's personal copies remain unaffected.
 */
export const blockSenderFromCommunity = mutation({
  args: {
    senderId: v.id("senders"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)

    const sender = await ctx.db.get(args.senderId)
    if (!sender) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Sender not found" })
    }

    // Check if already blocked
    const existing = await ctx.db
      .query("blockedSenders")
      .withIndex("by_senderId", (q) => q.eq("senderId", args.senderId))
      .first()

    if (existing) {
      throw new ConvexError({
        code: "ALREADY_EXISTS",
        message: "Sender is already blocked",
      })
    }

    // Add to blocked senders
    await ctx.db.insert("blockedSenders", {
      senderId: args.senderId,
      blockedBy: admin._id,
      reason: args.reason,
      blockedAt: Date.now(),
    })

    // Hide all content from this sender
    const senderContent = await ctx.db
      .query("newsletterContent")
      .withIndex("by_senderEmail", (q) => q.eq("senderEmail", sender.email))
      .collect()

    for (const content of senderContent) {
      await ctx.db.patch(content._id, {
        isHiddenFromCommunity: true,
        hiddenAt: Date.now(),
        hiddenBy: admin._id,
      })
    }

    // Log moderation action
    await ctx.db.insert("moderationLog", {
      adminId: admin._id,
      actionType: "block_sender",
      targetType: "sender",
      targetId: args.senderId,
      reason: args.reason,
      details: JSON.stringify({
        senderEmail: sender.email,
        contentHidden: senderContent.length,
      }),
      createdAt: Date.now(),
    })

    return { success: true, contentHidden: senderContent.length }
  },
})

/**
 * Unblock sender
 * Story 7.4 Task 4.2
 *
 * Removes sender from blockedSenders and optionally restores their content.
 */
export const unblockSender = mutation({
  args: {
    senderId: v.id("senders"),
    reason: v.optional(v.string()),
    restoreContent: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)

    const sender = await ctx.db.get(args.senderId)
    if (!sender) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Sender not found" })
    }

    // Find and remove block
    const block = await ctx.db
      .query("blockedSenders")
      .withIndex("by_senderId", (q) => q.eq("senderId", args.senderId))
      .first()

    if (!block) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Sender is not blocked" })
    }

    await ctx.db.delete(block._id)

    // Optionally restore content
    let contentRestored = 0
    if (args.restoreContent) {
      const senderContent = await ctx.db
        .query("newsletterContent")
        .withIndex("by_senderEmail", (q) => q.eq("senderEmail", sender.email))
        .collect()

      for (const content of senderContent) {
        if (content.isHiddenFromCommunity) {
          await ctx.db.patch(content._id, {
            isHiddenFromCommunity: false,
            hiddenAt: undefined,
            hiddenBy: undefined,
          })
          contentRestored++
        }
      }
    }

    // Log moderation action
    await ctx.db.insert("moderationLog", {
      adminId: admin._id,
      actionType: "unblock_sender",
      targetType: "sender",
      targetId: args.senderId,
      reason: args.reason ?? "Unblocked sender",
      details: JSON.stringify({
        senderEmail: sender.email,
        contentRestored,
      }),
      createdAt: Date.now(),
    })

    return { success: true, contentRestored }
  },
})

/**
 * List blocked senders
 * Story 7.4 Task 8.1
 *
 * Returns blocked senders with their details and content counts.
 */
export const listBlockedSenders = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const limit = Math.min(args.limit ?? 50, 100)

    const blocked = await ctx.db
      .query("blockedSenders")
      .withIndex("by_blockedAt")
      .order("desc")
      .take(limit)

    // Get sender details and content counts
    const results = await Promise.all(
      blocked.map(async (block) => {
        const sender = await ctx.db.get(block.senderId)
        const admin = await ctx.db.get(block.blockedBy)

        // Count affected content
        const contentCount = sender
          ? (
              await ctx.db
                .query("newsletterContent")
                .withIndex("by_senderEmail", (q) => q.eq("senderEmail", sender.email))
                .collect()
            ).length
          : 0

        return {
          id: block._id,
          senderId: block.senderId,
          senderEmail: sender?.email ?? "Unknown",
          senderName: sender?.name,
          domain: sender?.email.split("@")[1] ?? "unknown",
          reason: block.reason,
          blockedAt: block.blockedAt,
          blockedByEmail: admin?.email ?? "Unknown admin",
          contentCount,
        }
      })
    )

    return results
  },
})

// ============================================================
// Story 7.4 Task 5: Content Reports System
// ============================================================

/**
 * Report content (USER-facing, not admin-only)
 * Story 7.4 Task 5.1
 *
 * Allows authenticated users to report community content.
 */
export const reportContent = mutation({
  args: {
    contentId: v.id("newsletterContent"),
    reason: v.union(
      v.literal("spam"),
      v.literal("inappropriate"),
      v.literal("copyright"),
      v.literal("misleading"),
      v.literal("other")
    ),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Must be logged in to report content",
      })
    }

    // Get user
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", identity.email ?? ""))
      .first()

    if (!user) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" })
    }

    const content = await ctx.db.get(args.contentId)
    if (!content) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Content not found" })
    }

    // Check for existing pending report from this user
    const existingReport = await ctx.db
      .query("contentReports")
      .withIndex("by_contentId", (q) => q.eq("contentId", args.contentId))
      .filter((q) =>
        q.and(
          q.eq(q.field("reporterId"), user._id),
          q.eq(q.field("status"), "pending")
        )
      )
      .first()

    if (existingReport) {
      throw new ConvexError({
        code: "ALREADY_EXISTS",
        message: "You have already reported this content",
      })
    }

    // Create report
    await ctx.db.insert("contentReports", {
      contentId: args.contentId,
      reporterId: user._id,
      reason: args.reason,
      description: args.description,
      status: "pending",
      createdAt: Date.now(),
    })

    return { success: true }
  },
})

/**
 * List content reports
 * Story 7.4 Task 5.2
 *
 * Returns reports queue filtered by status.
 */
export const listContentReports = query({
  args: {
    status: v.optional(
      v.union(v.literal("pending"), v.literal("resolved"), v.literal("dismissed"))
    ),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const limit = Math.min(args.limit ?? 50, 100)
    const status = args.status ?? "pending"

    const reports = await ctx.db
      .query("contentReports")
      .withIndex("by_status", (q) => q.eq("status", status))
      .order("desc")
      .take(limit)

    // Get content and reporter details
    const results = await Promise.all(
      reports.map(async (report) => {
        const content = await ctx.db.get(report.contentId)
        const reporter = await ctx.db.get(report.reporterId)

        return {
          id: report._id,
          contentId: report.contentId,
          subject: content?.subject ?? "Unknown",
          senderEmail: content?.senderEmail ?? "Unknown",
          reason: report.reason,
          description: report.description,
          status: report.status,
          reporterEmail: reporter?.email ?? "Unknown",
          createdAt: report.createdAt,
          resolvedAt: report.resolvedAt,
        }
      })
    )

    return results
  },
})

/**
 * Resolve content report
 * Story 7.4 Task 5.3
 *
 * Marks report as resolved or dismissed. Optionally hides the content.
 */
export const resolveReport = mutation({
  args: {
    reportId: v.id("contentReports"),
    resolution: v.union(v.literal("resolved"), v.literal("dismissed")),
    note: v.optional(v.string()),
    hideContent: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)

    const report = await ctx.db.get(args.reportId)
    if (!report) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Report not found" })
    }

    // Update report
    await ctx.db.patch(args.reportId, {
      status: args.resolution,
      resolvedBy: admin._id,
      resolvedAt: Date.now(),
      resolutionNote: args.note,
    })

    // Optionally hide the content
    if (args.hideContent && args.resolution === "resolved") {
      await ctx.db.patch(report.contentId, {
        isHiddenFromCommunity: true,
        hiddenAt: Date.now(),
        hiddenBy: admin._id,
      })
    }

    // Log moderation action
    await ctx.db.insert("moderationLog", {
      adminId: admin._id,
      actionType: args.resolution === "resolved" ? "resolve_report" : "dismiss_report",
      targetType: "report",
      targetId: args.reportId,
      reason: args.note ?? `Report ${args.resolution}`,
      details: JSON.stringify({
        contentId: report.contentId,
        hideContent: args.hideContent,
      }),
      createdAt: Date.now(),
    })

    return { success: true }
  },
})

/**
 * Bulk resolve reports
 * Story 7.4 Task 5.6
 *
 * Resolves multiple reports at once.
 */
export const bulkResolveReports = mutation({
  args: {
    reportIds: v.array(v.id("contentReports")),
    resolution: v.union(v.literal("resolved"), v.literal("dismissed")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)

    let resolved = 0
    for (const reportId of args.reportIds) {
      const report = await ctx.db.get(reportId)
      if (report && report.status === "pending") {
        await ctx.db.patch(reportId, {
          status: args.resolution,
          resolvedBy: admin._id,
          resolvedAt: Date.now(),
          resolutionNote: args.note,
        })

        await ctx.db.insert("moderationLog", {
          adminId: admin._id,
          actionType:
            args.resolution === "resolved" ? "resolve_report" : "dismiss_report",
          targetType: "report",
          targetId: reportId,
          reason: args.note ?? "Bulk resolution",
          createdAt: Date.now(),
        })

        resolved++
      }
    }

    return { success: true, resolved }
  },
})

/**
 * Get pending reports count (for nav badge)
 * Story 7.4 Task 11.2
 */
export const getPendingReportsCount = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)

    const pending = await ctx.db
      .query("contentReports")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect()

    return pending.length
  },
})

// ============================================================
// Story 7.4 Task 6: Moderation Audit Log
// ============================================================

/**
 * List moderation log
 * Story 7.4 Task 6.1-6.4
 *
 * Returns paginated audit trail of moderation actions with filters.
 */
export const listModerationLog = query({
  args: {
    actionType: v.optional(
      v.union(
        v.literal("hide_content"),
        v.literal("restore_content"),
        v.literal("block_sender"),
        v.literal("unblock_sender"),
        v.literal("resolve_report"),
        v.literal("dismiss_report")
      )
    ),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const limit = Math.min(args.limit ?? 50, 100)

    let logs = await ctx.db
      .query("moderationLog")
      .withIndex("by_createdAt")
      .order("desc")
      .collect()

    // Apply filters
    if (args.actionType) {
      logs = logs.filter((l) => l.actionType === args.actionType)
    }

    if (args.startDate) {
      logs = logs.filter((l) => l.createdAt >= args.startDate!)
    }

    if (args.endDate) {
      logs = logs.filter((l) => l.createdAt <= args.endDate!)
    }

    // Get admin details
    const results = await Promise.all(
      logs.slice(0, limit).map(async (log) => {
        const admin = await ctx.db.get(log.adminId)

        return {
          id: log._id,
          actionType: log.actionType,
          targetType: log.targetType,
          targetId: log.targetId,
          reason: log.reason,
          details: log.details ? JSON.parse(log.details) : null,
          adminEmail: admin?.email ?? "Unknown",
          createdAt: log.createdAt,
        }
      })
    )

    return results
  },
})

// ============================================================
// Story 9.6: Admin Moderation Queue
// ============================================================

/**
 * List moderation queue - groups user newsletters by sender for admin review
 * Story 9.6 Task 1.1-1.4
 *
 * Returns user newsletters grouped by sender, for admin moderation.
 * Only shows newsletters with privateR2Key (user-owned content not yet published).
 * Excludes newsletters with contentId (already imported from community).
 *
 * CRITICAL: This shows PRIVATE user content to admin for curation.
 * Admin can preview content and decide whether to publish to community (Story 9.7).
 */
export const listModerationQueue = query({
  args: {
    senderEmail: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    sortBy: v.optional(
      v.union(
        v.literal("newsletterCount"),
        v.literal("senderName"),
        v.literal("latestReceived")
      )
    ),
    limit: v.optional(v.number()),
    includeReviewed: v.optional(v.boolean()), // Story 9.7: Show reviewed items if needed
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    // Get all user newsletters with privateR2Key (user-owned content)
    // Exclude newsletters that have contentId (community imports)
    const allNewsletters = await ctx.db.query("userNewsletters").collect()

    // Filter to only private user-owned content
    // Story 9.7: Exclude already-reviewed newsletters unless includeReviewed=true
    let newsletters = allNewsletters.filter(
      (n) =>
        n.privateR2Key !== undefined &&
        n.contentId === undefined &&
        (args.includeReviewed || n.reviewStatus === undefined)
    )

    // Apply date filters
    if (args.startDate) {
      newsletters = newsletters.filter((n) => n.receivedAt >= args.startDate!)
    }
    if (args.endDate) {
      newsletters = newsletters.filter((n) => n.receivedAt <= args.endDate!)
    }

    // Group by senderId
    const senderGroups = new Map<
      string,
      {
        senderId: string
        newsletters: typeof newsletters
        latestReceived: number
      }
    >()

    for (const n of newsletters) {
      const key = n.senderId
      const existing = senderGroups.get(key)
      if (existing) {
        existing.newsletters.push(n)
        existing.latestReceived = Math.max(existing.latestReceived, n.receivedAt)
      } else {
        senderGroups.set(key, {
          senderId: n.senderId,
          newsletters: [n],
          latestReceived: n.receivedAt,
        })
      }
    }

    // Get sender details and apply sender filter
    const results = []
    for (const [senderId, group] of senderGroups) {
      const sender = await ctx.db.get(senderId as Id<"senders">)
      if (!sender) continue

      // Apply sender email filter (partial match)
      if (
        args.senderEmail &&
        !sender.email.toLowerCase().includes(args.senderEmail.toLowerCase())
      ) {
        continue
      }

      results.push({
        senderId: sender._id,
        senderEmail: sender.email,
        senderName: sender.name,
        senderDomain: sender.domain,
        newsletterCount: group.newsletters.length,
        latestReceived: group.latestReceived,
        sampleSubjects: group.newsletters
          .sort((a, b) => b.receivedAt - a.receivedAt)
          .slice(0, 3)
          .map((n) => n.subject),
      })
    }

    // Sort
    const sortBy = args.sortBy ?? "latestReceived"
    results.sort((a, b) => {
      if (sortBy === "newsletterCount") return b.newsletterCount - a.newsletterCount
      if (sortBy === "senderName")
        return (a.senderName ?? a.senderEmail).localeCompare(
          b.senderName ?? b.senderEmail
        )
      return b.latestReceived - a.latestReceived
    })

    // Paginate
    const limit = Math.min(args.limit ?? 50, 100)
    return {
      items: results.slice(0, limit),
      hasMore: results.length > limit,
      totalSenders: results.length,
    }
  },
})

/**
 * List newsletters for a specific sender in the moderation queue
 * Story 9.6 Task 1 (expanded view)
 *
 * Returns individual newsletters from a sender for admin review.
 * Includes user email for audit purposes.
 */
export const listModerationNewslettersForSender = query({
  args: {
    senderId: v.id("senders"),
    limit: v.optional(v.number()),
    includeReviewed: v.optional(v.boolean()), // Story 9.7: Show reviewed items if needed
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const newsletters = await ctx.db
      .query("userNewsletters")
      .withIndex("by_senderId", (q) => q.eq("senderId", args.senderId))
      .collect()

    // Filter to only private user-owned content
    // Story 9.7: Exclude already-reviewed newsletters unless includeReviewed=true
    const filteredNewsletters = newsletters.filter(
      (n) =>
        n.privateR2Key !== undefined &&
        n.contentId === undefined &&
        (args.includeReviewed || n.reviewStatus === undefined)
    )

    // Sort by receivedAt descending
    filteredNewsletters.sort((a, b) => b.receivedAt - a.receivedAt)

    // Apply limit
    const limit = args.limit ?? 50
    const limitedNewsletters = filteredNewsletters.slice(0, limit)

    // Get user emails for each newsletter (audit info)
    const results = await Promise.all(
      limitedNewsletters.map(async (n) => {
        const user = await ctx.db.get(n.userId)
        return {
          id: n._id,
          subject: n.subject,
          senderEmail: n.senderEmail,
          senderName: n.senderName,
          receivedAt: n.receivedAt,
          userId: n.userId,
          userEmail: user?.email ?? "Unknown", // Audit only
          source: n.source,
        }
      })
    )

    return results
  },
})

/**
 * Get detailed newsletter information for moderation
 * Story 9.6 Task 2.1
 *
 * Returns full newsletter metadata including user email for audit.
 * Also runs PII detection on content if available.
 */
export const getModerationNewsletterDetail = query({
  args: {
    userNewsletterId: v.id("userNewsletters"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const newsletter = await ctx.db.get(args.userNewsletterId)
    if (!newsletter) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Newsletter not found" })
    }

    // Get user for audit
    const user = await ctx.db.get(newsletter.userId)

    // Get sender
    const sender = await ctx.db.get(newsletter.senderId)

    // Note: PII detection runs on content in the action (getModerationNewsletterContent)
    // For this query, we just return metadata

    return {
      id: newsletter._id,
      subject: newsletter.subject,
      senderEmail: newsletter.senderEmail,
      senderName: newsletter.senderName,
      receivedAt: newsletter.receivedAt,
      source: newsletter.source,
      userEmail: user?.email ?? "Unknown",
      userId: newsletter.userId,
      senderId: newsletter.senderId,
      senderDomain: sender?.domain,
      privateR2Key: newsletter.privateR2Key, // Admin can see this
    }
  },
})

/**
 * Get moderation queue count for nav badge
 * Story 9.6 Task 5.2
 *
 * Returns count of newsletters pending moderation.
 */
export const getModerationQueueCount = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)

    // Count newsletters with privateR2Key and without contentId
    const allNewsletters = await ctx.db.query("userNewsletters").collect()

    const count = allNewsletters.filter(
      (n) => n.privateR2Key !== undefined && n.contentId === undefined
    ).length

    return { count }
  },
})

/**
 * Get moderation newsletter content with signed URL and PII detection
 * Story 9.6 Task 2.2, 2.3
 *
 * Fetches the actual HTML content from R2 using privateR2Key.
 * Returns a signed URL for the content (valid for 1 hour) and PII detection results.
 *
 * CRITICAL: Only admins can access this - never expose private content to other users.
 */
/** Return type for getModerationNewsletterContent */
interface ModerationContentResult {
  signedUrl: string
  subject: string
  senderEmail: string
  senderName?: string
  receivedAt: number
  piiDetection: {
    hasPotentialPII: boolean
    findings: Array<{ type: string; description: string; count: number; samples: string[] }>
    recommendation: string
  } | null
}

export const getModerationNewsletterContent = action({
  args: {
    userNewsletterId: v.id("userNewsletters"),
  },
  handler: async (ctx, args): Promise<ModerationContentResult> => {
    // H1 FIX: Verify admin access first
    const adminUser = await ctx.runQuery(internal.admin.getAdminUser, {})
    if (!adminUser) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Admin access required" })
    }

    // Get newsletter
    const newsletter = await ctx.runQuery(
      internal.admin.getModerationNewsletterInternal,
      { userNewsletterId: args.userNewsletterId }
    )

    if (!newsletter) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Newsletter not found" })
    }

    if (!newsletter.privateR2Key) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Newsletter content not found",
      })
    }

    // Get signed URL for content (valid for 1 hour)
    const signedUrl = await r2.getUrl(newsletter.privateR2Key, { expiresIn: 3600 })

    // H2 FIX: Fetch content and run PII detection
    let piiDetection = null
    try {
      // Fetch the HTML content from the signed URL
      const response = await fetch(signedUrl)
      if (response.ok) {
        const htmlContent = await response.text()
        piiDetection = detectPotentialPII(htmlContent)
      }
    } catch (error) {
      // PII detection is advisory - don't fail the request if it errors
      console.error("PII detection failed:", error)
      piiDetection = {
        hasPotentialPII: false,
        findings: [],
        recommendation: "Unable to analyze content for personalization.",
      }
    }

    return {
      signedUrl,
      subject: newsletter.subject,
      senderEmail: newsletter.senderEmail,
      senderName: newsletter.senderName,
      receivedAt: newsletter.receivedAt,
      piiDetection,
    }
  },
})

/**
 * Internal query to get newsletter for action (admin check happens in caller)
 * Story 9.6 Task 2.2
 */
export const getModerationNewsletterInternal = internalQuery({
  args: {
    userNewsletterId: v.id("userNewsletters"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userNewsletterId)
  },
})

// ============================================================
// Story 9.7: Admin Publish Flow
// ============================================================

/**
 * Get current admin user (for actions that can't use requireAdmin directly)
 * Story 9.7 Task 2.1
 *
 * Actions cannot use ctx.auth directly, so we use this internal query
 * to verify admin status and get the admin user.
 */
export const getAdminUser = internalQuery({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()

    if (!user || !user.isAdmin) return null
    return user
  },
})

/**
 * Publish a user's newsletter to the community database
 * Story 9.7 Task 2
 *
 * This is an ACTION (not mutation) because it:
 * 1. Fetches content from R2 (external call)
 * 2. Uploads content to new R2 key (external call)
 * 3. Then creates database records (mutations)
 *
 * Process:
 * 1. Fetch user's private content from R2
 * 2. Compute content hash for deduplication
 * 3. Check if content already exists in newsletterContent
 * 4. If exists: increment readerCount
 * 5. If not: upload to new R2 key, create newsletterContent
 * 6. Mark userNewsletter as reviewed
 * 7. Log moderation action
 */
export const publishToCommunity = action({
  args: {
    userNewsletterId: v.id("userNewsletters"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean
    contentId: Id<"newsletterContent">
    reusedExisting: boolean
  }> => {
    // 1. Require admin
    const adminUser = await ctx.runQuery(internal.admin.getAdminUser, {})
    if (!adminUser) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Admin access required" })
    }

    // 2. Get newsletter metadata
    const newsletter = await ctx.runQuery(internal.admin.getModerationNewsletterInternal, {
      userNewsletterId: args.userNewsletterId,
    })

    if (!newsletter) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Newsletter not found" })
    }

    if (!newsletter.privateR2Key) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Newsletter has no private content to publish",
      })
    }

    // Check if already reviewed
    if (newsletter.reviewStatus) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: `Newsletter already ${newsletter.reviewStatus}`,
      })
    }

    // 3. Fetch content from user's R2 key
    const signedUrl = await r2.getUrl(newsletter.privateR2Key, { expiresIn: 300 })
    const response = await fetch(signedUrl)
    if (!response.ok) {
      throw new ConvexError({
        code: "EXTERNAL_ERROR",
        message: "Failed to fetch newsletter content from storage",
      })
    }
    const content = await response.text()

    // 4. Compute content hash for deduplication
    const normalized = normalizeForHash(content)
    const contentHash = await computeContentHash(normalized)

    // 5. Check for existing community content with same hash
    const existingContent = await ctx.runQuery(internal.newsletters.findByContentHash, {
      contentHash,
    })

    let contentId: Id<"newsletterContent">

    if (existingContent) {
      // Content already exists - increment readerCount
      await ctx.runMutation(internal.newsletters.incrementReaderCount, {
        contentId: existingContent._id,
      })
      contentId = existingContent._id
      // Reusing existing community content - deduplication successful
    } else {
      // 6. Upload to new R2 key with community prefix
      const timestamp = Date.now()
      const randomId = crypto.randomUUID()
      const ext = newsletter.privateR2Key.endsWith(".txt") ? "txt" : "html"
      const communityR2Key = `community/${timestamp}-${randomId}.${ext}`

      const contentType = ext === "html" ? "text/html" : "text/plain"
      const blob = new Blob([content], { type: `${contentType}; charset=utf-8` })
      await r2.store(ctx, blob, { key: communityR2Key, type: contentType })

      // 7. Create newsletterContent record
      contentId = await ctx.runMutation(internal.admin.createCommunityContent, {
        contentHash,
        r2Key: communityR2Key,
        subject: newsletter.subject,
        senderEmail: newsletter.senderEmail,
        senderName: newsletter.senderName,
        receivedAt: newsletter.receivedAt,
        communityApprovedAt: Date.now(),
        communityApprovedBy: adminUser._id,
      })

      // Created new community content with r2Key
    }

    // 8. Mark user newsletter as reviewed
    await ctx.runMutation(internal.admin.markNewsletterReviewed, {
      userNewsletterId: args.userNewsletterId,
      reviewStatus: "published",
      reviewedBy: adminUser._id,
    })

    // 9. Log moderation action
    await ctx.runMutation(internal.admin.logModerationAction, {
      adminId: adminUser._id,
      actionType: "publish_to_community",
      targetType: "userNewsletter",
      targetId: args.userNewsletterId,
      reason: "Published to community database",
      details: JSON.stringify({
        contentId,
        senderEmail: newsletter.senderEmail,
        subject: newsletter.subject,
        reusedExisting: existingContent !== null,
      }),
    })

    return {
      success: true,
      contentId,
      reusedExisting: existingContent !== null,
    }
  },
})

/**
 * Create community content record
 * Story 9.7 Task 2.7 - Internal mutation called by publishToCommunity action
 *
 * Handles race conditions - if content with same hash was created
 * between our check and this mutation, we reuse the existing record.
 */
export const createCommunityContent = internalMutation({
  args: {
    contentHash: v.string(),
    r2Key: v.string(),
    subject: v.string(),
    senderEmail: v.string(),
    senderName: v.optional(v.string()),
    receivedAt: v.number(),
    communityApprovedAt: v.number(),
    communityApprovedBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Race condition check (same as createNewsletterContent in newsletters.ts)
    const existing = await ctx.db
      .query("newsletterContent")
      .withIndex("by_contentHash", (q) => q.eq("contentHash", args.contentHash))
      .first()

    if (existing) {
      await ctx.db.patch(existing._id, {
        readerCount: existing.readerCount + 1,
      })
      return existing._id
    }

    const contentId = await ctx.db.insert("newsletterContent", {
      contentHash: args.contentHash,
      r2Key: args.r2Key,
      subject: args.subject,
      senderEmail: args.senderEmail,
      senderName: args.senderName,
      firstReceivedAt: args.receivedAt,
      readerCount: 0, // No readers yet - importCount tracks community imports
      importCount: 0,
      communityApprovedAt: args.communityApprovedAt,
      communityApprovedBy: args.communityApprovedBy,
    })

    return contentId
  },
})

/**
 * Mark newsletter as reviewed
 * Story 9.7 Task 2.10 / Task 3.3
 */
export const markNewsletterReviewed = internalMutation({
  args: {
    userNewsletterId: v.id("userNewsletters"),
    reviewStatus: v.union(v.literal("published"), v.literal("rejected")),
    reviewedBy: v.id("users"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userNewsletterId, {
      reviewStatus: args.reviewStatus,
      reviewedAt: Date.now(),
      reviewedBy: args.reviewedBy,
    })
  },
})

/**
 * Log moderation action (internal mutation for actions)
 * Story 9.7 Task 2.11 / Task 3.5
 *
 * Extended to support new action types for publish flow.
 */
export const logModerationAction = internalMutation({
  args: {
    adminId: v.id("users"),
    actionType: v.union(
      v.literal("hide_content"),
      v.literal("restore_content"),
      v.literal("block_sender"),
      v.literal("unblock_sender"),
      v.literal("resolve_report"),
      v.literal("dismiss_report"),
      v.literal("publish_to_community"),
      v.literal("reject_from_community")
    ),
    targetType: v.union(
      v.literal("content"),
      v.literal("sender"),
      v.literal("report"),
      v.literal("userNewsletter")
    ),
    targetId: v.string(),
    reason: v.string(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("moderationLog", {
      actionType: args.actionType,
      targetType: args.targetType,
      targetId: args.targetId,
      adminId: args.adminId,
      reason: args.reason,
      details: args.details,
      createdAt: Date.now(),
    })
  },
})

/**
 * Reject a newsletter from community publication
 * Story 9.7 Task 3
 *
 * This is a MUTATION (not action) because it only modifies database records.
 * No R2 operations needed - we're just marking the newsletter as reviewed.
 * User's newsletter content is NOT modified (AC #8).
 */
export const rejectFromCommunity = mutation({
  args: {
    userNewsletterId: v.id("userNewsletters"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)

    const newsletter = await ctx.db.get(args.userNewsletterId)
    if (!newsletter) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Newsletter not found" })
    }

    if (!newsletter.privateR2Key) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Newsletter has no private content",
      })
    }

    // Check if already reviewed
    if (newsletter.reviewStatus) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: `Newsletter already ${newsletter.reviewStatus}`,
      })
    }

    // Mark as reviewed (rejected) - does NOT modify content (AC #8)
    await ctx.db.patch(args.userNewsletterId, {
      reviewStatus: "rejected",
      reviewedAt: Date.now(),
      reviewedBy: admin._id,
    })

    // Log moderation action
    await ctx.db.insert("moderationLog", {
      adminId: admin._id,
      actionType: "reject_from_community",
      targetType: "userNewsletter",
      targetId: args.userNewsletterId,
      reason: args.reason,
      details: JSON.stringify({
        senderEmail: newsletter.senderEmail,
        subject: newsletter.subject,
      }),
      createdAt: Date.now(),
    })

    return { success: true }
  },
})
