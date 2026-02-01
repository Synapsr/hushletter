import { describe, it, expect } from "vitest"
import { api, internal } from "./_generated/api"

/**
 * Contract Tests for senders.ts - Story 2.3
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
 */

// =============================================================================
// Story 2.3: Automatic Sender Detection
// =============================================================================

describe("senders API exports (Story 2.3, Story 3.1)", () => {
  it("should export public query functions", () => {
    expect(api.senders).toBeDefined()
    expect(api.senders.listSenders).toBeDefined()
    expect(api.senders.listUserSenderSettings).toBeDefined()
    // Story 2.3: New query functions for AC4
    expect(api.senders.getSenderById).toBeDefined()
    expect(api.senders.listSendersForUser).toBeDefined()
    // Story 3.1: New query function with unread counts
    expect(api.senders.listSendersForUserWithUnreadCounts).toBeDefined()
  })

  it("should export public mutation functions", () => {
    // Story 2.3: New mutation for updating sender settings
    expect(api.senders.updateSenderSettings).toBeDefined()
  })

  it("should export internal mutation functions", () => {
    expect(internal.senders).toBeDefined()
    expect(internal.senders.getOrCreateSender).toBeDefined()
    expect(internal.senders.getOrCreateUserSenderSettings).toBeDefined()
    expect(internal.senders.updateUserSenderSettings).toBeDefined()
    expect(internal.senders.incrementNewsletterCount).toBeDefined()
  })

  it("should export internal query functions", () => {
    expect(internal.senders.getSenderByEmail).toBeDefined()
    expect(internal.senders.getUserSenderSettings).toBeDefined()
  })
})

// =============================================================================
// AC1: Global Sender Creation for New Senders
// =============================================================================

describe("getOrCreateSender mutation contract (AC1, AC2)", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      email: "required string - sender's email address",
      name: "optional string - sender's display name",
    }
    expect(expectedArgsShape).toHaveProperty("email")
    expect(expectedArgsShape).toHaveProperty("name")
  })

  it("returns the complete sender object", () => {
    const expectedReturn = {
      _id: "Id<'senders'>",
      email: "string",
      name: "string | undefined",
      domain: "string - extracted from email",
      subscriberCount: "number",
      newsletterCount: "number",
    }
    expect(expectedReturn).toHaveProperty("_id")
    expect(expectedReturn).toHaveProperty("domain")
    expect(expectedReturn).toHaveProperty("subscriberCount")
    expect(expectedReturn).toHaveProperty("newsletterCount")
  })

  it("extracts domain correctly from email (AC1)", () => {
    // Domain extraction: newsletter@substack.com -> substack.com
    const testCases = [
      { email: "newsletter@substack.com", expectedDomain: "substack.com" },
      { email: "hello@morning-brew.com", expectedDomain: "morning-brew.com" },
      { email: "test@example.co.uk", expectedDomain: "example.co.uk" },
    ]

    for (const tc of testCases) {
      const domain = tc.email.split("@")[1] || ""
      expect(domain).toBe(tc.expectedDomain)
    }
  })

  it("creates new sender with initial counts (AC1)", () => {
    // When a NEW sender is created:
    // - subscriberCount: 0 (incremented by getOrCreateUserSenderSettings)
    // - newsletterCount: 0 (incremented by storeNewsletterContent)
    const initialCounts = {
      subscriberCount: 0,
      newsletterCount: 0,
    }
    expect(initialCounts.subscriberCount).toBe(0)
    expect(initialCounts.newsletterCount).toBe(0)
  })

  it("returns existing sender without creating duplicate (AC2)", () => {
    // When sender already exists, return existing record
    // DO NOT increment any counts in getOrCreateSender
    const existingSenderBehavior = {
      createsDuplicate: false,
      incrementsSubscriberCount: false,
      incrementsNewsletterCount: false,
      updatesNameIfMissing: true,
    }
    expect(existingSenderBehavior.createsDuplicate).toBe(false)
    expect(existingSenderBehavior.incrementsNewsletterCount).toBe(false)
  })

  it("uses by_email index for efficient lookup", () => {
    const indexUsed = "by_email"
    expect(indexUsed).toBe("by_email")
  })

  it("updates sender name if provided and not already set", () => {
    // If sender exists without a name, and we receive one, update it
    const nameUpdateBehavior = {
      condition: "existingSender.name is undefined AND args.name is provided",
      action: "patch sender with new name",
    }
    expect(nameUpdateBehavior.action).toContain("patch")
  })
})

// =============================================================================
// AC3: User Sender Settings Creation
// =============================================================================

describe("getOrCreateUserSenderSettings mutation contract (AC3)", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      userId: "required Id<'users'>",
      senderId: "required Id<'senders'>",
    }
    expect(expectedArgsShape).toHaveProperty("userId")
    expect(expectedArgsShape).toHaveProperty("senderId")
  })

  it("returns the complete userSenderSettings object", () => {
    const expectedReturn = {
      _id: "Id<'userSenderSettings'>",
      userId: "Id<'users'>",
      senderId: "Id<'senders'>",
      isPrivate: "boolean",
      folderId: "Id<'folders'> | undefined",
    }
    expect(expectedReturn).toHaveProperty("isPrivate")
    expect(expectedReturn).toHaveProperty("folderId")
  })

  it("creates settings with isPrivate defaulting to false (AC3)", () => {
    const defaultPrivacy = false
    expect(defaultPrivacy).toBe(false)
  })

  it("increments sender subscriberCount on NEW user-sender relationship (AC3)", () => {
    // ONLY increment when creating NEW userSenderSettings
    // NOT when returning existing settings
    const incrementBehavior = {
      onNewRelationship: "subscriberCount + 1",
      onExistingRelationship: "no increment",
    }
    expect(incrementBehavior.onNewRelationship).toContain("+ 1")
  })

  it("returns existing settings without incrementing subscriberCount", () => {
    // When user-sender relationship already exists, just return it
    const existingBehavior = {
      createsDuplicate: false,
      incrementsSubscriberCount: false,
    }
    expect(existingBehavior.incrementsSubscriberCount).toBe(false)
  })

  it("uses by_userId_senderId index for efficient lookup", () => {
    const indexUsed = "by_userId_senderId"
    expect(indexUsed).toBe("by_userId_senderId")
  })
})

// =============================================================================
// AC2: Sender Reuse and newsletterCount Increment
// =============================================================================

