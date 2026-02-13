import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  action,
} from "./_generated/server"
import { internal } from "./_generated/api"
import { v } from "convex/values"
import { ConvexError } from "convex/values"
import { r2 } from "./r2"
import type { Id } from "./_generated/dataModel"
import {
  normalizeForHash,
  computeContentHash,
} from "./_internal/contentNormalization"

/** Content availability status for newsletters */
export type ContentStatus = "available" | "missing" | "error"

/**
 * Store newsletter content in R2 and create userNewsletter record
 * Called from emailIngestion HTTP action
 *
 * Story 2.5.1: Updated for new schema with public/private content paths
 * Story 2.5.2: Added content deduplication via normalization + SHA-256 hashing
 * Story 8.4: Added duplicate detection via messageId and content hash
 * Story 9.2: PRIVATE-BY-DEFAULT - All user newsletters are now stored privately.
 *   - Removed isPrivate parameter (always private for user ingestion)
 *   - Added source parameter to track ingestion origin
 *   - Added folderId parameter (required for folder-centric architecture)
 *   - Removed PUBLIC PATH deduplication to newsletterContent
 *   - newsletterContent is now ONLY created by admin curation (Story 9.7)
 *
 * DUPLICATE DETECTION (Story 8.4):
 * Before any storage, checks if this is a duplicate:
 * 1. Check by messageId (most reliable - globally unique per RFC 5322)
 * 2. Check by content hash for same user (user-level dedup only)
 * If duplicate found, returns { skipped: true } without storage.
 */
