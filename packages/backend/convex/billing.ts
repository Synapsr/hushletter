import { StripeSubscriptions } from "@convex-dev/stripe"
import { components, internal } from "./_generated/api"
import { action, internalMutation, internalQuery } from "./_generated/server"
import { ConvexError, v } from "convex/values"
import type { Id } from "./_generated/dataModel"
import Stripe from "stripe"

type Currency = "usd" | "eur"
type Interval = "month" | "year"

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

function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new ConvexError({
      code: "CONFIG_ERROR",
      message: "STRIPE_SECRET_KEY is not configured.",
    })
  }
  return key
}

function getPriceId(interval: Interval, currency: Currency): string {
  // This app intentionally uses just one monthly and one annual Price ID.
  // To support both USD+EUR without additional env vars, configure the Stripe Price
  // as multi-currency (currency_options) or use Stripe's adaptive pricing.
  //
  // We keep `currency` in the API for UX/display, but it does not select the Price.
  void currency

  const key = interval === "month" ? "STRIPE_PRO_MONTHLY_PRICE_ID" : "STRIPE_PRO_ANNUAL_PRICE_ID"
  const legacyKey =
    interval === "month" ? "STRIPE_PRO_MONTHLY_USD_PRICE_ID" : "STRIPE_PRO_ANNUAL_USD_PRICE_ID"

  const value = process.env[key] ?? process.env[legacyKey]
  if (!value) {
    throw new ConvexError({
      code: "CONFIG_ERROR",
      message: `${key} (or legacy ${legacyKey}) is not configured.`,
    })
  }
  return value
}

function getStripeClient() {
  return new StripeSubscriptions(components.stripe, {
    STRIPE_SECRET_KEY: getStripeSecretKey(),
  })
}

async function createSubscriptionCheckoutSessionWithPromoCode(args: {
  customerId: string
  priceId: string
  successUrl: string
  cancelUrl: string
  subscriptionMetadata?: Record<string, string>
}): Promise<{ url: string | null }> {
  const stripe = new Stripe(getStripeSecretKey())
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    customer: args.customerId,
    allow_promotion_codes: true,
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    line_items: [
      {
        price: args.priceId,
        quantity: 1,
      },
    ],
    subscription_data: args.subscriptionMetadata
      ? {
          metadata: args.subscriptionMetadata,
        }
      : undefined,
  }

  try {
    const session = await stripe.checkout.sessions.create(sessionParams)
    return { url: session.url ?? null }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[billing.createSubscriptionCheckoutSessionWithPromoCode] Stripe SDK error", message)
    throw new ConvexError({
      code: "BILLING_ERROR",
      message: "Failed to create Stripe checkout session.",
    })
  }
}

export const getUserByAuthIdForBilling = internalQuery({
  args: { authId: v.string() },
  handler: async (
    ctx,
    args
  ): Promise<
    | { email: string; name?: string; stripeCustomerId?: string; stripeSubscriptionId?: string }
    | null
  > => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", args.authId))
      .first()
    if (!user) return null
    return {
      email: user.email,
      name: user.name ?? undefined,
      stripeCustomerId: user.stripeCustomerId ?? undefined,
      stripeSubscriptionId: user.stripeSubscriptionId ?? undefined,
    }
  },
})

export const setStripeCustomerIdForUser = internalMutation({
  args: { authId: v.string(), stripeCustomerId: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", args.authId))
      .first()
    if (!user) return
    if (user.stripeCustomerId === args.stripeCustomerId) return
    await ctx.db.patch(user._id, { stripeCustomerId: args.stripeCustomerId })
  },
})

