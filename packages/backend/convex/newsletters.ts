import {
  internalAction,
  internalMutation,
  internalQuery,
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
 *
 * PUBLIC PATH (isPrivate=false):
 * 1. Normalize content (strip tracking, personalization)
 * 2. Compute SHA-256 hash of normalized content
 * 3. Check if newsletterContent exists with that hash
 * 4. If exists: reuse contentId, increment readerCount (skip R2 upload)
 * 5. If not: upload to R2 with hash-based key, create newsletterContent
 *
 * PRIVATE PATH (isPrivate=true):
 * - Bypass deduplication entirely
 * - Upload to user-specific R2 key
 * - Store privateR2Key on userNewsletter (no contentId)
 */
export const storeNewsletterContent = internalAction({
  args: {
    userId: v.id("users"),
    senderId: v.id("senders"),
    subject: v.string(),
    senderEmail: v.string(),
    senderName: v.optional(v.string()),
    receivedAt: v.number(),
    htmlContent: v.optional(v.string()),
    textContent: v.optional(v.string()),
    isPrivate: v.boolean(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    userNewsletterId: Id<"userNewsletters">
    r2Key: string
    deduplicated?: boolean
  }> => {
    console.log(
      `[newsletters] storeNewsletterContent called: user=${args.userId}, sender=${args.senderId}, ` +
        `subject="${args.subject.substring(0, 50)}...", isPrivate=${args.isPrivate}, ` +
        `htmlLen=${args.htmlContent?.length || 0}, textLen=${args.textContent?.length || 0}`
    )

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

    const contentType = args.htmlContent ? "text/html" : "text/plain"
    const ext = args.htmlContent ? "html" : "txt"

    let userNewsletterId: Id<"userNewsletters">
    let r2Key: string
    let deduplicated = false

    if (args.isPrivate) {
      // ========================================
      // PRIVATE PATH - bypass deduplication
      // ========================================
      const timestamp = Date.now()
      const randomId = crypto.randomUUID()
      r2Key = `private/${args.userId}/${timestamp}-${randomId}.${ext}`

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

      // Create userNewsletter with privateR2Key (no contentId)
      userNewsletterId = await ctx.runMutation(
        internal.newsletters.createUserNewsletter,
        {
          userId: args.userId,
          senderId: args.senderId,
          subject: args.subject,
          senderEmail: args.senderEmail,
          senderName: args.senderName,
          receivedAt: args.receivedAt,
          isPrivate: true,
          privateR2Key: r2Key,
        }
      )

      // Increment sender.newsletterCount after successful storage
      await ctx.runMutation(internal.senders.incrementNewsletterCount, {
        senderId: args.senderId,
      })

      console.log(
        `[newsletters] Private content stored (dedup bypassed): ${r2Key}, user=${args.userId}`
      )
    } else {
      // ========================================
      // PUBLIC PATH - with deduplication
      // ========================================

      // Step 1: Normalize content for consistent hashing
      // Use effectiveContent to ensure unique hash even for empty emails
      const normalized = normalizeForHash(effectiveContent)

      // Step 2: Compute SHA-256 hash of normalized content
      const contentHash = await computeContentHash(normalized)

      // Step 3: Check for existing content with this hash
      const existingContent = await ctx.runQuery(
        internal.newsletters.findByContentHash,
        { contentHash }
      )

      let contentId: Id<"newsletterContent">

      if (existingContent) {
        // ========================================
        // DEDUP HIT - reuse existing content
        // ========================================
        contentId = existingContent._id
        r2Key = existingContent.r2Key
        deduplicated = true

        // Increment readerCount (atomic)
        await ctx.runMutation(internal.newsletters.incrementReaderCount, {
          contentId,
        })

        console.log(
          `[newsletters] Dedup HIT: reusing content ${contentId}, hash=${contentHash.substring(0, 8)}...`
        )
      } else {
        // ========================================
        // DEDUP MISS - upload new content
        // ========================================

        // Use content-hash-based key for natural storage-level deduplication
        r2Key = `content/${contentHash}.${ext}`

        // Upload to R2 (use effectiveContent which has fallback for empty emails)
        try {
          console.log(`[newsletters] Uploading public content to R2: key=${r2Key}, size=${effectiveContent.length}`)
          const blob = new Blob([effectiveContent], {
            type: `${contentType}; charset=utf-8`,
          })
          await r2.store(ctx, blob, { key: r2Key, type: contentType })
          console.log(`[newsletters] R2 upload successful: ${r2Key}`)
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          console.error(
            `[newsletters] R2 upload failed for public content: key=${r2Key}, error=${errorMsg}`,
            error
          )
          throw new ConvexError({
            code: "R2_UPLOAD_FAILED",
            message: `Failed to store newsletter content in R2: ${errorMsg}`,
          })
        }

        // Create newsletterContent record with real hash
        contentId = await ctx.runMutation(
          internal.newsletters.createNewsletterContent,
          {
            contentHash,
            r2Key,
            subject: args.subject,
            senderEmail: args.senderEmail,
            senderName: args.senderName,
            receivedAt: args.receivedAt,
          }
        )

        console.log(
          `[newsletters] Dedup MISS: created content ${contentId}, hash=${contentHash.substring(0, 8)}...`
        )
      }

      // Create userNewsletter with contentId reference
      userNewsletterId = await ctx.runMutation(
        internal.newsletters.createUserNewsletter,
        {
          userId: args.userId,
          senderId: args.senderId,
          subject: args.subject,
          senderEmail: args.senderEmail,
          senderName: args.senderName,
          receivedAt: args.receivedAt,
          isPrivate: false,
          contentId,
        }
      )

      // Increment sender.newsletterCount after successful storage
      await ctx.runMutation(internal.senders.incrementNewsletterCount, {
        senderId: args.senderId,
      })
    }

    return { userNewsletterId, r2Key, deduplicated }
  },
})

/**
 * Create a new newsletterContent entry for shared public content
 * Story 2.5.1: New function for shared content schema
 * Story 2.5.2: Now requires contentHash (SHA-256 of normalized content)
 *
 * RACE CONDITION HANDLING: If another request created content with the same
 * hash between our lookup and this mutation, we detect it and return the
 * existing content instead of creating a duplicate.
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
 *
 * Note: Throws if content not found (consistent with incrementNewsletterCount
 * in senders.ts). A missing contentId indicates a bug in the calling code.
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
 */
export const createUserNewsletter = internalMutation({
  args: {
    userId: v.id("users"),
    senderId: v.id("senders"),
    subject: v.string(),
    senderEmail: v.string(),
    senderName: v.optional(v.string()),
    receivedAt: v.number(),
    isPrivate: v.boolean(),
    contentId: v.optional(v.id("newsletterContent")),
    privateR2Key: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userNewsletterId = await ctx.db.insert("userNewsletters", {
      userId: args.userId,
      senderId: args.senderId,
      contentId: args.contentId,
      privateR2Key: args.privateR2Key,
      subject: args.subject,
      senderEmail: args.senderEmail,
      senderName: args.senderName,
      receivedAt: args.receivedAt,
      isRead: false,
      isHidden: false,
      isPrivate: args.isPrivate,
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

    // Use by_userId_receivedAt index for proper sorting by receivedAt (AC2)
    // Convex index ordering: when using compound index, order applies to last indexed field
    return await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId_receivedAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect()
  },
})

/**
 * List user newsletters filtered by sender
 * Story 3.1: Task 5 - Support sender-based filtering (AC2, AC3)
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

    if (args.senderId) {
      // Filter by sender using composite index
      const newsletters = await ctx.db
        .query("userNewsletters")
        .withIndex("by_userId_senderId", (q) =>
          q.eq("userId", user._id).eq("senderId", args.senderId)
        )
        .collect()

      // Sort by receivedAt descending (newest first)
      return newsletters.sort((a, b) => b.receivedAt - a.receivedAt)
    }

    // No filter - return all (existing behavior using proper index)
    return await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId_receivedAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect()
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
