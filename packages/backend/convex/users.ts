import { query, mutation } from "./_generated/server"
import { v } from "convex/values"
import { ConvexError } from "convex/values"
import { authComponent } from "./auth"
import {
  isValidCustomPrefix,
  buildDedicatedEmail,
  getEmailDomain as getEmailDomainInternal,
} from "./_internal/emailGeneration"

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
    await ctx.db.patch(user._id, {
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

    const prefix = args.prefix.toLowerCase().trim()

    if (!isValidCustomPrefix(prefix)) {
      return { available: false, reason: "INVALID_FORMAT" as const }
    }

    const dedicatedEmail = buildDedicatedEmail(prefix)
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_dedicatedEmail", (q) => q.eq("dedicatedEmail", dedicatedEmail))
      .first()

    if (existingUser) {
      // Allow user to reclaim their own current prefix
      const currentUser = await ctx.db
        .query("users")
        .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
        .first()

      if (currentUser && currentUser._id === existingUser._id) {
        return { available: true, reason: "OWN_EMAIL" as const }
      }
      return { available: false, reason: "TAKEN" as const }
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

    const prefix = args.prefix.toLowerCase().trim()

    if (!isValidCustomPrefix(prefix)) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Invalid email prefix format. Use 3-20 lowercase letters, numbers, and hyphens.",
      })
    }

    // Atomic check: is the email taken by someone else?
    const dedicatedEmail = buildDedicatedEmail(prefix)
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_dedicatedEmail", (q) => q.eq("dedicatedEmail", dedicatedEmail))
      .first()

    if (existingUser && existingUser._id !== user._id) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "This email prefix is already taken",
      })
    }

    await ctx.db.patch(user._id, {
      dedicatedEmail,
      onboardingCompletedAt: Date.now(),
    })

    return { success: true, dedicatedEmail }
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

    await ctx.db.patch(user._id, {
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
