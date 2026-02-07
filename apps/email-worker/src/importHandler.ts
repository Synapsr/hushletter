import PostalMime from "postal-mime"
import type { Env, ImportEmailPayload, ConvexImportResponse } from "./types"
import { type ConvexConfig } from "./convexClient"
import { sanitizeHtml } from "@hushletter/shared/utils"

/**
 * Rate limit: 50 imports per hour per user
 *
 * NOTE: KV does not support atomic increment operations. The rate limiting
 * implementation uses eventual consistency, meaning concurrent requests
 * could exceed the limit by a small margin. This is acceptable for this
 * use case where the limit is a soft cap to prevent abuse, not a hard security
 * boundary. For true atomicity, Cloudflare Durable Objects would be needed.
 */
const RATE_LIMIT_PER_HOUR = 50

/** Rate limit window in seconds (1 hour) */
const RATE_LIMIT_WINDOW_SECONDS = 3600

/** Soft limit buffer to account for KV eventual consistency race conditions */
const SOFT_LIMIT_BUFFER = 5

/** Maximum email size to process (25MB - standard email limit) */
const MAX_EMAIL_SIZE_BYTES = 25 * 1024 * 1024

/** Basic email format validation regex */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Extracted newsletter data from a forwarded email
 * Story 8.4: Added messageId for duplicate detection
 */
interface ExtractedNewsletter {
  originalFrom: string
  originalFromName?: string
  originalSubject: string
  originalDate: Date
  htmlContent?: string
  textContent?: string
  messageId?: string // Story 8.4: Original email's Message-ID for duplicate detection
}

/**
 * Result from user verification
 */
interface VerifyUserResult {
  found: boolean
  userId?: string
}

/**
 * Handle email forwarded to import@hushletter.com
 * Extracts the original newsletter and imports it for the forwarding user
 *
 * Story 8.3: AC #1, #2, #3, #4, #5, #6, #7
 */
export async function handleImportEmail(
  message: ForwardableEmailMessage,
  env: Env
): Promise<void> {
  const forwardingUserEmail = message.from

  // Validate email format before processing (prevents malformed data propagation)
  if (!EMAIL_REGEX.test(forwardingUserEmail)) {
    console.log(`[Import] Rejected - invalid email format: ${forwardingUserEmail}`)
    return
  }

  console.log(`[Import] Processing forward from: ${forwardingUserEmail}`)

  try {
    // Get Convex config (import always uses prod)
    const convexConfig = getImportConvexConfig(env)
    if (!convexConfig) {
      console.log("[Import] No valid Convex config")
      return
    }

    // Step 1: Verify forwarding user is registered (AC #2)
    const userResult = await verifyForwardingUser(convexConfig, forwardingUserEmail)
    if (!userResult.found || !userResult.userId) {
      console.log(`[Import] Rejected - user not found: ${forwardingUserEmail}`)
      // Log for admin monitoring but don't bounce (security - no info leakage) (AC #3)
      await logRejectedImport(convexConfig, forwardingUserEmail, "USER_NOT_FOUND")
      return
    }

    // Step 2: Check rate limit (AC #6)
    const rateLimited = await checkRateLimit(env, userResult.userId)
    if (rateLimited) {
      console.log(`[Import] Rate limited: ${forwardingUserEmail}`)
      await logRejectedImport(convexConfig, forwardingUserEmail, "RATE_LIMITED")
      return
    }

    // Step 3: Parse the forwarded email
    const rawEmail = await readEmailStream(message.raw)
    const parsed = await new PostalMime().parse(rawEmail)

    // Step 4: Extract the original newsletter (AC #4)
    const newsletter = await extractForwardedNewsletter(parsed)
    if (!newsletter) {
      console.log(`[Import] Could not extract forwarded newsletter`)
      await logRejectedImport(convexConfig, forwardingUserEmail, "EXTRACTION_FAILED")
      return
    }

    console.log(
      `[Import] Extracted newsletter: subject="${newsletter.originalSubject}", ` +
        `from=${newsletter.originalFrom}, date=${newsletter.originalDate.toISOString()}`
    )

    // Step 5: Send to Convex for storage (AC #5)
    // Story 8.4: Include messageId for duplicate detection
    const result = await callConvexImport(convexConfig, {
      userId: userResult.userId,
      forwardingUserEmail,
      originalFrom: newsletter.originalFrom,
      originalFromName: newsletter.originalFromName,
      originalSubject: newsletter.originalSubject,
      originalDate: newsletter.originalDate.getTime(),
      htmlContent: newsletter.htmlContent,
      textContent: newsletter.textContent,
      messageId: newsletter.messageId, // Story 8.4: For duplicate detection
    })

    // Step 6: Increment rate limit counter on success
    // Story 8.4: Don't increment for duplicates (they don't consume storage)
    if (result.success) {
      if (result.skipped) {
        // Story 8.4: Duplicate detected - log silently (FR33 - no error)
        console.log(
          `[Import] Duplicate detected: reason=${result.duplicateReason}, ` +
            `existingId=${result.existingId}`
        )
      } else {
        await incrementRateLimit(env, userResult.userId)
        console.log(`[Import] Success: userNewsletterId=${result.userNewsletterId}`)
      }
    } else {
      console.log(`[Import] Convex returned error: ${result.error}`)
    }
  } catch (error) {
    console.error("[Import] Failed:", error)
    // Don't throw - we don't want to bounce the email
  }
}