export const storeNewsletterContent = internalAction({
  args: {
    userId: v.id("users"),
    senderId: v.id("senders"),
    folderId: v.id("folders"), // Story 9.2: Required for folder-centric architecture
    subject: v.string(),
    senderEmail: v.string(),
    senderName: v.optional(v.string()),
    receivedAt: v.number(),
    htmlContent: v.optional(v.string()),
    textContent: v.optional(v.string()),
    // Story 9.2: Track ingestion source (replaces isPrivate)
    source: v.union(
      v.literal("email"),
      v.literal("gmail"),
      v.literal("manual"),
      v.literal("community")
    ),
    // Story 8.4: Email Message-ID header for duplicate detection
    messageId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<
    | {
        userNewsletterId: Id<"userNewsletters">
        r2Key: string
        skipped?: false
      }
    | {
        skipped: true
        reason: "duplicate"
        duplicateReason: "message_id" | "content_hash"
        existingId: Id<"userNewsletters">
      }
  > => {
    console.log(
      `[newsletters] storeNewsletterContent called: user=${args.userId}, sender=${args.senderId}, ` +
        `subject="${args.subject.substring(0, 50)}...", source=${args.source}, ` +
        `folderId=${args.folderId}, htmlLen=${args.htmlContent?.length || 0}, ` +
        `textLen=${args.textContent?.length || 0}, messageId=${args.messageId || "none"}`
    )

    // ========================================
    // DUPLICATE DETECTION (Story 8.4)
    // Check BEFORE any expensive R2 operations
    // ========================================

    // Step 1: Check by messageId (most reliable)
    if (args.messageId) {
      const existingByMessageId = await ctx.runQuery(
        internal._internal.duplicateDetection.checkDuplicateByMessageId,
        { userId: args.userId, messageId: args.messageId }
      )
      if (existingByMessageId) {
        console.log(
          `[newsletters] Duplicate detected by messageId: ${args.messageId}, existing=${existingByMessageId}`
        )
        return {
          skipped: true,
          reason: "duplicate",
          duplicateReason: "message_id",
          existingId: existingByMessageId,
        }
      }
    }

    const content = args.htmlContent || args.textContent || ""

    // Handle empty content gracefully - use subject as minimal content
    // This prevents all empty emails from deduplicating to the same hash
    const effectiveContent = content.trim() || `<p>${args.subject}</p>`
    const hasOriginalContent = content.trim().length > 0

    if (!hasOriginalContent) {
      console.log(
        `[newsletters] Empty content detected, using subject as fallback: "${args.subject}"`
      )
    }

    // Pre-compute content hash for user-level duplicate detection
    const normalized = normalizeForHash(effectiveContent)
    const contentHash = await computeContentHash(normalized)

    // Step 2: Check by content hash for THIS USER ONLY (user-level dedup)
    // Story 9.2: All newsletters are private, so we only check user's own content
    const existingByHash = await ctx.runQuery(
      internal._internal.duplicateDetection.checkDuplicateByContentHash,
      { userId: args.userId, contentHash, isPrivate: true }
    )
    if (existingByHash) {
      console.log(
        `[newsletters] Duplicate detected by contentHash for user: ${contentHash.substring(0, 8)}..., existing=${existingByHash}`
      )
      return {
        skipped: true,
        reason: "duplicate",
        duplicateReason: "content_hash",
        existingId: existingByHash,
      }
    }

    const contentType = args.htmlContent ? "text/html" : "text/plain"
    const ext = args.htmlContent ? "html" : "txt"

    // ========================================
    // PRIVATE-BY-DEFAULT PATH (Story 9.2)
    // All user newsletters stored with privateR2Key
    // ========================================
    const timestamp = Date.now()
    const randomId = crypto.randomUUID()
    const r2Key = `private/${args.userId}/${timestamp}-${randomId}.${ext}`

    // Upload to R2 (store original content, even if empty)
    try {
      console.log(`[newsletters] Uploading private content to R2: key=${r2Key}, size=${effectiveContent.length}`)
      const blob = new Blob([effectiveContent], { type: `${contentType}; charset=utf-8` })
      await r2.store(ctx, blob, { key: r2Key, type: contentType })
      console.log(`[newsletters] R2 upload successful: ${r2Key}`)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error(
        `[newsletters] R2 upload failed for private content: key=${r2Key}, error=${errorMsg}`,
        error
      )
      throw new ConvexError({
        code: "R2_UPLOAD_FAILED",
        message: `Failed to store newsletter content in R2: ${errorMsg}`,
      })
    }

    // Create userNewsletter with privateR2Key (no contentId - Story 9.2)
    const userNewsletterId = await ctx.runMutation(
      internal.newsletters.createUserNewsletter,
      {
        userId: args.userId,
        senderId: args.senderId,
        folderId: args.folderId, // Story 9.2: Required
        subject: args.subject,
        senderEmail: args.senderEmail,
        senderName: args.senderName,
        receivedAt: args.receivedAt,
        isPrivate: true, // Story 9.2: Always true for user ingestion
        privateR2Key: r2Key,
        contentId: undefined, // Story 9.2: Never set for user ingestion
        source: args.source, // Story 9.2: Track ingestion source
        messageId: args.messageId, // Story 8.4: For duplicate detection
      }
    )

    // Increment sender.newsletterCount after successful storage
    await ctx.runMutation(internal.senders.incrementNewsletterCount, {
      senderId: args.senderId,
    })

    console.log(
      `[newsletters] Private content stored: ${r2Key}, user=${args.userId}, source=${args.source}`
    )

    return { userNewsletterId, r2Key }
  },
})

/**
 * Create a new newsletterContent entry for shared public content
 * Story 2.5.1: New function for shared content schema
 * Story 2.5.2: Now requires contentHash (SHA-256 of normalized content)
 * Story 9.2: NOW ADMIN-ONLY - Used only for admin curation (Story 9.7)
 *   User ingestion no longer creates newsletterContent records.
 *   All user newsletters use privateR2Key instead.
 *
 * RACE CONDITION HANDLING: If another request created content with the same
 * hash between our lookup and this mutation, we detect it and return the
 * existing content instead of creating a duplicate.
 *
 * @deprecated For user ingestion - use storeNewsletterContent which always stores privately.
 * This function is reserved for admin curation workflow (Story 9.7).
 */
export const createNewsletterContent = internalMutation({
  args: {
    contentHash: v.string(), // Required: SHA-256 of normalized content
    r2Key: v.string(),
    subject: v.string(),
    senderEmail: v.string(),
    senderName: v.optional(v.string()),
    receivedAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Race condition check: verify hash doesn't exist (could have been created
    // between the action's query and this mutation)
    const existing = await ctx.db
      .query("newsletterContent")
      .withIndex("by_contentHash", (q) => q.eq("contentHash", args.contentHash))
      .first()

    if (existing) {
      // Another request created this content - increment readerCount and return existing
      await ctx.db.patch(existing._id, {
        readerCount: existing.readerCount + 1,
      })
      console.log(
        `[newsletters] Race condition handled: reusing existing content ${existing._id}`
      )
      return existing._id
    }

    const contentId = await ctx.db.insert("newsletterContent", {
      contentHash: args.contentHash,
      r2Key: args.r2Key,
      subject: args.subject,
      senderEmail: args.senderEmail,
      senderName: args.senderName,
      firstReceivedAt: args.receivedAt,
      readerCount: 1, // First reader
    })

    return contentId
  },
})

/**
 * Find newsletterContent by content hash (for deduplication lookup)
 * Story 2.5.2: Task 3 - Deduplication lookup via by_contentHash index
 * Story 9.2: NOW ADMIN-ONLY - Used only for admin curation (Story 9.7)
 *   User ingestion no longer uses cross-user content deduplication.
 *
 * @deprecated For user ingestion - storeNewsletterContent now uses user-level
 * duplicate detection only. This function is reserved for admin curation workflow.
 */
export const findByContentHash = internalQuery({
  args: { contentHash: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("newsletterContent")
      .withIndex("by_contentHash", (q) => q.eq("contentHash", args.contentHash))
      .first()
  },
})

/**
 * Increment readerCount when content is reused (dedup hit)
 * Story 2.5.2: Task 3 - Atomic increment for deduplication metrics
 * Story 9.2: NOW ADMIN-ONLY - Used only for admin curation (Story 9.7)
 *   User ingestion no longer uses cross-user content deduplication.
 *
 * Note: Throws if content not found (consistent with incrementNewsletterCount
 * in senders.ts). A missing contentId indicates a bug in the calling code.
 *
 * @deprecated For user ingestion - storeNewsletterContent no longer uses
 * shared content deduplication. This function is reserved for admin curation
 * workflow when users import from community content.
 */
export const incrementReaderCount = internalMutation({
  args: { contentId: v.id("newsletterContent") },
  handler: async (ctx, args) => {
    const content = await ctx.db.get(args.contentId)
    if (!content) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Newsletter content not found",
      })
    }
    await ctx.db.patch(args.contentId, {
      readerCount: content.readerCount + 1,
    })
  },
})

