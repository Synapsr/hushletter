import { mutation } from "./_generated/server"
import { v } from "convex/values"
import { ConvexError } from "convex/values"
import { authComponent } from "./auth"

/**
 * Update the current user's profile information.
 * Currently supports updating the display name.
 */
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get authenticated user
    const authUser = await authComponent.getAuthUser(ctx)
    if (!authUser) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to update your profile",
      })
    }

    // Find app user record linked to auth user
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
      .first()

    if (!user) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User profile not found",
      })
    }

    // Update the user's name
    await ctx.db.patch(user._id, {
      name: args.name,
    })

    return { success: true }
  },
})
