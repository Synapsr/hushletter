/**
 * EML Parser Utility
 *
 * Parses .eml files for manual newsletter import functionality.
 * Works in both browser (drag-drop preview) and Node.js (server processing).
 *
 * Uses PostalMime for MIME parsing - same library as email worker.
 */

import PostalMime, { type Attachment as PostalMimeAttachment } from "postal-mime"
import type {
  ParsedEml,
  EmlParseResult,
  EmlParseOptions,
  InlineImage,
  EmlAttachment,
} from "../types/eml"
import { EML_PARSE_DEFAULTS } from "../types/eml"

/**
 * Supported image MIME types for inline image processing
 */
const SUPPORTED_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
])

/**
 * Parse an EML file and extract newsletter data
 *
 * @param emlContent - Raw EML file content as Uint8Array or ArrayBuffer
 * @param options - Optional parsing configuration
 * @returns Parse result with extracted data or structured error
 */
export async function parseEmlFile(
  emlContent: Uint8Array | ArrayBuffer,
  options?: EmlParseOptions
): Promise<EmlParseResult> {
  const config = {
    maxFileSize: options?.maxFileSize ?? EML_PARSE_DEFAULTS.MAX_FILE_SIZE,
    maxAttachmentSize:
      options?.maxAttachmentSize ?? EML_PARSE_DEFAULTS.MAX_ATTACHMENT_SIZE,
    maxInlineImages:
      options?.maxInlineImages ?? EML_PARSE_DEFAULTS.MAX_INLINE_IMAGES,
  }

  // Convert ArrayBuffer to Uint8Array if needed
  const data =
    emlContent instanceof Uint8Array ? emlContent : new Uint8Array(emlContent)

  // Check file size limit
  if (data.byteLength > config.maxFileSize) {
    return {
      success: false,
      error: {
        code: "FILE_TOO_LARGE",
        message: `File size ${formatBytes(data.byteLength)} exceeds maximum of ${formatBytes(config.maxFileSize)}`,
      },
    }
  }

  try {
    // Parse using PostalMime
    const parser = new PostalMime()
    const email = await parser.parse(data)

    // Extract sender information
    const senderEmail = email.from?.address
    if (!senderEmail) {
      return {
        success: false,
        error: {
          code: "MISSING_REQUIRED_FIELD",
          message: "Email is missing sender address (From header)",
          field: "from",
        },
      }
    }

    // Extract date with validation
    const receivedAt = extractReceivedDate(email.date)
    if (receivedAt === null) {
      return {
        success: false,
        error: {
          code: "DATE_PARSE_ERROR",
          message: `Invalid or missing date: ${email.date ?? "not present"}`,
          field: "date",
        },
      }
    }

    // Process attachments and inline images
    const { inlineImages, attachments, totalAttachmentSize } =
      processAttachments(email.attachments ?? [], config.maxInlineImages)

    // Check total attachment size
    if (totalAttachmentSize > config.maxAttachmentSize) {
      return {
        success: false,
        error: {
          code: "TOO_MANY_ATTACHMENTS",
          message: `Total attachment size ${formatBytes(totalAttachmentSize)} exceeds maximum of ${formatBytes(config.maxAttachmentSize)}`,
        },
      }
    }

    // Get HTML content with CID references resolved
    let htmlContent = email.html ?? null
    if (htmlContent && inlineImages.length > 0) {
      htmlContent = resolveInlineImages(htmlContent, inlineImages)
    }

    // Sanitize HTML if present
    if (htmlContent) {
      htmlContent = sanitizeHtml(htmlContent)
    }

    const parsed: ParsedEml = {
      messageId: extractMessageId(email.messageId),
      subject: email.subject || "(no subject)",
      senderEmail,
      senderName: email.from?.name || null, // Convert empty string to null
      receivedAt,
      htmlContent,
      textContent: email.text ?? null,
      inlineImages,
      attachments,
    }

    return { success: true, data: parsed }
  } catch (error) {
    return {
      success: false,
      error: {
        code: "INVALID_FORMAT",
        message:
          error instanceof Error
            ? `Failed to parse EML: ${error.message}`
            : "Failed to parse EML file: Invalid MIME format",
      },
    }
  }
}

/**
 * Extract Message-ID header for duplicate detection
 *
 * @param messageId - Raw Message-ID value from email
 * @returns Cleaned Message-ID or null if not present
 */
export function extractMessageId(
  messageId: string | undefined | null
): string | null {
  if (!messageId) return null

  // Remove angle brackets if present
  const cleaned = messageId.trim().replace(/^<|>$/g, "")
  return cleaned || null
}

/**
 * Maximum allowed future date offset (7 days) to handle timezone issues and clock skew
 */