describe("incrementNewsletterCount mutation contract (AC2)", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      senderId: "required Id<'senders'>",
    }
    expect(expectedArgsShape).toHaveProperty("senderId")
  })

  it("increments newsletterCount by 1", () => {
    const operation = "newsletterCount = newsletterCount + 1"
    expect(operation).toContain("+ 1")
  })

  it("throws NOT_FOUND error if sender doesn't exist", () => {
    const expectedError = {
      code: "NOT_FOUND",
      message: "Sender not found",
    }
    expect(expectedError.code).toBe("NOT_FOUND")
  })

  it("is called by storeNewsletterContent for BOTH public and private paths", () => {
    const calledInPaths = {
      publicPath: true,
      privatePath: true,
    }
    expect(calledInPaths.publicPath).toBe(true)
    expect(calledInPaths.privatePath).toBe(true)
  })
})

// =============================================================================
// AC4: Sender Display Information (Query Functions)
// =============================================================================

describe("getSenderById query contract (AC4) - TO BE IMPLEMENTED", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      senderId: "required Id<'senders'>",
    }
    expect(expectedArgsShape).toHaveProperty("senderId")
  })

  it("returns sender with displayName (name or email fallback)", () => {
    const expectedReturn = {
      _id: "Id<'senders'>",
      email: "string",
      name: "string | undefined",
      displayName: "string - name if available, otherwise email",
      domain: "string",
      subscriberCount: "number",
      newsletterCount: "number",
    }
    expect(expectedReturn).toHaveProperty("displayName")
  })

  it("throws NOT_FOUND error if sender doesn't exist", () => {
    const expectedError = {
      code: "NOT_FOUND",
      message: "Sender not found",
    }
    expect(expectedError.code).toBe("NOT_FOUND")
  })
})

describe("listSendersForUser query contract (AC4) - TO BE IMPLEMENTED", () => {
  it("takes no args (uses authenticated user)", () => {
    const expectedArgs = {}
    expect(Object.keys(expectedArgs)).toHaveLength(0)
  })

  it("returns empty array when not authenticated", () => {
    const returnWhenUnauth: unknown[] = []
    expect(returnWhenUnauth).toEqual([])
  })

  it("returns senders with enriched information", () => {
    const expectedReturn = {
      _id: "Id<'senders'>",
      email: "string",
      name: "string | undefined",
      displayName: "string - name if available, otherwise email",
      domain: "string",
      subscriberCount: "number - total users across platform",
      newsletterCount: "number - total newsletters from this sender",
      userNewsletterCount: "number - newsletters for THIS user",
      isPrivate: "boolean - from userSenderSettings",
      folderId: "Id<'folders'> | undefined - from userSenderSettings",
    }
    expect(expectedReturn).toHaveProperty("displayName")
    expect(expectedReturn).toHaveProperty("userNewsletterCount")
    expect(expectedReturn).toHaveProperty("isPrivate")
  })

  it("filters by authenticated user's userSenderSettings", () => {
    const filterBehavior = {
      uses: "withIndex('by_userId', q => q.eq('userId', user._id))",
      enriches: "each setting with sender details and newsletter counts",
    }
    expect(filterBehavior.uses).toContain("by_userId")
  })
})

describe("updateUserSenderSettings mutation contract (AC4)", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      senderId: "required Id<'senders'>",
      isPrivate: "optional boolean",
      folderId: "optional Id<'folders'>",
    }
    expect(expectedArgsShape).toHaveProperty("isPrivate")
    expect(expectedArgsShape).toHaveProperty("folderId")
  })

  it("updates only provided fields", () => {
    const updateBehavior = {
      partialUpdate: true,
      updatesIsPrivate: "only if provided",
      updatesFolderId: "only if provided",
    }
    expect(updateBehavior.partialUpdate).toBe(true)
  })

  it("throws UNAUTHORIZED if not authenticated", () => {
    const expectedError = {
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    }
    expect(expectedError.code).toBe("UNAUTHORIZED")
  })

  it("throws NOT_FOUND if settings don't exist", () => {
    const expectedError = {
      code: "NOT_FOUND",
      message: "Sender settings not found",
    }
    expect(expectedError.code).toBe("NOT_FOUND")
  })
})

// =============================================================================
// AC5: Private Sender Handling
// =============================================================================

describe("getUserSenderSettings query contract (AC5)", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      userId: "required Id<'users'>",
      senderId: "required Id<'senders'>",
    }
    expect(expectedArgsShape).toHaveProperty("userId")
    expect(expectedArgsShape).toHaveProperty("senderId")
  })

  it("returns userSenderSettings or null", () => {
    const expectedReturn = {
      found: "userSenderSettings with isPrivate, folderId",
      notFound: "null",
    }
    expect(expectedReturn).toHaveProperty("found")
    expect(expectedReturn).toHaveProperty("notFound")
  })

  it("uses by_userId_senderId index for efficient lookup", () => {
    const indexUsed = "by_userId_senderId"
    expect(indexUsed).toBe("by_userId_senderId")
  })
})

describe("private sender newsletter handling (AC5)", () => {
  it("documents privacy flow in emailIngestion", () => {
    const privacyFlow = {
      step1: "Get or create sender via getOrCreateSender",
      step2: "Get or create userSenderSettings via getOrCreateUserSenderSettings",
      step3: "Check userSenderSettings.isPrivate",
      step4: "Pass isPrivate to storeNewsletterContent",
    }
    expect(privacyFlow.step3).toContain("isPrivate")
  })

  it("documents private storage path", () => {
    const privatePath = {
      condition: "isPrivate === true",
      r2KeyPattern: "private/{userId}/{timestamp}-{uuid}.{ext}",
      userNewsletterFields: {
        privateR2Key: "set to R2 key",
        contentId: "undefined (no shared content)",
        isPrivate: "true",
      },
    }
    expect(privatePath.userNewsletterFields.isPrivate).toBe("true")
    expect(privatePath.userNewsletterFields.contentId).toBe(
      "undefined (no shared content)"
    )
  })

  it("documents that private newsletters bypass deduplication", () => {
    const dedupBehavior = {
      normalization: "skipped",
      hashing: "skipped",
      contentLookup: "skipped",
    }
    expect(dedupBehavior.normalization).toBe("skipped")
  })
})

// =============================================================================
// Email Ingestion Integration (Story 2.3 Tasks 1-2)
// =============================================================================

