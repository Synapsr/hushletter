/**
 * Community Newsletter Queries and Mutations
 * Story 6.1: Default Public Sharing - Community Browse & Discovery
 * Story 7.4: Community Content Management - Moderation filters
 * Story 9.8: Admin-Curated Community Browse - Only admin-approved content visible
 *
 * CRITICAL PRIVACY RULES:
 * - Community queries ONLY access newsletterContent (inherently public content)
 * - NEVER join to userNewsletters for community views (exposes user data)
 * - Only expose: subject, senderEmail, senderName, firstReceivedAt, readerCount, importCount, hasSummary
 * - NEVER expose userId or any user-specific data
 *
 * MODERATION RULES (Story 7.4):
 * - Community queries MUST exclude hidden content (isHiddenFromCommunity: true)
 * - Community queries MUST exclude content from blocked senders
 *
 * ADMIN CURATION RULES (Story 9.8 - Epic 9):
 * - Community queries MUST only return content where communityApprovedAt is set
 * - Only admin-approved content appears in community browse
 *
 * The newsletterContent table IS the community database - content that exists
 * here is inherently public (private newsletters bypass this table entirely).
 */

import { query, mutation, action, internalQuery } from "./_generated/server"
import type { QueryCtx } from "./_generated/server"
import type { Doc, Id } from "./_generated/dataModel"
import { internal } from "./_generated/api"
import { v } from "convex/values"
import { ConvexError } from "convex/values"
import { r2 } from "./r2"

// ============================================================
// Constants
// ============================================================

/** Maximum items to scan for community content queries */
const MAX_COMMUNITY_CONTENT_SCAN = 1000

/** Maximum contentIds to check in a single ownership query (Story 9.8 performance) */
const MAX_OWNERSHIP_CHECK_BATCH = 100

/** Maximum newsletters to bulk import at once (Story 9.9) */
const MAX_BULK_IMPORT_BATCH = 50

// ============================================================
// Story 7.4: Moderation Helpers
// ============================================================

/**
 * Get set of blocked sender emails for filtering
 * Story 7.4 Task 12.1-12.2
 */
async function getBlockedSenderEmails(ctx: QueryCtx): Promise<Set<string>> {
  const blockedSenders = await ctx.db.query("blockedSenders").collect()
  const emails = new Set<string>()

  for (const block of blockedSenders) {
    const sender = await ctx.db.get(block.senderId)
    if (sender) {
      emails.add(sender.email)
    }
  }

  return emails
}

/**
 * Filter content to exclude hidden, blocked sender, and non-approved content
 * Story 7.4 Task 12.1-12.3
 * Story 9.8 Task 1.1-1.5: Filter for admin-approved content only
 */
function filterModeratedContent(
  content: Doc<"newsletterContent">[],
  blockedSenderEmails: Set<string>
): Doc<"newsletterContent">[] {
  return content.filter((c) => {
    // Story 9.8: CRITICAL - Only show admin-approved content
    if (c.communityApprovedAt === undefined) return false
    // Exclude hidden content
    if (c.isHiddenFromCommunity === true) return false
    // Exclude blocked sender content
    if (blockedSenderEmails.has(c.senderEmail)) return false
    return true
  })
}

// ============================================================
// Story 6.3: Search Community Newsletters
// ============================================================