/**
 * Create a new userNewsletter entry
 * Story 2.5.1: Updated for new schema
 * Story 8.4: Added messageId field for duplicate detection
 * Story 9.2: Added source and folderId fields for private-by-default architecture
 */
export const createUserNewsletter = internalMutation({
  args: {
    userId: v.id("users"),
    senderId: v.id("senders"),
    folderId: v.id("folders"), // Story 9.2: Required for folder-centric architecture
    subject: v.string(),
    senderEmail: v.string(),
    senderName: v.optional(v.string()),
    receivedAt: v.number(),
    isPrivate: v.boolean(),
    contentId: v.optional(v.id("newsletterContent")),
    privateR2Key: v.optional(v.string()),
    // Story 9.2: Track ingestion source
    source: v.union(
      v.literal("email"),
      v.literal("gmail"),
      v.literal("manual"),
      v.literal("community")
    ),
    // Story 8.4: Email Message-ID header for duplicate detection
    messageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userNewsletterId = await ctx.db.insert("userNewsletters", {
      userId: args.userId,
      senderId: args.senderId,
      folderId: args.folderId, // Story 9.2: Required
      contentId: args.contentId,
      privateR2Key: args.privateR2Key,
      subject: args.subject,
      senderEmail: args.senderEmail,
      senderName: args.senderName,
      receivedAt: args.receivedAt,
      isRead: false,
      isHidden: false,
      isFavorited: false,
      isPrivate: args.isPrivate,
      source: args.source, // Story 9.2: Track ingestion source
      messageId: args.messageId, // Story 8.4: Store for duplicate detection
    })

    return userNewsletterId
  },
})

/**
 * Get userNewsletter metadata (without content URL)
 * Use getUserNewsletterWithContent action if you need the signed URL
 * Story 2.5.1: Updated for userNewsletters table
 */
export const getUserNewsletter = query({
  args: { userNewsletterId: v.id("userNewsletters") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Not authenticated" })
    }

    const userNewsletter = await ctx.db.get(args.userNewsletterId)
    if (!userNewsletter) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Newsletter not found" })
    }

    // Get user record to check permissions
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()

    if (!user) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "User not found" })
    }

    // Privacy check - user can only access their own newsletters
    // (Community access to public content will be added in Epic 6)
    if (userNewsletter.userId !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" })
    }

    // Determine content status
    const contentStatus: ContentStatus =
      userNewsletter.contentId || userNewsletter.privateR2Key ? "available" : "missing"

    return { ...userNewsletter, contentStatus }
  },
})

