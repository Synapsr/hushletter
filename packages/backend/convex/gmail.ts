/**
 * Gmail Integration Queries and Scan Functions
 * Story 4.1: Gmail OAuth Connection
 * Story 4.2: Newsletter Sender Scanning
 *
 * Provides queries to check Gmail connection status and retrieve account information.
 * Also provides scanning functionality to detect newsletter senders.
 * Tokens are NEVER exposed to the client - only connection status and email are returned.
 */

import { query, mutation, internalMutation, internalQuery, action, internalAction } from "./_generated/server"
import { v, ConvexError } from "convex/values"
import { internal, api } from "./_generated/api"
import { authComponent } from "./auth"
import {
  calculateNewsletterScore,
  extractSenderEmail,
  extractSenderName,
  extractDomain,
  NEWSLETTER_THRESHOLD,
  type EmailHeaders,
} from "./_internal/newsletterDetection"
import { isUserPro } from "./entitlements"
import type { GmailMessageDetail } from "./gmailApi"
import type { Id } from "./_generated/dataModel"

/**
 * Check if the current user has any connected Gmail account
 * Replaced old Better Auth based check with gmailConnections query
 */
export const isGmailConnected = query({
  args: {},
  handler: async (ctx): Promise<boolean> => {
    const authUser = await authComponent.safeGetAuthUser(ctx)
    if (!authUser) return false

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
      .first()
    if (!user) return false

    const connections = await ctx.db
      .query("gmailConnections")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()

    return connections.some((c) => c.isActive)
  },
})

/**
 * Get the first connected Gmail account (backward compat for old UI)
 * New UI should use gmailConnections.getGmailConnections instead
 */
export const getGmailAccount = query({
  args: {},
  handler: async (ctx): Promise<{ email: string; connectedAt: number } | null> => {
    const authUser = await authComponent.safeGetAuthUser(ctx)
    if (!authUser) return null

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
      .first()
    if (!user) return null

    const connection = await ctx.db
      .query("gmailConnections")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first()

    if (!connection || !connection.isActive) return null

    return {
      email: connection.email,
      connectedAt: connection.connectedAt,
    }
  },
})

/**
 * Internal mutation to clean up user's scan data for a specific connection
 * Newsletter preservation: NEVER deletes userNewsletters or newsletterContent
 */
export const cleanupUserScanData = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<void> => {
    // Delete all scan progress for this user
    const progress = await ctx.db
      .query("gmailScanProgress")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect()
    for (const p of progress) {
      await ctx.db.delete(p._id)
    }

    // Delete detected senders
    const senders = await ctx.db
      .query("detectedSenders")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect()
    for (const sender of senders) {
      await ctx.db.delete(sender._id)
    }
  },
})

// ============================================================
// Story 4.2: Newsletter Sender Scanning
// ============================================================

// Types for scan progress and detected senders
type ScanProgress = {
  _id: Id<"gmailScanProgress">
  userId: Id<"users">
  status: "scanning" | "complete" | "error"
  totalEmails: number
  processedEmails: number
  sendersFound: number
  startedAt: number
  completedAt?: number
  error?: string
}

type DetectedSender = {
  _id: Id<"detectedSenders">
  userId: Id<"users">
  email: string
  name?: string
  domain: string
  emailCount: number
  confidenceScore: number
  sampleSubjects: string[]
  detectedAt: number
  isSelected: boolean // Story 4.3: Selection state for import approval (defaults to true if undefined)
  isApproved: boolean // Story 4.3: Approval state after user confirms (defaults to false if undefined)
}

/**
 * Get current scan progress for a specific Gmail connection
 *
 * @returns Scan progress object or null if no scan has been started
 */
export const getScanProgress = query({
  args: {
    gmailConnectionId: v.optional(v.id("gmailConnections")),
  },
  handler: async (ctx, args): Promise<ScanProgress | null> => {
    const authUser = await authComponent.safeGetAuthUser(ctx)
    if (!authUser) return null

    if (args.gmailConnectionId) {
      const progress = await ctx.db
        .query("gmailScanProgress")
        .withIndex("by_gmailConnectionId", (q) => q.eq("gmailConnectionId", args.gmailConnectionId))
        .first()
      return progress as ScanProgress | null
    }

    // Fallback: get by userId (for backward compat)
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
      .first()
    if (!user) return null

    const progress = await ctx.db
      .query("gmailScanProgress")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first()
    return progress as ScanProgress | null
  },
})

/**
 * Get detected senders for a specific Gmail connection
 *
 * @returns Array of detected senders sorted by email count (descending)
 */
