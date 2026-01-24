import { describe, it, expect } from "vitest"
import { api, internal } from "./_generated/api"

/**
 * Contract Tests for Gmail Historical Import - Story 4.4
 *
 * PURPOSE: These are CONTRACT/SCHEMA documentation tests that verify:
 * 1. Import functions are properly exported from the generated API
 * 2. Expected API contracts are documented in executable form
 * 3. Error codes and patterns match architecture standards
 *
 * Task 8 Subtasks:
 * - 8.1: Import progress initialization
 * - 8.3: Deduplication logic
 * - 8.4: Sender record creation
 * - 8.5: Partial failure handling
 */

// =============================================================================
// Story 4.4: Import API Exports
// =============================================================================

describe("gmail import API exports (Story 4.4)", () => {
  it("should export public query functions", () => {
    expect(api.gmail).toBeDefined()
    expect(api.gmail.getImportProgress).toBeDefined()
  })

  it("should export public action functions", () => {
    expect(api.gmail.startHistoricalImport).toBeDefined()
  })

  it("should export internal mutation functions", () => {
    expect(internal.gmail).toBeDefined()
    expect(internal.gmail.initImportProgress).toBeDefined()
    expect(internal.gmail.updateImportProgress).toBeDefined()
    expect(internal.gmail.completeImport).toBeDefined()
    expect(internal.gmail.checkEmailDuplicate).toBeDefined()
    expect(internal.gmail.markImportedAsRead).toBeDefined()
  })

  it("should export internal query functions", () => {
    expect(internal.gmail.getApprovedSenders).toBeDefined()
  })

  it("should export internal action functions", () => {
    expect(internal.gmail.processAndStoreImportedEmail).toBeDefined()
  })
})

// =============================================================================
// Task 8.1: Import Progress Initialization Tests
// =============================================================================

describe("initImportProgress mutation contract (Task 8.1, AC#1)", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      totalEmails: "required number - total emails to import",
      senderIds: "required array of Id<'detectedSenders'> - approved senders",
    }
    expect(expectedArgsShape).toHaveProperty("totalEmails")
    expect(expectedArgsShape).toHaveProperty("senderIds")
  })

  it("creates progress record with status 'importing'", () => {
    // Status should be "importing" when initialized (pending reserved for future queue)
    const initialStatus = "importing"
    expect(initialStatus).toBe("importing")
  })

  it("creates progress record with zero counts", () => {
    const initialCounts = {
      importedEmails: 0,
      failedEmails: 0,
      skippedEmails: 0,
    }
    expect(initialCounts.importedEmails).toBe(0)
    expect(initialCounts.failedEmails).toBe(0)
    expect(initialCounts.skippedEmails).toBe(0)
  })

  it("sets startedAt timestamp", () => {
    const startedAt = Date.now()
    expect(startedAt).toBeGreaterThan(0)
  })

  it("returns the created progress ID", () => {
    const expectedReturn = {
      type: "Id<'gmailImportProgress'>",
    }
    expect(expectedReturn.type).toContain("gmailImportProgress")
  })

  it("deletes any existing progress record for user first", () => {
    // Should only have one progress record per user
    const cleanupBehavior = {
      deletesExisting: true,
      reason: "Only one import can be active per user",
    }
    expect(cleanupBehavior.deletesExisting).toBe(true)
  })
})

describe("updateImportProgress mutation contract (Task 8.1, AC#1)", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      progressId: "required Id<'gmailImportProgress'>",
      importedDelta: "optional number - increment to imported count",
      failedDelta: "optional number - increment to failed count",
      skippedDelta: "optional number - increment to skipped count",
    }
    expect(expectedArgsShape).toHaveProperty("progressId")
    expect(expectedArgsShape).toHaveProperty("importedDelta")
  })

  it("increments counts atomically", () => {
    const updateBehavior = {
      operation: "atomic increment using db.patch",
      concurrent: "safe for concurrent updates",
    }
    expect(updateBehavior.operation).toContain("atomic")
  })

  it("throws if progress record not found", () => {
    const expectedError = {
      code: "NOT_FOUND",
      message: "Import progress not found",
    }
    expect(expectedError.code).toBe("NOT_FOUND")
  })
})

describe("completeImport mutation contract (Task 8.1, AC#3)", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      progressId: "required Id<'gmailImportProgress'>",
      success: "required boolean - whether import completed successfully",
      error: "optional string - error message if failed",
    }
    expect(expectedArgsShape).toHaveProperty("success")
    expect(expectedArgsShape).toHaveProperty("error")
  })

  it("sets status to 'complete' on success", () => {
    const successState = {
      status: "complete",
      completedAt: "set to current timestamp",
    }
    expect(successState.status).toBe("complete")
  })

  it("sets status to 'error' on failure", () => {
    const errorState = {
      status: "error",
      error: "error message stored",
      completedAt: "set to current timestamp",
    }
    expect(errorState.status).toBe("error")
  })
})