const MAX_FUTURE_DATE_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Extract and validate received date, converting to Unix timestamp
 *
 * @param dateString - Date string from email header
 * @returns Unix timestamp in milliseconds, or null if invalid
 *
 * Note: Dates more than 7 days in the future are rejected to catch clearly invalid dates
 * while allowing for reasonable timezone differences and server clock skew.
 */
function extractReceivedDate(dateString: string | undefined | null): number | null {
  if (!dateString) return null

  try {
    const parsed = new Date(dateString)
    const timestamp = parsed.getTime()

    // Validate the date is reasonable (not NaN, not in far future)
    if (isNaN(timestamp)) return null
    // Allow 7 days in future to handle timezone issues and server clock skew
    if (timestamp > Date.now() + MAX_FUTURE_DATE_MS) return null

    return timestamp
  } catch {
    return null
  }
}

/**
 * Process attachments, separating inline images from regular attachments
 */
function processAttachments(
  rawAttachments: PostalMimeAttachment[],
  maxInlineImages: number
): {
  inlineImages: InlineImage[]
  attachments: EmlAttachment[]
  totalAttachmentSize: number
} {
  const inlineImages: InlineImage[] = []
  const attachments: EmlAttachment[] = []
  let totalAttachmentSize = 0

  for (const att of rawAttachments) {
    // Get content as Uint8Array
    const contentBytes = getContentAsUint8Array(att.content)
    const size = contentBytes?.byteLength ?? 0
    totalAttachmentSize += size

    // Check if this is an inline image (has Content-ID and is an image type)
    const isInlineImage =
      att.contentId &&
      att.mimeType &&
      SUPPORTED_IMAGE_TYPES.has(att.mimeType.toLowerCase()) &&
      inlineImages.length < maxInlineImages

    if (isInlineImage && contentBytes) {
      // Convert to base64 for inline display
      const base64 = uint8ArrayToBase64(contentBytes)
      const cleanCid = att.contentId!.replace(/^<|>$/g, "")

      inlineImages.push({
        contentId: cleanCid,
        mimeType: att.mimeType,
        data: base64,
      })
    } else if (contentBytes) {
      // Regular attachment
      attachments.push({
        filename: att.filename ?? "unnamed",
        mimeType: att.mimeType || "application/octet-stream",
        size,
        data: contentBytes,
      })
    }
  }

  return { inlineImages, attachments, totalAttachmentSize }
}

/**
 * Convert PostalMime content (ArrayBuffer | string) to Uint8Array
 */
function getContentAsUint8Array(content: ArrayBuffer | string): Uint8Array | null {
  if (!content) return null

  if (content instanceof ArrayBuffer) {
    return new Uint8Array(content)
  }

  // String content - could be base64 or raw text
  // PostalMime typically returns ArrayBuffer for binary content
  // If it's a string, try to decode as base64
  try {
    if (typeof atob === "function") {
      const binary = atob(content)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      return bytes
    }
    // Node.js fallback
    return new Uint8Array([...content].map((c) => c.charCodeAt(0)))
  } catch {
    // Not valid base64, convert string directly
    const encoder = new TextEncoder()
    return encoder.encode(content)
  }
}

/**
 * Resolve CID references in HTML content with base64 data URIs
 *
 * @param html - HTML content with cid: references
 * @param inlineImages - Array of extracted inline images
 * @returns HTML with CID references replaced by data URIs
 */
export function resolveInlineImages(
  html: string,
  inlineImages: InlineImage[]
): string {
  if (inlineImages.length === 0) return html

  // Build lookup map for CID -> data URI
  const cidMap = new Map<string, string>()
  for (const img of inlineImages) {
    const dataUri = `data:${img.mimeType};base64,${img.data}`
    cidMap.set(img.contentId, dataUri)
  }

  // Replace cid: references in src attributes
  // Handles: src="cid:xxx", src='cid:xxx', and src=cid:xxx
  return html.replace(
    /src=["']?cid:([^"'\s>]+)["']?/gi,
    (match, cid) => {
      const dataUri = cidMap.get(cid)
      return dataUri ? `src="${dataUri}"` : match
    }
  )
}

/**
 * Sanitize HTML content to prevent XSS attacks
 * Removes dangerous tags, event handlers, and malicious URLs
 *
 * Based on email worker sanitizeHtml but included here for isomorphic use
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
      .replace(
        /<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi,
        "<!-- svg removed -->"
      )
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
 * Convert Uint8Array to base64 string (works in browser and Node.js)
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  // Use btoa in browser environments
  if (typeof btoa === "function") {
    let binary = ""
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  // Use Buffer in Node.js - check global scope
  // Buffer type exists in Node.js global scope
  const NodeBuffer = (globalThis as { Buffer?: typeof Buffer }).Buffer
  if (NodeBuffer) {
    return NodeBuffer.from(bytes).toString("base64")
  }

  // Fallback - shouldn't reach here in practice
  throw new Error("No base64 encoding method available")
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
