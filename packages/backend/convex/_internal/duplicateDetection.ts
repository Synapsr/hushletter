/**
 * Duplicate Detection Service for Newsletter Imports
 * Story 8.4: Duplicate Detection
 *
 * Checks for duplicate newsletters using a two-tier approach:
 * 1. Message-ID lookup (most reliable - globally unique email identifier)
 * 2. Content hash lookup (fallback when no Message-ID available)
 *
 * Detection is scoped to the user to allow the same newsletter
 * to exist in multiple users' libraries.
 */

import { internalQuery } from "../_generated/server"
import { v } from "convex/values"
import type { Id } from "../_generated/dataModel"

/**
 * Result type for duplicate detection checks
 */
export type DuplicateCheckResult = {
  isDuplicate: boolean
  reason?: "message_id" | "content_hash"
  existingId?: Id<"userNewsletters">
}

/**
 * Check for duplicate newsletter by Message-ID
 *
 * Message-ID is the most reliable method - it should be globally unique
 * per RFC 5322. Most legitimate newsletters include this header.
 *
 * @param userId - User to check duplicates for
 * @param messageId - Email Message-ID header value (without angle brackets)
 * @returns Existing userNewsletter ID if duplicate found, null otherwise
 */
export const checkDuplicateByMessageId = internalQuery({
  args: {
    userId: v.id("users"),
    messageId: v.string(),
  },
  handler: async (ctx, args): Promise<Id<"userNewsletters"> | null> => {
    // Guard against empty messageId - should not match anything
    // (empty strings could cause false index matches)
    if (!args.messageId.trim()) {
      return null
    }

    const existing = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId_messageId", (q) =>
        q.eq("userId", args.userId).eq("messageId", args.messageId)
      )
      .first()

    return existing?._id ?? null
  },
})

/**
 * Check for duplicate newsletter by content hash
 *
 * Fallback method when no Message-ID is available.
 * Uses normalized content hash from Epic 2.5.2 deduplication pipeline.
 *
 * For PUBLIC newsletters: Checks if user already has a userNewsletter
 * referencing the same contentId (via contentHash lookup on newsletterContent).
 *
 * For PRIVATE newsletters: Private duplicate detection relies primarily
 * on messageId since private content isn't stored in shared newsletterContent.
 *
 * @param userId - User to check duplicates for
 * @param contentHash - SHA-256 hash of normalized content
 * @param isPrivate - Whether the sender is private for this user
 * @returns Existing userNewsletter ID if duplicate found, null otherwise
 */
export const checkDuplicateByContentHash = internalQuery({
  args: {
    userId: v.id("users"),
    contentHash: v.string(),
    isPrivate: v.boolean(),
  },
  handler: async (ctx, args): Promise<Id<"userNewsletters"> | null> => {
    if (!args.isPrivate) {
      // PUBLIC: Check if newsletterContent with this hash exists
      // and user already has a userNewsletter referencing it
      const content = await ctx.db
        .query("newsletterContent")
        .withIndex("by_contentHash", (q) => q.eq("contentHash", args.contentHash))
        .first()

      if (content) {
        // Check if user already has this content
        const existing = await ctx.db
          .query("userNewsletters")
          .withIndex("by_userId", (q) => q.eq("userId", args.userId))
          .filter((q) => q.eq(q.field("contentId"), content._id))
          .first()

        return existing?._id ?? null
      }
      return null
    } else {
      // PRIVATE: For private newsletters without messageId,
      // we cannot efficiently check duplicates via content hash
      // since private content isn't in shared newsletterContent.
      // Private senders rely primarily on messageId for deduplication.
      // This is acceptable because:
      // 1. Most emails have Message-ID headers
      // 2. Private newsletters without Message-ID are edge cases
      return null
    }
  },
})
