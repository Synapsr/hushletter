import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server"
import { v, ConvexError } from "convex/values"
import { authComponent } from "./auth"

function generateShareToken(): string {
  // 32-char, URL-safe token (UUID without dashes)
  return crypto.randomUUID().replaceAll("-", "")
}

async function requireAuthedUserDoc(ctx: QueryCtx | MutationCtx) {
  const authUser = await authComponent.getAuthUser(ctx).catch(() => null)
  if (!authUser) {
    throw new ConvexError({ code: "UNAUTHORIZED", message: "Not authenticated" })
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
    .first()

  if (!user) {
    throw new ConvexError({ code: "UNAUTHORIZED", message: "User not found" })
  }

  return user
}

/**
 * Ensure the current user has a public share token for their dedicated newsletter email.
 * If a token already exists, returns it; otherwise creates one.
 */
export const ensureDedicatedEmailShareToken = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuthedUserDoc(ctx)

    if (!user.dedicatedEmail) {
      throw new ConvexError({
        code: "NO_DEDICATED_EMAIL",
        message: "Dedicated email is not set for this user",
      })
    }

    if (user.dedicatedEmailShareToken) {
      return { token: user.dedicatedEmailShareToken }
    }

    const token = generateShareToken()
    await ctx.db.patch(user._id, {
      dedicatedEmailShareToken: token,
      dedicatedEmailShareTokenUpdatedAt: Date.now(),
    })

    return { token }
  },
})

/**
 * Rotate (revoke + reissue) the user's dedicated email share token.
 * Old links stop working immediately.
 */
export const rotateDedicatedEmailShareToken = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuthedUserDoc(ctx)

    if (!user.dedicatedEmail) {
      throw new ConvexError({
        code: "NO_DEDICATED_EMAIL",
        message: "Dedicated email is not set for this user",
      })
    }

    const token = generateShareToken()
    await ctx.db.patch(user._id, {
      dedicatedEmailShareToken: token,
      dedicatedEmailShareTokenUpdatedAt: Date.now(),
    })

    return { token }
  },
})

/**
 * Public lookup for a dedicated email by share token.
 * Returns null when not found.
 */
export const getDedicatedEmailByShareToken = query({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const token = args.token.trim()
    if (!token) return null

    const user = await ctx.db
      .query("users")
      .withIndex("by_dedicatedEmailShareToken", (q) =>
        q.eq("dedicatedEmailShareToken", token)
      )
      .first()

    if (!user?.dedicatedEmail) return null
    return { dedicatedEmail: user.dedicatedEmail }
  },
})
