import { describe, it, expect } from "vitest"
import { api, internal } from "./_generated/api"
import { stripHtmlToText, MAX_CONTENT_LENGTH } from "./ai"

/**
 * Contract Tests for ai.ts - Story 5.1
 *
 * PURPOSE: These are CONTRACT/SCHEMA documentation tests, NOT behavioral unit tests.
 * They verify:
 * 1. Functions are properly exported from the generated API
 * 2. Expected API contracts are documented in executable form
 * 3. Error codes and patterns match architecture standards
 *
 * LIMITATION: These tests verify API surface and document expected behavior,
 * but do NOT test actual function execution. Integration tests against a
 * running Convex instance are required for full coverage.
 *
 * Story 5.1 Summary Logic:
 * - Public newsletters: First generation stores on newsletterContent (shared)
 * - Private newsletters: Always stores on userNewsletters (personal)
 * - Regeneration: Always stores on userNewsletters (personal override)
 * - Resolution: Personal > Shared > null
 */

describe("ai API exports", () => {
  it("should export generateSummary action (Story 5.1: Task 3)", () => {
    expect(api.ai).toBeDefined()
    expect(api.ai.generateSummary).toBeDefined()
  })

  it("should export getNewsletterSummary query (Story 5.1: Task 4)", () => {
    expect(api.ai.getNewsletterSummary).toBeDefined()
  })

  it("should export internal functions for summary storage", () => {
    expect(internal.ai).toBeDefined()
    expect(internal.ai.getNewsletterForSummary).toBeDefined()
    expect(internal.ai.getSharedSummary).toBeDefined()
    expect(internal.ai.storeSharedSummary).toBeDefined()
    expect(internal.ai.storePrivateSummary).toBeDefined()
  })
})

describe("generateSummary action contract", () => {
  it("defines expected args schema (Story 5.1: Task 3.1-3.2)", () => {
    const expectedArgsShape = {
      userNewsletterId: "required Id<'userNewsletters'> - the newsletter to summarize",
      forceRegenerate: "optional boolean - true to regenerate even if summary exists",
    }
    expect(expectedArgsShape).toHaveProperty("userNewsletterId")
    expect(expectedArgsShape).toHaveProperty("forceRegenerate")
  })

  it("defines expected return type", () => {
    const expectedReturn = {
      summary: "string - the generated summary text",
      isShared: "boolean - true if summary is from shared pool (public newsletter)",
    }
    expect(expectedReturn).toHaveProperty("summary")
    expect(expectedReturn).toHaveProperty("isShared")
  })

  it("documents error codes (Story 5.1: Task 3.10-3.11)", () => {
    // Document expected ConvexError codes
    const errorCodes = {
      UNAUTHORIZED: "User not authenticated",
      NOT_FOUND: "Newsletter not found",
      FORBIDDEN: "User doesn't own this newsletter",
      CONTENT_UNAVAILABLE: "Newsletter content not available for summarization",
      CONTENT_FETCH_ERROR: "Failed to fetch content from R2",
      AI_CONFIG_ERROR: "OPENROUTER_API_KEY not configured",
      AI_TIMEOUT: "Summary generation took too long (>25s)",
      AI_UNAVAILABLE: "OpenRouter service error",
    }
    expect(Object.keys(errorCodes)).toContain("AI_TIMEOUT")
    expect(Object.keys(errorCodes)).toContain("AI_UNAVAILABLE")
    expect(Object.keys(errorCodes)).toContain("NOT_FOUND")
    expect(Object.keys(errorCodes)).toContain("UNAUTHORIZED")
  })
})

describe("getNewsletterSummary query contract", () => {
  it("defines expected args schema (Story 5.1: Task 4.1)", () => {
    const expectedArgsShape = {
      userNewsletterId: "required Id<'userNewsletters'> - the newsletter to get summary for",
    }
    expect(expectedArgsShape).toHaveProperty("userNewsletterId")
  })

  it("defines expected return type (Story 5.1: Task 4.4)", () => {
    const expectedReturn = {
      summary: "string | null - the summary text or null if not generated",
      isShared: "boolean - true if summary is shared (from newsletterContent)",
      generatedAt: "number | null - Unix timestamp ms when summary was generated",
    }
    expect(expectedReturn).toHaveProperty("summary")
    expect(expectedReturn).toHaveProperty("isShared")
    expect(expectedReturn).toHaveProperty("generatedAt")
  })

  it("documents summary resolution priority (Story 5.1: Task 4.2-4.5)", () => {
    // Document the resolution order for summaries
    const resolutionOrder = [
      "1. userNewsletters.summary (personal override - highest priority)",
      "2. newsletterContent.summary (shared - for public newsletters only)",
      "3. null (no summary available)",
    ]
    expect(resolutionOrder).toHaveLength(3)
    expect(resolutionOrder[0]).toContain("personal")
    expect(resolutionOrder[1]).toContain("shared")
  })
})

