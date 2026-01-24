/**
 * Gmail Integration Queries and Scan Functions
 * Story 4.1: Gmail OAuth Connection
 * Story 4.2: Newsletter Sender Scanning
 *
 * Provides queries to check Gmail connection status and retrieve account information.
 * Also provides scanning functionality to detect newsletter senders.
 * Tokens are NEVER exposed to the client - only connection status and email are returned.
 */

import { query, mutation, internalMutation, internalQuery, action } from "./_generated/server"
import { v, ConvexError } from "convex/values"
import { internal, api } from "./_generated/api"
import { authComponent, createAuth } from "./auth"
import {
  calculateNewsletterScore,
  extractSenderEmail,
  extractSenderName,
  extractDomain,
  NEWSLETTER_THRESHOLD,
  type EmailHeaders,
} from "./_internal/newsletterDetection"
import type { GmailMessageDetail, GmailMessageHeader } from "./gmailApi"
import type { Id } from "./_generated/dataModel"

// Type for Better Auth account from listUserAccounts
// Note: Better Auth returns more fields but we only type what we use
type BetterAuthAccount = {
  providerId: string
  accountId: string
  createdAt: string | Date
  // idToken is available when using OAuth providers with openid scope
  // TypeScript doesn't know about this field from the base type, so we add it
  idToken?: string | null
}

// Extended type that includes idToken (returned by OAuth providers)
type BetterAuthAccountWithIdToken = BetterAuthAccount & {
  idToken?: string | null
}

/**
 * Decode the payload of a JWT without verification
 * We trust the token since it came from Google OAuth via Better Auth
 *
 * @returns Decoded payload with email if valid and not expired, null otherwise
 */
function decodeJwtPayload(jwt: string): { email?: string; exp?: number } | null {
  try {
    const parts = jwt.split(".")
    if (parts.length !== 3) return null

    // Decode the payload (second part)
    const payload = parts[1]
    // Handle base64url encoding
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/")
    const decoded = atob(base64)
    const parsed = JSON.parse(decoded) as { email?: string; exp?: number }

    // Check if token has expired (exp is in seconds, Date.now() is in ms)
    if (parsed.exp && parsed.exp * 1000 < Date.now()) {
      // Token expired - still return payload but caller should handle appropriately
      // Note: Better Auth should refresh tokens, but we check anyway
      console.warn("[gmail] idToken has expired, email may be stale")
    }

    return parsed
  } catch {
    return null
  }
}

/**
 * Internal helper to get Google account from Better Auth
 * Centralizes the account fetching logic to avoid duplication
 */
async function getGoogleAccount(
  ctx: Parameters<Parameters<typeof query>[0]["handler"]>[0]
): Promise<{
  account: BetterAuthAccount
  googleEmail: string | null
  authUserEmail: string
} | null> {
  // Get authenticated user - returns null if not authenticated
  const authUser = await authComponent.safeGetAuthUser(ctx)
  if (!authUser) {
    return null
  }

  // Get Better Auth API to query linked accounts
  const { auth, headers } = await authComponent.getAuth(createAuth, ctx)

  // List all linked accounts for the current user
  const accounts = await auth.api.listUserAccounts({ headers })

  // Find Google account - cast to extended type that includes idToken
  const googleAccount = accounts.find(
    (account) => account.providerId === "google"
  ) as BetterAuthAccountWithIdToken | undefined

  if (!googleAccount) {
    return null
  }

  // Extract the Google email from the idToken if available
  // OAuth providers with openid scope include idToken with user info
  let googleEmail: string | null = null
  if (googleAccount.idToken) {
    const payload = decodeJwtPayload(googleAccount.idToken)
    if (payload?.email) {
      googleEmail = payload.email
    }
  }

  return {
    account: googleAccount,
    googleEmail,
    authUserEmail: authUser.email,
  }
}

