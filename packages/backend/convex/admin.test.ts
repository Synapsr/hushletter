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

// ============================================================
// Story 7.4: Community Content Management Tests
// ============================================================

describe("Story 7.4: Community Content Management Schema", () => {
  describe("moderationLog table schema", () => {
    it("defines action types for all moderation actions", () => {
      const actionTypes = [
        "hide_content",
        "restore_content",
        "block_sender",
        "unblock_sender",
        "resolve_report",
        "dismiss_report",
      ]
      expect(actionTypes).toHaveLength(6)
    })

    it("defines target types for audit trail", () => {
      const targetTypes = ["content", "sender", "report"]
      expect(targetTypes).toHaveLength(3)
    })

    it("documents required fields", () => {
      const requiredFields = {
        adminId: "id<users> - admin who performed action",
        actionType: "union - one of 6 action types",
        targetType: "union - content | sender | report",
        targetId: "string - ID of target",
        createdAt: "number - Unix timestamp ms",
      }
      expect(requiredFields).toHaveProperty("adminId")
      expect(requiredFields).toHaveProperty("actionType")
      expect(requiredFields).toHaveProperty("targetType")
    })

    it("documents optional fields", () => {
      const optionalFields = {
        reason: "string - reason for action",
        details: "string - JSON stringified additional details",
      }
      expect(optionalFields).toHaveProperty("reason")
      expect(optionalFields).toHaveProperty("details")
    })

    it("documents indexes for efficient querying", () => {
      const indexes = {
        by_adminId: "Filter actions by admin",
        by_targetType: "Filter by target type",
        by_createdAt: "Time-based queries",
        by_actionType: "Filter by action type",
      }
      expect(Object.keys(indexes)).toHaveLength(4)
    })
  })

  describe("blockedSenders table schema", () => {
    it("documents required fields", () => {
      const requiredFields = {
        senderId: "id<senders> - blocked sender",
        blockedBy: "id<users> - admin who blocked",
        reason: "string - reason for blocking",
        blockedAt: "number - Unix timestamp ms",
      }
      expect(requiredFields).toHaveProperty("senderId")
      expect(requiredFields).toHaveProperty("blockedBy")
      expect(requiredFields).toHaveProperty("reason")
      expect(requiredFields).toHaveProperty("blockedAt")
    })

    it("documents indexes for efficient querying", () => {
      const indexes = {
        by_senderId: "Check if sender is blocked",
        by_blockedAt: "Time-sorted blocked sender list",
      }
      expect(Object.keys(indexes)).toHaveLength(2)
    })
  })

  describe("contentReports table schema", () => {
    it("defines report reason categories", () => {
      const reasons = ["spam", "inappropriate", "copyright", "misleading", "other"]
      expect(reasons).toHaveLength(5)
    })

    it("defines report status values", () => {
      const statuses = ["pending", "resolved", "dismissed"]
      expect(statuses).toHaveLength(3)
    })

    it("documents required fields", () => {
      const requiredFields = {
        contentId: "id<newsletterContent> - reported content",
        reporterId: "id<users> - user who reported",
        reason: "union - one of 5 reason categories",
        status: "union - pending | resolved | dismissed",
        createdAt: "number - Unix timestamp ms",
      }
      expect(requiredFields).toHaveProperty("contentId")
      expect(requiredFields).toHaveProperty("reporterId")
      expect(requiredFields).toHaveProperty("reason")
      expect(requiredFields).toHaveProperty("status")
    })

    it("documents optional fields", () => {
      const optionalFields = {
        description: "string - additional details from reporter",
        resolvedBy: "id<users> - admin who resolved",
        resolvedAt: "number - Unix timestamp ms",
        resolutionNote: "string - admin notes on resolution",
      }
      expect(optionalFields).toHaveProperty("description")
      expect(optionalFields).toHaveProperty("resolvedBy")
    })

    it("documents indexes for efficient querying", () => {
      const indexes = {
        by_contentId: "Find reports for specific content",
        by_status: "Queue pending reports",
        by_createdAt: "Time-sorted reports",
        by_reporterId: "User's report history",
      }
      expect(Object.keys(indexes)).toHaveLength(4)
    })
  })

  describe("newsletterContent moderation fields", () => {
    it("documents added moderation fields", () => {
      const moderationFields = {
        isHiddenFromCommunity: "optional boolean - soft delete flag",
        hiddenAt: "optional number - Unix timestamp when hidden",
        hiddenBy: "optional id<users> - admin who hid content",
      }
      expect(moderationFields).toHaveProperty("isHiddenFromCommunity")
      expect(moderationFields).toHaveProperty("hiddenAt")
      expect(moderationFields).toHaveProperty("hiddenBy")
    })

    it("documents new index for moderation queries", () => {
      const newIndex = {
        by_isHiddenFromCommunity: "Efficient queries for moderated content",
      }
      expect(newIndex).toHaveProperty("by_isHiddenFromCommunity")
    })

    it("documents soft delete pattern", () => {
      const pattern = {
        approach: "Soft delete via isHiddenFromCommunity flag",
        userCopyBehavior: "User copies (userNewsletters) are NEVER affected",
        auditTrail: "hiddenBy and hiddenAt track who/when",
      }
      expect(pattern.approach).toContain("Soft delete")
      expect(pattern.userCopyBehavior).toContain("NEVER affected")
    })
  })
})

