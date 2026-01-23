import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start"

// Validate required environment variables at module load time
const convexUrl = process.env.VITE_CONVEX_URL
const convexSiteUrl = process.env.VITE_CONVEX_SITE_URL

if (!convexUrl) {
  throw new Error(
    "Missing required environment variable: VITE_CONVEX_URL. " +
    "Please set this in your .env file or deployment environment."
  )
}

if (!convexSiteUrl) {
  throw new Error(
    "Missing required environment variable: VITE_CONVEX_SITE_URL. " +
    "Please set this in your .env file or deployment environment."
  )
}

// Server-side auth utilities for TanStack Start
// Provides handler for API routes and token retrieval for SSR
export const {
  handler,
  getToken,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = convexBetterAuthReactStart({
  convexUrl,
  convexSiteUrl,
})
