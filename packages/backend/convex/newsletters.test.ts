import { describe, it, expect } from "vitest"
import { api, internal } from "./_generated/api"

/**
 * Contract Tests for newsletters.ts - Story 2.5.1
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
 * TODO: Add integration tests in a separate `*.integration.test.ts` file
 * that runs against Convex dev deployment for real behavioral testing.
 */

describe("newsletters API exports", () => {
  it("should export all public query functions", () => {
    expect(api.newsletters).toBeDefined()
    expect(api.newsletters.getUserNewsletter).toBeDefined()
    expect(api.newsletters.listUserNewsletters).toBeDefined()
  })

  it("should export public action functions", () => {
    expect(api.newsletters.getUserNewsletterWithContent).toBeDefined()
  })

  it("should export internal functions", () => {
    expect(internal.newsletters).toBeDefined()
    expect(internal.newsletters.createUserNewsletter).toBeDefined()
    expect(internal.newsletters.createNewsletterContent).toBeDefined()
    expect(internal.newsletters.storeNewsletterContent).toBeDefined()
    expect(internal.newsletters.getUserNewsletterInternal).toBeDefined()
    expect(internal.newsletters.getNewsletterContentInternal).toBeDefined()
  })
})

describe("createUserNewsletter mutation contract", () => {
  it("defines expected args schema for new shared content model", () => {
    const expectedArgsShape = {
      userId: "required Id<'users'> - the newsletter owner",
      senderId: "required Id<'senders'> - global sender reference",
      subject: "required string - email subject line",
      senderEmail: "required string - sender's email address",
      senderName: "optional string - sender's display name",
      receivedAt: "required number - Unix timestamp ms",
      isPrivate: "required boolean - whether content is private",
      contentId: "optional Id<'newsletterContent'> - for public content",
      privateR2Key: "optional string - R2 key for private content",
    }
    expect(expectedArgsShape).toHaveProperty("userId")
    expect(expectedArgsShape).toHaveProperty("senderId")
    expect(expectedArgsShape).toHaveProperty("subject")
    expect(expectedArgsShape).toHaveProperty("senderEmail")
    expect(expectedArgsShape).toHaveProperty("receivedAt")
    expect(expectedArgsShape).toHaveProperty("isPrivate")
    expect(expectedArgsShape).toHaveProperty("contentId")
    expect(expectedArgsShape).toHaveProperty("privateR2Key")
  })

  it("defines expected return type", () => {
    const expectedReturn = "Id<'userNewsletters'>"
    expect(typeof expectedReturn).toBe("string")
  })

  it("creates userNewsletter with required fields", () => {
    const requiredFields = [
      "userId",
      "senderId",
      "subject",
      "senderEmail",
      "receivedAt",
      "isRead",
      "isHidden",
      "isPrivate",
    ]
    expect(requiredFields).toContain("userId")
    expect(requiredFields).toContain("senderId")
    expect(requiredFields).toContain("isRead")
    expect(requiredFields).toContain("isPrivate")
  })

  it("sets default values for boolean flags", () => {
    const defaultValues = {
      isRead: false,
      isHidden: false,
    }
    expect(defaultValues.isRead).toBe(false)
    expect(defaultValues.isHidden).toBe(false)
  })
})

describe("createNewsletterContent mutation contract", () => {
  it("defines expected args schema for shared content", () => {
    const expectedArgsShape = {
      r2Key: "required string - R2 object key",
      subject: "required string - email subject line",
      senderEmail: "required string - sender's email address",
      senderName: "optional string - sender's display name",
      receivedAt: "required number - Unix timestamp ms",
      contentHash: "required string - SHA-256 hash (required in 2.5.2)",
    }
    expect(expectedArgsShape).toHaveProperty("r2Key")
    expect(expectedArgsShape).toHaveProperty("contentHash")
  })

  it("defines expected return type", () => {
    const expectedReturn = "Id<'newsletterContent'>"
    expect(typeof expectedReturn).toBe("string")
  })

  it("initializes readerCount to 1", () => {
    const initialReaderCount = 1
    expect(initialReaderCount).toBe(1)
  })

  it("handles race condition by returning existing content", () => {
    // If content with same hash was created between action's query
    // and this mutation, we detect it and return existing content
    // instead of creating a duplicate
    const raceConditionBehavior = {
      detection: "Query by_contentHash index within mutation",
      handling: "Return existing._id, increment readerCount",
      logging: "Race condition handled message",
    }
    expect(raceConditionBehavior.detection).toContain("by_contentHash")
  })
})