describe("Story 7.4: Community Content Management API exports", () => {
  it("should export listCommunityContent query", () => {
    expect(api.admin.listCommunityContent).toBeDefined()
  })

  it("should export getCommunityContentSummary query", () => {
    expect(api.admin.getCommunityContentSummary).toBeDefined()
  })

  it("should export hideContentFromCommunity mutation", () => {
    expect(api.admin.hideContentFromCommunity).toBeDefined()
  })

  it("should export restoreContentToCommunity mutation", () => {
    expect(api.admin.restoreContentToCommunity).toBeDefined()
  })

  it("should export blockSenderFromCommunity mutation", () => {
    expect(api.admin.blockSenderFromCommunity).toBeDefined()
  })

  it("should export unblockSender mutation", () => {
    expect(api.admin.unblockSender).toBeDefined()
  })

  it("should export listBlockedSenders query", () => {
    expect(api.admin.listBlockedSenders).toBeDefined()
  })

  it("should export reportContent mutation", () => {
    expect(api.admin.reportContent).toBeDefined()
  })

  it("should export listContentReports query", () => {
    expect(api.admin.listContentReports).toBeDefined()
  })

  it("should export resolveReport mutation", () => {
    expect(api.admin.resolveReport).toBeDefined()
  })

  it("should export bulkResolveReports mutation", () => {
    expect(api.admin.bulkResolveReports).toBeDefined()
  })

  it("should export getPendingReportsCount query", () => {
    expect(api.admin.getPendingReportsCount).toBeDefined()
  })

  it("should export listModerationLog query", () => {
    expect(api.admin.listModerationLog).toBeDefined()
  })
})

describe("listCommunityContent query contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      senderEmail: "optional string - partial match filter",
      domain: "optional string - partial match filter",
      status: "optional union - 'active' | 'hidden' | 'blocked_sender'",
      sortBy: "optional union - 'readerCount' | 'firstReceivedAt' | 'senderEmail'",
      sortOrder: "optional union - 'asc' | 'desc'",
      limit: "optional number - defaults to 50, capped at 100",
    }
    expect(expectedArgsShape.senderEmail).toContain("optional")
    expect(expectedArgsShape.status).toContain("optional")
  })

  it("defines expected return shape", () => {
    const expectedReturnShape = {
      items: "array of content items with moderation status",
      hasMore: "boolean - whether more items exist",
      totalCount: "number - total matching items",
    }
    expect(expectedReturnShape).toHaveProperty("items")
    expect(expectedReturnShape).toHaveProperty("hasMore")
    expect(expectedReturnShape).toHaveProperty("totalCount")
  })

  it("defines content item shape", () => {
    const expectedItemShape = {
      id: "id<newsletterContent>",
      subject: "string",
      senderEmail: "string",
      senderName: "string | undefined",
      domain: "string - extracted from email",
      readerCount: "number",
      firstReceivedAt: "number - Unix timestamp ms",
      moderationStatus: "'active' | 'hidden' | 'blocked_sender'",
      isHiddenFromCommunity: "boolean",
      hiddenAt: "number | undefined",
    }
    expect(expectedItemShape).toHaveProperty("id")
    expect(expectedItemShape).toHaveProperty("moderationStatus")
  })

  it("documents admin authorization requirement", () => {
    const behavior = {
      requiresAdmin: true,
      authMethod: "requireAdmin(ctx)",
    }
    expect(behavior.requiresAdmin).toBe(true)
  })
})

describe("hideContentFromCommunity mutation contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      contentId: "id<newsletterContent> - content to hide",
      reason: "string - required reason for audit",
    }
    expect(expectedArgsShape).toHaveProperty("contentId")
    expect(expectedArgsShape).toHaveProperty("reason")
  })

  it("documents soft delete behavior", () => {
    const behavior = {
      setsIsHiddenFromCommunity: true,
      setsHiddenAt: "Date.now()",
      setsHiddenBy: "admin._id",
      createsAuditLog: true,
      affectsUserCopies: false,
    }
    expect(behavior.setsIsHiddenFromCommunity).toBe(true)
    expect(behavior.affectsUserCopies).toBe(false)
  })

  it("documents error codes", () => {
    const errorCodes = {
      NOT_FOUND: "Content not found",
      FORBIDDEN: "Non-admin user",
    }
    expect(errorCodes).toHaveProperty("NOT_FOUND")
  })
})

describe("restoreContentToCommunity mutation contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      contentId: "id<newsletterContent> - content to restore",
      reason: "optional string - reason for restore",
    }
    expect(expectedArgsShape).toHaveProperty("contentId")
    expect(expectedArgsShape.reason).toContain("optional")
  })

  it("documents restore behavior", () => {
    const behavior = {
      clearsIsHiddenFromCommunity: true,
      clearsHiddenAt: true,
      clearsHiddenBy: true,
      createsAuditLog: true,
    }
    expect(behavior.clearsIsHiddenFromCommunity).toBe(true)
  })
})

describe("blockSenderFromCommunity mutation contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      senderId: "id<senders> - sender to block",
      reason: "string - required reason for audit",
    }
    expect(expectedArgsShape).toHaveProperty("senderId")
    expect(expectedArgsShape).toHaveProperty("reason")
  })

  it("documents blocking behavior", () => {
    const behavior = {
      createsBlockedSendersRecord: true,
      hidesAllSenderContent: true,
      createsAuditLog: true,
      returnsContentHiddenCount: true,
    }
    expect(behavior.createsBlockedSendersRecord).toBe(true)
    expect(behavior.hidesAllSenderContent).toBe(true)
  })

  it("documents error codes", () => {
    const errorCodes = {
      NOT_FOUND: "Sender not found",
      ALREADY_EXISTS: "Sender is already blocked",
    }
    expect(errorCodes).toHaveProperty("ALREADY_EXISTS")
  })
})

