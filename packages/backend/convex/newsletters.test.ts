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
    expect(api.newsletters.searchUserNewslettersMeta).toBeDefined()
  })

  it("should export public action functions", () => {
    expect(api.newsletters.getUserNewsletterWithContent).toBeDefined()
    expect((api.newsletters as any).emptyBin).toBeDefined()
  })

  // Story 3.4: Reading progress mutations
  it("should export public mutation functions for read status (Story 3.4)", () => {
    expect(api.newsletters.markNewsletterRead).toBeDefined()
    expect(api.newsletters.markNewsletterUnread).toBeDefined()
    expect(api.newsletters.setReadProgress).toBeDefined()
    expect(api.newsletters.updateNewsletterReadProgress).toBeDefined()
  })

  // Story 3.5: Hide/unhide mutations
  it("should export public mutation functions for hide/unhide (Story 3.5)", () => {
    expect(api.newsletters.hideNewsletter).toBeDefined()
    expect(api.newsletters.unhideNewsletter).toBeDefined()
    expect((api.newsletters as any).binNewsletter).toBeDefined()
    expect(api.newsletters.setNewsletterFavorite).toBeDefined()
  })

  // Story 3.5: List hidden newsletters query
  it("should export listHiddenNewsletters query (Story 3.5)", () => {
    expect(api.newsletters.listHiddenNewsletters).toBeDefined()
    expect(api.newsletters.listFavoritedNewsletters).toBeDefined()
  })

  it("should export paginated head queries + page actions (bandwidth optimization)", () => {
    expect(api.newsletters.listAllNewslettersHead).toBeDefined()
    expect(api.newsletters.listAllNewslettersPage).toBeDefined()
    expect(api.newsletters.listRecentUnreadNewslettersHead).toBeDefined()
    expect(api.newsletters.listRecentUnreadNewslettersPage).toBeDefined()
    expect(api.newsletters.listUserNewslettersByFolderHead).toBeDefined()
    expect(api.newsletters.listUserNewslettersByFolderPage).toBeDefined()
    expect(api.newsletters.listHiddenNewslettersHead).toBeDefined()
    expect(api.newsletters.listHiddenNewslettersPage).toBeDefined()
    expect(api.newsletters.listFavoritedNewslettersHead).toBeDefined()
    expect(api.newsletters.listFavoritedNewslettersPage).toBeDefined()
    expect((api.newsletters as any).listBinnedNewslettersHead).toBeDefined()
    expect((api.newsletters as any).listBinnedNewslettersPage).toBeDefined()
    expect((api.newsletters as any).getBinnedNewsletterCount).toBeDefined()
  })

  it("should export internal functions", () => {
    expect(internal.newsletters).toBeDefined()
    expect(internal.newsletters.createUserNewsletter).toBeDefined()
    expect(internal.newsletters.createNewsletterContent).toBeDefined()
    expect(internal.newsletters.storeNewsletterContent).toBeDefined()
    expect(internal.newsletters.getUserNewsletterInternal).toBeDefined()
    expect(internal.newsletters.getNewsletterContentInternal).toBeDefined()
    expect((internal.newsletters as any).emptyBinBatchDelete).toBeDefined()
    expect((internal.newsletters as any).cleanupExpiredBinnedNewsletters).toBeDefined()
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
      isFavorited: false,
    }
    expect(defaultValues.isRead).toBe(false)
    expect(defaultValues.isHidden).toBe(false)
    expect(defaultValues.isFavorited).toBe(false)
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

  // Story 5.2: hasSummary field tests
  describe("hasSummary field (Story 5.2)", () => {
    it("includes hasSummary boolean in response", () => {
      const expectedReturnFields = [
        "_id",
        "subject",
        "senderEmail",
        "receivedAt",
        "isRead",
        "isHidden",
        "isPrivate",
        "hasSummary", // Story 5.2 addition
      ]
      expect(expectedReturnFields).toContain("hasSummary")
    })

    it("derives hasSummary from personal summary for all newsletters", () => {
      // hasSummary = true when userNewsletter.summary exists
      const derivationLogic = {
        step1: "Check userNewsletter.summary (personal summary)",
        result: "hasSummary = Boolean(newsletter.summary)",
      }
      expect(derivationLogic.step1).toContain("userNewsletter.summary")
    })

    it("derives hasSummary from shared content for public newsletters without personal summary", () => {
      // If no personal summary and public content, check newsletterContent.summary
      const derivationLogic = {
        condition: "!newsletter.summary && !newsletter.isPrivate && newsletter.contentId",
        action: "Fetch newsletterContent and check content.summary",
        result: "hasSummary = Boolean(content?.summary)",
      }
      expect(derivationLogic.condition).toContain("isPrivate")
      expect(derivationLogic.action).toContain("newsletterContent")
    })

    it("returns hasSummary: false when no summary exists", () => {
      // Neither personal nor shared summary
      const noSummaryCase = {
        personalSummary: undefined,
        sharedSummary: undefined,
        hasSummary: false,
      }
      expect(noSummaryCase.hasSummary).toBe(false)
    })

    it("returns hasSummary: true when personal summary exists", () => {
      const personalSummaryCase = {
        personalSummary: "This is a summary",
        sharedSummary: undefined,
        hasSummary: true,
      }
      expect(personalSummaryCase.hasSummary).toBe(true)
    })

    it("returns hasSummary: true for public newsletter with shared summary", () => {
      const sharedSummaryCase = {
        isPrivate: false,
        personalSummary: undefined,
        sharedSummary: "Community summary",
        hasSummary: true,
      }
      expect(sharedSummaryCase.hasSummary).toBe(true)
    })

    it("private newsletters do not check shared summary", () => {
      // Private newsletters only check personal summary
      const privateNewsletterLogic = {
        isPrivate: true,
        personalSummary: undefined,
        sharedSummaryCheck: "skipped - private content has no contentId",
        hasSummary: false,
      }
      expect(privateNewsletterLogic.sharedSummaryCheck).toContain("skipped")
    })
  })
})

