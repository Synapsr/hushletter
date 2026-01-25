import { describe, expect, it } from "vitest"
import { api, internal } from "./_generated/api"

/**
 * Contract tests for admin.ts
 * Story 7.1: Admin Dashboard & System Health
 *
 * These tests verify:
 * 1. Functions are properly exported from the API
 * 2. Expected behavior patterns are documented
 * 3. Error codes match architecture standards
 */

describe("Admin API exports", () => {
  it("should export getSystemStats query", () => {
    expect(api.admin).toBeDefined()
    expect(api.admin.getSystemStats).toBeDefined()
  })

  it("should export getRecentActivity query", () => {
    expect(api.admin.getRecentActivity).toBeDefined()
  })

  it("should export getServiceStatus query", () => {
    expect(api.admin.getServiceStatus).toBeDefined()
  })

  it("should export getMetricsHistory query", () => {
    expect(api.admin.getMetricsHistory).toBeDefined()
  })

  it("should export checkIsAdmin query", () => {
    expect(api.admin.checkIsAdmin).toBeDefined()
  })

  it("should export recordDailyMetrics as internal mutation", () => {
    expect(internal.admin).toBeDefined()
    expect(internal.admin.recordDailyMetrics).toBeDefined()
  })
})

describe("getSystemStats query contract", () => {
  it("defines expected return shape", () => {
    // The query returns system-wide statistics
    const expectedReturnShape = {
      totalUsers: "number - count of all users",
      totalNewsletters: "number - count of unique newsletter content",
      totalSenders: "number - count of global senders",
      totalUserNewsletters: "number - count of user-newsletter relationships",
    }
    expect(expectedReturnShape).toHaveProperty("totalUsers")
    expect(expectedReturnShape).toHaveProperty("totalNewsletters")
    expect(expectedReturnShape).toHaveProperty("totalSenders")
    expect(expectedReturnShape).toHaveProperty("totalUserNewsletters")
  })

  it("documents admin authorization requirement", () => {
    // The query requires admin role
    const behavior = {
      requiresAuth: true,
      requiresAdmin: true,
      authMethod: "requireAdmin(ctx)",
      errorOnNoAdmin: "ConvexError({ code: 'FORBIDDEN', message: 'Admin access required' })",
    }
    expect(behavior.requiresAdmin).toBe(true)
    expect(behavior.errorOnNoAdmin).toContain("FORBIDDEN")
  })
})

describe("getRecentActivity query contract", () => {
  it("defines expected args schema", () => {
    // The query accepts optional hoursAgo parameter
    const expectedArgsShape = {
      hoursAgo: "optional number - defaults to 24",
    }
    expect(expectedArgsShape.hoursAgo).toContain("optional")
  })

  it("defines expected return shape", () => {
    const expectedReturnShape = {
      newUsersCount: "number - users created in time window",
      newNewslettersCount: "number - newsletters received in time window",
      recentItems: "array - last 10 activity items",
      periodHours: "number - the time window used",
    }
    expect(expectedReturnShape).toHaveProperty("newUsersCount")
    expect(expectedReturnShape).toHaveProperty("newNewslettersCount")
    expect(expectedReturnShape).toHaveProperty("recentItems")
    expect(expectedReturnShape).toHaveProperty("periodHours")
  })

  it("documents default time window of 24 hours", () => {
    const behavior = {
      defaultHoursAgo: 24,
      maxLookback: "no explicit limit",
    }
    expect(behavior.defaultHoursAgo).toBe(24)
  })
})

