import { betterAuth } from "better-auth/minimal"
import { createClient, type GenericCtx } from "@convex-dev/better-auth"
import { convex } from "@convex-dev/better-auth/plugins"
import { components } from "./_generated/api"
import type { DataModel } from "./_generated/dataModel"
import { query } from "./_generated/server"
import authConfig from "./auth.config"

// Site URL from environment (set in Convex dashboard)
const siteUrl = process.env.SITE_URL!

// The component client provides methods for integrating Convex with Better Auth
export const authComponent = createClient<DataModel>(components.betterAuth)

// Create the Better Auth instance with Convex adapter
export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    // Email/password authentication - MVP setup without email verification
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false, // MVP - add verification in future story
      minPasswordLength: 8,
    },
    plugins: [
      // Convex plugin required for Convex compatibility
      convex({ authConfig }),
    ],
  })
}

// Query to get the current authenticated user
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return await authComponent.getAuthUser(ctx)
  },
})
