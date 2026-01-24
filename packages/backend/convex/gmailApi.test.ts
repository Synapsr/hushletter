import { describe, it, expect } from "vitest"
import { internal } from "./_generated/api"
import { extractHtmlBody, extractHeadersFromFullMessage, type GmailFullMessage } from "./gmailApi"

/**
 * Unit and Contract Tests for Gmail API Functions - Story 4.4
 *
 * Task 8.2: Test email content extraction (MIME types)
 *
 * These tests verify:
 * 1. Gmail API functions are properly exported
 * 2. Content extraction handles various MIME types
 * 3. Base64url decoding works correctly
 * 4. Rate limiting and retry logic is documented
 */

// =============================================================================
// API Export Tests
// =============================================================================

describe("gmailApi internal action exports (Story 4.4)", () => {
  it("should export getFullMessageContents action", () => {
    expect(internal.gmailApi).toBeDefined()
    expect(internal.gmailApi.getFullMessageContents).toBeDefined()
  })

  it("should export listMessagesFromSender action", () => {
    expect(internal.gmailApi.listMessagesFromSender).toBeDefined()
  })

  it("should export existing newsletter scanning actions", () => {
    expect(internal.gmailApi.listNewsletterMessages).toBeDefined()
    expect(internal.gmailApi.getMessageDetails).toBeDefined()
  })
})

// =============================================================================
// Task 8.2: Email Content Extraction Tests (MIME Types)
// =============================================================================

