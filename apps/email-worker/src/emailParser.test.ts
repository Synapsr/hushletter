import { describe, it, expect } from "vitest"
import { parseEmail, sanitizeHtml, getStorableContent, type ParsedEmail } from "./emailParser"

/**
 * Helper to create a ReadableStream from a string
 */
function createStream(content: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  return new ReadableStream({
    start(controller) {
      controller.enqueue(data)
      controller.close()
    },
  })
}

describe("parseEmail", () => {
  it("should parse a simple email with HTML content", async () => {
    const rawEmail = `From: Test Sender <sender@example.com>
To: recipient@example.com
Subject: Test Newsletter
Date: Wed, 15 Jan 2026 10:00:00 +0000
Content-Type: text/html; charset=utf-8

<html><body><h1>Hello World</h1><p>Newsletter content</p></body></html>`

    const stream = createStream(rawEmail)
    const result = await parseEmail(stream)

    expect(result.subject).toBe("Test Newsletter")
    expect(result.from).toBe("sender@example.com")
    expect(result.senderName).toBe("Test Sender")
    expect(result.html).toContain("<h1>Hello World</h1>")
    expect(result.hasAttachments).toBe(false)
  })

  it("should parse a plain text email", async () => {
    const rawEmail = `From: sender@example.com
To: recipient@example.com
Subject: Plain Text Newsletter
Date: Wed, 15 Jan 2026 10:00:00 +0000
Content-Type: text/plain; charset=utf-8

This is a plain text newsletter.
No HTML here.`

    const stream = createStream(rawEmail)
    const result = await parseEmail(stream)

    expect(result.subject).toBe("Plain Text Newsletter")
    expect(result.from).toBe("sender@example.com")
    expect(result.senderName).toBeUndefined()
    expect(result.html).toBeUndefined()
    expect(result.text).toContain("This is a plain text newsletter")
  })

  it("should handle multipart emails with both HTML and text", async () => {
    const rawEmail = `From: Newsletter <news@example.com>
To: recipient@example.com
Subject: Multipart Newsletter
Date: Wed, 15 Jan 2026 10:00:00 +0000
Content-Type: multipart/alternative; boundary="boundary123"

--boundary123
Content-Type: text/plain; charset=utf-8

Plain text version of the newsletter.

--boundary123
Content-Type: text/html; charset=utf-8

<html><body><p>HTML version of the newsletter.</p></body></html>

--boundary123--`

    const stream = createStream(rawEmail)
    const result = await parseEmail(stream)

    expect(result.subject).toBe("Multipart Newsletter")
    expect(result.html).toContain("HTML version")
    expect(result.text).toContain("Plain text version")
  })

  it("should handle missing subject", async () => {
    const rawEmail = `From: sender@example.com
To: recipient@example.com
Date: Wed, 15 Jan 2026 10:00:00 +0000
Content-Type: text/plain

Content without subject`

    const stream = createStream(rawEmail)
    const result = await parseEmail(stream)

    expect(result.subject).toBe("(no subject)")
  })

  it("should handle empty stream gracefully", async () => {
    const stream = createStream("")
    const result = await parseEmail(stream)

    expect(result.subject).toBe("(no subject)")
    expect(result.from).toBe("")
  })
})