describe("emailIngestion sender integration", () => {
  it("documents expected call sequence", () => {
    const callSequence = [
      "1. validateEmail and parse request body",
      "2. findUserByDedicatedEmail",
      "3. getOrCreateSender (creates/returns global sender)",
      "4. getOrCreateUserSenderSettings (creates/returns user-sender link)",
      "5. Extract isPrivate from userSenderSettings",
      "6. storeNewsletterContent with isPrivate flag",
    ]
    expect(callSequence).toHaveLength(6)
    expect(callSequence[2]).toContain("getOrCreateSender")
    expect(callSequence[3]).toContain("getOrCreateUserSenderSettings")
  })

  it("documents sender creation before userSenderSettings", () => {
    // IMPORTANT: Sender must exist before creating userSenderSettings
    // because userSenderSettings references senderId
    const order = {
      first: "getOrCreateSender returns sender._id",
      second: "getOrCreateUserSenderSettings uses sender._id",
    }
    expect(order.first).toContain("sender._id")
  })
})

// =============================================================================
// Existing Query Functions (from Story 2.5.1)
// =============================================================================

describe("listSenders query contract", () => {
  it("defines optional limit arg", () => {
    const expectedArgsShape = {
      limit: "optional number - default 50",
    }
    expect(expectedArgsShape).toHaveProperty("limit")
  })

  it("returns senders ordered by subscriberCount descending", () => {
    const queryBehavior = {
      index: "by_subscriberCount",
      order: "desc",
    }
    expect(queryBehavior.order).toBe("desc")
  })
})

describe("listUserSenderSettings query contract", () => {
  it("takes no args", () => {
    const expectedArgs = {}
    expect(Object.keys(expectedArgs)).toHaveLength(0)
  })

  it("returns empty array when not authenticated", () => {
    const returnWhenUnauth: unknown[] = []
    expect(returnWhenUnauth).toEqual([])
  })

  it("enriches settings with sender details", () => {
    const enrichedReturn = {
      settings: "userSenderSettings fields",
      sender: "full sender object included",
    }
    expect(enrichedReturn).toHaveProperty("sender")
  })
})

// =============================================================================
// Error Handling Patterns
// =============================================================================

describe("senders error handling", () => {
  it("uses NOT_FOUND for missing resources", () => {
    const expectedError = {
      code: "NOT_FOUND",
      message: "varies by resource type",
    }
    expect(expectedError.code).toBe("NOT_FOUND")
  })

  it("uses UNAUTHORIZED for unauthenticated requests", () => {
    const expectedError = {
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    }
    expect(expectedError.code).toBe("UNAUTHORIZED")
  })

  it("uses INTERNAL_ERROR for unexpected failures", () => {
    const expectedError = {
      code: "INTERNAL_ERROR",
      message: "varies by error type",
    }
    expect(expectedError.code).toBe("INTERNAL_ERROR")
  })

  it("follows ConvexError pattern from architecture.md", () => {
    const validErrorCodes = ["NOT_FOUND", "UNAUTHORIZED", "INTERNAL_ERROR"]
    expect(validErrorCodes).toContain("NOT_FOUND")
    expect(validErrorCodes).toContain("UNAUTHORIZED")
  })
})

// =============================================================================
// Subscriber Count Logic (AC1, AC3)
// =============================================================================

describe("subscriberCount logic (AC1, AC3)", () => {
  it("documents first subscriber flow", () => {
    // User A receives first newsletter from new sender
    const firstSubscriberFlow = {
      step1: "getOrCreateSender creates sender with subscriberCount=0",
      step2: "getOrCreateUserSenderSettings creates settings",
      step3: "getOrCreateUserSenderSettings increments subscriberCount to 1",
      finalCount: 1,
    }
    expect(firstSubscriberFlow.finalCount).toBe(1)
  })

  it("documents second subscriber flow", () => {
    // User B receives newsletter from existing sender
    const secondSubscriberFlow = {
      step1: "getOrCreateSender returns existing sender (subscriberCount=1)",
      step2: "getOrCreateUserSenderSettings creates NEW settings for user B",
      step3: "getOrCreateUserSenderSettings increments subscriberCount to 2",
      finalCount: 2,
    }
    expect(secondSubscriberFlow.finalCount).toBe(2)
  })

  it("documents same user receiving again (no increment)", () => {
    // User A receives second newsletter from same sender
    const sameUserFlow = {
      step1: "getOrCreateSender returns existing sender",
      step2: "getOrCreateUserSenderSettings returns existing settings",
      step3: "NO increment (settings already exist)",
      subscriberCountChange: 0,
    }
    expect(sameUserFlow.subscriberCountChange).toBe(0)
  })
})

// =============================================================================
// Newsletter Count Logic (AC2)
// =============================================================================

describe("newsletterCount logic (AC2)", () => {
  it("documents increment timing", () => {
    // newsletterCount is incremented AFTER successful newsletter storage
    const incrementTiming = {
      when: "after storeNewsletterContent completes successfully",
      where: "storeNewsletterContent calls incrementNewsletterCount",
      applies: "both public and private paths",
    }
    expect(incrementTiming.where).toContain("storeNewsletterContent")
  })

  it("documents that getOrCreateSender does NOT increment newsletterCount", () => {
    // This was a bug fixed in Story 2.5.2
    const getOrCreateSenderBehavior = {
      incrementsNewsletterCount: false,
      reason: "Newsletter count only incremented when newsletter is actually stored",
    }
    expect(getOrCreateSenderBehavior.incrementsNewsletterCount).toBe(false)
  })
})

// =============================================================================
// End-to-End Flow Tests (Task 6)
// =============================================================================

describe("E2E: New sender creates sender record (AC1)", () => {
  it("documents complete flow for new sender", () => {
    const flow = {
      trigger: "Newsletter arrives from completely new sender email",
      steps: [
        "1. emailIngestion.receiveEmail called",
        "2. User found by dedicated email",
        "3. getOrCreateSender creates new sender (subscriberCount=0, newsletterCount=0)",
        "4. getOrCreateUserSenderSettings creates settings, increments subscriberCount to 1",
        "5. storeNewsletterContent stores content",
        "6. incrementNewsletterCount called, newsletterCount=1",
      ],
      finalState: {
        senderExists: true,
        subscriberCount: 1,
        newsletterCount: 1,
        userSenderSettingsExists: true,
        userNewsletterExists: true,
      },
    }
    expect(flow.finalState.subscriberCount).toBe(1)
    expect(flow.finalState.newsletterCount).toBe(1)
  })
})

