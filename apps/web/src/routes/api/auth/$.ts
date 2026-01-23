import { createFileRoute } from "@tanstack/react-router"
import { handler } from "~/lib/auth-server"

// Catch-all route for Better Auth API endpoints
// Proxies all /api/auth/* requests to the Better Auth handler
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handler(request),
      POST: ({ request }) => handler(request),
    },
  },
})