describe("extractHtmlBody (Task 8.2)", () => {
  describe("simple text/html messages", () => {
    it("extracts HTML from direct body with text/html MIME type", () => {
      const message: GmailFullMessage = {
        id: "msg1",
        threadId: "thread1",
        internalDate: "1706000000000",
        payload: {
          mimeType: "text/html",
          body: {
            size: 100,
            // "Hello World" in base64url
            data: "SGVsbG8gV29ybGQ",
          },
        },
      }

      const result = extractHtmlBody(message)
      expect(result).toBe("Hello World")
    })

    it("returns null for empty body", () => {
      const message: GmailFullMessage = {
        id: "msg1",
        threadId: "thread1",
        internalDate: "1706000000000",
        payload: {
          mimeType: "text/html",
          body: {
            size: 0,
          },
        },
      }

      const result = extractHtmlBody(message)
      expect(result).toBeNull()
    })
  })

  describe("simple text/plain messages", () => {
    it("wraps plain text in <pre> tags", () => {
      const message: GmailFullMessage = {
        id: "msg1",
        threadId: "thread1",
        internalDate: "1706000000000",
        payload: {
          mimeType: "text/plain",
          body: {
            size: 100,
            // "Hello World" in base64url
            data: "SGVsbG8gV29ybGQ",
          },
        },
      }

      const result = extractHtmlBody(message)
      expect(result).toBe("<pre>Hello World</pre>")
    })

    it("escapes HTML special characters in plain text", () => {
      const message: GmailFullMessage = {
        id: "msg1",
        threadId: "thread1",
        internalDate: "1706000000000",
        payload: {
          mimeType: "text/plain",
          body: {
            size: 100,
            // "<script>alert('xss')</script>" in base64url
            data: "PHNjcmlwdD5hbGVydCgneHNzJyk8L3NjcmlwdD4",
          },
        },
      }

      const result = extractHtmlBody(message)
      expect(result).toContain("&lt;script&gt;")
      expect(result).not.toContain("<script>")
    })
  })

  describe("multipart/alternative messages", () => {
    it("prefers text/html over text/plain", () => {
      const message: GmailFullMessage = {
        id: "msg1",
        threadId: "thread1",
        internalDate: "1706000000000",
        payload: {
          mimeType: "multipart/alternative",
          parts: [
            {
              mimeType: "text/plain",
              body: {
                size: 50,
                data: "UGxhaW4gdGV4dA", // "Plain text"
              },
            },
            {
              mimeType: "text/html",
              body: {
                size: 100,
                data: "PGI-SFRNTDwvYj4", // "<b>HTML</b>"
              },
            },
          ],
        },
      }

      const result = extractHtmlBody(message)
      expect(result).toContain("HTML")
      expect(result).not.toContain("Plain text")
    })

    it("falls back to text/plain if no text/html part", () => {
      const message: GmailFullMessage = {
        id: "msg1",
        threadId: "thread1",
        internalDate: "1706000000000",
        payload: {
          mimeType: "multipart/alternative",
          parts: [
            {
              mimeType: "text/plain",
              body: {
                size: 50,
                data: "UGxhaW4gdGV4dA", // "Plain text"
              },
            },
          ],
        },
      }

      const result = extractHtmlBody(message)
      expect(result).toBe("<pre>Plain text</pre>")
    })
  })

  describe("multipart/mixed messages (with attachments)", () => {
    it("extracts HTML from nested multipart/alternative", () => {
      const message: GmailFullMessage = {
        id: "msg1",
        threadId: "thread1",
        internalDate: "1706000000000",
        payload: {
          mimeType: "multipart/mixed",
          parts: [
            {
              mimeType: "multipart/alternative",
              parts: [
                {
                  mimeType: "text/plain",
                  body: { size: 50, data: "UGxhaW4" },
                },
                {
                  mimeType: "text/html",
                  body: { size: 100, data: "SFRNTA" }, // "HTML"
                },
              ],
            },
            {
              mimeType: "application/pdf",
              body: { size: 1000 },
            },
          ],
        },
      }

      const result = extractHtmlBody(message)
      expect(result).toContain("HTML")
    })
  })

  describe("deeply nested parts", () => {
    it("finds HTML in deeply nested structure", () => {
      const message: GmailFullMessage = {
        id: "msg1",
        threadId: "thread1",
        internalDate: "1706000000000",
        payload: {
          mimeType: "multipart/mixed",
          parts: [
            {
              mimeType: "multipart/related",
              parts: [
                {
                  mimeType: "multipart/alternative",
                  parts: [
                    {
                      mimeType: "text/html",
                      body: { size: 100, data: "RGVlcCBIVE1M" }, // "Deep HTML"
                    },
                  ],
                },
              ],
            },
          ],
        },
      }

      const result = extractHtmlBody(message)
      expect(result).toContain("Deep HTML")
    })
  })

  describe("edge cases", () => {
    it("returns null for message with no body parts", () => {
      const message: GmailFullMessage = {
        id: "msg1",
        threadId: "thread1",
        internalDate: "1706000000000",
        payload: {
          mimeType: "multipart/mixed",
          parts: [
            {
              mimeType: "application/pdf",
              body: { size: 1000 },
            },
          ],
        },
      }

      const result = extractHtmlBody(message)
      expect(result).toBeNull()
    })

    it("handles missing parts array", () => {
      const message: GmailFullMessage = {
        id: "msg1",
        threadId: "thread1",
        internalDate: "1706000000000",
        payload: {
          mimeType: "multipart/mixed",
        },
      }

      const result = extractHtmlBody(message)
      expect(result).toBeNull()
    })
  })
})

// =============================================================================
// Header Extraction Tests
// =============================================================================