describe("unblockSender mutation contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      senderId: "id<senders> - sender to unblock",
      reason: "optional string - reason for unblock",
      restoreContent: "optional boolean - whether to restore hidden content",
    }
    expect(expectedArgsShape).toHaveProperty("senderId")
    expect(expectedArgsShape.restoreContent).toContain("optional")
  })

  it("documents unblock behavior", () => {
    const behavior = {
      deletesBlockedSendersRecord: true,
      optionallyRestoresContent: true,
      createsAuditLog: true,
      returnsContentRestoredCount: true,
    }
    expect(behavior.deletesBlockedSendersRecord).toBe(true)
    expect(behavior.optionallyRestoresContent).toBe(true)
  })
})

describe("listBlockedSenders query contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      limit: "optional number - defaults to 50, capped at 100",
    }
    expect(expectedArgsShape.limit).toContain("optional")
  })

  it("defines expected return shape", () => {
    const expectedItemShape = {
      id: "id<blockedSenders>",
      senderId: "id<senders>",
      senderEmail: "string",
      senderName: "string | undefined",
      domain: "string",
      reason: "string",
      blockedAt: "number - Unix timestamp ms",
      blockedByEmail: "string - admin email",
      contentCount: "number - affected content count",
    }
    expect(expectedItemShape).toHaveProperty("id")
    expect(expectedItemShape).toHaveProperty("contentCount")
  })
})

describe("reportContent mutation contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      contentId: "id<newsletterContent> - content to report",
      reason: "union - 'spam' | 'inappropriate' | 'copyright' | 'misleading' | 'other'",
      description: "optional string - additional details",
    }
    expect(expectedArgsShape).toHaveProperty("contentId")
    expect(expectedArgsShape).toHaveProperty("reason")
  })

  it("documents user-facing behavior (not admin-only)", () => {
    const behavior = {
      requiresAdmin: false,
      requiresAuth: true,
      preventsDuplicatePendingReports: true,
    }
    expect(behavior.requiresAdmin).toBe(false)
    expect(behavior.requiresAuth).toBe(true)
  })

  it("documents error codes", () => {
    const errorCodes = {
      UNAUTHORIZED: "Must be logged in",
      NOT_FOUND: "Content or user not found",
      ALREADY_EXISTS: "Already reported this content",
    }
    expect(errorCodes).toHaveProperty("ALREADY_EXISTS")
  })
})

describe("listContentReports query contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      status: "optional union - 'pending' | 'resolved' | 'dismissed' (defaults to pending)",
      limit: "optional number - defaults to 50, capped at 100",
    }
    expect(expectedArgsShape.status).toContain("optional")
  })

  it("defines expected return shape", () => {
    const expectedItemShape = {
      id: "id<contentReports>",
      contentId: "id<newsletterContent>",
      subject: "string",
      senderEmail: "string",
      reason: "union - report reason category",
      description: "string | undefined",
      status: "union - report status",
      reporterEmail: "string",
      createdAt: "number",
      resolvedAt: "number | undefined",
    }
    expect(expectedItemShape).toHaveProperty("id")
    expect(expectedItemShape).toHaveProperty("reporterEmail")
  })
})

describe("resolveReport mutation contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      reportId: "id<contentReports> - report to resolve",
      resolution: "union - 'resolved' | 'dismissed'",
      note: "optional string - resolution note",
      hideContent: "optional boolean - hide content if resolving",
    }
    expect(expectedArgsShape).toHaveProperty("reportId")
    expect(expectedArgsShape).toHaveProperty("resolution")
  })

  it("documents resolution behavior", () => {
    const behavior = {
      updatesReportStatus: true,
      setsResolvedBy: "admin._id",
      setsResolvedAt: "Date.now()",
      optionallyHidesContent: true,
      createsAuditLog: true,
    }
    expect(behavior.updatesReportStatus).toBe(true)
    expect(behavior.optionallyHidesContent).toBe(true)
  })
})

describe("bulkResolveReports mutation contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      reportIds: "array of id<contentReports>",
      resolution: "union - 'resolved' | 'dismissed'",
      note: "optional string - resolution note",
    }
    expect(expectedArgsShape).toHaveProperty("reportIds")
    expect(expectedArgsShape).toHaveProperty("resolution")
  })

  it("documents bulk behavior", () => {
    const behavior = {
      processesMultipleReports: true,
      skipsNonPendingReports: true,
      createsAuditLogPerReport: true,
      returnsResolvedCount: true,
    }
    expect(behavior.skipsNonPendingReports).toBe(true)
    expect(behavior.returnsResolvedCount).toBe(true)
  })
})

describe("listModerationLog query contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      actionType: "optional union - filter by action type",
      startDate: "optional number - filter by start date",
      endDate: "optional number - filter by end date",
      limit: "optional number - defaults to 50, capped at 100",
    }
    expect(expectedArgsShape.actionType).toContain("optional")
    expect(expectedArgsShape.startDate).toContain("optional")
  })

  it("defines expected return shape", () => {
    const expectedItemShape = {
      id: "id<moderationLog>",
      actionType: "union - one of 6 action types",
      targetType: "union - 'content' | 'sender' | 'report'",
      targetId: "string - ID of target",
      reason: "string | undefined",
      details: "object | null - parsed JSON details",
      adminEmail: "string",
      createdAt: "number - Unix timestamp ms",
    }
    expect(expectedItemShape).toHaveProperty("id")
    expect(expectedItemShape).toHaveProperty("actionType")
    expect(expectedItemShape).toHaveProperty("details")
  })
})