export const getDetectedSenders = query({
  args: {
    gmailConnectionId: v.optional(v.id("gmailConnections")),
  },
  handler: async (ctx, args): Promise<DetectedSender[]> => {
    const authUser = await authComponent.safeGetAuthUser(ctx)
    if (!authUser) return []

    let senders
    if (args.gmailConnectionId) {
      senders = await ctx.db
        .query("detectedSenders")
        .withIndex("by_gmailConnectionId", (q) => q.eq("gmailConnectionId", args.gmailConnectionId))
        .collect()
    } else {
      // Fallback: get by userId
      const user = await ctx.db
        .query("users")
        .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
        .first()
      if (!user) return []

      senders = await ctx.db
        .query("detectedSenders")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .collect()
    }

    return senders
      .map((sender) => ({
        ...sender,
        isSelected: sender.isSelected ?? true,
        isApproved: sender.isApproved ?? false,
      }))
      .sort((a, b) => b.emailCount - a.emailCount)
  },
})

/**
 * Internal mutation to initialize scan progress
 * Story 4.2: Task 3.3, 3.5 - Initialize progress tracking
 * Scoped by gmailConnectionId for multi-account support
 */
export const initScanProgress = internalMutation({
  args: {
    userId: v.id("users"),
    gmailConnectionId: v.id("gmailConnections"),
    totalEmails: v.number(),
  },
  handler: async (ctx, args): Promise<Id<"gmailScanProgress">> => {
    // Delete any existing scan progress for this connection
    const existingProgress = await ctx.db
      .query("gmailScanProgress")
      .withIndex("by_gmailConnectionId", (q) => q.eq("gmailConnectionId", args.gmailConnectionId))
      .collect()

    for (const p of existingProgress) {
      await ctx.db.delete(p._id)
    }

    // Delete existing detected senders for this connection (clean slate for rescan)
    const existingSenders = await ctx.db
      .query("detectedSenders")
      .withIndex("by_gmailConnectionId", (q) => q.eq("gmailConnectionId", args.gmailConnectionId))
      .collect()

    for (const sender of existingSenders) {
      await ctx.db.delete(sender._id)
    }

    // Create new scan progress record
    return await ctx.db.insert("gmailScanProgress", {
      userId: args.userId,
      gmailConnectionId: args.gmailConnectionId,
      status: "scanning",
      totalEmails: args.totalEmails,
      processedEmails: 0,
      sendersFound: 0,
      startedAt: Date.now(),
    })
  },
})

/**
 * Internal mutation to update scan progress
 * Story 4.2: Task 3.5 - Progress update mutations for real-time UI feedback
 */
export const updateScanProgress = internalMutation({
  args: {
    progressId: v.id("gmailScanProgress"),
    processedEmails: v.number(),
    sendersFound: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    await ctx.db.patch(args.progressId, {
      processedEmails: args.processedEmails,
      sendersFound: args.sendersFound,
    })
  },
})

/**
 * Internal mutation to complete scan
 * Story 4.2: Task 3.5 - Mark scan as complete or error
 */
