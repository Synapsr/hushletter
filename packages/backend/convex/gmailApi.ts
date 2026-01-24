/**
 * Gmail API Client
 * Story 4.2: Task 1 - Gmail API integration for newsletter scanning
 *
 * This module provides:
 * - Internal query to retrieve Google access token from Better Auth
 * - Gmail API wrapper actions with proper error handling
 * - Token refresh logic via Better Auth's built-in mechanism
 *
 * SECURITY: Access tokens are NEVER exposed to the client.
 * All Gmail API calls happen in Convex actions (server-side).
 */

import { v } from "convex/values"
import { ConvexError } from "convex/values"
import { internalQuery, action, internalAction } from "./_generated/server"
import { internal } from "./_generated/api"
import { authComponent, createAuth } from "./auth"

// Type for Better Auth account from listUserAccounts
type BetterAuthAccount = {
  providerId: string
  accountId: string
  accessToken?: string | null
  accessTokenExpiresAt?: number | null
  refreshToken?: string | null
}

// Gmail API types
export type GmailMessage = {
  id: string
  threadId: string
}

export type GmailMessageList = {
  messages?: GmailMessage[]
  nextPageToken?: string
  resultSizeEstimate?: number
}

export type GmailMessageHeader = {
  name: string
  value: string
}

export type GmailMessageDetail = {
  id: string
  threadId: string
  payload?: {
    headers?: GmailMessageHeader[]
  }
}

/**
 * Internal query to get Google access token from Better Auth
 * Story 4.2: Task 1.2 - Retrieve token from Better Auth
 *
 * Uses Better Auth's getAccessToken API which automatically handles
 * token refresh when expired. This is the recommended approach.
 *
 * This is internal-only and NEVER exposed to the client.
 * Used by actions that need to call Gmail API.
 *
 * @returns Object with accessToken and expiresAt timestamp
 * @throws ConvexError if Gmail not connected or token unavailable
 */
export const getAccessToken = internalQuery({
  args: {},
  handler: async (ctx): Promise<{ accessToken: string; expiresAt: number | null }> => {
    // Get authenticated user
    const authUser = await authComponent.getAuthUser(ctx)
    if (!authUser) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message: "User not authenticated",
      })
    }

    // Get Better Auth API
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx)

    // First check if Google account is connected
    const accounts = (await auth.api.listUserAccounts({
      headers,
    })) as BetterAuthAccount[]

    const googleAccount = accounts.find(
      (account) => account.providerId === "google"
    )

    if (!googleAccount) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Gmail not connected. Please connect your Gmail account first.",
      })
    }

    // Use Better Auth's getAccessToken API - handles token refresh automatically
    try {
      const tokenResult = await auth.api.getAccessToken({
        body: {
          providerId: "google",
        },
        headers,
      })

      if (!tokenResult?.accessToken) {
        throw new ConvexError({
          code: "TOKEN_UNAVAILABLE",
          message: "Gmail access token not available. Please disconnect and reconnect your Gmail account.",
        })
      }

      // Better Auth returns accessTokenExpiresAt as Date, convert to timestamp
      const expiresAt = tokenResult.accessTokenExpiresAt
        ? tokenResult.accessTokenExpiresAt.getTime()
        : null

      return {
        accessToken: tokenResult.accessToken,
        expiresAt,
      }
    } catch (error) {
      // If token refresh fails, user needs to reconnect
      console.error("[gmailApi.getAccessToken] Token retrieval failed:", error)
      throw new ConvexError({
        code: "TOKEN_UNAVAILABLE",
        message: "Gmail access token expired. Please disconnect and reconnect your Gmail account.",
      })
    }
  },
})

/**
 * Gmail API base URL
 */
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"

/**
 * Gmail API error codes
 */
export type GmailApiErrorCode =
  | "TOKEN_EXPIRED"
  | "RATE_LIMITED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "GMAIL_API_ERROR"

/**
 * List messages from Gmail with optional search query
 * Story 4.2: Task 1.4 - Gmail API wrapper with error handling
 *
 * @param accessToken - Google OAuth access token
 * @param options - Search options
 * @returns List of message IDs with pagination token
 */
