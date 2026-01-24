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

    const folderId = await ctx.db.insert("folders", {
      userId: user._id,
      name: args.name,
      color: args.color,
      createdAt: Date.now(),
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
    })

    return await ctx.db.get(args.folderId)
  },
})

/**
 * Delete a folder
 * Story 2.5.1: Basic folder deletion
 * Note: This will unset folderId on any userSenderSettings that reference this folder
 */
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

    // Remove folder reference from any userSenderSettings
    const settingsWithFolder = await ctx.db
      .query("userSenderSettings")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("folderId"), args.folderId))
      .collect()

    for (const setting of settingsWithFolder) {
      await ctx.db.patch(setting._id, { folderId: undefined })
    }

    await ctx.db.delete(args.folderId)
  },
})