export const completeScan = internalMutation({
  args: {
    progressId: v.id("gmailScanProgress"),
    status: v.union(v.literal("complete"), v.literal("error")),
    error: v.optional(v.string()),
    sendersFound: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<void> => {
    const updates: {
      status: "complete" | "error"
      completedAt: number
      error?: string
      sendersFound?: number
    } = {
      status: args.status,
      completedAt: Date.now(),
    }

    if (args.error) {
      updates.error = args.error
    }

    if (args.sendersFound !== undefined) {
      updates.sendersFound = args.sendersFound
    }

    await ctx.db.patch(args.progressId, updates)
  },
})

/**
 * Internal mutation to add or update a detected sender
 * Story 4.2: Task 3.4, 3.6 - Store scan results
 * Scoped by gmailConnectionId for multi-account support
 */
export const upsertDetectedSender = internalMutation({
  args: {
    userId: v.id("users"),
    gmailConnectionId: v.id("gmailConnections"),
    email: v.string(),
    name: v.optional(v.string()),
    domain: v.string(),
    emailCount: v.number(),
    confidenceScore: v.number(),
    sampleSubjects: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    // Check if sender already exists for this user+email combo
    const existingSender = await ctx.db
      .query("detectedSenders")
      .withIndex("by_userId_email", (q) =>
        q.eq("userId", args.userId).eq("email", args.email)
      )
      .first()

    if (existingSender) {
      await ctx.db.patch(existingSender._id, {
        name: args.name ?? existingSender.name,
        gmailConnectionId: args.gmailConnectionId,
        emailCount: args.emailCount,
        confidenceScore: Math.max(args.confidenceScore, existingSender.confidenceScore),
        sampleSubjects: args.sampleSubjects,
        detectedAt: Date.now(),
      })
    } else {
      await ctx.db.insert("detectedSenders", {
        userId: args.userId,
        gmailConnectionId: args.gmailConnectionId,
        email: args.email,
        name: args.name,
        domain: args.domain,
        emailCount: args.emailCount,
        confidenceScore: args.confidenceScore,
        sampleSubjects: args.sampleSubjects,
        detectedAt: Date.now(),
        isSelected: true,
        isApproved: false,
      })
    }
  },
})

/**
 * Helper to extract headers from Gmail message detail
 */
function extractHeaders(message: GmailMessageDetail): EmailHeaders {
  const headers: EmailHeaders = {
    from: "",
    subject: "",
  }

  if (!message.payload?.headers) {
    return headers
  }

  for (const header of message.payload.headers) {
    const name = header.name.toLowerCase()
    const value = header.value

    switch (name) {
      case "from":
        headers.from = value
        break
      case "subject":
        headers.subject = value
        break
      case "list-unsubscribe":
        headers["list-unsubscribe"] = value
        break
      case "list-id":
        headers["list-id"] = value
        break
      case "precedence":
        headers.precedence = value
        break
    }
  }

  return headers
}

/**
 * Start Gmail scan action
 * Story 4.2: Task 3.1 - Main scan action with progress tracking
 * Now scoped by gmailConnectionId for multi-account support
 */
export const startScan = action({
  args: {
    gmailConnectionId: v.id("gmailConnections"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    let progressId: Id<"gmailScanProgress"> | null = null

    try {
      const authUser = await ctx.runQuery(api.auth.getCurrentUser)
      if (!authUser) {
        return { success: false, error: "Please sign in to scan your Gmail." }
      }

      if (
        !isUserPro({
          plan: authUser.plan ?? "free",
          proExpiresAt: authUser.proExpiresAt ?? undefined,
        })
      ) {
        return { success: false, error: "Hushletter Pro is required to scan and import from Gmail." }
      }

      const user = await ctx.runQuery(internal.gmail.getUserByAuthId, {
        authId: authUser.id,
      })
      if (!user) {
        return { success: false, error: "User account not found." }
      }

      // Check for existing scan in progress for this connection
      const existingProgress = await ctx.runQuery(internal.gmail.getExistingScanProgress, {
        gmailConnectionId: args.gmailConnectionId,
      })
      if (existingProgress?.status === "scanning") {
        return { success: false, error: "A scan is already in progress. Please wait for it to complete." }
      }

      // Step 1: Get initial list of potential newsletter messages
      const initialList = await ctx.runAction(internal.gmailApi.listNewsletterMessages, {
        gmailConnectionId: args.gmailConnectionId,
        maxResults: 100,
      })

      const totalEstimate = initialList.total ?? initialList.messages.length

      progressId = await ctx.runMutation(internal.gmail.initScanProgress, {
        userId: user._id,
        gmailConnectionId: args.gmailConnectionId,
        totalEmails: totalEstimate,
      })

      // Collect all message IDs (paginate if needed)
      let allMessageIds: string[] = initialList.messages.map((m) => m.id)
      let nextPageToken = initialList.nextPageToken
      let pageCount = 1
      const MAX_PAGES = 10

      while (nextPageToken && pageCount < MAX_PAGES) {
        const nextPage = await ctx.runAction(internal.gmailApi.listNewsletterMessages, {
          gmailConnectionId: args.gmailConnectionId,
          maxResults: 100,
          pageToken: nextPageToken,
        })
        allMessageIds = allMessageIds.concat(nextPage.messages.map((m) => m.id))
        nextPageToken = nextPage.nextPageToken
        pageCount++
      }

      // Step 2: Fetch message details and analyze in batches
      const senderMap = new Map<
        string,
        {
          email: string
          name: string | null
          domain: string
          emailCount: number
          maxScore: number
          subjects: string[]
        }
      >()

      const BATCH_SIZE = 50
      let processedCount = 0

      for (let i = 0; i < allMessageIds.length; i += BATCH_SIZE) {
        const batchIds = allMessageIds.slice(i, i + BATCH_SIZE)

        const messages = await ctx.runAction(internal.gmailApi.getMessageDetails, {
          gmailConnectionId: args.gmailConnectionId,
          messageIds: batchIds,
          logSampleMessage: i === 0,
        })

        let skippedLowScore = 0
        let skippedNoFrom = 0
        for (const message of messages) {
          const headers = extractHeaders(message)

          if (!headers.from) {
            skippedNoFrom++
            continue
          }

          const score = calculateNewsletterScore(headers)

          if (score >= NEWSLETTER_THRESHOLD) {
            const senderEmail = extractSenderEmail(headers.from)
            const existing = senderMap.get(senderEmail)

            if (existing) {
              existing.emailCount++
              existing.maxScore = Math.max(existing.maxScore, score)
              if (existing.subjects.length < 5 && headers.subject) {
                existing.subjects.push(headers.subject)
              }
              if (!existing.name && headers.from) {
                existing.name = extractSenderName(headers.from)
              }
            } else {
              senderMap.set(senderEmail, {
                email: senderEmail,
                name: extractSenderName(headers.from),
                domain: extractDomain(senderEmail),
                emailCount: 1,
                maxScore: score,
                subjects: headers.subject ? [headers.subject] : [],
              })
            }
          } else {
            skippedLowScore++
          }
        }

        processedCount += batchIds.length

        await ctx.runMutation(internal.gmail.updateScanProgress, {
          progressId,
          processedEmails: processedCount,
          sendersFound: senderMap.size,
        })
      }

      // Step 3: Save detected senders to database
      for (const sender of senderMap.values()) {
        await ctx.runMutation(internal.gmail.upsertDetectedSender, {
          userId: user._id,
          gmailConnectionId: args.gmailConnectionId,
          email: sender.email,
          name: sender.name ?? undefined,
          domain: sender.domain,
          emailCount: sender.emailCount,
          confidenceScore: sender.maxScore,
          sampleSubjects: sender.subjects,
        })
      }

      await ctx.runMutation(internal.gmail.completeScan, {
        progressId,
        status: "complete",
        sendersFound: senderMap.size,
      })

      return { success: true }
    } catch (error) {
      console.error("[gmail.startScan] Scan failed:", error)

      const errorMessage =
        error instanceof ConvexError
          ? error.data.message
          : error instanceof Error
            ? error.message
            : "An unexpected error occurred"

      if (progressId) {
        try {
          await ctx.runMutation(internal.gmail.completeScan, {
            progressId,
            status: "error",
            error: errorMessage,
          })
        } catch (updateError) {
          console.error("[gmail.startScan] Failed to update progress to error:", updateError)
        }
      }

      return { success: false, error: errorMessage }
    }
  },
})

/**
 * Internal query to get user by authId
 * Helper for the scan action
 */
export const getUserByAuthId = internalQuery({
  args: { authId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", args.authId))
      .first()
  },
})

/**
 * Internal query to check for existing scan progress
 * Scoped by gmailConnectionId for multi-account support
 */
export const getExistingScanProgress = internalQuery({
  args: { gmailConnectionId: v.id("gmailConnections") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("gmailScanProgress")
      .withIndex("by_gmailConnectionId", (q) => q.eq("gmailConnectionId", args.gmailConnectionId))
      .first()
  },
})

// ============================================================
// Story 4.3: Sender Review & Approval
// ============================================================

/**
 * Update selection state for a single sender
 * Story 4.3: Task 1.2 (AC #1, #5)
 *
 * @param senderId - The ID of the detected sender to update
 * @param isSelected - Whether the sender should be selected for import
 */
export const updateSenderSelection = mutation({
  args: {
    senderId: v.id("detectedSenders"),
    isSelected: v.boolean(),
  },
  handler: async (ctx, args): Promise<void> => {
    const authUser = await authComponent.safeGetAuthUser(ctx)
    if (!authUser) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Please sign in to update sender selection.",
      })
    }

    // Get the app user record
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
      .first()

    if (!user) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User account not found.",
      })
    }

    // Get the sender and verify ownership
    const sender = await ctx.db.get(args.senderId)
    if (!sender) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Sender not found.",
      })
    }

    if (sender.userId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Cannot modify this sender.",
      })
    }

    await ctx.db.patch(args.senderId, { isSelected: args.isSelected })
  },
})

