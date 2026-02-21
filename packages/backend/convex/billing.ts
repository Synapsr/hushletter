import { StripeSubscriptions } from "@convex-dev/stripe"
import { components, internal } from "./_generated/api"
import { action, internalMutation, internalQuery } from "./_generated/server"
import { ConvexError, v } from "convex/values"
import type { Id } from "./_generated/dataModel"
import Stripe from "stripe"

type Currency = "usd" | "eur"
type Interval = "month" | "year"
type CheckoutReturnTo = "settings" | "onboarding" | "import"
type CheckoutBillingSource = "settings_dialog"
type LocalSubscription = {
  stripeSubscriptionId?: string
  stripeCustomerId?: string
  status?: string
  cancelAtPeriodEnd?: boolean
  currentPeriodEnd?: number
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

function getLegacyReturnPath(returnTo?: CheckoutReturnTo): string {
  if (returnTo === "onboarding") return "/onboarding"
  if (returnTo === "import") return "/import"
  return "/settings"
}

function resolveCheckoutReturnPath(args: {
  returnTo?: CheckoutReturnTo
  returnPath?: string
}): string {
  const fallbackPath = getLegacyReturnPath(args.returnTo)
  if (!args.returnPath) return fallbackPath

  const siteUrl = getSiteUrl()
  try {
    const resolvedUrl = new URL(args.returnPath, siteUrl)
    const siteOrigin = new URL(siteUrl).origin
    if (resolvedUrl.origin !== siteOrigin) return fallbackPath

    const normalizedPath = `${resolvedUrl.pathname}${resolvedUrl.search}`
    if (!normalizedPath.startsWith("/") || normalizedPath.startsWith("//")) {
      return fallbackPath
    }

    return normalizedPath
  } catch {
    return fallbackPath
  }
}

function buildCheckoutReturnUrl(args: {
  returnPath: string
  billingStatus: "success" | "cancel"
  billingSource?: CheckoutBillingSource
}): string {
  const url = new URL(args.returnPath, getSiteUrl())
  url.searchParams.set("billing", args.billingStatus)
  if (args.billingSource) {
    url.searchParams.set("billingSource", args.billingSource)
  }
  return url.toString()
}

function pickBestLocalSubscription(subs: LocalSubscription[]): LocalSubscription | null {
  const withPeriod = subs.filter(
    (s) => typeof s?.currentPeriodEnd === "number" && Number.isFinite(s.currentPeriodEnd)
  )
  if (withPeriod.length === 0) return null

  return withPeriod.sort((a, b) => (b.currentPeriodEnd ?? 0) - (a.currentPeriodEnd ?? 0))[0] ?? null
}

async function createSubscriptionCheckoutSessionWithPromoCode(args: {
  customerId: string
  priceId: string
  successUrl: string
  cancelUrl: string
  subscriptionMetadata?: Record<string, string>
}): Promise<{ url: string | null }> {
  const stripe = new Stripe(getStripeSecretKey())
  const sessionParams = buildSubscriptionCheckoutSessionParams(args)

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

export function buildSubscriptionCheckoutSessionParams(args: {
  customerId: string
  priceId: string
  successUrl: string
  cancelUrl: string
  subscriptionMetadata?: Record<string, string>
}): Stripe.Checkout.SessionCreateParams {
  return {
    mode: "subscription",
    customer: args.customerId,
    allow_promotion_codes: true,
    automatic_tax: { enabled: true },
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
    customer_update: {
      address: "auto",
      name: "auto",
    },
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
    returnPath: v.optional(v.string()),
    billingSource: v.optional(v.literal("settings_dialog")),
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

    const returnPath = resolveCheckoutReturnPath({
      returnTo: args.returnTo as CheckoutReturnTo | undefined,
      returnPath: args.returnPath,
    })
    const { url } = await createSubscriptionCheckoutSessionWithPromoCode({
      customerId,
      priceId: getPriceId(args.interval as Interval, args.currency as Currency),
      successUrl: buildCheckoutReturnUrl({
        returnPath,
        billingStatus: "success",
        billingSource: args.billingSource as CheckoutBillingSource | undefined,
      }),
      cancelUrl: buildCheckoutReturnUrl({
        returnPath,
        billingStatus: "cancel",
        billingSource: args.billingSource as CheckoutBillingSource | undefined,
      }),
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
    const localSubsByUser = await ctx.runQuery(components.stripe.public.listSubscriptionsByUserId, {
      userId: identity.subject,
    })
    const localSubsByCustomer = user.stripeCustomerId
      ? await ctx.runQuery(components.stripe.public.listSubscriptions, {
          stripeCustomerId: user.stripeCustomerId,
        })
      : []
    const localSubById = user.stripeSubscriptionId
      ? await ctx.runQuery(components.stripe.public.getSubscription, {
          stripeSubscriptionId: user.stripeSubscriptionId,
        })
      : null

    const mergedLocalSubs = [
      ...(Array.isArray(localSubsByUser) ? localSubsByUser : []),
      ...(Array.isArray(localSubsByCustomer) ? localSubsByCustomer : []),
      ...(localSubById ? [localSubById] : []),
    ]

    const dedupedLocalSubs = Array.from(
      new Map(
        mergedLocalSubs
          .filter((s) => typeof s?.stripeSubscriptionId === "string")
          .map((s) => [s.stripeSubscriptionId as string, s as LocalSubscription])
      ).values()
    )

    const bestLocal = pickBestLocalSubscription(dedupedLocalSubs)

    if (bestLocal) {
      const result = await ctx.runMutation(internal.billing.applySubscriptionUpdate, {
        userId: identity.subject,
        stripeCustomerId: bestLocal.stripeCustomerId,
        stripeSubscriptionId: bestLocal.stripeSubscriptionId,
        status: typeof bestLocal.status === "string" ? bestLocal.status : undefined,
        cancelAtPeriodEnd:
          typeof bestLocal.cancelAtPeriodEnd === "boolean" ? bestLocal.cancelAtPeriodEnd : undefined,
        currentPeriodEnd:
          typeof bestLocal.currentPeriodEnd === "number" ? bestLocal.currentPeriodEnd : undefined,
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