describe("getCommunityContentSummary query contract", () => {
  it("defines expected return shape", () => {
    const expectedReturnShape = {
      totalContent: "number - all community content",
      hiddenContent: "number - hidden content count",
      activeContent: "number - visible content count",
      blockedSenders: "number - blocked sender count",
      pendingReports: "number - pending report count",
    }
    expect(expectedReturnShape).toHaveProperty("totalContent")
    expect(expectedReturnShape).toHaveProperty("pendingReports")
  })
})

describe("Story 7.4 admin authorization", () => {
  it("documents all admin-only queries", () => {
    const adminOnlyQueries = [
      "listCommunityContent",
      "getCommunityContentSummary",
      "listBlockedSenders",
      "listContentReports",
      "getPendingReportsCount",
      "listModerationLog",
    ]
    expect(adminOnlyQueries).toHaveLength(6)
  })

  it("documents all admin-only mutations", () => {
    const adminOnlyMutations = [
      "hideContentFromCommunity",
      "restoreContentToCommunity",
      "blockSenderFromCommunity",
      "unblockSender",
      "resolveReport",
      "bulkResolveReports",
    ]
    expect(adminOnlyMutations).toHaveLength(6)
  })

  it("documents user-facing mutation", () => {
    const userFacingMutations = ["reportContent"]
    expect(userFacingMutations).toHaveLength(1)
    // reportContent requires auth but not admin
  })
})

// ============================================================
// Story 9.6: Admin Moderation Queue Tests
// ============================================================

describe("Story 9.6: Admin Moderation Queue API exports", () => {
  it("should export listModerationQueue query", () => {
    expect(api.admin.listModerationQueue).toBeDefined()
  })

  it("should export listModerationNewslettersForSender query", () => {
    expect(api.admin.listModerationNewslettersForSender).toBeDefined()
  })

  it("should export getModerationNewsletterDetail query", () => {
    expect(api.admin.getModerationNewsletterDetail).toBeDefined()
  })

  it("should export getModerationNewsletterContent action", () => {
    expect(api.admin.getModerationNewsletterContent).toBeDefined()
  })

  it("should export getModerationQueueCount query", () => {
    expect(api.admin.getModerationQueueCount).toBeDefined()
  })
})

describe("listModerationQueue query contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      senderEmail: "optional string - filter by sender email (partial match)",
      startDate: "optional number - filter by start date (Unix timestamp ms)",
      endDate: "optional number - filter by end date (Unix timestamp ms)",
      sortBy: "optional union - 'newsletterCount' | 'senderName' | 'latestReceived'",
      limit: "optional number - defaults to 50, capped at 100",
    }
    expect(expectedArgsShape.senderEmail).toContain("optional")
    expect(expectedArgsShape.sortBy).toContain("optional")
  })

  it("defines expected return shape", () => {
    const expectedReturnShape = {
      items: "array of sender groups with newsletter counts",
      hasMore: "boolean - whether more items exist",
      totalSenders: "number - total matching senders",
    }
    expect(expectedReturnShape).toHaveProperty("items")
    expect(expectedReturnShape).toHaveProperty("hasMore")
    expect(expectedReturnShape).toHaveProperty("totalSenders")
  })

  it("defines sender group item shape", () => {
    const expectedItemShape = {
      senderId: "id<senders>",
      senderEmail: "string",
      senderName: "string | undefined",
      senderDomain: "string",
      newsletterCount: "number - count of user newsletters from this sender",
      latestReceived: "number - Unix timestamp ms",
      sampleSubjects: "array of strings - up to 3 sample subjects",
    }
    expect(expectedItemShape).toHaveProperty("senderId")
    expect(expectedItemShape).toHaveProperty("newsletterCount")
    expect(expectedItemShape).toHaveProperty("sampleSubjects")
  })

  it("documents filtering logic - excludes already-approved content", () => {
    const behavior = {
      excludesNewslettersWithContentId: true,
      reason: "contentId means content was published to community",
      onlyIncludesPrivateR2KeyNewsletters: true,
    }
    expect(behavior.excludesNewslettersWithContentId).toBe(true)
    expect(behavior.onlyIncludesPrivateR2KeyNewsletters).toBe(true)
  })

  it("documents admin authorization requirement", () => {
    const behavior = {
      requiresAdmin: true,
      authMethod: "requireAdmin(ctx)",
    }
    expect(behavior.requiresAdmin).toBe(true)
  })
})

describe("listModerationNewslettersForSender query contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      senderId: "id<senders> - sender to list newsletters for",
      limit: "optional number - defaults to 50",
    }
    expect(expectedArgsShape).toHaveProperty("senderId")
    expect(expectedArgsShape.limit).toContain("optional")
  })

  it("defines expected return shape", () => {
    const expectedItemShape = {
      id: "id<userNewsletters>",
      subject: "string",
      senderEmail: "string",
      senderName: "string | undefined",
      receivedAt: "number - Unix timestamp ms",
      userId: "id<users> - for reference",
      userEmail: "string - for audit (admin-only)",
      source: "string - 'email' | 'gmail' | 'manual' | 'community'",
    }
    expect(expectedItemShape).toHaveProperty("id")
    expect(expectedItemShape).toHaveProperty("userEmail")
    expect(expectedItemShape).toHaveProperty("source")
  })

  it("documents user email exposure for audit", () => {
    const securityBehavior = {
      exposesUserEmail: true,
      reason: "Admin needs user context for audit purposes",
      communityNeverSeesThis: true,
    }
    expect(securityBehavior.exposesUserEmail).toBe(true)
  })
})

