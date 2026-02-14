import { httpRouter } from "convex/server"
import { httpAction } from "./_generated/server"
import { authComponent, createAuth } from "./auth"
import { receiveEmail } from "./emailIngestion"
import {
  receiveImportEmail,
  verifyUser,
  logRejection,
} from "./importIngestion"
import { handlePolarWebhook } from "./billingWebhook"

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

// Polar billing webhooks (subscription status, etc.)
http.route({
  path: "/api/billing/polar/webhook",
  method: "POST",
  handler: handlePolarWebhook,
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
