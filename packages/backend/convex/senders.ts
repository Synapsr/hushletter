import { internalMutation, internalQuery, query } from "./_generated/server"
import { v } from "convex/values"
import { ConvexError } from "convex/values"

/**
 * Get or create a global sender by email
 * Story 2.5.1: Task 4 - Global sender management
 * Story 2.5.2: No longer increments newsletterCount (done by storeNewsletterContent)
 *
 * Senders are now global (not per-user). This function:
 * 1. Checks if sender exists by email
 * 2. If exists, returns sender (optionally updates name)
 * 3. If not exists, creates sender with initial counts (subscriberCount=0, newsletterCount=0)
 *
 * NOTE: newsletterCount is incremented by storeNewsletterContent after successful
 * newsletter storage. This ensures counts are accurate even if storage fails.
 */
export const getOrCreateSender = internalMutation({
  args: {
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if sender already exists
    const existingSender = await ctx.db
      .query("senders")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first()

    if (existingSender) {
      // Update name if provided and not already set (don't increment counts here)
      if (args.name && !existingSender.name) {
        await ctx.db.patch(existingSender._id, { name: args.name })
        const updatedSender = await ctx.db.get(existingSender._id)
        if (!updatedSender) {
          throw new ConvexError({
            code: "INTERNAL_ERROR",
            message: "Failed to retrieve updated sender",
          })
        }
        return updatedSender
      }
      return existingSender
    }

    // Extract domain from email
    const domain = args.email.split("@")[1] || ""

    // Create new global sender with zero counts
    // Counts are incremented by other functions:
    // - newsletterCount: incremented by storeNewsletterContent after successful storage
    // - subscriberCount: incremented by getOrCreateUserSenderSettings when new relationship created
    const senderId = await ctx.db.insert("senders", {
      email: args.email,
      name: args.name,
      domain,
      subscriberCount: 0,
      newsletterCount: 0,
    })

    const sender = await ctx.db.get(senderId)
    if (!sender) {
      throw new ConvexError({
        code: "INTERNAL_ERROR",
        message: "Failed to create sender",
      })
    }

    return sender
  },
})

/**
 * Get or create user sender settings
 * Story 2.5.1: Task 4 - Per-user sender preferences
 *
 * User sender settings control:
 * - isPrivate: Whether this user's newsletters from this sender are private
 * - folderId: Optional folder for organization (Epic 3)
 *
 * Default behavior: isPrivate = false (public, enables community features)
 */
export const getOrCreateUserSenderSettings = internalMutation({
  args: {
    userId: v.id("users"),
    senderId: v.id("senders"),
  },
  handler: async (ctx, args) => {
    // Check if settings already exist
    const existingSettings = await ctx.db
      .query("userSenderSettings")
      .withIndex("by_userId_senderId", (q) =>
        q.eq("userId", args.userId).eq("senderId", args.senderId)
      )
      .first()

    if (existingSettings) {
      return existingSettings
    }

    // Create new user sender settings with defaults
    const settingsId = await ctx.db.insert("userSenderSettings", {
      userId: args.userId,
      senderId: args.senderId,
      isPrivate: false, // Default to public for community features
    })

    // Increment subscriber count for the sender (new user-sender relationship)
    const sender = await ctx.db.get(args.senderId)
    if (sender) {
      await ctx.db.patch(args.senderId, {
        subscriberCount: sender.subscriberCount + 1,
      })
    }

    const settings = await ctx.db.get(settingsId)
    if (!settings) {
      throw new ConvexError({
        code: "INTERNAL_ERROR",
        message: "Failed to create user sender settings",
      })
    }

    return settings
  },
})

/**
 * Get user sender settings for a specific sender
 * Story 2.5.1: Task 4 - Query user's privacy preference for a sender
 */
export const getUserSenderSettings = internalQuery({
  args: {
    userId: v.id("users"),
    senderId: v.id("senders"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userSenderSettings")
      .withIndex("by_userId_senderId", (q) =>
        q.eq("userId", args.userId).eq("senderId", args.senderId)
      )
      .first()
  },
})

/**
 * Update user sender settings (privacy toggle)
 * Story 2.5.1: Task 4 - Allow users to change privacy settings
 */
export const updateUserSenderSettings = internalMutation({
  args: {
    userId: v.id("users"),
    senderId: v.id("senders"),
    isPrivate: v.optional(v.boolean()),
    folderId: v.optional(v.id("folders")),
  },
  handler: async (ctx, args) => {
    const settings = await ctx.db
      .query("userSenderSettings")
      .withIndex("by_userId_senderId", (q) =>
        q.eq("userId", args.userId).eq("senderId", args.senderId)
      )
      .first()

    if (!settings) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User sender settings not found",
      })
    }

    await ctx.db.patch(settings._id, {
      ...(args.isPrivate !== undefined ? { isPrivate: args.isPrivate } : {}),
      ...(args.folderId !== undefined ? { folderId: args.folderId } : {}),
    })

    return await ctx.db.get(settings._id)
  },
})

/**
 * Get sender by email
 * Story 2.5.1: Task 4 - Lookup sender for global registry
 */
export const getSenderByEmail = internalQuery({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("senders")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first()
  },
})

/**
 * List all senders (for admin/discovery features)
 * Story 2.5.1: Query for sender discovery
 */
export const listSenders = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50

    return await ctx.db
      .query("senders")
      .withIndex("by_subscriberCount")
      .order("desc")
      .take(limit)
  },
})

/**
 * List user's sender settings (all senders the user has received from)
 * Story 2.5.1: Query for user's sender list with privacy settings
 */
export const listUserSenderSettings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()

    if (!user) return []

    const settings = await ctx.db
      .query("userSenderSettings")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()

    // Enrich with sender details
    const enrichedSettings = await Promise.all(
      settings.map(async (setting) => {
        const sender = await ctx.db.get(setting.senderId)
        return {
          ...setting,
          sender,
        }
      })
    )

    return enrichedSettings
  },
})

/**
 * Increment newsletter count for a sender
 * Story 2.5.1: Standalone increment for special cases
 *
 * NOTE: For normal email ingestion, use getOrCreateSender which handles
 * incrementing automatically. This function is provided for:
 * - Batch import operations (Epic 4: Gmail Import)
 * - Manual count corrections
 * - Future deduplication scenarios (Story 2.5.2) where content is linked
 *   to existing newsletterContent without going through getOrCreateSender
 */
export const incrementNewsletterCount = internalMutation({
  args: {
    senderId: v.id("senders"),
  },
  handler: async (ctx, args) => {
    const sender = await ctx.db.get(args.senderId)
    if (!sender) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Sender not found",
      })
    }

    await ctx.db.patch(args.senderId, {
      newsletterCount: sender.newsletterCount + 1,
    })
  },
})