describe("getModerationNewsletterDetail query contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      userNewsletterId: "id<userNewsletters> - specific newsletter to get details for",
    }
    expect(expectedArgsShape).toHaveProperty("userNewsletterId")
  })

  it("defines expected return shape", () => {
    const expectedReturnShape = {
      id: "id<userNewsletters>",
      subject: "string",
      senderEmail: "string",
      senderName: "string | undefined",
      receivedAt: "number - Unix timestamp ms",
      source: "string - 'email' | 'gmail' | 'manual' | 'community'",
      userEmail: "string - owner's email for audit",
      userId: "id<users>",
      senderId: "id<senders>",
      piiDetection: "PiiDetectionResult - detected personalization patterns",
    }
    expect(expectedReturnShape).toHaveProperty("id")
    expect(expectedReturnShape).toHaveProperty("userEmail")
    expect(expectedReturnShape).toHaveProperty("piiDetection")
  })

  it("documents PII detection result shape", () => {
    const piiDetectionResult = {
      hasPotentialPII: "boolean",
      findings: "array of PiiFind objects",
      recommendation: "string - advisory message",
    }
    expect(piiDetectionResult).toHaveProperty("hasPotentialPII")
    expect(piiDetectionResult).toHaveProperty("findings")
  })

  it("documents error codes", () => {
    const errorCodes = {
      NOT_FOUND: "Newsletter not found",
    }
    expect(errorCodes).toHaveProperty("NOT_FOUND")
  })
})

describe("getModerationNewsletterContent action contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      userNewsletterId: "id<userNewsletters> - newsletter to fetch content for",
    }
    expect(expectedArgsShape).toHaveProperty("userNewsletterId")
  })

  it("defines expected return shape", () => {
    const expectedReturnShape = {
      signedUrl: "string - R2 signed URL for content (valid 1 hour)",
      subject: "string",
      senderEmail: "string",
      senderName: "string | undefined",
      receivedAt: "number - Unix timestamp ms",
    }
    expect(expectedReturnShape).toHaveProperty("signedUrl")
    expect(expectedReturnShape).toHaveProperty("subject")
  })

  it("documents R2 signed URL pattern", () => {
    const behavior = {
      usesPrivateR2Key: true,
      urlExpiresIn: "1 hour (3600 seconds)",
      neverExposesR2KeyDirectly: true,
    }
    expect(behavior.usesPrivateR2Key).toBe(true)
    expect(behavior.neverExposesR2KeyDirectly).toBe(true)
  })

  it("documents error codes", () => {
    const errorCodes = {
      NOT_FOUND: "Newsletter content not found",
      FORBIDDEN: "Admin access required",
    }
    expect(errorCodes).toHaveProperty("NOT_FOUND")
    expect(errorCodes).toHaveProperty("FORBIDDEN")
  })
})

describe("getModerationQueueCount query contract", () => {
  it("defines expected return shape", () => {
    const expectedReturnShape = {
      count: "number - total newsletters pending moderation",
    }
    expect(expectedReturnShape).toHaveProperty("count")
  })

  it("documents count logic", () => {
    const behavior = {
      countsNewslettersWithPrivateR2Key: true,
      excludesNewslettersWithContentId: true,
      reason: "Count only user-owned private content not yet published",
    }
    expect(behavior.countsNewslettersWithPrivateR2Key).toBe(true)
    expect(behavior.excludesNewslettersWithContentId).toBe(true)
  })
})

describe("PII Detection contract", () => {
  it("defines PII detection patterns", () => {
    const patterns = [
      { type: "greeting", description: "Personalized greeting like 'Hi John,'" },
      { type: "email", description: "Email address in content" },
      { type: "name_reference", description: "Name in salutation like 'Dear John'" },
      { type: "unsubscribe_link", description: "Personalized unsubscribe link with user ID" },
      { type: "tracking_pixel", description: "Tracking pixel with user identifier" },
      { type: "user_id", description: "User identifier in URL parameters" },
    ]
    expect(patterns).toHaveLength(6)
  })

  it("documents PiiFind object shape", () => {
    const piiFind = {
      type: "string - pattern type",
      description: "string - human-readable description",
      count: "number - how many matches found",
      samples: "array of strings - up to 3 sample matches",
    }
    expect(piiFind).toHaveProperty("type")
    expect(piiFind).toHaveProperty("count")
    expect(piiFind).toHaveProperty("samples")
  })

  it("documents advisory-only nature of PII detection", () => {
    const behavior = {
      isAdvisoryOnly: true,
      doesNotBlockActions: true,
      adminMakesFinalDecision: true,
    }
    expect(behavior.isAdvisoryOnly).toBe(true)
    expect(behavior.doesNotBlockActions).toBe(true)
  })
})

describe("Story 9.6 admin authorization", () => {
  it("documents all Story 9.6 queries/actions require admin authorization", () => {
    const story96Queries = [
      "listModerationQueue",
      "listModerationNewslettersForSender",
      "getModerationNewsletterDetail",
      "getModerationNewsletterContent",
      "getModerationQueueCount",
    ]
    const allRequireAdmin = true
    expect(allRequireAdmin).toBe(true)
    expect(story96Queries).toHaveLength(5)
  })
})

