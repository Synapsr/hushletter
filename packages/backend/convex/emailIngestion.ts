import { httpAction } from "./_generated/server"
import { internal } from "./_generated/api"
import type { Id } from "./_generated/dataModel"

/** Maximum allowed length for email subject (prevent DoS via oversized payloads) */
const MAX_SUBJECT_LENGTH = 1000

/** Maximum allowed length for email addresses */
const MAX_EMAIL_LENGTH = 254

/** Maximum allowed content length (5MB) */
const MAX_CONTENT_LENGTH = 5 * 1024 * 1024

/** Basic email format validation regex */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Validates an email address format and length
 * @returns Error message if invalid, undefined if valid
 */
export function validateEmail(email: unknown, fieldName: string): string | undefined {
  if (typeof email !== "string") {
    return `${fieldName} must be a string`
  }
  if (email.length === 0) {
    return `${fieldName} is required`
  }
  if (email.length > MAX_EMAIL_LENGTH) {
    return `${fieldName} exceeds maximum length of ${MAX_EMAIL_LENGTH} characters`
  }
  if (!EMAIL_REGEX.test(email)) {
    return `${fieldName} is not a valid email address`
  }
  return undefined
}

/**
 * Validates the email subject field
 * @returns Error message if invalid, undefined if valid
 */
export function validateSubject(subject: unknown): string | undefined {
  if (typeof subject !== "string") {
    return "subject must be a string"
  }
  if (subject.length === 0) {
    return "subject is required"
  }
  if (subject.length > MAX_SUBJECT_LENGTH) {
    return `subject exceeds maximum length of ${MAX_SUBJECT_LENGTH} characters`
  }
  return undefined
}

/**
 * Validates the receivedAt timestamp
 * @returns Error message if invalid, undefined if valid
 */
export function validateReceivedAt(receivedAt: unknown): string | undefined {
  if (typeof receivedAt !== "number") {
    return "receivedAt must be a number"
  }
  if (!Number.isFinite(receivedAt) || receivedAt <= 0) {
    return "receivedAt must be a positive timestamp"
  }
  return undefined
}

/**
 * Validates optional content fields (HTML or text)
 * @returns Error message if invalid, undefined if valid
 */
export function validateContent(content: unknown, fieldName: string): string | undefined {
  if (content === undefined || content === null) {
    return undefined // Content is optional
  }
  if (typeof content !== "string") {
    return `${fieldName} must be a string`
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return `${fieldName} exceeds maximum length of ${MAX_CONTENT_LENGTH} bytes`
  }
  return undefined
}

/**
 * HTTP action to receive email data from the Cloudflare Email Worker
 * Validates the internal API key, looks up the user, stores content in R2,
 * and creates the newsletter record
 *
 * Story 2.5.1: Updated for new schema with global senders and user sender settings
 * Story 9.2: Updated for private-by-default architecture
 *   - Always passes source: "email"
 *   - Resolves/creates folder for sender
 *   - No longer uses isPrivate from userSenderSettings for storage decisions
 */
