import { query, mutation, action } from "./_generated/server"
import { v } from "convex/values"
import { ConvexError } from "convex/values"
import { authComponent } from "./auth"
import {
  isValidCustomPrefix,
  buildDedicatedEmail,
  getEmailDomain as getEmailDomainInternal,
} from "./_internal/emailGeneration"
import { isUserPro } from "./entitlements"

/**
 * Update the current user's profile information.
 * Currently supports updating the display name.
 */
export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get authenticated user
    const authUser = await authComponent.getAuthUser(ctx)
    if (!authUser) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to update your profile",
      })
    }

    // Find app user record linked to auth user
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
      .first()

    if (!user) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User profile not found",
      })
    }

    // Update the user's name
    await ctx.db.patch("users", user._id, {
      name: args.name,
    })

    return { success: true }
  },
})

/**
 * Check if an email prefix is available for claiming.
 * Reactive Convex query — auto-updates if someone else claims the prefix.
 */
export const checkPrefixAvailability = query({
  args: {
    prefix: v.string(),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.getAuthUser(ctx).catch(() => null)
    if (!authUser) {
      return { available: false, reason: "UNAUTHORIZED" as const }
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
      .first()

    if (!currentUser) {
      return { available: false, reason: "UNAUTHORIZED" as const }
    }

    if (!isUserPro({ plan: currentUser.plan ?? "free", proExpiresAt: currentUser.proExpiresAt })) {
      return { available: false, reason: "PRO_REQUIRED" as const }
    }

    const prefix = args.prefix.toLowerCase().trim()

    if (!isValidCustomPrefix(prefix)) {
      return { available: false, reason: "INVALID_FORMAT" as const }
    }

    const dedicatedEmail = buildDedicatedEmail(prefix)
    const existingDedicated = await ctx.db
      .query("users")
      .withIndex("by_dedicatedEmail", (q) => q.eq("dedicatedEmail", dedicatedEmail))
      .first()

    const existingVanity = await ctx.db
      .query("users")
      .withIndex("by_vanityEmail", (q) => q.eq("vanityEmail", dedicatedEmail))
      .first()

    const existingUser = existingDedicated ?? existingVanity

    if (existingUser && existingUser._id !== currentUser._id) {
      return { available: false, reason: "TAKEN" as const }
    }

    if (dedicatedEmail === currentUser.dedicatedEmail || dedicatedEmail === currentUser.vanityEmail) {
      return { available: true, reason: "OWN_EMAIL" as const }
    }

    return { available: true, reason: "AVAILABLE" as const }
  },
})

/**
 * Claim a custom email prefix during onboarding.
 * Atomically validates, checks uniqueness, and updates dedicatedEmail.
 * Also marks onboarding as completed.
 */
export const claimEmailPrefix = mutation({
  args: {
    prefix: v.string(),
  },
  handler: async (ctx, args) => {
    const authUser = await authComponent.getAuthUser(ctx)
    if (!authUser) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to claim an email prefix",
      })
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
      .first()

    if (!user) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User profile not found",
      })
    }

    if (!isUserPro({ plan: user.plan ?? "free", proExpiresAt: user.proExpiresAt })) {
      throw new ConvexError({
        code: "PRO_REQUIRED",
        message: "Hushletter Pro is required to claim a custom email prefix.",
      })
    }

    const prefix = args.prefix.toLowerCase().trim()

    if (!isValidCustomPrefix(prefix)) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Invalid email prefix format. Use 3-20 lowercase letters, numbers, and hyphens.",
      })
    }

    // Atomic check: is the email taken by someone else?
    const vanityEmail = buildDedicatedEmail(prefix)
    const existingDedicated = await ctx.db
      .query("users")
      .withIndex("by_dedicatedEmail", (q) => q.eq("dedicatedEmail", vanityEmail))
      .first()

    const existingVanity = await ctx.db
      .query("users")
      .withIndex("by_vanityEmail", (q) => q.eq("vanityEmail", vanityEmail))
      .first()

    const existingUser = existingDedicated ?? existingVanity

    if (existingUser && existingUser._id !== user._id) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "This email prefix is already taken",
      })
    }

    await ctx.db.patch("users", user._id, {
      vanityEmail,
      onboardingCompletedAt: user.onboardingCompletedAt ?? Date.now(),
    })

    return { success: true, dedicatedEmail: vanityEmail }
  },
})

/**
 * Complete onboarding without changing email prefix.
 * Used when user accepts the auto-generated prefix.
 */
export const completeOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const authUser = await authComponent.getAuthUser(ctx)
    if (!authUser) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "You must be logged in",
      })
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
      .first()

    if (!user) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User profile not found",
      })
    }

    await ctx.db.patch("users", user._id, {
      onboardingCompletedAt: Date.now(),
    })

    return { success: true }
  },
})

/**
 * Get the configured email domain for display in the frontend.
 */
export const getEmailDomain = query({
  args: {},
  handler: async () => {
    return getEmailDomainInternal()
  },
})

/**
 * Send authenticated user feedback to Discord via webhook.
 */
export const sendFeedbackToDiscord = action({
  args: {
    subject: v.string(),
    message: v.string(),
    page: v.optional(v.string()),
  },
  returns: v.object({
    ok: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to send feedback",
      })
    }

    const subject = args.subject.trim()
    const message = args.message.trim()
    const page = args.page?.trim()

    if (subject.length < 3 || subject.length > 120) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Subject must be between 3 and 120 characters.",
      })
    }

    if (message.length < 10 || message.length > 2000) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Message must be between 10 and 2000 characters.",
      })
    }

    const webhookUrl = process.env.DISCORD_FEEDBACK_WEBHOOK_URL
    if (!webhookUrl) {
      throw new ConvexError({
        code: "CONFIG_ERROR",
        message: "Feedback webhook is not configured.",
      })
    }

    const feedbackUser = await authComponent.getAuthUser(ctx).catch(() => null)
    const userLabel = feedbackUser?.name
      ? `${feedbackUser.name} <${feedbackUser.email}>`
      : feedbackUser?.email ?? identity.tokenIdentifier

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        embeds: [
          {
            title: subject,
            description: message,
            fields: [
              {
                name: "User",
                value: userLabel.slice(0, 1024),
              },
              {
                name: "Page",
                value: (page && page.length > 0 ? page : "Unknown").slice(
                  0,
                  1024,
                ),
              },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      }),
    })

    if (!response.ok) {
      await response.text().catch(() => "unknown")
      throw new ConvexError({
        code: "EXTERNAL_SERVICE_ERROR",
        message: "Failed to submit feedback. Please try again.",
      })
    }

    return { ok: true }
  },
})