export const createProCheckoutUrl = action({
  args: {
    interval: v.union(v.literal("month"), v.literal("year")),
    currency: v.union(v.literal("usd"), v.literal("eur")),
    returnTo: v.optional(v.union(v.literal("settings"), v.literal("onboarding"), v.literal("import"))),
  },
  handler: async (ctx, args): Promise<{ url: string }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Not authenticated" })
    }

    const user = await ctx.runQuery(internal.billing.getUserByAuthIdForBilling, {
      authId: identity.subject,
    })
    if (!user) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "User not found" })
    }

    const stripe = getStripeClient()
    const { customerId } = await stripe.getOrCreateCustomer(ctx, {
      userId: identity.subject,
      email: user.email,
      name: user.name ?? undefined,
    })
    await ctx.runMutation(internal.billing.setStripeCustomerIdForUser, {
      authId: identity.subject,
      stripeCustomerId: customerId,
    })

    const returnPath = args.returnTo === "onboarding" ? "/onboarding" : args.returnTo === "import" ? "/import" : "/settings"
    const { url } = await createSubscriptionCheckoutSessionWithPromoCode({
      customerId,
      priceId: getPriceId(args.interval as Interval, args.currency as Currency),
      successUrl: `${getSiteUrl()}${returnPath}?billing=success`,
      cancelUrl: `${getSiteUrl()}${returnPath}?billing=cancel`,
      subscriptionMetadata: {
        userId: identity.subject,
      },
    })

    if (!url) {
      throw new ConvexError({ code: "BILLING_ERROR", message: "Stripe checkout session missing URL." })
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

    const user = await ctx.runQuery(internal.billing.getUserByAuthIdForBilling, {
      authId: identity.subject,
    })
    if (!user) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "User not found" })
    }

    const stripe = getStripeClient()
    const { customerId } = await stripe.getOrCreateCustomer(ctx, {
      userId: identity.subject,
      email: user.email,
      name: user.name ?? undefined,
    })
    await ctx.runMutation(internal.billing.setStripeCustomerIdForUser, {
      authId: identity.subject,
      stripeCustomerId: customerId,
    })

    const { url } = await stripe.createCustomerPortalSession(ctx, {
      customerId,
      returnUrl: `${getSiteUrl()}/settings`,
    })

    if (!url) {
      throw new ConvexError({ code: "BILLING_ERROR", message: "Stripe customer portal session missing URL." })
    }

    return { url }
  },
})

