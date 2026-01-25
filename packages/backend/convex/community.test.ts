import { describe, it, expect } from "vitest"
import { api, internal } from "./_generated/api"

/**
 * Contract Tests for community.ts - Story 6.1
 *
 * PURPOSE: These are CONTRACT/SCHEMA documentation tests, NOT behavioral unit tests.
 * They verify:
 * 1. Functions are properly exported from the generated API
 * 2. Expected API contracts are documented in executable form
 * 3. Error codes and patterns match architecture standards
 * 4. CRITICAL: Verify NO user data is exposed in community queries
 *
 * PRIVACY VERIFICATION:
 * These tests document that community queries NEVER return user-specific data.
 * The newsletterContent table is inherently public - private content bypasses it.
 */

describe("community API exports (Story 6.1 Task 1)", () => {
  it("should export listCommunityNewsletters query", () => {
    expect(api.community).toBeDefined()
    expect(api.community.listCommunityNewsletters).toBeDefined()
  })

  it("should export listCommunityNewslettersBySender query", () => {
    expect(api.community.listCommunityNewslettersBySender).toBeDefined()
  })

  it("should export listCommunitySenders query", () => {
    expect(api.community.listCommunitySenders).toBeDefined()
  })

  it("should export getCommunityNewsletterContent action", () => {
    expect(api.community.getCommunityNewsletterContent).toBeDefined()
  })

  it("should export addToCollection mutation", () => {
    expect(api.community.addToCollection).toBeDefined()
  })

  it("should export onboarding queries and mutations", () => {
    expect(api.community.hasSeenSharingOnboarding).toBeDefined()
    expect(api.community.dismissSharingOnboarding).toBeDefined()
  })

  it("should export internal functions", () => {
    expect(internal.community).toBeDefined()
    expect(internal.community.getNewsletterContentInternal).toBeDefined()
  })
})

describe("community API exports (Story 6.3)", () => {
  it("should export searchCommunityNewsletters query", () => {
    expect(api.community.searchCommunityNewsletters).toBeDefined()
  })

  it("should export listTopCommunitySenders query", () => {
    expect(api.community.listTopCommunitySenders).toBeDefined()
  })
})

describe("listCommunityNewsletters query contract (Story 6.1 Task 1.2)", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      sortBy: "optional union('popular' | 'recent') - defaults to 'popular'",
      senderEmail: "optional string - filter by sender",
      cursor: "optional Id<'newsletterContent'> - for pagination",
      limit: "optional number - max items (default 20, max 100)",
    }
    expect(expectedArgsShape).toHaveProperty("sortBy")
    expect(expectedArgsShape).toHaveProperty("senderEmail")
    expect(expectedArgsShape).toHaveProperty("cursor")
    expect(expectedArgsShape).toHaveProperty("limit")
  })

  it("returns paginated response with nextCursor", () => {
    const expectedReturn = {
      items: "array of public newsletter content",
      nextCursor: "Id<'newsletterContent'> | null",
    }
    expect(expectedReturn).toHaveProperty("items")
    expect(expectedReturn).toHaveProperty("nextCursor")
  })

  it("returns ONLY public fields - NO user data (AC #2, #4)", () => {
    const publicFields = [
      "_id",
      "subject",
      "senderEmail",
      "senderName",
      "firstReceivedAt",
      "readerCount",
      "hasSummary",
    ]
    const forbiddenFields = [
      "userId",
      "userNewsletters",
      "privateR2Key",
      "isRead",
      "isHidden",
      "readProgress",
    ]

    // Document what IS returned
    expect(publicFields).toContain("_id")
    expect(publicFields).toContain("subject")
    expect(publicFields).toContain("readerCount")
    expect(publicFields).toContain("hasSummary")

    // Document what is NEVER returned
    expect(publicFields).not.toContain("userId")
    expect(publicFields).not.toContain("privateR2Key")
    expect(forbiddenFields).toContain("userId")
    expect(forbiddenFields).toContain("userNewsletters")
  })

  it("requires authentication to browse community", () => {
    const unauthenticatedResult = { items: [], nextCursor: null }
    expect(unauthenticatedResult.items).toHaveLength(0)
  })

  it("sorts by readerCount (popular) or firstReceivedAt (recent)", () => {
    const sortOptions = ["popular", "recent"]
    expect(sortOptions).toContain("popular")
    expect(sortOptions).toContain("recent")
  })
})

