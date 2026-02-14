/**
 * Gmail Integration Queries and Scan Functions
 * Story 4.1: Gmail OAuth Connection
 * Story 4.2: Newsletter Sender Scanning
 *
 * Provides queries to check Gmail connection status and retrieve account information.
 * Also provides scanning functionality to detect newsletter senders.
 * Tokens are NEVER exposed to the client - only connection status and email are returned.
 */

import { query, mutation, internalMutation, internalQuery, action, internalAction, type QueryCtx } from "./_generated/server"
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
import { isUserPro } from "./entitlements"
import type { GmailMessageDetail } from "./gmailApi"
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
  ctx: QueryCtx
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
 * Revoke Google OAuth token at Google's endpoint
 * Story 4.5: Task 1.2 (AC #2, #5)
 *
 * This is NON-BLOCKING: disconnect must succeed even if revocation fails.
 * Reasons:
 * - User wants to disconnect; we shouldn't block that
 * - Token may already be expired or invalid
 * - Better Auth will delete the token from our DB regardless
 * - Google will eventually expire the token anyway (1 hour for access tokens)
 *
 * @param accessToken - The Google OAuth access token to revoke
 */
async function revokeGoogleToken(accessToken: string): Promise<void> {
  try {
    const response = await fetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(accessToken)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    )

    if (response.ok) {
      console.log("[gmail.revokeGoogleToken] Successfully revoked Google OAuth token")
    } else {
      // Log but don't fail - token may already be expired
      console.warn(`[gmail.revokeGoogleToken] Token revocation returned status ${response.status}`)
    }
  } catch (error) {
    // Network error - log but continue
    console.warn("[gmail.revokeGoogleToken] Token revocation network error:", error)
  }
}

/**
 * Disconnect Gmail account
 * Story 4.2 fix: Allow users to disconnect and reconnect Gmail
 * Story 4.5: Added Google token revocation before unlinking (AC #2, #5)
 *
 * Flow:
 * 1. Get current access token for revocation
 * 2. Revoke token at Google (non-blocking)
 * 3. Unlink account via Better Auth
 * 4. Clean up scan progress and detected senders (NOT newsletters!)
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

      // Step 1: Get current access token for revocation (Story 4.5)
      try {
        const tokenResult = await ctx.runQuery(internal.gmailApi.getAccessToken)

        // Step 2: Revoke token at Google (non-blocking - proceed even if fails)
        if (tokenResult.accessToken) {
          await revokeGoogleToken(tokenResult.accessToken)
        }
      } catch (error) {
        // Token may not exist or be invalid - continue with disconnect
        console.warn("[gmail.disconnectGmail] Could not revoke token (may already be invalid):", error)
      }

      // Step 3: Unlink the Google account
      await auth.api.unlinkAccount({
        body: {
          providerId: "google",
        },
        headers,
      })

      // Step 4: Clean up scan progress and detected senders (NOT newsletters!)
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
 * Story 4.5: Task 5 (AC #3) - Newsletter preservation
 *
 * CRITICAL: This mutation ONLY deletes:
 * - gmailScanProgress (scan status)
 * - detectedSenders (pending sender approvals)
 *
 * It NEVER deletes:
 * - userNewsletters (imported newsletters must be preserved!)
 * - newsletterContent (shared content)
 * - gmailImportProgress (import history)
 *
 * This ensures that previously imported newsletters remain in the user's
 * account after disconnecting Gmail (AC #3).
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

    // Delete detected senders (pending approvals only)
    const senders = await ctx.db
      .query("detectedSenders")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect()
    for (const sender of senders) {
      await ctx.db.delete(sender._id)
    }

    // NOTE: Do NOT delete userNewsletters or newsletterContent!
    // Imported newsletters must be preserved after Gmail disconnect (Story 4.5 AC #3)
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
 * Story 4.3: Added isSelected and isApproved fields with defaults
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
    // Story 4.3: Apply defaults for optional isSelected/isApproved fields
    return senders
      .map((sender) => ({
        ...sender,
        isSelected: sender.isSelected ?? true, // Default to true per AC#1
        isApproved: sender.isApproved ?? false, // Default to false
      }))
      .sort((a, b) => b.emailCount - a.emailCount)
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
      // Note: isSelected and isApproved are NOT reset on rescan - preserve user's previous selections
      await ctx.db.patch(existingSender._id, {
        name: args.name ?? existingSender.name,
        emailCount: args.emailCount,
        confidenceScore: Math.max(args.confidenceScore, existingSender.confidenceScore),
        sampleSubjects: args.sampleSubjects,
        detectedAt: Date.now(),
      })
    } else {
      // Insert new detected sender
      // Story 4.3: New senders default to isSelected: true (per AC#1) and isApproved: false
      await ctx.db.insert("detectedSenders", {
        userId: args.userId,
        email: args.email,
        name: args.name,
        domain: args.domain,
        emailCount: args.emailCount,
        confidenceScore: args.confidenceScore,
        sampleSubjects: args.sampleSubjects,
        detectedAt: Date.now(),
        isSelected: true, // Story 4.3: Senders are selected by default (AC#1)
        isApproved: false, // Story 4.3: Not approved until user confirms import
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

      if (
        !isUserPro({
          plan: authUser.plan ?? "free",
          proExpiresAt: authUser.proExpiresAt ?? undefined,
        })
      ) {
        return {
          success: false,
          error: "Hushletter Pro is required to scan and import from Gmail.",
        }
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
 * Get current import progress for the authenticated user
 * Story 4.4: Task 1.5 (AC #1, #5) - Progress query for real-time UI feedback
 *
 * @returns Import progress object or null if no import has been started
 */
