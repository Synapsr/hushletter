import { describe, it, expect } from "vitest"
import {
  validateEmail,
  validateSubject,
  validateReceivedAt,
  validateContent,
} from "./emailIngestion"

describe("emailIngestion validation helpers", () => {
  describe("validateEmail", () => {
    it("returns undefined for valid email", () => {
      expect(validateEmail("user@example.com", "to")).toBeUndefined()
      expect(validateEmail("test.name+tag@sub.domain.co.uk", "from")).toBeUndefined()
    })

    it("returns error for non-string input", () => {
      expect(validateEmail(123, "to")).toBe("to must be a string")
      expect(validateEmail(null, "from")).toBe("from must be a string")
      expect(validateEmail(undefined, "to")).toBe("to must be a string")
    })

    it("returns error for empty string", () => {
      expect(validateEmail("", "to")).toBe("to is required")
    })

    it("returns error for email exceeding max length", () => {
      const longEmail = "a".repeat(250) + "@b.com"
      expect(validateEmail(longEmail, "to")).toContain("exceeds maximum length")
    })

    it("returns error for invalid email format", () => {
      expect(validateEmail("not-an-email", "to")).toBe("to is not a valid email address")
      expect(validateEmail("missing@domain", "to")).toBe("to is not a valid email address")
      expect(validateEmail("@nodomain.com", "to")).toBe("to is not a valid email address")
      expect(validateEmail("spaces in@email.com", "to")).toBe("to is not a valid email address")
    })
  })

  describe("validateSubject", () => {
    it("returns undefined for valid subject", () => {
      expect(validateSubject("Newsletter Weekly Update")).toBeUndefined()
      expect(validateSubject("A")).toBeUndefined()
    })

    it("returns error for non-string input", () => {
      expect(validateSubject(123)).toBe("subject must be a string")
      expect(validateSubject(null)).toBe("subject must be a string")
    })

    it("returns error for empty string", () => {
      expect(validateSubject("")).toBe("subject is required")
    })

    it("returns error for subject exceeding max length", () => {
      const longSubject = "a".repeat(1001)
      expect(validateSubject(longSubject)).toContain("exceeds maximum length")
    })

    it("accepts subject at max length", () => {
      const maxSubject = "a".repeat(1000)
      expect(validateSubject(maxSubject)).toBeUndefined()
    })
  })

  describe("validateReceivedAt", () => {
    it("returns undefined for valid timestamp", () => {
      expect(validateReceivedAt(Date.now())).toBeUndefined()
      expect(validateReceivedAt(1706100000000)).toBeUndefined()
    })

    it("returns error for non-number input", () => {
      expect(validateReceivedAt("1706100000000")).toBe("receivedAt must be a number")
      expect(validateReceivedAt(null)).toBe("receivedAt must be a number")
    })

    it("returns error for zero or negative timestamp", () => {
      expect(validateReceivedAt(0)).toBe("receivedAt must be a positive timestamp")
      expect(validateReceivedAt(-1)).toBe("receivedAt must be a positive timestamp")
    })

    it("returns error for non-finite number", () => {
      expect(validateReceivedAt(Infinity)).toBe("receivedAt must be a positive timestamp")
      expect(validateReceivedAt(NaN)).toBe("receivedAt must be a positive timestamp")
    })
  })

  describe("validateContent", () => {
    it("returns undefined for valid content", () => {
      expect(validateContent("<p>HTML content</p>", "htmlContent")).toBeUndefined()
      expect(validateContent("Plain text content", "textContent")).toBeUndefined()
    })

    it("returns undefined for undefined or null content", () => {
      expect(validateContent(undefined, "htmlContent")).toBeUndefined()
      expect(validateContent(null, "textContent")).toBeUndefined()
    })

    it("returns undefined for empty string", () => {
      expect(validateContent("", "htmlContent")).toBeUndefined()
    })

    it("returns error for non-string input", () => {
      expect(validateContent(123, "htmlContent")).toBe("htmlContent must be a string")
      expect(validateContent({ html: "test" }, "htmlContent")).toBe("htmlContent must be a string")
    })

    it("returns error for content exceeding max length", () => {
      const largeContent = "a".repeat(5 * 1024 * 1024 + 1) // 5MB + 1 byte
      expect(validateContent(largeContent, "htmlContent")).toContain("exceeds maximum length")
    })

    it("accepts content at max length", () => {
      const maxContent = "a".repeat(5 * 1024 * 1024) // Exactly 5MB
      expect(validateContent(maxContent, "htmlContent")).toBeUndefined()
    })
  })
})

/**
 * Integration test notes for receiveEmail HTTP action:
 *
 * The following scenarios require integration testing with a running Convex instance:
 *
 * 1. API Key Authentication:
 *    - Missing API key → 401 Unauthorized
 *    - Invalid API key → 401 Unauthorized
 *    - Missing INTERNAL_API_KEY env var → 500 Server Error
 *    - Valid API key → continues processing
 *
 * 2. User Lookup:
 *    - Unknown dedicated email → 404 Unknown recipient
 *    - Valid dedicated email → 200 with userId
 *
 * 3. End-to-end flow:
 *    - Valid payload with known user → 200 success response
 *    - Response includes userId field
 *
 * These tests would be implemented in a separate integration test suite
 * that runs against a Convex dev deployment.
 */