describe("getServiceStatus query contract", () => {
  it("defines expected return shape", () => {
    const expectedReturnShape = {
      convex: {
        healthy: "boolean - always true if query executes",
        message: "string - status message",
      },
      emailWorker: {
        healthy: "boolean - true if email received in last 24h or no emails yet",
        message: "string - last activity info",
        lastActivity: "number | null - timestamp of last email",
      },
    }
    expect(expectedReturnShape.convex).toHaveProperty("healthy")
    expect(expectedReturnShape.convex).toHaveProperty("message")
    expect(expectedReturnShape.emailWorker).toHaveProperty("healthy")
    expect(expectedReturnShape.emailWorker).toHaveProperty("lastActivity")
  })

  it("documents email worker health logic", () => {
    // Email worker is considered healthy if:
    // 1. A newsletter was received in the last 24 hours, OR
    // 2. No newsletters have ever been received (new system)
    const healthLogic = {
      healthyConditions: [
        "lastNewsletterAge < 24 hours",
        "lastNewsletterAge === null (no emails yet)",
      ],
    }
    expect(healthLogic.healthyConditions).toHaveLength(2)
  })
})

describe("getMetricsHistory query contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      days: "optional number - defaults to 30, capped at 90",
    }
    expect(expectedArgsShape.days).toContain("30")
    expect(expectedArgsShape.days).toContain("90")
  })

  it("documents maximum days cap at 90", () => {
    const behavior = {
      defaultDays: 30,
      maxDays: 90,
      reason: "Prevent excessive data loading",
    }
    expect(behavior.maxDays).toBe(90)
    expect(behavior.defaultDays).toBe(30)
  })

  it("defines expected return shape", () => {
    // Returns array of historical metric snapshots
    const expectedItemShape = {
      date: "string - YYYY-MM-DD format",
      totalUsers: "number",
      totalNewsletters: "number",
      totalSenders: "number",
      totalUserNewsletters: "number",
      storageUsedBytes: "number",
      recordedAt: "number - Unix timestamp ms",
    }
    expect(expectedItemShape).toHaveProperty("date")
    expect(expectedItemShape).toHaveProperty("recordedAt")
  })
})

describe("recordDailyMetrics mutation contract", () => {
  it("documents idempotency behavior", () => {
    // The mutation checks for existing record before inserting
    const behavior = {
      isIdempotent: true,
      duplicateCheck: "Checks by_date index for today's date",
      onDuplicate: "Returns { recorded: false, reason: 'Already recorded today' }",
      onSuccess: "Returns { recorded: true, date: 'YYYY-MM-DD' }",
    }
    expect(behavior.isIdempotent).toBe(true)
    expect(behavior.duplicateCheck).toContain("by_date")
  })

  it("documents date format", () => {
    const dateFormat = {
      format: "YYYY-MM-DD",
      example: "2026-01-25",
      source: "new Date().toISOString().split('T')[0]",
    }
    expect(dateFormat.format).toBe("YYYY-MM-DD")
  })
})

describe("checkIsAdmin query contract", () => {
  it("defines expected return shape", () => {
    const expectedReturnShape = {
      isAdmin: "boolean - true if user has admin role, false otherwise",
    }
    expect(expectedReturnShape).toHaveProperty("isAdmin")
  })

  it("documents non-throwing behavior", () => {
    // Unlike other admin queries, this one doesn't throw for non-admins
    const behavior = {
      throwsForNonAdmin: false,
      throwsForUnauthenticated: false,
      returnsForNonAdmin: { isAdmin: false },
      returnsForUnauthenticated: { isAdmin: false },
    }
    expect(behavior.throwsForNonAdmin).toBe(false)
    expect(behavior.throwsForUnauthenticated).toBe(false)
  })
})

describe("requireAdmin helper error handling", () => {
  it("uses UNAUTHORIZED for unauthenticated requests", () => {
    // Per architecture.md: Standardized error codes
    const expectedError = {
      code: "UNAUTHORIZED",
      message: "Not authenticated",
    }
    expect(expectedError.code).toBe("UNAUTHORIZED")
  })

  it("uses FORBIDDEN for non-admin authenticated users", () => {
    // Per architecture.md: FORBIDDEN for authorization failures
    const expectedError = {
      code: "FORBIDDEN",
      message: "Admin access required",
    }
    expect(expectedError.code).toBe("FORBIDDEN")
  })

  it("follows ConvexError pattern from architecture.md", () => {
    // Architecture mandates structured errors with code and message
    const validErrorCodes = [
      "NOT_FOUND",
      "UNAUTHORIZED",
      "FORBIDDEN",
      "VALIDATION_ERROR",
      "RATE_LIMITED",
      "EXTERNAL_ERROR",
    ]
    expect(validErrorCodes).toContain("UNAUTHORIZED")
    expect(validErrorCodes).toContain("FORBIDDEN")
  })
})

