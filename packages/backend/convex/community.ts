/**
 * Community Newsletter Queries and Mutations
 * Story 6.1: Default Public Sharing - Community Browse & Discovery
 *
 * CRITICAL PRIVACY RULES:
 * - Community queries ONLY access newsletterContent (inherently public content)
 * - NEVER join to userNewsletters for community views (exposes user data)
 * - Only expose: subject, senderEmail, senderName, firstReceivedAt, readerCount, hasSummary
 * - NEVER expose userId or any user-specific data
 *
 * The newsletterContent table IS the community database - content that exists
 * here is inherently public (private newsletters bypass this table entirely).
 */

import { query, mutation, action, internalQuery } from "./_generated/server"
import { internal } from "./_generated/api"
import { v } from "convex/values"
import { ConvexError } from "convex/values"
import { r2 } from "./r2"

// ============================================================
// Story 6.3: Search Community Newsletters
// ============================================================

/**
 * Search community newsletters by subject and sender name
 * Story 6.3 Task 1.2
 *
 * Implements in-memory search on newsletterContent (Convex lacks full-text search).
 * For MVP, scanning 500 items is acceptable. Consider Algolia for scale.
 *
 * Returns ONLY public fields - NEVER exposes user data.
 *
 * PRIVACY: Queries newsletterContent directly which is inherently public.
 * Private newsletters never enter this table (Epic 2.5 design).
 */
export const searchCommunityNewsletters = query({
  args: {
    searchQuery: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Auth check - must be logged in to search community
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const searchQuery = args.searchQuery.trim()
    if (searchQuery.length === 0) return []

    const limit = Math.min(args.limit ?? 20, 100)
    const searchLower = searchQuery.toLowerCase()

    // Fetch and filter in-memory (Convex doesn't have full-text search)
    // For MVP this is acceptable; consider external search (Algolia) for scale
    const allContent = await ctx.db
      .query("newsletterContent")
      .withIndex("by_readerCount")
      .order("desc")
      .take(500) // Reasonable limit for in-memory search

    const matches = allContent
      .filter(
        (c) =>
          c.subject.toLowerCase().includes(searchLower) ||
          (c.senderName?.toLowerCase().includes(searchLower) ?? false) ||
          c.senderEmail.toLowerCase().includes(searchLower)
      )
      .slice(0, limit)

    // Return ONLY public fields - NEVER expose user data
    return matches.map((c) => ({
      _id: c._id,
      subject: c.subject,
      senderEmail: c.senderEmail,
      senderName: c.senderName,
      firstReceivedAt: c.firstReceivedAt,
      readerCount: c.readerCount,
      hasSummary: Boolean(c.summary),
    }))
  },
})

// ============================================================
// Story 6.3 Task 2.2: Top Community Senders
// ============================================================

/**
 * List top community senders by subscriber count
 * Story 6.3 Task 2.2
 *
 * Returns senders with highest subscriberCount for "Browse by Sender" section.
 * Uses the global senders table which has pre-computed subscriber counts.
 *
 * Returns ONLY public sender info - no user data.
 */
export const listTopCommunitySenders = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Auth check - must be logged in to browse community
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const limit = Math.min(args.limit ?? 20, 100)

    // Use the global senders table sorted by subscriberCount
    const senders = await ctx.db
      .query("senders")
      .withIndex("by_subscriberCount")
      .order("desc")
      .take(limit)

    // Return public sender info only
    return senders.map((sender) => ({
      email: sender.email,
      name: sender.name,
      displayName: sender.name || sender.email,
      domain: sender.domain,
      subscriberCount: sender.subscriberCount,
      newsletterCount: sender.newsletterCount,
    }))
  },
})

// ============================================================
// Task 1: Community Newsletter Queries
// ============================================================

/**
 * List community newsletters - paginated list from newsletterContent
 * Story 6.1 Task 1.2
 *
 * Query parameters:
 * - sortBy: "popular" (readerCount desc) or "recent" (firstReceivedAt desc)
 * - senderEmail: optional filter by sender
 * - cursorValue: pagination cursor (last item's sort value - readerCount or firstReceivedAt)
 * - cursorId: pagination cursor (last item's _id for tie-breaking)
 * - limit: max items to return (default 20, max 100)
 *
 * Returns ONLY public fields from newsletterContent - no user data
 */
