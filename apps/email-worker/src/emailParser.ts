import PostalMime from "postal-mime"

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

/**
 * Sanitize HTML content to prevent XSS attacks
 * Removes dangerous tags, event handlers, and malicious URLs
 */
export function sanitizeHtml(html: string): string {
  return (
    html
      // Remove script tags and their content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      // Remove iframe tags (can embed malicious content)
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
      // Remove object/embed tags (plugin exploits)
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
      .replace(/<embed\b[^>]*\/?>/gi, "")
      // Remove form tags (phishing prevention)
      .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, "")
      // Remove meta refresh tags (redirect attacks)
      .replace(/<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi, "")
      // Remove base tags (hijacks relative URLs)
      .replace(/<base\b[^>]*>/gi, "")
      // Remove svg tags with potential script content
      .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, "<!-- svg removed -->")
      // Remove event handler attributes (onclick, onload, etc.)
      .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, "")
      .replace(/\bon\w+\s*=\s*[^\s>]*/gi, "")
      // Remove javascript: URLs
      .replace(/javascript:/gi, "blocked:")
      // Remove vbscript: URLs (IE legacy)
      .replace(/vbscript:/gi, "blocked:")
      // Remove data: URLs in src/href (can be used for XSS)
      .replace(/data:\s*text\/html/gi, "blocked:")
      .replace(/data:\s*image\/svg\+xml/gi, "blocked:")
  )
}

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