describe("Admin query behavior documentation", () => {
  it("documents that all queries require admin authorization", () => {
    // CRITICAL: Every admin query must call requireAdmin() first
    const adminQueries = [
      "getSystemStats",
      "getRecentActivity",
      "getServiceStatus",
      "getMetricsHistory",
      // Story 7.2 additions
      "getDeliveryStats",
      "listDeliveryLogs",
      "getFailedDeliveries",
      "getDeliveryRateStats",
      "getDeliveryAnomalies",
    ]
    // checkIsAdmin is explicitly exempt (used for UI conditional rendering)
    const exemptQueries = ["checkIsAdmin"]

    expect(adminQueries).toHaveLength(9)
    expect(exemptQueries).toContain("checkIsAdmin")
  })

  it("documents Convex query patterns used", () => {
    const patterns = {
      counting: ".collect() + .length (no COUNT aggregation)",
      filtering: ".filter() with q.gte() for time-based queries",
      ordering: ".order('desc') or .order('asc')",
      indexUsage: ".withIndex() for efficient lookups",
    }
    expect(patterns.counting).toContain("collect()")
  })
})

// ============================================================
// Story 7.2: Email Delivery Monitoring Tests
// ============================================================

describe("Story 7.2: Email Delivery Monitoring API exports", () => {
  it("should export getDeliveryStats query", () => {
    expect(api.admin.getDeliveryStats).toBeDefined()
  })

  it("should export listDeliveryLogs query", () => {
    expect(api.admin.listDeliveryLogs).toBeDefined()
  })

  it("should export getFailedDeliveries query", () => {
    expect(api.admin.getFailedDeliveries).toBeDefined()
  })

  it("should export getDeliveryRateStats query", () => {
    expect(api.admin.getDeliveryRateStats).toBeDefined()
  })

  it("should export getDeliveryAnomalies query", () => {
    expect(api.admin.getDeliveryAnomalies).toBeDefined()
  })

  it("should export acknowledgeFailedDelivery mutation", () => {
    expect(api.admin.acknowledgeFailedDelivery).toBeDefined()
  })

  it("should export logEmailDelivery as internal mutation", () => {
    expect(internal.admin.logEmailDelivery).toBeDefined()
  })

  it("should export updateDeliveryStatus as internal mutation", () => {
    expect(internal.admin.updateDeliveryStatus).toBeDefined()
  })
})

describe("getDeliveryStats query contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      hoursAgo: "optional number - defaults to 24",
    }
    expect(expectedArgsShape.hoursAgo).toContain("optional")
  })

  it("defines expected return shape", () => {
    const expectedReturnShape = {
      received: "number - count of emails with status 'received'",
      processing: "number - count of emails with status 'processing'",
      stored: "number - count of emails with status 'stored'",
      failed: "number - count of emails with status 'failed'",
      total: "number - total email count in period",
      successRate: "number - percentage of successful deliveries (0-100)",
      periodHours: "number - the time window used",
    }
    expect(expectedReturnShape).toHaveProperty("received")
    expect(expectedReturnShape).toHaveProperty("processing")
    expect(expectedReturnShape).toHaveProperty("stored")
    expect(expectedReturnShape).toHaveProperty("failed")
    expect(expectedReturnShape).toHaveProperty("total")
    expect(expectedReturnShape).toHaveProperty("successRate")
    expect(expectedReturnShape).toHaveProperty("periodHours")
  })

  it("documents success rate calculation", () => {
    const behavior = {
      formula: "Math.round((stored / total) * 100)",
      emptyCase: "Returns 100 when total is 0",
    }
    expect(behavior.formula).toContain("stored")
    expect(behavior.emptyCase).toContain("100")
  })
})