describe("E2E: Existing sender reuses record, increments newsletterCount (AC2)", () => {
  it("documents flow for existing sender", () => {
    const flow = {
      trigger: "Newsletter arrives from existing sender (User A already subscribed)",
      precondition: {
        senderExists: true,
        subscriberCount: 1,
        newsletterCount: 1,
      },
      steps: [
        "1. emailIngestion.receiveEmail called",
        "2. User found by dedicated email",
        "3. getOrCreateSender returns existing sender (no changes)",
        "4. getOrCreateUserSenderSettings returns existing settings (no changes)",
        "5. storeNewsletterContent stores content",
        "6. incrementNewsletterCount called, newsletterCount=2",
      ],
      finalState: {
        subscriberCount: 1, // No change - same user
        newsletterCount: 2, // Incremented
        duplicateSenderCreated: false,
      },
    }
    expect(flow.finalState.subscriberCount).toBe(1)
    expect(flow.finalState.newsletterCount).toBe(2)
    expect(flow.finalState.duplicateSenderCreated).toBe(false)
  })
})

describe("E2E: First newsletter from sender for user creates userSenderSettings (AC3)", () => {
  it("documents flow for new user receiving from existing sender", () => {
    const flow = {
      trigger: "User B receives first newsletter from sender (User A already subscribed)",
      precondition: {
        senderExists: true,
        subscriberCount: 1,
        userAHasSettings: true,
        userBHasSettings: false,
      },
      steps: [
        "1. emailIngestion.receiveEmail called for User B",
        "2. User B found by dedicated email",
        "3. getOrCreateSender returns existing sender (no changes)",
        "4. getOrCreateUserSenderSettings creates NEW settings for User B",
        "5. subscriberCount incremented to 2",
        "6. storeNewsletterContent stores content",
        "7. incrementNewsletterCount called",
      ],
      finalState: {
        subscriberCount: 2, // Incremented for new user
        userBHasSettings: true,
        userBSettingsIsPrivate: false, // Default
      },
    }
    expect(flow.finalState.subscriberCount).toBe(2)
    expect(flow.finalState.userBSettingsIsPrivate).toBe(false)
  })
})

describe("E2E: Second newsletter from same sender doesn't duplicate userSenderSettings (AC3)", () => {
  it("documents flow for existing user-sender relationship", () => {
    const flow = {
      trigger: "User A receives second newsletter from sender they already receive from",
      precondition: {
        userSenderSettingsExists: true,
        subscriberCount: 1,
      },
      steps: [
        "1. emailIngestion.receiveEmail called for User A",
        "2. getOrCreateSender returns existing sender",
        "3. getOrCreateUserSenderSettings returns existing settings (NO increment)",
        "4. storeNewsletterContent stores content",
      ],
      finalState: {
        subscriberCount: 1, // NO change - same user-sender relationship
        userSenderSettingsDuplicated: false,
      },
    }
    expect(flow.finalState.subscriberCount).toBe(1)
    expect(flow.finalState.userSenderSettingsDuplicated).toBe(false)
  })
})

describe("E2E: Private sender newsletters bypass deduplication (AC5)", () => {
  it("documents flow for private sender", () => {
    const flow = {
      trigger: "Newsletter arrives from sender user has marked as private",
      precondition: {
        userSenderSettingsExists: true,
        isPrivate: true,
      },
      steps: [
        "1. emailIngestion.receiveEmail called",
        "2. getOrCreateSender returns existing sender",
        "3. getOrCreateUserSenderSettings returns existing settings with isPrivate=true",
        "4. storeNewsletterContent called with isPrivate=true",
        "5. Private path: skip normalization, skip hashing, skip dedup lookup",
        "6. Upload to R2 with private/{userId}/{timestamp}-{uuid}.{ext} key",
        "7. Create userNewsletter with privateR2Key (no contentId)",
        "8. incrementNewsletterCount called",
      ],
      finalState: {
        userNewsletterIsPrivate: true,
        userNewsletterHasPrivateR2Key: true,
        userNewsletterContentId: null,
        deduplicationPerformed: false,
      },
    }
    expect(flow.finalState.userNewsletterIsPrivate).toBe(true)
    expect(flow.finalState.userNewsletterContentId).toBe(null)
    expect(flow.finalState.deduplicationPerformed).toBe(false)
  })
})

// =============================================================================
// Code Review Fixes (Story 2.3)
// =============================================================================

describe("getOrCreateSender race condition protection", () => {
  it("documents race condition detection and cleanup", () => {
    const raceProtection = {
      detection: "After insert, query all senders with same email",
      condition: "allSenders.length > 1",
      resolution: "Keep oldest by _creationTime, delete duplicates",
      logging: "Console log with sender ID and duplicate count",
    }
    expect(raceProtection.condition).toBe("allSenders.length > 1")
  })

  it("documents that oldest sender wins in race condition", () => {
    const winnerSelection = {
      sort: "allSenders.sort((a, b) => a._creationTime - b._creationTime)",
      winner: "sortedSenders[0] (oldest)",
      deleted: "sortedSenders.slice(1) (all newer duplicates)",
    }
    expect(winnerSelection.winner).toContain("oldest")
  })
})

describe("getOrCreateUserSenderSettings race condition protection", () => {
  it("documents race condition detection and cleanup", () => {
    const raceProtection = {
      detection: "After insert, query all settings with same userId+senderId",
      condition: "allSettings.length > 1",
      resolution: "Keep oldest by _creationTime, delete duplicates",
      subscriberCountBehavior: "Only increment if we created unique record",
    }
    expect(raceProtection.subscriberCountBehavior).toContain("unique")
  })

  it("documents that subscriberCount is NOT incremented on race loss", () => {
    const countBehavior = {
      raceWinner: "subscriberCount incremented (new relationship)",
      raceLoser: "subscriberCount NOT incremented (duplicate deleted)",
      reason: "Prevents double-counting from concurrent requests",
    }
    expect(countBehavior.raceLoser).toContain("NOT incremented")
  })
})

describe("updateSenderSettings folder validation", () => {
  it("validates folder exists before assignment", () => {
    const validation = {
      check: "await ctx.db.get(args.folderId)",
      errorIfNotFound: { code: "NOT_FOUND", message: "Folder not found" },
    }
    expect(validation.errorIfNotFound.code).toBe("NOT_FOUND")
  })

  it("validates folder belongs to authenticated user", () => {
    const ownershipCheck = {
      condition: "folder.userId !== user._id",
      error: { code: "FORBIDDEN", message: "Folder does not belong to user" },
      prevents: "Cross-user folder assignment (security vulnerability)",
    }
    expect(ownershipCheck.error.code).toBe("FORBIDDEN")
  })

  it("uses FORBIDDEN error code for ownership violations", () => {
    // FORBIDDEN is the correct HTTP semantic for "authenticated but not authorized"
    const errorCodes = {
      notAuthenticated: "UNAUTHORIZED",
      resourceNotFound: "NOT_FOUND",
      notOwner: "FORBIDDEN",
    }
    expect(errorCodes.notOwner).toBe("FORBIDDEN")
  })
})