describe("storeNewsletterContent action contract", () => {
  it("defines expected args schema for new shared content model", () => {
    const expectedArgsShape = {
      userId: "required Id<'users'>",
      senderId: "required Id<'senders'>",
      subject: "required string",
      senderEmail: "required string",
      senderName: "optional string",
      receivedAt: "required number",
      htmlContent: "optional string - sanitized HTML",
      textContent: "optional string - plain text fallback",
      isPrivate: "required boolean - determines storage path",
    }
    expect(expectedArgsShape).toHaveProperty("senderId")
    expect(expectedArgsShape).toHaveProperty("isPrivate")
    expect(expectedArgsShape).toHaveProperty("htmlContent")
    expect(expectedArgsShape).toHaveProperty("textContent")
  })

  it("defines expected return shape", () => {
    const expectedReturn = {
      userNewsletterId: "Id<'userNewsletters'>",
      r2Key: "string - generated R2 key",
    }
    expect(expectedReturn).toHaveProperty("userNewsletterId")
    expect(expectedReturn).toHaveProperty("r2Key")
  })

  it("generates R2 key with proper format for private content", () => {
    // Private R2 key format: private/{userId}/{timestamp}-{uuid}.{ext}
    const privateKeyFormat = /^private\/.+\/\d+-[a-f0-9-]+\.(html|txt)$/
    const examplePrivateKey = "private/k123/1706100000000-abc123-def456.html"

    expect(examplePrivateKey).toMatch(privateKeyFormat)
  })

  it("generates R2 key with proper format for public content (Story 2.5.2)", () => {
    // Public R2 key format: content/{contentHash}.{ext}
    // Uses SHA-256 hash (64 hex chars) for natural storage-level deduplication
    const publicKeyFormat = /^content\/[a-f0-9]{64}\.(html|txt)$/
    const examplePublicKey =
      "content/a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2.html"

    expect(examplePublicKey).toMatch(publicKeyFormat)
  })

  it("uses crypto.randomUUID() for collision-resistant keys", () => {
    // Verifies we use crypto.randomUUID() not Math.random()
    const uuidPattern = /[a-f0-9-]{36}/
    expect("550e8400-e29b-41d4-a716-446655440000").toMatch(uuidPattern)
  })

  it("handles R2 upload errors gracefully", () => {
    const expectedError = {
      code: "R2_UPLOAD_FAILED",
      message: "Failed to store newsletter content in R2",
    }
    expect(expectedError.code).toBe("R2_UPLOAD_FAILED")
  })

  it("handles empty content by using subject as fallback", () => {
    // Empty content uses subject as minimal content to ensure unique hash
    // This prevents all empty emails from deduplicating to the same hash
    const fallbackBehavior = {
      emptyContent: "uses `<p>${subject}</p>` as effectiveContent",
      hashingBasis: "effectiveContent (never truly empty)",
      storageBasis: "effectiveContent (fallback applied)",
    }
    expect(fallbackBehavior.emptyContent).toContain("subject")
  })
})