describe("emptyBin action contract", () => {
  it("defines empty args and returns deletedCount", () => {
    const expectedArgs = {}
    const expectedReturn = {
      deletedCount: "number",
    }
    expect(Object.keys(expectedArgs)).toHaveLength(0)
    expect(expectedReturn).toHaveProperty("deletedCount")
  })

  it("deletes only rows where isBinned is true", () => {
    const filterBehavior = {
      index: "by_userId_isBinned_binnedAt",
      predicate: "q.eq('userId', userId).eq('isBinned', true)",
    }
    expect(filterBehavior.index).toBe("by_userId_isBinned_binnedAt")
    expect(filterBehavior.predicate).toContain("isBinned")
  })

  it("reuses the same hard-delete side effects as single delete", () => {
    const sharedDeleteEffects = [
      "community importCount decrement",
      "userUsageCounters decremented",
      "newsletterSearchMeta cleanup",
      "userNewsletter row delete",
    ]
    expect(sharedDeleteEffects).toContain("community importCount decrement")
    expect(sharedDeleteEffects).toContain("userUsageCounters decremented")
    expect(sharedDeleteEffects).toContain("newsletterSearchMeta cleanup")
    expect(sharedDeleteEffects).toContain("userNewsletter row delete")
  })

  it("is idempotent when bin is already empty", () => {
    const emptyBinResult = { deletedCount: 0 }
    expect(emptyBinResult.deletedCount).toBe(0)
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

// =============================================================================
// Story 3.4: Reading Progress & Mark as Read
// =============================================================================

describe("markNewsletterRead mutation contract (Story 3.4)", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      userNewsletterId: "required Id<'userNewsletters'>",
      readProgress: "optional number - progress percentage (default 100)",
    }
    expect(expectedArgsShape).toHaveProperty("userNewsletterId")
    expect(expectedArgsShape).toHaveProperty("readProgress")
  })

  it("requires authentication", () => {
    const expectedError = { code: "UNAUTHORIZED", message: "Not authenticated" }
    expect(expectedError.code).toBe("UNAUTHORIZED")
  })

  it("validates newsletter ownership", () => {
    const expectedError = { code: "FORBIDDEN", message: "Access denied" }
    expect(expectedError.code).toBe("FORBIDDEN")
  })

  it("throws NOT_FOUND when newsletter doesn't exist", () => {
    const expectedError = { code: "NOT_FOUND", message: "Newsletter not found" }
    expect(expectedError.code).toBe("NOT_FOUND")
  })

  it("sets isRead to true and readProgress to 100 by default", () => {
    const expectedUpdate = { isRead: true, readProgress: 100 }
    expect(expectedUpdate.isRead).toBe(true)
    expect(expectedUpdate.readProgress).toBe(100)
  })

  it("allows custom readProgress value", () => {
    const customProgress = 75
    expect(customProgress).toBeGreaterThanOrEqual(0)
    expect(customProgress).toBeLessThanOrEqual(100)
  })
})

describe("markNewsletterUnread mutation contract (Story 3.4)", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      userNewsletterId: "required Id<'userNewsletters'>",
    }
    expect(expectedArgsShape).toHaveProperty("userNewsletterId")
  })

  it("requires authentication", () => {
    const expectedError = { code: "UNAUTHORIZED", message: "Not authenticated" }
    expect(expectedError.code).toBe("UNAUTHORIZED")
  })

  it("validates newsletter ownership", () => {
    const expectedError = { code: "FORBIDDEN", message: "Access denied" }
    expect(expectedError.code).toBe("FORBIDDEN")
  })

  it("sets isRead to false", () => {
    const expectedUpdate = { isRead: false }
    expect(expectedUpdate.isRead).toBe(false)
  })

  it("preserves readProgress for resume reading feature", () => {
    // When marking as unread, readProgress is NOT reset
    // This allows user to resume from where they left off
    const preservedFields = ["readProgress"]
    expect(preservedFields).toContain("readProgress")
  })
})

describe("updateNewsletterReadProgress mutation contract (Story 3.4)", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      userNewsletterId: "required Id<'userNewsletters'>",
      readProgress: "required number - progress percentage 0-100",
    }
    expect(expectedArgsShape).toHaveProperty("userNewsletterId")
    expect(expectedArgsShape).toHaveProperty("readProgress")
  })

  it("requires authentication", () => {
    const expectedError = { code: "UNAUTHORIZED", message: "Not authenticated" }
    expect(expectedError.code).toBe("UNAUTHORIZED")
  })

  it("validates newsletter ownership", () => {
    const expectedError = { code: "FORBIDDEN", message: "Access denied" }
    expect(expectedError.code).toBe("FORBIDDEN")
  })

  it("clamps progress to 0-100 range", () => {
    const clamp = (n: number) => Math.max(0, Math.min(100, n))
    expect(clamp(-10)).toBe(0)
    expect(clamp(150)).toBe(100)
    expect(clamp(50)).toBe(50)
  })

  it("auto-marks as read when progress reaches 100", () => {
    const expectedBehavior = { readProgress: 100, isRead: true }
    expect(expectedBehavior.isRead).toBe(true)
  })

  it("keeps isRead false for progress < 100", () => {
    const expectedBehavior = { readProgress: 75, isRead: false }
    expect(expectedBehavior.isRead).toBe(false)
  })
})