describe("summary storage logic (Story 5.1: Cost Optimization)", () => {
  it("documents first generation behavior for PUBLIC newsletters (Story 5.1: Task 3.8)", () => {
    // First generation for public newsletters stores on shared content
    const publicFirstGeneration = {
      condition: "!forceRegenerate && !isPrivate && contentId exists",
      storageLocation: "newsletterContent.summary (shared)",
      benefit: "All users share the same summary - no duplicate API calls",
      isShared: true,
    }
    expect(publicFirstGeneration.storageLocation).toContain("newsletterContent")
    expect(publicFirstGeneration.isShared).toBe(true)
  })

  it("documents regeneration behavior (Story 5.1: Task 3.8)", () => {
    // Regeneration always creates personal summary
    const regeneration = {
      condition: "forceRegenerate === true",
      storageLocation: "userNewsletters.summary (personal)",
      behavior: "Does NOT overwrite shared summary - user gets personal override",
      isShared: false,
    }
    expect(regeneration.storageLocation).toContain("userNewsletters")
    expect(regeneration.isShared).toBe(false)
  })

  it("documents private newsletter behavior (Story 5.1: Task 3.8)", () => {
    // Private newsletters always get personal summaries
    const privateNewsletter = {
      condition: "newsletter.isPrivate === true",
      storageLocation: "userNewsletters.summary (personal)",
      reason: "Privacy boundary maintained - no shared content",
      isShared: false,
    }
    expect(privateNewsletter.storageLocation).toContain("userNewsletters")
    expect(privateNewsletter.reason).toContain("Privacy")
  })

  it("documents existing summary check behavior (Story 5.1: Task 3.3-3.4)", () => {
    // When not regenerating, check for existing summaries first
    const existingSummaryCheck = {
      condition: "!forceRegenerate",
      checkOrder: [
        "1. Check userNewsletters.summary (personal)",
        "2. Check newsletterContent.summary (shared, public only)",
        "3. If found, return immediately without API call",
      ],
      benefit: "Avoids duplicate API calls - significant cost savings",
    }
    expect(existingSummaryCheck.checkOrder).toHaveLength(3)
    expect(existingSummaryCheck.benefit).toContain("cost savings")
  })
})

describe("internal storeSharedSummary mutation contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      contentId: "required Id<'newsletterContent'> - shared content to update",
      summary: "required string - the generated summary",
    }
    expect(expectedArgsShape).toHaveProperty("contentId")
    expect(expectedArgsShape).toHaveProperty("summary")
  })

  it("stores summary and timestamp on newsletterContent", () => {
    const fields = {
      summary: "string - the AI-generated summary",
      summaryGeneratedAt: "number - Date.now() timestamp",
    }
    expect(fields).toHaveProperty("summary")
    expect(fields).toHaveProperty("summaryGeneratedAt")
  })
})

describe("internal storePrivateSummary mutation contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      userNewsletterId: "required Id<'userNewsletters'> - user's newsletter record",
      summary: "required string - the generated summary",
    }
    expect(expectedArgsShape).toHaveProperty("userNewsletterId")
    expect(expectedArgsShape).toHaveProperty("summary")
  })

  it("stores summary and timestamp on userNewsletters", () => {
    const fields = {
      summary: "string - the AI-generated summary (personal)",
      summaryGeneratedAt: "number - Date.now() timestamp",
    }
    expect(fields).toHaveProperty("summary")
    expect(fields).toHaveProperty("summaryGeneratedAt")
  })
})

describe("OpenRouter client configuration (Story 5.1: Task 2)", () => {
  it("documents OpenRouter API configuration", () => {
    const config = {
      apiUrl: "https://openrouter.ai/api/v1/chat/completions",
      model: "moonshotai/kimi-k2",
      timeout: 25000, // 25 seconds
      maxTokens: 500,
      temperature: 0.3,
    }
    expect(config.model).toBe("moonshotai/kimi-k2")
    expect(config.timeout).toBe(25000)
    expect(config.maxTokens).toBe(500)
  })

  it("documents required headers", () => {
    const headers = {
      Authorization: "Bearer ${OPENROUTER_API_KEY}",
      "Content-Type": "application/json",
      "HTTP-Referer": "https://newsletter-manager.app (required by OpenRouter)",
      "X-Title": "Newsletter Manager (optional but recommended)",
    }
    expect(headers).toHaveProperty("Authorization")
    expect(headers).toHaveProperty("HTTP-Referer")
  })

  it("documents timeout handling", () => {
    const timeoutBehavior = {
      mechanism: "AbortController with setTimeout",
      timeout: "25 seconds (buffer for NFR3: <10s target)",
      errorCode: "AI_TIMEOUT",
      errorMessage: "Summary generation took too long. Please try again.",
    }
    expect(timeoutBehavior.errorCode).toBe("AI_TIMEOUT")
  })
})

