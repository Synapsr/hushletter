/**
 * Manual Import Actions
 * Story 8.2: Drag-and-Drop Import UI
 * Story 8.4: Duplicate Detection
 *
 * Provides Convex actions for importing newsletters from .eml files.
 * Uses the EML parser from @newsletter-manager/shared for client-side parsing,
 * then processes server-side for R2 upload and database storage.
 */

import { action } from "./_generated/server"
import { internal } from "./_generated/api"
import { v } from "convex/values"
import { ConvexError } from "convex/values"
import type { Id } from "./_generated/dataModel"

/** Result type for importEmlNewsletter - either success or duplicate skipped */
export type ImportEmlResult =
  | {
      userNewsletterId: Id<"userNewsletters">
      senderId: Id<"senders">
      skipped?: false
    }
  | {
      skipped: true
      reason: "duplicate"
      duplicateReason: "message_id" | "content_hash"
      existingId: Id<"userNewsletters">
      senderId: Id<"senders">
    }

/**
 * Import a newsletter from parsed EML data
 *
 * Story 8.2: Task 3 (AC #3)
 * Story 8.4: Task 4.1 - Handle duplicate detection
 *
 * Flow:
 * 1. Authenticate user
 * 2. Get user record from DB
 * 3. Get or create sender (via internal mutation)
 * 4. Get or create userSenderSettings for privacy check
 * 5. Call storeNewsletterContent to handle R2 upload and record creation
 * 6. If duplicate detected, return { skipped: true } (FR33 - no error shown)
 * 7. Return created userNewsletterId for navigation
 *
 * @param args Parsed EML data fields
 * @returns Newsletter ID and sender ID, or { skipped: true } if duplicate
 */
export const importEmlNewsletter = action({
  args: {
    subject: v.string(),
    senderEmail: v.string(),
    senderName: v.optional(v.string()),
    receivedAt: v.number(),
    htmlContent: v.optional(v.string()),
    textContent: v.optional(v.string()),
    messageId: v.optional(v.string()), // Story 8.4: For duplicate detection
  },
  handler: async (ctx, args): Promise<ImportEmlResult> => {
    console.log(
      `[manualImport] importEmlNewsletter: subject="${args.subject.substring(0, 50)}...", ` +
        `sender=${args.senderEmail}, receivedAt=${new Date(args.receivedAt).toISOString()}`
    )

    // 1. Authenticate user
    const user = await ctx.auth.getUserIdentity()
    if (!user) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      })
    }

    // 2. Get user record from DB
    const userDoc = await ctx.runQuery(internal.gmail.getUserByAuthId, {
      authId: user.subject,
    })

    if (!userDoc) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User not found",
      })
    }

    // 3. Get or create sender (it's an internalMutation in senders.ts)
    const sender = await ctx.runMutation(internal.senders.getOrCreateSender, {
      email: args.senderEmail,
      name: args.senderName,
    })

    console.log(
      `[manualImport] Sender retrieved/created: id=${sender._id}, email=${sender.email}`
    )

    // 4. Get or create userSenderSettings for privacy check
    const senderSettings = await ctx.runMutation(
      internal.senders.getOrCreateUserSenderSettings,
      {
        userId: userDoc._id,
        senderId: sender._id,
      }
    )

    const isPrivate = senderSettings.isPrivate ?? false

    console.log(
      `[manualImport] UserSenderSettings: isPrivate=${isPrivate}, settingsId=${senderSettings._id}`
    )

    // 5. Call storeNewsletterContent to handle R2 upload and record creation
    // This is the same action used by email ingestion, ensuring consistent behavior
    // Story 8.4: Pass messageId for duplicate detection
    const result = await ctx.runAction(internal.newsletters.storeNewsletterContent, {
      userId: userDoc._id,
      senderId: sender._id,
      subject: args.subject,
      senderEmail: args.senderEmail,
      senderName: args.senderName,
      receivedAt: args.receivedAt,
      htmlContent: args.htmlContent,
      textContent: args.textContent,
      isPrivate,
      messageId: args.messageId, // Story 8.4: For duplicate detection
    })

    // 6. Story 8.4: Handle duplicate detection (FR33 - no error, silent skip)
    if (result.skipped) {
      console.log(
        `[manualImport] Duplicate detected (${result.duplicateReason}): existingId=${result.existingId}`
      )
      return {
        skipped: true,
        reason: "duplicate",
        duplicateReason: result.duplicateReason,
        existingId: result.existingId,
        senderId: sender._id,
      }
    }

    console.log(
      `[manualImport] Newsletter stored: userNewsletterId=${result.userNewsletterId}, ` +
        `r2Key=${result.r2Key}, deduplicated=${result.deduplicated ?? false}`
    )

    // 7. Return IDs for navigation and confirmation
    return {
      userNewsletterId: result.userNewsletterId,
      senderId: sender._id,
    }
  },
})