/**
 * Select all detected senders for import
 * Story 4.3: Task 1.3 (AC #2)
 */
export const selectAllSenders = mutation({
  args: {},
  handler: async (ctx): Promise<{ updatedCount: number }> => {
    const authUser = await authComponent.safeGetAuthUser(ctx)
    if (!authUser) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Please sign in to update sender selection.",
      })
    }

    // Get the app user record
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
      .first()

    if (!user) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User account not found.",
      })
    }

    // Get all unselected senders for this user
    const senders = await ctx.db
      .query("detectedSenders")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()

    // Update all to selected (treating undefined as true, so only update explicit false)
    const unselectedSenders = senders.filter((s) => s.isSelected === false)
    await Promise.all(
      unselectedSenders.map((s) => ctx.db.patch(s._id, { isSelected: true }))
    )

    return { updatedCount: unselectedSenders.length }
  },
})

/**
 * Deselect all detected senders
 * Story 4.3: Task 1.3 (AC #2)
 */
export const deselectAllSenders = mutation({
  args: {},
  handler: async (ctx): Promise<{ updatedCount: number }> => {
    const authUser = await authComponent.safeGetAuthUser(ctx)
    if (!authUser) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Please sign in to update sender selection.",
      })
    }

    // Get the app user record
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
      .first()

    if (!user) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User account not found.",
      })
    }

    // Get all selected senders for this user
    const senders = await ctx.db
      .query("detectedSenders")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()

    // Update all to deselected (treating undefined as true, so deselect those too)
    const selectedSenders = senders.filter((s) => s.isSelected !== false)
    await Promise.all(
      selectedSenders.map((s) => ctx.db.patch(s._id, { isSelected: false }))
    )

    return { updatedCount: selectedSenders.length }
  },
})

