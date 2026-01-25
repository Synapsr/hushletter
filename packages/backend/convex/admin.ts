import { query, internalMutation } from "./_generated/server"
import { v } from "convex/values"
import { requireAdmin } from "./_internal/auth"
import { authComponent } from "./auth"

/**
 * Admin queries and mutations for system health dashboard.
 * Story 7.1: Admin Dashboard & System Health
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
