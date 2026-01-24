/**
 * Newsletter Detection Heuristics Tests
 * Story 4.2: Task 6.1 - Test newsletter detection heuristics
 */

import { describe, it, expect } from "vitest"
import {
  calculateNewsletterScore,
  hasListUnsubscribeHeader,
  isKnownNewsletterDomain,
  hasMailingListHeaders,
  isNewsletter,
  extractSenderEmail,
  extractSenderName,
  extractDomain,
  NEWSLETTER_THRESHOLD,
  SCORING_WEIGHTS,
  type EmailHeaders,
} from "./newsletterDetection"

describe("newsletterDetection", () => {
  describe("hasListUnsubscribeHeader", () => {
    it("returns true when List-Unsubscribe header exists", () => {
      const headers: EmailHeaders = {
        from: "test@example.com",
        subject: "Test",
        "list-unsubscribe": "<mailto:unsubscribe@example.com>",
      }
      expect(hasListUnsubscribeHeader(headers)).toBe(true)
    })

    it("returns false when List-Unsubscribe header is missing", () => {
      const headers: EmailHeaders = {
        from: "test@example.com",
        subject: "Test",
      }
      expect(hasListUnsubscribeHeader(headers)).toBe(false)
    })

    it("returns false when List-Unsubscribe header is empty string", () => {
      const headers: EmailHeaders = {
        from: "test@example.com",
        subject: "Test",
        "list-unsubscribe": "",
      }
      expect(hasListUnsubscribeHeader(headers)).toBe(false)
    })
  })

  describe("isKnownNewsletterDomain", () => {
    it("returns true for substack.com domain", () => {
      const headers: EmailHeaders = {
        from: "author@substack.com",
        subject: "Newsletter",
      }
      expect(isKnownNewsletterDomain(headers)).toBe(true)
    })

    it("returns true for subdomain of known platform", () => {
      const headers: EmailHeaders = {
        from: "newsletter@mail.beehiiv.com",
        subject: "Newsletter",
      }
      expect(isKnownNewsletterDomain(headers)).toBe(true)
    })

    it("returns true for email with name in from header", () => {
      const headers: EmailHeaders = {
        from: "John Doe <john@buttondown.email>",
        subject: "Newsletter",
      }
      expect(isKnownNewsletterDomain(headers)).toBe(true)
    })

    it("returns false for unknown domain", () => {
      const headers: EmailHeaders = {
        from: "test@gmail.com",
        subject: "Newsletter",
      }
      expect(isKnownNewsletterDomain(headers)).toBe(false)
    })

    it("returns false for empty from header", () => {
      const headers: EmailHeaders = {
        from: "",
        subject: "Newsletter",
      }
      expect(isKnownNewsletterDomain(headers)).toBe(false)
    })
  })

  describe("hasMailingListHeaders", () => {
    it("returns true when List-Id header exists", () => {
      const headers: EmailHeaders = {
        from: "test@example.com",
        subject: "Test",
        "list-id": "<newsletter.example.com>",
      }
      expect(hasMailingListHeaders(headers)).toBe(true)
    })

    it("returns true when Precedence is bulk", () => {
      const headers: EmailHeaders = {
        from: "test@example.com",
        subject: "Test",
        precedence: "bulk",
      }
      expect(hasMailingListHeaders(headers)).toBe(true)
    })

    it("returns true when Precedence is list", () => {
      const headers: EmailHeaders = {
        from: "test@example.com",
        subject: "Test",
        precedence: "list",
      }
      expect(hasMailingListHeaders(headers)).toBe(true)
    })

    it("returns true when Precedence is BULK (case insensitive)", () => {
      const headers: EmailHeaders = {
        from: "test@example.com",
        subject: "Test",
        precedence: "BULK",
      }
      expect(hasMailingListHeaders(headers)).toBe(true)
    })

    it("returns false for normal email headers", () => {
      const headers: EmailHeaders = {
        from: "test@example.com",
        subject: "Test",
      }
      expect(hasMailingListHeaders(headers)).toBe(false)
    })

    it("returns false when Precedence is normal", () => {
      const headers: EmailHeaders = {
        from: "test@example.com",
        subject: "Test",
        precedence: "normal",
      }
      expect(hasMailingListHeaders(headers)).toBe(false)
    })
  })

  describe("calculateNewsletterScore", () => {
    it("returns LIST_UNSUBSCRIBE points for List-Unsubscribe only", () => {
      const headers: EmailHeaders = {
        from: "test@example.com",
        subject: "Test",
        "list-unsubscribe": "<mailto:unsubscribe@example.com>",
      }
      expect(calculateNewsletterScore(headers)).toBe(SCORING_WEIGHTS.LIST_UNSUBSCRIBE)
    })

    it("returns KNOWN_DOMAIN points for known newsletter domain only", () => {
      const headers: EmailHeaders = {
        from: "test@substack.com",
        subject: "Test",
      }
      expect(calculateNewsletterScore(headers)).toBe(SCORING_WEIGHTS.KNOWN_DOMAIN)
    })

    it("returns LIST_ID points for List-Id only", () => {
      const headers: EmailHeaders = {
        from: "test@example.com",
        subject: "Test",
        "list-id": "<newsletter.example.com>",
      }
      expect(calculateNewsletterScore(headers)).toBe(SCORING_WEIGHTS.LIST_ID)
    })

    it("returns PRECEDENCE_BULK points for Precedence: bulk only", () => {
      const headers: EmailHeaders = {
        from: "test@example.com",
        subject: "Test",
        precedence: "bulk",
      }
      expect(calculateNewsletterScore(headers)).toBe(SCORING_WEIGHTS.PRECEDENCE_BULK)
    })

    it("returns combined score for List-Unsubscribe + known domain", () => {
      const headers: EmailHeaders = {
        from: "test@substack.com",
        subject: "Test",
        "list-unsubscribe": "<mailto:unsubscribe@example.com>",
      }
      const expected = SCORING_WEIGHTS.LIST_UNSUBSCRIBE + SCORING_WEIGHTS.KNOWN_DOMAIN
      expect(calculateNewsletterScore(headers)).toBe(expected)
    })

    it("returns 100 (capped) for multiple strong signals", () => {
      const headers: EmailHeaders = {
        from: "test@substack.com",
        subject: "Test",
        "list-unsubscribe": "<mailto:unsubscribe@example.com>",
        "list-id": "<newsletter.substack.com>",
        precedence: "bulk",
      }
      // Sum exceeds 100, so it gets capped
      const uncapped = SCORING_WEIGHTS.LIST_UNSUBSCRIBE + SCORING_WEIGHTS.KNOWN_DOMAIN +
        SCORING_WEIGHTS.LIST_ID + SCORING_WEIGHTS.PRECEDENCE_BULK
      expect(uncapped).toBeGreaterThan(100)
      expect(calculateNewsletterScore(headers)).toBe(100)
    })

    it("returns 0 for regular email", () => {
      const headers: EmailHeaders = {
        from: "friend@gmail.com",
        subject: "Hello!",
      }
      expect(calculateNewsletterScore(headers)).toBe(0)
    })
  })

  describe("isNewsletter", () => {
    it("returns true when score >= NEWSLETTER_THRESHOLD", () => {
      const headers: EmailHeaders = {
        from: "test@substack.com",
        subject: "Test",
      }
      expect(isNewsletter(headers)).toBe(true)
      expect(calculateNewsletterScore(headers)).toBeGreaterThanOrEqual(
        NEWSLETTER_THRESHOLD
      )
    })

    it("returns false when score < NEWSLETTER_THRESHOLD", () => {
      const headers: EmailHeaders = {
        from: "friend@gmail.com",
        subject: "Hello!",
      }
      expect(isNewsletter(headers)).toBe(false)
      expect(calculateNewsletterScore(headers)).toBeLessThan(NEWSLETTER_THRESHOLD)
    })
  })

  describe("extractSenderEmail", () => {
    it("extracts email from angle bracket format", () => {
      expect(extractSenderEmail("John Doe <john@example.com>")).toBe(
        "john@example.com"
      )
    })

    it("returns email as-is when no angle brackets", () => {
      expect(extractSenderEmail("john@example.com")).toBe("john@example.com")
    })

    it("converts to lowercase", () => {
      expect(extractSenderEmail("John@Example.COM")).toBe("john@example.com")
    })

    it("handles quoted name with angle brackets", () => {
      expect(extractSenderEmail('"John Doe" <john@example.com>')).toBe(
        "john@example.com"
      )
    })

    it("trims whitespace", () => {
      expect(extractSenderEmail("  john@example.com  ")).toBe("john@example.com")
    })
  })

  describe("extractSenderName", () => {
    it("extracts name from angle bracket format", () => {
      expect(extractSenderName("John Doe <john@example.com>")).toBe("John Doe")
    })

    it("returns null when no name present", () => {
      expect(extractSenderName("john@example.com")).toBeNull()
    })

    it("removes surrounding quotes", () => {
      expect(extractSenderName('"John Doe" <john@example.com>')).toBe("John Doe")
    })

    it("returns null for empty name", () => {
      expect(extractSenderName("<john@example.com>")).toBeNull()
    })
  })

  describe("extractDomain", () => {
    it("extracts domain from email", () => {
      expect(extractDomain("john@example.com")).toBe("example.com")
    })

    it("handles subdomains", () => {
      expect(extractDomain("john@mail.example.com")).toBe("mail.example.com")
    })

    it("converts to lowercase", () => {
      expect(extractDomain("john@Example.COM")).toBe("example.com")
    })

    it("returns empty string for invalid email", () => {
      expect(extractDomain("invalid")).toBe("")
    })
  })

  describe("NEWSLETTER_THRESHOLD", () => {
    it("is 30", () => {
      expect(NEWSLETTER_THRESHOLD).toBe(30)
    })
  })

  describe("SCORING_WEIGHTS", () => {
    it("has expected values for each signal type", () => {
      // These values are documented in the module and used by the scoring algorithm
      expect(SCORING_WEIGHTS.LIST_UNSUBSCRIBE).toBe(50)
      expect(SCORING_WEIGHTS.KNOWN_DOMAIN).toBe(30)
      expect(SCORING_WEIGHTS.LIST_ID).toBe(30)
      expect(SCORING_WEIGHTS.PRECEDENCE_BULK).toBe(10)
    })

    it("allows single strong signal to meet threshold", () => {
      // List-Unsubscribe alone should be enough to pass threshold
      expect(SCORING_WEIGHTS.LIST_UNSUBSCRIBE).toBeGreaterThanOrEqual(NEWSLETTER_THRESHOLD)
    })

    it("allows single medium signal to meet threshold", () => {
      // Known domain alone should be enough to pass threshold
      expect(SCORING_WEIGHTS.KNOWN_DOMAIN).toBeGreaterThanOrEqual(NEWSLETTER_THRESHOLD)
    })
  })
})
