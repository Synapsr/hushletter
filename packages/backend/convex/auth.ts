import { betterAuth } from "better-auth/minimal"
import { emailOTP } from "better-auth/plugins"
import { createClient, type GenericCtx, type AuthFunctions } from "@convex-dev/better-auth"
import { convex } from "@convex-dev/better-auth/plugins"
import { components, internal } from "./_generated/api"
import type { DataModel } from "./_generated/dataModel"
import { query } from "./_generated/server"
import authConfig from "./auth.config"
import { generateDedicatedEmail } from "./_internal/emailGeneration"

// Site URL from environment (set in Convex dashboard)
const siteUrl = process.env.SITE_URL!
const trustedOrigins = Array.from(
  new Set(
    [siteUrl, ...(process.env.AUTH_TRUSTED_ORIGINS ?? "").split(",")]
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  ),
)

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
        const dedicatedEmail = generateDedicatedEmail(authUser._id, authUser.name ?? undefined, authUser.email)
        // Store in app users table with link to Better Auth user
        const userId = await ctx.db.insert("users", {
          email: authUser.email,
          name: authUser.name ?? undefined,
          createdAt: Date.now(),
          authId: authUser._id,
          dedicatedEmail,
          plan: "free",
        })

        await ctx.db.insert("userUsageCounters", {
          userId,
          totalStored: 0,
          unlockedStored: 0,
          lockedStored: 0,
          updatedAt: Date.now(),
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
    trustedOrigins,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 8,
      sendResetPassword: async ({ user, url }) => {
        const resendApiKey = process.env.RESEND_API_KEY
        if (!resendApiKey) {
          console.error("RESEND_API_KEY not configured - cannot send reset email")
          return
        }
        const fromEmail = process.env.EMAIL_FROM || "Hushletter <noreply@hushletter.com>"
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [user.email],
            subject: "Reset your password",
            html: `<h2>Reset your password</h2>
              <p>Click below to reset your password. This link expires in 1 hour.</p>
              <a href="${url}" style="display:inline-block;padding:12px 24px;background:#000;color:#fff;text-decoration:none;border-radius:6px;">Reset Password</a>
              <p style="margin-top:16px;color:#666;font-size:14px;">If you didn't request this, you can safely ignore this email.</p>`,
          }),
        })
        if (!res.ok) {
          const body = await res.text().catch(() => "unknown")
          console.error(`Failed to send reset email: ${res.status} ${body}`)
        }
      },
      resetPasswordTokenExpiresIn: 3600,
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
      convex({ authConfig }),
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        async sendVerificationOTP({ email, otp, type }) {
          if (type !== "email-verification") return
          const resendApiKey = process.env.RESEND_API_KEY
          if (!resendApiKey) {
            console.error("RESEND_API_KEY not configured - cannot send OTP email")
            return
          }
          const fromEmail = process.env.EMAIL_FROM || "Hushletter <noreply@hushletter.com>"
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: fromEmail,
              to: [email],
              subject: "Your Hushletter verification code",
              html: `<p>Your verification code is: <strong>${otp}</strong></p><p>This code expires in 5 minutes.</p>`,
            }),
          })
          if (!res.ok) {
            const body = await res.text().catch(() => "unknown")
            console.error(`Failed to send OTP email: ${res.status} ${body}`)
            throw new Error("Failed to send verification email")
          }
        },
      }),
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
      onboardingCompletedAt: user?.onboardingCompletedAt ?? null,
      createdAt: user?.createdAt ?? null,
      plan: user?.plan ?? "free",
      proExpiresAt: user?.proExpiresAt ?? null,
      vanityEmail: user?.vanityEmail ?? null,
    }
  },
})
