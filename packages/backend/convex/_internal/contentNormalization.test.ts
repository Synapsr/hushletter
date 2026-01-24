import { describe, it, expect } from "vitest"
import { normalizeForHash, computeContentHash } from "./contentNormalization"

/**
 * Unit Tests for Content Normalization - Story 2.5.2
 *
 * These tests verify the normalization and hashing functions work correctly
 * to enable newsletter deduplication.
 */

describe("normalizeForHash", () => {
  describe("tracking pixel removal", () => {
    it("strips tracking pixels with tracking path segment /track/", () => {
      const html = '<p>Hello</p><img src="https://example.com/track/pixel.gif">'
      expect(normalizeForHash(html)).toBe("<p>Hello</p>")
    })

    it("strips tracking pixels with tracking path segment /pixel/", () => {
      const html = '<p>Hello</p><img src="https://email.example.com/pixel/img">'
      expect(normalizeForHash(html)).toBe("<p>Hello</p>")
    })

    it("strips tracking pixels with tracking subdomain track.*", () => {
      const html = '<p>Hello</p><img src="https://track.example.com/img.gif">'
      expect(normalizeForHash(html)).toBe("<p>Hello</p>")
    })

    it("strips tracking pixels with tracking subdomain pixel.*", () => {
      const html = '<p>Hello</p><img src="https://pixel.marketing.co/x">'
      expect(normalizeForHash(html)).toBe("<p>Hello</p>")
    })

    it("strips tracking pixels with tracking subdomain beacon.*", () => {
      const html = '<p>Content</p><img src="https://beacon.analytics.com/1">'
      expect(normalizeForHash(html)).toBe("<p>Content</p>")
    })

    it("strips tracking pixels with tracking subdomain open.*", () => {
      const html = '<p>Text</p><img src="https://open.marketing.co/email">'
      expect(normalizeForHash(html)).toBe("<p>Text</p>")
    })

    it("strips 1x1 tracking images (width then height)", () => {
      const html = '<img width="1" height="1" src="x.gif">'
      expect(normalizeForHash(html)).toBe("")
    })

    it("strips 1x1 tracking images (height then width)", () => {
      const html = '<img height="1" width="1" src="y.gif">'
      expect(normalizeForHash(html)).toBe("")
    })

    it("strips 1x1 images without quotes on dimensions", () => {
      const html = "<img width=1 height=1 src=z.gif>"
      expect(normalizeForHash(html)).toBe("")
    })

    it("preserves regular images", () => {
      const html = '<img src="https://example.com/photo.jpg" width="600" height="400">'
      expect(normalizeForHash(html)).toBe(
        '<img src="https://example.com/photo.jpg" width="600" height="400">'
      )
    })

    it("preserves images with tracking words in filename (avoids false positives)", () => {
      // These should NOT be stripped - they're legitimate content
      const html1 = '<img src="https://example.com/photos/tracksuit.jpg">'
      const html2 = '<img src="https://example.com/pixel-art-logo.png">'
      const html3 = '<img src="https://example.com/unopened-letter.png">'

      expect(normalizeForHash(html1)).toContain("tracksuit.jpg")
      expect(normalizeForHash(html2)).toContain("pixel-art-logo.png")
      expect(normalizeForHash(html3)).toContain("unopened-letter.png")
    })
  })

  describe("unsubscribe link normalization", () => {
    it("normalizes unsubscribe links to placeholder", () => {
      const html = '<a href="https://example.com/unsubscribe?id=abc123">Unsub</a>'
      expect(normalizeForHash(html)).toContain('href="UNSUBSCRIBE"')
    })

    it("normalizes unsubscribe links case-insensitively", () => {
      const html = '<a href="https://example.com/UNSUBSCRIBE?user=xyz">Click</a>'
      expect(normalizeForHash(html)).toContain('href="UNSUBSCRIBE"')
    })

    it("preserves non-unsubscribe links", () => {
      const html = '<a href="https://example.com/article">Read more</a>'
      expect(normalizeForHash(html)).toContain('href="https://example.com/article"')
    })
  })

  describe("personalized greeting normalization", () => {
    it("normalizes Hi NAME greeting", () => {
      expect(normalizeForHash("Hi John, Welcome!")).toBe("Hi USER, Welcome!")
    })

    it("normalizes Hello NAME greeting", () => {
      expect(normalizeForHash("Hello Sarah, Welcome!")).toBe("Hello USER, Welcome!")
    })

    it("normalizes Dear NAME greeting", () => {
      expect(normalizeForHash("Dear Michael, Thank you")).toBe("Dear USER, Thank you")
    })

    it("normalizes Hey NAME greeting", () => {
      expect(normalizeForHash("Hey Jane, What's up")).toBe("Hey USER, What's up")
    })

    it("normalizes lowercase names", () => {
      expect(normalizeForHash("Hi john, Welcome!")).toBe("Hi USER, Welcome!")
    })

    it("normalizes uppercase names", () => {
      expect(normalizeForHash("Hello SARAH, Welcome!")).toBe("Hello USER, Welcome!")
    })

    it("normalizes hyphenated names", () => {
      expect(normalizeForHash("Dear Jean-Pierre, Thank you")).toBe("Dear USER, Thank you")
    })

    it("normalizes mixed case greetings", () => {
      expect(normalizeForHash("HI John, Welcome!")).toBe("HI USER, Welcome!")
      expect(normalizeForHash("HELLO Sarah, Welcome!")).toBe("HELLO USER, Welcome!")
    })

    it("preserves non-greeting names", () => {
      // Names not at greeting position should be preserved
      const html = "Contact John Smith for more info"
      // This doesn't match the greeting pattern (no comma after name)
      expect(normalizeForHash(html)).toBe("Contact John Smith for more info")
    })
  })

  describe("hex ID stripping", () => {
    it("strips 32+ character hex strings", () => {
      const html = '<a href="https://x.com/click/abc123def456789012345678901234567890">'
      expect(normalizeForHash(html)).toContain("HASH")
      expect(normalizeForHash(html)).not.toContain("abc123def456")
    })

    it("strips long tracking codes from URLs", () => {
      const html = "https://track.com/e/1234567890abcdef1234567890abcdef1234567890"
      expect(normalizeForHash(html)).toContain("HASH")
    })

    it("preserves shorter hex strings", () => {
      // 31 chars - should be preserved
      const html = "Code: 1234567890abcdef1234567890abcde"
      expect(normalizeForHash(html)).toContain("1234567890abcdef1234567890abcde")
    })
  })

  describe("whitespace normalization", () => {
    it("collapses multiple spaces to single space", () => {
      const html = "Hello    world"
      expect(normalizeForHash(html)).toBe("Hello world")
    })

    it("collapses newlines and tabs to single space", () => {
      const html = "Hello\n\n\tworld"
      expect(normalizeForHash(html)).toBe("Hello world")
    })

    it("trims leading and trailing whitespace", () => {
      const html = "   Hello world   "
      expect(normalizeForHash(html)).toBe("Hello world")
    })
  })

  describe("consistent output for same logical content", () => {
    it("produces same output for different personalized names", () => {
      const html1 = "Hi John, Welcome to our newsletter!"
      const html2 = "Hi Sarah, Welcome to our newsletter!"
      expect(normalizeForHash(html1)).toBe(normalizeForHash(html2))
    })

    it("produces same output for different tracking IDs", () => {
      const html1 =
        '<a href="https://track.com/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa">Click</a>'
      const html2 =
        '<a href="https://track.com/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb">Click</a>'
      expect(normalizeForHash(html1)).toBe(normalizeForHash(html2))
    })

    it("produces same output regardless of whitespace differences", () => {
      const html1 = "Hello   world"
      const html2 = "Hello world"
      expect(normalizeForHash(html1)).toBe(normalizeForHash(html2))
    })
  })

  describe("complex newsletter scenarios", () => {
    it("normalizes a realistic newsletter excerpt", () => {
      const newsletter = `
        <html>
          <body>
            <p>Hi John,</p>
            <p>Thanks for subscribing!</p>
            <img width="1" height="1" src="https://example.com/pixel?id=abc123">
            <img src="https://track.substack.com/open/email123">
            <a href="https://newsletter.com/unsubscribe?user=xyz789">Unsubscribe</a>
            <a href="https://click.example.com/xyz789abcdef123456789012345678901234abcd">Read Article</a>
          </body>
        </html>
      `

      const normalized = normalizeForHash(newsletter)

      // Should normalize greeting
      expect(normalized).toContain("Hi USER,")
      // Should remove 1x1 tracking pixel
      expect(normalized).not.toContain('width="1"')
      // Should remove tracking subdomain image
      expect(normalized).not.toContain("track.substack.com")
      // Should normalize unsubscribe
      expect(normalized).toContain('href="UNSUBSCRIBE"')
      // Should replace long hex (32+ chars) in article link
      expect(normalized).toContain("HASH")
      // Should preserve article link structure
      expect(normalized).toContain("Read Article")
    })
  })
})