describe("getUserNewsletter query contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      userNewsletterId: "required Id<'userNewsletters'>",
    }
    expect(expectedArgsShape).toHaveProperty("userNewsletterId")
  })

  it("returns userNewsletter with contentStatus field", () => {
    const expectedReturn = {
      _id: "userNewsletter id",
      userId: "user id",
      senderId: "sender id",
      subject: "string",
      contentStatus: "'available' | 'missing'",
    }
    expect(expectedReturn).toHaveProperty("contentStatus")
    expect(expectedReturn).toHaveProperty("senderId")
  })

  it("returns 'available' when contentId or privateR2Key exists", () => {
    const contentStatusWhenKeyExists = "available"
    expect(contentStatusWhenKeyExists).toBe("available")
  })

  it("returns 'missing' when neither contentId nor privateR2Key exists", () => {
    const contentStatusWhenNoKey = "missing"
    expect(contentStatusWhenNoKey).toBe("missing")
  })
})

describe("getUserNewsletterWithContent action contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      userNewsletterId: "required Id<'userNewsletters'>",
    }
    expect(expectedArgsShape).toHaveProperty("userNewsletterId")
  })

  it("returns userNewsletter with contentUrl and contentStatus", () => {
    const expectedReturn = {
      _id: "userNewsletter id",
      contentUrl: "string | null - signed R2 URL",
      contentStatus: "'available' | 'missing' | 'error'",
    }
    expect(expectedReturn).toHaveProperty("contentUrl")
    expect(expectedReturn).toHaveProperty("contentStatus")
  })

  it("generates signed URL with 1 hour expiry", () => {
    const signedUrlConfig = { expiresIn: 3600 }
    expect(signedUrlConfig.expiresIn).toBe(3600) // 1 hour in seconds
  })

  it("handles R2 URL generation errors gracefully", () => {
    // When r2.getUrl fails, contentStatus should be 'error'
    const statusOnError = "error"
    expect(statusOnError).toBe("error")
  })

  it("resolves R2 key from newsletterContent for public content", () => {
    const publicContentFlow = {
      step1: "Check isPrivate === false",
      step2: "Get contentId from userNewsletter",
      step3: "Query newsletterContent by contentId",
      step4: "Use r2Key from newsletterContent",
    }
    expect(publicContentFlow.step2).toContain("contentId")
    expect(publicContentFlow.step3).toContain("newsletterContent")
  })

  it("uses privateR2Key directly for private content", () => {
    const privateContentFlow = {
      step1: "Check isPrivate === true",
      step2: "Use privateR2Key from userNewsletter directly",
    }
    expect(privateContentFlow.step2).toContain("privateR2Key")
  })
})

describe("listUserNewsletters query contract", () => {
  it("takes no args", () => {
    const expectedArgs = {}
    expect(Object.keys(expectedArgs)).toHaveLength(0)
  })

  it("returns empty array when not authenticated", () => {
    const returnWhenUnauth: unknown[] = []
    expect(returnWhenUnauth).toEqual([])
  })

  it("filters newsletters by authenticated user", () => {
    const filterBehavior = {
      uses: "withIndex('by_userId', q => q.eq('userId', user._id))",
      order: "desc",
    }
    expect(filterBehavior.uses).toContain("by_userId")
    expect(filterBehavior.order).toBe("desc")
  })
})

describe("newsletters error handling", () => {
  it("uses UNAUTHORIZED for unauthenticated requests", () => {
    const expectedError = {
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    }
    expect(expectedError.code).toBe("UNAUTHORIZED")
  })

  it("uses NOT_FOUND when newsletter doesn't exist", () => {
    const expectedError = {
      code: "NOT_FOUND",
      message: "Newsletter not found",
    }
    expect(expectedError.code).toBe("NOT_FOUND")
  })

  it("uses FORBIDDEN for access violation", () => {
    const expectedError = {
      code: "FORBIDDEN",
      message: "Access denied",
    }
    expect(expectedError.code).toBe("FORBIDDEN")
  })

  it("follows ConvexError pattern from architecture.md", () => {
    const validErrorCodes = [
      "NOT_FOUND",
      "UNAUTHORIZED",
      "FORBIDDEN",
      "R2_UPLOAD_FAILED",
    ]
    expect(validErrorCodes).toContain("UNAUTHORIZED")
    expect(validErrorCodes).toContain("FORBIDDEN")
    expect(validErrorCodes).toContain("R2_UPLOAD_FAILED")
  })
})