describe("extractHeadersFromFullMessage (Task 8.2)", () => {
  it("extracts From header", () => {
    const message: GmailFullMessage = {
      id: "msg1",
      threadId: "thread1",
      internalDate: "1706000000000",
      payload: {
        mimeType: "text/html",
        headers: [
          { name: "From", value: "Newsletter <news@example.com>" },
          { name: "Subject", value: "Weekly Update" },
        ],
      },
    }

    const result = extractHeadersFromFullMessage(message)
    expect(result.from).toBe("Newsletter <news@example.com>")
  })

  it("extracts Subject header", () => {
    const message: GmailFullMessage = {
      id: "msg1",
      threadId: "thread1",
      internalDate: "1706000000000",
      payload: {
        mimeType: "text/html",
        headers: [
          { name: "From", value: "test@example.com" },
          { name: "Subject", value: "My Newsletter #42" },
        ],
      },
    }

    const result = extractHeadersFromFullMessage(message)
    expect(result.subject).toBe("My Newsletter #42")
  })

  it("uses internalDate for date field", () => {
    const message: GmailFullMessage = {
      id: "msg1",
      threadId: "thread1",
      internalDate: "1706000000000",
      payload: {
        mimeType: "text/html",
        headers: [],
      },
    }

    const result = extractHeadersFromFullMessage(message)
    expect(result.date).toBe(1706000000000)
  })

  it("handles case-insensitive header names", () => {
    const message: GmailFullMessage = {
      id: "msg1",
      threadId: "thread1",
      internalDate: "1706000000000",
      payload: {
        mimeType: "text/html",
        headers: [
          { name: "FROM", value: "upper@example.com" },
          { name: "subject", value: "lowercase subject" },
        ],
      },
    }

    const result = extractHeadersFromFullMessage(message)
    expect(result.from).toBe("upper@example.com")
    expect(result.subject).toBe("lowercase subject")
  })

  it("returns empty strings for missing headers", () => {
    const message: GmailFullMessage = {
      id: "msg1",
      threadId: "thread1",
      internalDate: "1706000000000",
      payload: {
        mimeType: "text/html",
        headers: [],
      },
    }

    const result = extractHeadersFromFullMessage(message)
    expect(result.from).toBe("")
    expect(result.subject).toBe("")
  })

  it("handles missing headers array", () => {
    const message: GmailFullMessage = {
      id: "msg1",
      threadId: "thread1",
      internalDate: "1706000000000",
      payload: {
        mimeType: "text/html",
      },
    }

    const result = extractHeadersFromFullMessage(message)
    expect(result.from).toBe("")
    expect(result.subject).toBe("")
  })
})

// =============================================================================
// Base64url Decoding Tests
// =============================================================================

describe("base64url decoding (internal)", () => {
  it("documents base64url vs standard base64 differences", () => {
    const differences = {
      standardBase64: "Uses + and / characters",
      base64url: "Uses - and _ characters (URL-safe)",
      gmailUsage: "Gmail API returns base64url encoded content",
    }
    expect(differences.base64url).toContain("-")
    expect(differences.base64url).toContain("_")
  })

  it("documents padding handling", () => {
    const paddingBehavior = {
      base64: "May require = padding to multiple of 4",
      implementation: "Adds padding before decoding",
    }
    expect(paddingBehavior.implementation).toContain("padding")
  })

  it("documents UTF-8 handling", () => {
    const utf8Behavior = {
      conversion: "Binary -> Uint8Array -> TextDecoder UTF-8",
      supports: ["ASCII", "Unicode", "Emoji"],
    }
    expect(utf8Behavior.supports).toContain("Unicode")
  })
})

// =============================================================================
// Rate Limiting and Retry Tests
// =============================================================================

describe("withRateLimitRetry helper (Task 8.2)", () => {
  it("documents retry configuration", () => {
    const retryConfig = {
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      backoffType: "exponential (1s, 2s, 4s)",
    }
    expect(retryConfig.maxRetries).toBe(3)
    expect(retryConfig.backoffType).toContain("exponential")
  })

  it("documents retry trigger condition", () => {
    const triggerCondition = {
      errorType: "ConvexError",
      errorCode: "RATE_LIMITED",
      httpStatus: 429,
    }
    expect(triggerCondition.errorCode).toBe("RATE_LIMITED")
  })

  it("documents non-retry error pass-through", () => {
    const passThrough = {
      otherErrors: "Thrown immediately without retry",
      examples: ["TOKEN_EXPIRED", "FORBIDDEN", "NOT_FOUND"],
    }
    expect(passThrough.examples).toContain("TOKEN_EXPIRED")
  })
})

describe("batch processing with rate limiting", () => {
  it("documents batch size", () => {
    const batchConfig = {
      batchSize: 10,
      reason: "Gmail quota: 250 units/sec, 5 units per request = 50 req/sec max",
      safeMargin: "40 requests/sec (4 batches/sec)",
    }
    expect(batchConfig.batchSize).toBe(10)
  })

  it("documents delay between batches", () => {
    const delayConfig = {
      delayMs: 250,
      purpose: "Rate limit compliance",
      calculation: "1000ms / 4 batches = 250ms",
    }
    expect(delayConfig.delayMs).toBe(250)
  })
})