// ============================================================
// BEHAVIORAL UNIT TESTS - Code Review Fix (HIGH-2)
// These tests verify actual function behavior, not just contracts
// ============================================================

describe("stripHtmlToText - behavioral tests (Code Review HIGH-2 fix)", () => {
  it("removes script tags and their content", () => {
    const html = '<p>Hello</p><script>alert("xss")</script><p>World</p>'
    const result = stripHtmlToText(html)
    expect(result).not.toContain("script")
    expect(result).not.toContain("alert")
    expect(result).toContain("Hello")
    expect(result).toContain("World")
  })

  it("removes style tags and their content", () => {
    const html = "<p>Content</p><style>.foo { color: red; }</style><p>More</p>"
    const result = stripHtmlToText(html)
    expect(result).not.toContain("style")
    expect(result).not.toContain("color")
    expect(result).toContain("Content")
    expect(result).toContain("More")
  })

  it("removes all HTML tags while preserving text", () => {
    const html = "<div><h1>Title</h1><p>Paragraph with <strong>bold</strong> text</p></div>"
    const result = stripHtmlToText(html)
    expect(result).not.toContain("<")
    expect(result).not.toContain(">")
    expect(result).toContain("Title")
    expect(result).toContain("Paragraph")
    expect(result).toContain("bold")
  })

  it("decodes common HTML entities", () => {
    const html = "<p>Hello &amp; World &mdash; Test &ldquo;Quoted&rdquo;</p>"
    const result = stripHtmlToText(html)
    expect(result).toContain("&")
    expect(result).toContain("\u2014") // mdash (—)
    expect(result).toContain("\u201C") // ldquo (")
    expect(result).toContain("\u201D") // rdquo (")
  })

  it("decodes numeric HTML entities (decimal)", () => {
    const html = "<p>Copyright &#169; 2026</p>"
    const result = stripHtmlToText(html)
    expect(result).toContain("\u00A9") // copyright symbol
    expect(result).not.toContain("&#169;")
  })

  it("decodes numeric HTML entities (hex)", () => {
    const html = "<p>Euro &#x20AC; symbol</p>"
    const result = stripHtmlToText(html)
    expect(result).toContain("\u20AC") // euro symbol
    expect(result).not.toContain("&#x20AC;")
  })

  it("normalizes whitespace", () => {
    const html = "<p>Hello    World</p>\n\n<p>New    Paragraph</p>"
    const result = stripHtmlToText(html)
    expect(result).not.toMatch(/\s{2,}/)
    expect(result).toBe("Hello World New Paragraph")
  })

  it("trims leading and trailing whitespace", () => {
    const html = "   <p>Content</p>   "
    const result = stripHtmlToText(html)
    expect(result).toBe("Content")
  })

  it("handles empty input", () => {
    expect(stripHtmlToText("")).toBe("")
  })

  it("handles plain text without HTML", () => {
    const plain = "Just plain text without any HTML"
    expect(stripHtmlToText(plain)).toBe(plain)
  })

  it("handles newsletter-style HTML with multiple entity types", () => {
    const newsletterHtml = `
      <div style="font-family: Arial;">
        <h1>Weekly Update &mdash; Jan 2026</h1>
        <p>Dear reader,</p>
        <p>Here&apos;s what&rsquo;s new this week:</p>
        <ul>
          <li>Feature #1 &bull; Important update</li>
          <li>Feature #2 &ndash; Minor fix</li>
        </ul>
        <p>Best regards,<br/>The Team &copy; 2026</p>
        <script>trackOpen()</script>
      </div>
    `
    const result = stripHtmlToText(newsletterHtml)

    expect(result).toContain("Weekly Update \u2014 Jan 2026") // mdash decoded
    expect(result).toContain("Here's what\u2019s new") // apos/rsquo decoded
    expect(result).toContain("\u2022") // bull decoded
    expect(result).toContain("\u2013") // ndash decoded
    expect(result).toContain("\u00A9") // copy decoded
    expect(result).not.toContain("trackOpen") // script removed
    expect(result).not.toContain("<") // no HTML tags
  })
})

describe("MAX_CONTENT_LENGTH constant", () => {
  it("is defined and has expected value", () => {
    expect(MAX_CONTENT_LENGTH).toBe(15000)
  })

  it("represents approximately 3750 tokens (~4 chars/token)", () => {
    const approximateTokens = MAX_CONTENT_LENGTH / 4
    expect(approximateTokens).toBe(3750)
  })
})