/** Return type for getUserNewsletterWithContent action */
type UserNewsletterWithContentResult = {
  _id: Id<"userNewsletters">
  _creationTime: number
  userId: Id<"users">
  senderId: Id<"senders">
  contentId?: Id<"newsletterContent">
  privateR2Key?: string
  subject: string
  senderEmail: string
  senderName?: string
  receivedAt: number
  isRead: boolean
  isHidden: boolean
  isFavorited?: boolean
  isPrivate: boolean
  readProgress?: number
  contentUrl: string | null
  contentStatus: ContentStatus
}

/**
 * Get userNewsletter with signed R2 URL for content
 * This is an action because r2.getUrl() makes external API calls
 * Story 2.5.1: Updated for userNewsletters table with public/private paths
 */
export const getUserNewsletterWithContent = action({
  args: { userNewsletterId: v.id("userNewsletters") },
  handler: async (ctx, args): Promise<UserNewsletterWithContentResult> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Not authenticated" })
    }

    // Get userNewsletter via internal query
    const userNewsletter = await ctx.runQuery(
      internal.newsletters.getUserNewsletterInternal,
      {
        userNewsletterId: args.userNewsletterId,
      }
    )

    if (!userNewsletter) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Newsletter not found" })
    }

    // Get user record to check permissions
    const user = await ctx.runQuery(internal._internal.users.findByAuthId, {
      authId: identity.subject,
    })

    if (!user) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "User not found" })
    }

    // Privacy check - user can only access their own newsletters
    if (userNewsletter.userId !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" })
    }

    // Determine R2 key based on public/private path
    let r2Key: string | null = null

    if (userNewsletter.isPrivate && userNewsletter.privateR2Key) {
      // Private content - use privateR2Key directly
      r2Key = userNewsletter.privateR2Key
    } else if (!userNewsletter.isPrivate && userNewsletter.contentId) {
      // Public content - get R2 key from newsletterContent
      const content = await ctx.runQuery(
        internal.newsletters.getNewsletterContentInternal,
        {
          contentId: userNewsletter.contentId,
        }
      )
      if (content) {
        r2Key = content.r2Key
      }
    }

    // Generate signed URL for R2 content (valid for 1 hour)
    let contentUrl: string | null = null
    let contentStatus: ContentStatus = "missing"

    if (r2Key) {
      try {
        contentUrl = await r2.getUrl(r2Key, { expiresIn: 3600 })
        contentStatus = "available"
      } catch (error) {
        console.error("[newsletters] Failed to generate R2 signed URL:", error)
        contentStatus = "error"
      }
    }

    return { ...userNewsletter, contentUrl, contentStatus }
  },
})

/**
 * Internal query to get userNewsletter without auth checks
 * Used by getUserNewsletterWithContent action
 */
export const getUserNewsletterInternal = internalQuery({
  args: { userNewsletterId: v.id("userNewsletters") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userNewsletterId)
  },
})

/**
 * Internal query to get newsletterContent without auth checks
 * Used by getUserNewsletterWithContent action
 */
export const getNewsletterContentInternal = internalQuery({
  args: { contentId: v.id("newsletterContent") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.contentId)
  },
})

/**
 * List userNewsletters for current user
 * Story 2.5.1: Updated to use userNewsletters table
 * Story 3.5: AC2 - Exclude hidden newsletters from main list
 * Story 5.2: Task 1.1 - Added hasSummary field for summary indicator
 * Story 9.10: Added source field for unified folder view display
 */
export const listUserNewsletters = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()

    if (!user) return []

    // Story 9.5: Fetch hidden folder IDs to exclude newsletters from hidden folders
    const folders = await ctx.db
      .query("folders")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()
    const hiddenFolderIds = new Set(
      folders.filter((f) => f.isHidden).map((f) => f._id)
    )

    // Use by_userId_receivedAt index for proper sorting by receivedAt (AC2)
    // Convex index ordering: when using compound index, order applies to last indexed field
    const newsletters = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId_receivedAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect()

    // Story 3.5 AC2: Exclude hidden newsletters from main list
    // Story 9.5 AC6: Exclude newsletters in hidden folders from "All Newsletters"
    const visibleNewsletters = newsletters.filter(
      (n) => !n.isHidden && (!n.folderId || !hiddenFolderIds.has(n.folderId))
    )

    // Story 5.2: Derive hasSummary for each newsletter
    // Code review fix: Batch-fetch contentIds to avoid N+1 queries
    const contentIds = visibleNewsletters
      .filter((n) => !n.isPrivate && n.contentId && !n.summary)
      .map((n) => n.contentId!)

    const uniqueContentIds = [...new Set(contentIds)]
    const contents = await Promise.all(uniqueContentIds.map((id) => ctx.db.get(id)))
    const contentMap = new Map(
      contents
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .map((c) => [c._id, c])
    )

    // Privacy pattern: check personal summary first, then shared if public (O(1) lookup)
    // Story 9.10: Include source field for unified folder view display
    const enrichedNewsletters = visibleNewsletters.map((newsletter) => {
      let hasSummary = Boolean(newsletter.summary)

      if (!hasSummary && !newsletter.isPrivate && newsletter.contentId) {
        const content = contentMap.get(newsletter.contentId)
        hasSummary = Boolean(content?.summary)
      }

      return { ...newsletter, hasSummary, source: newsletter.source }
    })

    return enrichedNewsletters
  },
})