export const syncProStatusFromStripe = action({
  args: {},
  handler: async (
    ctx
  ): Promise<
    | { ok: true; isProNow: boolean; proExpiresAt: number | null }
    | { ok: false; reason: "no_subscription_found" | "stripe_error" }
  > => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Not authenticated" })
    }

    const user = await ctx.runQuery(internal.billing.getUserByAuthIdForBilling, {
      authId: identity.subject,
    })
    if (!user) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "User not found" })
    }

    // Fast-path: if the Stripe component has already synced subscription docs via webhooks,
    // use that local state to update our user entitlements without calling Stripe's API.
    //
    // This fixes cases where Stripe webhooks were processed (so `stripe.subscriptions` exists)
    // but our app user record didn't get updated (e.g. handler skipped / old data / dev hiccups).
    const localSubs = await ctx.runQuery(components.stripe.public.listSubscriptionsByUserId, {
      userId: identity.subject,
    })
    const bestLocal = (Array.isArray(localSubs) ? localSubs : [])
      .filter((s) => typeof (s as any)?.currentPeriodEnd === "number")
      .sort((a, b) => ((b as any).currentPeriodEnd ?? 0) - ((a as any).currentPeriodEnd ?? 0))[0]

    if (bestLocal) {
      const result = await ctx.runMutation(internal.billing.applySubscriptionUpdate, {
        userId: identity.subject,
        stripeCustomerId: (bestLocal as any).stripeCustomerId,
        stripeSubscriptionId: (bestLocal as any).stripeSubscriptionId,
        status: typeof (bestLocal as any).status === "string" ? (bestLocal as any).status : undefined,
        cancelAtPeriodEnd:
          typeof (bestLocal as any).cancelAtPeriodEnd === "boolean"
            ? (bestLocal as any).cancelAtPeriodEnd
            : undefined,
        currentPeriodEnd:
          typeof (bestLocal as any).currentPeriodEnd === "number"
            ? (bestLocal as any).currentPeriodEnd
            : undefined,
        eventType: "sync.local",
      })

      if (result.userId && result.becamePro) {
        await ctx.runMutation(internal.entitlements.unlockAllLockedNewslettersForUser, {
          userId: result.userId,
        })
      }

      const refreshed = await ctx.runQuery(internal.billing.getUserPlanDebug, {
        userId: identity.subject,
      })

      const proExpiresAt =
        refreshed && typeof (refreshed as any).proExpiresAt === "number"
          ? (refreshed as any).proExpiresAt
          : null

      return { ok: true, isProNow: result.isProNow, proExpiresAt }
    }

    // No locally-synced subscription docs. Avoid creating Stripe customers just to "check";
    // only query Stripe if we already have a customer id for this user.
    const customerId = user.stripeCustomerId
    if (!customerId) {
      return { ok: false, reason: "no_subscription_found" }
    }

    // Webhooks can be delayed/misconfigured in dev. On success redirect, we "pull"
    // the subscription state from Stripe and apply it to our user entitlements.
    const apiKey = getStripeSecretKey()

    type StripeSub = {
      id?: string
      status?: string
      customer?: string
      cancel_at_period_end?: boolean
      current_period_end?: number
    }

    let best: StripeSub | null = null
    for (let attempt = 0; attempt < 5; attempt++) {
      const url = new URL("https://api.stripe.com/v1/subscriptions")
      url.searchParams.set("customer", customerId)
      url.searchParams.set("status", "all")
      url.searchParams.set("limit", "10")

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      })

      if (!res.ok) {
        const body = await res.text().catch(() => "")
        console.error("[billing.syncProStatusFromStripe] Stripe API error", res.status, body)
        return { ok: false, reason: "stripe_error" }
      }

      const json = (await res.json()) as { data?: StripeSub[] }
      const subs = Array.isArray(json.data) ? json.data : []

      const candidates = subs
        .filter((s) => typeof s?.current_period_end === "number")
        .sort((a, b) => (b.current_period_end ?? 0) - (a.current_period_end ?? 0))

      best = candidates[0] ?? null
      if (best) break

      // Brief retry to handle eventual consistency right after checkout completes.
      await new Promise((r) => setTimeout(r, 500 + attempt * 250))
    }

    if (!best || typeof best.id !== "string") {
      return { ok: false, reason: "no_subscription_found" }
    }

    const result = await ctx.runMutation(internal.billing.applySubscriptionUpdate, {
      userId: identity.subject,
      stripeCustomerId: customerId,
      stripeSubscriptionId: best.id,
      status: typeof best.status === "string" ? best.status : undefined,
      cancelAtPeriodEnd:
        typeof best.cancel_at_period_end === "boolean" ? best.cancel_at_period_end : undefined,
      currentPeriodEnd:
        typeof best.current_period_end === "number" ? best.current_period_end : undefined,
      eventType: "sync.action",
    })

    if (result.userId && result.becamePro) {
      await ctx.runMutation(internal.entitlements.unlockAllLockedNewslettersForUser, {
        userId: result.userId,
      })
    }

    const refreshed = await ctx.runQuery(internal.billing.getUserPlanDebug, {
      userId: identity.subject,
    })

    const proExpiresAt =
      refreshed && typeof (refreshed as any).proExpiresAt === "number"
        ? (refreshed as any).proExpiresAt
        : null

    return { ok: true, isProNow: result.isProNow, proExpiresAt }
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
    userId: v.string(),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    status: v.optional(v.string()),
    cancelAtPeriodEnd: v.optional(v.boolean()),
    currentPeriodEnd: v.optional(v.number()),
    eventType: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ userId: Id<"users"> | null; becamePro: boolean; isProNow: boolean }> => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", args.userId))
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

    const rawPeriodEnd = args.currentPeriodEnd
    const hasPeriodEnd = typeof rawPeriodEnd === "number" && Number.isFinite(rawPeriodEnd)
    // Stripe uses seconds, but some call sites may send ms. Normalize.
    const currentPeriodEndMs = hasPeriodEnd
      ? rawPeriodEnd < 1_000_000_000_000
        ? rawPeriodEnd * 1000
        : rawPeriodEnd
      : undefined
    const isWithinPaidPeriod =
      typeof currentPeriodEndMs === "number" && Number.isFinite(currentPeriodEndMs)
        ? currentPeriodEndMs > now
        : false

    const normalizedStatus = status.toLowerCase()
    const isPaidStatus =
      normalizedStatus === "active" ||
      normalizedStatus === "trialing" ||
      normalizedStatus === "past_due" ||
      normalizedStatus === "canceled"

    // Stripe can emit subscription updates where the user keeps access until
    // `current_period_end`. We honor that by treating any subscription with a
    // future `current_period_end` as Pro until that time.
    if (isWithinPaidPeriod && isPaidStatus) {
      plan = "pro"
      proExpiresAt = currentPeriodEndMs
    } else if (typeof currentPeriodEndMs === "number" && Number.isFinite(currentPeriodEndMs) && currentPeriodEndMs <= now) {
      plan = "free"
      proExpiresAt = undefined
    } else if (args.eventType === "customer.subscription.deleted" && !isWithinPaidPeriod) {
      // Deleted without a future period end: revoke immediately.
      plan = "free"
      proExpiresAt = undefined
    }

    await ctx.db.patch(user._id, {
      plan,
      proExpiresAt,
      stripeCustomerId: args.stripeCustomerId ?? user.stripeCustomerId,
      stripeSubscriptionId: args.stripeSubscriptionId ?? user.stripeSubscriptionId,
    })

    const isProNow = plan === "pro" && typeof proExpiresAt === "number" && proExpiresAt > now
    return { userId: user._id, becamePro: !previousIsPro && isProNow, isProNow }
  },
})

export const getUserPlanDebug = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", args.userId))
      .first()
  },
})
