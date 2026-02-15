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
import { internalQuery, action, internalAction, type ActionCtx } from "./_generated/server"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"

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

// Story 4.4: Full message types for email import
export type GmailMessagePart = {
  mimeType: string
  body?: {
    size: number
    data?: string // Base64url encoded content
  }
  parts?: GmailMessagePart[] // Nested parts for multipart messages
}

export type GmailFullMessage = {
  id: string
  threadId: string
  internalDate: string // Unix timestamp in ms as string
  payload: {
    mimeType: string
    headers?: GmailMessageHeader[]
    body?: {
      size: number
      data?: string
    }
    parts?: GmailMessagePart[]
  }
}

/**
 * Internal query to get Google access token from gmailConnections table.
 * Accepts a gmailConnectionId to support multi-account Gmail connections.
 *
 * This is internal-only and NEVER exposed to the client.
 * Used by actions that need to call Gmail API.
 *
 * @returns Object with accessToken, expiresAt, and needsRefresh flag
 * @throws ConvexError if connection not found or token unavailable
 */
export const getAccessToken = internalQuery({
  args: {
    gmailConnectionId: v.id("gmailConnections"),
  },
  handler: async (ctx, args): Promise<{ accessToken: string; expiresAt: number | null; needsRefresh: boolean }> => {
    const connection = await ctx.db.get(args.gmailConnectionId)

    if (!connection || !connection.isActive) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Gmail connection not found or inactive.",
      })
    }

    const needsRefresh = connection.accessTokenExpiresAt < Date.now() + 5 * 60 * 1000

    return {
      accessToken: connection.accessToken,
      expiresAt: connection.accessTokenExpiresAt,
      needsRefresh,
    }
  },
})

/**
 * Gmail API base URL
 */
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"

/**
 * Retry configuration for rate-limited requests
 */
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000, // Start with 1 second
  maxDelayMs: 30000, // Max 30 seconds
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Execute a function with exponential backoff on rate limit errors
 */
