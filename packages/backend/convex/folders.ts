import { internalMutation, mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { ConvexError } from "convex/values"

const MAX_FOLDER_CATEGORY_LENGTH = 40

function normalizeFolderCategory(
  category: string | null | undefined
): string | undefined {
  if (category === undefined || category === null) return undefined

  const normalized = category
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, MAX_FOLDER_CATEGORY_LENGTH)
    .trim()

  return normalized.length > 0 ? normalized : undefined
}

/**
 * Create a new folder for organizing senders
 * Story 2.5.1: Folder CRUD for Epic 3 (basic structure created now)
 */
export const createFolder = mutation({
  args: {
    name: v.string(),
    color: v.optional(v.string()),
    category: v.optional(v.string()),
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
      .withIndex("by_userId_name", (q) =>
        q.eq("userId", user._id).eq("name", args.name)
      )
      .first()

    if (existingFolder) {
      throw new ConvexError({
        code: "DUPLICATE",
        message: "A folder with this name already exists",
      })
    }

    const now = Date.now()
    const category = normalizeFolderCategory(args.category)
    const folderId = await ctx.db.insert("folders", {
      userId: user._id,
      name: args.name,
      color: args.color,
      ...(category !== undefined ? { category } : {}),
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
    category: v.optional(v.union(v.string(), v.null())),
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

    const folder = await ctx.db.get("folders", args.folderId)
    if (!folder) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Folder not found" })
    }

    // Verify ownership
    if (folder.userId !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" })
    }

    // Check for duplicate name if changing name
    const nextName = args.name
    if (nextName !== undefined && nextName !== folder.name) {
      const existingFolder = await ctx.db
        .query("folders")
        .withIndex("by_userId_name", (q) =>
          q.eq("userId", user._id).eq("name", nextName)
        )
        .first()

      if (existingFolder) {
        throw new ConvexError({
          code: "DUPLICATE",
          message: "A folder with this name already exists",
        })
      }
    }

    await ctx.db.patch("folders", args.folderId, {
      ...(args.name !== undefined ? { name: args.name } : {}),
      ...(args.color !== undefined ? { color: args.color } : {}),
      ...(args.category !== undefined
        ? { category: normalizeFolderCategory(args.category) }
        : {}),
      ...(args.isHidden !== undefined ? { isHidden: args.isHidden } : {}),
      updatedAt: Date.now(), // Story 9.1: Track folder modification time
    })

    return await ctx.db.get("folders", args.folderId)
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
 * - senderEmail: representative sender email (latest newsletter in folder)
 * - senderPreviews: up to 3 latest distinct senders for avatar groups
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
    const latestNewsletterBySender = new Map<
      string,
      { receivedAt: number; senderEmail: string; senderName?: string }
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

      const currentLatest = latestNewsletterBySender.get(senderId)
      if (!currentLatest || newsletter.receivedAt > currentLatest.receivedAt) {
        latestNewsletterBySender.set(senderId, {
          receivedAt: newsletter.receivedAt,
          senderEmail: newsletter.senderEmail,
          senderName: newsletter.senderName,
        })
      }
    }

    // Compute folder stats by iterating through settings
    const foldersWithCounts = visibleFolders.map((folder) => {
      const folderSettings = allSettings.filter(
        (s) => s.folderId === folder._id
      )

      let newsletterCount = 0
      let unreadCount = 0
      const senderPreviews = folderSettings
        .map((setting) => latestNewsletterBySender.get(setting.senderId))
        .filter(
          (
            preview
          ): preview is {
            receivedAt: number
            senderEmail: string
            senderName?: string
          } => Boolean(preview)
        )
        .sort((a, b) => b.receivedAt - a.receivedAt)
        .slice(0, 3)
        .map((preview) => ({
          senderEmail: preview.senderEmail,
          senderName: preview.senderName,
        }))

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
        senderEmail: senderPreviews[0]?.senderEmail,
        senderPreviews,
      }
    })

    // Sort by user-defined order (drag-to-reorder), fallback to alphabetical
    return foldersWithCounts.sort((a, b) => {
      const aOrder = a.sortOrder ?? Number.MAX_SAFE_INTEGER
      const bOrder = b.sortOrder ?? Number.MAX_SAFE_INTEGER
      if (aOrder !== bOrder) return aOrder - bOrder
      return a.name.localeCompare(b.name)
    })
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

    const folder = await ctx.db.get("folders", args.folderId)
    if (!folder) return null

    // Verify ownership
    if (folder.userId !== user._id) return null

    return folder
  },
})

