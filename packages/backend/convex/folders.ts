import { mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { ConvexError } from "convex/values"

/**
 * Create a new folder for organizing senders
 * Story 2.5.1: Folder CRUD for Epic 3 (basic structure created now)
 */
export const createFolder = mutation({
  args: {
    name: v.string(),
    color: v.optional(v.string()),
  },
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

    // Check for duplicate folder name
    const existingFolder = await ctx.db
      .query("folders")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("name"), args.name))
      .first()

    if (existingFolder) {
      throw new ConvexError({
        code: "DUPLICATE",
        message: "A folder with this name already exists",
      })
    }

    const now = Date.now()
    const folderId = await ctx.db.insert("folders", {
      userId: user._id,
      name: args.name,
      color: args.color,
      isHidden: false, // Story 9.1: New folders are visible by default
      createdAt: now,
      updatedAt: now, // Story 9.1: Track folder modification time
    })

    return folderId
  },
})

/**
 * List all folders for the current user
 * Story 2.5.1: Basic folder listing
 */
export const listFolders = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()

    if (!user) return []

    return await ctx.db
      .query("folders")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()
  },
})

/**
 * Update a folder
 * Story 2.5.1: Basic folder update
 */
export const updateFolder = mutation({
  args: {
    folderId: v.id("folders"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
    isHidden: v.optional(v.boolean()), // Story 9.1: Allow toggling folder visibility
  },
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

    const folder = await ctx.db.get(args.folderId)
    if (!folder) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Folder not found" })
    }

    // Verify ownership
    if (folder.userId !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" })
    }

    // Check for duplicate name if changing name
    if (args.name && args.name !== folder.name) {
      const existingFolder = await ctx.db
        .query("folders")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .filter((q) => q.eq(q.field("name"), args.name))
        .first()

      if (existingFolder) {
        throw new ConvexError({
          code: "DUPLICATE",
          message: "A folder with this name already exists",
        })
      }
    }

    await ctx.db.patch(args.folderId, {
      ...(args.name !== undefined ? { name: args.name } : {}),
      ...(args.color !== undefined ? { color: args.color } : {}),
      ...(args.isHidden !== undefined ? { isHidden: args.isHidden } : {}),
      updatedAt: Date.now(), // Story 9.1: Track folder modification time
    })

    return await ctx.db.get(args.folderId)
  },
})

/**
 * Delete a folder
 * Story 2.5.1: Basic folder deletion
 * Note: This will unset folderId on any userSenderSettings that reference this folder
 */
/**
 * List folders for current user with unread newsletter counts
 * Story 3.3: AC4 - Folders with unread counts in sidebar
 *
 * Returns folders enriched with:
 * - newsletterCount: total newsletters from senders in folder
 * - unreadCount: unread newsletters from senders in folder
 * - senderCount: number of senders assigned to folder
 *
 * Performance: Uses batch fetching to avoid N+1 query problem.
 * Fetches all user data once, then computes counts in memory.
 */
export const listFoldersWithUnreadCounts = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()

    if (!user) return []

    // Fetch all required data upfront to avoid N+1 queries
    const [folders, allSettings, allNewsletters] = await Promise.all([
      ctx.db
        .query("folders")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect(),
      ctx.db
        .query("userSenderSettings")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect(),
      ctx.db
        .query("userNewsletters")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect(),
    ])

    // Build lookup map for newsletter counts by sender
    const newsletterCountsBySender = new Map<
      string,
      { total: number; unread: number }
    >()
    for (const newsletter of allNewsletters) {
      const senderId = newsletter.senderId
      const current = newsletterCountsBySender.get(senderId) ?? {
        total: 0,
        unread: 0,
      }
      current.total++
      if (!newsletter.isRead) current.unread++
      newsletterCountsBySender.set(senderId, current)
    }

    // Compute folder stats by iterating through settings
    const foldersWithCounts = folders.map((folder) => {
      const folderSettings = allSettings.filter(
        (s) => s.folderId === folder._id
      )

      let newsletterCount = 0
      let unreadCount = 0
      for (const setting of folderSettings) {
        const counts = newsletterCountsBySender.get(setting.senderId) ?? {
          total: 0,
          unread: 0,
        }
        newsletterCount += counts.total
        unreadCount += counts.unread
      }

      return {
        ...folder,
        newsletterCount,
        unreadCount,
        senderCount: folderSettings.length,
      }
    })

    return foldersWithCounts
  },
})