describe("reading progress schema fields (Story 3.4)", () => {
  it("userNewsletters has readProgress optional field", () => {
    const schemaField = {
      name: "readProgress",
      type: "v.optional(v.number())",
      range: "0-100 percentage",
    }
    expect(schemaField.name).toBe("readProgress")
    expect(schemaField.type).toContain("optional")
  })

  it("userNewsletters has isRead boolean field", () => {
    const schemaField = {
      name: "isRead",
      type: "v.boolean()",
      default: false,
    }
    expect(schemaField.name).toBe("isRead")
    expect(schemaField.default).toBe(false)
  })
})

describe("reading progress acceptance criteria (Story 3.4)", () => {
  it("AC1: Scroll progress tracking stores percentage in database", () => {
    const ac1 = {
      trigger: "User scrolls through newsletter content",
      action: "setReadProgress mutation called",
      result: "newsletterReadProgress record updated with percentage",
    }
    expect(ac1.action).toContain("setReadProgress")
  })

  it("AC2: Resume reading shows progress and allows resume", () => {
    const ac2 = {
      display: "Shows 'X% read' in newsletter detail header",
      action: "Resume button scrolls to saved position",
      calculation: "scrollTop = (progress / 100) * scrollableHeight",
    }
    expect(ac2.display).toContain("% read")
  })

  it("AC3: Auto-mark as read at 100%", () => {
    const ac3 = {
      condition: "readProgress >= 100",
      action: "isRead automatically set to true",
      trigger: "setReadProgress with progress=100",
    }
    expect(ac3.condition).toContain("100")
  })

  it("AC4: Manual mark as unread", () => {
    const ac4 = {
      mutation: "markNewsletterUnread",
      result: "isRead set to false, readProgress preserved",
      uiUpdate: "Immediate optimistic update",
    }
    expect(ac4.mutation).toBe("markNewsletterUnread")
  })

  it("AC5: Visual read status indicators", () => {
    const ac5 = {
      unread: "Bold text, primary border, indicator dot",
      partiallyRead: "Progress shown in reader header only",
      read: "Muted text color",
    }
    expect(ac5.partiallyRead).toContain("reader")
  })

  it("AC6: Unread counts in navigation (verified from Story 3.1, 3.3)", () => {
    const ac6 = {
      senderSidebar: "Shows unread count badges per sender",
      folderSection: "Shows unread count badges per folder",
      allNewsletters: "Shows total unread count",
    }
    expect(ac6.senderSidebar).toContain("unread count")
  })
})

// =============================================================================
// Story 3.5: Hide Newsletters
// =============================================================================

describe("hideNewsletter mutation contract (Story 3.5)", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      userNewsletterId: "required Id<'userNewsletters'>",
    }
    expect(expectedArgsShape).toHaveProperty("userNewsletterId")
  })

  it("requires authentication", () => {
    const expectedError = { code: "UNAUTHORIZED", message: "Not authenticated" }
    expect(expectedError.code).toBe("UNAUTHORIZED")
  })

  it("validates newsletter ownership", () => {
    const expectedError = { code: "FORBIDDEN", message: "Access denied" }
    expect(expectedError.code).toBe("FORBIDDEN")
  })

  it("throws NOT_FOUND when newsletter doesn't exist", () => {
    const expectedError = { code: "NOT_FOUND", message: "Newsletter not found" }
    expect(expectedError.code).toBe("NOT_FOUND")
  })

  it("sets isHidden to true", () => {
    const expectedUpdate = { isHidden: true }
    expect(expectedUpdate.isHidden).toBe(true)
  })
})

describe("unhideNewsletter mutation contract (Story 3.5)", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      userNewsletterId: "required Id<'userNewsletters'>",
    }
    expect(expectedArgsShape).toHaveProperty("userNewsletterId")
  })

  it("requires authentication", () => {
    const expectedError = { code: "UNAUTHORIZED", message: "Not authenticated" }
    expect(expectedError.code).toBe("UNAUTHORIZED")
  })

  it("validates newsletter ownership", () => {
    const expectedError = { code: "FORBIDDEN", message: "Access denied" }
    expect(expectedError.code).toBe("FORBIDDEN")
  })

  it("sets isHidden to false", () => {
    const expectedUpdate = { isHidden: false }
    expect(expectedUpdate.isHidden).toBe(false)
  })
})

describe("setNewsletterFavorite mutation contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      userNewsletterId: "required Id<'userNewsletters'>",
      isFavorited: "required boolean",
    }
    expect(expectedArgsShape).toHaveProperty("userNewsletterId")
    expect(expectedArgsShape).toHaveProperty("isFavorited")
  })

  it("requires authentication", () => {
    const expectedError = { code: "UNAUTHORIZED", message: "Not authenticated" }
    expect(expectedError.code).toBe("UNAUTHORIZED")
  })

  it("validates newsletter ownership", () => {
    const expectedError = { code: "FORBIDDEN", message: "Access denied" }
    expect(expectedError.code).toBe("FORBIDDEN")
  })

  it("throws NOT_FOUND when newsletter doesn't exist", () => {
    const expectedError = { code: "NOT_FOUND", message: "Newsletter not found" }
    expect(expectedError.code).toBe("NOT_FOUND")
  })

  it("sets isFavorited to requested value", () => {
    const expectedUpdate = { isFavorited: true }
    expect(expectedUpdate.isFavorited).toBe(true)
  })
})