/**
 * Get count of selected senders for real-time display
 * Story 4.3: Task 1.4 (AC #5)
 *
 * @returns Object with selected count and total count
 */
export const getSelectedSendersCount = query({
  args: {},
  handler: async (ctx): Promise<{ selectedCount: number; totalCount: number }> => {
    const authUser = await authComponent.safeGetAuthUser(ctx)
    if (!authUser) {
      return { selectedCount: 0, totalCount: 0 }
    }

    // Get the app user record
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
      .first()

    if (!user) {
      return { selectedCount: 0, totalCount: 0 }
    }

    // Get all detected senders for this user
    const allSenders = await ctx.db
      .query("detectedSenders")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()

    // Count selected senders (default to true if isSelected is undefined - per AC#1)
    const selectedCount = allSenders.filter((s) => s.isSelected ?? true).length

    return { selectedCount, totalCount: allSenders.length }
  },
})

/**
 * Approve selected senders for import
 * Story 4.3: Task 5.2 (AC #4)
 *
 * Marks selected senders as approved for import (used by Story 4.4)
 */
export const approveSelectedSenders = mutation({
  args: {},
  handler: async (ctx): Promise<{ approvedCount: number }> => {
    const authUser = await authComponent.safeGetAuthUser(ctx)
    if (!authUser) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "Please sign in to approve senders.",
      })
    }

    // Get the app user record
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
      .first()

    if (!user) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "User account not found.",
      })
    }

    if (!isUserPro({ plan: user.plan ?? "free", proExpiresAt: user.proExpiresAt })) {
      throw new ConvexError({
        code: "PRO_REQUIRED",
        message: "Hushletter Pro is required to import from Gmail.",
      })
    }

    // Get all selected senders for this user (treating undefined as true)
    const selectedSenders = await ctx.db
      .query("detectedSenders")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()
      .then((senders) => senders.filter((s) => s.isSelected !== false))

    if (selectedSenders.length === 0) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "No senders selected for import.",
      })
    }

    // Mark all selected senders as approved
    await Promise.all(
      selectedSenders.map((s) => ctx.db.patch(s._id, { isApproved: true }))
    )

    return { approvedCount: selectedSenders.length }
  },
})

// ============================================================
// Story 4.4: Historical Email Import
// ============================================================

// Type for import progress
type ImportProgress = {
  _id: Id<"gmailImportProgress">
  userId: Id<"users">
  status: "pending" | "importing" | "complete" | "error"
  totalEmails: number
  importedEmails: number
  failedEmails: number
  skippedEmails: number
  startedAt: number
  completedAt?: number
  error?: string
}

/**
 * Get current import progress for a specific Gmail connection
 *
 * @returns Import progress object or null if no import has been started
 */
export const getImportProgress = query({
  args: {
    gmailConnectionId: v.optional(v.id("gmailConnections")),
  },
  handler: async (ctx, args): Promise<ImportProgress | null> => {
    const authUser = await authComponent.safeGetAuthUser(ctx)
    if (!authUser) return null

    if (args.gmailConnectionId) {
      const progress = await ctx.db
        .query("gmailImportProgress")
        .withIndex("by_gmailConnectionId", (q) => q.eq("gmailConnectionId", args.gmailConnectionId))
        .first()
      return progress as ImportProgress | null
    }

    // Fallback: get by userId
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
      .first()
    if (!user) return null

    const progress = await ctx.db
      .query("gmailImportProgress")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first()
    return progress as ImportProgress | null
  },
})

