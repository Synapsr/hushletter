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
 * Get sender by email (internal)
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
 * Get sender by email (public query with auth)
 * Story 6.3: Task 2.3 - Sender detail view needs sender info
 *
 * Returns sender details for the sender detail page.
 * Only exposes public sender info: email, name, domain, subscriberCount, newsletterCount.
 *
 * SECURITY NOTE: Requires authentication but sender data is public.
 * Senders are a global registry for community discovery features (Epic 6).
 */
export const getSenderByEmailPublic = query({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    // Auth check - must be logged in to view sender details
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const sender = await ctx.db
      .query("senders")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first()

    if (!sender) return null

    return {
      _id: sender._id,
      email: sender.email,
      name: sender.name,
      displayName: sender.name || sender.email,
      domain: sender.domain,
      subscriberCount: sender.subscriberCount,
      newsletterCount: sender.newsletterCount,
    }
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
 * Story 3.5: AC2 - Exclude hidden newsletters from unread counts
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

        // Story 3.5 AC2: Exclude hidden newsletters from counts
        const visibleNewsletters = newsletters.filter((n) => !n.isHidden)
        const unreadCount = visibleNewsletters.filter((n) => !n.isRead).length

        return {
          _id: sender._id,
          email: sender.email,
          name: sender.name,
          displayName: sender.name || sender.email,
          domain: sender.domain,
          userNewsletterCount: visibleNewsletters.length, // Only count non-hidden
          unreadCount, // Unread (and non-hidden) newsletters from this sender
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

// ============================================================
// Story 6.4: Follow Sender & Domain Filter Features
// ============================================================

/**
 * List senders the user follows (including those without newsletters)
 * Story 6.4 Task 1.4
 *
 * Returns all senders where the user has a userSenderSettings record,
 * along with information about whether they have newsletters from that sender.
 * This allows the senders page to show "followed" senders even if the user
 * hasn't received any newsletters from them yet.
 */
export const listFollowedSenders = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()
    if (!user) return []

    // Get all user's sender settings (follows + active subscriptions)
    const allSettings = await ctx.db
      .query("userSenderSettings")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()

    // For each setting, check if user has newsletters from that sender
    const results = await Promise.all(
      allSettings.map(async (settings) => {
        const sender = await ctx.db.get(settings.senderId)
        if (!sender) return null

        const hasNewsletters = await ctx.db
          .query("userNewsletters")
          .withIndex("by_userId_senderId", (q) =>
            q.eq("userId", user._id).eq("senderId", settings.senderId)
          )
          .first()

        return {
          senderId: sender._id,
          email: sender.email,
          name: sender.name,
          displayName: sender.name || sender.email,
          domain: sender.domain,
          subscriberCount: sender.subscriberCount,
          newsletterCount: sender.newsletterCount,
          isPrivate: settings.isPrivate,
          hasNewsletters: hasNewsletters !== null,
          folderId: settings.folderId,
        }
      })
    )

    return results.filter((r): r is NonNullable<typeof r> => r !== null)
  },
})

// ============================================================
// Story 9.2 + 9.3: Folder Auto-Creation for Senders
// ============================================================

/**
 * Maximum folder name length
 * Story 9.3: Task 5.2 - Truncate long sender names
 *
 * Rationale: 100 characters balances UI display constraints (most folder names
 * fit in sidebars without truncation) while allowing descriptive names.
 * This matches common filesystem limits and prevents excessively long names
 * from breaking layouts.
 */
export const MAX_FOLDER_NAME_LENGTH = 100

/**
 * Default folder name when all other derivation attempts fail
 * Story 9.3 Code Review: Explicit fallback prevents empty folder names
 */
export const DEFAULT_FOLDER_NAME = "Unnamed Folder"

/**
 * Sanitize folder name by removing problematic characters
 * Story 9.3: Task 5.3 - Handle special characters in sender names
 *
 * Exported for unit testing (Story 9.3 Code Review Fix).
 *
 * @param name Raw name from sender
 * @returns Sanitized name safe for folder display (may be empty if input is all control chars)
 */
export function sanitizeFolderName(name: string): string {
  return (
    name
      .trim()
      // Remove newlines and tabs
      .replace(/[\r\n\t]/g, " ")
      // Collapse multiple whitespace into single space
      .replace(/\s+/g, " ")
      // Remove control characters (ASCII 0-31 except space)
      .replace(/[\x00-\x1F]/g, "")
      // Truncate to max length
      .slice(0, MAX_FOLDER_NAME_LENGTH)
      .trim()
  )
}

/**
 * Make a unique folder name by appending counter if needed
 * Story 9.3: Task 1.6 - Handle duplicate folder names
 *
 * Exported for unit testing (Story 9.3 Code Review Fix).
 *
 * @param baseName Desired folder name
 * @param existingFolders List of existing folders for the user
 * @returns Unique folder name (e.g., "Morning Brew" or "Morning Brew 2")
 */
export function makeUniqueFolderName(
  baseName: string,
  existingFolders: { name: string }[]
): string {
  const existingNames = new Set(
    existingFolders.map((f) => f.name.toLowerCase())
  )

  // If base name is unique, use it
  if (!existingNames.has(baseName.toLowerCase())) {
    return baseName
  }

  // Append counter until we find a unique name
  let counter = 2
  while (existingNames.has(`${baseName} ${counter}`.toLowerCase())) {
    counter++
  }
  return `${baseName} ${counter}`
}

