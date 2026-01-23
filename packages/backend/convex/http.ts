import { httpRouter } from "convex/server"
import { authComponent, createAuth } from "./auth"

const http = httpRouter()

// Register Better Auth routes with CORS enabled for client-side framework compatibility
// Note: Better Auth handles its own error responses for auth failures
authComponent.registerRoutes(http, createAuth, {
  cors: true,
  // CORS configuration for cross-origin requests
  allowedOrigins: process.env.SITE_URL ? [process.env.SITE_URL] : undefined,
})

// Fallback route for unmatched paths (optional - provides better error messages)
http.route({
  path: "/.well-known/*",
  method: "GET",
  handler: async () => {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  },
})

export default http
