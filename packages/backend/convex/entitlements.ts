import { internalMutation, internalQuery, query } from "./_generated/server"
import { v, ConvexError } from "convex/values"
import type { Doc } from "./_generated/dataModel"

export const UNLOCKED_NEWSLETTERS_CAP = 1000
export const HARD_NEWSLETTERS_CAP = 2000
export const AI_DAILY_LIMIT = 50

export type Entitlements = {
  plan: "free" | "pro"
  isPro: boolean
  proExpiresAt: number | null
  unlockedCap: number
  hardCap: number
  aiDailyLimit: number
  usage: {
    totalStored: number | null
    unlockedStored: number | null
    lockedStored: number | null
  }
}

export function isUserPro(user: Pick<Doc<"users">, "plan" | "proExpiresAt">): boolean {
  return user.plan === "pro" && typeof user.proExpiresAt === "number" && user.proExpiresAt > Date.now()
}

export function requireProFromUser(user: Pick<Doc<"users">, "plan" | "proExpiresAt">) {
  if (!isUserPro(user)) {
    throw new ConvexError({
      code: "PRO_REQUIRED",
      message: "Hushletter Pro is required for this feature.",
    })
  }
}

export async function requirePro(
  ctx: {
    auth: { getUserIdentity: () => Promise<{ subject: string } | null> }
    db: {
      query: (table: "users") => any
    }
  }
): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new ConvexError({ code: "UNAUTHORIZED", message: "Not authenticated" })
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_authId", (q: any) => q.eq("authId", identity.subject))
    .first()

  if (!user) {
    throw new ConvexError({ code: "UNAUTHORIZED", message: "User not found" })
  }

  requireProFromUser({ plan: user.plan ?? "free", proExpiresAt: user.proExpiresAt })
  return user
}

export const getEntitlements = query({
  args: {},
  handler: async (ctx): Promise<Entitlements> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      return {
        plan: "free",
        isPro: false,
        proExpiresAt: null,
        unlockedCap: UNLOCKED_NEWSLETTERS_CAP,
        hardCap: HARD_NEWSLETTERS_CAP,
        aiDailyLimit: AI_DAILY_LIMIT,
        usage: { totalStored: null, unlockedStored: null, lockedStored: null },
      }
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()

    if (!user) {
      return {
        plan: "free",
        isPro: false,
        proExpiresAt: null,
        unlockedCap: UNLOCKED_NEWSLETTERS_CAP,
        hardCap: HARD_NEWSLETTERS_CAP,
        aiDailyLimit: AI_DAILY_LIMIT,
        usage: { totalStored: null, unlockedStored: null, lockedStored: null },
      }
    }

    const counters = await ctx.db
      .query("userUsageCounters")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first()

    return {
      plan: (user.plan ?? "free") as "free" | "pro",
      isPro: isUserPro({ plan: user.plan ?? "free", proExpiresAt: user.proExpiresAt }),
      proExpiresAt: user.proExpiresAt ?? null,
      unlockedCap: UNLOCKED_NEWSLETTERS_CAP,
      hardCap: HARD_NEWSLETTERS_CAP,
      aiDailyLimit: AI_DAILY_LIMIT,
      usage: {
        totalStored: counters?.totalStored ?? null,
        unlockedStored: counters?.unlockedStored ?? null,
        lockedStored: counters?.lockedStored ?? null,
      },
    }
  },
})

export const getUserEntitlementsByUserId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<Entitlements> => {
    const user = await ctx.db.get("users", args.userId)
    if (!user) {
      return {
        plan: "free",
        isPro: false,
        proExpiresAt: null,
        unlockedCap: UNLOCKED_NEWSLETTERS_CAP,
        hardCap: HARD_NEWSLETTERS_CAP,
        aiDailyLimit: AI_DAILY_LIMIT,
        usage: { totalStored: null, unlockedStored: null, lockedStored: null },
      }
    }

    const counters = await ctx.db
      .query("userUsageCounters")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first()

    return {
      plan: (user.plan ?? "free") as "free" | "pro",
      isPro: isUserPro({ plan: user.plan ?? "free", proExpiresAt: user.proExpiresAt }),
      proExpiresAt: user.proExpiresAt ?? null,
      unlockedCap: UNLOCKED_NEWSLETTERS_CAP,
      hardCap: HARD_NEWSLETTERS_CAP,
      aiDailyLimit: AI_DAILY_LIMIT,
      usage: {
        totalStored: counters?.totalStored ?? null,
        unlockedStored: counters?.unlockedStored ?? null,
        lockedStored: counters?.lockedStored ?? null,
      },
    }
  },
})