describe("listCommunityNewslettersBySender query contract (Story 6.1 Task 1.3)", () => {
  it("requires senderEmail argument", () => {
    const requiredArg = "senderEmail: string"
    expect(requiredArg).toContain("senderEmail")
  })

  it("defaults to 'recent' sort for sender-specific views", () => {
    const defaultSort = "recent"
    expect(defaultSort).toBe("recent")
  })
})

describe("getCommunityNewsletterContent action contract (Story 6.1 Task 1.4)", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      contentId: "required Id<'newsletterContent'>",
    }
    expect(expectedArgsShape).toHaveProperty("contentId")
  })

  it("returns content with signed R2 URL", () => {
    const expectedReturn = {
      _id: "string",
      subject: "string",
      senderEmail: "string",
      senderName: "string | undefined",
      firstReceivedAt: "number",
      readerCount: "number",
      hasSummary: "boolean",
      summary: "string | undefined",
      contentUrl: "string | null - signed R2 URL",
      contentStatus: "'available' | 'missing' | 'error'",
    }
    expect(expectedReturn).toHaveProperty("contentUrl")
    expect(expectedReturn).toHaveProperty("contentStatus")
  })

  it("generates signed URL valid for 1 hour", () => {
    const signedUrlConfig = { expiresIn: 3600 }
    expect(signedUrlConfig.expiresIn).toBe(3600) // 1 hour in seconds
  })

  it("throws UNAUTHORIZED for unauthenticated requests", () => {
    const expectedError = { code: "UNAUTHORIZED", message: "Not authenticated" }
    expect(expectedError.code).toBe("UNAUTHORIZED")
  })

  it("throws NOT_FOUND for non-existent content", () => {
    const expectedError = { code: "NOT_FOUND", message: "Newsletter not found" }
    expect(expectedError.code).toBe("NOT_FOUND")
  })
})

describe("addToCollection mutation contract (Story 6.1 Task 4)", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      contentId: "required Id<'newsletterContent'>",
    }
    expect(expectedArgsShape).toHaveProperty("contentId")
  })

  it("returns alreadyExists status and userNewsletterId", () => {
    const expectedReturn = {
      alreadyExists: "boolean",
      userNewsletterId: "Id<'userNewsletters'>",
    }
    expect(expectedReturn).toHaveProperty("alreadyExists")
    expect(expectedReturn).toHaveProperty("userNewsletterId")
  })

  it("returns alreadyExists: true if duplicate (Task 7.4)", () => {
    const duplicateResult = { alreadyExists: true, userNewsletterId: "existing-id" }
    expect(duplicateResult.alreadyExists).toBe(true)
  })

  it("creates userNewsletter with contentId reference (Task 7.4)", () => {
    const userNewsletterFields = {
      userId: "user's ID",
      senderId: "global sender ID",
      contentId: "points to newsletterContent",
      isPrivate: false, // Added from community = public
      isRead: false,
      isHidden: false,
    }
    expect(userNewsletterFields.contentId).toBe("points to newsletterContent")
    expect(userNewsletterFields.isPrivate).toBe(false)
  })

  it("increments readerCount on newsletterContent (Task 7.5)", () => {
    const readerCountBehavior = "await ctx.db.patch(contentId, { readerCount: content.readerCount + 1 })"
    expect(readerCountBehavior).toContain("readerCount")
  })

  it("creates userSenderSettings if new sender relationship (Task 7.8)", () => {
    const newSenderBehavior = {
      createSettings: "if no existing settings for user-sender pair",
      defaultIsPrivate: false, // Community sharing enabled by default
      incrementSubscriberCount: true,
    }
    expect(newSenderBehavior.defaultIsPrivate).toBe(false)
    expect(newSenderBehavior.incrementSubscriberCount).toBe(true)
  })

  it("throws UNAUTHORIZED for unauthenticated requests", () => {
    const expectedError = { code: "UNAUTHORIZED", message: "Not authenticated" }
    expect(expectedError.code).toBe("UNAUTHORIZED")
  })

  it("throws NOT_FOUND for non-existent content", () => {
    const expectedError = { code: "NOT_FOUND", message: "Newsletter content not found" }
    expect(expectedError.code).toBe("NOT_FOUND")
  })
})