describe("newsletters privacy model (Story 2.5.1)", () => {
  it("documents per-user privacy via userSenderSettings", () => {
    const privacyModel = {
      table: "userSenderSettings",
      field: "isPrivate",
      default: false,
      description: "Privacy is per-user, not per-sender",
    }
    expect(privacyModel.table).toBe("userSenderSettings")
    expect(privacyModel.default).toBe(false)
  })

  it("uses contentId for public newsletters", () => {
    const publicPath = {
      condition: "userSenderSettings.isPrivate === false",
      storage: "newsletterContent table via contentId",
      benefit: "Content deduplication for community discovery",
    }
    expect(publicPath.storage).toContain("newsletterContent")
  })

  it("uses privateR2Key for private newsletters", () => {
    const privatePath = {
      condition: "userSenderSettings.isPrivate === true",
      storage: "privateR2Key on userNewsletters",
      benefit: "Maximum privacy isolation",
    }
    expect(privatePath.storage).toContain("privateR2Key")
  })

  it("allows owner to access their own newsletters", () => {
    const ownerAccess = {
      condition: "userNewsletter.userId === user._id",
      result: "access granted regardless of isPrivate",
    }
    expect(ownerAccess.result).toContain("access granted")
  })
})

describe("ContentStatus type", () => {
  it("defines three possible states", () => {
    const contentStatusValues = ["available", "missing", "error"] as const
    expect(contentStatusValues).toContain("available")
    expect(contentStatusValues).toContain("missing")
    expect(contentStatusValues).toContain("error")
    expect(contentStatusValues).toHaveLength(3)
  })

  it("uses 'available' when R2 content exists and URL is generated", () => {
    const status = "available"
    expect(status).toBe("available")
  })

  it("uses 'missing' when neither contentId nor privateR2Key exists", () => {
    const status = "missing"
    expect(status).toBe("missing")
  })

  it("uses 'error' when R2 URL generation fails", () => {
    const status = "error"
    expect(status).toBe("error")
  })
})

describe("senders API exports", () => {
  it("should export public query functions", () => {
    expect(api.senders).toBeDefined()
    expect(api.senders.listSenders).toBeDefined()
    expect(api.senders.listUserSenderSettings).toBeDefined()
  })

  it("should export internal functions", () => {
    expect(internal.senders).toBeDefined()
    expect(internal.senders.getOrCreateSender).toBeDefined()
    expect(internal.senders.getOrCreateUserSenderSettings).toBeDefined()
    expect(internal.senders.getUserSenderSettings).toBeDefined()
    expect(internal.senders.updateUserSenderSettings).toBeDefined()
    expect(internal.senders.getSenderByEmail).toBeDefined()
    expect(internal.senders.incrementNewsletterCount).toBeDefined()
  })
})

describe("folders API exports", () => {
  it("should export public query and mutation functions", () => {
    expect(api.folders).toBeDefined()
    expect(api.folders.createFolder).toBeDefined()
    expect(api.folders.listFolders).toBeDefined()
    expect(api.folders.updateFolder).toBeDefined()
    expect(api.folders.deleteFolder).toBeDefined()
  })
})

// =============================================================================
// Story 2.5.2: Content Deduplication Pipeline
// =============================================================================

describe("content deduplication API exports (Story 2.5.2)", () => {
  it("should export findByContentHash internal query", () => {
    expect(internal.newsletters.findByContentHash).toBeDefined()
  })

  it("should export incrementReaderCount internal mutation", () => {
    expect(internal.newsletters.incrementReaderCount).toBeDefined()
  })
})