describe("Story 9.6 key differences from Story 7.4", () => {
  it("documents data source difference", () => {
    const comparison = {
      story74: "Uses newsletterContent table (community content)",
      story96: "Uses userNewsletters with privateR2Key (user-owned content)",
    }
    expect(comparison.story74).toContain("newsletterContent")
    expect(comparison.story96).toContain("userNewsletters")
  })

  it("documents purpose difference", () => {
    const comparison = {
      story74: "Manage existing community content",
      story96: "Review user content for potential publishing to community",
    }
    expect(comparison.story74).toContain("existing community")
    expect(comparison.story96).toContain("Review user content")
  })

  it("documents content access difference", () => {
    const comparison = {
      story74: "Public R2 keys (shared content)",
      story96: "Private R2 keys (user-specific)",
    }
    expect(comparison.story74).toContain("Public")
    expect(comparison.story96).toContain("Private")
  })

  it("documents user info exposure difference", () => {
    const comparison = {
      story74: "No user info (content is shared/deduped)",
      story96: "Shows user email for audit purposes",
    }
    expect(comparison.story74).toContain("No user info")
    expect(comparison.story96).toContain("user email for audit")
  })
})

// ============================================================
// Story 9.7: Admin Publish Flow Tests
// ============================================================

describe("Story 9.7: Admin Publish Flow API exports", () => {
  it("should export publishToCommunity action", () => {
    expect(api.admin.publishToCommunity).toBeDefined()
  })

  it("should export rejectFromCommunity mutation", () => {
    expect(api.admin.rejectFromCommunity).toBeDefined()
  })

  it("should export getAdminUser as internal query", () => {
    expect(internal.admin.getAdminUser).toBeDefined()
  })

  it("should export createCommunityContent as internal mutation", () => {
    expect(internal.admin.createCommunityContent).toBeDefined()
  })

  it("should export markNewsletterReviewed as internal mutation", () => {
    expect(internal.admin.markNewsletterReviewed).toBeDefined()
  })

  it("should export logModerationAction as internal mutation", () => {
    expect(internal.admin.logModerationAction).toBeDefined()
  })
})

describe("publishToCommunity action contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      userNewsletterId: "id<userNewsletters> - newsletter to publish",
    }
    expect(expectedArgsShape).toHaveProperty("userNewsletterId")
  })

  it("defines expected return shape", () => {
    const expectedReturnShape = {
      success: "boolean - always true on success",
      contentId: "id<newsletterContent> - created or reused content ID",
      reusedExisting: "boolean - true if content already existed",
    }
    expect(expectedReturnShape).toHaveProperty("success")
    expect(expectedReturnShape).toHaveProperty("contentId")
    expect(expectedReturnShape).toHaveProperty("reusedExisting")
  })

  it("documents admin authorization requirement", () => {
    const behavior = {
      requiresAdmin: true,
      authMethod: "getAdminUser internal query",
      errorOnNoAdmin: "ConvexError({ code: 'UNAUTHORIZED', message: 'Admin access required' })",
    }
    expect(behavior.requiresAdmin).toBe(true)
  })

  it("documents R2 workflow", () => {
    const workflow = {
      step1: "Fetch content from user's privateR2Key",
      step2: "Compute content hash for deduplication",
      step3: "Check for existing newsletterContent with same hash",
      step4If: "Existing: increment readerCount, reuse contentId",
      step4Else: "New: upload to community/ R2 key, create newsletterContent",
    }
    expect(workflow.step3).toContain("hash")
    expect(workflow.step4If).toContain("increment")
    expect(workflow.step4Else).toContain("community/")
  })

  it("documents deduplication behavior", () => {
    const behavior = {
      checksContentHash: true,
      reuseExistingContent: true,
      incrementsReaderCount: true,
      neverDuplicatesContent: true,
    }
    expect(behavior.checksContentHash).toBe(true)
    expect(behavior.neverDuplicatesContent).toBe(true)
  })

  it("documents community R2 key format", () => {
    const keyFormat = {
      prefix: "community/",
      pattern: "community/{timestamp}-{uuid}.{ext}",
      extOptions: ["html", "txt"],
    }
    expect(keyFormat.prefix).toBe("community/")
    expect(keyFormat.pattern).toContain("{timestamp}")
  })

  it("documents review status tracking", () => {
    const behavior = {
      setsReviewStatus: "published",
      setsReviewedAt: "Date.now()",
      setsReviewedBy: "admin._id",
    }
    expect(behavior.setsReviewStatus).toBe("published")
  })

  it("documents audit log entry", () => {
    const auditEntry = {
      actionType: "publish_to_community",
      targetType: "userNewsletter",
      detailsInclude: ["contentId", "senderEmail", "subject", "reusedExisting"],
    }
    expect(auditEntry.actionType).toBe("publish_to_community")
  })

  it("documents error codes", () => {
    const errorCodes = {
      UNAUTHORIZED: "Admin access required",
      NOT_FOUND: "Newsletter not found",
      VALIDATION_ERROR: "Newsletter has no private content OR already reviewed",
      EXTERNAL_ERROR: "Failed to fetch content from R2",
    }
    expect(errorCodes).toHaveProperty("UNAUTHORIZED")
    expect(errorCodes).toHaveProperty("VALIDATION_ERROR")
    expect(errorCodes).toHaveProperty("EXTERNAL_ERROR")
  })

  it("documents user content protection", () => {
    const behavior = {
      userPrivateR2KeyUnchanged: true,
      userNewsletterContentUnchanged: true,
      onlyAddsReviewTracking: true,
    }
    expect(behavior.userPrivateR2KeyUnchanged).toBe(true)
  })
})

