import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { Id } from "../_generated/dataModel"

// Store original env
const originalEnv = process.env.EMAIL_DOMAIN

describe("emailGeneration", () => {
  beforeEach(() => {
    vi.resetModules()
    // Clear console warnings from module load
    vi.spyOn(console, "warn").mockImplementation(() => {})
  })

  afterEach(() => {
    process.env.EMAIL_DOMAIN = originalEnv
    vi.restoreAllMocks()
  })

  describe("generateDedicatedEmail", () => {
    it("generates email with last 8 characters of user ID", async () => {
      process.env.EMAIL_DOMAIN = "test.newsletters.com"
      const { generateDedicatedEmail } = await import("./emailGeneration")

      // Convex IDs look like: "j570abc123def456"
      const userId = "j570abc123def456" as Id<"users">
      const email = generateDedicatedEmail(userId)

      // Should take last 8 chars: "23def456"
      expect(email).toBe("23def456@test.newsletters.com")
    })

    it("converts prefix to lowercase", async () => {
      process.env.EMAIL_DOMAIN = "test.newsletters.com"
      const { generateDedicatedEmail } = await import("./emailGeneration")

      const userId = "j570ABCD12EF3456" as Id<"users">
      const email = generateDedicatedEmail(userId)

      expect(email).toBe("12ef3456@test.newsletters.com")
    })

    it("uses configured EMAIL_DOMAIN", async () => {
      process.env.EMAIL_DOMAIN = "custom.domain.io"
      const { generateDedicatedEmail } = await import("./emailGeneration")

      const userId = "j570abc123def456" as Id<"users">
      const email = generateDedicatedEmail(userId)

      expect(email).toContain("@custom.domain.io")
    })

    it("uses default domain when EMAIL_DOMAIN not set", async () => {
      delete process.env.EMAIL_DOMAIN
      const { generateDedicatedEmail } = await import("./emailGeneration")

      const userId = "j570abc123def456" as Id<"users">
      const email = generateDedicatedEmail(userId)

      expect(email).toContain("@newsletters.example.com")
    })
  })

  describe("isValidDedicatedEmail", () => {
    it("validates correct email format", async () => {
      process.env.EMAIL_DOMAIN = "newsletters.example.com"
      const { isValidDedicatedEmail } = await import("./emailGeneration")

      expect(isValidDedicatedEmail("ab123456@newsletters.example.com")).toBe(true)
    })

    it("rejects email with wrong domain", async () => {
      process.env.EMAIL_DOMAIN = "newsletters.example.com"
      const { isValidDedicatedEmail } = await import("./emailGeneration")

      expect(isValidDedicatedEmail("ab123456@wrong.domain.com")).toBe(false)
    })

    it("rejects email with wrong prefix length", async () => {
      process.env.EMAIL_DOMAIN = "newsletters.example.com"
      const { isValidDedicatedEmail } = await import("./emailGeneration")

      expect(isValidDedicatedEmail("abc@newsletters.example.com")).toBe(false)
      expect(isValidDedicatedEmail("abcdefghijk@newsletters.example.com")).toBe(false)
    })

    it("rejects email with invalid characters in prefix", async () => {
      process.env.EMAIL_DOMAIN = "newsletters.example.com"
      const { isValidDedicatedEmail } = await import("./emailGeneration")

      expect(isValidDedicatedEmail("ab-12_45@newsletters.example.com")).toBe(false)
    })

    it("rejects empty string", async () => {
      process.env.EMAIL_DOMAIN = "newsletters.example.com"
      const { isValidDedicatedEmail } = await import("./emailGeneration")

      expect(isValidDedicatedEmail("")).toBe(false)
    })

    it("rejects malformed email", async () => {
      process.env.EMAIL_DOMAIN = "newsletters.example.com"
      const { isValidDedicatedEmail } = await import("./emailGeneration")

      expect(isValidDedicatedEmail("not-an-email")).toBe(false)
      expect(isValidDedicatedEmail("has@@two@signs")).toBe(false)
    })
  })

  describe("getEmailDomain", () => {
    it("returns configured domain", async () => {
      process.env.EMAIL_DOMAIN = "my.newsletter.domain"
      const { getEmailDomain } = await import("./emailGeneration")

      expect(getEmailDomain()).toBe("my.newsletter.domain")
    })

    it("returns default domain when not configured", async () => {
      delete process.env.EMAIL_DOMAIN
      const { getEmailDomain } = await import("./emailGeneration")

      expect(getEmailDomain()).toBe("newsletters.example.com")
    })
  })

  describe("AC3: Uniqueness Guarantee", () => {
    it("generates unique emails for different user IDs", async () => {
      process.env.EMAIL_DOMAIN = "test.com"
      const { generateDedicatedEmail } = await import("./emailGeneration")

      const userId1 = "j570abc111111111" as Id<"users">
      const userId2 = "j570abc222222222" as Id<"users">

      const email1 = generateDedicatedEmail(userId1)
      const email2 = generateDedicatedEmail(userId2)

      expect(email1).not.toBe(email2)
    })

    it("generates same email for same user ID (deterministic)", async () => {
      process.env.EMAIL_DOMAIN = "test.com"
      const { generateDedicatedEmail } = await import("./emailGeneration")

      const userId = "j570abc123def456" as Id<"users">

      const email1 = generateDedicatedEmail(userId)
      const email2 = generateDedicatedEmail(userId)

      expect(email1).toBe(email2)
    })
  })
})