/**
 * Get folder with its senders in a single query
 * Story 9.4 Code Review Fix: MEDIUM-3 - Consolidate FolderHeader queries
 *
 * Returns folder details along with all senders assigned to it.
 * Reduces network round-trips from 2 to 1 for folder header display.
 */
export const getFolderWithSenders = query({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return null

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()

    if (!user) return null

    const folder = await ctx.db.get("folders", args.folderId)
    if (!folder) return null

    // Verify ownership
    if (folder.userId !== user._id) return null

    // Get senders in this folder (same logic as listSendersInFolder)
    const settings = await ctx.db
      .query("userSenderSettings")
      .withIndex("by_folderId_userId", (q) =>
        q.eq("folderId", args.folderId).eq("userId", user._id)
      )
      .collect()

    const senders = await Promise.all(
      settings.map(async (setting) => {
        const sender = await ctx.db.get("senders", setting.senderId)
        if (!sender) return null
        return {
          _id: sender._id,
          email: sender.email,
          name: sender.name,
          displayName: sender.name || sender.email,
          domain: sender.domain,
        }
      })
    )

    const filteredSenders = senders
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => a.displayName.localeCompare(b.displayName))

    return {
      ...folder,
      senders: filteredSenders,
    }
  },
})

/**
 * Persist the user's custom folder order after drag-to-reorder.
 * Accepts the full ordered list of folder IDs and writes a sequential
 * sortOrder value to each one.
 */
export const reorderFolders = mutation({
  args: { orderedFolderIds: v.array(v.id("folders")) },
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

    const now = Date.now()
    for (let i = 0; i < args.orderedFolderIds.length; i++) {
      const folder = await ctx.db.get("folders", args.orderedFolderIds[i])
      if (!folder || folder.userId !== user._id) continue
      if (folder.sortOrder === i) continue
      await ctx.db.patch("folders", args.orderedFolderIds[i], {
        sortOrder: i,
        updatedAt: now,
      })
    }
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

    const folder = await ctx.db.get("folders", args.folderId)
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
      .withIndex("by_folderId_userId", (q) =>
        q.eq("folderId", args.folderId).eq("userId", user._id)
      )
      .collect()

    for (const setting of settingsWithFolder) {
      await ctx.db.patch("userSenderSettings", setting._id, {
        folderId: undefined,
      })
    }

    // Story 9.1: Also remove folder reference from userNewsletters
    const newslettersWithFolder = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId_folderId", (q) =>
        q.eq("userId", user._id).eq("folderId", args.folderId)
      )
      .collect()

    for (const newsletter of newslettersWithFolder) {
      await ctx.db.patch("userNewsletters", newsletter._id, {
        folderId: undefined,
      })
    }

    await ctx.db.delete("folders", args.folderId)
  },
})

/**
 * Helper to generate a unique folder name by appending a counter if needed.
 * Used by renameFolder and createFolder to handle duplicates.
 * Story 9.5: Task 1.3 - Handle duplicate folder names
 */
function makeUniqueFolderName(
  baseName: string,
  existingFolders: { name: string }[]
): string {
  const lowerBase = baseName.toLowerCase()
  const existingNames = new Set(existingFolders.map((f) => f.name.toLowerCase()))

  if (!existingNames.has(lowerBase)) {
    return baseName
  }

  // Find the next available counter
  let counter = 2
  while (existingNames.has(`${lowerBase} ${counter}`)) {
    counter++
  }
  return `${baseName} ${counter}`
}

/**
 * Rename a folder
 * Story 9.5: Task 1 - Folder Rename (AC #9, #10)
 *
 * Validates:
 * - User is authenticated and owns the folder
 * - New name is not empty and within length limits
 * - Handles duplicate names by appending counter
 *
 * Updates updatedAt timestamp for tracking modifications.
 */
export const renameFolder = mutation({
  args: {
    folderId: v.id("folders"),
    newName: v.string(),
  },
  returns: v.object({ name: v.string() }),
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

    // Validate ownership
    const folder = await ctx.db.get("folders", args.folderId)
    if (!folder || folder.userId !== user._id) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Folder not found" })
    }

    // Validate name - Task 1.2
    const trimmedName = args.newName.trim()
    if (!trimmedName) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Folder name cannot be empty",
      })
    }
    if (trimmedName.length > 100) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Folder name must be 100 characters or less",
      })
    }

    // Check for duplicate names (case-insensitive) - Task 1.3
    const existingFolders = await ctx.db
      .query("folders")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()

    // Exclude current folder from duplicate check
    const otherFolders = existingFolders.filter((f) => f._id !== args.folderId)
    const finalName = makeUniqueFolderName(trimmedName, otherFolders)

    // Update folder - Task 1.4
    await ctx.db.patch("folders", args.folderId, {
      name: finalName,
      updatedAt: Date.now(),
    })

    return { name: finalName }
  },
})