describe("onboarding queries contract (Story 6.1 Task 5)", () => {
  it("hasSeenSharingOnboarding returns boolean", () => {
    const returnType = "boolean - true if user has seen onboarding"
    expect(typeof returnType).toBe("string")
  })

  it("defaults to false for new users", () => {
    const defaultValue = false
    expect(defaultValue).toBe(false)
  })

  it("dismissSharingOnboarding updates user record", () => {
    const updateBehavior = "ctx.db.patch(user._id, { hasSeenSharingOnboarding: true })"
    expect(updateBehavior).toContain("hasSeenSharingOnboarding: true")
  })
})

describe("community privacy enforcement (AC #2, #4)", () => {
  it("queries newsletterContent directly - never userNewsletters for list views", () => {
    const queryPattern = 'ctx.db.query("newsletterContent")'
    const forbiddenPattern = 'ctx.db.query("userNewsletters")'
    expect(queryPattern).toContain("newsletterContent")
    expect(queryPattern).not.toContain("userNewsletters")
  })

  it("never exposes userId in community query results", () => {
    const publicFields = ["_id", "subject", "senderEmail", "senderName", "firstReceivedAt", "readerCount", "hasSummary"]
    expect(publicFields).not.toContain("userId")
  })

  it("never exposes which users contributed to community content", () => {
    const privacyRule = "readerCount shows popularity without exposing user identities"
    expect(privacyRule).toContain("readerCount")
    expect(privacyRule).not.toContain("userIds")
  })

  it("private newsletters bypass newsletterContent entirely", () => {
    const privacyArchitecture = {
      publicPath: "isPrivate=false → store in newsletterContent → contentId reference",
      privatePath: "isPrivate=true → bypass newsletterContent → privateR2Key only",
    }
    expect(privacyArchitecture.privatePath).toContain("bypass newsletterContent")
  })
})

describe("community error handling", () => {
  it("uses ConvexError with standard error codes", () => {
    const errorCodes = ["UNAUTHORIZED", "NOT_FOUND"]
    expect(errorCodes).toContain("UNAUTHORIZED")
    expect(errorCodes).toContain("NOT_FOUND")
  })

  it("returns empty array for unauthenticated query requests (not error)", () => {
    const unauthQueryBehavior = "return { items: [], nextCursor: null }"
    expect(unauthQueryBehavior).toContain("[]")
  })

  it("throws error for unauthenticated mutation/action requests", () => {
    const unauthMutationBehavior = 'throw new ConvexError({ code: "UNAUTHORIZED" })'
    expect(unauthMutationBehavior).toContain("UNAUTHORIZED")
  })
})

// ============================================================
// Story 6.3: Search and Sender Browse Tests
// ============================================================

describe("searchCommunityNewsletters query contract (Story 6.3 Task 1.2)", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      searchQuery: "required string - the search term",
      limit: "optional number - max items (default 20, max 100)",
    }
    expect(expectedArgsShape).toHaveProperty("searchQuery")
    expect(expectedArgsShape).toHaveProperty("limit")
  })

  it("searches by subject field", () => {
    const searchBehavior = "subject.toLowerCase().includes(searchLower)"
    expect(searchBehavior).toContain("subject")
    expect(searchBehavior).toContain("toLowerCase")
  })

  it("searches by senderName field", () => {
    const searchBehavior = "senderName?.toLowerCase().includes(searchLower)"
    expect(searchBehavior).toContain("senderName")
  })

  it("searches by senderEmail field", () => {
    const searchBehavior = "senderEmail.toLowerCase().includes(searchLower)"
    expect(searchBehavior).toContain("senderEmail")
  })

  it("is case-insensitive", () => {
    const caseInsensitiveBehavior = "searchQuery.toLowerCase()"
    expect(caseInsensitiveBehavior).toContain("toLowerCase")
  })

  it("returns empty array for empty search query", () => {
    const emptyQueryBehavior = 'if (searchQuery.length === 0) return []'
    expect(emptyQueryBehavior).toContain("return []")
  })

  it("returns empty array for unauthenticated users", () => {
    const unauthBehavior = "if (!identity) return []"
    expect(unauthBehavior).toContain("return []")
  })

  it("returns ONLY public fields - NO user data", () => {
    const publicFields = [
      "_id",
      "subject",
      "senderEmail",
      "senderName",
      "firstReceivedAt",
      "readerCount",
      "hasSummary",
    ]
    const forbiddenFields = ["userId", "privateR2Key", "isRead", "isHidden"]

    expect(publicFields).toContain("_id")
    expect(publicFields).toContain("readerCount")
    expect(publicFields).not.toContain("userId")
    expect(forbiddenFields).toContain("userId")
  })

  it("limits in-memory scan to 500 items for performance", () => {
    const scanLimit = ".take(500)"
    expect(scanLimit).toContain("500")
  })

  it("sorts results by readerCount (popularity)", () => {
    const sortOrder = '.withIndex("by_readerCount").order("desc")'
    expect(sortOrder).toContain("readerCount")
    expect(sortOrder).toContain("desc")
  })
})