/**
 * Read email stream into Uint8Array with size limit protection
 * @throws Error if email exceeds MAX_EMAIL_SIZE_BYTES
 */
async function readEmailStream(
  rawStream: ReadableStream<Uint8Array>
): Promise<Uint8Array> {
  const reader = rawStream.getReader()
  const chunks: Uint8Array[] = []
  let totalSize = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      totalSize += value.length
      // Prevent memory exhaustion from oversized emails
      if (totalSize > MAX_EMAIL_SIZE_BYTES) {
        reader.cancel()
        throw new Error(`Email exceeds maximum size of ${MAX_EMAIL_SIZE_BYTES} bytes`)
      }
      chunks.push(value)
    }
  }

  const emailBuffer = new Uint8Array(totalSize)
  let offset = 0
  for (const chunk of chunks) {
    emailBuffer.set(chunk, offset)
    offset += chunk.length
  }

  return emailBuffer
}

/**
 * Get Convex configuration for import (always production)
 */
function getImportConvexConfig(env: Env): ConvexConfig | null {
  if (!env.CONVEX_URL || !env.INTERNAL_API_KEY) {
    console.log("[Import] Missing CONVEX_URL or INTERNAL_API_KEY")
    return null
  }

  return {
    url: env.CONVEX_URL,
    apiKey: env.INTERNAL_API_KEY,
  }
}

/**
 * Verify forwarding user is registered by their email address
 * Calls Convex internal endpoint to check user existence
 */
async function verifyForwardingUser(
  config: ConvexConfig,
  email: string
): Promise<VerifyUserResult> {
  const url = `${config.url}/api/email/import/verify-user`

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-API-Key": config.apiKey,
      },
      body: JSON.stringify({ email }),
    })

    if (!response.ok) {
      if (response.status === 404) {
        return { found: false }
      }
      console.error(`[Import] User verification failed: HTTP ${response.status}`)
      return { found: false }
    }

    const data = (await response.json()) as { found: boolean; userId?: string }
    return data
  } catch (error) {
    console.error("[Import] User verification error:", error)
    return { found: false }
  }
}

/**
 * Log rejected import for admin monitoring
 */
async function logRejectedImport(
  config: ConvexConfig,
  email: string,
  reason: string
): Promise<void> {
  const url = `${config.url}/api/email/import/log-rejection`

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-API-Key": config.apiKey,
      },
      body: JSON.stringify({ email, reason }),
    })
  } catch (error) {
    // Non-fatal - just log locally
    console.error("[Import] Failed to log rejection:", error)
  }
}

/**
 * Call Convex import endpoint to store the newsletter
 */
