import { internalMutation, internalQuery, mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { ConvexError } from "convex/values"

/**
 * Get or create a global sender by email
 * Story 2.5.1: Task 4 - Global sender management
 * Story 2.5.2: No longer increments newsletterCount (done by storeNewsletterContent)
 * Story 2.3: Added race condition protection
 *
 * Senders are now global (not per-user). This function:
 * 1. Checks if sender exists by email
 * 2. If exists, returns sender (optionally updates name)
 * 3. If not exists, creates sender with initial counts (subscriberCount=0, newsletterCount=0)
 *
 * NOTE: newsletterCount is incremented by storeNewsletterContent after successful
 * newsletter storage. This ensures counts are accurate even if storage fails.
 *
 * RACE CONDITION PROTECTION: If concurrent requests create duplicate senders,
 * we detect and clean up duplicates, keeping the oldest record.
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

    // Create new global sender
    // - subscriberCount: starts at 0, incremented by getOrCreateUserSenderSettings when user-sender relationship created
    // - newsletterCount: starts at 0, incremented by storeNewsletterContent after successful storage
    const senderId = await ctx.db.insert("senders", {
      email: args.email,
      name: args.name,
      domain,
      subscriberCount: 0,
      newsletterCount: 0,
    })

    // Race condition check: verify we didn't create a duplicate
    const allSenders = await ctx.db
      .query("senders")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .collect()

    if (allSenders.length > 1) {
      // Race condition detected - keep the oldest record (by creation time)
      const sortedSenders = [...allSenders].sort(
        (a, b) => a._creationTime - b._creationTime
      )
      const keepSender = sortedSenders[0]

      // Delete any duplicates (including ours if we lost the race)
      for (const sender of sortedSenders.slice(1)) {
        await ctx.db.delete(sender._id)
      }

      console.log(
        `[senders] Race condition resolved: kept sender ${keepSender._id}, deleted ${sortedSenders.length - 1} duplicate(s)`
      )
      return keepSender
    }

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
 * Story 2.3: Added race condition protection
 *
 * User sender settings control:
 * - isPrivate: Whether this user's newsletters from this sender are private
 * - folderId: Optional folder for organization (Epic 3)
 *
 * Default behavior: isPrivate = false (public, enables community features)
 *
 * RACE CONDITION PROTECTION: If concurrent requests create duplicate settings,
 * we detect and clean up duplicates, keeping the oldest record. subscriberCount
 * is only incremented if we successfully created a new unique relationship.
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

    // Race condition check: verify we didn't create a duplicate
    const allSettings = await ctx.db
      .query("userSenderSettings")
      .withIndex("by_userId_senderId", (q) =>
        q.eq("userId", args.userId).eq("senderId", args.senderId)
      )
      .collect()

    if (allSettings.length > 1) {
      // Race condition detected - keep the oldest record (by creation time)
      const sortedSettings = [...allSettings].sort(
        (a, b) => a._creationTime - b._creationTime
      )
      const keepSettings = sortedSettings[0]

      // Delete any duplicates (including ours if we lost the race)
      for (const settings of sortedSettings.slice(1)) {
        await ctx.db.delete(settings._id)
      }

      console.log(
        `[senders] Race condition resolved: kept userSenderSettings ${keepSettings._id}, deleted ${sortedSettings.length - 1} duplicate(s)`
      )

      // Don't increment subscriberCount - we didn't create a new relationship
      return keepSettings
    }

    // We successfully created the only record - increment subscriber count
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
 * Get sender by ID with display information
 * Story 2.3: Task 4 - Sender display information (AC4)
 *
 * Returns sender details including displayName (name if available, otherwise email)
 * Used by UI to show sender information.
 *
 * SECURITY NOTE: This query is intentionally public (no auth required).
 * Senders are a global registry to enable community discovery features (Epic 6)
 * where users can browse newsletters they haven't personally received.
 *
 * CONSIDERATIONS:
 * - Sender IDs are not enumerable (requires knowledge of valid ID)
 * - Only exposes: email, name, domain, subscriberCount, newsletterCount
 * - Does NOT expose: individual subscriber identities or private content
 * - Rate limiting should be applied at the HTTP layer if abuse is detected
 */
export const getSenderById = query({
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

    return {
      ...sender,
      displayName: sender.name || sender.email,
    }
  },
})

