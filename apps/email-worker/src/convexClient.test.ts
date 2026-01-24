import { describe, it, expect, vi, beforeEach } from "vitest"
import { callConvex, extractSenderName } from "./convexClient"
import type { Env, EmailPayload } from "./types"

describe("convexClient", () => {
  describe("extractSenderName", () => {
    it("extracts name from 'Name <email>' format", () => {
      expect(extractSenderName("John Doe <john@example.com>")).toBe("John Doe")
    })

    it("extracts name from quoted format", () => {
      expect(extractSenderName('"Jane Smith" <jane@example.com>')).toBe(
        "Jane Smith"
      )
    })

    it("extracts name with single quotes", () => {
      expect(extractSenderName("'Newsletter' <news@example.com>")).toBe(
        "Newsletter"
      )
    })

    it("returns undefined for plain email address", () => {
      expect(extractSenderName("john@example.com")).toBeUndefined()
    })

    it("trims whitespace from name", () => {
      expect(extractSenderName("  John Doe  <john@example.com>")).toBe(
        "John Doe"
      )
    })
  })

  describe("callConvex", () => {
    const mockEnv: Env = {
      CONVEX_URL: "https://test.convex.cloud",
      INTERNAL_API_KEY: "test-api-key",
    }

    const mockPayload: EmailPayload = {
      to: "user@newsletter.example.com",
      from: "sender@example.com",
      subject: "Test Newsletter",
      senderName: "Test Sender",
      receivedAt: 1706100000000,
      htmlContent: "<p>Test content</p>",
    }

    beforeEach(() => {
      vi.resetAllMocks()
    })

    it("sends correct payload with HTML content to Convex endpoint", async () => {
      const mockResponse = { success: true, userId: "user123", newsletterId: "nl123" }
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      const result = await callConvex(mockEnv, mockPayload)

      expect(fetch).toHaveBeenCalledWith(
        "https://test.convex.cloud/api/email/ingest",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Internal-API-Key": "test-api-key",
          },
          body: JSON.stringify({
            to: mockPayload.to,
            from: mockPayload.from,
            subject: mockPayload.subject,
            senderName: mockPayload.senderName,
            receivedAt: mockPayload.receivedAt,
            htmlContent: mockPayload.htmlContent,
            textContent: undefined,
          }),
        })
      )
      expect(result).toEqual(mockResponse)
    })

    it("sends payload with text content fallback", async () => {
      const textPayload: EmailPayload = {
        ...mockPayload,
        htmlContent: undefined,
        textContent: "Plain text content",
      }
      const mockResponse = { success: true, userId: "user123", newsletterId: "nl123" }
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      })

      await callConvex(mockEnv, textPayload)

      expect(fetch).toHaveBeenCalledWith(
        "https://test.convex.cloud/api/email/ingest",
        expect.objectContaining({
          body: JSON.stringify({
            to: textPayload.to,
            from: textPayload.from,
            subject: textPayload.subject,
            senderName: textPayload.senderName,
            receivedAt: textPayload.receivedAt,
            htmlContent: undefined,
            textContent: "Plain text content",
          }),
        })
      )
    })

    it("returns error response on HTTP failure", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: "Unknown recipient" }),
      })

      const result = await callConvex(mockEnv, mockPayload)

      expect(result).toEqual({
        success: false,
        error: "Unknown recipient",
      })
    })

    it("handles network error gracefully", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error("Parse error")),
      })

      const result = await callConvex(mockEnv, mockPayload)

      expect(result).toEqual({
        success: false,
        error: "HTTP 500",
      })
    })
  })
})