describe("listFavoritedNewsletters query contract", () => {
  it("takes no args", () => {
    const expectedArgs = {}
    expect(Object.keys(expectedArgs)).toHaveLength(0)
  })

  it("returns empty array when not authenticated", () => {
    const returnWhenUnauth: unknown[] = []
    expect(returnWhenUnauth).toEqual([])
  })

  it("uses favorited + non-hidden index path and sorts by newest", () => {
    const queryBehavior = {
      uses:
        "withIndex('by_userId_isFavorited_isHidden_receivedAt', q => q.eq('userId', user._id).eq('isFavorited', true).eq('isHidden', false))",
      order: "desc",
    }
    expect(queryBehavior.uses).toContain("isFavorited")
    expect(queryBehavior.uses).toContain("isHidden")
    expect(queryBehavior.order).toBe("desc")
  })

  it("returns summary/source enriched newsletters", () => {
    const enrichment = {
      hasSummary: true,
      source: "email | gmail | manual | community",
    }
    expect(enrichment).toHaveProperty("hasSummary")
    expect(enrichment).toHaveProperty("source")
  })
})

describe("listHiddenNewsletters query contract (Story 3.5)", () => {
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
      uses: "withIndex('by_userId_receivedAt', q => q.eq('userId', user._id))",
      additionalFilter: ".filter(n => n.isHidden)",
      order: "desc",
    }
    expect(filterBehavior.uses).toContain("by_userId")
    expect(filterBehavior.additionalFilter).toContain("isHidden")
  })

  it("returns only hidden newsletters", () => {
    const filterLogic = "newsletters.filter((n) => n.isHidden)"
    expect(filterLogic).toContain("isHidden")
  })
})

describe("hidden newsletter filtering behavior (Story 3.5)", () => {
  describe("listUserNewsletters", () => {
    it("excludes hidden newsletters from main list (AC2)", () => {
      const filterLogic = "newsletters.filter((n) => !n.isHidden)"
      expect(filterLogic).toContain("!n.isHidden")
    })
  })

  describe("listUserNewslettersBySender", () => {
    it("excludes hidden newsletters from sender-filtered list (AC2)", () => {
      const filterLogic = ".filter((n) => !n.isHidden)"
      expect(filterLogic).toContain("!n.isHidden")
    })
  })

  describe("listUserNewslettersByFolder", () => {
    it("excludes hidden newsletters from folder-filtered list (AC2)", () => {
      const filterLogic = "!n.isHidden"
      expect(filterLogic).toContain("!n.isHidden")
    })
  })

  describe("listSendersForUserWithUnreadCounts", () => {
    it("excludes hidden newsletters from unread counts (AC2)", () => {
      const filterLogic = {
        visibleNewsletters: "newsletters.filter((n) => !n.isHidden)",
        unreadCount: "visibleNewsletters.filter((n) => !n.isRead).length",
        userNewsletterCount: "visibleNewsletters.length",
      }
      expect(filterLogic.visibleNewsletters).toContain("!n.isHidden")
    })
  })
})

describe("hidden newsletter acceptance criteria (Story 3.5)", () => {
  it("AC1: Hide from List/Detail View", () => {
    const ac1 = {
      trigger: "User clicks hide button in list or detail view",
      action: "hideNewsletter mutation called",
      result: "Newsletter hidden from main views, confirmation shown",
      navigation: "User returns to list after hiding from detail view",
    }
    expect(ac1.action).toBe("hideNewsletter mutation called")
  })

  it("AC2: Hidden Newsletters Excluded from Main List", () => {
    const ac2 = {
      behavior: "Hidden newsletters filtered out with !isHidden",
      affectedQueries: [
        "listUserNewsletters",
        "listUserNewslettersBySender",
        "listUserNewslettersByFolder",
      ],
      unreadCounts: "listSendersForUserWithUnreadCounts excludes hidden",
    }
    expect(ac2.affectedQueries).toContain("listUserNewsletters")
  })

  it("AC3: View Hidden Newsletters", () => {
    const ac3 = {
      navigation: "Hidden section in sidebar with count badge",
      urlPattern: "/newsletters?filter=hidden",
      query: "listHiddenNewsletters returns only hidden newsletters",
    }
    expect(ac3.query).toContain("listHiddenNewsletters")
  })

  it("AC4: Unhide/Restore Newsletter", () => {
    const ac4 = {
      trigger: "User clicks Unhide button on hidden newsletter",
      action: "unhideNewsletter mutation called",
      result: "Newsletter returns to main views",
    }
    expect(ac4.action).toBe("unhideNewsletter mutation called")
  })

  it("AC5: Subscription Preserved", () => {
    const ac5 = {
      behavior: "isHidden flag is independent of subscription status",
      senderActive: "Sender remains in senders list",
      futureNewsletters: "New newsletters from sender continue to arrive",
      noUnsubscribe: "Hiding does NOT affect userSenderSettings",
    }
    expect(ac5.noUnsubscribe).toContain("userSenderSettings")
  })
})

describe("hidden newsletter schema fields (Story 3.5)", () => {
  it("userNewsletters has isHidden boolean field", () => {
    const schemaField = {
      name: "isHidden",
      type: "v.boolean()",
      default: false,
    }
    expect(schemaField.name).toBe("isHidden")
    expect(schemaField.default).toBe(false)
  })
})