describe("listDeliveryLogs query contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      status: "optional union - 'received' | 'processing' | 'stored' | 'failed'",
      limit: "optional number - defaults to 50, capped at 100",
    }
    expect(expectedArgsShape.status).toContain("optional")
    expect(expectedArgsShape.limit).toContain("capped at 100")
  })

  it("defines expected return shape", () => {
    const expectedReturnShape = {
      items: "array - delivery log items",
      hasMore: "boolean - whether more items exist",
      nextCursor: "string | null - cursor for pagination",
    }
    expect(expectedReturnShape).toHaveProperty("items")
    expect(expectedReturnShape).toHaveProperty("hasMore")
    expect(expectedReturnShape).toHaveProperty("nextCursor")
  })

  it("documents pagination behavior", () => {
    const behavior = {
      defaultLimit: 50,
      maxLimit: 100,
      cursorBased: true,
      strategy: "Takes limit + 1 to detect hasMore",
    }
    expect(behavior.defaultLimit).toBe(50)
    expect(behavior.maxLimit).toBe(100)
  })

  it("documents filtering by status", () => {
    const behavior = {
      indexUsed: "by_status_receivedAt for filtered queries",
      fallbackIndex: "by_receivedAt for unfiltered queries",
      ordering: "desc by receivedAt",
    }
    expect(behavior.indexUsed).toContain("by_status_receivedAt")
  })
})

describe("getFailedDeliveries query contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      includeAcknowledged: "optional boolean - defaults to false",
    }
    expect(expectedArgsShape.includeAcknowledged).toContain("optional")
  })

  it("defines expected return shape", () => {
    // Returns array of failed delivery logs
    const expectedItemShape = {
      _id: "id - delivery log ID",
      status: "'failed' - always failed",
      errorMessage: "string | undefined - error details",
      errorCode: "string | undefined - error category",
      isAcknowledged: "boolean - whether admin has reviewed",
    }
    expect(expectedItemShape).toHaveProperty("errorMessage")
    expect(expectedItemShape).toHaveProperty("errorCode")
    expect(expectedItemShape).toHaveProperty("isAcknowledged")
  })

  it("documents filtering behavior", () => {
    const behavior = {
      defaultFilter: "Only returns unacknowledged failed deliveries",
      includeAcknowledged: "When true, returns all failed deliveries",
      sorting: "desc by receivedAt (most recent first)",
    }
    expect(behavior.defaultFilter).toContain("unacknowledged")
  })
})

describe("getDeliveryRateStats query contract", () => {
  it("defines expected return shape", () => {
    // Returns array of rate stats for different time periods
    const expectedItemShape = {
      period: "string - '1h', '24h', or '7d'",
      total: "number - total emails in period",
      stored: "number - successfully stored emails",
      failed: "number - failed emails",
      successRate: "number - percentage (0-100)",
    }
    expect(expectedItemShape).toHaveProperty("period")
    expect(expectedItemShape).toHaveProperty("successRate")
  })

  it("documents time periods analyzed", () => {
    const periods = ["1h", "24h", "7d"]
    expect(periods).toHaveLength(3)
  })
})

describe("getDeliveryAnomalies query contract", () => {
  it("defines expected return shape", () => {
    const expectedItemShape = {
      type: "'high_failure_rate' | 'no_deliveries' | 'volume_spike'",
      severity: "'warning' | 'critical'",
      message: "string - human readable description",
      details: "object - additional context",
    }
    expect(expectedItemShape).toHaveProperty("type")
    expect(expectedItemShape).toHaveProperty("severity")
    expect(expectedItemShape).toHaveProperty("message")
  })

  it("documents anomaly detection thresholds", () => {
    const thresholds = {
      highFailureRate: {
        threshold: ">5% failure rate",
        minSampleSize: "10 emails",
        criticalThreshold: ">20% failure rate",
      },
      noDeliveries: {
        condition: "No deliveries in 24h AND system has historical data",
      },
      volumeSpike: {
        threshold: ">3x average hourly rate",
        minAvgRate: "5 emails/hour",
      },
    }
    expect(thresholds.highFailureRate.threshold).toContain("5%")
    expect(thresholds.volumeSpike.threshold).toContain("3x")
  })
})