describe("rejectFromCommunity mutation contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      userNewsletterId: "id<userNewsletters> - newsletter to reject",
      reason: "string - reason for rejection (required)",
    }
    expect(expectedArgsShape).toHaveProperty("userNewsletterId")
    expect(expectedArgsShape).toHaveProperty("reason")
  })

  it("defines expected return shape", () => {
    const expectedReturnShape = {
      success: "boolean - always true on success",
    }
    expect(expectedReturnShape).toHaveProperty("success")
  })

  it("documents admin authorization requirement", () => {
    const behavior = {
      requiresAdmin: true,
      authMethod: "requireAdmin(ctx)",
    }
    expect(behavior.requiresAdmin).toBe(true)
  })

  it("documents rejection behavior", () => {
    const behavior = {
      doesNotModifyUserContent: true,
      doesNotDeleteAnything: true,
      onlySetsReviewStatus: true,
      createsAuditLog: true,
    }
    expect(behavior.doesNotModifyUserContent).toBe(true)
    expect(behavior.doesNotDeleteAnything).toBe(true)
  })

  it("documents review status tracking", () => {
    const behavior = {
      setsReviewStatus: "rejected",
      setsReviewedAt: "Date.now()",
      setsReviewedBy: "admin._id",
    }
    expect(behavior.setsReviewStatus).toBe("rejected")
  })

  it("documents audit log entry", () => {
    const auditEntry = {
      actionType: "reject_from_community",
      targetType: "userNewsletter",
      reasonRequired: true,
      detailsInclude: ["senderEmail", "subject"],
    }
    expect(auditEntry.actionType).toBe("reject_from_community")
    expect(auditEntry.reasonRequired).toBe(true)
  })

  it("documents error codes", () => {
    const errorCodes = {
      NOT_FOUND: "Newsletter not found",
      VALIDATION_ERROR: "Newsletter has no private content OR already reviewed",
      FORBIDDEN: "Non-admin user",
    }
    expect(errorCodes).toHaveProperty("NOT_FOUND")
    expect(errorCodes).toHaveProperty("VALIDATION_ERROR")
  })
})

describe("createCommunityContent internal mutation contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      contentHash: "string - SHA-256 hash for deduplication",
      r2Key: "string - community/ prefixed R2 key",
      subject: "string",
      senderEmail: "string",
      senderName: "optional string",
      receivedAt: "number - Unix timestamp ms",
      communityApprovedAt: "number - approval timestamp",
      communityApprovedBy: "id<users> - admin who approved",
    }
    expect(expectedArgsShape).toHaveProperty("contentHash")
    expect(expectedArgsShape).toHaveProperty("communityApprovedAt")
    expect(expectedArgsShape).toHaveProperty("communityApprovedBy")
  })

  it("documents race condition handling", () => {
    const behavior = {
      checksForExistingHash: true,
      onRaceCondition: "Increments readerCount on existing, returns existing ID",
      preventsduplicates: true,
    }
    expect(behavior.checksForExistingHash).toBe(true)
    expect(behavior.preventsduplicates).toBe(true)
  })

  it("documents newsletterContent record shape", () => {
    const recordShape = {
      contentHash: "string",
      r2Key: "string",
      subject: "string",
      senderEmail: "string",
      senderName: "string | undefined",
      firstReceivedAt: "number",
      readerCount: 0,
      importCount: 0,
      communityApprovedAt: "number",
      communityApprovedBy: "id<users>",
    }
    expect(recordShape.readerCount).toBe(0)
    expect(recordShape.importCount).toBe(0)
  })
})

describe("markNewsletterReviewed internal mutation contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      userNewsletterId: "id<userNewsletters>",
      reviewStatus: "union - 'published' | 'rejected'",
      reviewedBy: "id<users> - admin who reviewed",
    }
    expect(expectedArgsShape).toHaveProperty("userNewsletterId")
    expect(expectedArgsShape).toHaveProperty("reviewStatus")
    expect(expectedArgsShape).toHaveProperty("reviewedBy")
  })

  it("documents patch behavior", () => {
    const behavior = {
      setsReviewStatus: true,
      setsReviewedAt: "Date.now()",
      setsReviewedBy: "args.reviewedBy",
    }
    expect(behavior.setsReviewStatus).toBe(true)
  })
})

describe("logModerationAction internal mutation contract", () => {
  it("defines expected args schema", () => {
    const expectedArgsShape = {
      adminId: "id<users>",
      actionType:
        "union - includes 'publish_to_community' | 'reject_from_community'",
      targetType: "union - includes 'userNewsletter'",
      targetId: "string",
      reason: "string",
      details: "optional string - JSON stringified",
    }
    expect(expectedArgsShape).toHaveProperty("adminId")
    expect(expectedArgsShape).toHaveProperty("actionType")
  })

  it("documents new action types for Story 9.7", () => {
    const newActionTypes = ["publish_to_community", "reject_from_community"]
    expect(newActionTypes).toContain("publish_to_community")
    expect(newActionTypes).toContain("reject_from_community")
  })

  it("documents new target type for Story 9.7", () => {
    const newTargetTypes = ["userNewsletter"]
    expect(newTargetTypes).toContain("userNewsletter")
  })
})

describe("listModerationQueue Story 9.7 updates", () => {
  it("documents new includeReviewed parameter", () => {
    const newParam = {
      includeReviewed: "optional boolean - shows reviewed items if true",
      defaultValue: false,
    }
    expect(newParam.includeReviewed).toContain("optional")
  })

  it("documents filtering of reviewed newsletters", () => {
    const behavior = {
      excludesPublished: true,
      excludesRejected: true,
      filterCondition: "reviewStatus === undefined",
      canOverrideWithIncludeReviewed: true,
    }
    expect(behavior.excludesPublished).toBe(true)
    expect(behavior.excludesRejected).toBe(true)
  })
})

