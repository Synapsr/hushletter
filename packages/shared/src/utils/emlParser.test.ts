import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import {
  parseEmlFile,
  extractMessageId,
  resolveInlineImages,
  sanitizeHtml,
} from "./emlParser"
import type { InlineImage } from "../types/eml"
import { EML_PARSE_DEFAULTS } from "../types/eml"

/**
 * Helper to encode string as Uint8Array
 */
function toBytes(content: string): Uint8Array {
  return new TextEncoder().encode(content)
}

/**
 * Helper to load fixture file as Uint8Array
 */
function loadFixture(filename: string): Uint8Array {
  const fixturePath = join(__dirname, "__fixtures__", filename)
  const buffer = readFileSync(fixturePath)
  return new Uint8Array(buffer)
}

// =============================================================================
// Test Fixtures
// =============================================================================

const VALID_SIMPLE_EML = `From: Newsletter <news@example.com>
To: reader@example.com
Subject: Weekly Newsletter #42
Date: Tue, 15 Jan 2026 10:30:00 -0500
Message-ID: <abc123@example.com>
Content-Type: text/html; charset=utf-8

<html><body><h1>Hello World</h1><p>Newsletter content here.</p></body></html>`

const VALID_PLAINTEXT_EML = `From: sender@example.com
To: recipient@example.com
Subject: Plain Text Newsletter
Date: Wed, 16 Jan 2026 14:00:00 +0000
Message-ID: <plaintext456@example.com>
Content-Type: text/plain; charset=utf-8

This is a plain text newsletter.
No HTML formatting here.

Thanks for reading!`

const MULTIPART_EML = `From: Newsletter Team <team@newsletter.com>
To: subscriber@example.com
Subject: Multipart Newsletter
Date: Thu, 17 Jan 2026 09:00:00 +0000
Message-ID: <multipart789@newsletter.com>
Content-Type: multipart/alternative; boundary="boundary123"

--boundary123
Content-Type: text/plain; charset=utf-8

Plain text version of the newsletter.

--boundary123
Content-Type: text/html; charset=utf-8

<html><body><p>HTML version with <strong>formatting</strong>.</p></body></html>

--boundary123--`

const EML_WITH_CID_IMAGES = `From: Visual Newsletter <visual@example.com>
To: reader@example.com
Subject: Newsletter with Images
Date: Fri, 18 Jan 2026 12:00:00 +0000
Message-ID: <images101@example.com>
Content-Type: multipart/related; boundary="related-boundary"

--related-boundary
Content-Type: text/html; charset=utf-8

<html><body>
<h1>Newsletter with Image</h1>
<img src="cid:logo@example.com" alt="Logo">
<p>Content below the image.</p>
</body></html>

--related-boundary
Content-Type: image/png
Content-ID: <logo@example.com>
Content-Transfer-Encoding: base64
Content-Disposition: inline; filename="logo.png"

iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==

--related-boundary--`

const MALFORMED_NO_FROM = `To: recipient@example.com
Subject: Missing From Header
Date: Mon, 20 Jan 2026 10:00:00 +0000
Content-Type: text/plain

Content without a sender.`

const MALFORMED_NO_DATE = `From: sender@example.com
To: recipient@example.com
Subject: Missing Date Header
Content-Type: text/plain

Content without a date.`

const EML_WITH_SENDER_NAME = `From: "John Doe" <john@example.com>
To: reader@example.com
Subject: Named Sender Newsletter
Date: Sat, 19 Jan 2026 08:00:00 +0000
Message-ID: <named123@example.com>
Content-Type: text/html; charset=utf-8

<html><body>Content from John</body></html>`

const EML_NO_SUBJECT = `From: sender@example.com
To: recipient@example.com
Date: Sun, 20 Jan 2026 16:00:00 +0000
Message-ID: <nosubject@example.com>
Content-Type: text/plain

Email without a subject line.`

const EML_WITH_XSS = `From: attacker@example.com
To: victim@example.com
Subject: Malicious Newsletter
Date: Mon, 21 Jan 2026 10:00:00 +0000
Message-ID: <xss@example.com>
Content-Type: text/html; charset=utf-8

<html><body>
<script>alert('XSS')</script>
<p onclick="evil()">Click me</p>
<a href="javascript:alert(1)">Dangerous link</a>
<iframe src="https://evil.com"></iframe>
</body></html>`