describe("sanitizeHtml", () => {
  it("should remove script tags", () => {
    const html = '<html><script>alert("xss")</script><body>Content</body></html>'
    const sanitized = sanitizeHtml(html)

    expect(sanitized).not.toContain("<script>")
    expect(sanitized).not.toContain("alert")
    expect(sanitized).toContain("Content")
  })

  it("should remove inline event handlers", () => {
    const html = '<button onclick="evil()">Click</button><img onload="bad()" src="x">'
    const sanitized = sanitizeHtml(html)

    expect(sanitized).not.toContain("onclick")
    expect(sanitized).not.toContain("onload")
    expect(sanitized).not.toContain("evil")
    expect(sanitized).toContain("<button")
    expect(sanitized).toContain("<img")
  })

  it("should remove javascript: URLs", () => {
    const html = '<a href="javascript:alert(1)">Link</a>'
    const sanitized = sanitizeHtml(html)

    expect(sanitized).not.toContain("javascript:")
    expect(sanitized).toContain("blocked:")
  })

  it("should handle nested script tags", () => {
    const html = '<script><script>nested</script></script><p>Safe</p>'
    const sanitized = sanitizeHtml(html)

    expect(sanitized).not.toContain("<script>")
    expect(sanitized).toContain("<p>Safe</p>")
  })

  it("should preserve safe HTML content", () => {
    const html = '<div><h1>Title</h1><p style="color: blue;">Content</p><a href="https://example.com">Link</a></div>'
    const sanitized = sanitizeHtml(html)

    expect(sanitized).toBe(html)
  })

  it("should block data: text/html URLs", () => {
    const html = '<img src="data:text/html,<script>alert(1)</script>">'
    const sanitized = sanitizeHtml(html)

    expect(sanitized).not.toContain("data:text/html")
  })

  it("should remove iframe tags completely", () => {
    const html = '<div>Before</div><iframe src="https://evil.com"></iframe><div>After</div>'
    const sanitized = sanitizeHtml(html)

    expect(sanitized).not.toContain("<iframe")
    expect(sanitized).not.toContain("evil.com")
    expect(sanitized).toContain("Before")
    expect(sanitized).toContain("After")
  })

  it("should remove object and embed tags", () => {
    const html = '<object data="malware.swf"></object><embed src="plugin.swf">'
    const sanitized = sanitizeHtml(html)

    expect(sanitized).not.toContain("<object")
    expect(sanitized).not.toContain("<embed")
  })

  it("should remove form tags for phishing prevention", () => {
    const html = '<form action="https://evil.com/steal"><input name="password"></form>'
    const sanitized = sanitizeHtml(html)

    expect(sanitized).not.toContain("<form")
    expect(sanitized).not.toContain("evil.com")
  })

  it("should remove meta refresh tags", () => {
    const html = '<meta http-equiv="refresh" content="0;url=https://evil.com">'
    const sanitized = sanitizeHtml(html)

    expect(sanitized).not.toContain("refresh")
    expect(sanitized).not.toContain("evil.com")
  })

  it("should remove base tags that could hijack URLs", () => {
    const html = '<base href="https://evil.com/"><a href="/page">Link</a>'
    const sanitized = sanitizeHtml(html)

    expect(sanitized).not.toContain("<base")
    expect(sanitized).toContain("<a href")
  })

  it("should remove svg tags", () => {
    const html = '<svg><script>alert(1)</script></svg><p>Safe content</p>'
    const sanitized = sanitizeHtml(html)

    expect(sanitized).not.toContain("<svg")
    expect(sanitized).toContain("Safe content")
  })

  it("should block vbscript: URLs", () => {
    const html = '<a href="vbscript:msgbox(1)">Click</a>'
    const sanitized = sanitizeHtml(html)

    expect(sanitized).not.toContain("vbscript:")
    expect(sanitized).toContain("blocked:")
  })

  it("should block data: image/svg+xml URLs", () => {
    const html = '<img src="data:image/svg+xml,<svg onload=alert(1)>">'
    const sanitized = sanitizeHtml(html)

    expect(sanitized).not.toContain("data:image/svg+xml")
  })
})

describe("getStorableContent", () => {
  it("should prefer HTML over text when both are present", () => {
    const parsed: ParsedEmail = {
      subject: "Test",
      from: "test@example.com",
      date: new Date(),
      html: "<p>HTML content</p>",
      text: "Plain text content",
      hasAttachments: false,
    }

    const result = getStorableContent(parsed)

    expect(result.contentType).toBe("html")
    expect(result.content).toContain("HTML content")
  })

  it("should fall back to text when no HTML", () => {
    const parsed: ParsedEmail = {
      subject: "Test",
      from: "test@example.com",
      date: new Date(),
      text: "Plain text only",
      hasAttachments: false,
    }

    const result = getStorableContent(parsed)

    expect(result.contentType).toBe("text")
    expect(result.content).toBe("Plain text only")
  })

  it("should sanitize HTML content", () => {
    const parsed: ParsedEmail = {
      subject: "Test",
      from: "test@example.com",
      date: new Date(),
      html: '<p onclick="evil()">Content</p>',
      hasAttachments: false,
    }

    const result = getStorableContent(parsed)

    expect(result.contentType).toBe("html")
    expect(result.content).not.toContain("onclick")
    expect(result.content).toContain("Content")
  })

  it("should return empty string when no content", () => {
    const parsed: ParsedEmail = {
      subject: "Test",
      from: "test@example.com",
      date: new Date(),
      hasAttachments: false,
    }

    const result = getStorableContent(parsed)

    expect(result.contentType).toBe("text")
    expect(result.content).toBe("")
  })
})