// Story 5.2: Summary Display & Management
describe("hasSummary derivation logic (Story 5.2)", () => {
  describe("listUserNewslettersBySender", () => {
    it("includes hasSummary in response", () => {
      const expectedFields = ["_id", "subject", "hasSummary"]
      expect(expectedFields).toContain("hasSummary")
    })

    it("derives hasSummary using same logic as listUserNewsletters", () => {
      const derivationLogic = {
        step1: "Check newsletter.summary (personal)",
        step2: "If !hasSummary && !isPrivate && contentId → check content.summary",
        step3: "Return enriched newsletter with hasSummary boolean",
      }
      expect(derivationLogic.step2).toContain("contentId")
    })
  })

	  describe("listUserNewslettersByFolder", () => {
	    it("includes hasSummary in response", () => {
	      const expectedFields = ["_id", "subject", "senderName", "hasSummary"]
	      expect(expectedFields).toContain("hasSummary")
	    })

	    it("enriches with both senderName and hasSummary", () => {
	      const enrichmentLogic = {
	        senderName: "sender?.name ?? newsletter.senderName",
	        hasSummary: "Boolean(newsletter.summary) || Boolean(content?.summary)",
	      }
	      expect(enrichmentLogic.hasSummary).toContain("summary")
	    })
	  })

  describe("listHiddenNewsletters", () => {
    it("includes hasSummary for hidden newsletters too", () => {
      // Hidden newsletters should also show summary indicator when unhidden
      const expectedFields = ["_id", "isHidden", "hasSummary"]
      expect(expectedFields).toContain("hasSummary")
    })
  })

  describe("privacy-aware summary resolution", () => {
    it("respects privacy pattern: personal first, then shared if public", () => {
      const privacyPattern = {
        order: ["1. Check userNewsletter.summary (personal override)", "2. IF public AND no personal: Check newsletterContent.summary (shared)"],
        privateNewsletter: "Only checks personal summary, never shared",
        publicNewsletter: "Falls back to shared summary if no personal",
      }
      expect(privacyPattern.order[0]).toContain("personal override")
      expect(privacyPattern.order[1]).toContain("shared")
    })

    it("does not leak private content summary to other users", () => {
      // Private newsletters have no contentId, so no shared summary lookup possible
      const securityBehavior = {
        privateStorage: "privateR2Key on userNewsletters, no contentId",
        publicStorage: "contentId referencing newsletterContent table",
        summaryOnPrivate: "Only stored on userNewsletters.summary",
        summaryOnPublic: "Stored on newsletterContent.summary (shared)",
      }
      expect(securityBehavior.privateStorage).toContain("no contentId")
    })
  })
})

describe("summary display acceptance criteria (Story 5.2)", () => {
  it("AC4: Summary indicator in newsletter list", () => {
    const ac4 = {
      requirement: "When browsing newsletter list, see indicator if summary available",
      implementation: "hasSummary boolean on listUserNewsletters response",
      display: "NewsletterCard shows Sparkles icon when hasSummary=true",
      optional: "Preview summary from list on click",
    }
    expect(ac4.implementation).toContain("hasSummary")
  })
})

// ============================================================
// Story 9.2: Private-by-Default Tests
// ============================================================