const EML_MESSAGE_ID_WITH_BRACKETS = `From: sender@example.com
To: recipient@example.com
Subject: Bracketed Message-ID
Date: Tue, 22 Jan 2026 11:00:00 +0000
Message-ID: <bracketed@example.com>
Content-Type: text/plain

Content with bracketed message ID.`

// =============================================================================
// parseEmlFile Tests
// =============================================================================

describe("parseEmlFile", () => {
  describe("valid EML parsing", () => {
    it("should parse a simple HTML newsletter", async () => {
      const result = await parseEmlFile(toBytes(VALID_SIMPLE_EML))

      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.data.subject).toBe("Weekly Newsletter #42")
      expect(result.data.senderEmail).toBe("news@example.com")
      expect(result.data.senderName).toBe("Newsletter")
      expect(result.data.messageId).toBe("abc123@example.com")
      expect(result.data.htmlContent).toContain("<h1>Hello World</h1>")
      expect(result.data.htmlContent).toContain("Newsletter content here")
      expect(result.data.receivedAt).toBe(new Date("2026-01-15T15:30:00Z").getTime())
    })

    it("should parse a plain text only email", async () => {
      const result = await parseEmlFile(toBytes(VALID_PLAINTEXT_EML))

      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.data.subject).toBe("Plain Text Newsletter")
      expect(result.data.senderEmail).toBe("sender@example.com")
      // Empty or missing name should be converted to null
      expect(result.data.senderName).toBeNull()
      expect(result.data.htmlContent).toBeNull()
      expect(result.data.textContent).toContain("This is a plain text newsletter")
      expect(result.data.textContent).toContain("Thanks for reading!")
    })

    it("should parse multipart emails with both HTML and text", async () => {
      const result = await parseEmlFile(toBytes(MULTIPART_EML))

      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.data.subject).toBe("Multipart Newsletter")
      expect(result.data.htmlContent).toContain("HTML version")
      expect(result.data.htmlContent).toContain("<strong>formatting</strong>")
      expect(result.data.textContent).toContain("Plain text version")
    })

    it("should extract sender name when present", async () => {
      const result = await parseEmlFile(toBytes(EML_WITH_SENDER_NAME))

      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.data.senderEmail).toBe("john@example.com")
      expect(result.data.senderName).toBe("John Doe")
    })

    it("should handle missing subject with default", async () => {
      const result = await parseEmlFile(toBytes(EML_NO_SUBJECT))

      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.data.subject).toBe("(no subject)")
    })

    it("should accept ArrayBuffer input", async () => {
      const bytes = toBytes(VALID_SIMPLE_EML)
      const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
      const result = await parseEmlFile(buffer)

      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.data.subject).toBe("Weekly Newsletter #42")
    })
  })

  describe("date extraction", () => {
    it("should convert date to Unix timestamp in milliseconds", async () => {
      const result = await parseEmlFile(toBytes(VALID_SIMPLE_EML))

      expect(result.success).toBe(true)
      if (!result.success) return

      // Tue, 15 Jan 2026 10:30:00 -0500
      // Verify it's a valid timestamp (exact value depends on timezone parsing)
      expect(typeof result.data.receivedAt).toBe("number")
      expect(result.data.receivedAt).toBeGreaterThan(0)
      // Should be around Jan 15, 2026
      const date = new Date(result.data.receivedAt)
      expect(date.getUTCFullYear()).toBe(2026)
      expect(date.getUTCMonth()).toBe(0) // January
      expect(date.getUTCDate()).toBe(15)
    })

    it("should return error for missing date", async () => {
      const result = await parseEmlFile(toBytes(MALFORMED_NO_DATE))

      expect(result.success).toBe(false)
      if (result.success) return

      expect(result.error.code).toBe("DATE_PARSE_ERROR")
      expect(result.error.field).toBe("date")
    })
  })

  describe("error handling", () => {
    it("should return structured error for missing From header", async () => {
      const result = await parseEmlFile(toBytes(MALFORMED_NO_FROM))

      expect(result.success).toBe(false)
      if (result.success) return

      expect(result.error.code).toBe("MISSING_REQUIRED_FIELD")
      expect(result.error.field).toBe("from")
      expect(result.error.message).toContain("sender address")
    })

    it("should return error for file exceeding size limit", async () => {
      const result = await parseEmlFile(toBytes(VALID_SIMPLE_EML), {
        maxFileSize: 100, // 100 bytes - too small
      })

      expect(result.success).toBe(false)
      if (result.success) return

      expect(result.error.code).toBe("FILE_TOO_LARGE")
    })

    it("should handle empty input gracefully", async () => {
      const result = await parseEmlFile(toBytes(""))

      expect(result.success).toBe(false)
      if (result.success) return

      // Empty email has no From or Date
      expect(["MISSING_REQUIRED_FIELD", "DATE_PARSE_ERROR", "INVALID_FORMAT"]).toContain(
        result.error.code
      )
    })

    it("should handle garbage input with structured error", async () => {
      const result = await parseEmlFile(toBytes("not an email at all"))

      expect(result.success).toBe(false)
      if (result.success) return

      expect(["MISSING_REQUIRED_FIELD", "DATE_PARSE_ERROR", "INVALID_FORMAT"]).toContain(
        result.error.code
      )
    })
  })

  describe("XSS sanitization", () => {
    it("should remove script tags from HTML content", async () => {
      const result = await parseEmlFile(toBytes(EML_WITH_XSS))

      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.data.htmlContent).not.toContain("<script>")
      // Note: "alert" may still appear in neutralized URLs like "blocked:alert(1)"
      // What matters is the script tag execution is prevented
      expect(result.data.htmlContent).not.toContain("<script")
      expect(result.data.htmlContent).not.toContain("alert('XSS')")
    })

    it("should remove event handlers from HTML content", async () => {
      const result = await parseEmlFile(toBytes(EML_WITH_XSS))

      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.data.htmlContent).not.toContain("onclick")
      expect(result.data.htmlContent).not.toContain("evil()")
    })

    it("should neutralize javascript: URLs", async () => {
      const result = await parseEmlFile(toBytes(EML_WITH_XSS))

      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.data.htmlContent).not.toContain("javascript:")
      expect(result.data.htmlContent).toContain("blocked:")
    })

    it("should remove iframe tags", async () => {
      const result = await parseEmlFile(toBytes(EML_WITH_XSS))

      expect(result.success).toBe(true)
      if (!result.success) return

      expect(result.data.htmlContent).not.toContain("<iframe")
      expect(result.data.htmlContent).not.toContain("evil.com")
    })
  })

  describe("inline images (CID resolution)", () => {
    it("should extract inline images from multipart/related", async () => {
      const result = await parseEmlFile(toBytes(EML_WITH_CID_IMAGES))

      expect(result.success).toBe(true)
      if (!result.success) return

      // Must extract at least one inline image (AC#3 requirement)
      expect(result.data.inlineImages.length).toBeGreaterThanOrEqual(1)

      // Verify the extracted image has correct structure
      const image = result.data.inlineImages[0]
      expect(image.contentId).toBeTruthy()
      expect(image.mimeType).toMatch(/^image\//)
      expect(image.data).toBeTruthy() // Base64 data should be present
    })

    it("should replace CID references with data URIs when images present", async () => {
      const result = await parseEmlFile(toBytes(EML_WITH_CID_IMAGES))

      expect(result.success).toBe(true)
      if (!result.success) return

      // CID references MUST be resolved (AC#3 requirement)
      expect(result.data.inlineImages.length).toBeGreaterThanOrEqual(1)
      expect(result.data.htmlContent).toContain("data:image/")
      expect(result.data.htmlContent).not.toContain('src="cid:')
    })

    it("should handle CID without angle brackets", async () => {
      const result = await parseEmlFile(toBytes(EML_WITH_CID_IMAGES))

      expect(result.success).toBe(true)
      if (!result.success) return

      // Content-ID should have angle brackets stripped
      for (const img of result.data.inlineImages) {
        expect(img.contentId).not.toContain("<")
        expect(img.contentId).not.toContain(">")
      }
    })
  })
})