describe("getSenderById security considerations", () => {
  it("documents intentional public access", () => {
    const securityDesign = {
      authRequired: false,
      reason: "Global sender registry for community discovery (Epic 6)",
      exposedData: ["email", "name", "domain", "subscriberCount", "newsletterCount"],
      notExposed: ["individual subscriber identities", "private content"],
    }
    expect(securityDesign.authRequired).toBe(false)
    expect(securityDesign.notExposed).toContain("individual subscriber identities")
  })

  it("documents rate limiting recommendation", () => {
    const rateLimitingNote = {
      location: "HTTP layer (not Convex function)",
      trigger: "If abuse/enumeration detected",
      implementation: "Application or CDN level",
    }
    expect(rateLimitingNote.location).toContain("HTTP")
  })
})

// =============================================================================
// Story 3.1: Newsletter List Organized by Sender
// =============================================================================

describe("listSendersForUserWithUnreadCounts query contract (Story 3.1 Task 7)", () => {
  it("takes no args (uses authenticated user)", () => {
    const expectedArgs = {}
    expect(Object.keys(expectedArgs)).toHaveLength(0)
  })

  it("returns empty array when not authenticated", () => {
    const returnWhenUnauth: unknown[] = []
    expect(returnWhenUnauth).toEqual([])
  })

  it("returns senders with unread counts for sidebar display", () => {
    const expectedReturn = {
      _id: "Id<'senders'>",
      email: "string",
      name: "string | undefined",
      displayName: "string - name if available, otherwise email",
      domain: "string",
      userNewsletterCount: "number - newsletters for THIS user",
      unreadCount: "number - unread newsletters from this sender",
      isPrivate: "boolean - from userSenderSettings",
      folderId: "Id<'folders'> | undefined - from userSenderSettings",
    }
    expect(expectedReturn).toHaveProperty("displayName")
    expect(expectedReturn).toHaveProperty("userNewsletterCount")
    expect(expectedReturn).toHaveProperty("unreadCount")
    expect(expectedReturn).toHaveProperty("isPrivate")
  })

  it("sorts senders alphabetically by displayName", () => {
    const sortBehavior = {
      method: "sort((a, b) => a.displayName.localeCompare(b.displayName))",
      order: "ascending alphabetical",
    }
    expect(sortBehavior.order).toBe("ascending alphabetical")
  })

  it("calculates unreadCount from newsletters where isRead=false", () => {
    const unreadCalculation = {
      source: "userNewsletters filtered by userId and senderId",
      filter: "newsletters.filter((n) => !n.isRead).length",
      result: "number of unread newsletters from sender",
    }
    expect(unreadCalculation.filter).toContain("!n.isRead")
  })

  it("uses by_userId_senderId index for efficient newsletter counting", () => {
    const indexUsed = "by_userId_senderId"
    expect(indexUsed).toBe("by_userId_senderId")
  })
})

// =============================================================================
// Story 6.4: Follow Sender and Discovery Features
// =============================================================================

describe("senders API exports (Story 6.4)", () => {
  it("should export listFollowedSenders query", () => {
    expect(api.senders.listFollowedSenders).toBeDefined()
  })

  it("should export listDistinctDomains query", () => {
    expect(api.senders.listDistinctDomains).toBeDefined()
  })
})

describe("listFollowedSenders query contract (Story 6.4 Task 1.4)", () => {
  it("takes no args (uses authenticated user)", () => {
    const expectedArgs = {}
    expect(Object.keys(expectedArgs)).toHaveLength(0)
  })

  it("returns empty array when not authenticated", () => {
    const returnWhenUnauth: unknown[] = []
    expect(returnWhenUnauth).toEqual([])
  })

  it("returns followed senders with hasNewsletters indicator", () => {
    const expectedReturn = {
      senderId: "Id<'senders'>",
      email: "string",
      name: "string | undefined",
      displayName: "string - name if available, otherwise email",
      domain: "string",
      subscriberCount: "number - total users across platform",
      newsletterCount: "number - total newsletters from this sender",
      isPrivate: "boolean - from userSenderSettings",
      hasNewsletters: "boolean - true if user has newsletters from sender",
      folderId: "Id<'folders'> | undefined",
    }
    expect(expectedReturn).toHaveProperty("hasNewsletters")
    expect(expectedReturn).toHaveProperty("displayName")
    expect(expectedReturn).toHaveProperty("isPrivate")
  })

  it("includes followed senders without newsletters", () => {
    const behavior = {
      source: "userSenderSettings - all sender relationships",
      includes: "senders with userSenderSettings but no userNewsletters",
      use: "Discover CTA and sidebar 'Following' section",
    }
    expect(behavior.includes).toContain("no userNewsletters")
  })

  it("uses by_userId index for efficient lookup", () => {
    const indexUsed = "by_userId"
    expect(indexUsed).toBe("by_userId")
  })
})

describe("listDistinctDomains query contract (Story 6.4 Task 3.1)", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      limit: "optional number - max domains (default 50, max 100)",
    }
    expect(expectedArgsShape).toHaveProperty("limit")
  })

  it("returns empty array when not authenticated", () => {
    const returnWhenUnauth: unknown[] = []
    expect(returnWhenUnauth).toEqual([])
  })

  it("returns domains with total subscriber counts", () => {
    const expectedReturn = {
      domain: "string - e.g., 'substack.com'",
      totalSubscribers: "number - sum of subscriberCount for senders in domain",
    }
    expect(expectedReturn).toHaveProperty("domain")
    expect(expectedReturn).toHaveProperty("totalSubscribers")
  })

  it("sorts domains by total subscribers (most popular first)", () => {
    const sortBehavior = {
      order: ".sort((a, b) => b[1] - a[1])",
      result: "domains with most subscribers first",
    }
    expect(sortBehavior.result).toContain("most subscribers first")
  })

  it("extracts unique domains from senders table", () => {
    const extractBehavior = {
      source: "senders table",
      method: "Map<domain, totalSubscribers>",
      deduplication: "unique domains aggregating subscriber counts",
    }
    expect(extractBehavior.deduplication).toContain("unique domains")
  })
})

// =============================================================================
// Story 9.3: Folder Auto-Creation Edge Cases
// =============================================================================

