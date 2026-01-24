import { betterAuth } from "better-auth/minimal"
import { createClient, type GenericCtx, type AuthFunctions } from "@convex-dev/better-auth"
import { convex } from "@convex-dev/better-auth/plugins"
import { components, internal } from "./_generated/api"
import type { DataModel } from "./_generated/dataModel"
import { query } from "./_generated/server"
import authConfig from "./auth.config"
import { generateDedicatedEmail } from "./_internal/emailGeneration"

// Site URL from environment (set in Convex dashboard)
const siteUrl = process.env.SITE_URL!

// Auth functions for triggers
const authFunctions: AuthFunctions = internal.auth

// The component client provides methods for integrating Convex with Better Auth
// Includes triggers to generate dedicated email on user creation
export const authComponent = createClient<DataModel>(components.betterAuth, {
  authFunctions,
  triggers: {
    user: {
      // Generate dedicated email when a new user is created
      onCreate: async (ctx, authUser) => {
        const dedicatedEmail = generateDedicatedEmail(authUser._id)
        // Store in app users table with link to Better Auth user
        await ctx.db.insert("users", {
          email: authUser.email,
          name: authUser.name ?? undefined,
          createdAt: Date.now(),
          authId: authUser._id,
          dedicatedEmail,
        })
      },
    },
  },
})

// Export trigger functions for Convex runtime
export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi()

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
    // Account linking configuration
    // Story 4.1: Allow linking Gmail accounts with different emails than login email
    // This is required for newsletter import - users may want to import from
    // a Gmail account different from their app login email
    account: {
      accountLinking: {
        enabled: true,
        allowDifferentEmails: true,
      },
    },
    // Social providers for OAuth authentication
    // Story 4.1: Gmail OAuth integration for newsletter import
    socialProviders: {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        // Request Gmail read-only access for newsletter import (Stories 4.2-4.4)
        // plus standard scopes for user identification
        scope: [
          "openid",
          "email",
          "profile",
          "https://www.googleapis.com/auth/gmail.readonly",
        ],
        // Story 4.2 fix: Required to get refresh tokens for Gmail API access
        // Without these, Google only returns tokens on first consent
        accessType: "offline",
        prompt: "consent",
      },
    },
    plugins: [
      // Convex plugin required for Convex compatibility
      convex({ authConfig }),
    ],
  })
}

// Query to get the current authenticated user with dedicated email
// Returns null if not authenticated (instead of throwing)
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    let authUser
    try {
      authUser = await authComponent.getAuthUser(ctx)
    } catch {
      // getAuthUser throws ConvexError when unauthenticated - this is expected
      return null
    }
    if (!authUser) return null

    // Get the app user record which has the dedicated email (linked by authId)
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
      .first()

    return {
      id: authUser._id,
      email: authUser.email,
      name: authUser.name,
      dedicatedEmail: user?.dedicatedEmail ?? null,
    }
  },
})