export const receiveEmail = httpAction(async (ctx, request) => {
  // Validate internal API key
  const apiKey = request.headers.get("X-Internal-API-Key")
  const expectedKey = process.env.INTERNAL_API_KEY

  if (!expectedKey) {
    console.error("[emailIngestion] INTERNAL_API_KEY environment variable not set")
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  if (apiKey !== expectedKey) {
    console.log("[emailIngestion] Unauthorized: Invalid or missing API key")
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Parse request body
  let body: Record<string, unknown>

  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { to, from, subject, senderName, receivedAt, htmlContent, textContent } = body

  // Validate required fields with proper type checking and sanitization
  const validationErrors: string[] = []

  const toError = validateEmail(to, "to")
  if (toError) validationErrors.push(toError)

  const fromError = validateEmail(from, "from")
  if (fromError) validationErrors.push(fromError)

  const subjectError = validateSubject(subject)
  if (subjectError) validationErrors.push(subjectError)

  const receivedAtError = validateReceivedAt(receivedAt)
  if (receivedAtError) validationErrors.push(receivedAtError)

  const htmlContentError = validateContent(htmlContent, "htmlContent")
  if (htmlContentError) validationErrors.push(htmlContentError)

  const textContentError = validateContent(textContent, "textContent")
  if (textContentError) validationErrors.push(textContentError)

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
  const validatedTo = to as string
  const validatedFrom = from as string
  const validatedSubject = subject as string
  const validatedReceivedAt = receivedAt as number
  const validatedSenderName = typeof senderName === "string" ? senderName : undefined
  const validatedHtmlContent = typeof htmlContent === "string" ? htmlContent : undefined
  const validatedTextContent = typeof textContent === "string" ? textContent : undefined

  // Story 7.2: Create delivery log entry for monitoring
  // Generate a unique messageId if not provided (using timestamp + random for uniqueness)
  const messageId = `${validatedReceivedAt}-${validatedFrom}-${Math.random().toString(36).slice(2)}`
  let deliveryLogId: Id<"emailDeliveryLogs"> | null = null

  try {
    deliveryLogId = await ctx.runMutation(internal.admin.logEmailDelivery, {
      recipientEmail: validatedTo,
      senderEmail: validatedFrom,
      senderName: validatedSenderName,
      subject: validatedSubject,
      messageId,
    })
  } catch (error) {
    // Non-fatal: log but continue with email processing
    console.error("[emailIngestion] Failed to create delivery log:", error)
  }

  // Lookup user by dedicated email address or Pro vanity alias
  const user = await ctx.runQuery(internal._internal.users.findByInboundEmail, {
    email: validatedTo,
  })

  if (!user) {
    console.log(`[emailIngestion] No user found for address: ${validatedTo}`)
    // Story 7.2: Update delivery log with failure
    if (deliveryLogId) {
      try {
        await ctx.runMutation(internal.admin.updateDeliveryStatus, {
          logId: deliveryLogId,
          status: "failed",
          errorMessage: `No user found for address: ${validatedTo}`,
          errorCode: "USER_NOT_FOUND",
        })
      } catch (logError) {
        console.error("[emailIngestion] Failed to update delivery log:", logError)
      }
    }
    return new Response(JSON.stringify({ error: "Unknown recipient" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }

  console.log(
    `[emailIngestion] Processing email for user ${user._id}: "${validatedSubject}" from ${validatedFrom}${validatedSenderName ? ` (${validatedSenderName})` : ""}`
  )

  // Story 7.2: Update delivery log to processing status
  if (deliveryLogId) {
    try {
      await ctx.runMutation(internal.admin.updateDeliveryStatus, {
        logId: deliveryLogId,
        status: "processing",
        userId: user._id,
        hasHtmlContent: !!validatedHtmlContent,
        hasPlainTextContent: !!validatedTextContent,
        contentSizeBytes: (validatedHtmlContent?.length ?? 0) + (validatedTextContent?.length ?? 0),
      })
    } catch (logError) {
      console.error("[emailIngestion] Failed to update delivery log to processing:", logError)
    }
  }

  try {
    // Story 2.5.1: Get or create global sender
    const sender = await ctx.runMutation(internal.senders.getOrCreateSender, {
      email: validatedFrom,
      name: validatedSenderName,
    })

    // Story 9.2: Get or create folder for this sender (folder-centric architecture)
    const folderId = await ctx.runMutation(
      internal.senders.getOrCreateFolderForSender,
      {
        userId: user._id,
        senderId: sender._id,
      }
    )

    // Store content in R2 and create userNewsletter record
    // Story 8.4: storeNewsletterContent now performs duplicate detection
    // Story 9.2: Always private, pass source: "email" and folderId
    const result = await ctx.runAction(internal.newsletters.storeNewsletterContent, {
      userId: user._id,
      senderId: sender._id,
      folderId, // Story 9.2: Required for folder-centric architecture
      subject: validatedSubject,
      senderEmail: validatedFrom,
      senderName: validatedSenderName,
      receivedAt: validatedReceivedAt,
      htmlContent: validatedHtmlContent,
      textContent: validatedTextContent,
      source: "email", // Story 9.2: Track ingestion source
      // Note: emailIngestion doesn't have messageId - duplicate detection uses content hash
    })

    // Story 8.4: Handle duplicate detection (silent success, no error)
    if (result.skipped) {
      if (result.reason === "plan_limit") {
        console.log(
          `[emailIngestion] Plan limit reached: hardCap=${result.hardCap}, user=${user._id}`
        )
        if (deliveryLogId) {
          try {
            await ctx.runMutation(internal.admin.updateDeliveryStatus, {
              logId: deliveryLogId,
              status: "failed",
              errorMessage: `Plan storage limit reached (hard cap ${result.hardCap})`,
              errorCode: "PLAN_STORAGE_LIMIT",
            })
          } catch (logError) {
            console.error("[emailIngestion] Failed to update delivery log for plan limit:", logError)
          }
        }

        return new Response(
          JSON.stringify({
            success: true,
            userId: user._id,
            senderId: sender._id,
            skipped: true,
            reason: "plan_limit",
            hardCap: result.hardCap,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      }

      console.log(
        `[emailIngestion] Duplicate detected (${result.duplicateReason}): existingId=${result.existingId}`
      )
      // Return success without updating delivery log (email was processed, just a duplicate)
      return new Response(
        JSON.stringify({
          success: true,
          userId: user._id,
          userNewsletterId: result.existingId, // Return existing ID
          senderId: sender._id,
          skipped: true,
          reason: "duplicate",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    console.log(
      `[emailIngestion] Newsletter created: ${result.userNewsletterId}, R2 key: ${result.r2Key}, source=email`
    )

    // Story 7.2: Update delivery log to stored status
    if (deliveryLogId) {
      try {
        await ctx.runMutation(internal.admin.updateDeliveryStatus, {
          logId: deliveryLogId,
          status: "stored",
        })
      } catch (logError) {
        console.error("[emailIngestion] Failed to update delivery log to stored:", logError)
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        userId: user._id,
        userNewsletterId: result.userNewsletterId,
        senderId: sender._id,
        folderId, // Story 9.2: Return folderId
        source: "email", // Story 9.2: Confirm source
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    )
  } catch (error) {
    // Log detailed error for debugging
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorCode = (error as { data?: { code?: string } })?.data?.code || "UNKNOWN"
    console.error(
      `[emailIngestion] Failed to store newsletter: code=${errorCode}, message=${errorMessage}`,
      error
    )

    // Story 7.2: Update delivery log with failure
    if (deliveryLogId) {
      try {
        await ctx.runMutation(internal.admin.updateDeliveryStatus, {
          logId: deliveryLogId,
          status: "failed",
          errorMessage,
          errorCode,
        })
      } catch (logError) {
        console.error("[emailIngestion] Failed to update delivery log to failed:", logError)
      }
    }

    return new Response(
      JSON.stringify({
        error: "Failed to store newsletter content",
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
