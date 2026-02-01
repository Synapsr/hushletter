/**
 * PII Detection Helper for Admin Moderation
 * Story 9.6: Task 2.3 - PII detection for admin review
 *
 * Identifies common personalization patterns in newsletter content
 * to help admin identify content that may contain personal information.
 *
 * This is ADVISORY ONLY - it does not block publishing.
 * Admin makes the final decision on whether to sanitize or publish.
 */

/** Individual PII finding */
export interface PiiFind {
  type: string
  description: string
  count: number
  samples: string[]
}

/** Result of PII detection */
export interface PiiDetectionResult {
  hasPotentialPII: boolean
  findings: PiiFind[]
  recommendation: string
}

/** Pattern definition for PII detection */
interface PiiPattern {
  type: string
  regex: RegExp
  description: string
}

/**
 * Common personalization patterns to detect
 *
 * These patterns identify typical newsletter personalization:
 * - Personalized greetings (Hi John,)
 * - Email addresses in content
 * - Name references in salutations
 * - Personalized unsubscribe links with user IDs
 * - Tracking pixels with identifiers
 * - User IDs in URL parameters
 */
const PII_PATTERNS: PiiPattern[] = [
  {
    type: "greeting",
    // Match "Hi Name," but not "Hi there," - require proper name (2+ letters after first capital)
    regex: /Hi\s+[A-Z][a-z]{2,},/g,
    description: "Personalized greeting",
  },
  {
    type: "email",
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    description: "Email address in content",
  },
  {
    type: "name_reference",
    regex: /Dear\s+[A-Z][a-z]+/gi,
    description: "Name in salutation",
  },
  {
    type: "unsubscribe_link",
    // Match unsubscribe URLs with long IDs (user tracking)
    regex: /unsubscribe[^"'>\s]*[?&=][^"'>\s]*[a-zA-Z0-9]{16,}/gi,
    description: "Personalized unsubscribe link",
  },
  {
    type: "tracking_pixel",
    regex: /<img[^>]*(?:track|pixel|beacon|open)[^>]*>/gi,
    description: "Tracking pixel",
  },
  {
    type: "user_id",
    regex: /(?:user_id|uid|subscriber|recipient)[=_][a-zA-Z0-9-]+/gi,
    description: "User identifier in URL",
  },
]

/**
 * Detect potential PII in newsletter content
 *
 * Scans HTML content for common personalization patterns.
 * Returns a structured result with findings for admin review.
 *
 * @param htmlContent - The newsletter HTML content to scan
 * @returns PiiDetectionResult with findings and recommendation
 *
 * @example
 * const result = detectPotentialPII("<p>Hi John, thanks for subscribing!</p>")
 * // result.hasPotentialPII === true
 * // result.findings[0].type === "greeting"
 */
export function detectPotentialPII(htmlContent: string): PiiDetectionResult {
  const findings: PiiFind[] = []

  for (const pattern of PII_PATTERNS) {
    const matches = htmlContent.match(pattern.regex)
    if (matches && matches.length > 0) {
      // Deduplicate matches
      const uniqueMatches = [...new Set(matches)]

      findings.push({
        type: pattern.type,
        description: pattern.description,
        count: uniqueMatches.length,
        samples: uniqueMatches.slice(0, 3), // Up to 3 samples
      })
    }
  }

  const hasPotentialPII = findings.length > 0

  return {
    hasPotentialPII,
    findings,
    recommendation: hasPotentialPII
      ? "Review content before publishing. Consider sanitizing personalized elements."
      : "No obvious personalization detected.",
  }
}