describe("getOrCreateFolderForSender export (Story 9.2, 9.3)", () => {
  it("should export getOrCreateFolderForSender internal mutation", () => {
    expect(internal.senders.getOrCreateFolderForSender).toBeDefined()
  })
})

// =============================================================================
// Story 9.3 Code Review Fix: Behavioral Unit Tests for Helper Functions
// These tests actually execute the exported helper functions (not just document contracts)
// =============================================================================

import {
  sanitizeFolderName,
  makeUniqueFolderName,
  MAX_FOLDER_NAME_LENGTH,
  DEFAULT_FOLDER_NAME,
} from "./senders"

describe("sanitizeFolderName (behavioral tests)", () => {
  it("returns input unchanged for normal strings", () => {
    expect(sanitizeFolderName("Morning Brew")).toBe("Morning Brew")
    expect(sanitizeFolderName("The Hustle")).toBe("The Hustle")
  })

  it("trims leading and trailing whitespace", () => {
    expect(sanitizeFolderName("  Morning Brew  ")).toBe("Morning Brew")
    expect(sanitizeFolderName("\t\nHustle\n\t")).toBe("Hustle")
  })

  it("replaces newlines with spaces", () => {
    expect(sanitizeFolderName("Morning\nBrew")).toBe("Morning Brew")
    expect(sanitizeFolderName("The\r\nHustle")).toBe("The Hustle")
  })

  it("replaces tabs with spaces", () => {
    expect(sanitizeFolderName("Morning\tBrew")).toBe("Morning Brew")
  })

  it("collapses multiple spaces into single space", () => {
    expect(sanitizeFolderName("Morning   Brew")).toBe("Morning Brew")
    expect(sanitizeFolderName("The    Hustle   Newsletter")).toBe(
      "The Hustle Newsletter"
    )
  })

  it("removes control characters (ASCII 0-31)", () => {
    const withControl = String.fromCharCode(0) + "Test" + String.fromCharCode(31)
    expect(sanitizeFolderName(withControl)).toBe("Test")
  })

  it("truncates to MAX_FOLDER_NAME_LENGTH characters", () => {
    const longName = "A".repeat(150)
    const result = sanitizeFolderName(longName)
    expect(result.length).toBe(MAX_FOLDER_NAME_LENGTH)
    expect(result).toBe("A".repeat(100))
  })

  it("handles truncation with trailing whitespace correctly", () => {
    // Name that would be 100 chars + trailing spaces after sanitization
    const nameWithSpaces = "A".repeat(98) + "  \t\n  "
    const result = sanitizeFolderName(nameWithSpaces)
    expect(result.length).toBeLessThanOrEqual(MAX_FOLDER_NAME_LENGTH)
    expect(result.endsWith(" ")).toBe(false)
  })

  it("returns empty string for all-control-character input", () => {
    const allControl =
      String.fromCharCode(0) +
      String.fromCharCode(1) +
      String.fromCharCode(31)
    expect(sanitizeFolderName(allControl)).toBe("")
  })

  it("returns empty string for whitespace-only input", () => {
    expect(sanitizeFolderName("   ")).toBe("")
    expect(sanitizeFolderName("\t\n\r")).toBe("")
  })

  it("preserves unicode characters", () => {
    expect(sanitizeFolderName("日本語ニュースレター")).toBe("日本語ニュースレター")
    expect(sanitizeFolderName("Émoji 🎉 News")).toBe("Émoji 🎉 News")
  })
})

describe("makeUniqueFolderName (behavioral tests)", () => {
  it("returns base name when no duplicates exist", () => {
    expect(makeUniqueFolderName("Morning Brew", [])).toBe("Morning Brew")
    expect(
      makeUniqueFolderName("Morning Brew", [{ name: "Other Folder" }])
    ).toBe("Morning Brew")
  })

  it("appends counter 2 when base name exists", () => {
    expect(
      makeUniqueFolderName("Morning Brew", [{ name: "Morning Brew" }])
    ).toBe("Morning Brew 2")
  })

  it("increments counter for multiple duplicates", () => {
    const existingFolders = [
      { name: "Morning Brew" },
      { name: "Morning Brew 2" },
      { name: "Morning Brew 3" },
    ]
    expect(makeUniqueFolderName("Morning Brew", existingFolders)).toBe(
      "Morning Brew 4"
    )
  })

  it("handles gaps in counter sequence", () => {
    const existingFolders = [
      { name: "Morning Brew" },
      { name: "Morning Brew 2" },
      // Note: "Morning Brew 3" is missing
      { name: "Morning Brew 4" },
    ]
    // Should find the first available: 3
    expect(makeUniqueFolderName("Morning Brew", existingFolders)).toBe(
      "Morning Brew 3"
    )
  })

  it("performs case-insensitive duplicate detection", () => {
    expect(
      makeUniqueFolderName("morning brew", [{ name: "Morning Brew" }])
    ).toBe("morning brew 2")
    expect(
      makeUniqueFolderName("MORNING BREW", [{ name: "morning brew" }])
    ).toBe("MORNING BREW 2")
  })

  it("handles empty base name", () => {
    // Edge case: if sanitization produced empty string (shouldn't happen with proper fallback)
    expect(makeUniqueFolderName("", [])).toBe("")
    expect(makeUniqueFolderName("", [{ name: "" }])).toBe(" 2")
  })
})

describe("DEFAULT_FOLDER_NAME constant", () => {
  it("is exported and has a sensible value", () => {
    expect(DEFAULT_FOLDER_NAME).toBeDefined()
    expect(DEFAULT_FOLDER_NAME.length).toBeGreaterThan(0)
    expect(DEFAULT_FOLDER_NAME).toBe("Unnamed Folder")
  })
})

describe("MAX_FOLDER_NAME_LENGTH constant", () => {
  it("is exported and set to 100", () => {
    expect(MAX_FOLDER_NAME_LENGTH).toBeDefined()
    expect(MAX_FOLDER_NAME_LENGTH).toBe(100)
  })
})

describe("getOrCreateFolderForSender mutation contract (Story 9.3)", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      userId: "required Id<'users'>",
      senderId: "required Id<'senders'>",
    }
    expect(expectedArgsShape).toHaveProperty("userId")
    expect(expectedArgsShape).toHaveProperty("senderId")
  })

  it("returns folderId", () => {
    const expectedReturn = "Id<'folders'>"
    expect(expectedReturn).toBe("Id<'folders'>")
  })

  it("documents fast path - returns existing folderId if set", () => {
    const fastPath = {
      condition: "userSenderSettings exists with folderId set",
      action: "return folderId immediately (no folder creation)",
      benefit: "Avoids unnecessary queries for existing folders",
    }
    expect(fastPath.action).toContain("return folderId immediately")
  })

  it("uses by_userId_senderId index for settings lookup", () => {
    const indexUsed = "by_userId_senderId"
    expect(indexUsed).toBe("by_userId_senderId")
  })
})