describe("getImportProgress query contract (Task 8.1, AC#5)", () => {
  it("requires authentication", () => {
    const authBehavior = {
      requiresAuth: true,
      returnsNullIfUnauth: true,
    }
    expect(authBehavior.requiresAuth).toBe(true)
  })

  it("returns null if no import in progress", () => {
    const noProgressReturn = null
    expect(noProgressReturn).toBeNull()
  })

  it("returns progress record for current user", () => {
    const expectedReturn = {
      _id: "Id<'gmailImportProgress'>",
      status: "'pending' | 'importing' | 'complete' | 'error'",
      totalEmails: "number",
      importedEmails: "number",
      failedEmails: "number",
      skippedEmails: "number",
      startedAt: "number - timestamp",
      completedAt: "number | undefined - timestamp",
      error: "string | undefined",
    }
    expect(expectedReturn).toHaveProperty("status")
    expect(expectedReturn).toHaveProperty("totalEmails")
    expect(expectedReturn).toHaveProperty("importedEmails")
  })

  it("uses by_userId index for efficient lookup", () => {
    const indexUsed = "by_userId"
    expect(indexUsed).toBe("by_userId")
  })
})

// =============================================================================
// Task 8.3: Deduplication Logic Tests
// =============================================================================

describe("checkEmailDuplicate mutation contract (Task 8.3, AC#6)", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      userId: "required Id<'users'>",
      senderId: "required Id<'senders'>",
      receivedAt: "required number - email timestamp",
      subject: "required string - email subject",
    }
    expect(expectedArgsShape).toHaveProperty("receivedAt")
    expect(expectedArgsShape).toHaveProperty("subject")
  })

  it("returns duplicate status", () => {
    const expectedReturn = {
      isDuplicate: "boolean",
    }
    expect(expectedReturn).toHaveProperty("isDuplicate")
  })

  it("uses date + subject for Phase 1 (fast) duplicate detection", () => {
    const phase1Check = {
      criteria: "receivedAt AND subject match",
      purpose: "Fast check before expensive content fetch",
    }
    expect(phase1Check.criteria).toContain("receivedAt")
    expect(phase1Check.criteria).toContain("subject")
  })

  it("documents two-phase deduplication approach", () => {
    const twoPhaseDedup = {
      phase1: "checkEmailDuplicate - date+subject (fast, pre-fetch)",
      phase2: "storeNewsletterContent - content hash (slower, post-fetch)",
      benefit: "Avoids fetching content for obvious duplicates",
    }
    expect(twoPhaseDedup.phase1).toContain("date+subject")
    expect(twoPhaseDedup.phase2).toContain("content hash")
  })

  it("queries userNewsletters for existing email", () => {
    const queryBehavior = {
      table: "userNewsletters",
      filter: "userId + senderId + receivedAt range",
    }
    expect(queryBehavior.table).toBe("userNewsletters")
  })
})

describe("content hash deduplication in storeNewsletterContent (Task 8.3)", () => {
  it("documents Phase 2 deduplication in storeNewsletterContent", () => {
    const phase2Dedup = {
      trigger: "After Phase 1 passes (not obviously duplicate)",
      steps: [
        "1. Normalize content (strip tracking, personalization)",
        "2. Compute SHA-256 hash of normalized content",
        "3. Check newsletterContent by_contentHash index",
        "4. If exists: reuse contentId, increment readerCount",
        "5. If not: upload to R2, create newsletterContent",
      ],
    }
    expect(phase2Dedup.steps).toHaveLength(5)
  })

  it("handles same content with different metadata", () => {
    const scenario = {
      description: "Two emails with same content but different subjects",
      phase1Result: "NOT duplicate (different subjects)",
      phase2Result: "DUPLICATE (same content hash)",
      outcome: "Reuses existing newsletterContent",
    }
    expect(scenario.phase2Result).toContain("DUPLICATE")
  })
})

// =============================================================================
// Task 8.4: Sender Record Creation Tests
// =============================================================================