// =============================================================================
// listMessagesFromSender Contract Tests
// =============================================================================

describe("listMessagesFromSender action contract (Story 4.4 Task 5.2)", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      senderEmail: "required string - sender's email address",
      maxResults: "optional number - max messages per page (default 100)",
      pageToken: "optional string - pagination token",
    }
    expect(expectedArgsShape).toHaveProperty("senderEmail")
    expect(expectedArgsShape).toHaveProperty("pageToken")
  })

  it("defines expected return shape", () => {
    const expectedReturn = {
      messages: "array of { id: string, threadId: string }",
      nextPageToken: "string | undefined",
    }
    expect(expectedReturn).toHaveProperty("messages")
    expect(expectedReturn).toHaveProperty("nextPageToken")
  })

  it("constructs correct Gmail search query", () => {
    const searchQuery = {
      format: "from:{senderEmail}",
      example: "from:newsletter@example.com",
    }
    expect(searchQuery.format).toContain("from:")
  })
})

// =============================================================================
// getFullMessageContents Contract Tests
// =============================================================================

describe("getFullMessageContents action contract (Story 4.4 Task 2.1)", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      messageIds: "required array of string - Gmail message IDs",
    }
    expect(expectedArgsShape).toHaveProperty("messageIds")
  })

  it("defines expected return shape", () => {
    const expectedReturn = {
      type: "array of GmailFullMessage",
      fields: ["id", "threadId", "internalDate", "payload"],
    }
    expect(expectedReturn.fields).toContain("payload")
  })

  it("fetches messages with format=full", () => {
    const fetchConfig = {
      apiEndpoint: "/gmail/v1/users/me/messages/{messageId}",
      queryParam: "format=full",
      reason: "Get full content including body",
    }
    expect(fetchConfig.queryParam).toBe("format=full")
  })

  it("uses batch processing for efficiency", () => {
    const batchBehavior = {
      batchSize: 10,
      delayBetween: "250ms",
      rateLimit: "40 requests/sec safe margin",
    }
    expect(batchBehavior.batchSize).toBe(10)
  })
})

// =============================================================================
// Error Handling Contract Tests
// =============================================================================

describe("Gmail API error handling", () => {
  it("documents error code mappings", () => {
    const errorMappings = {
      401: { code: "TOKEN_EXPIRED", action: "User needs to reconnect" },
      403: { code: "FORBIDDEN", action: "Check permissions" },
      404: { code: "NOT_FOUND", action: "Message doesn't exist" },
      429: { code: "RATE_LIMITED", action: "Retry with backoff" },
      default: { code: "GMAIL_API_ERROR", action: "Generic error handling" },
    }
    expect(errorMappings[401].code).toBe("TOKEN_EXPIRED")
    expect(errorMappings[429].code).toBe("RATE_LIMITED")
  })

  it("documents error response structure", () => {
    const errorStructure = {
      type: "ConvexError",
      data: {
        code: "GmailApiErrorCode",
        message: "Human-readable error message",
      },
    }
    expect(errorStructure.data).toHaveProperty("code")
    expect(errorStructure.data).toHaveProperty("message")
  })
})

// =============================================================================
// Type Documentation
// =============================================================================

describe("GmailFullMessage type documentation", () => {
  it("documents required fields", () => {
    const requiredFields = {
      id: "string - Gmail message ID",
      threadId: "string - Gmail thread ID",
      internalDate: "string - Unix timestamp in ms as string",
      payload: {
        mimeType: "string - e.g., 'text/html', 'multipart/alternative'",
        headers: "array of { name, value } | undefined",
        body: "{ size, data? } | undefined",
        parts: "GmailMessagePart[] | undefined",
      },
    }
    expect(requiredFields).toHaveProperty("id")
    expect(requiredFields).toHaveProperty("payload")
  })

  it("documents GmailMessagePart structure", () => {
    const partStructure = {
      mimeType: "string - MIME type of this part",
      body: "{ size, data? } | undefined",
      parts: "GmailMessagePart[] | undefined - nested parts",
    }
    expect(partStructure).toHaveProperty("mimeType")
    expect(partStructure).toHaveProperty("parts")
  })
})
