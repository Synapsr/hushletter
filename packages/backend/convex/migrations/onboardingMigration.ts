import { internalAction, internalMutation, internalQuery } from "../_generated/server"
import { v } from "convex/values"
import { internal } from "../_generated/api"

/**
 * Onboarding Migration - Backfill onboardingCompletedAt for existing users
 *
 * Sets onboardingCompletedAt = Date.now() for all existing users so they
 * skip the new post-signup onboarding flow. Only new users (created after
 * this migration) will see the onboarding.
 *
 * IDEMPOTENT: Skips users that already have onboardingCompletedAt set.
 *
 * Run via Convex dashboard:
 *   npx convex run migrations/onboardingMigration:runMigration
 */

export const runMigration = internalAction({
  args: {},
  handler: async (ctx): Promise<{ updated: number; total: number }> => {
    const users: Array<{ _id: any }> = await ctx.runQuery(
      internal.migrations.onboardingMigration.getUsersWithoutOnboarding
    )

    let updated = 0
    for (const user of users) {
      await ctx.runMutation(
        internal.migrations.onboardingMigration.markOnboardingComplete,
        { userId: user._id }
      )
      updated++
    }

    return { updated, total: users.length }
  },
})

export const getUsersWithoutOnboarding = internalQuery({
  args: {},
  handler: async (ctx) => {
    const allUsers = await ctx.db.query("users").collect()
    return allUsers.filter((u) => u.onboardingCompletedAt === undefined)
  },
})

export const markOnboardingComplete = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.patch("users", args.userId, {
      onboardingCompletedAt: Date.now(),
    })
  },
})