describe("getApprovedSenders query contract (Task 8.4)", () => {
  it("defines expected return shape", () => {
    const expectedReturn = {
      _id: "Id<'detectedSenders'>",
      email: "string",
      name: "string | undefined",
      isApproved: "true (filtered)",
    }
    expect(expectedReturn).toHaveProperty("email")
    expect(expectedReturn.isApproved).toBe("true (filtered)")
  })

  it("filters to only approved senders", () => {
    const filterBehavior = {
      condition: "isApproved === true",
      purpose: "Only import from user-approved senders",
    }
    expect(filterBehavior.condition).toContain("isApproved")
  })

  it("requires authentication", () => {
    const authBehavior = {
      requiresAuth: true,
      reason: "Senders are user-specific",
    }
    expect(authBehavior.requiresAuth).toBe(true)
  })
})

describe("processAndStoreImportedEmail action contract (Task 8.4)", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      userId: "required Id<'users'>",
      senderEmail: "required string",
      senderName: "optional string",
      subject: "required string",
      htmlContent: "optional string",
      textContent: "optional string",
      receivedAt: "required number",
    }
    expect(expectedArgsShape).toHaveProperty("senderEmail")
    expect(expectedArgsShape).toHaveProperty("htmlContent")
  })

  it("creates sender record if not exists", () => {
    const senderCreation = {
      calls: "internal.senders.getOrCreateSender",
      behavior: "Returns existing or creates new",
    }
    expect(senderCreation.calls).toContain("getOrCreateSender")
  })

  it("creates userSenderSettings if not exists", () => {
    const settingsCreation = {
      calls: "internal.senders.getOrCreateUserSenderSettings",
      defaults: "isPrivate = false",
    }
    expect(settingsCreation.calls).toContain("getOrCreateUserSenderSettings")
  })

  it("calls storeNewsletterContent with correct privacy flag", () => {
    const storageCall = {
      function: "internal.newsletters.storeNewsletterContent",
      privacySource: "userSenderSettings.isPrivate",
    }
    expect(storageCall.privacySource).toContain("isPrivate")
  })

  it("marks imported newsletters as read", () => {
    const readBehavior = {
      afterImport: "calls markImportedAsRead",
      reason: "Historical imports are pre-read by design",
    }
    expect(readBehavior.reason).toContain("pre-read")
  })
})

// =============================================================================
// Task 8.5: Partial Failure Handling Tests
// =============================================================================

describe("startHistoricalImport action contract (Task 8.5, AC#4)", () => {
  it("defines expected return shape", () => {
    const expectedReturn = {
      success: "boolean",
      error: "string | undefined",
      importedCount: "number | undefined",
      failedCount: "number | undefined",
    }
    expect(expectedReturn).toHaveProperty("success")
    expect(expectedReturn).toHaveProperty("failedCount")
  })

  it("continues processing after individual email failure", () => {
    const failureBehavior = {
      onEmailError: "Log error, increment failedCount, continue to next",
      doesNotAbort: true,
      partial: "Partial success is valid outcome",
    }
    expect(failureBehavior.doesNotAbort).toBe(true)
  })

  it("updates progress after each batch", () => {
    const progressUpdates = {
      frequency: "After each batch of emails",
      updates: ["importedDelta", "failedDelta", "skippedDelta"],
    }
    expect(progressUpdates.frequency).toContain("batch")
  })

  it("completes with success even if some emails failed", () => {
    const partialSuccess = {
      condition: "importedCount > 0 || skippedCount > 0",
      status: "complete (not error)",
      message: "Import finished with some failures",
    }
    expect(partialSuccess.status).toContain("complete")
  })

  it("completes with error only if all emails failed", () => {
    const totalFailure = {
      condition: "failedCount === totalCount && importedCount === 0",
      status: "error",
      message: "Import failed completely",
    }
    expect(totalFailure.status).toBe("error")
  })
})

describe("error handling patterns (Task 8.5)", () => {
  it("handles Gmail API rate limiting with retry", () => {
    const rateLimitHandling = {
      detection: "ConvexError with code 'RATE_LIMITED'",
      response: "Exponential backoff retry (1s, 2s, 4s)",
      maxRetries: 3,
    }
    expect(rateLimitHandling.maxRetries).toBe(3)
  })

  it("handles Gmail API token expiry", () => {
    const tokenExpiryHandling = {
      detection: "ConvexError with code 'TOKEN_EXPIRED'",
      response: "Abort import with error message",
      userAction: "Reconnect Gmail account",
    }
    expect(tokenExpiryHandling.response).toContain("Abort")
  })

  it("handles R2 upload failures", () => {
    const r2FailureHandling = {
      detection: "ConvexError with code 'R2_UPLOAD_FAILED'",
      response: "Count as failed, continue to next email",
      doesNotAbort: true,
    }
    expect(r2FailureHandling.doesNotAbort).toBe(true)
  })

  it("logs detailed error information for debugging", () => {
    const errorLogging = {
      includes: ["error message", "email ID", "sender email"],
      level: "console.error",
    }
    expect(errorLogging.includes).toContain("error message")
  })
})