/**
 * List user newsletters filtered by sender
 * Story 3.1: Task 5 - Support sender-based filtering (AC2, AC3)
 * Story 3.5: AC2 - Exclude hidden newsletters from main list
 * Story 5.2: Task 1.1 - Added hasSummary field for summary indicator
 * Story 9.10: Added source field for unified folder view display
 *
 * If senderId is provided, returns only newsletters from that sender.
 * If senderId is undefined/null, returns all newsletters (same as listUserNewsletters).
 * Results are always sorted by receivedAt descending (newest first).
 *
 * Performance: Uses by_userId_senderId composite index for efficient filtering.
 */
export const listUserNewslettersBySender = query({
  args: {
    senderId: v.optional(v.id("senders")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()

    if (!user) return []

    let visibleNewsletters

    if (args.senderId) {
      // Filter by sender using composite index
      const newsletters = await ctx.db
        .query("userNewsletters")
        .withIndex("by_userId_senderId", (q) =>
          q.eq("userId", user._id).eq("senderId", args.senderId as Id<"senders">)
        )
        .collect()

      // Story 3.5 AC2: Exclude hidden newsletters, then sort by receivedAt descending
      visibleNewsletters = newsletters
        .filter((n) => !n.isHidden)
        .sort((a, b) => b.receivedAt - a.receivedAt)
    } else {
      // No filter - return all non-hidden (existing behavior using proper index)
      const newsletters = await ctx.db
        .query("userNewsletters")
        .withIndex("by_userId_receivedAt", (q) => q.eq("userId", user._id))
        .order("desc")
        .collect()

      // Story 3.5 AC2: Exclude hidden newsletters
      visibleNewsletters = newsletters.filter((n) => !n.isHidden)
    }

    // Story 5.2: Derive hasSummary for each newsletter
    // Code review fix: Batch-fetch contentIds to avoid N+1 queries
    const contentIds = visibleNewsletters
      .filter((n) => !n.isPrivate && n.contentId && !n.summary)
      .map((n) => n.contentId!)

    const uniqueContentIds = [...new Set(contentIds)]
    const contents = await Promise.all(uniqueContentIds.map((id) => ctx.db.get(id)))
    const contentMap = new Map(
      contents
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .map((c) => [c._id, c])
    )

    // Privacy pattern: check personal summary first, then shared if public (O(1) lookup)
    // Story 9.10: Include source field for unified folder view display
    const enrichedNewsletters = visibleNewsletters.map((newsletter) => {
      let hasSummary = Boolean(newsletter.summary)

      if (!hasSummary && !newsletter.isPrivate && newsletter.contentId) {
        const content = contentMap.get(newsletter.contentId)
        hasSummary = Boolean(content?.summary)
      }

      return { ...newsletter, hasSummary, source: newsletter.source }
    })

    return enrichedNewsletters
  },
})

/**
 * List newsletters filtered by folder (all senders in that folder)
 * Story 3.3: AC3 - Browse newsletters by folder
 * Story 3.5: AC2 - Exclude hidden newsletters from main list
 * Story 5.2: Task 1.1 - Added hasSummary field for summary indicator
 * Story 9.10: Added source field for unified folder view display
 *
 * - If folderId is null, returns newsletters from "uncategorized" senders
 *   (senders with no folder assignment)
 * - If folderId is undefined/not provided, returns empty array
 *   (use listUserNewslettersBySender for unfiltered list)
 */
export const listUserNewslettersByFolder = query({
  args: {
    folderId: v.optional(v.union(v.id("folders"), v.null())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    // If no folderId provided, return empty - caller should use different query
    if (args.folderId === undefined) return []

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()

    if (!user) return []

    // Get senders matching the folder filter
    const allSettings = await ctx.db
      .query("userSenderSettings")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()

    const matchingSenderIds = allSettings
      .filter((s) => {
        if (args.folderId === null) {
          // "Uncategorized" - senders with no folder
          return s.folderId === undefined
        }
        return s.folderId === args.folderId
      })
      .map((s) => s.senderId)

    // Get newsletters from matching senders
    const newsletters = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId_receivedAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect()

    // Filter to only newsletters from matching senders AND exclude hidden (Story 3.5 AC2)
    const filteredNewsletters = newsletters.filter(
      (n) => matchingSenderIds.includes(n.senderId) && !n.isHidden
    )

    // Batch-fetch all unique senders to avoid N+1 queries
    const uniqueSenderIds = [...new Set(filteredNewsletters.map((n) => n.senderId))]
    const senders = await Promise.all(uniqueSenderIds.map((id) => ctx.db.get(id)))
    const senderMap = new Map(
      senders
        .filter((s): s is NonNullable<typeof s> => s !== null)
        .map((s) => [s._id, s])
    )

    // Story 5.2: Batch-fetch contentIds to avoid N+1 queries (code review fix)
    const contentIds = filteredNewsletters
      .filter((n) => !n.isPrivate && n.contentId && !n.summary)
      .map((n) => n.contentId!)

    const uniqueContentIds = [...new Set(contentIds)]
    const contents = await Promise.all(uniqueContentIds.map((id) => ctx.db.get(id)))
    const contentMap = new Map(
      contents
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .map((c) => [c._id, c])
    )

    // Derive hasSummary for each newsletter and enrich with sender info (O(1) lookups)
    // Story 9.10: Include source field for unified folder view display
    const enrichedNewsletters = filteredNewsletters.map((newsletter) => {
      const sender = senderMap.get(newsletter.senderId)

      let hasSummary = Boolean(newsletter.summary)
      if (!hasSummary && !newsletter.isPrivate && newsletter.contentId) {
        const content = contentMap.get(newsletter.contentId)
        hasSummary = Boolean(content?.summary)
      }

      return {
        ...newsletter,
        senderDisplayName: sender?.name || sender?.email || newsletter.senderEmail,
        hasSummary,
        source: newsletter.source,
      }
    })

    return enrichedNewsletters
  },
})

/**
 * Mark userNewsletter as read
 * Story 2.5.1: Updated for userNewsletters table
 */
export const markAsRead = internalMutation({
  args: {
    userNewsletterId: v.id("userNewsletters"),
    readProgress: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userNewsletterId, {
      isRead: true,
      readProgress: args.readProgress ?? 100,
    })
  },
})

/**
 * Update read progress for userNewsletter
 * Story 2.5.1: Updated for userNewsletters table
 */
export const updateReadProgress = internalMutation({
  args: {
    userNewsletterId: v.id("userNewsletters"),
    readProgress: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userNewsletterId, {
      readProgress: args.readProgress,
      isRead: args.readProgress >= 100,
    })
  },
})