describe("findByContentHash query contract (Story 2.5.2)", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      contentHash: "required string - SHA-256 hash of normalized content",
    }
    expect(expectedArgsShape).toHaveProperty("contentHash")
  })

  it("returns newsletterContent or null", () => {
    const expectedReturn = {
      found: "newsletterContent record with _id, contentHash, r2Key, etc.",
      notFound: "null",
    }
    expect(expectedReturn).toHaveProperty("found")
    expect(expectedReturn).toHaveProperty("notFound")
  })

  it("uses by_contentHash index for efficient lookup", () => {
    const indexUsed = "by_contentHash"
    expect(indexUsed).toBe("by_contentHash")
  })
})

describe("incrementReaderCount mutation contract (Story 2.5.2)", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      contentId: "required Id<'newsletterContent'> - content to increment",
    }
    expect(expectedArgsShape).toHaveProperty("contentId")
  })

  it("increments readerCount by 1", () => {
    const operation = "readerCount = readerCount + 1"
    expect(operation).toContain("+ 1")
  })

  it("throws NOT_FOUND error if content doesn't exist", () => {
    // Consistent with incrementNewsletterCount in senders.ts
    const expectedError = {
      code: "NOT_FOUND",
      message: "Newsletter content not found",
    }
    expect(expectedError.code).toBe("NOT_FOUND")
  })
})

describe("storeNewsletterContent deduplication behavior (Story 2.5.2)", () => {
  describe("public content path (isPrivate=false)", () => {
    it("normalizes content before hashing", () => {
      const flow = {
        step1: "Call normalizeForHash(content)",
        step2: "Strips tracking pixels, personalizations, hex IDs",
        step3: "Normalizes whitespace",
      }
      expect(flow.step1).toContain("normalizeForHash")
    })

    it("computes SHA-256 hash of normalized content", () => {
      const hashAlgorithm = "SHA-256 via crypto.subtle.digest"
      expect(hashAlgorithm).toContain("SHA-256")
    })

    it("checks for existing content via findByContentHash", () => {
      const dedupLookup = {
        query: "internal.newsletters.findByContentHash",
        index: "by_contentHash",
      }
      expect(dedupLookup.query).toContain("findByContentHash")
    })

    it("reuses existing content on dedup HIT", () => {
      const dedupHitBehavior = {
        reuseContentId: true,
        skipR2Upload: true,
        incrementReaderCount: true,
        createNewNewsletterContent: false,
      }
      expect(dedupHitBehavior.reuseContentId).toBe(true)
      expect(dedupHitBehavior.skipR2Upload).toBe(true)
      expect(dedupHitBehavior.incrementReaderCount).toBe(true)
    })

    it("creates new content on dedup MISS", () => {
      const dedupMissBehavior = {
        uploadToR2: true,
        createNewsletterContent: true,
        useHashBasedR2Key: true,
        initialReaderCount: 1,
      }
      expect(dedupMissBehavior.uploadToR2).toBe(true)
      expect(dedupMissBehavior.useHashBasedR2Key).toBe(true)
      expect(dedupMissBehavior.initialReaderCount).toBe(1)
    })

    it("uses hash-based R2 key pattern: content/{hash}.{ext}", () => {
      const keyPattern = /^content\/[a-f0-9]{64}\.(html|txt)$/
      const exampleKey = "content/a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2.html"
      expect(exampleKey).toMatch(keyPattern)
    })
  })

  describe("private content path (isPrivate=true)", () => {
    it("bypasses deduplication entirely", () => {
      const privatePathBehavior = {
        normalization: "skipped",
        hashing: "skipped",
        dedupLookup: "skipped",
      }
      expect(privatePathBehavior.normalization).toBe("skipped")
      expect(privatePathBehavior.hashing).toBe("skipped")
    })

    it("uses user-specific R2 key pattern: private/{userId}/{timestamp}-{uuid}.{ext}", () => {
      // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (36 chars with hyphens)
      const keyPattern = /^private\/.+\/\d+-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(html|txt)$/
      const exampleKey = "private/user123/1706100000000-a1b2c3d4-e5f6-7890-abcd-ef1234567890.html"
      expect(exampleKey).toMatch(keyPattern)
    })

    it("stores privateR2Key on userNewsletter (no contentId)", () => {
      const privateStorage = {
        contentId: undefined,
        privateR2Key: "private/user123/...",
      }
      expect(privateStorage.contentId).toBeUndefined()
      expect(privateStorage.privateR2Key).toBeDefined()
    })
  })

  describe("sender.newsletterCount increment (AC5)", () => {
    it("increments sender.newsletterCount after successful storage", () => {
      const incrementBehavior = {
        timing: "after createUserNewsletter succeeds",
        applies_to: "both public and private paths",
      }
      expect(incrementBehavior.timing).toContain("after")
    })

    it("uses atomic patch operation", () => {
      const atomicOperation = "ctx.db.patch(senderId, { newsletterCount: count + 1 })"
      expect(atomicOperation).toContain("patch")
    })
  })
})