describe("computeContentHash", () => {
  it("produces deterministic hash for same input", async () => {
    const content = "Hello World"
    const hash1 = await computeContentHash(content)
    const hash2 = await computeContentHash(content)
    expect(hash1).toBe(hash2)
  })

  it("produces 64-character hex string (SHA-256)", async () => {
    const hash = await computeContentHash("test")
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it("produces different hashes for different inputs", async () => {
    const hash1 = await computeContentHash("Hello")
    const hash2 = await computeContentHash("World")
    expect(hash1).not.toBe(hash2)
  })

  it("produces known SHA-256 hash for test vector", async () => {
    // Known SHA-256 of empty string
    const emptyHash = await computeContentHash("")
    expect(emptyHash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
  })

  it("handles unicode content", async () => {
    const hash = await computeContentHash("Hello 世界 🌍")
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it("handles long content", async () => {
    const longContent = "a".repeat(100000)
    const hash = await computeContentHash(longContent)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })
})

describe("end-to-end normalization + hashing", () => {
  it("produces same hash for identical newsletters with different user data", async () => {
    const newsletter1 = `
      <p>Hi John,</p>
      <p>Weekly digest</p>
      <img width="1" height="1" src="https://track.com/1234567890abcdef1234567890abcdef12345678">
    `
    const newsletter2 = `
      <p>Hi Sarah,</p>
      <p>Weekly digest</p>
      <img width="1" height="1" src="https://track.com/abcdef1234567890abcdef1234567890abcdef12">
    `

    const normalized1 = normalizeForHash(newsletter1)
    const normalized2 = normalizeForHash(newsletter2)

    const hash1 = await computeContentHash(normalized1)
    const hash2 = await computeContentHash(normalized2)

    expect(hash1).toBe(hash2)
  })

  it("produces different hash for actually different content", async () => {
    const newsletter1 = `<p>Hi John,</p><p>Issue #1</p>`
    const newsletter2 = `<p>Hi John,</p><p>Issue #2</p>`

    const hash1 = await computeContentHash(normalizeForHash(newsletter1))
    const hash2 = await computeContentHash(normalizeForHash(newsletter2))

    expect(hash1).not.toBe(hash2)
  })
})
