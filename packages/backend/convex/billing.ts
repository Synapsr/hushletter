import { action, internalMutation, internalQuery } from "./_generated/server"
import { v, ConvexError } from "convex/values"
import type { Id } from "./_generated/dataModel"

type Currency = "usd" | "eur"
type Interval = "month" | "year"

function getPolarBaseUrl(): string {
  return process.env.POLAR_ENV === "sandbox"
    ? "https://sandbox-api.polar.sh/v1"
    : "https://api.polar.sh/v1"
}

function getSiteUrl(): string {
  const siteUrl = process.env.SITE_URL
  if (!siteUrl) {
    throw new ConvexError({
      code: "CONFIG_ERROR",
      message: "SITE_URL is not configured.",
    })
  }
  return siteUrl.replace(/\/$/, "")
}

function getPolarAccessToken(): string {
  const token = process.env.POLAR_ACCESS_TOKEN
  if (!token) {
    throw new ConvexError({
      code: "CONFIG_ERROR",
      message: "POLAR_ACCESS_TOKEN is not configured.",
    })
  }
  return token
}

function getProductId(interval: Interval, currency: Currency): string {
  const key = (() => {
    if (interval === "month" && currency === "usd") return "POLAR_PRO_MONTHLY_USD_PRODUCT_ID"
    if (interval === "year" && currency === "usd") return "POLAR_PRO_ANNUAL_USD_PRODUCT_ID"
    if (interval === "month" && currency === "eur") return "POLAR_PRO_MONTHLY_EUR_PRODUCT_ID"
    return "POLAR_PRO_ANNUAL_EUR_PRODUCT_ID"
  })()

  const value = process.env[key]
  if (!value) {
    throw new ConvexError({
      code: "CONFIG_ERROR",
      message: `${key} is not configured.`,
    })
  }
  return value
}

export const createProCheckoutUrl = action({
  args: {
    interval: v.union(v.literal("month"), v.literal("year")),
    currency: v.union(v.literal("usd"), v.literal("eur")),
  },
  handler: async (ctx, args): Promise<{ url: string }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Not authenticated" })
    }

    const siteUrl = getSiteUrl()
    const token = getPolarAccessToken()
    const productId = getProductId(args.interval as Interval, args.currency as Currency)

    const response = await fetch(`${getPolarBaseUrl()}/checkouts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        products: [productId],
        allow_trial: false,
        external_customer_id: identity.subject,
        success_url: `${siteUrl}/settings?billing=success&checkout_id={CHECKOUT_ID}`,
        return_url: `${siteUrl}/settings?billing=cancel`,
        metadata: {
          authId: identity.subject,
        },
      }),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      throw new ConvexError({
        code: "BILLING_ERROR",
        message: `Failed to create checkout session (${response.status}). ${body}`.slice(0, 800),
      })
    }

    const data = (await response.json()) as { url?: string }
    const url = data.url
    if (!url) {
      throw new ConvexError({
        code: "BILLING_ERROR",
        message: "Polar checkout session response was missing a URL.",
      })
    }

    return { url }
  },
})

export const createCustomerPortalUrl = action({
  args: {},
  handler: async (ctx): Promise<{ url: string }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Not authenticated" })
    }

    const token = getPolarAccessToken()
    const response = await fetch(`${getPolarBaseUrl()}/customer-sessions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        external_customer_id: identity.subject,
        return_url: `${getSiteUrl()}/settings`,
      }),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => "")
      throw new ConvexError({
        code: "BILLING_ERROR",
        message: `Failed to create customer portal session (${response.status}). ${body}`.slice(
          0,
          800
        ),
      })
    }

    const data = (await response.json()) as { customer_portal_url?: string }
    const url = data.customer_portal_url
    if (!url) {
      throw new ConvexError({
        code: "BILLING_ERROR",
        message: "Polar customer portal session response was missing a URL.",
      })
    }

    return { url }
  },
})

export const recordWebhookEventIfNew = internalMutation({
  args: { eventId: v.string() },
  handler: async (ctx, args): Promise<boolean> => {
    const existing = await ctx.db
      .query("billingWebhookEvents")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .first()

    if (existing) return false
    await ctx.db.insert("billingWebhookEvents", { eventId: args.eventId, receivedAt: Date.now() })
    return true
  },
})

export const applySubscriptionUpdate = internalMutation({
  args: {
    externalCustomerId: v.string(),
    polarCustomerId: v.optional(v.string()),
    polarSubscriptionId: v.optional(v.string()),
    status: v.optional(v.string()),
    currentPeriodEndMs: v.optional(v.number()),
    eventType: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ userId: Id<"users"> | null; becamePro: boolean; isProNow: boolean }> => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", args.externalCustomerId))
      .first()

    if (!user) {
      return { userId: null, becamePro: false, isProNow: false }
    }

    const now = Date.now()
    const previousIsPro =
      user.plan === "pro" &&
      typeof user.proExpiresAt === "number" &&
      user.proExpiresAt > now

    const status = args.status ?? ""
    let plan: "free" | "pro" = user.plan ?? "free"
    let proExpiresAt: number | undefined = user.proExpiresAt ?? undefined

    const currentPeriodEndMs = args.currentPeriodEndMs
    const hasPeriodEnd = typeof currentPeriodEndMs === "number" && Number.isFinite(currentPeriodEndMs)
    const isWithinPaidPeriod = hasPeriodEnd && currentPeriodEndMs > now

    const normalizedStatus = status.toLowerCase()
    const isPaidStatus =
      normalizedStatus === "active" ||
      normalizedStatus === "trialing" ||
      normalizedStatus === "canceled"

    // Polar can emit `subscription.updated` with status "canceled" while the user
    // keeps access until `current_period_end`. We honor that by treating any
    // subscription with a future `current_period_end` as Pro until that time.
    if (isWithinPaidPeriod && isPaidStatus) {
      plan = "pro"
      proExpiresAt = currentPeriodEndMs
    } else if (hasPeriodEnd && currentPeriodEndMs <= now) {
      plan = "free"
      proExpiresAt = undefined
    } else if (args.eventType === "subscription.revoked" && !isWithinPaidPeriod) {
      // Revoked without a future period end: revoke immediately.
      plan = "free"
      proExpiresAt = undefined
    }

    await ctx.db.patch(user._id, {
      plan,
      proExpiresAt,
      polarCustomerId: args.polarCustomerId ?? user.polarCustomerId,
      polarSubscriptionId: args.polarSubscriptionId ?? user.polarSubscriptionId,
    })

    const isProNow = plan === "pro" && typeof proExpiresAt === "number" && proExpiresAt > now
    return { userId: user._id, becamePro: !previousIsPro && isProNow, isProNow }
  },
})

export const getUserPlanDebug = internalQuery({
  args: { externalCustomerId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", args.externalCustomerId))
      .first()
  },
})
