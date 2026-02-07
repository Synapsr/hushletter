import PostalMime from "postal-mime"
// Import sanitizeHtml from shared package to avoid duplication
import { sanitizeHtml } from "@hushletter/shared/utils"

/**
 * Parsed email data structure
 */
export interface ParsedEmail {
  subject: string
  from: string
  senderName?: string
  date: Date
  html?: string
  text?: string
  hasAttachments: boolean
}

/**
 * Result of getting storable content from parsed email
 */
export interface StorableContent {
  content: string
  contentType: "html" | "text"
}

/**
 * Parse raw email stream into structured data
 * Uses postal-mime library to handle MIME parsing
 */
export async function parseEmail(
  rawStream: ReadableStream<Uint8Array>
): Promise<ParsedEmail> {
  const reader = rawStream.getReader()
  const chunks: Uint8Array[] = []

  // Read all chunks from the stream
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      chunks.push(value)
    }
  }

  // Combine chunks into a single buffer
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0)
  const emailBuffer = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    emailBuffer.set(chunk, offset)
    offset += chunk.length
  }

  // Parse email using postal-mime
  const parser = new PostalMime()
  const email = await parser.parse(emailBuffer)

  return {
    subject: email.subject || "(no subject)",
    from: email.from?.address || "",
    senderName: email.from?.name || undefined,
    date: email.date ? new Date(email.date) : new Date(),
    html: email.html || undefined,
    text: email.text || undefined,
    hasAttachments: (email.attachments?.length ?? 0) > 0,
  }
}

// Re-export sanitizeHtml for backwards compatibility
export { sanitizeHtml }

/**
 * Get storable content from parsed email
 * Prefers HTML content, falls back to plain text
 */
export function getStorableContent(parsed: ParsedEmail): StorableContent {
  if (parsed.html) {
    return {
      content: sanitizeHtml(parsed.html),
      contentType: "html",
    }
  }

  return {
    content: parsed.text || "",
    contentType: "text",
  }
}