/**
 * Internal mutation to initialize import progress
 * Scoped by gmailConnectionId for multi-account support
 */
export const initImportProgress = internalMutation({
  args: {
    userId: v.id("users"),
    gmailConnectionId: v.id("gmailConnections"),
    totalEmails: v.number(),
  },
  handler: async (ctx, args): Promise<Id<"gmailImportProgress">> => {
    // Delete any existing import progress for this connection
    const existingProgress = await ctx.db
      .query("gmailImportProgress")
      .withIndex("by_gmailConnectionId", (q) => q.eq("gmailConnectionId", args.gmailConnectionId))
      .collect()

    for (const p of existingProgress) {
      await ctx.db.delete(p._id)
    }

    return await ctx.db.insert("gmailImportProgress", {
      userId: args.userId,
      gmailConnectionId: args.gmailConnectionId,
      status: "importing",
      totalEmails: args.totalEmails,
      importedEmails: 0,
      failedEmails: 0,
      skippedEmails: 0,
      startedAt: Date.now(),
    })
  },
})

/**
 * Internal mutation to update import progress
 * Story 4.4: Task 1.3 (AC #1, #5) - Progress update for real-time UI
 */
export const updateImportProgress = internalMutation({
  args: {
    progressId: v.id("gmailImportProgress"),
    importedEmails: v.number(),
    failedEmails: v.number(),
    skippedEmails: v.number(),
  },
  handler: async (ctx, args): Promise<void> => {
    await ctx.db.patch(args.progressId, {
      importedEmails: args.importedEmails,
      failedEmails: args.failedEmails,
      skippedEmails: args.skippedEmails,
    })
  },
})

/**
 * Internal mutation to complete import
 * Story 4.4: Task 1.4 (AC #3, #4) - Mark import as complete or error
 */
