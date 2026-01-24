/**
 * Content Normalization Utilities for Newsletter Deduplication
 * Story 2.5.2: Task 1 - Content normalization and hashing
 *
 * These functions normalize newsletter HTML content to enable deduplication.
 * The goal is to identify identical newsletters sent to different users
 * even when they contain user-specific elements (tracking pixels, greetings, etc.)
 */

/**
 * Normalize HTML content for consistent hashing
 *
 * Strips user-specific and tracking elements to identify identical content.
 * The normalized output should be the same for identical newsletters
 * sent to different recipients.
 *
 * @param html - Raw HTML content from newsletter
 * @returns Normalized content string for hashing
 */
/** Minimum length for hex strings to be considered tracking IDs (MD5 hash length) */
const MIN_TRACKING_HEX_LENGTH = 32

export function normalizeForHash(html: string): string {
  return (
    html
      // Strip tracking pixels - only match URLs with tracking path segments
      // This avoids false positives like "tracksuit.jpg" or "pixel-art.png"
      .replace(/<img[^>]*src=["'][^"']*\/(track|pixel|beacon|open|click)\/[^"']*["'][^>]*>/gi, "")
      // Also strip images with tracking subdomains (track.example.com, pixel.marketing.co)
      .replace(/<img[^>]*src=["']https?:\/\/(track|pixel|beacon|open)\.[^"']+["'][^>]*>/gi, "")
      // Remove all 1x1 images (common tracking pattern) - width then height
      .replace(/<img[^>]*width=["']?1["']?[^>]*height=["']?1["']?[^>]*>/gi, "")
      // Remove all 1x1 images - height then width
      .replace(/<img[^>]*height=["']?1["']?[^>]*width=["']?1["']?[^>]*>/gi, "")
      // Normalize unsubscribe links (preserve tag structure, replace URL)
      .replace(/href=["'][^"']*unsubscribe[^"']*["']/gi, 'href="UNSUBSCRIBE"')
      // Normalize personalized greetings (Hi John, Hi JOHN, Hi jean-pierre, → Hi USER,)
      // Case-insensitive for names, supports hyphenated names
      .replace(/\b(Hi|Hello|Dear|Hey)\s+[A-Za-z][A-Za-z-]*\s*,/gi, (match, greeting) => `${greeting} USER,`)
      // Strip long hex strings (32+ chars) - tracking codes, email-specific IDs
      .replace(new RegExp(`[a-f0-9]{${MIN_TRACKING_HEX_LENGTH},}`, "gi"), "HASH")
      // Normalize whitespace (collapse multiple spaces/newlines, trim)
      .replace(/\s+/g, " ")
      .trim()
  )
}

/**
 * Compute SHA-256 hash of content using Web Crypto API
 *
 * Note: crypto.subtle is available in Convex runtime (Web Crypto API).
 * This produces a deterministic 64-character hex string.
 *
 * @param content - Normalized content string
 * @returns 64-character lowercase hex string (SHA-256)
 */
export async function computeContentHash(content: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}
