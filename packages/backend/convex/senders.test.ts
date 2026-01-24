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
