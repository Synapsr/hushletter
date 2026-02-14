import { internalQuery } from "../_generated/server"
import { v } from "convex/values"

/**
 * Find a user by their dedicated email address
 * Used by the email worker to validate incoming emails
 */
export const findByDedicatedEmail = internalQuery({
  args: { dedicatedEmail: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_dedicatedEmail", (q) =>
        q.eq("dedicatedEmail", args.dedicatedEmail)
      )
      .first()
  },
})

/**
 * Find a user by an inbound email address (dedicated or vanity alias).
 * Used by email ingestion to support Pro vanity aliases without breaking
 * the stable dedicated receiver address.
 */
export const findByInboundEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const byDedicated = await ctx.db
      .query("users")
      .withIndex("by_dedicatedEmail", (q) => q.eq("dedicatedEmail", args.email))
      .first()
    if (byDedicated) return byDedicated

    return await ctx.db
      .query("users")
      .withIndex("by_vanityEmail", (q) => q.eq("vanityEmail", args.email))
      .first()
  },
})

/**
 * Find a user by their auth ID (Better Auth subject)
 * Used for permission checks in actions
 */
export const findByAuthId = internalQuery({
  args: { authId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", args.authId))
      .first()
  },
})

/**
 * Find a user by their registered email address
 * Story 8.3: Task 2.1 - Used by import handler to verify forwarding user is registered
 *
 * Performs case-insensitive matching by normalizing email to lowercase.
 *
 * IMPORTANT: This assumes the `users` table stores emails in lowercase.
 * The by_email index expects lowercase values. If users are stored with
 * mixed-case emails (e.g., "User@Example.com"), lookups may fail.
 * Better Auth normalizes emails to lowercase during registration, so this
 * assumption holds for all users created through the normal auth flow.
 */
export const findByRegisteredEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    // Normalize email to lowercase for case-insensitive matching
    const normalizedEmail = args.email.toLowerCase()

    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first()
  },
})

/**
 * Find a user by their ID
 * Story 8.3: Task 2.1 - Used for validation in import ingestion
 */
export const findById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId)
  },
})
