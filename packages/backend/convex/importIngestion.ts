import { httpAction } from "./_generated/server"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"

/**
 * Maximum allowed content length (5MB) - same as emailIngestion
 */
const MAX_CONTENT_LENGTH = 5 * 1024 * 1024

/**
 * Maximum allowed length for email subject
 */
const MAX_SUBJECT_LENGTH = 1000

/**
 * Maximum allowed length for email addresses
 */
const MAX_EMAIL_LENGTH = 254

/**
 * Basic email format validation regex - same as emailIngestion
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * API key validation result
 */
type ApiKeyValidationResult =
  | { valid: true }
  | { valid: false; error: "not_configured"; status: 500 }
  | { valid: false; error: "unauthorized"; status: 401 }

/**
 * Validate internal API key
 * Returns validation result distinguishing between server config error vs client auth failure
 */
function validateApiKey(request: Request): ApiKeyValidationResult {
  const expectedKey = process.env.INTERNAL_API_KEY

  if (!expectedKey) {
    console.error("[importIngestion] INTERNAL_API_KEY environment variable not set")
    return { valid: false, error: "not_configured", status: 500 }
  }

  const apiKey = request.headers.get("X-Internal-API-Key")

  // Timing-safe comparison to prevent timing attacks
  // For strings of different length, this still leaks length info but
  // that's acceptable for API keys where length is typically fixed/known
  if (!apiKey || apiKey.length !== expectedKey.length) {
    return { valid: false, error: "unauthorized", status: 401 }
  }

  // Character-by-character comparison that takes constant time
  let result = 0
  for (let i = 0; i < apiKey.length; i++) {
    result |= apiKey.charCodeAt(i) ^ expectedKey.charCodeAt(i)
  }

  if (result !== 0) {
    return { valid: false, error: "unauthorized", status: 401 }
  }

  return { valid: true }
}

/**
 * HTTP action to verify if a user exists by their registered email
 * Story 8.3: Task 2.2 - User lookup endpoint for import handler
 *
 * Returns { found: true, userId } if user exists, { found: false } otherwise.
 * Used by email worker to validate forwarding user before processing.
 */