// =============================================================================
// extractMessageId Tests
// =============================================================================

describe("extractMessageId", () => {
  it("should extract plain message ID", () => {
    const result = extractMessageId("abc123@example.com")
    expect(result).toBe("abc123@example.com")
  })

  it("should remove angle brackets from message ID", () => {
    const result = extractMessageId("<abc123@example.com>")
    expect(result).toBe("abc123@example.com")
  })

  it("should return null for undefined input", () => {
    const result = extractMessageId(undefined)
    expect(result).toBeNull()
  })

  it("should return null for null input", () => {
    const result = extractMessageId(null)
    expect(result).toBeNull()
  })

  it("should return null for empty string", () => {
    const result = extractMessageId("")
    expect(result).toBeNull()
  })

  it("should handle whitespace-only input", () => {
    const result = extractMessageId("   ")
    expect(result).toBeNull()
  })

  it("should trim whitespace around message ID", () => {
    const result = extractMessageId("  <abc@example.com>  ")
    expect(result).toBe("abc@example.com")
  })
})

// =============================================================================
// resolveInlineImages Tests
// =============================================================================

describe("resolveInlineImages", () => {
  const mockImages: InlineImage[] = [
    {
      contentId: "image001@example.com",
      mimeType: "image/png",
      data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk",
    },
    {
      contentId: "image002@example.com",
      mimeType: "image/jpeg",
      data: "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgK",
    },
  ]

  it("should replace cid: references with data URIs", () => {
    const html = '<img src="cid:image001@example.com" alt="Test">'
    const result = resolveInlineImages(html, mockImages)

    expect(result).toContain("data:image/png;base64,")
    expect(result).not.toContain("cid:")
  })

  it("should handle multiple CID references", () => {
    const html = `
      <img src="cid:image001@example.com">
      <img src="cid:image002@example.com">
    `
    const result = resolveInlineImages(html, mockImages)

    expect(result).toContain("data:image/png;base64,")
    expect(result).toContain("data:image/jpeg;base64,")
  })

  it("should handle single-quoted src attributes", () => {
    const html = "<img src='cid:image001@example.com'>"
    const result = resolveInlineImages(html, mockImages)

    expect(result).toContain("data:image/png;base64,")
  })

  it("should leave unmatched CID references unchanged", () => {
    const html = '<img src="cid:unknown@example.com">'
    const result = resolveInlineImages(html, mockImages)

    expect(result).toBe(html)
  })

  it("should return HTML unchanged when no images provided", () => {
    const html = '<img src="cid:image001@example.com">'
    const result = resolveInlineImages(html, [])

    expect(result).toBe(html)
  })

  it("should handle HTML without CID references", () => {
    const html = '<img src="https://example.com/image.png">'
    const result = resolveInlineImages(html, mockImages)

    expect(result).toBe(html)
  })
})

