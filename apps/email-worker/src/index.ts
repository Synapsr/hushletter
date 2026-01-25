import type { Env } from "./types"
import { callConvex, extractSenderName, type ConvexConfig } from "./convexClient"
import { parseEmail, getStorableContent } from "./emailParser"
import { handleImportEmail } from "./importHandler"

/**
 * Determines if email should be routed to dev environment
 * Matches pattern: *-dev@domain.com
 */
function isDevEmail(toAddress: string): boolean {
  const localPart = toAddress.split("@")[0]
  return localPart?.endsWith("-dev") ?? false
}

/**
 * Gets the Convex configuration based on the email address
 */
function getConvexConfig(toAddress: string, env: Env): ConvexConfig | null {
  const isDev = isDevEmail(toAddress)

  if (isDev) {
    if (!env.CONVEX_URL_DEV || !env.INTERNAL_API_KEY_DEV) {
      console.log("[Email Worker] Dev email received but dev environment not configured")
      return null
    }
    return {
      url: env.CONVEX_URL_DEV,
      apiKey: env.INTERNAL_API_KEY_DEV,
    }
  }

  return {
    url: env.CONVEX_URL,
    apiKey: env.INTERNAL_API_KEY,
  }
}

/**
 * Checks if this is an import email (to import@hushletter.com)
 * Story 8.3: Forward-to-import endpoint routing
 */
function isImportEmail(toAddress: string): boolean {
  const localPart = toAddress.split("@")[0]
  return localPart?.toLowerCase() === "import"
}

export default {
  /**
   * Handles incoming emails from Cloudflare Email Routing
   * Parses the email content and sends it to Convex for storage
   * Routes based on email address:
   * - import@ → Import handler (Story 8.3)
   * - *-dev@ → Dev environment
   * - other → Prod environment (dedicated address)
   */
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const toAddress = message.to
    const fromAddress = message.from

    // Story 8.3: Route import@ emails to dedicated handler (AC #1, #7)
    if (isImportEmail(toAddress)) {
      console.log(`[Email Worker] Import email from: ${fromAddress}`)
      await handleImportEmail(message, env)
      return
    }

    const isDev = isDevEmail(toAddress)
    console.log(`[Email Worker] Received email to: ${toAddress} from: ${fromAddress} (env: ${isDev ? "dev" : "prod"})`)

    try {
      // Get the Convex config for this email (dev or prod)
      const convexConfig = getConvexConfig(toAddress, env)
      if (!convexConfig) {
        console.log("[Email Worker] Skipping email - no valid Convex config")
        return
      }

      // Parse the raw email content
      const parsed = await parseEmail(message.raw)
      console.log(`[Email Worker] Parsed: "${parsed.subject}" from ${parsed.from}`)

      // Get the content to store (prefers HTML, falls back to text)
      const { content, contentType } = getStorableContent(parsed)
      console.log(
        `[Email Worker] Content: type=${contentType}, length=${content.length}, ` +
          `hasHtml=${!!parsed.html}, hasText=${!!parsed.text}`
      )

      // Use parsed sender info, fallback to envelope for name extraction
      const senderName = parsed.senderName || extractSenderName(fromAddress)

      // Send everything to Convex - R2 upload happens there
      const result = await callConvex(convexConfig, {
        to: toAddress,
        from: parsed.from || fromAddress,
        subject: parsed.subject,
        senderName,
        receivedAt: parsed.date.getTime(),
        htmlContent: contentType === "html" ? content : undefined,
        textContent: contentType === "text" ? content : undefined,
      })

      if (result.success) {
        console.log(`[Email Worker] Newsletter created: ${result.newsletterId} for user: ${result.userId}`)
      } else {
        // Log the error but don't throw - we don't want to reject the email
        console.log(`[Email Worker] Email processing returned error: ${result.error}`)
      }
    } catch (error) {
      // Don't throw - we don't want to reject the email and potentially lose it
      // Log for debugging but accept delivery
      console.error("[Email Worker] Failed to process email:", error)
    }
  },
}