/**
 * Search community newsletters by subject and sender name
 * Story 6.3 Task 1.2
 * Story 7.4 Task 12.1-12.2: Exclude moderated content
 * Story 9.8 Task 1.3: Only search admin-approved content
 *
 * Implements in-memory search on newsletterContent (Convex lacks full-text search).
 * For MVP, scanning 500 items is acceptable. Consider Algolia for scale.
 *
 * Returns ONLY public fields - NEVER exposes user data.
 *
 * PRIVACY: Queries newsletterContent directly which is inherently public.
 * Private newsletters never enter this table (Epic 2.5 design).
 * MODERATION: Excludes hidden content and blocked sender content.
 * CURATION: Only returns admin-approved content (Story 9.8).
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

    // Story 7.4: Get blocked senders for filtering
    const blockedSenderEmails = await getBlockedSenderEmails(ctx)

    // Fetch and filter in-memory (Convex doesn't have full-text search)
    // For MVP this is acceptable; consider external search (Algolia) for scale
    const allContent = await ctx.db
      .query("newsletterContent")
      .withIndex("by_readerCount")
      .order("desc")
      .take(500) // Reasonable limit for in-memory search

    // Story 7.4: Filter out moderated content
    const visibleContent = filterModeratedContent(allContent, blockedSenderEmails)

    const matches = visibleContent
      .filter(
        (c) =>
          c.subject.toLowerCase().includes(searchLower) ||
          (c.senderName?.toLowerCase().includes(searchLower) ?? false) ||
          c.senderEmail.toLowerCase().includes(searchLower)
      )
      .slice(0, limit)

    // Return ONLY public fields - NEVER expose user data
    // Story 9.8: Include importCount in response
    return matches.map((c) => ({
      _id: c._id,
      subject: c.subject,
      senderEmail: c.senderEmail,
      senderName: c.senderName,
      firstReceivedAt: c.firstReceivedAt,
      readerCount: c.readerCount,
      importCount: c.importCount ?? 0, // Story 9.8: Add import count
      hasSummary: Boolean(c.summary),
    }))
  },
})

// ============================================================
// Story 9.8 Task 3.1-3.2: Check User Ownership of Community Content
// ============================================================

/**
 * Check which community content items the user already has
 * Story 9.8 Task 3.1-3.2
 *
 * Returns a map of contentId → ownership status
 * Used to show "Already in collection" badges in community browse
 *
 * Ownership types:
 * - hasPrivate: User has a private copy (received directly, not from community)
 * - hasImported: User imported this from community (source === "community")
 */
export const checkUserHasNewsletters = query({
  args: {
    contentIds: v.array(v.id("newsletterContent")),
  },
  handler: async (ctx, args): Promise<Record<string, { hasPrivate: boolean; hasImported: boolean }>> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return {}

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()
    if (!user) return {}

    if (args.contentIds.length === 0) return {}

    // Limit batch size to prevent performance issues with large requests
    const contentIdsToCheck = args.contentIds.slice(0, MAX_OWNERSHIP_CHECK_BATCH)

    // Get user's newsletters (limited to what we need for matching)
    const userNewsletters = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()

    // Load content records for matching by subject/sender
    const contentRecords = await Promise.all(
      contentIdsToCheck.map((id) => ctx.db.get(id))
    )

    // Build map of contentId → ownership
    const result: Record<string, { hasPrivate: boolean; hasImported: boolean }> = {}

    for (let i = 0; i < contentIdsToCheck.length; i++) {
      const contentId = contentIdsToCheck[i]
      const contentRecord = contentRecords[i]
      if (!contentRecord) continue

      // Check if user has this content via contentId reference
      const matching = userNewsletters.filter((n) => n.contentId === contentId)

      // Check for private copies (same sender/subject but with privateR2Key)
      // This handles the case where user received same newsletter privately
      const privateMatches = userNewsletters.filter(
        (n) =>
          n.senderEmail === contentRecord.senderEmail &&
          n.subject === contentRecord.subject &&
          n.privateR2Key !== undefined
      )

      result[contentId] = {
        hasPrivate: privateMatches.length > 0,
        hasImported: matching.some((n) => n.source === "community"),
      }
    }

    return result
  },
})

// ============================================================
// Story 6.3 Task 2.2: Top Community Senders
// ============================================================