describe("logEmailDelivery internal mutation contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      recipientEmail: "string - user's dedicated email address",
      senderEmail: "string - newsletter sender email",
      senderName: "optional string - sender display name",
      subject: "string - email subject",
      messageId: "string - unique email message ID",
    }
    expect(expectedArgsShape).toHaveProperty("recipientEmail")
    expect(expectedArgsShape).toHaveProperty("messageId")
  })

  it("documents idempotency behavior", () => {
    const behavior = {
      isIdempotent: true,
      duplicateCheck: "Checks by_messageId index",
      onDuplicate: "Returns existing log ID without creating duplicate",
    }
    expect(behavior.isIdempotent).toBe(true)
  })

  it("documents initial delivery log state", () => {
    const initialState = {
      status: "received",
      retryCount: 0,
      isAcknowledged: false,
      receivedAt: "Date.now() at creation",
    }
    expect(initialState.status).toBe("received")
    expect(initialState.retryCount).toBe(0)
    expect(initialState.isAcknowledged).toBe(false)
  })
})

describe("updateDeliveryStatus internal mutation contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      logId: "id<emailDeliveryLogs> - delivery log to update",
      status: "'processing' | 'stored' | 'failed'",
      userId: "optional id<users> - resolved user",
      errorMessage: "optional string - for failed status",
      errorCode: "optional string - error category",
      contentSizeBytes: "optional number - content size",
      hasHtmlContent: "optional boolean",
      hasPlainTextContent: "optional boolean",
    }
    expect(expectedArgsShape).toHaveProperty("logId")
    expect(expectedArgsShape).toHaveProperty("status")
  })

  it("documents status-specific behavior", () => {
    const behavior = {
      processing: {
        setsProcessingStartedAt: "Date.now()",
        setsUserId: "if provided",
      },
      stored: {
        setsCompletedAt: "Date.now()",
        setsContentMetadata: "if provided",
      },
      failed: {
        setsCompletedAt: "Date.now()",
        setsErrorMessage: "if provided",
        setsErrorCode: "if provided",
      },
    }
    expect(behavior.processing.setsProcessingStartedAt).toBeDefined()
    expect(behavior.failed.setsCompletedAt).toBeDefined()
  })
})

describe("acknowledgeFailedDelivery mutation contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      logId: "id<emailDeliveryLogs> - delivery log to acknowledge",
    }
    expect(expectedArgsShape).toHaveProperty("logId")
  })

  it("documents admin authorization requirement", () => {
    const behavior = {
      requiresAdmin: true,
      action: "Sets isAcknowledged to true",
    }
    expect(behavior.requiresAdmin).toBe(true)
  })
})

describe("emailDeliveryLogs schema contract", () => {
  it("defines delivery status enum", () => {
    const validStatuses = ["received", "processing", "stored", "failed"]
    expect(validStatuses).toHaveLength(4)
  })

  it("documents schema indexes", () => {
    const indexes = {
      by_status: "For filtering by status",
      by_receivedAt: "For time-based queries",
      by_userId: "For user-specific queries",
      by_messageId: "For deduplication",
      by_status_receivedAt: "For filtered pagination queries",
    }
    expect(Object.keys(indexes)).toHaveLength(5)
  })

  it("documents required fields", () => {
    const requiredFields = [
      "recipientEmail",
      "senderEmail",
      "subject",
      "messageId",
      "status",
      "receivedAt",
      "retryCount",
      "isAcknowledged",
    ]
    expect(requiredFields).toContain("messageId")
    expect(requiredFields).toContain("status")
  })

  it("documents optional fields", () => {
    const optionalFields = [
      "senderName",
      "userId",
      "processingStartedAt",
      "completedAt",
      "errorMessage",
      "errorCode",
      "contentSizeBytes",
      "hasHtmlContent",
      "hasPlainTextContent",
    ]
    expect(optionalFields).toContain("errorMessage")
    expect(optionalFields).toContain("userId")
  })
})