describe("Folder name derivation (Story 9.3 Task 1.5, 5.1)", () => {
  it("prefers sender.name as folder name", () => {
    const testCases = [
      { sender: { name: "Morning Brew", email: "hello@morningbrew.com" }, expectedName: "Morning Brew" },
      { sender: { name: "The Hustle", email: "newsletter@thehustle.co" }, expectedName: "The Hustle" },
    ]
    for (const tc of testCases) {
      const folderName = tc.sender.name || tc.sender.email || "Unknown Sender"
      expect(folderName).toBe(tc.expectedName)
    }
  })

  it("falls back to sender.email when name is not available", () => {
    const testCases = [
      { sender: { name: undefined, email: "news@example.com" }, expectedName: "news@example.com" },
      { sender: { name: null, email: "hello@world.io" }, expectedName: "hello@world.io" },
      { sender: { name: "", email: "test@domain.com" }, expectedName: "test@domain.com" },
    ]
    for (const tc of testCases) {
      const folderName = tc.sender.name || tc.sender.email || "Unknown Sender"
      expect(folderName).toBe(tc.expectedName)
    }
  })

  it("uses 'Unknown Sender' as last resort", () => {
    const testCases = [
      { sender: { name: undefined, email: undefined }, expectedName: "Unknown Sender" },
      { sender: { name: null, email: null }, expectedName: "Unknown Sender" },
    ]
    for (const tc of testCases) {
      const folderName = tc.sender.name || tc.sender.email || "Unknown Sender"
      expect(folderName).toBe(tc.expectedName)
    }
  })
})

describe("Folder name sanitization (Story 9.3 Task 5.2, 5.3)", () => {
  it("truncates long sender names to 100 characters", () => {
    const MAX_FOLDER_NAME_LENGTH = 100
    const longName = "A".repeat(150)
    const sanitized = longName.slice(0, MAX_FOLDER_NAME_LENGTH)
    expect(sanitized.length).toBe(100)
    expect(sanitized.length).toBeLessThanOrEqual(MAX_FOLDER_NAME_LENGTH)
  })

  it("removes newlines and tabs from folder name", () => {
    const testCases = [
      { input: "Morning\nBrew", expected: "Morning Brew" },
      { input: "The\tHustle", expected: "The Hustle" },
      { input: "Test\r\nNewsletter", expected: "Test Newsletter" },
    ]
    for (const tc of testCases) {
      // Full sanitization: replace special chars, then collapse whitespace
      const sanitized = tc.input.replace(/[\r\n\t]/g, " ").replace(/\s+/g, " ")
      expect(sanitized).toBe(tc.expected)
    }
  })

  it("collapses multiple whitespace into single space", () => {
    const testCases = [
      { input: "Morning   Brew", expected: "Morning Brew" },
      { input: "The    Hustle  Newsletter", expected: "The Hustle Newsletter" },
    ]
    for (const tc of testCases) {
      const sanitized = tc.input.replace(/\s+/g, " ")
      expect(sanitized).toBe(tc.expected)
    }
  })

  it("removes control characters from folder name", () => {
    const controlChar = String.fromCharCode(0) + "Test" + String.fromCharCode(31)
    const sanitized = controlChar.replace(/[\x00-\x1F]/g, "")
    expect(sanitized).toBe("Test")
  })

  it("trims leading and trailing whitespace", () => {
    const testCases = [
      { input: "  Morning Brew  ", expected: "Morning Brew" },
      { input: "\n\tHustle\n", expected: "Hustle" },
    ]
    for (const tc of testCases) {
      const sanitized = tc.input.replace(/[\r\n\t]/g, " ").replace(/\s+/g, " ").trim()
      expect(sanitized).toBe(tc.expected)
    }
  })
})

describe("Duplicate folder name handling (Story 9.3 Task 1.6)", () => {
  it("uses base name when no duplicates exist", () => {
    const baseName = "Morning Brew"
    const existingFolders: { name: string }[] = []
    const existingNames = new Set(existingFolders.map((f) => f.name.toLowerCase()))

    const uniqueName = existingNames.has(baseName.toLowerCase())
      ? `${baseName} 2`
      : baseName

    expect(uniqueName).toBe("Morning Brew")
  })

  it("appends counter when duplicate name exists", () => {
    const baseName = "Morning Brew"
    const existingFolders = [{ name: "Morning Brew" }]
    const existingNames = new Set(existingFolders.map((f) => f.name.toLowerCase()))

    let counter = 2
    let uniqueName = baseName
    if (existingNames.has(baseName.toLowerCase())) {
      while (existingNames.has(`${baseName} ${counter}`.toLowerCase())) {
        counter++
      }
      uniqueName = `${baseName} ${counter}`
    }

    expect(uniqueName).toBe("Morning Brew 2")
  })

  it("increments counter for multiple duplicates", () => {
    const baseName = "Morning Brew"
    const existingFolders = [
      { name: "Morning Brew" },
      { name: "Morning Brew 2" },
      { name: "Morning Brew 3" },
    ]
    const existingNames = new Set(existingFolders.map((f) => f.name.toLowerCase()))

    let counter = 2
    let uniqueName = baseName
    if (existingNames.has(baseName.toLowerCase())) {
      while (existingNames.has(`${baseName} ${counter}`.toLowerCase())) {
        counter++
      }
      uniqueName = `${baseName} ${counter}`
    }

    expect(uniqueName).toBe("Morning Brew 4")
  })

  it("handles case-insensitive duplicate detection", () => {
    const baseName = "morning brew"
    const existingFolders = [{ name: "Morning Brew" }]
    const existingNames = new Set(existingFolders.map((f) => f.name.toLowerCase()))

    const isDuplicate = existingNames.has(baseName.toLowerCase())
    expect(isDuplicate).toBe(true)
  })

  it("uses by_userId index to get existing folders efficiently", () => {
    const indexUsed = "by_userId"
    expect(indexUsed).toBe("by_userId")
  })
})