async function listGmailMessages(
  accessToken: string,
  options: {
    maxResults?: number
    pageToken?: string
    query?: string
  }
): Promise<GmailMessageList> {
  const url = new URL(`${GMAIL_API_BASE}/messages`)
  url.searchParams.set("maxResults", String(options.maxResults ?? 100))

  if (options.pageToken) {
    url.searchParams.set("pageToken", options.pageToken)
  }

  if (options.query) {
    url.searchParams.set("q", options.query)
  }

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw await handleGmailApiError(response)
  }

  return response.json()
}

/**
 * Get message details (headers only for efficiency)
 * Story 4.2: Task 1.4 - Gmail API wrapper with error handling
 *
 * @param accessToken - Google OAuth access token
 * @param messageId - Gmail message ID
 * @returns Message with headers
 */
async function getGmailMessage(
  accessToken: string,
  messageId: string,
  logSample: boolean = false
): Promise<GmailMessageDetail> {
  const url = new URL(`${GMAIL_API_BASE}/messages/${messageId}`)
  // Only fetch metadata (headers) for efficiency
  url.searchParams.set("format", "metadata")
  // Gmail API requires metadataHeaders to be repeated for each header, not comma-separated
  const headersToFetch = ["From", "Subject", "List-Unsubscribe", "List-Id", "Precedence"]
  for (const header of headersToFetch) {
    url.searchParams.append("metadataHeaders", header)
  }

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw await handleGmailApiError(response)
  }

  const result = await response.json() as GmailMessageDetail

  // Log first message to debug structure
  if (logSample) {
    console.log("[gmailApi.getGmailMessage] Raw API response sample:", JSON.stringify(result, null, 2).substring(0, 1000))
  }

  return result
}

/**
 * Get multiple messages in a batch request
 * More efficient than individual requests for large scans
 *
 * @param accessToken - Google OAuth access token
 * @param messageIds - Array of message IDs
 * @returns Array of message details
 */
async function batchGetGmailMessages(
  accessToken: string,
  messageIds: string[],
  logFirstMessage: boolean = false
): Promise<GmailMessageDetail[]> {
  // Gmail doesn't have a true batch endpoint for message.get
  // We'll use Promise.all with rate limiting
  const results: GmailMessageDetail[] = []

  // Process in batches of 10 to respect rate limits
  // (250 quota units/sec, 5 units per request = 50 requests/sec max)
  const BATCH_SIZE = 10
  const DELAY_MS = 250 // 4 batches per second = 40 requests/sec (safe margin)

  let isFirstMessage = logFirstMessage

  for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
    const batch = messageIds.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.all(
      batch.map((id, idx) => {
        // Log the very first message to see the API response structure
        const shouldLog = isFirstMessage && idx === 0
        if (shouldLog) isFirstMessage = false
        return getGmailMessage(accessToken, id, shouldLog)
      })
    )
    results.push(...batchResults)

    // Add delay between batches (except after last batch)
    if (i + BATCH_SIZE < messageIds.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS))
    }
  }

  return results
}

/**
 * Handle Gmail API errors and convert to ConvexError
 * Story 4.2: Task 1.3, 1.4 - Token refresh and error handling
 */
async function handleGmailApiError(response: Response): Promise<ConvexError<{ code: GmailApiErrorCode; message: string }>> {
  const status = response.status
  let errorBody: { error?: { message?: string } } = {}

  try {
    errorBody = await response.json()
  } catch {
    // Ignore JSON parse errors
  }

  const errorMessage = errorBody.error?.message ?? response.statusText

  switch (status) {
    case 401:
      // Token expired - Better Auth should handle refresh automatically
      // If we get here, refresh failed and user needs to reconnect
      return new ConvexError({
        code: "TOKEN_EXPIRED" as GmailApiErrorCode,
        message: "Gmail token expired. Please reconnect your Gmail account.",
      })
    case 403:
      return new ConvexError({
        code: "FORBIDDEN" as GmailApiErrorCode,
        message: "Access denied. Please ensure you granted Gmail read permission.",
      })
    case 404:
      return new ConvexError({
        code: "NOT_FOUND" as GmailApiErrorCode,
        message: "Gmail resource not found.",
      })
    case 429:
      return new ConvexError({
        code: "RATE_LIMITED" as GmailApiErrorCode,
        message: "Too many requests. Please try again in a few minutes.",
      })
    default:
      return new ConvexError({
        code: "GMAIL_API_ERROR" as GmailApiErrorCode,
        message: `Gmail API error: ${errorMessage}`,
      })
  }
}