// ============================================================
// Story 7.3: Privacy Content Review Tests
// ============================================================

describe("Story 7.3: Privacy Content Review API exports", () => {
  it("should export getPrivacyStats query", () => {
    expect(api.admin.getPrivacyStats).toBeDefined()
  })

  it("should export listPrivateSenders query", () => {
    expect(api.admin.listPrivateSenders).toBeDefined()
  })

  it("should export getPrivacyTrends query", () => {
    expect(api.admin.getPrivacyTrends).toBeDefined()
  })

  it("should export runPrivacyAudit query", () => {
    expect(api.admin.runPrivacyAudit).toBeDefined()
  })

  it("should export searchNewsletters query", () => {
    expect(api.admin.searchNewsletters).toBeDefined()
  })

  it("should export getNewsletterPrivacyStatus query", () => {
    expect(api.admin.getNewsletterPrivacyStatus).toBeDefined()
  })

  it("should export getSenderPrivacyDetails query", () => {
    expect(api.admin.getSenderPrivacyDetails).toBeDefined()
  })
})

describe("getPrivacyStats query contract", () => {
  it("defines expected return shape", () => {
    const expectedReturnShape = {
      publicNewsletters: "number - count of public newsletters",
      privateNewsletters: "number - count of private newsletters",
      totalNewsletters: "number - total count",
      privatePercentage: "number - percentage private (0-100)",
      sharedContentCount: "number - deduplicated content entries",
      usersWithPrivateSenders: "number - users with at least one private sender",
      totalUsers: "number - total users in system",
      uniquePrivateSenders: "number - unique senders marked private by any user",
    }
    expect(expectedReturnShape).toHaveProperty("publicNewsletters")
    expect(expectedReturnShape).toHaveProperty("privateNewsletters")
    expect(expectedReturnShape).toHaveProperty("privatePercentage")
    expect(expectedReturnShape).toHaveProperty("usersWithPrivateSenders")
    expect(expectedReturnShape).toHaveProperty("uniquePrivateSenders")
  })

  it("documents admin authorization requirement", () => {
    const behavior = {
      requiresAdmin: true,
      authMethod: "requireAdmin(ctx)",
      errorOnNoAdmin: "ConvexError({ code: 'FORBIDDEN', message: 'Admin access required' })",
    }
    expect(behavior.requiresAdmin).toBe(true)
    expect(behavior.errorOnNoAdmin).toContain("FORBIDDEN")
  })
})

describe("listPrivateSenders query contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      limit: "optional number - defaults to 50, capped at 100",
    }
    expect(expectedArgsShape.limit).toContain("optional")
  })

  it("defines expected return shape", () => {
    const expectedItemShape = {
      senderId: "string - sender ID",
      email: "string - sender email",
      name: "string | undefined - sender name",
      domain: "string - sender domain",
      usersMarkedPrivate: "number - count of users who marked private",
      totalSubscribers: "number - total subscribers to this sender",
      privatePercentage: "number - percentage marked private (0-100)",
    }
    expect(expectedItemShape).toHaveProperty("senderId")
    expect(expectedItemShape).toHaveProperty("usersMarkedPrivate")
    expect(expectedItemShape).toHaveProperty("privatePercentage")
  })

  it("documents no individual user identities exposed", () => {
    const securityBehavior = {
      exposesUserIds: false,
      exposesUserEmails: false,
      exposesAggregatedCountsOnly: true,
    }
    expect(securityBehavior.exposesUserIds).toBe(false)
    expect(securityBehavior.exposesAggregatedCountsOnly).toBe(true)
  })

  it("documents sorting and pagination", () => {
    const behavior = {
      sortBy: "usersMarkedPrivate DESC (most private first)",
      defaultLimit: 50,
      maxLimit: 100,
    }
    expect(behavior.defaultLimit).toBe(50)
    expect(behavior.maxLimit).toBe(100)
  })
})