/**
 * Toggle hide status for userNewsletter
 * Story 2.5.1: Updated for userNewsletters table
 */
export const toggleHidden = internalMutation({
  args: {
    userNewsletterId: v.id("userNewsletters"),
    isHidden: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userNewsletterId, {
      isHidden: args.isHidden,
    })
  },
})

/**
 * Mark newsletter as read (public mutation)
 * Story 3.4: AC3, AC4 - Manual/auto mark as read
 */
export const markNewsletterRead = mutation({
  args: {
    userNewsletterId: v.id("userNewsletters"),
    readProgress: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Not authenticated" })
    }

    const userNewsletter = await ctx.db.get(args.userNewsletterId)
    if (!userNewsletter) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Newsletter not found" })
    }

    // Get user for ownership check
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()

    if (!user || userNewsletter.userId !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" })
    }

    await ctx.db.patch(args.userNewsletterId, {
      isRead: true,
      readProgress: args.readProgress ?? 100,
    })
  },
})

/**
 * Mark newsletter as unread (public mutation)
 * Story 3.4: AC4 - Mark as unread functionality
 */
export const markNewsletterUnread = mutation({
  args: {
    userNewsletterId: v.id("userNewsletters"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Not authenticated" })
    }

    const userNewsletter = await ctx.db.get(args.userNewsletterId)
    if (!userNewsletter) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Newsletter not found" })
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()

    if (!user || userNewsletter.userId !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" })
    }

    await ctx.db.patch(args.userNewsletterId, {
      isRead: false,
      // Keep readProgress for "resume reading" feature
    })
  },
})

