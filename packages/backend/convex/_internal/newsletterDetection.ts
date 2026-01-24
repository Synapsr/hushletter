/**
 * Newsletter Detection Heuristics
 * Story 4.2: Task 2 - Implement heuristics to identify newsletters from email headers
 *
 * Uses multiple signals to calculate a confidence score for whether an email
 * is from a newsletter sender. Signals include:
 * - List-Unsubscribe header (strongest signal)
 * - Known newsletter platform domains
 * - Mailing list headers (List-Id, Precedence)
 */

/**
 * Scoring weights for newsletter detection heuristics
 * These weights determine how much each signal contributes to the total score.
 * Total possible score: 120 (capped at 100)
 */
export const SCORING_WEIGHTS = {
  /** List-Unsubscribe header - strongest signal, required by most email providers for bulk mail */
  LIST_UNSUBSCRIBE: 50,
  /** Known newsletter platform domain (substack, beehiiv, etc.) */
  KNOWN_DOMAIN: 30,
  /** List-Id header - indicates mailing list */
  LIST_ID: 30,
  /** Precedence: bulk/list header - weak signal indicating mass mailing */
  PRECEDENCE_BULK: 10,
} as const

/**
 * Email headers extracted from Gmail API response
 * Only includes headers relevant for newsletter detection
 */
export type EmailHeaders = {
  "list-unsubscribe"?: string
  "list-id"?: string
  precedence?: string
  from: string
  subject: string
}

/**
 * Known newsletter platform domains
 * These are services that primarily send newsletters, so any email from
 * these domains is very likely to be a newsletter.
 *
 * Story 4.2: Task 2.3 - Known newsletter domain check
 */
const KNOWN_NEWSLETTER_DOMAINS = [
  "substack.com",
  "buttondown.email",
  "beehiiv.com",
  "convertkit.com",
  "mailchimp.com",
  "ghost.io",
  "revue.co",
  "getrevue.co",
  "sendfox.com",
  "mailerlite.com",
  "campaignmonitor.com",
  "constantcontact.com",
  "sendgrid.net",
  "klaviyo.com",
  "drip.com",
  "activecampaign.com",
  "aweber.com",
  "getresponse.com",
  "moosend.com",
  "emailoctopus.com",
  "tinyletter.com",
  "curated.co",
  "letterhead.email",
  "paragraph.xyz",
  "mirror.xyz",
]

/**
 * Check if email has List-Unsubscribe header
 * This is the strongest signal - it's required by most email providers
 * for bulk/marketing emails and strongly indicates a newsletter.
 *
 * Story 4.2: Task 2.2 - List-Unsubscribe header check
 */
export function hasListUnsubscribeHeader(headers: EmailHeaders): boolean {
  return Boolean(headers["list-unsubscribe"])
}

/**
 * Check if email is from a known newsletter platform domain
 * Extracts domain from the "from" header and checks against known platforms.
 *
 * Story 4.2: Task 2.3 - Known newsletter domain check
 */
export function isKnownNewsletterDomain(headers: EmailHeaders): boolean {
  // Extract domain from "from" header
  // Format: "Name <email@domain.com>" or "email@domain.com"
  const fromMatch = headers.from.match(/<([^>]+)>/) || [
    null,
    headers.from.trim(),
  ]
  const email = fromMatch[1]
  if (!email) return false

  const domain = email.split("@")[1]?.toLowerCase()
  if (!domain) return false

  // Check if domain matches or is subdomain of known newsletter domain
  return KNOWN_NEWSLETTER_DOMAINS.some(
    (knownDomain) =>
      domain === knownDomain || domain.endsWith(`.${knownDomain}`)
  )
}

/**
 * Check if email has mailing list headers
 * List-Id and Precedence: bulk/list are indicators of mailing list emails.
 *
 * Story 4.2: Task 2.4 - Mailing list headers check
 */
export function hasMailingListHeaders(headers: EmailHeaders): boolean {
  // List-Id is a strong indicator
  if (headers["list-id"]) return true

  // Precedence: bulk or list indicates mass mailing
  const precedence = headers.precedence?.toLowerCase()
  if (precedence === "bulk" || precedence === "list") return true

  return false
}

/**
 * Calculate newsletter confidence score based on multiple heuristics
 * Returns a score from 0-100 where higher means more likely to be a newsletter.
 *
 * See SCORING_WEIGHTS for point values.
 * Threshold: NEWSLETTER_THRESHOLD (30) - emails with score >= threshold are newsletters.
 *
 * Story 4.2: Task 2.5 - Scoring function combining heuristics
 */
export function calculateNewsletterScore(headers: EmailHeaders): number {
  let score = 0

  // Strong signals
  if (hasListUnsubscribeHeader(headers)) {
    score += SCORING_WEIGHTS.LIST_UNSUBSCRIBE
  }

  // Medium signals
  if (isKnownNewsletterDomain(headers)) {
    score += SCORING_WEIGHTS.KNOWN_DOMAIN
  }
  if (headers["list-id"]) {
    score += SCORING_WEIGHTS.LIST_ID
  }

  // Weak signals
  const precedence = headers.precedence?.toLowerCase()
  if (precedence === "bulk" || precedence === "list") {
    score += SCORING_WEIGHTS.PRECEDENCE_BULK
  }

  // Cap at 100
  return Math.min(score, 100)
}

/**
 * Newsletter confidence threshold
 * - 50+ = definitely newsletter (has List-Unsubscribe)
 * - 30-49 = probably newsletter (known domain or list headers)
 * - <30 = unlikely to be newsletter
 *
 * We use 30 as threshold to catch newsletters from platforms we know,
 * even if they don't have List-Unsubscribe header.
 */
export const NEWSLETTER_THRESHOLD = 30

/**
 * Determine if email headers indicate a newsletter based on threshold
 */
export function isNewsletter(headers: EmailHeaders): boolean {
  return calculateNewsletterScore(headers) >= NEWSLETTER_THRESHOLD
}

/**
 * Extract sender email from "from" header
 * Handles formats like "Name <email@domain.com>" and "email@domain.com"
 */
export function extractSenderEmail(from: string): string {
  const match = from.match(/<([^>]+)>/)
  if (match) {
    return match[1].toLowerCase()
  }
  // If no angle brackets, assume the whole string is an email
  return from.trim().toLowerCase()
}

/**
 * Extract sender name from "from" header
 * Returns null if only email is present
 */
export function extractSenderName(from: string): string | null {
  // Check for format: "Name <email@domain.com>"
  const match = from.match(/^([^<]+)<[^>]+>$/)
  if (match) {
    const name = match[1].trim()
    // Remove surrounding quotes if present
    if (name.startsWith('"') && name.endsWith('"')) {
      return name.slice(1, -1)
    }
    return name || null
  }
  return null
}

/**
 * Extract domain from email address
 */
export function extractDomain(email: string): string {
  const parts = email.split("@")
  return parts[1]?.toLowerCase() || ""
}