// =============================================================================
// sanitizeHtml Tests
// =============================================================================

describe("sanitizeHtml", () => {
  it("should remove script tags and content", () => {
    const html = '<html><script>alert("xss")</script><body>Safe</body></html>'
    const result = sanitizeHtml(html)

    expect(result).not.toContain("<script>")
    expect(result).not.toContain("alert")
    expect(result).toContain("Safe")
  })

  it("should remove inline event handlers", () => {
    const html = '<button onclick="evil()">Click</button><img onload="bad()" src="x">'
    const result = sanitizeHtml(html)

    expect(result).not.toContain("onclick")
    expect(result).not.toContain("onload")
    expect(result).toContain("<button")
  })

  it("should neutralize javascript: URLs", () => {
    const html = '<a href="javascript:alert(1)">Link</a>'
    const result = sanitizeHtml(html)

    expect(result).not.toContain("javascript:")
    expect(result).toContain("blocked:")
  })

  it("should neutralize vbscript: URLs", () => {
    const html = '<a href="vbscript:msgbox(1)">Link</a>'
    const result = sanitizeHtml(html)

    expect(result).not.toContain("vbscript:")
    expect(result).toContain("blocked:")
  })

  it("should remove iframe tags", () => {
    const html = "<iframe src='https://evil.com'></iframe><p>Content</p>"
    const result = sanitizeHtml(html)

    expect(result).not.toContain("<iframe")
    expect(result).toContain("Content")
  })

  it("should remove object and embed tags", () => {
    const html = '<object data="x.swf"></object><embed src="y.swf">'
    const result = sanitizeHtml(html)

    expect(result).not.toContain("<object")
    expect(result).not.toContain("<embed")
  })

  it("should remove form tags", () => {
    const html = '<form action="https://evil.com"><input name="password"></form>'
    const result = sanitizeHtml(html)

    expect(result).not.toContain("<form")
  })

  it("should remove meta refresh tags", () => {
    const html = '<meta http-equiv="refresh" content="0;url=evil.com">'
    const result = sanitizeHtml(html)

    expect(result).not.toContain("refresh")
  })

  it("should remove base tags", () => {
    const html = '<base href="https://evil.com/"><a href="/page">Link</a>'
    const result = sanitizeHtml(html)

    expect(result).not.toContain("<base")
    expect(result).toContain("<a href")
  })

  it("should remove SVG tags", () => {
    const html = "<svg><script>evil()</script></svg><p>Safe</p>"
    const result = sanitizeHtml(html)

    expect(result).not.toContain("<svg")
    expect(result).toContain("Safe")
  })

  it("should block data:text/html URLs", () => {
    const html = '<img src="data:text/html,<script>alert(1)</script>">'
    const result = sanitizeHtml(html)

    expect(result).not.toContain("data:text/html")
  })

  it("should block data:image/svg+xml URLs", () => {
    const html = '<img src="data:image/svg+xml,<svg onload=alert(1)>">'
    const result = sanitizeHtml(html)

    expect(result).not.toContain("data:image/svg+xml")
  })

  it("should preserve safe HTML content", () => {
    const html =
      '<div><h1>Title</h1><p style="color: blue;">Content</p><a href="https://example.com">Link</a></div>'
    const result = sanitizeHtml(html)

    expect(result).toBe(html)
  })

  it("should handle nested dangerous content", () => {
    const html = "<script><script>nested</script></script><p>Safe</p>"
    const result = sanitizeHtml(html)

    expect(result).not.toContain("<script")
    expect(result).toContain("Safe")
  })
})