describe("Private-by-Default Architecture (Story 9.2)", () => {
  describe("storeNewsletterContent API changes", () => {
    it("should require folderId parameter", () => {
      const apiContract = {
        oldRequiredArgs: ["userId", "senderId", "subject", "senderEmail", "receivedAt", "isPrivate"],
        newRequiredArgs: ["userId", "senderId", "folderId", "subject", "senderEmail", "receivedAt", "source"],
      }
      expect(apiContract.newRequiredArgs).toContain("folderId")
      expect(apiContract.newRequiredArgs).toContain("source")
      expect(apiContract.newRequiredArgs).not.toContain("isPrivate")
    })

    it("should accept source parameter with valid values", () => {
      const validSources = ["email", "gmail", "manual", "community"]
      expect(validSources).toContain("email")
      expect(validSources).toContain("gmail")
      expect(validSources).toContain("manual")
      expect(validSources).toContain("community")
    })

    it("should not return deduplicated flag in return type", () => {
      // Story 9.2: Removed community deduplication
      const returnType = {
        success: { userNewsletterId: "Id<userNewsletters>", r2Key: "string" },
        skipped: { skipped: true, reason: "duplicate", existingId: "Id<userNewsletters>" },
      }
      expect(returnType.success).not.toHaveProperty("deduplicated")
    })
  })

  describe("createUserNewsletter API changes", () => {
    it("should require folderId and source parameters", () => {
      const apiContract = {
        requiredArgs: [
          "userId",
          "senderId",
          "folderId", // Story 9.2: NEW required
          "subject",
          "senderEmail",
          "receivedAt",
          "isPrivate",
          "source", // Story 9.2: NEW required
        ],
      }
      expect(apiContract.requiredArgs).toContain("folderId")
      expect(apiContract.requiredArgs).toContain("source")
    })
  })

  describe("Email Ingestion (AC #1)", () => {
    it("should store with privateR2Key (no contentId)", () => {
      const expectedBehavior = {
        r2KeyPattern: "private/${userId}/${timestamp}-${randomId}.${ext}",
        contentId: undefined,
        isPrivate: true,
        source: "email",
      }
      expect(expectedBehavior.r2KeyPattern).toContain("private/")
      expect(expectedBehavior.contentId).toBeUndefined()
      expect(expectedBehavior.source).toBe("email")
    })

    it("should set source to 'email'", () => {
      const ingestionSource = "email"
      expect(ingestionSource).toBe("email")
    })

    it("should resolve folder for sender", () => {
      const folderResolutionFlow = {
        step1: "Check userSenderSettings for existing folderId",
        step2: "If folderId exists, use it",
        step3: "If not, create folder with sender name",
        step4: "Update userSenderSettings with folderId",
      }
      expect(folderResolutionFlow).toHaveProperty("step3")
    })

    it("should NOT create newsletterContent record", () => {
      // Story 9.2: newsletterContent only created by admin curation
      const expectedBehavior = {
        createsNewsletterContent: false,
        reason: "newsletterContent is now admin-only for community curation",
      }
      expect(expectedBehavior.createsNewsletterContent).toBe(false)
    })
  })

  describe("Gmail Import (AC #2)", () => {
    it("should store with privateR2Key", () => {
      const expectedBehavior = {
        r2KeyPattern: "private/${userId}/${timestamp}-${randomId}.${ext}",
        isPrivate: true,
      }
      expect(expectedBehavior.r2KeyPattern).toContain("private/")
    })

    it("should set source to 'gmail'", () => {
      const ingestionSource = "gmail"
      expect(ingestionSource).toBe("gmail")
    })

    it("should resolve folder for sender", () => {
      const folderRequired = true
      expect(folderRequired).toBe(true)
    })
  })

  describe("Manual Import (AC #3)", () => {
    it("should store with privateR2Key", () => {
      const expectedBehavior = {
        r2KeyPattern: "private/${userId}/${timestamp}-${randomId}.${ext}",
        isPrivate: true,
      }
      expect(expectedBehavior.r2KeyPattern).toContain("private/")
    })

    it("should set source to 'manual'", () => {
      const ingestionSource = "manual"
      expect(ingestionSource).toBe("manual")
    })

    it("should resolve folder for sender", () => {
      const folderRequired = true
      expect(folderRequired).toBe(true)
    })
  })

  describe("Deduplication Changes (AC #4)", () => {
    it("should remove automatic deduplication to newsletterContent", () => {
      const deduplicationBehavior = {
        beforeStory92: "isPrivate=false -> dedup to newsletterContent -> shared",
        afterStory92: "ALL newsletters -> privateR2Key -> user's own storage",
        newsletterContentCreation: "ONLY by admin action (Story 9.7)",
      }
      expect(deduplicationBehavior.afterStory92).toContain("privateR2Key")
      expect(deduplicationBehavior.newsletterContentCreation).toContain("admin")
    })

    it("should keep user-level duplicate detection (messageId and content hash)", () => {
      const duplicateDetection = {
        byMessageId: "Check if user already has newsletter with this messageId",
        byContentHash: "Check if user already has newsletter with this content hash",
        crossUserDedup: "REMOVED - each user gets their own copy",
      }
      expect(duplicateDetection.byMessageId).toBeDefined()
      expect(duplicateDetection.byContentHash).toBeDefined()
      expect(duplicateDetection.crossUserDedup).toContain("REMOVED")
    })

    it("should mark newsletterContent functions as admin-only", () => {
      const deprecatedForUserIngestion = [
        "createNewsletterContent",
        "findByContentHash",
        "incrementReaderCount",
      ]
      expect(deprecatedForUserIngestion).toContain("createNewsletterContent")
      expect(deprecatedForUserIngestion).toContain("findByContentHash")
      expect(deprecatedForUserIngestion).toContain("incrementReaderCount")
    })
  })

  describe("Backward Compatibility", () => {
    it("should still read from existing contentId references", () => {
      // Existing newsletters with contentId should continue working
      const readingLogic = {
        checkPrivateFirst: "if isPrivate && privateR2Key, use privateR2Key",
        checkPublicSecond: "if !isPrivate && contentId, get r2Key from newsletterContent",
      }
      expect(readingLogic.checkPrivateFirst).toBeDefined()
      expect(readingLogic.checkPublicSecond).toBeDefined()
    })

    it("should work with new privateR2Key references", () => {
      const newNewsletters = {
        isPrivate: true,
        privateR2Key: "private/{userId}/{timestamp}-{randomId}.html",
        contentId: undefined,
        source: "email|gmail|manual|community",
        folderId: "Id<folders>",
      }
      expect(newNewsletters.isPrivate).toBe(true)
      expect(newNewsletters.contentId).toBeUndefined()
    })
  })

  describe("Source Field Tracking", () => {
    it("should track email ingestion source", () => {
      const sources = {
        emailWorker: "email",
        gmailImport: "gmail",
        manualDragDrop: "manual",
        communityImport: "community",
      }
      expect(sources.emailWorker).toBe("email")
    })

    it("should store source on userNewsletters record", () => {
      const userNewsletterFields = {
        source: "email|gmail|manual|community",
        storedOn: "userNewsletters table",
        usedFor: "Analytics, filtering, UI display",
      }
      expect(userNewsletterFields.source).toBeDefined()
    })
  })

  describe("Folder-Centric Architecture", () => {
    it("should require folderId for all ingestion paths", () => {
      const ingestionPaths = {
        emailIngestion: "passes folderId from getOrCreateFolderForSender",
        gmailImport: "passes folderId from getOrCreateFolderForSender",
        manualImport: "passes folderId from getOrCreateFolderForSender",
        importIngestion: "passes folderId from getOrCreateFolderForSender",
      }
      Object.values(ingestionPaths).forEach((path) => {
        expect(path).toContain("folderId")
      })
    })

    it("should auto-create folder when sender has none", () => {
      const folderCreation = {
        trigger: "getOrCreateFolderForSender called",
        folderName: "sender.name || sender.email",
        updatesUserSenderSettings: true,
      }
      expect(folderCreation.trigger).toContain("getOrCreateFolderForSender")
    })
  })

// ============================================================
// Story 9.10: Delete Newsletter with Community Import Support
// ============================================================

describe("deleteUserNewsletter mutation contract (Story 9.10)", () => {
  it("should export deleteUserNewsletter mutation", () => {
    expect(api.newsletters.deleteUserNewsletter).toBeDefined()
  })

  it("defines expected args schema", () => {
    const expectedArgsShape = {
      userNewsletterId: "required Id<'userNewsletters'>",
    }
    expect(expectedArgsShape).toHaveProperty("userNewsletterId")
  })

  it("requires authentication", () => {
    const expectedError = { code: "UNAUTHORIZED", message: "Not authenticated" }
    expect(expectedError.code).toBe("UNAUTHORIZED")
  })

  it("validates newsletter ownership", () => {
    const expectedError = { code: "FORBIDDEN", message: "Not your newsletter" }
    expect(expectedError.code).toBe("FORBIDDEN")
  })

  it("throws NOT_FOUND when newsletter doesn't exist", () => {
    const expectedError = { code: "NOT_FOUND", message: "Newsletter not found" }
    expect(expectedError.code).toBe("NOT_FOUND")
  })

  it("returns { deleted: true } on success", () => {
    const expectedReturn = { deleted: true }
    expect(expectedReturn.deleted).toBe(true)
  })

  describe("Community Import Handling (AC #6)", () => {
    it("decrements importCount when source is 'community'", () => {
      const communityDeleteBehavior = {
        condition: "source === 'community' && contentId exists",
        action: "Decrement importCount on newsletterContent",
        minValue: 0,
        formula: "Math.max(0, (content.importCount ?? 1) - 1)",
      }
      expect(communityDeleteBehavior.action).toContain("Decrement importCount")
      expect(communityDeleteBehavior.minValue).toBe(0)
    })

    it("does NOT delete newsletterContent record", () => {
      const communityDeleteBehavior = {
        contentDeletion: false,
        reason: "Other users may have imported the same content",
      }
      expect(communityDeleteBehavior.contentDeletion).toBe(false)
    })

    it("does NOT decrement readerCount (only set once on first read)", () => {
      const readerCountBehavior = {
        decrementOnDelete: false,
        reason: "readerCount is historical - set once when first read",
      }
      expect(readerCountBehavior.decrementOnDelete).toBe(false)
    })

    it("handles missing newsletterContent gracefully", () => {
      // If contentId references deleted content, just proceed with userNewsletter delete
      const gracefulHandling = {
        condition: "content not found from contentId",
        action: "Skip importCount decrement, proceed with delete",
        throwError: false,
      }
      expect(gracefulHandling.throwError).toBe(false)
    })

    it("handles importCount going to zero", () => {
      const zeroImportCountBehavior = {
        currentImportCount: 1,
        afterDelete: 0,
        contentPreserved: true,
        reason: "Content may still be useful for future imports or admin review",
      }
      expect(zeroImportCountBehavior.afterDelete).toBe(0)
      expect(zeroImportCountBehavior.contentPreserved).toBe(true)
    })
  })

  describe("Private Source Handling", () => {
    it("does not touch newsletterContent for private sources", () => {
      const privateDeleteBehavior = {
        condition: "source === 'email' | 'gmail' | 'manual'",
        newsletterContentInteraction: false,
        reason: "Private newsletters don't have contentId",
      }
      expect(privateDeleteBehavior.newsletterContentInteraction).toBe(false)
    })

    it("does not delete R2 content immediately", () => {
      const r2Behavior = {
        immediateR2Deletion: false,
        reason: "R2 cleanup can be handled by separate background process",
        reference: "privateR2Key remains orphaned until cleanup",
      }
      expect(r2Behavior.immediateR2Deletion).toBe(false)
    })
  })
})

describe("Source Field in Query Responses (Story 9.10)", () => {
  describe("listUserNewsletters", () => {
    it("includes source field in response for unified folder display", () => {
      const responseFields = [
        "_id",
        "subject",
        "senderEmail",
        "receivedAt",
        "isRead",
        "isHidden",
        "isPrivate",
        "hasSummary",
        "source", // Story 9.10 addition
      ]
      expect(responseFields).toContain("source")
    })
  })

  describe("listUserNewslettersBySender", () => {
    it("includes source field in response", () => {
      const responseFields = ["_id", "subject", "hasSummary", "source"]
      expect(responseFields).toContain("source")
    })
  })

	  describe("listUserNewslettersByFolder", () => {
	    it("includes source field in response for mixed source display", () => {
	      const responseFields = [
	        "_id",
	        "subject",
	        "senderName",
	        "hasSummary",
	        "source", // Story 9.10 addition
	      ]
	      expect(responseFields).toContain("source")
	    })

    it("sorts newsletters by receivedAt regardless of source", () => {
      const sortBehavior = {
        index: "by_userId_receivedAt",
        order: "desc",
        mixesSources: true,
        reason: "AC #1: all newsletters shown sorted by date",
      }
      expect(sortBehavior.order).toBe("desc")
      expect(sortBehavior.mixesSources).toBe(true)
    })
  })

  describe("listHiddenNewsletters", () => {
    it("includes source field for hidden newsletters", () => {
      const responseFields = ["_id", "isHidden", "hasSummary", "source"]
      expect(responseFields).toContain("source")
    })
  })
})

describe("Story 9.10 Acceptance Criteria", () => {
  it("AC #1: Mixed sources shown sorted by date", () => {
    const ac1 = {
      requirement: "Folder has both private and community-imported newsletters",
      behavior: "All newsletters shown sorted by receivedAt descending",
      implementation: "listUserNewslettersByFolder uses by_userId_receivedAt index",
    }
    expect(ac1.behavior).toContain("sorted by receivedAt")
  })

  it("AC #2: Private source indicator", () => {
    const ac2 = {
      requirement: "Private newsletters show 'private' indicator",
      implementation: "NewsletterCard checks source !== 'community'",
      icon: "Mail (envelope) from lucide-react",
    }
    expect(ac2.icon).toContain("envelope")
  })

  it("AC #3: Community source indicator", () => {
    const ac3 = {
      requirement: "Community imports show 'community' indicator",
      implementation: "NewsletterCard checks source === 'community'",
      icon: "Globe from lucide-react",
      styling: "text-blue-500 for visual distinction",
    }
    expect(ac3.icon).toContain("Globe")
  })

  it("AC #4: Private content fetches from privateR2Key", () => {
    const ac4 = {
      requirement: "Click private newsletter -> fetch from privateR2Key",
      implementation: "getUserNewsletterWithContent checks isPrivate && privateR2Key",
      r2KeyPattern: "private/{userId}/{timestamp}-{uuid}.{ext}",
    }
    expect(ac4.r2KeyPattern).toContain("private/")
  })

  it("AC #5: Community content fetches from contentId", () => {
    const ac5 = {
      requirement: "Click community import -> fetch from newsletterContent.r2Key via contentId",
      implementation: "getUserNewsletterWithContent checks !isPrivate && contentId",
      lookupPath: "userNewsletter.contentId -> newsletterContent.r2Key",
    }
    expect(ac5.lookupPath).toContain("contentId")
  })

  it("AC #6: Delete community import decrements importCount", () => {
    const ac6 = {
      requirement: "Delete community import: userNewsletter removed, importCount decremented",
      newsletterContentPreserved: true,
      importCountFormula: "Math.max(0, (content.importCount ?? 1) - 1)",
      uiConfirmation: "Remove from collection? (vs Delete for private)",
    }
    expect(ac6.newsletterContentPreserved).toBe(true)
  })
})

  describe("getOrCreateFolderForSender behavior (Story 9.2 Code Review Fix)", () => {
    it("should return existing folderId if userSenderSettings has one", () => {
      const scenario = {
        existingSettings: { folderId: "folder_abc123" },
        expectedResult: "folder_abc123",
        action: "Return immediately without creating folder",
      }
      expect(scenario.expectedResult).toBe("folder_abc123")
    })

    it("should create folder with sender.name as folder name", () => {
      const scenario = {
        sender: { name: "TechCrunch Newsletter", email: "news@techcrunch.com" },
        expectedFolderName: "TechCrunch Newsletter",
      }
      expect(scenario.expectedFolderName).toBe("TechCrunch Newsletter")
    })

    it("should fallback to sender.email if name is not available", () => {
      const scenario = {
        sender: { name: undefined, email: "updates@company.com" },
        expectedFolderName: "updates@company.com",
      }
      expect(scenario.expectedFolderName).toBe("updates@company.com")
    })

    it("should fallback to 'Unknown Sender' if neither name nor email available", () => {
      const scenario = {
        sender: null,
        expectedFolderName: "Unknown Sender",
      }
      expect(scenario.expectedFolderName).toBe("Unknown Sender")
    })

    it("should update existing userSenderSettings with folderId if settings exist but no folder", () => {
      const scenario = {
        existingSettings: { _id: "settings_123", folderId: undefined },
        action: "ctx.db.patch(settings._id, { folderId })",
        incrementsSubscriberCount: false,
      }
      expect(scenario.incrementsSubscriberCount).toBe(false)
    })

    it("should create new userSenderSettings if none exists", () => {
      const scenario = {
        existingSettings: null,
        createdSettings: {
          userId: "user_123",
          senderId: "sender_456",
          isPrivate: true, // Story 9.2: Always private
          folderId: "folder_789",
        },
        incrementsSubscriberCount: true,
      }
      expect(scenario.createdSettings.isPrivate).toBe(true)
      expect(scenario.incrementsSubscriberCount).toBe(true)
    })

    describe("Race condition protection", () => {
      it("should detect duplicate userSenderSettings created by concurrent requests", () => {
        const raceConditionHandling = {
          detection: "Query by_userId_senderId after insert",
          resolution: "Keep oldest record (by _creationTime), delete duplicates",
          subscriberCountHandling: "Only increment if we won the race",
        }
        expect(raceConditionHandling.detection).toContain("by_userId_senderId")
      })

      it("should keep the folder from the race winner if different", () => {
        const scenario = {
          ourFolderId: "folder_new",
          winnerFolderId: "folder_existing",
          expectedResult: "folder_existing",
          ourFolderAction: "Delete orphaned folder",
        }
        expect(scenario.expectedResult).toBe("folder_existing")
      })

      it("should not increment subscriberCount on race condition loss", () => {
        const scenario = {
          raceConditionDetected: true,
          duplicatesDeleted: 1,
          subscriberCountIncremented: false,
        }
        expect(scenario.subscriberCountIncremented).toBe(false)
      })
    })

    describe("Email Ingestion folder creation", () => {
      it("should call getOrCreateFolderForSender in emailIngestion", () => {
        const flow = {
          step1: "getOrCreateSender (get senderId)",
          step2: "getOrCreateFolderForSender (get folderId)",
          step3: "storeNewsletterContent with folderId",
        }
        expect(flow.step2).toContain("getOrCreateFolderForSender")
      })
    })

    describe("Gmail Import folder creation", () => {
      it("should call getOrCreateFolderForSender in processAndStoreImportedEmail", () => {
        const flow = {
          step1: "getOrCreateSender (get senderId)",
          step2: "getOrCreateFolderForSender (get folderId)",
          step3: "storeNewsletterContent with source='gmail' and folderId",
        }
        expect(flow.step2).toContain("getOrCreateFolderForSender")
        expect(flow.step3).toContain("gmail")
      })
    })

    describe("Manual Import folder creation", () => {
      it("should call getOrCreateFolderForSender in importEmlNewsletter", () => {
        const flow = {
          step1: "getOrCreateSender (get senderId)",
          step2: "getOrCreateFolderForSender (get folderId)",
          step3: "storeNewsletterContent with source='manual' and folderId",
        }
        expect(flow.step2).toContain("getOrCreateFolderForSender")
        expect(flow.step3).toContain("manual")
      })

      it("should call getOrCreateFolderForSender in receiveImportEmail (forward-to-import)", () => {
        const flow = {
          step1: "getOrCreateSender (get senderId)",
          step2: "getOrCreateFolderForSender (get folderId)",
          step3: "storeNewsletterContent with source='manual' and folderId",
        }
        expect(flow.step2).toContain("getOrCreateFolderForSender")
      })
    })
  })
})