/**
 * List VISIBLE folders for current user with unread newsletter counts
 * Story 9.4: AC1, AC2, AC3 - Folder-centric navigation
 *
 * Excludes folders where isHidden === true from the list.
 * Returns folders enriched with:
 * - newsletterCount: total non-hidden newsletters from senders in folder
 * - unreadCount: unread (non-hidden) newsletters from senders in folder
 * - senderCount: number of senders assigned to folder
 *
 * Performance: Uses batch fetching to avoid N+1 query problem.
 * Fetches all user data once, then computes counts in memory.
 */
export const listVisibleFoldersWithUnreadCounts = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()

    if (!user) return []

    // Fetch all required data upfront to avoid N+1 queries
    const [folders, allSettings, allNewsletters] = await Promise.all([
      ctx.db
        .query("folders")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect(),
      ctx.db
        .query("userSenderSettings")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect(),
      ctx.db
        .query("userNewsletters")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect(),
    ])

    // Story 9.4 AC3: Filter out hidden folders from sidebar
    const visibleFolders = folders.filter((f) => !f.isHidden)

    // Build lookup map for newsletter counts by sender
    // Story 9.4: Exclude hidden newsletters from counts
    const newsletterCountsBySender = new Map<
      string,
      { total: number; unread: number }
    >()
    for (const newsletter of allNewsletters) {
      // Skip hidden newsletters - they don't count toward folder totals
      if (newsletter.isHidden) continue

      const senderId = newsletter.senderId
      const current = newsletterCountsBySender.get(senderId) ?? {
        total: 0,
        unread: 0,
      }
      current.total++
      if (!newsletter.isRead) current.unread++
      newsletterCountsBySender.set(senderId, current)
    }

    // Compute folder stats by iterating through settings
    const foldersWithCounts = visibleFolders.map((folder) => {
      const folderSettings = allSettings.filter(
        (s) => s.folderId === folder._id
      )

      let newsletterCount = 0
      let unreadCount = 0
      for (const setting of folderSettings) {
        const counts = newsletterCountsBySender.get(setting.senderId) ?? {
          total: 0,
          unread: 0,
        }
        newsletterCount += counts.total
        unreadCount += counts.unread
      }

      return {
        ...folder,
        newsletterCount,
        unreadCount,
        senderCount: folderSettings.length,
      }
    })

    // Sort by folder name alphabetically
    return foldersWithCounts.sort((a, b) => a.name.localeCompare(b.name))
  },
})

/**
 * Get a single folder by ID
 * Story 9.4: AC4, AC5 - Folder detail view header
 *
 * Returns folder details for the folder header component.
 * Validates ownership to prevent cross-user access.
 */
export const getFolder = query({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()

    if (!user) return null

    const folder = await ctx.db.get(args.folderId)
    if (!folder) return null

    // Verify ownership
    if (folder.userId !== user._id) return null

    return folder
  },
})

export const deleteFolder = mutation({
  args: {
    folderId: v.id("folders"),
  },
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

    const folder = await ctx.db.get(args.folderId)
    if (!folder) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Folder not found" })
    }

    // Verify ownership
    if (folder.userId !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" })
    }

    // Remove folder reference from any userSenderSettings (Story 9.1: use by_folderId index)
    const settingsWithFolder = await ctx.db
      .query("userSenderSettings")
      .withIndex("by_folderId", (q) => q.eq("folderId", args.folderId))
      .collect()

    for (const setting of settingsWithFolder) {
      await ctx.db.patch(setting._id, { folderId: undefined })
    }

    // Story 9.1: Also remove folder reference from userNewsletters
    const newslettersWithFolder = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId_folderId", (q) =>
        q.eq("userId", user._id).eq("folderId", args.folderId)
      )
      .collect()

    for (const newsletter of newslettersWithFolder) {
      await ctx.db.patch(newsletter._id, { folderId: undefined })
    }

    await ctx.db.delete(args.folderId)
  },
})