/**
 * List all senders the current user has received newsletters from
 * Story 2.3: Task 4 - Sender query functions (AC4)
 *
 * Returns senders with:
 * - displayName (name or email fallback)
 * - Global counts (subscriberCount, newsletterCount)
 * - Per-user counts (userNewsletterCount)
 * - User-specific settings (isPrivate, folderId)
 *
 * Performance: Uses by_userId_senderId composite index for efficient
 * per-user sender newsletter counts without scanning all users' data.
 */
export const listSendersForUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()

    if (!user) return []

    // Get all userSenderSettings for this user
    const userSettings = await ctx.db
      .query("userSenderSettings")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()

    // For each setting, get the sender and count newsletters using composite index
    const sendersWithCounts = await Promise.all(
      userSettings.map(async (setting) => {
        const sender = await ctx.db.get(setting.senderId)
        if (!sender) return null

        // Count newsletters from this sender for this user using composite index
        // by_userId_senderId allows efficient query for (userId, senderId) without scanning
        const newsletters = await ctx.db
          .query("userNewsletters")
          .withIndex("by_userId_senderId", (q) =>
            q.eq("userId", user._id).eq("senderId", setting.senderId)
          )
          .collect()

        return {
          _id: sender._id,
          email: sender.email,
          name: sender.name,
          displayName: sender.name || sender.email,
          domain: sender.domain,
          subscriberCount: sender.subscriberCount,
          newsletterCount: sender.newsletterCount,
          userNewsletterCount: newsletters.length,
          isPrivate: setting.isPrivate,
          folderId: setting.folderId,
        }
      })
    )

    return sendersWithCounts.filter(
      (s): s is NonNullable<typeof s> => s !== null
    )
  },
})

/**
 * Update user sender settings (public mutation with auth)
 * Story 2.3: Task 4 - Allow users to change privacy/folder settings
 *
 * This is the public version that handles authentication.
 * Validates folder ownership to prevent cross-user data access.
 */
export const updateSenderSettings = mutation({
  args: {
    senderId: v.id("senders"),
    isPrivate: v.optional(v.boolean()),
    folderId: v.optional(v.id("folders")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      })
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()

    if (!user) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      })
    }

    const settings = await ctx.db
      .query("userSenderSettings")
      .withIndex("by_userId_senderId", (q) =>
        q.eq("userId", user._id).eq("senderId", args.senderId)
      )
      .first()

    if (!settings) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Sender settings not found",
      })
    }

    // Validate folder ownership if folderId is provided
    if (args.folderId !== undefined) {
      const folder = await ctx.db.get(args.folderId)
      if (!folder) {
        throw new ConvexError({
          code: "NOT_FOUND",
          message: "Folder not found",
        })
      }
      if (folder.userId !== user._id) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Folder does not belong to user",
        })
      }
    }

    // Update only provided fields
    await ctx.db.patch(settings._id, {
      ...(args.isPrivate !== undefined ? { isPrivate: args.isPrivate } : {}),
      ...(args.folderId !== undefined ? { folderId: args.folderId } : {}),
    })
    return settings._id
  },
})

/**
 * List senders for user with unread counts
 * Story 3.1: Task 7 - Enhanced sender list with unread indicators (AC1)
 *
 * Returns senders sorted alphabetically with:
 * - displayName (name or email fallback)
 * - Per-user counts (userNewsletterCount, unreadCount)
 * - User-specific settings (isPrivate, folderId)
 *
 * Performance: Uses by_userId_senderId composite index for efficient queries.
 */
export const listSendersForUserWithUnreadCounts = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()

    if (!user) return []

    // Get all userSenderSettings for this user
    const userSettings = await ctx.db
      .query("userSenderSettings")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()

    // For each setting, get sender and counts
    const sendersWithCounts = await Promise.all(
      userSettings.map(async (setting) => {
        const sender = await ctx.db.get(setting.senderId)
        if (!sender) return null

        // Get newsletters from this sender for this user using composite index
        const newsletters = await ctx.db
          .query("userNewsletters")
          .withIndex("by_userId_senderId", (q) =>
            q.eq("userId", user._id).eq("senderId", setting.senderId)
          )
          .collect()

        const unreadCount = newsletters.filter((n) => !n.isRead).length

        return {
          _id: sender._id,
          email: sender.email,
          name: sender.name,
          displayName: sender.name || sender.email,
          domain: sender.domain,
          userNewsletterCount: newsletters.length,
          unreadCount, // Unread newsletters from this sender
          isPrivate: setting.isPrivate,
          folderId: setting.folderId,
        }
      })
    )

    return sendersWithCounts
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => a.displayName.localeCompare(b.displayName)) // Sort alphabetically
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