/**
 * Get or create a folder for a sender
 * Story 9.2: Task 3.2, 4.3, 5.3 - Folder resolution for ingestion paths
 * Story 9.3: Enhanced with edge case handling
 *
 * Every ingestion path needs to resolve a folder for the sender:
 * 1. Check if userSenderSettings exists with folderId
 * 2. If folderId exists, return it (fast path)
 * 3. If not, derive folder name from sender info
 * 4. Sanitize and handle duplicate names
 * 5. Create new folder
 * 6. Update/create userSenderSettings with the new folderId
 *
 * Edge Cases (Story 9.3):
 * - Sender with only email (no name): Uses email as folder name
 * - Long sender names: Truncated to 100 characters
 * - Special characters: Sanitized for safe display
 * - Duplicate folder names: Counter appended (e.g., "Morning Brew 2")
 * - Race conditions: Protected with duplicate detection and cleanup
 *
 * RACE CONDITION PROTECTION: If concurrent requests create duplicate settings,
 * we detect and clean up duplicates, keeping the oldest record. subscriberCount
 * is only incremented if we successfully created a new unique relationship.
 */
export const getOrCreateFolderForSender = internalMutation({
  args: {
    userId: v.id("users"),
    senderId: v.id("senders"),
  },
  handler: async (ctx, args) => {
    // Step 1: Check if userSenderSettings exists with folderId (fast path)
    const settings = await ctx.db
      .query("userSenderSettings")
      .withIndex("by_userId_senderId", (q) =>
        q.eq("userId", args.userId).eq("senderId", args.senderId)
      )
      .first()

    if (settings?.folderId) {
      // Folder already assigned - return it immediately
      return settings.folderId
    }

    // Step 2: Get sender info for folder name
    const sender = await ctx.db.get(args.senderId)
    if (!sender) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Sender not found",
      })
    }

    // Step 3: Derive folder name with fallback (Story 9.3: Task 1.5, 5.1)
    // Prefer name, fallback to email, last resort "Unknown Sender"
    let baseName = sender.name || sender.email || "Unknown Sender"

    // Step 4: Sanitize folder name (Story 9.3: Task 5.2, 5.3)
    baseName = sanitizeFolderName(baseName)

    // Handle edge case where sanitization produces empty string
    // Story 9.3 Code Review Fix: Add explicit final fallback to prevent empty folder names
    if (baseName.length === 0) {
      baseName = sender.email || DEFAULT_FOLDER_NAME
      baseName = sanitizeFolderName(baseName)

      // Final safety check - if even email sanitizes to empty, use default
      if (baseName.length === 0) {
        baseName = DEFAULT_FOLDER_NAME
      }
    }

    // Step 5: Get existing folders to check for duplicates (Story 9.3: Task 1.6)
    const existingFolders = await ctx.db
      .query("folders")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect()

    // Make folder name unique by appending counter if needed
    const finalName = makeUniqueFolderName(baseName, existingFolders)

    // Step 6: Create folder for this sender
    const now = Date.now()
    const folderId = await ctx.db.insert("folders", {
      userId: args.userId,
      name: finalName,
      isHidden: false,
      createdAt: now,
      updatedAt: now,
    })

    // Step 7: Update or create userSenderSettings with folderId
    if (settings) {
      // Settings exists but no folderId - just update it
      await ctx.db.patch(settings._id, { folderId })
    } else {
      // Create new settings with folder assignment
      // Story 9.2: isPrivate is always true in private-by-default model
      await ctx.db.insert("userSenderSettings", {
        userId: args.userId,
        senderId: args.senderId,
        isPrivate: true, // Story 9.2: Always private in private-by-default model
        folderId,
      })

      // Race condition check: verify we didn't create a duplicate (Story 9.3: Task 5.4)
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
        for (const s of sortedSettings.slice(1)) {
          await ctx.db.delete(s._id)
        }

        console.log(
          `[senders] getOrCreateFolderForSender race condition resolved: ` +
            `kept settings ${keepSettings._id}, deleted ${sortedSettings.length - 1} duplicate(s)`
        )

        // If the kept settings has a different folderId, use that instead
        // (the winner of the race created the folder)
        if (keepSettings.folderId && keepSettings.folderId !== folderId) {
          // Delete our orphaned folder
          await ctx.db.delete(folderId)
          return keepSettings.folderId
        }

        // Update the kept settings with our folderId if it doesn't have one
        if (!keepSettings.folderId) {
          await ctx.db.patch(keepSettings._id, { folderId })
        }

        // Don't increment subscriberCount - we didn't create a new relationship
        console.log(
          `[senders] Created folder "${finalName}" (${folderId}) for sender ${args.senderId} (race resolved)`
        )
        return keepSettings.folderId ?? folderId
      }

      // We successfully created the only record - increment subscriber count
      await ctx.db.patch(args.senderId, {
        subscriberCount: sender.subscriberCount + 1,
      })
    }

    console.log(
      `[senders] Created folder "${finalName}" (${folderId}) for sender ${args.senderId}`
    )

    return folderId
  },
})

/**
 * List distinct domains from senders table for filter dropdown
 * Story 6.4 Task 3.1
 *
 * Returns unique domains sorted by total subscribers (most popular first).
 * Used for the domain filter dropdown in community browse.
 */
export const listDistinctDomains = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const limit = Math.min(args.limit ?? 50, 100)

    // Get senders sorted by subscriberCount (most popular domains first)
    const senders = await ctx.db
      .query("senders")
      .withIndex("by_subscriberCount")
      .order("desc")
      .take(500) // Scan for unique domains

    // Extract unique domains with counts
    const domainMap = new Map<string, number>()
    for (const sender of senders) {
      const current = domainMap.get(sender.domain) ?? 0
      domainMap.set(sender.domain, current + sender.subscriberCount)
    }

    // Sort by total subscribers and limit
    const domains = [...domainMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([domain, totalSubscribers]) => ({ domain, totalSubscribers }))

    return domains
  },
})