async function callConvexImport(
  config: ConvexConfig,
  payload: ImportEmailPayload
): Promise<ConvexImportResponse> {
  const url = `${config.url}/api/email/import`

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-API-Key": config.apiKey,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as {
        error?: string
      }
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}`,
      }
    }

    return (await response.json()) as ConvexImportResponse
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Check if user is rate limited for imports (AC #6)
 * Uses Cloudflare Workers KV for distributed rate limiting
 *
 * Note: Due to KV's eventual consistency, concurrent requests may not see
 * the latest counter value immediately. To mitigate, we use a slightly
 * lower threshold (RATE_LIMIT_PER_HOUR - 5) for the soft limit check.
 * This provides a buffer for concurrent requests while still allowing
 * the full quota under normal sequential usage.
 */
async function checkRateLimit(env: Env, userId: string): Promise<boolean> {
  if (!env.IMPORT_RATE_LIMIT) {
    // KV namespace not configured - skip rate limiting
    return false
  }

  const key = `import-rate:${userId}`
  const count = await env.IMPORT_RATE_LIMIT.get(key)

  if (!count) return false

  // Use module-level SOFT_LIMIT_BUFFER constant to account for race conditions
  return parseInt(count, 10) >= (RATE_LIMIT_PER_HOUR - SOFT_LIMIT_BUFFER)
}

/**
 * Increment rate limit counter after successful import
 *
 * Uses a pessimistic approach: increment first, then check. This reduces
 * the race condition window but doesn't eliminate it entirely due to KV's
 * eventual consistency. The TTL ensures counters reset after the window.
 */
async function incrementRateLimit(env: Env, userId: string): Promise<void> {
  if (!env.IMPORT_RATE_LIMIT) return

  const key = `import-rate:${userId}`
  const current = await env.IMPORT_RATE_LIMIT.get(key)
  const count = current ? parseInt(current, 10) + 1 : 1

  await env.IMPORT_RATE_LIMIT.put(key, count.toString(), {
    expirationTtl: RATE_LIMIT_WINDOW_SECONDS,
  })
}

// ============================================================
// Forwarded Email Extraction (AC #4)
// Story 8.4: Added messageId extraction for duplicate detection
// ============================================================

/**
 * Extract Message-ID from parsed email
 * Story 8.4: Used for duplicate detection
 *
 * @param parsed - Parsed email from postal-mime
 * @returns Message-ID without angle brackets, or undefined if not present
 */
function extractMessageIdFromParsed(parsed: PostalMime.Email): string | undefined {
  // postal-mime stores messageId directly on the parsed result
  const rawMessageId = parsed.messageId
  if (!rawMessageId) return undefined

  // Remove angle brackets if present (e.g., "<abc123@mail.example.com>" -> "abc123@mail.example.com")
  return rawMessageId.replace(/^<|>$/g, "").trim() || undefined
}

/**
 * Extract Message-ID from inline forwarded message body
 * Story 8.4: Fallback extraction from quoted headers
 *
 * @param body - Email body text that may contain forwarded headers
 * @returns Message-ID without angle brackets, or null if not found
 */
function extractMessageIdFromBody(body: string): string | null {
  // Pattern: "Message-ID: <abc123@mail.example.com>" or "Message-Id: ..."
  // Also handle quoted style like "> Message-ID: ..."
  const pattern = /^>?\s*Message-I[dD]:\s*(.+)$/im
  const match = body.match(pattern)

  if (!match) return null

  // Remove angle brackets if present
  return match[1].trim().replace(/^<|>$/g, "").trim() || null
}

/**
 * Extract the original newsletter from a forwarded email
 * Handles both MIME-attached and inline-quoted formats
 */
async function extractForwardedNewsletter(
  parsed: PostalMime.Email
): Promise<ExtractedNewsletter | null> {
  // Strategy 1: Check for RFC 822 attached message (MIME forward)
  const attachedOriginal = parsed.attachments?.find(
    (att) => att.mimeType === "message/rfc822"
  )

  if (attachedOriginal) {
    // Parse the attached original email
    const originalParser = new PostalMime()
    const original = await originalParser.parse(
      new Uint8Array(attachedOriginal.content as ArrayBuffer)
    )

    // Story 8.4: Extract messageId from the original email's Message-ID header
    // Note: postal-mime stores the Message-ID in original.messageId
    const messageId = extractMessageIdFromParsed(original)

    return {
      originalFrom: original.from?.address ?? "",
      originalFromName: original.from?.name,
      originalSubject: original.subject ?? "(no subject)",
      originalDate: original.date ? new Date(original.date) : new Date(),
      htmlContent: original.html ? sanitizeHtml(original.html) : undefined,
      textContent: original.text,
      messageId, // Story 8.4: For duplicate detection
    }
  }

  // Strategy 2: Parse inline-quoted forward
  return extractInlineForward(parsed)
}

/**
 * Extract forwarded content from inline-quoted format
 * Parses "---------- Forwarded message ---------" style forwards
 */
function extractInlineForward(
  parsed: PostalMime.Email
): ExtractedNewsletter | null {
  const body = parsed.text || parsed.html || ""

  // Common forward separators
  // Note: Using non-greedy .+? and limited captures to prevent ReDoS
  const forwardPatterns = [
    /---------- Forwarded message ---------/i,
    /-------- Original Message --------/i,
    /Begin forwarded message:/i,
    /----- Forwarded message from .{1,100}? -----/i, // Limit match length to prevent ReDoS
    /> From:/i, // Gmail-style quote prefix
  ]

  let forwardStart = -1
  for (const pattern of forwardPatterns) {
    const match = body.search(pattern)
    if (match !== -1) {
      forwardStart = match
      break
    }
  }

  if (forwardStart === -1) {
    // No forward marker found - might be simple prefix-only forward
    // Fall back to using the whole body but strip Fwd: from subject
    const strippedSubject = stripForwardPrefix(parsed.subject ?? "")

    // If subject wasn't modified, this probably isn't a forward
    if (strippedSubject === parsed.subject && !parsed.subject?.match(/fwd|fw/i)) {
      return null
    }

    // Story 8.4: Try to extract messageId from body headers or use outer email's
    const messageId = extractMessageIdFromBody(body) ?? extractMessageIdFromParsed(parsed)

    return {
      originalFrom: extractHeaderFromBody(body, "From") ?? parsed.from?.address ?? "",
      originalFromName: undefined,
      originalSubject: strippedSubject,
      originalDate: extractDateFromBody(body) ?? (parsed.date ? new Date(parsed.date) : new Date()),
      htmlContent: parsed.html ? sanitizeHtml(parsed.html) : undefined,
      textContent: parsed.text,
      messageId, // Story 8.4: For duplicate detection
    }
  }

  // Extract headers from the forwarded section
  const forwardedSection = body.slice(forwardStart)

  const extractedFrom = extractHeaderFromBody(forwardedSection, "From")
  const extractedSubject = extractHeaderFromBody(forwardedSection, "Subject")
  const extractedDate = extractDateFromBody(forwardedSection)
  // Story 8.4: Extract messageId from forwarded headers
  const messageId = extractMessageIdFromBody(forwardedSection) ?? extractMessageIdFromParsed(parsed)

  // Get content after the header block
  const contentHtml = extractContentAfterHeaders(parsed.html)
  const contentText = extractContentAfterHeaders(parsed.text)

  return {
    originalFrom: extractedFrom ?? parsed.from?.address ?? "",
    originalFromName: undefined,
    originalSubject: extractedSubject ?? stripForwardPrefix(parsed.subject ?? ""),
    originalDate: extractedDate ?? (parsed.date ? new Date(parsed.date) : new Date()),
    htmlContent: contentHtml ? sanitizeHtml(contentHtml) : undefined,
    textContent: contentText,
    messageId, // Story 8.4: For duplicate detection
  }
}

/**
 * Strip forward prefixes from subject
 */
function stripForwardPrefix(subject: string): string {
  return subject
    .replace(/^(Fwd|Fw|Re):\s*/gi, "")
    .replace(/^\[Fwd\]\s*/i, "")
    .replace(/^\[Fw\]\s*/i, "")
    .trim()
}

/**
 * Extract a header value from forwarded message body text
 */
function extractHeaderFromBody(body: string, headerName: string): string | null {
  // Pattern: "From: name@example.com" or "From: Name <name@example.com>"
  // Also handle quoted style like "> From: ..."
  const pattern = new RegExp(`^>?\\s*${headerName}:\\s*(.+)$`, "im")
  const match = body.match(pattern)

  if (!match) return null

  // For From header, extract email address
  if (headerName === "From") {
    const headerValue = match[1].trim()
    // Try to extract email from "Name <email>" format
    const emailMatch = headerValue.match(/<([^>]+)>/) || headerValue.match(/([^\s<>]+@[^\s<>]+)/)
    return emailMatch ? emailMatch[1].trim() : headerValue
  }

  return match[1].trim()
}

/**
 * Extract date from forwarded message body
 */
function extractDateFromBody(body: string): Date | null {
  // Pattern: "Date: Mon, Jan 20, 2026 at 10:00 AM" or RFC 2822 format
  // Also handle quoted style like "> Date: ..."
  const pattern = /^>?\s*Date:\s*(.+)$/im
  const match = body.match(pattern)

  if (!match) return null

  try {
    // Clean up the date string (remove "at" which some email clients add)
    const dateStr = match[1].replace(/\s+at\s+/, " ")
    const parsed = new Date(dateStr)

    // Validate the parsed date
    if (isNaN(parsed.getTime())) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

/**
 * Extract content after the forwarded headers block
 * Removes the header section from the content
 */
function extractContentAfterHeaders(content: string | undefined): string | undefined {
  if (!content) return undefined

  // Find where the actual content starts (after double newline following headers)
  // Headers typically end with a blank line
  const headerEndPatterns = [
    /---------- Forwarded message ---------[\s\S]*?\n\n/i,
    /-------- Original Message --------[\s\S]*?\n\n/i,
    /Begin forwarded message:[\s\S]*?\n\n/i,
  ]

  for (const pattern of headerEndPatterns) {
    const match = content.match(pattern)
    if (match) {
      const afterHeaders = content.slice((match.index ?? 0) + match[0].length)
      return afterHeaders.trim() || content
    }
  }

  // If no pattern matched, return original content
  return content
}

// ============================================================
// Exported for testing
// ============================================================

/** @internal Exported for unit testing */
export const _testing = {
  stripForwardPrefix,
  extractHeaderFromBody,
  extractDateFromBody,
  extractContentAfterHeaders,
  extractMessageIdFromBody, // Story 8.4: For testing duplicate detection
  EMAIL_REGEX,
  MAX_EMAIL_SIZE_BYTES,
  RATE_LIMIT_PER_HOUR,
  SOFT_LIMIT_BUFFER,
}
