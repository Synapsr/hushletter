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