/**
 * List top community senders by subscriber count
 * Story 6.3 Task 2.2
 * Story 7.4 Task 12.2: Exclude blocked senders
 * Story 9.8 Task 1.5: Only show senders with approved content
 *
 * Returns senders with highest subscriberCount for "Browse by Sender" section.
 * Uses the global senders table which has pre-computed subscriber counts.
 *
 * Returns ONLY public sender info - no user data.
 * MODERATION: Excludes blocked senders.
 * CURATION: Only shows senders that have at least one admin-approved newsletter.
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

    // Story 7.4: Get blocked sender IDs for filtering
    const blockedSenders = await ctx.db.query("blockedSenders").collect()
    const blockedSenderIds = new Set(blockedSenders.map((b) => b.senderId))

    // Story 9.8: Get emails of senders with approved content
    const allApprovedContent = await ctx.db
      .query("newsletterContent")
      .take(MAX_COMMUNITY_CONTENT_SCAN)
    const sendersWithApprovedContent = new Set(
      allApprovedContent
        .filter((c) => c.communityApprovedAt !== undefined && c.isHiddenFromCommunity !== true)
        .map((c) => c.senderEmail)
    )

    // Use the global senders table sorted by subscriberCount
    // Fetch more to account for filtering
    const senders = await ctx.db
      .query("senders")
      .withIndex("by_subscriberCount")
      .order("desc")
      .take(limit * 3)

    // Story 7.4: Filter out blocked senders
    // Story 9.8: Filter out senders without approved content
    const visibleSenders = senders.filter(
      (s) => !blockedSenderIds.has(s._id) && sendersWithApprovedContent.has(s.email)
    )

    // Return public sender info only
    return visibleSenders.slice(0, limit).map((sender) => ({
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
 * Story 6.4 Task 3.3: Added domain filter parameter
 * Story 7.4 Task 12.1-12.2: Exclude moderated content
 * Story 9.8 Task 1.1, 2.2: Only admin-approved content, added "imports" sort option
 *
 * Query parameters:
 * - sortBy: "popular" (readerCount desc), "recent" (firstReceivedAt desc), or "imports" (importCount desc)
 * - senderEmail: optional filter by sender
 * - domain: optional filter by sender domain (Story 6.4)
 * - cursorValue: pagination cursor (last item's sort value)
 * - cursorId: pagination cursor (last item's _id for tie-breaking)
 * - limit: max items to return (default 20, max 100)
 *
 * Returns ONLY public fields from newsletterContent - no user data
 * MODERATION: Excludes hidden content and blocked sender content.
 * CURATION: Only returns admin-approved content (Story 9.8).
 */