export const completeImport = internalMutation({
  args: {
    progressId: v.id("gmailImportProgress"),
    status: v.union(v.literal("complete"), v.literal("error")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    const updates: {
      status: "complete" | "error"
      completedAt: number
      error?: string
    } = {
      status: args.status,
      completedAt: Date.now(),
    }

    if (args.error) {
      updates.error = args.error
    }

    await ctx.db.patch(args.progressId, updates)
  },
})

/**
 * Internal query to check for existing import progress
 * Scoped by gmailConnectionId for multi-account support
 */
export const getExistingImportProgress = internalQuery({
  args: { gmailConnectionId: v.id("gmailConnections") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("gmailImportProgress")
      .withIndex("by_gmailConnectionId", (q) => q.eq("gmailConnectionId", args.gmailConnectionId))
      .first()
  },
})

/**
 * Internal query to get approved senders for import
 * Scoped by gmailConnectionId for multi-account support
 */
export const getApprovedSenders = internalQuery({
  args: { gmailConnectionId: v.id("gmailConnections") },
  handler: async (ctx, args) => {
    const senders = await ctx.db
      .query("detectedSenders")
      .withIndex("by_gmailConnectionId", (q) => q.eq("gmailConnectionId", args.gmailConnectionId))
      .collect()

    return senders.filter((s) => s.isApproved === true)
  },
})

/**
 * Start historical email import action
 * Now scoped by gmailConnectionId for multi-account support
 */
export const startHistoricalImport = action({
  args: {
    gmailConnectionId: v.id("gmailConnections"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    let progressId: Id<"gmailImportProgress"> | null = null

    try {
      const authUser = await ctx.runQuery(api.auth.getCurrentUser)
      if (!authUser) {
        return { success: false, error: "Please sign in to import emails." }
      }

      if (
        !isUserPro({
          plan: authUser.plan ?? "free",
          proExpiresAt: authUser.proExpiresAt ?? undefined,
        })
      ) {
        return { success: false, error: "Hushletter Pro is required to import from Gmail." }
      }

      const user = await ctx.runQuery(internal.gmail.getUserByAuthId, {
        authId: authUser.id,
      })
      if (!user) {
        return { success: false, error: "User account not found." }
      }

      // Check for existing import in progress for this connection
      const existingProgress = await ctx.runQuery(internal.gmail.getExistingImportProgress, {
        gmailConnectionId: args.gmailConnectionId,
      })
      if (existingProgress?.status === "importing") {
        return { success: false, error: "An import is already in progress. Please wait for it to complete." }
      }

      // Get approved senders for this connection
      const approvedSenders = await ctx.runQuery(internal.gmail.getApprovedSenders, {
        gmailConnectionId: args.gmailConnectionId,
      })

      if (approvedSenders.length === 0) {
        return { success: false, error: "No approved senders. Please scan and approve senders first." }
      }

      console.log(`[gmail.startHistoricalImport] Starting import for ${approvedSenders.length} senders`)

      const totalEstimate = approvedSenders.reduce((sum, s) => sum + s.emailCount, 0)

      progressId = await ctx.runMutation(internal.gmail.initImportProgress, {
        userId: user._id,
        gmailConnectionId: args.gmailConnectionId,
        totalEmails: totalEstimate,
      })

      let importedCount = 0
      let failedCount = 0
      let skippedCount = 0

      const BATCH_SIZE = 10

      for (const sender of approvedSenders) {
        console.log(`[gmail.startHistoricalImport] Processing sender: ${sender.email}`)

        let allMessageIds: string[] = []
        let pageToken: string | undefined

        do {
          const page = await ctx.runAction(internal.gmailApi.listMessagesFromSender, {
            gmailConnectionId: args.gmailConnectionId,
            senderEmail: sender.email,
            maxResults: 100,
            pageToken,
          })
          allMessageIds = allMessageIds.concat(page.messages.map((m) => m.id))
          pageToken = page.nextPageToken
        } while (pageToken)

        for (let i = 0; i < allMessageIds.length; i += BATCH_SIZE) {
          const batchIds = allMessageIds.slice(i, i + BATCH_SIZE)

          const fullMessages = await ctx.runAction(internal.gmailApi.getFullMessageContents, {
            gmailConnectionId: args.gmailConnectionId,
            messageIds: batchIds,
          })

          for (const message of fullMessages) {
            try {
              const result = await ctx.runAction(internal.gmail.processAndStoreImportedEmail, {
                userId: user._id,
                senderEmail: sender.email,
                senderName: sender.name,
                message,
              })

              if (result.skipped) {
                skippedCount++
              } else {
                importedCount++
              }
            } catch (error) {
              failedCount++
              console.error("[gmail.startHistoricalImport] Failed to import email:", {
                messageId: message.id,
                error: error instanceof Error ? error.message : "Unknown error",
              })
            }
          }

          await ctx.runMutation(internal.gmail.updateImportProgress, {
            progressId,
            importedEmails: importedCount,
            failedEmails: failedCount,
            skippedEmails: skippedCount,
          })
        }
      }

      await ctx.runMutation(internal.gmail.completeImport, {
        progressId,
        status: "complete",
      })

      return { success: true }
    } catch (error) {
      console.error("[gmail.startHistoricalImport] Import failed:", error)

      const errorMessage =
        error instanceof ConvexError
          ? error.data.message
          : error instanceof Error
            ? error.message
            : "An unexpected error occurred"

      if (progressId) {
        try {
          await ctx.runMutation(internal.gmail.completeImport, {
            progressId,
            status: "error",
            error: errorMessage,
          })
        } catch (updateError) {
          console.error("[gmail.startHistoricalImport] Failed to update progress to error:", updateError)
        }
      }

      return { success: false, error: errorMessage }
    }
  },
})

/**
 * Process and store a single imported email (action)
 * Story 4.4: Task 3.1 (AC #2, #6)
 * Story 9.2: Updated for private-by-default architecture
 *   - Always passes source: "gmail"
 *   - Resolves/creates folder for sender
 *   - No longer uses isPrivate from userSenderSettings
 *
 * This is an ACTION (not mutation) because it needs to:
 * - Call R2 storage via the existing storeNewsletterContent action
 * - Run queries and mutations in sequence
 *
 * Flow:
 * 1. Extract email content (subject, sender, date, HTML body)
 * 2. Check for duplicates (by date+subject and content hash)
 * 3. Get or create sender
 * 4. Get or create folder for sender
 * 5. Store content via storeNewsletterContent action (handles R2 + dedup)
 */
export const processAndStoreImportedEmail = internalAction({
  args: {
    userId: v.id("users"),
    senderEmail: v.string(),
    senderName: v.optional(v.string()),
    message: v.any(), // GmailFullMessage type - validated at runtime
  },
  handler: async (ctx, args): Promise<{ skipped: boolean; userNewsletterId?: Id<"userNewsletters"> }> => {
    // Import helper functions
    const { extractHtmlBody, extractHeadersFromFullMessage } = await import("./gmailApi")

    const message = args.message as import("./gmailApi").GmailFullMessage

    // Step 1: Extract headers and content
    const headers = extractHeadersFromFullMessage(message)
    const htmlContent = extractHtmlBody(message)

    // Step 2: Check for duplicates via mutation (needs DB access)
    const duplicateCheck = await ctx.runMutation(internal.gmail.checkEmailDuplicate, {
      userId: args.userId,
      senderEmail: args.senderEmail,
      receivedAt: headers.date,
      subject: headers.subject,
    })

    if (duplicateCheck.isDuplicate) {
      console.log(`[gmail.processAndStoreImportedEmail] Skipping duplicate: ${headers.subject}`)
      return { skipped: true }
    }

    // Step 3: Get or create sender via existing mutation
    const sender = await ctx.runMutation(internal.senders.getOrCreateSender, {
      email: args.senderEmail,
      name: args.senderName,
    })

    // Step 4: Story 9.2 - Get or create folder for this sender
    const folderId = await ctx.runMutation(internal.senders.getOrCreateFolderForSender, {
      userId: args.userId,
      senderId: sender._id,
    })

    // Step 5: Store content using the existing storeNewsletterContent action
    // This properly handles R2 upload, deduplication, and record creation
    // Story 8.4: storeNewsletterContent now performs duplicate detection
    // Story 9.2: Pass source: "gmail" and folderId
    const result = await ctx.runAction(internal.newsletters.storeNewsletterContent, {
      userId: args.userId,
      senderId: sender._id,
      folderId, // Story 9.2: Required for folder-centric architecture
      subject: headers.subject,
      senderEmail: args.senderEmail,
      senderName: args.senderName,
      receivedAt: headers.date,
      htmlContent: htmlContent || undefined,
      textContent: !htmlContent ? `<p>${headers.subject}</p>` : undefined,
      source: "gmail", // Story 9.2: Track ingestion source
      // Note: Gmail import doesn't have messageId - duplicate detection uses content hash
    })

    // Story 8.4: Handle duplicate detection (Phase 2 content-hash check)
    if (result.skipped) {
      if (result.reason === "plan_limit") {
        return { skipped: true }
      }
      // Phase 2 duplicate detected - return existing ID
      return { skipped: true, userNewsletterId: result.existingId }
    }

    // Step 6: Mark imported newsletter as read (they're historical)
    await ctx.runMutation(internal.gmail.markImportedAsRead, {
      userNewsletterId: result.userNewsletterId,
    })

    return { skipped: false, userNewsletterId: result.userNewsletterId }
  },
})

/**
 * Check if an email already exists for this user (duplicate detection - Phase 1)
 * Story 4.4: AC#6 - Duplicate detection
 *
 * TWO-PHASE DEDUPLICATION APPROACH:
 * Phase 1 (this function): Fast check using date+subject match
 *   - Catches obvious exact duplicates before expensive content fetching
 *   - Low cost: only queries existing userNewsletters
 *
 * Phase 2 (storeNewsletterContent): Content hash check
 *   - Catches content-identical emails with different metadata
 *   - Higher cost: requires content normalization and hashing
 *   - Runs only if Phase 1 passes (not already duplicate)
 *
 * This two-phase approach optimizes performance by failing fast on
 * obvious duplicates while still catching content-level duplicates.
 */
export const checkEmailDuplicate = internalMutation({
  args: {
    userId: v.id("users"),
    senderEmail: v.string(),
    receivedAt: v.number(),
    subject: v.string(),
  },
  handler: async (ctx, args): Promise<{ isDuplicate: boolean; senderId?: Id<"senders"> }> => {
    // First get sender ID if exists
    const sender = await ctx.db
      .query("senders")
      .withIndex("by_email", (q) => q.eq("email", args.senderEmail))
      .first()

    if (!sender) {
      // No sender = no existing newsletters = not a duplicate
      return { isDuplicate: false }
    }

    // Check if user already has a newsletter from this sender with same date+subject
    const existingNewsletters = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId_senderId", (q) =>
        q.eq("userId", args.userId).eq("senderId", sender._id)
      )
      .collect()

    // Check for duplicate by exact date and subject match
    const isDuplicate = existingNewsletters.some(
      (n) => n.receivedAt === args.receivedAt && n.subject === args.subject
    )

    return { isDuplicate, senderId: sender._id }
  },
})

/**
 * Mark an imported newsletter as read
 * Story 4.4: Historical imports are pre-read
 */
export const markImportedAsRead = internalMutation({
  args: { userNewsletterId: v.id("userNewsletters") },
  handler: async (ctx, args): Promise<void> => {
    await ctx.db.patch(args.userNewsletterId, {
      isRead: true,
      readProgress: 100,
    })
  },
})