export const verifyUser = httpAction(async (ctx, request) => {
  const authResult = validateApiKey(request)
  if (!authResult.valid) {
    const errorMessage = authResult.error === "not_configured"
      ? "Server configuration error"
      : "Unauthorized"
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: authResult.status,
      headers: { "Content-Type": "application/json" },
    })
  }

  let body: { email?: unknown }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { email } = body

  if (typeof email !== "string" || email.length === 0) {
    return new Response(JSON.stringify({ error: "Email is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Look up user by registered email
  const user = await ctx.runQuery(internal._internal.users.findByRegisteredEmail, {
    email,
  })

  if (!user) {
    return new Response(JSON.stringify({ found: false }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }

  return new Response(
    JSON.stringify({
      found: true,
      userId: user._id,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  )
})

/**
 * HTTP action to log rejected import attempts
 * Story 8.3: Task 2.4 - Admin monitoring for rejected imports (AC #3)
 *
 * Creates a delivery log entry with failed status for admin visibility.
 * This allows admins to monitor for abuse or user configuration issues.
 */
export const logRejection = httpAction(async (ctx, request) => {
  const authResult = validateApiKey(request)
  if (!authResult.valid) {
    const errorMessage = authResult.error === "not_configured"
      ? "Server configuration error"
      : "Unauthorized"
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: authResult.status,
      headers: { "Content-Type": "application/json" },
    })
  }

  let body: { email?: unknown; reason?: unknown }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { email, reason } = body

  if (typeof email !== "string" || typeof reason !== "string") {
    return new Response(JSON.stringify({ error: "Email and reason are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Generate a unique messageId for the rejection log
  const messageId = `import-rejection-${Date.now()}-${Math.random().toString(36).slice(2)}`

  try {
    // Create delivery log entry
    const logId = await ctx.runMutation(internal.admin.logEmailDelivery, {
      recipientEmail: "import@hushletter.com",
      senderEmail: email,
      subject: `[Import Rejected] ${reason}`,
      messageId,
    })

    // Update status to failed with the rejection reason
    await ctx.runMutation(internal.admin.updateDeliveryStatus, {
      logId,
      status: "failed",
      errorCode: reason,
      errorMessage: `Import rejected: ${reason}`,
    })
  } catch (error) {
    console.error("[importIngestion] Failed to log rejection:", error)
    // Non-fatal - continue even if logging fails
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  })
})

/**
 * HTTP action to receive forwarded email imports
 * Story 8.3: Task 4 - Import ingestion endpoint (AC #5)
 * Story 8.4: Task 5.1, 5.2 - Duplicate detection support
 * Story 9.2: Updated for private-by-default architecture
 *   - Always passes source: "manual"
 *   - Resolves/creates folder for sender
 *   - No longer uses isPrivate from userSenderSettings
 *
 * Similar to receiveEmail but:
 * - Takes userId directly (already verified by email worker)
 * - Uses original sender/date from forwarded email extraction
 * - Reuses existing sender matching and content storage
 * - Story 8.4: Handles duplicate detection via messageId (silent skip, no error)
 */
export const receiveImportEmail = httpAction(async (ctx, request) => {
  const authResult = validateApiKey(request)
  if (!authResult.valid) {
    const errorMessage = authResult.error === "not_configured"
      ? "Server configuration error"
      : "Unauthorized"
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: authResult.status,
      headers: { "Content-Type": "application/json" },
    })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const {
    userId,
    forwardingUserEmail,
    originalFrom,
    originalFromName,
    originalSubject,
    originalDate,
    htmlContent,
    textContent,
    messageId, // Story 8.4: For duplicate detection
  } = body

  // Validate required fields
  const validationErrors: string[] = []

  if (typeof userId !== "string") {
    validationErrors.push("userId is required")
  }

  if (typeof forwardingUserEmail !== "string") {
    validationErrors.push("forwardingUserEmail is required")
  }

  if (typeof originalFrom !== "string" || originalFrom.length === 0) {
    validationErrors.push("originalFrom is required")
  } else if (originalFrom.length > MAX_EMAIL_LENGTH) {
    validationErrors.push(`originalFrom exceeds maximum length of ${MAX_EMAIL_LENGTH}`)
  } else if (!EMAIL_REGEX.test(originalFrom)) {
    validationErrors.push("originalFrom is not a valid email address")
  }

  if (typeof originalSubject !== "string" || originalSubject.length === 0) {
    validationErrors.push("originalSubject is required")
  } else if (originalSubject.length > MAX_SUBJECT_LENGTH) {
    validationErrors.push(`originalSubject exceeds maximum length of ${MAX_SUBJECT_LENGTH}`)
  }

  if (typeof originalDate !== "number" || originalDate <= 0) {
    validationErrors.push("originalDate must be a positive timestamp")
  }

  if (htmlContent !== undefined && typeof htmlContent !== "string") {
    validationErrors.push("htmlContent must be a string")
  } else if (typeof htmlContent === "string" && htmlContent.length > MAX_CONTENT_LENGTH) {
    validationErrors.push(`htmlContent exceeds maximum length of ${MAX_CONTENT_LENGTH}`)
  }

  if (textContent !== undefined && typeof textContent !== "string") {
    validationErrors.push("textContent must be a string")
  } else if (typeof textContent === "string" && textContent.length > MAX_CONTENT_LENGTH) {
    validationErrors.push(`textContent exceeds maximum length of ${MAX_CONTENT_LENGTH}`)
  }

  // Require at least one content field
  const hasHtmlContent = typeof htmlContent === "string" && htmlContent.trim().length > 0
  const hasTextContent = typeof textContent === "string" && textContent.trim().length > 0
  if (!hasHtmlContent && !hasTextContent) {
    validationErrors.push("At least one of htmlContent or textContent is required")
  }

  if (validationErrors.length > 0) {
    return new Response(
      JSON.stringify({ error: "Validation failed", details: validationErrors }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    )
  }

  // Type assertions are safe after validation
  const validatedUserId = userId as string
  const validatedOriginalFrom = originalFrom as string
  const validatedOriginalSubject = originalSubject as string
  const validatedOriginalDate = originalDate as number
  const validatedOriginalFromName =
    typeof originalFromName === "string" ? originalFromName : undefined
  const validatedHtmlContent =
    typeof htmlContent === "string" ? htmlContent : undefined
  const validatedTextContent =
    typeof textContent === "string" ? textContent : undefined
  // Story 8.4: Extract messageId for duplicate detection (optional)
  const validatedMessageId =
    typeof messageId === "string" && messageId.length > 0 ? messageId : undefined

  // Verify user exists
  const user = await ctx.runQuery(internal._internal.users.findById, {
    userId: validatedUserId as Id<"users">,
  })

  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }

  console.log(
    `[importIngestion] Processing import for user ${user._id}: ` +
      `"${validatedOriginalSubject}" from ${validatedOriginalFrom}` +
      `${validatedOriginalFromName ? ` (${validatedOriginalFromName})` : ""}`
  )

  try {
    // Get or create global sender (reuse existing logic - AC #5)
    const sender = await ctx.runMutation(internal.senders.getOrCreateSender, {
      email: validatedOriginalFrom,
      name: validatedOriginalFromName,
    })

    // Story 9.2: Get or create folder for this sender (folder-centric architecture)
    const folderId = await ctx.runMutation(
      internal.senders.getOrCreateFolderForSender,
      {
        userId: user._id,
        senderId: sender._id,
      }
    )

    // Store content in R2 and create userNewsletter record (reuse existing logic - AC #5)
    // Story 8.4: Pass messageId for duplicate detection
    // Story 9.2: Pass source: "manual" and folderId
    const result = await ctx.runAction(internal.newsletters.storeNewsletterContent, {
      userId: user._id,
      senderId: sender._id,
      folderId, // Story 9.2: Required for folder-centric architecture
      subject: validatedOriginalSubject,
      senderEmail: validatedOriginalFrom,
      senderName: validatedOriginalFromName,
      receivedAt: validatedOriginalDate,
      htmlContent: validatedHtmlContent,
      textContent: validatedTextContent,
      source: "manual", // Story 9.2: Track ingestion source
      messageId: validatedMessageId, // Story 8.4: For duplicate detection
    })

    // Story 8.4: Handle duplicate detection (AC #1, #2 - silent skip, no error)
    // FR33: "Duplicate emails are not imported (no error shown to user)"
    if (result.skipped) {
      console.log(
        `[importIngestion] Duplicate detected (${result.duplicateReason}): ` +
          `existingId=${result.existingId}, messageId=${validatedMessageId ?? "none"}`
      )
      return new Response(
        JSON.stringify({
          success: true, // Silent success for duplicate (FR33 - no error shown)
          skipped: true,
          reason: "duplicate",
          duplicateReason: result.duplicateReason,
          existingId: result.existingId,
          senderId: sender._id,
          folderId, // Story 9.2: Return folderId
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    console.log(
      `[importIngestion] Import successful: userNewsletterId=${result.userNewsletterId}, ` +
        `r2Key=${result.r2Key}, source=manual, folderId=${folderId}`
    )

    return new Response(
      JSON.stringify({
        success: true,
        userNewsletterId: result.userNewsletterId,
        senderId: sender._id,
        folderId, // Story 9.2: Return folderId
        source: "manual", // Story 9.2: Confirm source
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorCode =
      (error as { data?: { code?: string } })?.data?.code || "UNKNOWN"
    console.error(
      `[importIngestion] Failed to store imported newsletter: code=${errorCode}, message=${errorMessage}`,
      error
    )

    return new Response(
      JSON.stringify({
        error: "Failed to store imported newsletter",
        code: errorCode,
        details: errorMessage,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    )
  }
})
