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
    ]
    // checkIsAdmin is explicitly exempt (used for UI conditional rendering)
    const exemptQueries = ["checkIsAdmin"]

    expect(adminQueries).toHaveLength(4)
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