/**
 * Search query to find likely newsletter emails
 * Uses Gmail's search operators to pre-filter at API level
 *
 * Story 4.2: Task 2 - Newsletter detection optimization
 *
 * Note: Gmail search doesn't support "list:unsubscribe" header search directly.
 * We use common newsletter platform domains and keywords instead.
 * The heuristics will do the actual newsletter detection based on headers.
 */
const NEWSLETTER_SEARCH_QUERY = [
  // Known newsletter platforms
  "from:substack.com",
  "from:buttondown.email",
  "from:beehiiv.com",
  "from:convertkit.com",
  "from:mailchimp.com",
  "from:ghost.io",
  "from:revue.co",
  "from:tinyletter.com",
  "from:sendinblue.com",
  "from:mailerlite.com",
  "from:getrevue.co",
  "from:substackcdn.com",
  // Common newsletter keywords in body/subject
  "unsubscribe",
  "newsletter",
  // Category filter - promotions often contains newsletters
  "category:promotions",
].join(" OR ")

/**
 * Internal action to list Gmail messages for newsletter scanning
 * Story 4.2: Task 3.2 - Paginated Gmail API calls
 *
 * @returns List of potential newsletter message IDs
 */
export const listNewsletterMessages = internalAction({
  args: {
    maxResults: v.optional(v.number()),
    pageToken: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ messages: GmailMessage[]; nextPageToken?: string; total?: number }> => {
    // Get access token from Better Auth
    const { accessToken } = await ctx.runQuery(internal.gmailApi.getAccessToken)

    console.log("[gmailApi.listNewsletterMessages] Starting search with query:", NEWSLETTER_SEARCH_QUERY)

    // Call Gmail API with newsletter search query
    const result = await listGmailMessages(accessToken, {
      maxResults: args.maxResults ?? 100,
      pageToken: args.pageToken,
      query: NEWSLETTER_SEARCH_QUERY,
    })

    console.log("[gmailApi.listNewsletterMessages] Results:", {
      messagesFound: result.messages?.length ?? 0,
      totalEstimate: result.resultSizeEstimate,
      hasNextPage: !!result.nextPageToken,
    })

    return {
      messages: result.messages ?? [],
      nextPageToken: result.nextPageToken,
      total: result.resultSizeEstimate,
    }
  },
})

/**
 * Internal action to get message details (headers)
 * Story 4.2: Task 3.2 - Fetch email headers for analysis
 */
export const getMessageDetails = internalAction({
  args: {
    messageIds: v.array(v.string()),
    logSampleMessage: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<GmailMessageDetail[]> => {
    // Get access token from Better Auth
    const { accessToken } = await ctx.runQuery(internal.gmailApi.getAccessToken)

    // Fetch message details in batches
    // logSampleMessage is passed from caller to control debug logging
    const results = await batchGetGmailMessages(
      accessToken,
      args.messageIds,
      args.logSampleMessage ?? false
    )

    return results
  },
})

/**
 * Public action to check if Gmail token is valid
 * Useful for UI to show warning before starting scan
 */
export const checkGmailAccess = action({
  args: {},
  handler: async (ctx): Promise<{ valid: boolean; error?: string }> => {
    try {
      const { accessToken, expiresAt } = await ctx.runQuery(
        internal.gmailApi.getAccessToken
      )

      // Check if token is about to expire (within 5 minutes)
      if (expiresAt && expiresAt < Date.now() + 5 * 60 * 1000) {
        return {
          valid: false,
          error: "Gmail token is about to expire. Please reconnect your Gmail account.",
        }
      }

      // Try a simple API call to verify token works
      const url = new URL(`${GMAIL_API_BASE}/profile`)
      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (!response.ok) {
        if (response.status === 401) {
          return {
            valid: false,
            error: "Gmail token expired. Please reconnect your Gmail account.",
          }
        }
        return {
          valid: false,
          error: "Unable to access Gmail. Please check your permissions.",
        }
      }

      return { valid: true }
    } catch (error) {
      if (error instanceof ConvexError) {
        return { valid: false, error: error.data.message }
      }
      return { valid: false, error: "Failed to check Gmail access." }
    }
  },
})
