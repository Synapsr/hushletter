import type { Env } from "./types"
import { callConvex, extractSenderName } from "./convexClient"
import { parseEmail, getStorableContent } from "./emailParser"

export default {
  /**
   * Handles incoming emails from Cloudflare Email Routing
   * Parses the email content and sends it to Convex for storage
   */
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const toAddress = message.to
    const fromAddress = message.from

    console.log(`[Email Worker] Received email to: ${toAddress} from: ${fromAddress}`)

    try {
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
      const result = await callConvex(env, {
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