/**
 * Hide a folder from main navigation
 * Story 9.5: Task 2 - Folder Hide (AC #5)
 *
 * Sets isHidden = true, which excludes the folder from:
 * - listVisibleFoldersWithUnreadCounts (sidebar)
 * - "All Newsletters" aggregate counts
 */
export const hideFolder = mutation({
  args: { folderId: v.id("folders") },
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

    const folder = await ctx.db.get("folders", args.folderId)
    if (!folder || folder.userId !== user._id) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Folder not found" })
    }

    await ctx.db.patch("folders", args.folderId, {
      isHidden: true,
      updatedAt: Date.now(),
    })
  },
})

/**
 * Unhide a folder to restore it to main navigation
 * Story 9.5: Task 2 - Folder Unhide (AC #8)
 *
 * Sets isHidden = false, restoring the folder to:
 * - listVisibleFoldersWithUnreadCounts (sidebar)
 * - "All Newsletters" aggregate counts
 */
export const unhideFolder = mutation({
  args: { folderId: v.id("folders") },
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

    const folder = await ctx.db.get("folders", args.folderId)
    if (!folder || folder.userId !== user._id) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Folder not found" })
    }

    await ctx.db.patch("folders", args.folderId, {
      isHidden: false,
      updatedAt: Date.now(),
    })
  },
})

/**
 * List hidden folders for settings page
 * Story 9.5: Task 2.6, 5.2 - Hidden Folders in Settings (AC #7)
 *
 * Returns hidden folders with counts for display in settings.
 * Used to show users which folders are hidden and allow unhiding.
 */
export const listHiddenFolders = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()

    if (!user) return []

    // Fetch all data for computing stats - avoid N+1
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

    const hiddenFolders = folders.filter((f) => f.isHidden)

    // Build newsletter counts by folder
    const newslettersByFolder = new Map<string, number>()
    for (const newsletter of allNewsletters) {
      if (newsletter.folderId) {
        const current = newslettersByFolder.get(newsletter.folderId) ?? 0
        newslettersByFolder.set(newsletter.folderId, current + 1)
      }
    }

    // Build sender counts by folder
    const sendersByFolder = new Map<string, number>()
    for (const setting of allSettings) {
      if (setting.folderId) {
        const current = sendersByFolder.get(setting.folderId) ?? 0
        sendersByFolder.set(setting.folderId, current + 1)
      }
    }

    return hiddenFolders.map((folder) => ({
      ...folder,
      newsletterCount: newslettersByFolder.get(folder._id) ?? 0,
      senderCount: sendersByFolder.get(folder._id) ?? 0,
    }))
  },
})

/**
 * Merge one folder into another
 * Story 9.5: Task 3 - Folder Merge (AC #1, #2, #3, #4)
 *
 * Moves all senders and newsletters from source folder to target folder,
 * then deletes the source folder. Stores merge history for undo capability.
 *
 * Returns mergeId for undo, plus counts of moved items for user feedback.
 */
export const mergeFolders = mutation({
  args: {
    sourceFolderId: v.id("folders"),
    targetFolderId: v.id("folders"),
  },
  returns: v.object({
    mergeId: v.string(),
    movedNewsletterCount: v.number(),
    movedSenderCount: v.number(),
  }),
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

    // Validate not merging into self
    if (args.sourceFolderId === args.targetFolderId) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Cannot merge folder into itself",
      })
    }

    // Validate ownership of both folders
    const sourceFolder = await ctx.db.get("folders", args.sourceFolderId)
    const targetFolder = await ctx.db.get("folders", args.targetFolderId)

    if (!sourceFolder || sourceFolder.userId !== user._id) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Source folder not found" })
    }
    if (!targetFolder || targetFolder.userId !== user._id) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Target folder not found" })
    }

    // Move userSenderSettings to target folder - Task 3.2
    const senderSettings = await ctx.db
      .query("userSenderSettings")
      .withIndex("by_folderId_userId", (q) =>
        q.eq("folderId", args.sourceFolderId).eq("userId", user._id)
      )
      .collect()

    for (const setting of senderSettings) {
      await ctx.db.patch("userSenderSettings", setting._id, {
        folderId: args.targetFolderId,
      })
    }

    // Move userNewsletters to target folder - Task 3.3
    const newsletters = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId_folderId", (q) =>
        q.eq("userId", user._id).eq("folderId", args.sourceFolderId)
      )
      .collect()

    for (const newsletter of newsletters) {
      await ctx.db.patch("userNewsletters", newsletter._id, {
        folderId: args.targetFolderId,
      })
    }

    // Store merge history for undo - Task 6.1, 6.2
    const mergeId = crypto.randomUUID()
    const now = Date.now()
    await ctx.db.insert("folderMergeHistory", {
      mergeId,
      userId: user._id,
      sourceFolderName: sourceFolder.name,
      sourceFolderColor: sourceFolder.color,
      sourceFolderCategory: sourceFolder.category,
      targetFolderId: args.targetFolderId,
      movedSenderSettingIds: senderSettings.map((s) => s._id),
      movedNewsletterIds: newsletters.map((n) => n._id),
      createdAt: now,
      expiresAt: now + 30000, // 30 seconds to undo - Task 6.6
    })

    // Delete source folder - Task 3.4
    await ctx.db.delete("folders", args.sourceFolderId)

    // Update target folder timestamp
    await ctx.db.patch("folders", args.targetFolderId, { updatedAt: now })

    return {
      mergeId,
      movedNewsletterCount: newsletters.length,
      movedSenderCount: senderSettings.length,
    }
  },
})