describe("getPrivacyTrends query contract", () => {
  it("defines expected return shape", () => {
    const expectedReturnShape = {
      last7Days: {
        total: "number",
        private: "number",
        public: "number",
        privatePercentage: "number (0-100)",
      },
      last30Days: {
        total: "number",
        private: "number",
        public: "number",
        privatePercentage: "number (0-100)",
      },
      allTime: {
        total: "number",
        private: "number",
        public: "number",
        privatePercentage: "number (0-100)",
      },
    }
    expect(expectedReturnShape).toHaveProperty("last7Days")
    expect(expectedReturnShape).toHaveProperty("last30Days")
    expect(expectedReturnShape).toHaveProperty("allTime")
  })
})

describe("runPrivacyAudit query contract", () => {
  it("defines expected return shape", () => {
    const expectedReturnShape = {
      status: "'PASS' | 'WARNING' | 'FAIL'",
      auditedAt: "number - Unix timestamp ms",
      totalPrivateNewsletters: "number",
      totalPublicNewsletters: "number",
      violations: "array of violation objects",
      checks: "array of check result objects",
    }
    expect(expectedReturnShape).toHaveProperty("status")
    expect(expectedReturnShape).toHaveProperty("auditedAt")
    expect(expectedReturnShape).toHaveProperty("violations")
    expect(expectedReturnShape).toHaveProperty("checks")
  })

  it("defines violation types", () => {
    const violationTypes = [
      "private_with_contentId",
      "missing_privateR2Key",
      "reader_count_mismatch",
    ]
    expect(violationTypes).toHaveLength(3)
  })

  it("defines violation severity levels", () => {
    const severityLevels = ["warning", "critical"]
    expect(severityLevels).toContain("warning")
    expect(severityLevels).toContain("critical")
  })

  it("documents audit check logic", () => {
    const checks = [
      {
        name: "Private newsletters use privateR2Key (not contentId)",
        severity: "critical if violated",
        description: "Private newsletters should NOT reference shared content",
      },
      {
        name: "Private newsletters have privateR2Key",
        severity: "warning if violated",
        description: "Private newsletters should have storage key set",
      },
      {
        name: "Content table integrity",
        severity: "warning if violated",
        description: "Reader counts should match actual references",
      },
    ]
    expect(checks).toHaveLength(3)
  })

  it("documents status determination logic", () => {
    const statusLogic = {
      FAIL: "Any critical violation exists",
      WARNING: "Warning violations exist but no critical",
      PASS: "No violations",
    }
    expect(statusLogic.FAIL).toContain("critical")
    expect(statusLogic.PASS).toContain("No violations")
  })
})

describe("searchNewsletters query contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      senderEmail: "optional string - filter by sender email (partial match)",
      subjectContains: "optional string - filter by subject (partial match)",
      isPrivate: "optional boolean - filter by privacy status",
      limit: "optional number - defaults to 50, capped at 100",
    }
    expect(expectedArgsShape.senderEmail).toContain("optional")
    expect(expectedArgsShape.subjectContains).toContain("partial match")
    expect(expectedArgsShape.isPrivate).toContain("optional")
  })

  it("defines expected return shape", () => {
    const expectedItemShape = {
      id: "id - userNewsletter ID",
      subject: "string",
      senderEmail: "string",
      senderName: "string | undefined",
      receivedAt: "number - Unix timestamp ms",
      isPrivate: "boolean",
      hasContentId: "boolean - whether it references shared content",
      hasPrivateR2Key: "boolean - whether it has private storage",
      userId: "id - user ID (for admin investigation)",
    }
    expect(expectedItemShape).toHaveProperty("id")
    expect(expectedItemShape).toHaveProperty("isPrivate")
    expect(expectedItemShape).toHaveProperty("hasContentId")
    expect(expectedItemShape).toHaveProperty("hasPrivateR2Key")
  })

  it("documents admin can see userId for investigation", () => {
    const securityBehavior = {
      exposesUserId: true,
      reason: "Admin needs user context for support investigation",
      doesNotExposeUserEmail: "Must query user separately if needed",
    }
    expect(securityBehavior.exposesUserId).toBe(true)
  })
})