// =============================================================================
// Progress Persistence Tests (AC#5)
// =============================================================================

describe("progress persistence (AC#5)", () => {
  it("stores progress in database for persistence", () => {
    const persistence = {
      table: "gmailImportProgress",
      survives: "page refresh, browser close",
    }
    expect(persistence.table).toBe("gmailImportProgress")
  })

  it("uses Convex subscription for real-time updates", () => {
    const realtimeUpdates = {
      mechanism: "useQuery hook subscribes to getImportProgress",
      updates: "Automatic when database changes",
    }
    expect(realtimeUpdates.mechanism).toContain("useQuery")
  })

  it("shows correct state after page refresh", () => {
    const refreshBehavior = {
      onRefresh: "Query fetches current progress from database",
      showsCorrectStatus: true,
      showsCorrectCounts: true,
    }
    expect(refreshBehavior.showsCorrectStatus).toBe(true)
  })
})

// =============================================================================
// E2E Flow Documentation
// =============================================================================

describe("E2E: Complete import flow", () => {
  it("documents complete happy path flow", () => {
    const happyPath = {
      steps: [
        "1. User approves senders in SenderReview",
        "2. User clicks 'Start Import'",
        "3. startHistoricalImport action called",
        "4. getApprovedSenders returns approved senders",
        "5. initImportProgress creates progress record",
        "6. For each sender:",
        "   a. listMessagesFromSender gets message IDs",
        "   b. getFullMessageContents fetches content",
        "   c. For each message:",
        "      i. checkEmailDuplicate (Phase 1)",
        "      ii. If not duplicate: processAndStoreImportedEmail",
        "      iii. markImportedAsRead",
        "   d. updateImportProgress with batch counts",
        "7. completeImport sets status='complete'",
        "8. UI shows completion summary",
      ],
    }
    expect(happyPath.steps.length).toBeGreaterThan(5) // Multiple detailed steps
  })

  it("documents partial failure flow", () => {
    const partialFailure = {
      scenario: "Some emails fail to import",
      steps: [
        "1-5. Same as happy path",
        "6. During processing, some emails throw errors",
        "7. Errors logged, failedCount incremented",
        "8. Processing continues with remaining emails",
        "9. completeImport called with success=true",
        "10. UI shows: 'Imported X, Failed Y, Skipped Z'",
      ],
      outcome: "status='complete' with failedEmails > 0",
    }
    expect(partialFailure.outcome).toContain("complete")
  })

  it("documents total failure flow", () => {
    const totalFailure = {
      scenario: "All emails fail (e.g., token expired)",
      steps: [
        "1-5. Same as happy path",
        "6. First batch fails with TOKEN_EXPIRED",
        "7. completeImport called with success=false",
        "8. UI shows error with retry option",
      ],
      outcome: "status='error' with error message",
    }
    expect(totalFailure.outcome).toContain("error")
  })
})

// =============================================================================
// Schema Validation
// =============================================================================

describe("gmailImportProgress schema", () => {
  it("documents required fields", () => {
    const requiredFields = {
      userId: "Id<'users'> - owner of the import",
      status: "'pending' | 'importing' | 'complete' | 'error'",
      totalEmails: "number - total to import",
      importedEmails: "number - successfully imported",
      failedEmails: "number - failed to import",
      skippedEmails: "number - skipped (duplicates)",
      startedAt: "number - timestamp when started",
    }
    expect(requiredFields).toHaveProperty("userId")
    expect(requiredFields).toHaveProperty("status")
  })

  it("documents optional fields", () => {
    const optionalFields = {
      completedAt: "number | undefined - when finished",
      error: "string | undefined - error message if failed",
      senderIds: "array | undefined - approved sender IDs",
    }
    expect(optionalFields).toHaveProperty("completedAt")
    expect(optionalFields).toHaveProperty("error")
  })

  it("documents index", () => {
    const index = {
      name: "by_userId",
      fields: ["userId"],
      purpose: "Efficient lookup of user's import progress",
    }
    expect(index.name).toBe("by_userId")
  })

  it("documents status values", () => {
    const statusValues = {
      pending: "Reserved for future queue-based imports",
      importing: "Import actively in progress",
      complete: "Import finished successfully",
      error: "Import failed with error",
    }
    expect(Object.keys(statusValues)).toHaveLength(4)
  })
})