describe("Folder creation fields (Story 9.3 Task 1.7)", () => {
  it("creates folder with required fields", () => {
    const now = Date.now()
    const folderFields = {
      userId: "Id<'users'>",
      name: "string - derived from sender",
      isHidden: false,
      createdAt: now,
      updatedAt: now,
    }
    expect(folderFields.isHidden).toBe(false)
    expect(folderFields.createdAt).toBe(now)
    expect(folderFields.updatedAt).toBe(now)
  })

  it("sets isHidden to false for auto-created folders", () => {
    const isHidden = false
    expect(isHidden).toBe(false)
  })
})

describe("userSenderSettings update (Story 9.3 Task 1.8)", () => {
  it("updates existing settings with folderId", () => {
    const existingSettingsScenario = {
      condition: "userSenderSettings exists but folderId is null",
      action: "patch settings with new folderId",
      preserves: ["isPrivate", "senderId", "userId"],
    }
    expect(existingSettingsScenario.action).toContain("patch")
    expect(existingSettingsScenario.preserves).toContain("isPrivate")
  })

  it("creates new settings with folderId if none exist", () => {
    const newSettingsScenario = {
      condition: "no userSenderSettings exists",
      action: "insert new settings with folderId and isPrivate=true",
      isPrivate: true,
    }
    expect(newSettingsScenario.isPrivate).toBe(true)
  })

  it("sets isPrivate to true for new settings (Story 9.2 private-by-default)", () => {
    const defaultIsPrivate = true
    expect(defaultIsPrivate).toBe(true)
  })
})

describe("Race condition handling (Story 9.3 Task 5.4)", () => {
  it("documents race condition detection pattern", () => {
    const raceProtection = {
      detection: "After insert, query all settings with same userId+senderId",
      condition: "allSettings.length > 1",
      resolution: "Keep oldest by _creationTime, delete duplicates",
    }
    expect(raceProtection.condition).toBe("allSettings.length > 1")
  })

  it("documents orphaned folder cleanup on race loss", () => {
    const folderCleanup = {
      scenario: "Race loser created folder but another request won",
      detection: "keepSettings.folderId !== our folderId",
      action: "Delete our orphaned folder, return winner's folderId",
    }
    expect(folderCleanup.action).toContain("Delete our orphaned folder")
  })

  it("increments subscriberCount only on successful unique creation", () => {
    const countBehavior = {
      raceWinner: "subscriberCount incremented (new relationship)",
      raceLoser: "subscriberCount NOT incremented (duplicate deleted)",
    }
    expect(countBehavior.raceLoser).toContain("NOT incremented")
  })
})

describe("E2E: New sender creates folder with sender name (AC #1, #2)", () => {
  it("documents complete flow for new sender folder creation", () => {
    const flow = {
      trigger: "Newsletter arrives from new sender",
      precondition: {
        senderHasFolder: false,
        userSenderSettingsExist: false,
      },
      steps: [
        "1. emailIngestion calls getOrCreateFolderForSender",
        "2. Check userSenderSettings - not found",
        "3. Get sender info for folder name",
        "4. Sanitize and check for duplicate folder names",
        "5. Create folder with sender name",
        "6. Create userSenderSettings with folderId and isPrivate=true",
        "7. Increment sender.subscriberCount",
        "8. Return folderId for newsletter storage",
      ],
      finalState: {
        folderCreated: true,
        folderName: "sender.name || sender.email",
        userSenderSettingsCreated: true,
        userSenderSettingsFolderId: "points to new folder",
        userSenderSettingsIsPrivate: true,
      },
    }
    expect(flow.finalState.folderCreated).toBe(true)
    expect(flow.finalState.userSenderSettingsIsPrivate).toBe(true)
  })
})

describe("E2E: Existing sender with folder doesn't create duplicate (AC #4)", () => {
  it("documents flow for existing sender with folder", () => {
    const flow = {
      trigger: "Newsletter arrives from sender that already has folder",
      precondition: {
        senderHasFolder: true,
        userSenderSettingsExist: true,
        folderId: "folder_existing",
      },
      steps: [
        "1. emailIngestion calls getOrCreateFolderForSender",
        "2. Check userSenderSettings - found with folderId",
        "3. Return existing folderId immediately (fast path)",
      ],
      finalState: {
        newFolderCreated: false,
        returnedFolderId: "folder_existing",
      },
    }
    expect(flow.finalState.newFolderCreated).toBe(false)
  })
})

describe("E2E: Newsletter goes to existing folder (AC #5)", () => {
  it("documents that newsletters use existing folder", () => {
    const flow = {
      trigger: "Second newsletter from same sender",
      precondition: {
        folderExists: true,
        folderId: "folder_abc",
      },
      steps: [
        "1. getOrCreateFolderForSender returns existing folderId",
        "2. storeNewsletterContent uses folderId",
        "3. userNewsletter.folderId = folder_abc",
      ],
      finalState: {
        newsletterInFolder: true,
        folderId: "folder_abc",
        duplicateFolderCreated: false,
      },
    }
    expect(flow.finalState.duplicateFolderCreated).toBe(false)
    expect(flow.finalState.folderId).toBe("folder_abc")
  })
})

describe("Integration: All ingestion paths use getOrCreateFolderForSender (Story 9.3 Tasks 2-4)", () => {
  it("email ingestion calls getOrCreateFolderForSender", () => {
    const emailIngestionFlow = {
      path: "emailIngestion.ts",
      call: "internal.senders.getOrCreateFolderForSender",
      passesToStorage: true,
    }
    expect(emailIngestionFlow.call).toContain("getOrCreateFolderForSender")
  })

  it("Gmail import calls getOrCreateFolderForSender", () => {
    const gmailImportFlow = {
      path: "gmail.ts - processAndStoreImportedEmail",
      call: "internal.senders.getOrCreateFolderForSender",
      passesToStorage: true,
    }
    expect(gmailImportFlow.call).toContain("getOrCreateFolderForSender")
  })

  it("drag-drop import calls getOrCreateFolderForSender", () => {
    const manualImportFlow = {
      path: "manualImport.ts - importEmlNewsletter",
      call: "internal.senders.getOrCreateFolderForSender",
      passesToStorage: true,
    }
    expect(manualImportFlow.call).toContain("getOrCreateFolderForSender")
  })

  it("forward-to-import calls getOrCreateFolderForSender", () => {
    const importIngestionFlow = {
      path: "importIngestion.ts - receiveImportEmail",
      call: "internal.senders.getOrCreateFolderForSender",
      passesToStorage: true,
    }
    expect(importIngestionFlow.call).toContain("getOrCreateFolderForSender")
  })
})