/**
 * Check if the current user has a connected Gmail account
 * Story 4.1: Task 4.2 (AC #3, #4)
 *
 * Note: Currently unused in UI (getGmailAccount provides same functionality).
 * Kept for Stories 4.2-4.4 which may need lightweight connection checks
 * before initiating expensive operations like email scanning.
 *
 * @returns boolean indicating if Gmail is connected
 * @throws ConvexError if unable to check connection status
 */
export const isGmailConnected = query({
  args: {},
  handler: async (ctx): Promise<boolean> => {
    try {
      const result = await getGoogleAccount(ctx)
      return result !== null
    } catch (error) {
      // Log for debugging but don't expose internal errors
      console.error("[gmail.isGmailConnected] Failed to check connection:", error)
      // Throw structured error so client can handle it
      throw new ConvexError({
        code: "INTERNAL_ERROR",
        message: "Unable to check Gmail connection status. Please try again.",
      })
    }
  },
})

/**
 * Get the connected Gmail account email address
 * Story 4.1: Task 4.3 (AC #4)
 *
 * @returns The Gmail email address if connected, null otherwise
 * Note: Tokens are NEVER returned - only the email address (NFR6 compliance)
 */
export const getGmailAccount = query({
  args: {},
  handler: async (
    ctx
  ): Promise<{ email: string; connectedAt: number } | null> => {
    try {
      const result = await getGoogleAccount(ctx)

      if (!result) {
        return null
      }

      const { account, googleEmail, authUserEmail } = result

      // The email comes from the Google idToken which contains the actual
      // Google account email. This allows users to link any Gmail account,
      // not just one matching their login email (allowDifferentEmails: true)
      // Fall back to auth user's email if idToken is unavailable (rare edge case)
      const email = googleEmail ?? authUserEmail

      return {
        email,
        connectedAt: new Date(account.createdAt).getTime(),
      }
    } catch (error) {
      // Log for debugging but don't expose internal errors
      console.error("[gmail.getGmailAccount] Failed to get account:", error)
      // Throw structured error so client can handle it
      throw new ConvexError({
        code: "INTERNAL_ERROR",
        message: "Unable to retrieve Gmail account. Please try again.",
      })
    }
  },
})

/**
 * Disconnect Gmail account
 * Story 4.2 fix: Allow users to disconnect and reconnect Gmail
 *
 * @returns Success status
 * @throws ConvexError if unable to disconnect
 */
export const disconnectGmail = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean }> => {
    try {
      // Get Better Auth API
      const { auth, headers } = await authComponent.getAuth(createAuth, ctx)

      // Unlink the Google account
      await auth.api.unlinkAccount({
        body: {
          providerId: "google",
        },
        headers,
      })

      // Also clean up any scan progress and detected senders for this user
      // (they'll need to rescan after reconnecting)
      const authUser = await ctx.runQuery(api.auth.getCurrentUser)
      if (authUser) {
        const user = await ctx.runQuery(internal.gmail.getUserByAuthId, {
          authId: authUser.id,
        })
        if (user) {
          await ctx.runMutation(internal.gmail.cleanupUserScanData, {
            userId: user._id,
          })
        }
      }

      return { success: true }
    } catch (error) {
      console.error("[gmail.disconnectGmail] Failed to disconnect:", error)
      throw new ConvexError({
        code: "INTERNAL_ERROR",
        message: "Unable to disconnect Gmail. Please try again.",
      })
    }
  },
})

/**
 * Internal mutation to clean up user's scan data when disconnecting
 */