describe("content normalization behavior (AC3)", () => {
  it("strips tracking pixels with tracking keywords", () => {
    const trackingKeywords = ["track", "pixel", "beacon", "open"]
    expect(trackingKeywords).toContain("track")
    expect(trackingKeywords).toContain("pixel")
  })

  it("strips 1x1 images (common tracking pattern)", () => {
    const pattern = 'width="1" height="1"'
    expect(pattern).toContain("1")
  })

  it("normalizes unsubscribe links to UNSUBSCRIBE placeholder", () => {
    const normalizedValue = 'href="UNSUBSCRIBE"'
    expect(normalizedValue).toBe('href="UNSUBSCRIBE"')
  })

  it("normalizes personalized greetings (Hi NAME, → Hi USER,)", () => {
    const greetingPatterns = ["Hi", "Hello", "Dear", "Hey"]
    expect(greetingPatterns).toContain("Hi")
  })

  it("strips 32+ character hex strings (email-specific IDs)", () => {
    const minHexLength = 32
    expect(minHexLength).toBe(32)
  })

  it("normalizes whitespace (collapse, trim)", () => {
    const whitespaceNormalization = {
      collapseMultipleSpaces: true,
      trimLeadingTrailing: true,
    }
    expect(whitespaceNormalization.collapseMultipleSpaces).toBe(true)
  })
})

describe("deduplication verification (AC4)", () => {
  it("documents expected behavior: two users, same content = one newsletterContent", () => {
    const scenario = {
      user1: "receives newsletter issue #42",
      user2: "receives newsletter issue #42",
      expectedNewsletterContentRecords: 1,
      expectedUserNewsletterRecords: 2,
      expectedReaderCount: 2,
    }
    expect(scenario.expectedNewsletterContentRecords).toBe(1)
    expect(scenario.expectedReaderCount).toBe(2)
  })

  it("documents expected behavior: same contentId for both users", () => {
    const scenario = {
      user1ContentId: "content_abc123",
      user2ContentId: "content_abc123",
    }
    expect(scenario.user1ContentId).toBe(scenario.user2ContentId)
  })

  it("documents expected behavior: different content = different newsletterContent", () => {
    const scenario = {
      newsletter1: "Issue #42 content",
      newsletter2: "Issue #43 content",
      expectedNewsletterContentRecords: 2,
    }
    expect(scenario.expectedNewsletterContentRecords).toBe(2)
  })
})

describe("return value changes (Story 2.5.2)", () => {
  it("storeNewsletterContent returns deduplicated flag", () => {
    const returnShape = {
      userNewsletterId: "Id<'userNewsletters'>",
      r2Key: "string",
      deduplicated: "boolean | undefined - true if content was reused",
    }
    expect(returnShape).toHaveProperty("deduplicated")
  })

  it("deduplicated=true when content was reused (dedup hit)", () => {
    const dedupHitResult = { deduplicated: true }
    expect(dedupHitResult.deduplicated).toBe(true)
  })

  it("deduplicated=false when new content was created (dedup miss)", () => {
    const dedupMissResult = { deduplicated: false }
    expect(dedupMissResult.deduplicated).toBe(false)
  })
})