export const listCommunityNewsletters = query({
  args: {
    sortBy: v.optional(v.union(v.literal("popular"), v.literal("recent"))),
    senderEmail: v.optional(v.string()),
    cursor: v.optional(v.id("newsletterContent")), // Kept for backward compatibility
    cursorValue: v.optional(v.number()), // Sort field value for efficient pagination
    cursorId: v.optional(v.id("newsletterContent")), // For tie-breaking
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Auth check - must be logged in to browse community
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return { items: [], nextCursor: null, cursorValue: null, cursorId: null }

    const sortBy = args.sortBy ?? "popular"
    const limit = Math.min(args.limit ?? 20, 100) // Cap at 100

    let contentQuery

    if (args.senderEmail) {
      // Filter by sender using senderEmail index
      contentQuery = ctx.db
        .query("newsletterContent")
        .withIndex("by_senderEmail", (q) => q.eq("senderEmail", args.senderEmail!))
    } else {
      // Use appropriate index based on sort
      const indexName = sortBy === "popular" ? "by_readerCount" : "by_firstReceivedAt"
      contentQuery = ctx.db.query("newsletterContent").withIndex(indexName)
    }

    // Fetch all matching items (with reasonable limit for safety)
    const allItems = await contentQuery.order("desc").take(1000)

    // Sort by desired field
    const sortedItems = [...allItems]
    if (sortBy === "recent") {
      sortedItems.sort((a, b) => {
        const diff = b.firstReceivedAt - a.firstReceivedAt
        return diff !== 0 ? diff : a._id.localeCompare(b._id) // Tie-break by _id
      })
    } else {
      sortedItems.sort((a, b) => {
        const diff = b.readerCount - a.readerCount
        return diff !== 0 ? diff : a._id.localeCompare(b._id) // Tie-break by _id
      })
    }

    // Apply cursor-based pagination: find items after cursor
    let startIndex = 0
    if (args.cursorValue !== undefined && args.cursorId) {
      // Find the cursor position using sort value + id
      startIndex = sortedItems.findIndex((item) => {
        const itemValue = sortBy === "recent" ? item.firstReceivedAt : item.readerCount
        if (itemValue < args.cursorValue!) return true
        if (itemValue === args.cursorValue && item._id > args.cursorId!) return true
        return false
      })
      if (startIndex === -1) startIndex = sortedItems.length
    } else if (args.cursor) {
      // Legacy cursor support: find by _id and skip to next
      const cursorIndex = sortedItems.findIndex((item) => item._id === args.cursor)
      startIndex = cursorIndex !== -1 ? cursorIndex + 1 : 0
    }

    // Take limit + 1 to check for more
    const pageItems = sortedItems.slice(startIndex, startIndex + limit + 1)
    const hasMore = pageItems.length > limit
    const resultItems = pageItems.slice(0, limit)

    // Calculate cursor for next page
    const lastItem = resultItems[resultItems.length - 1]
    const nextCursorValue = lastItem
      ? sortBy === "recent"
        ? lastItem.firstReceivedAt
        : lastItem.readerCount
      : null
    const nextCursorId = lastItem?._id ?? null

    // Return only public fields - NEVER expose user data
    return {
      items: resultItems.map((c) => ({
        _id: c._id,
        subject: c.subject,
        senderEmail: c.senderEmail,
        senderName: c.senderName,
        firstReceivedAt: c.firstReceivedAt,
        readerCount: c.readerCount,
        hasSummary: Boolean(c.summary),
      })),
      nextCursor: hasMore ? nextCursorId : null, // Legacy support
      cursorValue: hasMore ? nextCursorValue : null,
      cursorId: hasMore ? nextCursorId : null,
    }
  },
})

/**
 * List community newsletters by sender
 * Story 6.1 Task 1.3
 *
 * Convenience wrapper for listCommunityNewsletters with senderEmail filter
 */