export const getUserUsageCounters = internalQuery({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    args
  ): Promise<{ totalStored: number; unlockedStored: number; lockedStored: number } | null> => {
    const counters = await ctx.db
      .query("userUsageCounters")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first()

    if (!counters) return null
    return {
      totalStored: counters.totalStored,
      unlockedStored: counters.unlockedStored,
      lockedStored: counters.lockedStored,
    }
  },
})

export const computeUserUsageCountersFallback = internalQuery({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    args
  ): Promise<{
    totalStored: number
    unlockedStored: number
    lockedStored: number
    isAtHardCap: boolean
  }> => {
    const docs = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .take(HARD_NEWSLETTERS_CAP + 1)

    let unlockedStored = 0
    let lockedStored = 0
    for (const doc of docs) {
      if (doc.isLockedByPlan) lockedStored += 1
      else unlockedStored += 1
    }

    return {
      totalStored: docs.length,
      unlockedStored,
      lockedStored,
      isAtHardCap: docs.length >= HARD_NEWSLETTERS_CAP,
    }
  },
})

export const upsertUserUsageCounters = internalMutation({
  args: {
    userId: v.id("users"),
    totalStored: v.number(),
    unlockedStored: v.number(),
    lockedStored: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userUsageCounters")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first()

    const value = {
      userId: args.userId,
      totalStored: args.totalStored,
      unlockedStored: args.unlockedStored,
      lockedStored: args.lockedStored,
      updatedAt: Date.now(),
    }

    if (!existing) {
      await ctx.db.insert("userUsageCounters", value)
      return
    }

    await ctx.db.patch("userUsageCounters", existing._id, value)
  },
})

export const incrementUserUsageCounters = internalMutation({
  args: {
    userId: v.id("users"),
    totalDelta: v.number(),
    unlockedDelta: v.number(),
    lockedDelta: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userUsageCounters")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first()

    const next = {
      totalStored: Math.max(0, (existing?.totalStored ?? 0) + args.totalDelta),
      unlockedStored: Math.max(0, (existing?.unlockedStored ?? 0) + args.unlockedDelta),
      lockedStored: Math.max(0, (existing?.lockedStored ?? 0) + args.lockedDelta),
      updatedAt: Date.now(),
    }

    if (!existing) {
      await ctx.db.insert("userUsageCounters", { userId: args.userId, ...next })
      return
    }

    await ctx.db.patch("userUsageCounters", existing._id, next)
  },
})

export const unlockAllLockedNewslettersForUser = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const locked = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId_isLockedByPlan", (q) =>
        q.eq("userId", args.userId).eq("isLockedByPlan", true)
      )
      .collect()

    if (locked.length === 0) return { unlocked: 0 }

    for (const newsletter of locked) {
      await ctx.db.patch("userNewsletters", newsletter._id, {
        isLockedByPlan: false,
      })

      const meta = await ctx.db
        .query("newsletterSearchMeta")
        .withIndex("by_userId_userNewsletterId", (q) =>
          q.eq("userId", args.userId).eq("userNewsletterId", newsletter._id)
        )
        .first()
      if (meta) {
        await ctx.db.patch("newsletterSearchMeta", meta._id, {
          isLockedByPlan: false,
        })
      }
    }

    const counters = await ctx.db
      .query("userUsageCounters")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first()

    if (counters) {
      await ctx.db.patch("userUsageCounters", counters._id, {
        unlockedStored: counters.unlockedStored + locked.length,
        lockedStored: Math.max(0, counters.lockedStored - locked.length),
        updatedAt: Date.now(),
      })
    }

    return { unlocked: locked.length }
  },
})