// =============================================================================
// Fixture File Tests (H2 Fix - Tests using actual .eml fixture files)
// =============================================================================

describe("fixture file parsing", () => {
  it("should parse valid-simple.eml fixture", async () => {
    const result = await parseEmlFile(loadFixture("valid-simple.eml"))

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.subject).toBe("Weekly Newsletter #42")
    expect(result.data.senderEmail).toBe("news@example.com")
    expect(result.data.senderName).toBe("Newsletter")
    expect(result.data.messageId).toBe("abc123@example.com")
    expect(result.data.htmlContent).toContain("Hello World")
  })

  it("should parse valid-plaintext.eml fixture", async () => {
    const result = await parseEmlFile(loadFixture("valid-plaintext.eml"))

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.subject).toBe("Plain Text Newsletter")
    expect(result.data.htmlContent).toBeNull()
    expect(result.data.textContent).toContain("plain text newsletter")
  })

  it("should parse valid-with-images.eml fixture with CID resolution", async () => {
    const result = await parseEmlFile(loadFixture("valid-with-images.eml"))

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.subject).toBe("Newsletter with Images")
    // Verify inline images were extracted and CID resolved
    expect(result.data.inlineImages.length).toBeGreaterThanOrEqual(1)
    expect(result.data.htmlContent).toContain("data:image/")
    expect(result.data.htmlContent).not.toContain('src="cid:')
  })

  it("should parse valid-with-attachments.eml fixture", async () => {
    const result = await parseEmlFile(loadFixture("valid-with-attachments.eml"))

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.subject).toBe("Newsletter with PDF Attachment")
    expect(result.data.attachments.length).toBeGreaterThanOrEqual(1)

    const pdfAttachment = result.data.attachments.find(
      (a) => a.mimeType === "application/pdf"
    )
    expect(pdfAttachment).toBeDefined()
    expect(pdfAttachment?.filename).toBe("report.pdf")
  })

  it("should handle malformed-no-headers.eml fixture with error", async () => {
    const result = await parseEmlFile(loadFixture("malformed-no-headers.eml"))

    expect(result.success).toBe(false)
    if (result.success) return

    expect(["MISSING_REQUIRED_FIELD", "DATE_PARSE_ERROR", "INVALID_FORMAT"]).toContain(
      result.error.code
    )
  })

  it("should handle malformed-bad-mime.eml fixture gracefully", async () => {
    const result = await parseEmlFile(loadFixture("malformed-bad-mime.eml"))

    // Bad MIME may still parse with degraded content
    // What matters is it doesn't crash
    expect(result).toBeDefined()
    if (result.success) {
      // If it parses, should have basic fields
      expect(result.data.senderEmail).toBe("sender@example.com")
    }
  })

  it("should parse edge-case-nested-multipart.eml fixture (M4 fix)", async () => {
    const result = await parseEmlFile(loadFixture("edge-case-nested-multipart.eml"))

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.subject).toBe("Deeply Nested Newsletter")
    expect(result.data.messageId).toBe("nested303@example.com")

    // Should extract HTML from deeply nested structure
    expect(result.data.htmlContent).toContain("Nested Newsletter")

    // Should extract plain text alternative
    expect(result.data.textContent).toContain("Plain text version")

    // Should have both inline image and attachment
    expect(result.data.inlineImages.length).toBeGreaterThanOrEqual(1)
    expect(result.data.attachments.length).toBeGreaterThanOrEqual(1)
  })
})