/**
 * Undo a folder merge operation
 * Story 9.5: Task 6 - Undo Merge (AC #4)
 *
 * Recreates the source folder and moves items back.
 * Only works within the undo time window (30 seconds).
 *
 * Code Review Fix HIGH-2: Reports if some items couldn't be restored
 * (e.g., if deleted between merge and undo).
 */
export const undoFolderMerge = mutation({
  args: { mergeId: v.string() },
  returns: v.object({
    restoredFolderId: v.id("folders"),
    restoredSenderCount: v.number(),
    restoredNewsletterCount: v.number(),
    skippedSenderCount: v.number(),
    skippedNewsletterCount: v.number(),
  }),
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

    // Find merge history - Task 6.3
    const history = await ctx.db
      .query("folderMergeHistory")
      .withIndex("by_mergeId", (q) => q.eq("mergeId", args.mergeId))
      .first()

    if (!history || history.userId !== user._id) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Merge history not found or expired",
      })
    }

    // Check expiry - Task 6.6
    if (Date.now() > history.expiresAt) {
      throw new ConvexError({
        code: "EXPIRED",
        message: "Undo window has expired",
      })
    }

    // Recreate source folder - Task 6.4
    const now = Date.now()
    const newFolderId = await ctx.db.insert("folders", {
      userId: user._id,
      name: history.sourceFolderName,
      color: history.sourceFolderColor,
      category: history.sourceFolderCategory,
      isHidden: false,
      createdAt: now,
      updatedAt: now,
    })

    // Move items back to recreated folder - Task 6.5
    // Code Review Fix HIGH-2: Track restoration counts
    let restoredSenderCount = 0
    let skippedSenderCount = 0
    let restoredNewsletterCount = 0
    let skippedNewsletterCount = 0

    for (const settingId of history.movedSenderSettingIds) {
      const setting = await ctx.db.get("userSenderSettings", settingId)
      if (setting && setting.userId === user._id) {
        await ctx.db.patch("userSenderSettings", settingId, {
          folderId: newFolderId,
        })
        restoredSenderCount++
      } else {
        skippedSenderCount++
      }
    }

    for (const newsletterId of history.movedNewsletterIds) {
      const newsletter = await ctx.db.get("userNewsletters", newsletterId)
      if (newsletter && newsletter.userId === user._id) {
        await ctx.db.patch("userNewsletters", newsletterId, {
          folderId: newFolderId,
        })
        restoredNewsletterCount++
      } else {
        skippedNewsletterCount++
      }
    }

    // Delete history record
    await ctx.db.delete("folderMergeHistory", history._id)

    return {
      restoredFolderId: newFolderId,
      restoredSenderCount,
      restoredNewsletterCount,
      skippedSenderCount,
      skippedNewsletterCount,
    }
  },
})

/**
 * Clean up expired folder merge history records
 * Story 9.5 Code Review Fix HIGH-1/LOW-3: TTL cleanup for folderMergeHistory
 *
 * Called periodically via cron to delete records past their expiresAt time.
 * This prevents unbounded growth of the folderMergeHistory table.
 *
 * Runs every 5 minutes to clean up expired records (30-second TTL per record).
 */
export const cleanupExpiredMergeHistory = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()

    // Find all expired records using by_expiresAt index
    const expiredRecords = await ctx.db
      .query("folderMergeHistory")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", now))
      .collect()

    let deletedCount = 0
    for (const record of expiredRecords) {
      await ctx.db.delete("folderMergeHistory", record._id)
      deletedCount++
    }

    if (deletedCount > 0) {
      console.log(
        `[folders] Cleaned up ${deletedCount} expired merge history records`
      )
    }

    return { deletedCount }
  },
})
