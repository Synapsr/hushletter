import { internalQuery } from "../_generated/server"
import { v } from "convex/values"

/**
 * Find a user by their dedicated email address
 * Used by the email worker to validate incoming emails
 */
export const findByDedicatedEmail = internalQuery({
  args: { dedicatedEmail: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_dedicatedEmail", (q) =>
        q.eq("dedicatedEmail", args.dedicatedEmail)
      )
      .first()
  },
})

/**
 * Find a user by their auth ID (Better Auth subject)
 * Used for permission checks in actions
 */
export const findByAuthId = internalQuery({
  args: { authId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", args.authId))
      .first()
  },
})