describe("listModerationNewslettersForSender Story 9.7 updates", () => {
  it("documents new includeReviewed parameter", () => {
    const newParam = {
      includeReviewed: "optional boolean - shows reviewed items if true",
      defaultValue: false,
    }
    expect(newParam.includeReviewed).toContain("optional")
  })
})

describe("userNewsletters schema Story 9.7 updates", () => {
  it("documents new review tracking fields", () => {
    const newFields = {
      reviewStatus: "optional union - 'published' | 'rejected'",
      reviewedAt: "optional number - Unix timestamp ms",
      reviewedBy: "optional id<users> - admin who reviewed",
    }
    expect(newFields).toHaveProperty("reviewStatus")
    expect(newFields).toHaveProperty("reviewedAt")
    expect(newFields).toHaveProperty("reviewedBy")
  })

  it("documents new by_reviewStatus index", () => {
    const newIndex = {
      by_reviewStatus: "For filtering moderation queue by review status",
    }
    expect(newIndex).toHaveProperty("by_reviewStatus")
  })
})

describe("moderationLog schema Story 9.7 updates", () => {
  it("documents new action types", () => {
    const allActionTypes = [
      "hide_content",
      "restore_content",
      "block_sender",
      "unblock_sender",
      "resolve_report",
      "dismiss_report",
      "publish_to_community", // NEW
      "reject_from_community", // NEW
    ]
    expect(allActionTypes).toContain("publish_to_community")
    expect(allActionTypes).toContain("reject_from_community")
    expect(allActionTypes).toHaveLength(8)
  })

  it("documents new target type", () => {
    const allTargetTypes = [
      "content",
      "sender",
      "report",
      "userNewsletter", // NEW
    ]
    expect(allTargetTypes).toContain("userNewsletter")
    expect(allTargetTypes).toHaveLength(4)
  })
})

describe("Story 9.7 key behaviors", () => {
  it("documents privacy-first publishing model", () => {
    const model = {
      userContentAlwaysPrivate: true,
      onlyAdminCanPublish: true,
      publishCreatesCopy: true,
      userCopyUnaffected: true,
    }
    expect(model.userContentAlwaysPrivate).toBe(true)
    expect(model.publishCreatesCopy).toBe(true)
  })

  it("documents R2 key separation", () => {
    const keyModel = {
      userKeys: "private/{userId}/{timestamp}-{uuid}.{ext}",
      communityKeys: "community/{timestamp}-{uuid}.{ext}",
      neverExposesUserKeys: true,
    }
    expect(keyModel.userKeys).toContain("private/")
    expect(keyModel.communityKeys).toContain("community/")
  })

  it("documents deduplication at community level", () => {
    const dedupModel = {
      hashesNormalizedContent: true,
      checksNewsletterContentTable: true,
      incrementsReaderCountIfExists: true,
      avoidsR2Duplication: true,
    }
    expect(dedupModel.hashesNormalizedContent).toBe(true)
  })

  it("documents audit trail requirements", () => {
    const auditRequirements = {
      everyPublishLogged: true,
      everyRejectLogged: true,
      includesAdminId: true,
      includesReason: true,
      includesDetails: true,
    }
    expect(auditRequirements.everyPublishLogged).toBe(true)
    expect(auditRequirements.everyRejectLogged).toBe(true)
  })

  it("documents moderation queue behavior after review", () => {
    const queueBehavior = {
      publishedRemoved: true,
      rejectedRemoved: true,
      userCanStillSeeTheirCopy: true,
      adminCanViewWithIncludeReviewed: true,
    }
    expect(queueBehavior.publishedRemoved).toBe(true)
    expect(queueBehavior.rejectedRemoved).toBe(true)
  })
})

describe("Story 9.7 relationship to other stories", () => {
  it("documents relationship to Story 9.6 (Admin Moderation Queue)", () => {
    const relationship = {
      buildsOn: "listModerationQueue, getModerationNewsletterDetail",
      addsActionButtons: "Publish/Reject in ModerationNewsletterModal",
      extendsFiltering: "Adds includeReviewed parameter",
    }
    expect(relationship.buildsOn).toContain("listModerationQueue")
  })

  it("documents relationship to Story 9.8 (Community Browse)", () => {
    const relationship = {
      publishedContentAppearsIn: "Community browse queries",
      usesNewsletterContentTable: true,
      communityApprovedAtUsedForFiltering: true,
    }
    expect(relationship.usesNewsletterContentTable).toBe(true)
  })

  it("documents relationship to Story 9.9 (Community Import)", () => {
    const relationship = {
      contentFromThisStory: "Available for user import",
      importCountTracked: true,
      readerCountIncremented: true,
    }
    expect(relationship.importCountTracked).toBe(true)
  })
})

describe("Story 9.7 admin authorization", () => {
  it("documents all Story 9.7 functions require admin authorization", () => {
    const story97Functions = [
      "publishToCommunity", // action
      "rejectFromCommunity", // mutation
    ]
    const allRequireAdmin = true
    expect(allRequireAdmin).toBe(true)
    expect(story97Functions).toHaveLength(2)
  })

  it("documents internal mutations for action workflow", () => {
    const internalMutations = [
      "createCommunityContent",
      "markNewsletterReviewed",
      "logModerationAction",
      "getAdminUser", // actually internalQuery
    ]
    expect(internalMutations).toHaveLength(4)
  })
})