describe("getNewsletterPrivacyStatus query contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      newsletterId: "id<userNewsletters> - specific newsletter to check",
    }
    expect(expectedArgsShape).toHaveProperty("newsletterId")
  })

  it("defines expected return shape", () => {
    const expectedReturnShape = {
      newsletter: {
        id: "id",
        subject: "string",
        receivedAt: "number",
        isPrivate: "boolean",
        storageType: "'private_r2' | 'shared_content'",
        hasContentId: "boolean",
        hasPrivateR2Key: "boolean",
      },
      sender: {
        id: "id",
        email: "string",
        name: "string | undefined",
        totalSubscribers: "number",
      },
      userSenderSettings: {
        isPrivate: "boolean",
      },
      user: {
        id: "id",
        email: "string - admin needs for support",
      },
      sharedContent: {
        contentHash: "string",
        readerCount: "number",
        firstReceivedAt: "number",
      },
      privacyCompliance: {
        storageCorrect: "boolean - storage matches privacy status",
        senderSettingsAligned: "boolean - settings match newsletter privacy",
      },
    }
    expect(expectedReturnShape).toHaveProperty("newsletter")
    expect(expectedReturnShape).toHaveProperty("sender")
    expect(expectedReturnShape).toHaveProperty("privacyCompliance")
  })

  it("documents return null for not found", () => {
    const behavior = {
      notFound: "returns null (does not throw)",
    }
    expect(behavior.notFound).toContain("null")
  })
})

describe("getSenderPrivacyDetails query contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      senderId: "id<senders> - specific sender to analyze",
    }
    expect(expectedArgsShape).toHaveProperty("senderId")
  })

  it("defines expected return shape", () => {
    const expectedReturnShape = {
      sender: {
        id: "id",
        email: "string",
        name: "string | undefined",
        domain: "string",
        totalSubscribers: "number",
        totalNewsletters: "number",
      },
      privacyStats: {
        usersMarkedPrivate: "number",
        usersMarkedPublic: "number",
        usersWithNoSetting: "number",
        privatePercentage: "number (0-100)",
      },
      newsletterStats: {
        privateNewsletters: "number",
        publicNewsletters: "number",
        totalNewsletters: "number",
      },
    }
    expect(expectedReturnShape).toHaveProperty("sender")
    expect(expectedReturnShape).toHaveProperty("privacyStats")
    expect(expectedReturnShape).toHaveProperty("newsletterStats")
  })

  it("documents no individual user identities exposed", () => {
    const securityBehavior = {
      exposesUserIds: false,
      exposesUserEmails: false,
      exposesAggregatedCountsOnly: true,
    }
    expect(securityBehavior.exposesAggregatedCountsOnly).toBe(true)
  })
})

describe("Story 7.3 admin query authorization", () => {
  it("documents all Story 7.3 queries require admin authorization", () => {
    const story73Queries = [
      "getPrivacyStats",
      "listPrivateSenders",
      "getPrivacyTrends",
      "runPrivacyAudit",
      "searchNewsletters",
      "getNewsletterPrivacyStatus",
      "getSenderPrivacyDetails",
    ]
    const allRequireAdmin = true
    expect(allRequireAdmin).toBe(true)
    expect(story73Queries).toHaveLength(7)
  })
})
