import { describe, expect, it } from "vitest"
import { detectPotentialPII } from "./piiDetection"

/**
 * Tests for PII Detection Helper
 * Story 9.6: Task 2.3, Task 6.7
 */

describe("detectPotentialPII", () => {
  describe("greeting detection", () => {
    it("detects personalized greetings like 'Hi John,'", () => {
      const result = detectPotentialPII("<p>Hi John, thanks for subscribing!</p>")

      expect(result.hasPotentialPII).toBe(true)
      expect(result.findings).toHaveLength(1)
      expect(result.findings[0].type).toBe("greeting")
      expect(result.findings[0].count).toBe(1)
      expect(result.findings[0].samples).toContain("Hi John,")
    })

    it("detects multiple different greetings", () => {
      const result = detectPotentialPII(
        "<p>Hi Alice,</p><p>Also, Hi Bob,</p>"
      )

      expect(result.hasPotentialPII).toBe(true)
      const greetingFinding = result.findings.find((f) => f.type === "greeting")
      expect(greetingFinding?.count).toBe(2)
    })

    it("does not detect generic greetings without names", () => {
      const result = detectPotentialPII("<p>Hi there,</p>")

      const greetingFinding = result.findings.find((f) => f.type === "greeting")
      expect(greetingFinding).toBeUndefined()
    })
  })

  describe("email detection", () => {
    it("detects email addresses in content", () => {
      const result = detectPotentialPII(
        "<p>Contact us at support@example.com</p>"
      )

      expect(result.hasPotentialPII).toBe(true)
      const emailFinding = result.findings.find((f) => f.type === "email")
      expect(emailFinding).toBeDefined()
      expect(emailFinding?.samples).toContain("support@example.com")
    })

    it("detects multiple email addresses", () => {
      const result = detectPotentialPII(
        "<p>From: sender@newsletter.com</p><p>Reply: john.doe@personal.email</p>"
      )

      const emailFinding = result.findings.find((f) => f.type === "email")
      expect(emailFinding?.count).toBe(2)
    })
  })

  describe("name reference detection", () => {
    it("detects 'Dear Name' salutations", () => {
      const result = detectPotentialPII("<p>Dear Sarah,</p>")

      expect(result.hasPotentialPII).toBe(true)
      const nameFinding = result.findings.find((f) => f.type === "name_reference")
      expect(nameFinding).toBeDefined()
      expect(nameFinding?.samples).toContain("Dear Sarah")
    })
  })

  describe("unsubscribe link detection", () => {
    it("detects personalized unsubscribe links", () => {
      const result = detectPotentialPII(
        '<a href="https://example.com/unsubscribe?id=abc123def456ghi789jkl012mno345">Unsubscribe</a>'
      )

      const unsubFinding = result.findings.find(
        (f) => f.type === "unsubscribe_link"
      )
      expect(unsubFinding).toBeDefined()
    })

    it("does not flag generic unsubscribe text", () => {
      const result = detectPotentialPII(
        '<a href="https://example.com/unsubscribe">Unsubscribe</a>'
      )

      const unsubFinding = result.findings.find(
        (f) => f.type === "unsubscribe_link"
      )
      expect(unsubFinding).toBeUndefined()
    })
  })

  describe("tracking pixel detection", () => {
    it("detects tracking pixels", () => {
      const result = detectPotentialPII(
        '<img src="https://example.com/track/abc123" width="1" height="1">'
      )

      const trackingFinding = result.findings.find(
        (f) => f.type === "tracking_pixel"
      )
      expect(trackingFinding).toBeDefined()
    })

    it("detects open tracking images", () => {
      const result = detectPotentialPII(
        '<img src="https://example.com/open/email123.gif">'
      )

      const trackingFinding = result.findings.find(
        (f) => f.type === "tracking_pixel"
      )
      expect(trackingFinding).toBeDefined()
    })
  })

  describe("user ID detection", () => {
    it("detects user_id in URLs", () => {
      const result = detectPotentialPII(
        '<a href="https://example.com/view?user_id=abc123">View</a>'
      )

      const userIdFinding = result.findings.find((f) => f.type === "user_id")
      expect(userIdFinding).toBeDefined()
    })

    it("detects uid parameter in URLs", () => {
      const result = detectPotentialPII(
        '<a href="https://example.com/click?uid=user12345">Click</a>'
      )

      const userIdFinding = result.findings.find((f) => f.type === "user_id")
      expect(userIdFinding).toBeDefined()
    })

    it("detects subscriber parameter in URLs", () => {
      const result = detectPotentialPII(
        '<a href="https://example.com/prefs?subscriber=sub123">Preferences</a>'
      )

      const userIdFinding = result.findings.find((f) => f.type === "user_id")
      expect(userIdFinding).toBeDefined()
    })
  })

  describe("clean content", () => {
    it("returns no findings for clean content", () => {
      const cleanContent = `
        <html>
          <body>
            <h1>Weekly Newsletter</h1>
            <p>Welcome to our newsletter!</p>
            <p>Here are this week's top stories...</p>
            <ul>
              <li>Story 1</li>
              <li>Story 2</li>
            </ul>
            <p>Thanks for reading!</p>
          </body>
        </html>
      `

      const result = detectPotentialPII(cleanContent)

      expect(result.hasPotentialPII).toBe(false)
      expect(result.findings).toHaveLength(0)
      expect(result.recommendation).toContain("No obvious personalization")
    })
  })

  describe("recommendation message", () => {
    it("returns advisory recommendation when PII detected", () => {
      const result = detectPotentialPII("<p>Hi John,</p>")

      expect(result.recommendation).toContain("Review content")
      expect(result.recommendation).toContain("sanitizing")
    })

    it("returns clean message when no PII detected", () => {
      const result = detectPotentialPII("<p>Welcome to our newsletter!</p>")

      expect(result.recommendation).toContain("No obvious personalization")
    })
  })

  describe("sample limiting", () => {
    it("limits samples to 3 per finding type", () => {
      // Create content with many email addresses
      const manyEmails = Array.from(
        { length: 10 },
        (_, i) => `email${i}@example.com`
      ).join(" ")
      const result = detectPotentialPII(`<p>${manyEmails}</p>`)

      const emailFinding = result.findings.find((f) => f.type === "email")
      expect(emailFinding?.samples.length).toBeLessThanOrEqual(3)
      expect(emailFinding?.count).toBe(10)
    })
  })

  describe("deduplication", () => {
    it("deduplicates identical matches", () => {
      const result = detectPotentialPII(
        "<p>Hi John,</p><p>Hi John,</p><p>Hi John,</p>"
      )

      const greetingFinding = result.findings.find((f) => f.type === "greeting")
      expect(greetingFinding?.count).toBe(1) // Deduplicated
    })
  })
})