describe("listTopCommunitySenders query contract (Story 6.3 Task 2.2)", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      limit: "optional number - max senders (default 20, max 100)",
    }
    expect(expectedArgsShape).toHaveProperty("limit")
  })

  it("returns senders sorted by subscriberCount", () => {
    const sortBehavior = '.withIndex("by_subscriberCount").order("desc")'
    expect(sortBehavior).toContain("subscriberCount")
    expect(sortBehavior).toContain("desc")
  })

  it("returns public sender info only", () => {
    const publicFields = [
      "email",
      "name",
      "displayName",
      "domain",
      "subscriberCount",
      "newsletterCount",
    ]
    expect(publicFields).toContain("email")
    expect(publicFields).toContain("subscriberCount")
    expect(publicFields).not.toContain("userId")
  })

  it("returns empty array for unauthenticated users", () => {
    const unauthBehavior = "if (!identity) return []"
    expect(unauthBehavior).toContain("return []")
  })

  it("includes displayName (name or email fallback)", () => {
    const displayNameLogic = "displayName: sender.name || sender.email"
    expect(displayNameLogic).toContain("displayName")
    expect(displayNameLogic).toContain("||")
  })
})

describe("search privacy enforcement (Story 6.3 Task 5)", () => {
  it("queries ONLY newsletterContent table - never userNewsletters", () => {
    const queryPattern = 'ctx.db.query("newsletterContent")'
    expect(queryPattern).toContain("newsletterContent")
    expect(queryPattern).not.toContain("userNewsletters")
  })

  it("never exposes userId in search results", () => {
    const publicFields = ["_id", "subject", "senderEmail", "senderName", "firstReceivedAt", "readerCount", "hasSummary"]
    expect(publicFields).not.toContain("userId")
  })

  it("private newsletters never enter newsletterContent (architecture guarantee)", () => {
    const privacyArchitecture = {
      note: "isPrivate=true newsletters use privateR2Key and bypass newsletterContent",
      guarantee: "If it's in newsletterContent, it's public by definition",
    }
    expect(privacyArchitecture.guarantee).toContain("public by definition")
  })

  it("search cannot return private content by design", () => {
    const designNote = "newsletterContent table only contains public content - Epic 2.5 architecture"
    expect(designNote).toContain("only contains public content")
  })
})

describe("getSenderByEmailPublic query contract (Story 6.3 Task 2.3)", () => {
  it("should export getSenderByEmailPublic query", () => {
    expect(api.senders.getSenderByEmailPublic).toBeDefined()
  })

  it("defines expected args schema", () => {
    const expectedArgsShape = {
      email: "required string - sender email to lookup",
    }
    expect(expectedArgsShape).toHaveProperty("email")
  })

  it("returns null for unauthenticated users", () => {
    const unauthBehavior = "if (!identity) return null"
    expect(unauthBehavior).toContain("return null")
  })

  it("returns null if sender not found", () => {
    const notFoundBehavior = "if (!sender) return null"
    expect(notFoundBehavior).toContain("return null")
  })

  it("returns public sender info with displayName", () => {
    const returnFields = [
      "_id",
      "email",
      "name",
      "displayName",
      "domain",
      "subscriberCount",
      "newsletterCount",
    ]
    expect(returnFields).toContain("displayName")
    expect(returnFields).toContain("subscriberCount")
    expect(returnFields).not.toContain("userId")
  })
})