export const listCommunityNewslettersBySender = query({
  args: {
    senderEmail: v.string(),
    sortBy: v.optional(v.union(v.literal("popular"), v.literal("recent"))),
    cursor: v.optional(v.id("newsletterContent")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Auth check - must be logged in to browse community
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return { items: [], nextCursor: null }

    const sortBy = args.sortBy ?? "recent" // Default to recent for sender view
    const limit = Math.min(args.limit ?? 20, 100)

    // Query ALL newsletters from this sender (up to reasonable max)
    // We need all items to sort correctly before pagination
    // Most senders have <500 newsletters, so this is acceptable
    const allItems = await ctx.db
      .query("newsletterContent")
      .withIndex("by_senderEmail", (q) => q.eq("senderEmail", args.senderEmail))
      .collect()

    // Sort by desired field
    const sortedItems = [...allItems]
    if (sortBy === "recent") {
      sortedItems.sort((a, b) => {
        const diff = b.firstReceivedAt - a.firstReceivedAt
        return diff !== 0 ? diff : a._id.localeCompare(b._id) // Tie-break by _id
      })
    } else {
      sortedItems.sort((a, b) => {
        const diff = b.readerCount - a.readerCount
        return diff !== 0 ? diff : a._id.localeCompare(b._id) // Tie-break by _id
      })
    }

    // Handle cursor-based pagination
    let startIndex = 0
    if (args.cursor) {
      const cursorIndex = sortedItems.findIndex((item) => item._id === args.cursor)
      if (cursorIndex !== -1) {
        startIndex = cursorIndex + 1
      }
    }

    const pageItems = sortedItems.slice(startIndex, startIndex + limit + 1)
    const hasMore = pageItems.length > limit
    const resultItems = pageItems.slice(0, limit)
    const nextCursor = hasMore ? resultItems[resultItems.length - 1]?._id : null

    return {
      items: resultItems.map((c) => ({
        _id: c._id,
        subject: c.subject,
        senderEmail: c.senderEmail,
        senderName: c.senderName,
        firstReceivedAt: c.firstReceivedAt,
        readerCount: c.readerCount,
        hasSummary: Boolean(c.summary),
      })),
      nextCursor,
    }
  },
})

/**
 * Get distinct senders from community content
 * Story 6.1 Task 2.4 - for sender filter dropdown
 *
 * Returns unique sender emails with their names and newsletter counts.
 * Uses the global senders table with subscriberCount for efficient lookup
 * instead of scanning all newsletterContent records.
 */
export const listCommunitySenders = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Auth check
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const limit = Math.min(args.limit ?? 50, 100)

    // Use the global senders table which already has subscriberCount
    // This is much more efficient than scanning all newsletterContent
    const senders = await ctx.db
      .query("senders")
      .withIndex("by_subscriberCount")
      .order("desc")
      .take(limit)

    // Return sender info for the dropdown
    // subscriberCount indicates popularity (how many users receive from this sender)
    return senders.map((sender) => ({
      email: sender.email,
      name: sender.name,
      newsletterCount: sender.newsletterCount,
      totalReaders: sender.subscriberCount, // Use subscriberCount as popularity metric
    }))
  },
})

// ============================================================
// Task 1.4: Get Community Newsletter Content
// ============================================================

/** Content result for community newsletter */
export type CommunityContentResult = {
  _id: string
  subject: string
  senderEmail: string
  senderName: string | undefined
  firstReceivedAt: number
  readerCount: number
  hasSummary: boolean
  summary: string | undefined
  contentUrl: string | null
  contentStatus: "available" | "missing" | "error"
}

/**
 * Get community newsletter content with signed R2 URL
 * Story 6.1 Task 1.4
 *
 * This is an action because r2.getUrl() makes external API calls
 */
export const getCommunityNewsletterContent = action({
  args: { contentId: v.id("newsletterContent") },
  handler: async (ctx, args): Promise<CommunityContentResult> => {
    // Auth check
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Not authenticated" })
    }

    // Get the newsletter content
    const content = await ctx.runQuery(internal.community.getNewsletterContentInternal, {
      contentId: args.contentId,
    })

    if (!content) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Newsletter not found" })
    }

    // Generate signed URL for R2 content (valid for 1 hour)
    let contentUrl: string | null = null
    let contentStatus: "available" | "missing" | "error" = "missing"

    if (content.r2Key) {
      try {
        contentUrl = await r2.getUrl(content.r2Key, { expiresIn: 3600 })
        contentStatus = "available"
      } catch (error) {
        console.error("[community] Failed to generate R2 signed URL:", error)
        contentStatus = "error"
      }
    }

    // Return public fields only - NEVER expose user data
    return {
      _id: content._id,
      subject: content.subject,
      senderEmail: content.senderEmail,
      senderName: content.senderName,
      firstReceivedAt: content.firstReceivedAt,
      readerCount: content.readerCount,
      hasSummary: Boolean(content.summary),
      summary: content.summary,
      contentUrl,
      contentStatus,
    }
  },
})