export const cleanupUserScanData = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args): Promise<void> => {
    // Delete scan progress
    const progress = await ctx.db
      .query("gmailScanProgress")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first()
    if (progress) {
      await ctx.db.delete(progress._id)
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
}

/**
 * Get current scan progress for the authenticated user
 * Story 4.2: Task 3.5, 5.2 - Progress query for real-time UI feedback
 *
 * @returns Scan progress object or null if no scan has been started
 */
export const getScanProgress = query({
  args: {},
  handler: async (ctx): Promise<ScanProgress | null> => {
    const authUser = await authComponent.safeGetAuthUser(ctx)
    if (!authUser) {
      return null
    }

    // Get the app user record
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
      .first()

    if (!user) {
      return null
    }

    // Get the most recent scan progress for this user
    const progress = await ctx.db
      .query("gmailScanProgress")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first()

    return progress as ScanProgress | null
  },
})

/**
 * Get detected senders for the authenticated user
 * Story 4.2: Task 5.2 - Query detected senders for display
 *
 * @returns Array of detected senders sorted by email count (descending)
 */
export const getDetectedSenders = query({
  args: {},
  handler: async (ctx): Promise<DetectedSender[]> => {
    const authUser = await authComponent.safeGetAuthUser(ctx)
    if (!authUser) {
      return []
    }

    // Get the app user record
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
      .first()

    if (!user) {
      return []
    }

    // Get all detected senders for this user
    const senders = await ctx.db
      .query("detectedSenders")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()

    // Sort by email count (descending) - most prolific senders first
    return (senders as DetectedSender[]).sort((a, b) => b.emailCount - a.emailCount)
  },
})

/**
 * Internal mutation to initialize scan progress
 * Story 4.2: Task 3.3, 3.5 - Initialize progress tracking
 */
export const initScanProgress = internalMutation({
  args: {
    userId: v.id("users"),
    totalEmails: v.number(),
  },
  handler: async (ctx, args): Promise<Id<"gmailScanProgress">> => {
    // Delete any existing scan progress for this user
    const existingProgress = await ctx.db
      .query("gmailScanProgress")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first()

    if (existingProgress) {
      await ctx.db.delete(existingProgress._id)
    }

    // Delete existing detected senders (clean slate for rescan)
    const existingSenders = await ctx.db
      .query("detectedSenders")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect()

    for (const sender of existingSenders) {
      await ctx.db.delete(sender._id)
    }

    // Create new scan progress record
    return await ctx.db.insert("gmailScanProgress", {
      userId: args.userId,
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
 */
export const upsertDetectedSender = internalMutation({
  args: {
    userId: v.id("users"),
    email: v.string(),
    name: v.optional(v.string()),
    domain: v.string(),
    emailCount: v.number(),
    confidenceScore: v.number(),
    sampleSubjects: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<void> => {
    // Check if sender already exists for this user
    const existingSender = await ctx.db
      .query("detectedSenders")
      .withIndex("by_userId_email", (q) =>
        q.eq("userId", args.userId).eq("email", args.email)
      )
      .first()

    if (existingSender) {
      // Update existing sender with new data
      await ctx.db.patch(existingSender._id, {
        name: args.name ?? existingSender.name,
        emailCount: args.emailCount,
        confidenceScore: Math.max(args.confidenceScore, existingSender.confidenceScore),
        sampleSubjects: args.sampleSubjects,
        detectedAt: Date.now(),
      })
    } else {
      // Insert new detected sender
      await ctx.db.insert("detectedSenders", {
        userId: args.userId,
        email: args.email,
        name: args.name,
        domain: args.domain,
        emailCount: args.emailCount,
        confidenceScore: args.confidenceScore,
        sampleSubjects: args.sampleSubjects,
        detectedAt: Date.now(),
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
 *
 * This action:
 * 1. Lists all potential newsletter emails from Gmail (pre-filtered by search query)
 * 2. Fetches headers for each email in batches
 * 3. Analyzes headers using heuristics to detect newsletters
 * 4. Aggregates results by sender
 * 5. Updates progress in real-time
 */
export const startScan = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; error?: string }> => {
    // Track progressId outside try block so we can update it on error
    let progressId: Id<"gmailScanProgress"> | null = null

    try {
      // Get authenticated user
      const authUser = await ctx.runQuery(api.auth.getCurrentUser)
      if (!authUser) {
        return { success: false, error: "Please sign in to scan your Gmail." }
      }

      // Get the app user record by authId
      const user = await ctx.runQuery(internal.gmail.getUserByAuthId, {
        authId: authUser.id,
      })

      if (!user) {
        return { success: false, error: "User account not found." }
      }

      // Check for existing scan in progress to prevent race conditions
      const existingProgress = await ctx.runQuery(internal.gmail.getExistingScanProgress, {
        userId: user._id,
      })
      if (existingProgress?.status === "scanning") {
        return { success: false, error: "A scan is already in progress. Please wait for it to complete." }
      }

      // Step 1: Get initial list of potential newsletter messages
      const initialList = await ctx.runAction(internal.gmailApi.listNewsletterMessages, {
        maxResults: 100,
      })

      const totalEstimate = initialList.total ?? initialList.messages.length

      // Initialize scan progress
      progressId = await ctx.runMutation(internal.gmail.initScanProgress, {
        userId: user._id,
        totalEmails: totalEstimate,
      })

      // Collect all message IDs (paginate if needed)
      let allMessageIds: string[] = initialList.messages.map((m) => m.id)
      let nextPageToken = initialList.nextPageToken
      let pageCount = 1
      const MAX_PAGES = 10 // Limit to ~1000 emails for MVP

      while (nextPageToken && pageCount < MAX_PAGES) {
        const nextPage = await ctx.runAction(internal.gmailApi.listNewsletterMessages, {
          maxResults: 100,
          pageToken: nextPageToken,
        })
        allMessageIds = allMessageIds.concat(nextPage.messages.map((m) => m.id))
        nextPageToken = nextPage.nextPageToken
        pageCount++
      }

      // Step 2: Fetch message details and analyze in batches
      // Aggregate by sender
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

        // Fetch message details
        const messages = await ctx.runAction(internal.gmailApi.getMessageDetails, {
          messageIds: batchIds,
          logSampleMessage: i === 0, // Log detailed info for first batch only
        })

        console.log("[gmail.startScan] Messages received for batch:", messages.length)

        // Analyze each message
        let skippedLowScore = 0
        let skippedNoFrom = 0
        for (const message of messages) {
          const headers = extractHeaders(message)

          // Skip if no "from" header (shouldn't happen but be safe)
          if (!headers.from) {
            skippedNoFrom++
            continue
          }

          const score = calculateNewsletterScore(headers)

          // Log first few messages for debugging
          if (processedCount + messages.indexOf(message) < 10) {
            console.log("[gmail.startScan] Sample message analysis:", {
              from: headers.from.substring(0, 50),
              subject: headers.subject?.substring(0, 40),
              hasListUnsubscribe: !!headers["list-unsubscribe"],
              hasListId: !!headers["list-id"],
              precedence: headers.precedence,
              score,
              threshold: NEWSLETTER_THRESHOLD,
              passesThreshold: score >= NEWSLETTER_THRESHOLD,
            })
          }

          // Only include if above threshold
          if (score >= NEWSLETTER_THRESHOLD) {
            const senderEmail = extractSenderEmail(headers.from)
            const existing = senderMap.get(senderEmail)

            if (existing) {
              existing.emailCount++
              existing.maxScore = Math.max(existing.maxScore, score)
              // Keep up to 5 sample subjects
              if (existing.subjects.length < 5 && headers.subject) {
                existing.subjects.push(headers.subject)
              }
              // Update name if we have one and existing doesn't
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

        console.log("[gmail.startScan] Batch complete:", {
          batchSize: batchIds.length,
          messagesReceived: messages.length,
          skippedNoFrom,
          skippedLowScore,
          uniqueSendersFound: senderMap.size,
        })

        processedCount += batchIds.length

        // Update progress
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
          email: sender.email,
          name: sender.name ?? undefined,
          domain: sender.domain,
          emailCount: sender.emailCount,
          confidenceScore: sender.maxScore,
          sampleSubjects: sender.subjects,
        })
      }

      // Mark scan complete
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

      // Update scan progress to error status if we have a progress record
      if (progressId) {
        try {
          await ctx.runMutation(internal.gmail.completeScan, {
            progressId,
            status: "error",
            error: errorMessage,
          })
        } catch (updateError) {
          // Log but don't throw - we want to return the original error
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
 * Used to prevent concurrent scans (race condition fix)
 */
export const getExistingScanProgress = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("gmailScanProgress")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first()
  },
})