/**
 * Update reading progress (public mutation)
 * Story 3.4: AC1, AC3 - Scroll tracking with auto-mark as read at 100%
 */
export const updateNewsletterReadProgress = mutation({
  args: {
    userNewsletterId: v.id("userNewsletters"),
    readProgress: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Not authenticated" })
    }

    const userNewsletter = await ctx.db.get(args.userNewsletterId)
    if (!userNewsletter) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Newsletter not found" })
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()

    if (!user || userNewsletter.userId !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" })
    }

    // Clamp progress to 0-100
    const clampedProgress = Math.max(0, Math.min(100, args.readProgress))

    await ctx.db.patch(args.userNewsletterId, {
      readProgress: clampedProgress,
      isRead: clampedProgress >= 100,
    })
  },
})

/**
 * Hide newsletter (public mutation)
 * Story 3.5: AC1 - Hide from list/detail view
 */
export const hideNewsletter = mutation({
  args: {
    userNewsletterId: v.id("userNewsletters"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Not authenticated" })
    }

    const userNewsletter = await ctx.db.get(args.userNewsletterId)
    if (!userNewsletter) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Newsletter not found" })
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()

    if (!user || userNewsletter.userId !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" })
    }

    await ctx.db.patch(args.userNewsletterId, {
      isHidden: true,
    })
  },
})

/**
 * Unhide newsletter (public mutation)
 * Story 3.5: AC4 - Restore from hidden
 */
export const unhideNewsletter = mutation({
  args: {
    userNewsletterId: v.id("userNewsletters"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Not authenticated" })
    }

    const userNewsletter = await ctx.db.get(args.userNewsletterId)
    if (!userNewsletter) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Newsletter not found" })
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()

    if (!user || userNewsletter.userId !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" })
    }

    await ctx.db.patch(args.userNewsletterId, {
      isHidden: false,
    })
  },
})

/**
 * Set favorite status for a newsletter.
 * Favorites are user-scoped and can coexist with hidden/news read state.
 */
export const setNewsletterFavorite = mutation({
  args: {
    userNewsletterId: v.id("userNewsletters"),
    isFavorited: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Not authenticated" })
    }

    const userNewsletter = await ctx.db.get(args.userNewsletterId)
    if (!userNewsletter) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Newsletter not found" })
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()

    if (!user || userNewsletter.userId !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" })
    }

    await ctx.db.patch(args.userNewsletterId, {
      isFavorited: args.isFavorited,
    })
  },
})

/**
 * List favorited newsletters for current user.
 * Returns only non-hidden favorites sorted by newest first.
 */
export const listFavoritedNewsletters = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()

    if (!user) return []

    const favoritedNewsletters = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId_isFavorited_isHidden_receivedAt", (q) =>
        q.eq("userId", user._id).eq("isFavorited", true).eq("isHidden", false)
      )
      .order("desc")
      .collect()

    const folders = await ctx.db
      .query("folders")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()
    const hiddenFolderIds = new Set(
      folders.filter((folder) => folder.isHidden).map((folder) => folder._id)
    )
    const visibleFavorites = favoritedNewsletters.filter(
      (newsletter) =>
        !newsletter.folderId || !hiddenFolderIds.has(newsletter.folderId)
    )

    const contentIds = visibleFavorites
      .filter((n) => !n.isPrivate && n.contentId && !n.summary)
      .map((n) => n.contentId!)

    const uniqueContentIds = [...new Set(contentIds)]
    const contents = await Promise.all(uniqueContentIds.map((id) => ctx.db.get(id)))
    const contentMap = new Map(
      contents
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .map((c) => [c._id, c])
    )

    const enrichedNewsletters = visibleFavorites.map((newsletter) => {
      let hasSummary = Boolean(newsletter.summary)

      if (!hasSummary && !newsletter.isPrivate && newsletter.contentId) {
        const content = contentMap.get(newsletter.contentId)
        hasSummary = Boolean(content?.summary)
      }

      return { ...newsletter, hasSummary, source: newsletter.source }
    })

    return enrichedNewsletters
  },
})

/**
 * List hidden newsletters for current user
 * Story 3.5: AC3 - View hidden newsletters
 * Story 5.2: Task 1.1 - Added hasSummary field for summary indicator
 * Story 9.10: Added source field for unified folder view display
 */