async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  context: string
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      // Check if it's a rate limit error
      if (
        error instanceof ConvexError &&
        error.data.code === "RATE_LIMITED"
      ) {
        if (attempt < RETRY_CONFIG.maxRetries) {
          // Exponential backoff: 1s, 2s, 4s, etc.
          const delay = Math.min(
            RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt),
            RETRY_CONFIG.maxDelayMs
          )
          console.log(
            `[gmailApi.${context}] Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries})`
          )
          await sleep(delay)
          lastError = error instanceof Error ? error : new Error(String(error))
          continue
        }
      }
      // Not a rate limit error or max retries exceeded
      throw error
    }
  }

  // Should not reach here, but TypeScript needs this
  throw lastError || new Error("Max retries exceeded")
}

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
 * Includes automatic retry with exponential backoff for rate limits
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
  return withRateLimitRetry(async () => {
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
  }, "listGmailMessages")
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
 * Includes automatic retry with exponential backoff for rate limits
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

    // Wrap batch processing with rate limit retry
    const batchResults = await withRateLimitRetry(
      () =>
        Promise.all(
          batch.map((id, idx) => {
            // Log the very first message to see the API response structure
            const shouldLog = isFirstMessage && idx === 0
            if (shouldLog) isFirstMessage = false
            return getGmailMessage(accessToken, id, shouldLog)
          })
        ),
      "batchGetGmailMessages"
    )
    results.push(...batchResults)

    // Add delay between batches (except after last batch)
    if (i + BATCH_SIZE < messageIds.length) {
      await sleep(DELAY_MS)
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
 * Helper to get a fresh access token for a connection, refreshing if needed.
 */
async function getFreshAccessToken(
  ctx: { runQuery: ActionCtx["runQuery"]; runAction: ActionCtx["runAction"] },
  gmailConnectionId: Id<"gmailConnections">
): Promise<string> {
  const tokenResult = await ctx.runQuery(internal.gmailApi.getAccessToken, { gmailConnectionId })
  if (!tokenResult.needsRefresh) return tokenResult.accessToken

  // Token needs refresh
  const refreshed = await ctx.runAction(internal.gmailConnections.refreshAccessToken, { gmailConnectionId })
  if (refreshed) return refreshed.accessToken

  // Refresh failed - try with stale token (might still work)
  return tokenResult.accessToken
}

/**
 * Internal action to list Gmail messages for newsletter scanning
 * Story 4.2: Task 3.2 - Paginated Gmail API calls
 *
 * @returns List of potential newsletter message IDs
 */
export const listNewsletterMessages = internalAction({
  args: {
    gmailConnectionId: v.id("gmailConnections"),
    maxResults: v.optional(v.number()),
    pageToken: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ messages: GmailMessage[]; nextPageToken?: string; total?: number }> => {
    const accessToken = await getFreshAccessToken(ctx, args.gmailConnectionId)

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
    gmailConnectionId: v.id("gmailConnections"),
    messageIds: v.array(v.string()),
    logSampleMessage: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<GmailMessageDetail[]> => {
    const accessToken = await getFreshAccessToken(ctx, args.gmailConnectionId)

    // Fetch message details in batches
    const results = await batchGetGmailMessages(
      accessToken,
      args.messageIds,
      args.logSampleMessage ?? false
    )

    return results
  },
})

/**
 * Public action to check if Gmail token is valid for a given connection
 * Useful for UI to show warning before starting scan
 */
export const checkGmailAccess = action({
  args: {
    gmailConnectionId: v.id("gmailConnections"),
  },
  handler: async (ctx, args): Promise<{ valid: boolean; error?: string }> => {
    try {
      const accessToken = await getFreshAccessToken(ctx, args.gmailConnectionId)

      // Try a simple API call to verify token works
      const url = new URL(`${GMAIL_API_BASE}/profile`)

      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${accessToken}` },
      })

      if (!response.ok) {
        if (response.status === 401) {
          return { valid: false, error: "Gmail token expired. Please reconnect your Gmail account." }
        }
        if (response.status === 403) {
          return { valid: false, error: "Gmail access denied. Please ensure you granted the required permissions." }
        }
        return { valid: false, error: `Unable to access Gmail (${response.status}).` }
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

// ============================================================
// Story 4.4: Full Message Fetching for Email Import
// ============================================================

/**
 * Decode base64url encoded string (Gmail uses URL-safe base64)
 * Story 4.4: Task 2.4 - Handle different Gmail message formats
 *
 * @param data - Base64url encoded string
 * @returns Decoded UTF-8 string
 */
function decodeBase64Url(data: string): string {
  // Gmail uses base64url encoding (- and _ instead of + and /)
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/")
  // Add padding if needed
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4)
  // Decode
  const binary = atob(padded)
  // Convert to UTF-8 string
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new TextDecoder("utf-8").decode(bytes)
}

/**
 * Find a message part by MIME type (recursive)
 * Story 4.4: Task 2.2 - Extract HTML body from Gmail message
 *
 * @param parts - Array of message parts to search
 * @param mimeType - MIME type to find (e.g., "text/html")
 * @returns Matching part or null
 */
function findPartByMimeType(
  parts: GmailMessagePart[],
  mimeType: string
): GmailMessagePart | null {
  for (const part of parts) {
    if (part.mimeType === mimeType) {
      return part
    }
    // Recurse into nested parts (multipart/alternative, multipart/mixed)
    if (part.parts) {
      const found = findPartByMimeType(part.parts, mimeType)
      if (found) return found
    }
  }
  return null
}

/**
 * Escape HTML special characters for safe display
 * Used when converting plain text to HTML
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

/**
 * Extract HTML body from Gmail message
 * Story 4.4: Task 2.2 - Handle multipart/alternative, text/html, text/plain
 *
 * Priority: text/html > text/plain (converted to HTML)
 *
 * @param message - Full Gmail message
 * @returns HTML content or null if no body found
 */
export function extractHtmlBody(message: GmailFullMessage): string | null {
  const payload = message.payload

  // Direct body (simple messages with single content type)
  if (payload.body?.data && payload.mimeType === "text/html") {
    return decodeBase64Url(payload.body.data)
  }

  // Direct body - plain text
  if (payload.body?.data && payload.mimeType === "text/plain") {
    const text = decodeBase64Url(payload.body.data)
    return `<pre>${escapeHtml(text)}</pre>`
  }

  // Multipart message - search for text/html part
  if (payload.parts) {
    const htmlPart = findPartByMimeType(payload.parts, "text/html")
    if (htmlPart?.body?.data) {
      return decodeBase64Url(htmlPart.body.data)
    }

    // Fallback to text/plain if no HTML
    const textPart = findPartByMimeType(payload.parts, "text/plain")
    if (textPart?.body?.data) {
      const text = decodeBase64Url(textPart.body.data)
      return `<pre>${escapeHtml(text)}</pre>`
    }
  }

  return null
}

/**
 * Extract headers from full Gmail message
 * Story 4.4: Task 2.1 - Extract email metadata
 */
export function extractHeadersFromFullMessage(message: GmailFullMessage): {
  from: string
  subject: string
  date: number
} {
  const headers = message.payload.headers || []
  let from = ""
  let subject = ""

  for (const header of headers) {
    const name = header.name.toLowerCase()
    if (name === "from") from = header.value
    if (name === "subject") subject = header.value
  }

  // Use internalDate (Unix timestamp in ms) for date
  const date = parseInt(message.internalDate, 10)

  return { from, subject, date }
}

/**
 * Get full Gmail message with body content
 * Story 4.4: Task 2.1 - Fetch full email content
 *
 * @param accessToken - Google OAuth access token
 * @param messageId - Gmail message ID
 * @returns Full message with body
 */
async function getFullGmailMessage(
  accessToken: string,
  messageId: string
): Promise<GmailFullMessage> {
  const url = new URL(`${GMAIL_API_BASE}/messages/${messageId}`)
  url.searchParams.set("format", "full") // Get full content including body

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw await handleGmailApiError(response)
  }

  return response.json() as Promise<GmailFullMessage>
}

/**
 * Batch get full Gmail messages with rate limiting
 * Story 4.4: Task 2.3 - Batch content fetching with rate limiting
 * Includes automatic retry with exponential backoff for rate limits
 *
 * @param accessToken - Google OAuth access token
 * @param messageIds - Array of message IDs
 * @returns Array of full messages
 */
async function batchGetFullGmailMessages(
  accessToken: string,
  messageIds: string[]
): Promise<GmailFullMessage[]> {
  const results: GmailFullMessage[] = []

  // Process in batches of 10 to respect rate limits
  // (250 quota units/sec, 5 units per request = 50 requests/sec max)
  const BATCH_SIZE = 10
  const DELAY_MS = 250 // 4 batches per second = 40 requests/sec (safe margin)

  for (let i = 0; i < messageIds.length; i += BATCH_SIZE) {
    const batch = messageIds.slice(i, i + BATCH_SIZE)

    // Wrap batch processing with rate limit retry
    const batchResults = await withRateLimitRetry(
      () => Promise.all(batch.map((id) => getFullGmailMessage(accessToken, id))),
      "batchGetFullGmailMessages"
    )
    results.push(...batchResults)

    // Add delay between batches (except after last batch)
    if (i + BATCH_SIZE < messageIds.length) {
      await sleep(DELAY_MS)
    }
  }

  return results
}

/**
 * Internal action to get full message content for import
 * Story 4.4: Task 2.1 - Fetch full email content
 *
 * @param messageIds - Array of Gmail message IDs
 * @returns Array of full messages with body content
 */
export const getFullMessageContents = internalAction({
  args: {
    gmailConnectionId: v.id("gmailConnections"),
    messageIds: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<GmailFullMessage[]> => {
    const accessToken = await getFreshAccessToken(ctx, args.gmailConnectionId)

    // Fetch full messages in batches with rate limiting
    const results = await batchGetFullGmailMessages(accessToken, args.messageIds)

    return results
  },
})

/**
 * List messages from a specific sender
 * Story 4.4: Task 5.2 - Paginated email fetching per sender
 *
 * @param senderEmail - Email address of the sender
 * @param maxResults - Maximum results per page
 * @param pageToken - Pagination token
 * @returns List of message IDs from this sender
 */
export const listMessagesFromSender = internalAction({
  args: {
    gmailConnectionId: v.id("gmailConnections"),
    senderEmail: v.string(),
    maxResults: v.optional(v.number()),
    pageToken: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ messages: GmailMessage[]; nextPageToken?: string }> => {
    const accessToken = await getFreshAccessToken(ctx, args.gmailConnectionId)

    // Search for messages from this specific sender
    const query = `from:${args.senderEmail}`

    const result = await listGmailMessages(accessToken, {
      maxResults: args.maxResults ?? 100,
      pageToken: args.pageToken,
      query,
    })

    return {
      messages: result.messages ?? [],
      nextPageToken: result.nextPageToken,
    }
  },
})