export const listCommunityNewsletters = query({
  args: {
    sortBy: v.optional(v.union(v.literal("popular"), v.literal("recent"), v.literal("imports"))),
    senderEmail: v.optional(v.string()),
    domain: v.optional(v.string()), // Story 6.4: Domain filter
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

    // Story 7.4: Get blocked senders for filtering
    const blockedSenderEmails = await getBlockedSenderEmails(ctx)

    let contentQuery

    if (args.senderEmail) {
      // Filter by sender using senderEmail index
      contentQuery = ctx.db
        .query("newsletterContent")
        .withIndex("by_senderEmail", (q) => q.eq("senderEmail", args.senderEmail!))
    } else {
      // Use appropriate index based on sort
      // Story 9.8: Added by_importCount for "imports" sort
      const indexName =
        sortBy === "imports"
          ? "by_importCount"
          : sortBy === "recent"
            ? "by_firstReceivedAt"
            : "by_readerCount"
      contentQuery = ctx.db.query("newsletterContent").withIndex(indexName)
    }

    // Fetch all matching items (with reasonable limit for safety)
    let allItems = await contentQuery.order("desc").take(MAX_COMMUNITY_CONTENT_SCAN)

    // Story 7.4 Task 12.1-12.2: Filter out moderated content
    // Story 9.8 Task 1.1: This also filters for admin-approved content
    allItems = filterModeratedContent(allItems, blockedSenderEmails)

    // Story 6.4 Task 3.3: Apply domain filter if provided
    if (args.domain) {
      allItems = allItems.filter((item) => {
        const itemDomain = item.senderEmail.split("@")[1]
        return itemDomain === args.domain
      })
    }

    // Sort by desired field
    const sortedItems = [...allItems]
    if (sortBy === "recent") {
      sortedItems.sort((a, b) => {
        const diff = b.firstReceivedAt - a.firstReceivedAt
        return diff !== 0 ? diff : a._id.localeCompare(b._id) // Tie-break by _id
      })
    } else if (sortBy === "imports") {
      // Story 9.8 Task 2.2: Sort by importCount
      sortedItems.sort((a, b) => {
        const diff = (b.importCount ?? 0) - (a.importCount ?? 0)
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
        const itemValue =
          sortBy === "recent"
            ? item.firstReceivedAt
            : sortBy === "imports"
              ? (item.importCount ?? 0)
              : item.readerCount
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
        : sortBy === "imports"
          ? (lastItem.importCount ?? 0)
          : lastItem.readerCount
      : null
    const nextCursorId = lastItem?._id ?? null

    // Return only public fields - NEVER expose user data
    // Story 9.8 Task 6.2: Include importCount in response
    return {
      items: resultItems.map((c) => ({
        _id: c._id,
        subject: c.subject,
        senderEmail: c.senderEmail,
        senderName: c.senderName,
        firstReceivedAt: c.firstReceivedAt,
        readerCount: c.readerCount,
        importCount: c.importCount ?? 0, // Story 9.8: Add import count
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
 * Story 7.4 Task 12.1-12.2: Exclude moderated content
 * Story 9.8 Task 1.2, 4.3: Only admin-approved content, return total count
 *
 * Convenience wrapper for listCommunityNewsletters with senderEmail filter
 * MODERATION: Excludes hidden content and blocked sender content.
 * CURATION: Only returns admin-approved content (Story 9.8).
 */
export const listCommunityNewslettersBySender = query({
  args: {
    senderEmail: v.string(),
    sortBy: v.optional(v.union(v.literal("popular"), v.literal("recent"), v.literal("imports"))),
    cursor: v.optional(v.id("newsletterContent")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Auth check - must be logged in to browse community
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return { items: [], nextCursor: null, totalCount: 0 }

    const sortBy = args.sortBy ?? "recent" // Default to recent for sender view
    const limit = Math.min(args.limit ?? 20, 100)

    // Story 7.4: Get blocked senders for filtering
    const blockedSenderEmails = await getBlockedSenderEmails(ctx)

    // If sender is blocked, return empty (their content shouldn't be visible)
    if (blockedSenderEmails.has(args.senderEmail)) {
      return { items: [], nextCursor: null, totalCount: 0 }
    }

    // Query ALL newsletters from this sender (up to reasonable max)
    // We need all items to sort correctly before pagination
    // Most senders have <500 newsletters, so this is acceptable
    const rawItems = await ctx.db
      .query("newsletterContent")
      .withIndex("by_senderEmail", (q) => q.eq("senderEmail", args.senderEmail))
      .collect()

    // Story 7.4 Task 12.1: Filter out hidden content
    // Story 9.8 Task 1.2: Only show admin-approved content
    const allItems = rawItems.filter(
      (c) => c.isHiddenFromCommunity !== true && c.communityApprovedAt !== undefined
    )

    // Story 9.8 Task 4.3: Total count for sender view
    const totalCount = allItems.length

    // Sort by desired field
    const sortedItems = [...allItems]
    if (sortBy === "recent") {
      sortedItems.sort((a, b) => {
        const diff = b.firstReceivedAt - a.firstReceivedAt
        return diff !== 0 ? diff : a._id.localeCompare(b._id) // Tie-break by _id
      })
    } else if (sortBy === "imports") {
      // Story 9.8: Sort by importCount
      sortedItems.sort((a, b) => {
        const diff = (b.importCount ?? 0) - (a.importCount ?? 0)
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
        importCount: c.importCount ?? 0, // Story 9.8: Add import count
        hasSummary: Boolean(c.summary),
      })),
      nextCursor,
      totalCount, // Story 9.8 Task 4.3: Return total count
    }
  },
})

/**
 * Get distinct senders from community content
 * Story 6.1 Task 2.4 - for sender filter dropdown
 * Story 7.4 Task 12.2: Exclude blocked senders
 * Story 9.8 Task 1.4: Only show senders with approved content
 *
 * Returns unique sender emails with their names and newsletter counts.
 * Uses the global senders table with subscriberCount for efficient lookup
 * instead of scanning all newsletterContent records.
 * MODERATION: Excludes blocked senders.
 * CURATION: Only shows senders that have at least one admin-approved newsletter.
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

    // Story 7.4: Get blocked sender IDs for filtering
    const blockedSenders = await ctx.db.query("blockedSenders").collect()
    const blockedSenderIds = new Set(blockedSenders.map((b) => b.senderId))

    // Story 9.8: Get emails of senders with approved content
    const allApprovedContent = await ctx.db
      .query("newsletterContent")
      .take(MAX_COMMUNITY_CONTENT_SCAN)
    const sendersWithApprovedContent = new Set(
      allApprovedContent
        .filter((c) => c.communityApprovedAt !== undefined && c.isHiddenFromCommunity !== true)
        .map((c) => c.senderEmail)
    )

    // Use the global senders table which already has subscriberCount
    // This is much more efficient than scanning all newsletterContent
    // Fetch extra to account for blocked senders and filtering
    const senders = await ctx.db
      .query("senders")
      .withIndex("by_subscriberCount")
      .order("desc")
      .take(limit * 3)

    // Story 7.4: Filter out blocked senders
    // Story 9.8: Filter out senders without approved content
    const visibleSenders = senders.filter(
      (s) => !blockedSenderIds.has(s._id) && sendersWithApprovedContent.has(s.email)
    )

    // Return sender info for the dropdown
    // subscriberCount indicates popularity (how many users receive from this sender)
    return visibleSenders.slice(0, limit).map((sender) => ({
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
 * Story 7.4 Task 12.3: Check moderation status before returning content
 *
 * This is an action because r2.getUrl() makes external API calls
 * MODERATION: Returns NOT_FOUND for hidden content or blocked sender content.
 */
export const getCommunityNewsletterContent = action({
  args: { contentId: v.id("newsletterContent") },
  handler: async (ctx, args): Promise<CommunityContentResult> => {
    // Auth check
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Not authenticated" })
    }

    // Get the newsletter content with moderation check
    const result = await ctx.runQuery(internal.community.getNewsletterContentWithModerationCheck, {
      contentId: args.contentId,
    })

    if (!result || result.isHidden) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Newsletter not found" })
    }

    const content = result.content

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

/**
 * Internal query to get newsletterContent with moderation check
 * Story 7.4 Task 12.3
 *
 * Checks if content is hidden or from blocked sender before returning.
 */
export const getNewsletterContentWithModerationCheck = internalQuery({
  args: { contentId: v.id("newsletterContent") },
  handler: async (ctx, args) => {
    const content = await ctx.db.get(args.contentId)
    if (!content) return null

    // Check if content is hidden
    if (content.isHiddenFromCommunity === true) {
      return { content, isHidden: true }
    }

    // Check if sender is blocked
    const sender = await ctx.db
      .query("senders")
      .withIndex("by_email", (q) => q.eq("email", content.senderEmail))
      .first()

    if (sender) {
      const blocked = await ctx.db
        .query("blockedSenders")
        .withIndex("by_senderId", (q) => q.eq("senderId", sender._id))
        .first()

      if (blocked) {
        return { content, isHidden: true }
      }
    }

    return { content, isHidden: false }
  },
})

// ============================================================
// Task 4: Add to Collection
// ============================================================

/**
 * Add a community newsletter to user's personal collection
 * Story 6.1 Task 4.1-4.3
 * Story 9.8: Mark source as "community" and increment importCount
 * Story 9.9: Updated for Epic 9 folder-centric and source tracking
 *
 * Creates userNewsletter with:
 * - contentId reference (from community)
 * - source: "community" (Epic 9 tracking)
 * - folderId: auto-created or existing folder for sender
 *
 * Also:
 * - Creates userSenderSettings with folderId if new sender relationship
 * - Increments readerCount AND importCount on newsletterContent
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

    // Story 9.8: Verify content is community-approved
    if (content.communityApprovedAt === undefined) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Content not available in community" })
    }

    // 4. Check if already in collection (by userId + contentId)
    const existingUserNewsletters = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()

    const existing = existingUserNewsletters.find((n) => n.contentId === args.contentId)

    if (existing) {
      // Story 9.9: Get folder name for response
      const folder = existing.folderId ? await ctx.db.get(existing.folderId) : null
      return {
        alreadyExists: true,
        userNewsletterId: existing._id,
        folderName: folder?.name ?? null,
      }
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

    // 6. Story 9.9: Get or create folder for this sender
    // This follows the folder auto-creation pattern from Story 9.3
    const existingSettings = await ctx.db
      .query("userSenderSettings")
      .withIndex("by_userId_senderId", (q) =>
        q.eq("userId", user._id).eq("senderId", sender._id)
      )
      .first()

    let folderId: Id<"folders">
    let folderName: string

    if (existingSettings?.folderId) {
      // Use existing folder
      folderId = existingSettings.folderId
      const folder = await ctx.db.get(folderId)
      folderName = folder?.name ?? sender.name ?? sender.email
    } else {
      // Create folder for this sender (Story 9.3 pattern)
      const senderDisplayName = sender.name ?? sender.email.split("@")[0]

      // Check if folder with this name exists (avoid duplicates)
      const existingFolder = await ctx.db
        .query("folders")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .filter((q) => q.eq(q.field("name"), senderDisplayName))
        .first()

      if (existingFolder) {
        folderId = existingFolder._id
        folderName = existingFolder.name
      } else {
        const now = Date.now()
        folderId = await ctx.db.insert("folders", {
          userId: user._id,
          name: senderDisplayName,
          isHidden: false,
          createdAt: now,
          updatedAt: now,
        })
        folderName = senderDisplayName
      }

      // Create or update userSenderSettings with folderId
      if (existingSettings) {
        await ctx.db.patch(existingSettings._id, { folderId })
      } else {
        await ctx.db.insert("userSenderSettings", {
          userId: user._id,
          senderId: sender._id,
          isPrivate: false, // Community imports are public
          folderId,
        })
        // Increment subscriberCount since this is a new user-sender relationship
        await ctx.db.patch(sender._id, {
          subscriberCount: sender.subscriberCount + 1,
        })
      }
    }

    // 7. Create userNewsletter with contentId reference
    // Story 9.9: Set source to "community" and assign folderId
    const userNewsletterId = await ctx.db.insert("userNewsletters", {
      userId: user._id,
      senderId: sender._id,
      folderId, // Story 9.9: Required folder assignment
      contentId: args.contentId,
      subject: content.subject,
      senderEmail: content.senderEmail,
      senderName: content.senderName,
      receivedAt: content.firstReceivedAt,
      isRead: false,
      isHidden: false,
      isPrivate: false, // Community imports are public
      source: "community", // Story 9.9: Track origin
    })

    // 8. Increment readerCount AND importCount
    // Story 9.9: Track imports separately from reader count
    await ctx.db.patch(args.contentId, {
      readerCount: content.readerCount + 1,
      importCount: (content.importCount ?? 0) + 1,
    })

    return {
      alreadyExists: false,
      userNewsletterId,
      folderName, // Story 9.9: Return folder name for UI confirmation
    }
  },
})

/**
 * Bulk import multiple community newsletters
 * Story 9.9 Task 3
 *
 * Efficiently imports multiple newsletters by:
 * - Batching folder creation (one per sender)
 * - Processing imports in sequence to avoid race conditions
 * - Returning detailed results for each item
 */
export const bulkImportFromCommunity = mutation({
  args: {
    contentIds: v.array(v.id("newsletterContent")),
  },
  handler: async (ctx, args) => {
    // Auth check
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

    // Limit batch size to prevent timeout
    if (args.contentIds.length > MAX_BULK_IMPORT_BATCH) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: `Maximum ${MAX_BULK_IMPORT_BATCH} newsletters can be imported at once`,
      })
    }

    // Get user's existing newsletters for duplicate detection
    const existingNewsletters = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()
    const existingContentIds = new Set(
      existingNewsletters.filter((n) => n.contentId).map((n) => n.contentId)
    )

    // Get user's existing settings for folder lookup
    const existingSettingsArr = await ctx.db
      .query("userSenderSettings")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()
    const settingsBySenderId = new Map(existingSettingsArr.map((s) => [s.senderId, s]))

    // Get user's existing folders
    const existingFolders = await ctx.db
      .query("folders")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()
    const foldersByName = new Map(existingFolders.map((f) => [f.name, f]))

    // Track created folders in this batch to avoid duplicates
    const createdFoldersThisBatch = new Map<string, Id<"folders">>()

    // Results tracking
    const results: Array<{
      contentId: string
      status: "imported" | "skipped" | "error"
      error?: string
      folderName?: string
    }> = []

    let imported = 0
    let skipped = 0
    let failed = 0

    for (const contentId of args.contentIds) {
      try {
        // Skip if already in collection
        if (existingContentIds.has(contentId)) {
          results.push({ contentId, status: "skipped" })
          skipped++
          continue
        }

        // Get content
        const content = await ctx.db.get(contentId)
        if (!content) {
          results.push({ contentId, status: "error", error: "Content not found" })
          failed++
          continue
        }

        // Verify community-approved
        if (content.communityApprovedAt === undefined) {
          results.push({ contentId, status: "error", error: "Not community-approved" })
          failed++
          continue
        }

        // Get or create sender
        let sender = await ctx.db
          .query("senders")
          .withIndex("by_email", (q) => q.eq("email", content.senderEmail))
          .first()

        if (!sender) {
          const senderId = await ctx.db.insert("senders", {
            email: content.senderEmail,
            name: content.senderName,
            domain: content.senderEmail.split("@")[1] || "unknown",
            subscriberCount: 1,
            newsletterCount: 1,
          })
          sender = (await ctx.db.get(senderId))!
        }

        // Get or create folder
        const senderDisplayName = sender.name ?? sender.email.split("@")[0]
        let folderId: Id<"folders">
        let folderName: string

        const existingSetting = settingsBySenderId.get(sender._id)
        if (existingSetting?.folderId) {
          folderId = existingSetting.folderId
          const folder = await ctx.db.get(folderId)
          folderName = folder?.name ?? senderDisplayName
        } else {
          // Check if folder exists or was created in this batch
          const existingFolder = foldersByName.get(senderDisplayName)
          const batchCreatedFolderId = createdFoldersThisBatch.get(senderDisplayName)

          if (existingFolder) {
            folderId = existingFolder._id
            folderName = existingFolder.name
          } else if (batchCreatedFolderId) {
            folderId = batchCreatedFolderId
            folderName = senderDisplayName
          } else {
            const now = Date.now()
            folderId = await ctx.db.insert("folders", {
              userId: user._id,
              name: senderDisplayName,
              isHidden: false,
              createdAt: now,
              updatedAt: now,
            })
            folderName = senderDisplayName
            createdFoldersThisBatch.set(senderDisplayName, folderId)
            // Note: foldersByName is not updated here since we track new folders in createdFoldersThisBatch
          }

          // Create or update settings
          if (existingSetting) {
            await ctx.db.patch(existingSetting._id, { folderId })
            settingsBySenderId.set(sender._id, { ...existingSetting, folderId })
          } else {
            const settingsId = await ctx.db.insert("userSenderSettings", {
              userId: user._id,
              senderId: sender._id,
              isPrivate: false,
              folderId,
            })
            // Track for this batch (don't need full type for local tracking)
            settingsBySenderId.set(sender._id, {
              _id: settingsId,
              userId: user._id,
              senderId: sender._id,
              isPrivate: false,
              folderId,
              _creationTime: Date.now(),
            } as Doc<"userSenderSettings">)
            await ctx.db.patch(sender._id, {
              subscriberCount: sender.subscriberCount + 1,
            })
          }
        }

        // Create userNewsletter
        await ctx.db.insert("userNewsletters", {
          userId: user._id,
          senderId: sender._id,
          folderId,
          contentId,
          subject: content.subject,
          senderEmail: content.senderEmail,
          senderName: content.senderName,
          receivedAt: content.firstReceivedAt,
          isRead: false,
          isHidden: false,
          isPrivate: false,
          source: "community",
        })

        // Increment counts
        await ctx.db.patch(contentId, {
          readerCount: content.readerCount + 1,
          importCount: (content.importCount ?? 0) + 1,
        })

        // Track as imported
        existingContentIds.add(contentId)
        results.push({ contentId, status: "imported", folderName })
        imported++
      } catch (error) {
        results.push({
          contentId,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        })
        failed++
      }
    }

    return {
      imported,
      skipped,
      failed,
      total: args.contentIds.length,
      results,
    }
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

// ============================================================
// Story 6.4: Follow Sender Feature
// ============================================================

/**
 * Follow a sender from the community
 * Creates userSenderSettings record without requiring newsletters
 * Story 6.4 Task 1.1
 *
 * This allows users to "follow" a sender they discovered in the community,
 * creating a relationship even if they haven't received any newsletters yet.
 * The followed sender will then appear in their personal senders list.
 */
export const followSender = mutation({
  args: { senderEmail: v.string() },
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

    // 3. Get sender by email
    const sender = await ctx.db
      .query("senders")
      .withIndex("by_email", (q) => q.eq("email", args.senderEmail))
      .first()
    if (!sender) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Sender not found" })
    }

    // 4. Check if already following (userSenderSettings exists)
    const existingSettings = await ctx.db
      .query("userSenderSettings")
      .withIndex("by_userId_senderId", (q) =>
        q.eq("userId", user._id).eq("senderId", sender._id)
      )
      .first()

    if (existingSettings) {
      return { alreadyFollowing: true, settingsId: existingSettings._id }
    }

    // 5. Create userSenderSettings (follow relationship)
    const settingsId = await ctx.db.insert("userSenderSettings", {
      userId: user._id,
      senderId: sender._id,
      isPrivate: false, // Public by default for follows
    })

    // 6. Increment subscriberCount
    await ctx.db.patch(sender._id, {
      subscriberCount: sender.subscriberCount + 1,
    })

    return { alreadyFollowing: false, settingsId }
  },
})

/**
 * Unfollow a sender
 * Story 6.4 Task 1.2
 *
 * If the user has newsletters from this sender, the userSenderSettings
 * record is kept (they still have a relationship via newsletters).
 * If the user has no newsletters, the settings record is deleted.
 */
export const unfollowSender = mutation({
  args: { senderEmail: v.string() },
  handler: async (ctx, args) => {
    // Auth + get user
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

    // Get sender
    const sender = await ctx.db
      .query("senders")
      .withIndex("by_email", (q) => q.eq("email", args.senderEmail))
      .first()
    if (!sender) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Sender not found" })
    }

    // Find userSenderSettings
    const settings = await ctx.db
      .query("userSenderSettings")
      .withIndex("by_userId_senderId", (q) =>
        q.eq("userId", user._id).eq("senderId", sender._id)
      )
      .first()

    if (!settings) {
      return { wasFollowing: false }
    }

    // Check if user has newsletters from this sender
    const hasNewsletters = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId_senderId", (q) =>
        q.eq("userId", user._id).eq("senderId", sender._id)
      )
      .first()

    if (hasNewsletters) {
      // User has newsletters - keep settings (relationship via newsletters)
      // Just indicate they can't fully unfollow while they have newsletters
      return { wasFollowing: true, hasNewsletters: true }
    }

    // Delete settings (pure follow with no newsletters)
    await ctx.db.delete(settings._id)

    // Decrement subscriberCount
    await ctx.db.patch(sender._id, {
      subscriberCount: Math.max(0, sender.subscriberCount - 1),
    })

    return { wasFollowing: true, hasNewsletters: false }
  },
})

/**
 * Check if user is following a sender
 * Story 6.4 Task 1.3
 *
 * Returns true if userSenderSettings exists for this user-sender pair.
 */
export const isFollowingSender = query({
  args: { senderEmail: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return false

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()
    if (!user) return false

    const sender = await ctx.db
      .query("senders")
      .withIndex("by_email", (q) => q.eq("email", args.senderEmail))
      .first()
    if (!sender) return false

    const settings = await ctx.db
      .query("userSenderSettings")
      .withIndex("by_userId_senderId", (q) =>
        q.eq("userId", user._id).eq("senderId", sender._id)
      )
      .first()

    return settings !== null
  },
})
