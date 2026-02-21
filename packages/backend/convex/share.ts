import {
  action,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server"
import { v, ConvexError } from "convex/values"
import { authComponent } from "./auth"
import { r2 } from "./r2"
import { internal } from "./_generated/api"

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
    await ctx.db.patch("users", user._id, {
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
    await ctx.db.patch("users", user._id, {
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

export const getUserNewsletterByShareTokenInternal = internalQuery({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const token = args.token.trim()
    if (!token) return null

    return await ctx.db
      .query("userNewsletters")
      .withIndex("by_shareToken", (q) => q.eq("shareToken", token))
      .first()
  },
})

/**
 * Ensure the current user has a public share token for a specific newsletter.
 */
export const ensureNewsletterShareToken = mutation({
  args: {
    userNewsletterId: v.id("userNewsletters"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthedUserDoc(ctx)

    const newsletter = await ctx.db.get("userNewsletters", args.userNewsletterId)
    if (!newsletter) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Newsletter not found" })
    }
    if (newsletter.userId !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" })
    }

    if (newsletter.shareToken) {
      return { token: newsletter.shareToken }
    }

    const token = generateShareToken()
    await ctx.db.patch("userNewsletters", newsletter._id, {
      shareToken: token,
      shareTokenUpdatedAt: Date.now(),
    })

    return { token }
  },
})

/**
 * Rotate (revoke + reissue) the share token for a specific newsletter.
 */
export const rotateNewsletterShareToken = mutation({
  args: {
    userNewsletterId: v.id("userNewsletters"),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthedUserDoc(ctx)

    const newsletter = await ctx.db.get("userNewsletters", args.userNewsletterId)
    if (!newsletter) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Newsletter not found" })
    }
    if (newsletter.userId !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" })
    }

    const token = generateShareToken()
    await ctx.db.patch("userNewsletters", newsletter._id, {
      shareToken: token,
      shareTokenUpdatedAt: Date.now(),
    })

    return { token }
  },
})

type SharedNewsletterWithContentResult = {
  subject: string
  senderEmail: string
  senderName?: string
  receivedAt: number
  contentUrl: string | null
  contentStatus: "available" | "missing" | "error"
}

/**
 * Public lookup for a newsletter by share token, with a signed R2 URL for its content.
 * Returns null when not found.
 */
export const getNewsletterByShareTokenWithContent = action({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args): Promise<SharedNewsletterWithContentResult | null> => {
    const token = args.token.trim()
    if (!token) return null

    const newsletter = await ctx.runQuery(
      internal.share.getUserNewsletterByShareTokenInternal,
      { token }
    )

    if (!newsletter) return null

    let r2Key: string | null = null

    if (newsletter.isPrivate && newsletter.privateR2Key) {
      r2Key = newsletter.privateR2Key
    } else if (!newsletter.isPrivate && newsletter.contentId) {
      const content = await ctx.runQuery(internal.newsletters.getNewsletterContentInternal, {
        contentId: newsletter.contentId,
      })
      if (content) r2Key = content.r2Key
    }

    let contentUrl: string | null = null
    let contentStatus: "available" | "missing" | "error" = "missing"

    if (r2Key) {
      try {
        contentUrl = await r2.getUrl(r2Key, { expiresIn: 3600 })
        contentStatus = "available"
      } catch (error) {
        console.error("[share] Failed to generate R2 signed URL:", error)
        contentStatus = "error"
      }
    }

    return {
      subject: newsletter.subject,
      senderEmail: newsletter.senderEmail,
      senderName: newsletter.senderName,
      receivedAt: newsletter.receivedAt,
      contentUrl,
      contentStatus,
    }
  },
})