/**
 * Internal query to get newsletterContent without auth checks
 * Used by getCommunityNewsletterContent action
 */
export const getNewsletterContentInternal = internalQuery({
  args: { contentId: v.id("newsletterContent") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.contentId)
  },
})

// ============================================================
// Task 4: Add to Collection
// ============================================================

/**
 * Add a community newsletter to user's personal collection
 * Story 6.1 Task 4.1-4.3
 *
 * Creates userNewsletter with contentId reference, enabling:
 * - Personal actions (mark as read, hide, reading progress)
 * - Summary regeneration
 * - Organization with folders
 *
 * Also:
 * - Creates userSenderSettings if new sender relationship
 * - Increments readerCount on newsletterContent
 */
export const addToCollection = mutation({
  args: { contentId: v.id("newsletterContent") },
  handler: async (ctx, args) => {
    // 1. Auth check
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Not authenticated" })
    }

    // 2. Get user
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()

    if (!user) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "User not found" })
    }

    // 3. Get the content
    const content = await ctx.db.get(args.contentId)
    if (!content) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Newsletter content not found" })
    }

    // 4. Check if already in collection (by userId + contentId)
    // Need to scan user's newsletters since no direct index
    const existingUserNewsletters = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()

    const existing = existingUserNewsletters.find((n) => n.contentId === args.contentId)

    if (existing) {
      return { alreadyExists: true, userNewsletterId: existing._id }
    }

    // 5. Get or create global sender
    let sender = await ctx.db
      .query("senders")
      .withIndex("by_email", (q) => q.eq("email", content.senderEmail))
      .first()

    if (!sender) {
      // Create sender (rare case - sender should exist from original receipt)
      const senderId = await ctx.db.insert("senders", {
        email: content.senderEmail,
        name: content.senderName,
        domain: content.senderEmail.split("@")[1] || "unknown",
        subscriberCount: 1,
        newsletterCount: 1,
      })
      sender = (await ctx.db.get(senderId))!
    }

    // 6. Get or create userSenderSettings (default isPrivate: false)
    const existingSettings = await ctx.db
      .query("userSenderSettings")
      .withIndex("by_userId_senderId", (q) => q.eq("userId", user._id).eq("senderId", sender._id))
      .first()

    if (!existingSettings) {
      await ctx.db.insert("userSenderSettings", {
        userId: user._id,
        senderId: sender._id,
        isPrivate: false, // Default to public - community sharing enabled
      })
      // Increment subscriberCount since this is a new user-sender relationship
      await ctx.db.patch(sender._id, {
        subscriberCount: sender.subscriberCount + 1,
      })
    }

    // 7. Create userNewsletter with contentId reference
    const userNewsletterId = await ctx.db.insert("userNewsletters", {
      userId: user._id,
      senderId: sender._id,
      contentId: args.contentId,
      subject: content.subject,
      senderEmail: content.senderEmail,
      senderName: content.senderName,
      receivedAt: content.firstReceivedAt,
      isRead: false,
      isHidden: false,
      isPrivate: false, // Added from community = public
    })

    // 8. Increment readerCount (user is now a reader)
    await ctx.db.patch(args.contentId, {
      readerCount: content.readerCount + 1,
    })

    return { alreadyExists: false, userNewsletterId }
  },
})

// ============================================================
// Task 5: Onboarding
// ============================================================

/**
 * Check if user has seen the sharing onboarding modal
 * Story 6.1 Task 5.4
 */
export const hasSeenSharingOnboarding = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return true // Don't show for unauthenticated

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()

    if (!user) return true // Don't show for missing user

    return user.hasSeenSharingOnboarding ?? false
  },
})

/**
 * Mark sharing onboarding as seen
 * Story 6.1 Task 5.4
 */
export const dismissSharingOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Not authenticated" })
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()

    if (!user) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "User not found" })
    }

    await ctx.db.patch(user._id, { hasSeenSharingOnboarding: true })
  },
})