// =============================================================================
// Edge Case Tests (M2 Fix - Tests for getContentAsUint8Array paths)
// =============================================================================

describe("content conversion edge cases", () => {
  it("should handle ArrayBuffer input", async () => {
    const bytes = toBytes(VALID_SIMPLE_EML)
    const arrayBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer
    const result = await parseEmlFile(arrayBuffer)

    expect(result.success).toBe(true)
  })

  it("should handle empty attachments gracefully", async () => {
    const emlWithEmptyAttachment = `From: sender@example.com
To: recipient@example.com
Subject: Empty Attachment
Date: Mon, 20 Jan 2026 10:00:00 +0000
Message-ID: <empty@example.com>
Content-Type: multipart/mixed; boundary="boundary"

--boundary
Content-Type: text/plain

Main content.

--boundary
Content-Type: application/octet-stream
Content-Disposition: attachment; filename="empty.bin"


--boundary--`

    const result = await parseEmlFile(toBytes(emlWithEmptyAttachment))

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.textContent).toContain("Main content")
  })

  it("should handle future dates within tolerance (7 days)", async () => {
    // Create an email with a date 3 days in the future
    const futureDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    const emlWithFutureDate = `From: sender@example.com
To: recipient@example.com
Subject: Future Date Email
Date: ${futureDate.toUTCString()}
Message-ID: <future@example.com>
Content-Type: text/plain

Content with future date.`

    const result = await parseEmlFile(toBytes(emlWithFutureDate))

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.data.subject).toBe("Future Date Email")
  })

  it("should reject dates far in the future (beyond 7 days)", async () => {
    // Create an email with a date 30 days in the future
    const farFutureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const emlWithFarFutureDate = `From: sender@example.com
To: recipient@example.com
Subject: Far Future Date Email
Date: ${farFutureDate.toUTCString()}
Message-ID: <farfuture@example.com>
Content-Type: text/plain

Content with far future date.`

    const result = await parseEmlFile(toBytes(emlWithFarFutureDate))

    expect(result.success).toBe(false)
    if (result.success) return

    expect(result.error.code).toBe("DATE_PARSE_ERROR")
  })
})

// =============================================================================
// Integration Tests
// =============================================================================

describe("integration", () => {
  it("should handle complete newsletter workflow", async () => {
    // Simulate a real newsletter import
    const eml = `From: "Tech Weekly" <weekly@tech.com>
To: subscriber@example.com
Subject: This Week in Tech - Issue #100
Date: Wed, 22 Jan 2026 08:00:00 +0000
Message-ID: <tech-weekly-100@tech.com>
Content-Type: text/html; charset=utf-8

<!DOCTYPE html>
<html>
<head><title>Tech Weekly</title></head>
<body>
<h1>This Week in Tech</h1>
<p>Welcome to issue #100!</p>
<a href="https://tech.com/article">Read more</a>
</body>
</html>`

    const result = await parseEmlFile(toBytes(eml))

    expect(result.success).toBe(true)
    if (!result.success) return

    // All fields should be properly extracted
    expect(result.data.messageId).toBe("tech-weekly-100@tech.com")
    expect(result.data.subject).toBe("This Week in Tech - Issue #100")
    expect(result.data.senderEmail).toBe("weekly@tech.com")
    expect(result.data.senderName).toBe("Tech Weekly")
    expect(typeof result.data.receivedAt).toBe("number")
    expect(result.data.receivedAt).toBeGreaterThan(0)

    // HTML should be sanitized but content preserved
    expect(result.data.htmlContent).toContain("This Week in Tech")
    expect(result.data.htmlContent).toContain("Read more")
  })

  it("should use default limits from EML_PARSE_DEFAULTS", () => {
    expect(EML_PARSE_DEFAULTS.MAX_FILE_SIZE).toBe(10 * 1024 * 1024)
    expect(EML_PARSE_DEFAULTS.MAX_ATTACHMENT_SIZE).toBe(50 * 1024 * 1024)
    expect(EML_PARSE_DEFAULTS.MAX_INLINE_IMAGES).toBe(10)
  })
})