export const getImportProgress = query({
  args: {},
  handler: async (ctx): Promise<ImportProgress | null> => {
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

    // Get the most recent import progress for this user
    const progress = await ctx.db
      .query("gmailImportProgress")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .first()

    return progress as ImportProgress | null
  },
})

/**
 * Internal mutation to initialize import progress
 * Story 4.4: Task 1.2 (AC #1) - Initialize progress tracking
 */
export const initImportProgress = internalMutation({
  args: {
    userId: v.id("users"),
    totalEmails: v.number(),
  },
  handler: async (ctx, args): Promise<Id<"gmailImportProgress">> => {
    // Delete any existing import progress for this user
    const existingProgress = await ctx.db
      .query("gmailImportProgress")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first()

    if (existingProgress) {
      await ctx.db.delete(existingProgress._id)
    }

    // Create new import progress record
    return await ctx.db.insert("gmailImportProgress", {
      userId: args.userId,
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
 * Used to prevent concurrent imports (race condition fix)
 */
export const getExistingImportProgress = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("gmailImportProgress")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .first()
  },
})

/**
 * Internal query to get approved senders for import
 * Story 4.4: Task 5.1 - Get senders approved by user
 */
export const getApprovedSenders = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const senders = await ctx.db
      .query("detectedSenders")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect()

    // Return only approved senders
    return senders.filter((s) => s.isApproved === true)
  },
})

/**
 * Start historical email import action
 * Story 4.4: Task 5 (AC #1, #2, #4, #5, #6)
 *
 * This action:
 * 1. Gets approved senders from detectedSenders
 * 2. Fetches all message IDs for each sender
 * 3. Initializes import progress
 * 4. Processes emails in batches with progress updates
 * 5. Handles errors per-email (don't fail entire import)
 */
export const startHistoricalImport = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; error?: string }> => {
    // Track progressId outside try block so we can update it on error
    let progressId: Id<"gmailImportProgress"> | null = null

    try {
      // Get authenticated user
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

      // Get the app user record by authId
      const user = await ctx.runQuery(internal.gmail.getUserByAuthId, {
        authId: authUser.id,
      })

      if (!user) {
        return { success: false, error: "User account not found." }
      }

      // Check for existing import in progress to prevent race conditions
      const existingProgress = await ctx.runQuery(internal.gmail.getExistingImportProgress, {
        userId: user._id,
      })
      if (existingProgress?.status === "importing") {
        return { success: false, error: "An import is already in progress. Please wait for it to complete." }
      }

      // Get approved senders
      const approvedSenders = await ctx.runQuery(internal.gmail.getApprovedSenders, {
        userId: user._id,
      })

      if (approvedSenders.length === 0) {
        return { success: false, error: "No approved senders. Please scan and approve senders first." }
      }

      console.log(`[gmail.startHistoricalImport] Starting import for ${approvedSenders.length} senders`)

      // Estimate total emails from sender email counts
      const totalEstimate = approvedSenders.reduce((sum, s) => sum + s.emailCount, 0)

      // Initialize import progress
      progressId = await ctx.runMutation(internal.gmail.initImportProgress, {
        userId: user._id,
        totalEmails: totalEstimate,
      })

      // Process each sender's emails
      let importedCount = 0
      let failedCount = 0
      let skippedCount = 0

      const BATCH_SIZE = 10

      for (const sender of approvedSenders) {
        console.log(`[gmail.startHistoricalImport] Processing sender: ${sender.email}`)

        // Fetch all message IDs for this sender (paginated)
        let allMessageIds: string[] = []
        let pageToken: string | undefined

        do {
          const page = await ctx.runAction(internal.gmailApi.listMessagesFromSender, {
            senderEmail: sender.email,
            maxResults: 100,
            pageToken,
          })
          allMessageIds = allMessageIds.concat(page.messages.map((m) => m.id))
          pageToken = page.nextPageToken
        } while (pageToken)

        console.log(`[gmail.startHistoricalImport] Found ${allMessageIds.length} messages from ${sender.email}`)

        // Process in batches
        for (let i = 0; i < allMessageIds.length; i += BATCH_SIZE) {
          const batchIds = allMessageIds.slice(i, i + BATCH_SIZE)

          // Fetch full content for batch
          const fullMessages = await ctx.runAction(internal.gmailApi.getFullMessageContents, {
            messageIds: batchIds,
          })

          // Process each message
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
              // Continue processing other emails (AC#4)
            }
          }

          // Update progress after each batch (AC#1, #5)
          await ctx.runMutation(internal.gmail.updateImportProgress, {
            progressId,
            importedEmails: importedCount,
            failedEmails: failedCount,
            skippedEmails: skippedCount,
          })
        }
      }

      // Mark import complete (AC#3)
      await ctx.runMutation(internal.gmail.completeImport, {
        progressId,
        status: "complete",
      })

      console.log(`[gmail.startHistoricalImport] Import complete: ${importedCount} imported, ${skippedCount} skipped, ${failedCount} failed`)

      return { success: true }
    } catch (error) {
      console.error("[gmail.startHistoricalImport] Import failed:", error)

      const errorMessage =
        error instanceof ConvexError
          ? error.data.message
          : error instanceof Error
            ? error.message
            : "An unexpected error occurred"

      // Update import progress to error status if we have a progress record
      if (progressId) {
        try {
          await ctx.runMutation(internal.gmail.completeImport, {
            progressId,
            status: "error",
            error: errorMessage,
          })
        } catch (updateError) {
          // Log but don't throw - we want to return the original error
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
