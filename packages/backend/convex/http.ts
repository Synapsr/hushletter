import { httpRouter } from "convex/server"
import { httpAction } from "./_generated/server"
import { registerRoutes } from "@convex-dev/stripe"
import { components, internal } from "./_generated/api"
import { authComponent, createAuth } from "./auth"
import { receiveEmail } from "./emailIngestion"
import {
  receiveImportEmail,
  verifyUser,
  logRejection,
} from "./importIngestion"
import { handleOAuthCallback } from "./gmailConnections"

const http = httpRouter()

// Simple test route to verify HTTP routing works
http.route({
  path: "/test",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(JSON.stringify({ status: "ok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    })
  }),
})

// Email ingestion endpoint for Cloudflare Email Worker
http.route({
  path: "/api/email/ingest",
  method: "POST",
  handler: receiveEmail,
})

// ============================================================
// Story 8.3: Forward-to-Import endpoints
// ============================================================

// Import ingestion endpoint - receives extracted newsletters from forwarded emails
http.route({
  path: "/api/email/import",
  method: "POST",
  handler: receiveImportEmail,
})

// User verification endpoint - checks if forwarding user is registered
http.route({
  path: "/api/email/import/verify-user",
  method: "POST",
  handler: verifyUser,
})

// Rejection logging endpoint - logs failed import attempts for admin monitoring
http.route({
  path: "/api/email/import/log-rejection",
  method: "POST",
  handler: logRejection,
})

// ============================================================
// Gmail OAuth callback for multi-account connections
// ============================================================
http.route({
  path: "/api/oauth/gmail-callback",
  method: "GET",
  handler: handleOAuthCallback,
})

// Stripe billing webhooks (subscription status, etc.)
registerRoutes(http, components.stripe, {
  webhookPath: "/stripe/webhook",
  events: {
    "checkout.session.completed": async (ctx, event) => {
      const eventId = String((event as any)?.id ?? "")
      if (eventId) {
        const isNew = await ctx.runMutation(internal.billing.recordWebhookEventIfNew, { eventId })
        if (!isNew) return
      }

      const session = (event as any)?.data?.object ?? {}
      const subscriptionId = typeof session?.subscription === "string" ? session.subscription : ""
      if (!subscriptionId) return

      // Fetch the subscription from Stripe so we can read `metadata.userId` which we
      // attach via `subscriptionMetadata` at checkout creation time.
      const apiKey = process.env.STRIPE_SECRET_KEY
      if (!apiKey) return

      const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      if (!res.ok) return

      const subscription = await res.json().catch(() => null)
      const userId = String(subscription?.metadata?.userId ?? "")
      if (!userId) return

      const stripeCustomerId =
        typeof subscription?.customer === "string"
          ? subscription.customer
          : typeof subscription?.customer?.id === "string"
            ? subscription.customer.id
            : undefined

      const result = await ctx.runMutation(internal.billing.applySubscriptionUpdate, {
        userId,
        stripeCustomerId,
        stripeSubscriptionId: typeof subscription?.id === "string" ? subscription.id : undefined,
        status: typeof subscription?.status === "string" ? subscription.status : undefined,
        cancelAtPeriodEnd:
          typeof subscription?.cancel_at_period_end === "boolean"
            ? subscription.cancel_at_period_end
            : undefined,
        currentPeriodEnd:
          typeof subscription?.current_period_end === "number"
            ? subscription.current_period_end
            : undefined,
        eventType: "checkout.session.completed",
      })

      if (result.userId && result.becamePro) {
        await ctx.runMutation(internal.entitlements.unlockAllLockedNewslettersForUser, {
          userId: result.userId,
        })
      }
    },
    "customer.subscription.created": async (ctx, event) => {
      const eventId = String((event as any)?.id ?? "")
      if (eventId) {
        const isNew = await ctx.runMutation(internal.billing.recordWebhookEventIfNew, { eventId })
        if (!isNew) return
      }

      const subscription = (event as any)?.data?.object ?? {}
      const userId = String(subscription?.metadata?.userId ?? "")
      if (!userId) return

      const stripeCustomerId =
        typeof subscription?.customer === "string"
          ? subscription.customer
          : typeof subscription?.customer?.id === "string"
            ? subscription.customer.id
            : undefined

      const result = await ctx.runMutation(internal.billing.applySubscriptionUpdate, {
        userId,
        stripeCustomerId,
        stripeSubscriptionId: typeof subscription?.id === "string" ? subscription.id : undefined,
        status: typeof subscription?.status === "string" ? subscription.status : undefined,
        cancelAtPeriodEnd:
          typeof subscription?.cancel_at_period_end === "boolean"
            ? subscription.cancel_at_period_end
            : undefined,
        currentPeriodEnd:
          typeof subscription?.current_period_end === "number"
            ? subscription.current_period_end
            : undefined,
        eventType: "customer.subscription.created",
      })

      if (result.userId && result.becamePro) {
        await ctx.runMutation(internal.entitlements.unlockAllLockedNewslettersForUser, {
          userId: result.userId,
        })
      }
    },
    "customer.subscription.updated": async (ctx, event) => {
      const eventId = String((event as any)?.id ?? "")
      if (eventId) {
        const isNew = await ctx.runMutation(internal.billing.recordWebhookEventIfNew, { eventId })
        if (!isNew) return
      }

      const subscription = (event as any)?.data?.object ?? {}
      const userId = String(subscription?.metadata?.userId ?? "")
      if (!userId) return

      const stripeCustomerId =
        typeof subscription?.customer === "string"
          ? subscription.customer
          : typeof subscription?.customer?.id === "string"
            ? subscription.customer.id
            : undefined

      const result = await ctx.runMutation(internal.billing.applySubscriptionUpdate, {
        userId,
        stripeCustomerId,
        stripeSubscriptionId: typeof subscription?.id === "string" ? subscription.id : undefined,
        status: typeof subscription?.status === "string" ? subscription.status : undefined,
        cancelAtPeriodEnd:
          typeof subscription?.cancel_at_period_end === "boolean"
            ? subscription.cancel_at_period_end
            : undefined,
        currentPeriodEnd:
          typeof subscription?.current_period_end === "number"
            ? subscription.current_period_end
            : undefined,
        eventType: "customer.subscription.updated",
      })

      if (result.userId && result.becamePro) {
        await ctx.runMutation(internal.entitlements.unlockAllLockedNewslettersForUser, {
          userId: result.userId,
        })
      }
    },
    "customer.subscription.deleted": async (ctx, event) => {
      const eventId = String((event as any)?.id ?? "")
      if (eventId) {
        const isNew = await ctx.runMutation(internal.billing.recordWebhookEventIfNew, { eventId })
        if (!isNew) return
      }

      const subscription = (event as any)?.data?.object ?? {}
      const userId = String(subscription?.metadata?.userId ?? "")
      if (!userId) return

      const stripeCustomerId =
        typeof subscription?.customer === "string"
          ? subscription.customer
          : typeof subscription?.customer?.id === "string"
            ? subscription.customer.id
            : undefined

      await ctx.runMutation(internal.billing.applySubscriptionUpdate, {
        userId,
        stripeCustomerId,
        stripeSubscriptionId: typeof subscription?.id === "string" ? subscription.id : undefined,
        status: typeof subscription?.status === "string" ? subscription.status : undefined,
        cancelAtPeriodEnd:
          typeof subscription?.cancel_at_period_end === "boolean"
            ? subscription.cancel_at_period_end
            : undefined,
        currentPeriodEnd:
          typeof subscription?.current_period_end === "number"
            ? subscription.current_period_end
            : undefined,
        eventType: "customer.subscription.deleted",
      })
    },
  },
})

// Register Better Auth routes with CORS enabled for client-side framework compatibility
// Note: Better Auth handles its own error responses for auth failures
authComponent.registerRoutes(http, createAuth, {
  cors: process.env.SITE_URL
    ? { allowedOrigins: [process.env.SITE_URL] }
    : true,
})

// Fallback route for unmatched paths (optional - provides better error messages)
http.route({
  path: "/.well-known/*",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }),
})

export default http