export const listHiddenNewsletters = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()

    if (!user) return []

    const newsletters = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId_receivedAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect()

    // Return ONLY hidden newsletters
    const hiddenNewsletters = newsletters.filter((n) => n.isHidden)

    // Story 5.2: Derive hasSummary for each newsletter
    // Code review fix: Batch-fetch contentIds to avoid N+1 queries
    const contentIds = hiddenNewsletters
      .filter((n) => !n.isPrivate && n.contentId && !n.summary)
      .map((n) => n.contentId!)

    const uniqueContentIds = [...new Set(contentIds)]
    const contents = await Promise.all(uniqueContentIds.map((id) => ctx.db.get(id)))
    const contentMap = new Map(
      contents
        .filter((c): c is NonNullable<typeof c> => c !== null)
        .map((c) => [c._id, c])
    )

    // Privacy pattern: check personal summary first, then shared if public (O(1) lookup)
    // Story 9.10: Include source field for unified folder view display
    const enrichedNewsletters = hiddenNewsletters.map((newsletter) => {
      let hasSummary = Boolean(newsletter.summary)

      if (!hasSummary && !newsletter.isPrivate && newsletter.contentId) {
        const content = contentMap.get(newsletter.contentId)
        hasSummary = Boolean(content?.summary)
      }

      return { ...newsletter, hasSummary, source: newsletter.source }
    })

    return enrichedNewsletters
  },
})

// ============================================================
// Story 9.4: Folder-Centric Navigation Queries
// ============================================================

/**
 * Get count of hidden newsletters
 * Story 9.4: AC3 - Hidden section shows count of hidden newsletters
 *
 * Returns the count of all newsletters with isHidden === true for the current user.
 * Used by FolderSidebar to show hidden newsletter count in the "Hidden" section.
 *
 * Note: This counts hidden NEWSLETTERS, not hidden folders.
 * Hidden folders are excluded from the sidebar entirely.
 */
export const getHiddenNewsletterCount = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return 0

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()

    if (!user) return 0

    // Count hidden newsletters
    const hiddenNewsletters = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("isHidden"), true))
      .collect()

    return hiddenNewsletters.length
  },
})

// ============================================================
// Story 6.4: Empty State Detection
// ============================================================

/**
 * Check if user has any newsletters
 * Story 6.4 Task 4.1 - For empty state detection
 *
 * Returns true if user has at least one newsletter in userNewsletters.
 * Used to determine if we should show "Discover" CTA for new users.
 */
export const hasAnyNewsletters = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return false

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()
    if (!user) return false

    const firstNewsletter = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first()

    return firstNewsletter !== null
  },
})

// ============================================================
// Story 9.10: Delete Newsletter with Community Import Support
// ============================================================

/**
 * Delete a user newsletter from their collection
 * Story 9.10 Task 4: Handle community import decrement
 *
 * For community imports (source === "community"):
 * - Decrements importCount on newsletterContent
 * - Does NOT delete the newsletterContent record (other users may have it)
 *
 * For private sources (email, gmail, manual):
 * - Simply removes the userNewsletter record
 * - R2 content cleanup is handled separately (not in this mutation)
 */
export const deleteUserNewsletter = mutation({
  args: { userNewsletterId: v.id("userNewsletters") },
  handler: async (ctx, args) => {
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

    const userNewsletter = await ctx.db.get(args.userNewsletterId)

    if (!userNewsletter) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Newsletter not found" })
    }

    // Verify ownership
    if (userNewsletter.userId !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Not your newsletter" })
    }

    // Story 9.10: Handle community import decrement
    if (userNewsletter.source === "community" && userNewsletter.contentId) {
      const content = await ctx.db.get(userNewsletter.contentId)
      if (content) {
        // Story 9.10 (code review fix): Decrement importCount on community delete
        // Default to 1 for legacy content without explicit importCount
        // Math.max(0, ...) ensures we never go negative
        const newImportCount = Math.max(0, (content.importCount ?? 1) - 1)
        await ctx.db.patch(userNewsletter.contentId, {
          importCount: newImportCount,
          // Note: Do NOT decrement readerCount - that's set once on first read
        })
      }
      // Note: We do NOT delete newsletterContent - other users may have it
    }

    // For private newsletters, we could optionally delete R2 content
    // But for safety, we just remove the reference (R2 cleanup can be a separate process)

    // Delete the userNewsletter record
    await ctx.db.delete(args.userNewsletterId)

    return { deleted: true }
  },
})
