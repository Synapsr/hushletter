# Story 7.2: Email Delivery Monitoring

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **administrator**,
I want **to monitor email delivery status**,
so that **I can ensure newsletters are being received reliably**.

## Acceptance Criteria

1. **Given** I am on the admin dashboard
   **When** I navigate to email delivery monitoring
   **Then** I see email delivery statistics
   **And** I see success/failure rates

2. **Given** emails are being received
   **When** viewing delivery logs
   **Then** I see recent email deliveries with timestamps
   **And** I can filter by status (success, failed, pending)

3. **Given** an email delivery fails
   **When** viewing the failure
   **Then** I see the reason for failure
   **And** I can identify which user was affected

4. **Given** I want to ensure zero message loss (NFR9)
   **When** monitoring deliveries
   **Then** I can see any emails that failed to process
   **And** I have tools to retry failed deliveries if applicable

5. **Given** the email worker has issues
   **When** monitoring the system
   **Then** I see alerts for delivery anomalies
   **And** I can view Cloudflare Worker logs/status

## Tasks / Subtasks

- [x] **Task 1: Email Delivery Tracking Schema** (AC: #1, #2, #3)
  - [x] 1.1: Create `emailDeliveryLogs` table in Convex schema
  - [x] 1.2: Define delivery status enum: `received`, `processing`, `stored`, `failed`
  - [x] 1.3: Add fields for userId, sender, subject, receivedAt, processedAt, status, errorMessage
  - [x] 1.4: Add indexes for efficient querying: `by_status`, `by_receivedAt`, `by_userId`
  - [x] 1.5: Write contract tests for schema validation

- [x] **Task 2: Email Worker Logging Integration** (AC: #1, #2, #3)
  - [x] 2.1: Update email ingestion HTTP action to create delivery log entry on email receipt
  - [x] 2.2: Update delivery log status to `processing` when parsing begins
  - [x] 2.3: Update delivery log status to `stored` on successful storage
  - [x] 2.4: Update delivery log status to `failed` with error message on failure
  - [x] 2.5: Add internal Convex mutation `logEmailDelivery` for ingestion calls
  - [x] 2.6: Add internal mutation `updateDeliveryStatus` for status transitions

- [x] **Task 3: Admin Delivery Queries** (AC: #1, #2, #4)
  - [x] 3.1: Create `getDeliveryStats` query - counts by status for time period
  - [x] 3.2: Create `listDeliveryLogs` query with pagination and filters
  - [x] 3.3: Create `getFailedDeliveries` query for failed/pending items
  - [x] 3.4: Create `getDeliveryRateStats` query - success rate calculations
  - [x] 3.5: All queries MUST use `requireAdmin` helper
  - [x] 3.6: Write contract tests for all admin queries

- [x] **Task 4: Email Delivery Dashboard UI** (AC: #1, #2, #5)
  - [x] 4.1: Create `routes/_authed/admin/delivery.tsx` - delivery monitoring page
  - [x] 4.2: Create `DeliveryStatsCard.tsx` - success/failure rate display
  - [x] 4.3: Create `DeliveryLogTable.tsx` - paginated log table with filters
  - [x] 4.4: Create `DeliveryStatusBadge.tsx` - status indicator component
  - [x] 4.5: Add status filter dropdown (all, received, processing, stored, failed)
  - [x] 4.6: Skipped - date range filter not needed (uses 24h default with success rates by period)
  - [x] 4.7: Implement loading skeletons for all sections
  - [x] 4.8: Add auto-refresh via Convex subscriptions (automatic with convexQuery)

- [x] **Task 5: Failed Delivery Details & Retry** (AC: #3, #4)
  - [x] 5.1: Create `DeliveryDetailPanel.tsx` - expandable row details
  - [x] 5.2: Display error message and error code for failed deliveries
  - [x] 5.3: Show affected user information (email address, user ID)
  - [x] 5.4: Skipped - retry not feasible (email content not persisted on failure)
  - [x] 5.5: Skipped - no retry button (see 5.4)
  - [x] 5.6: Add "Acknowledge" button to dismiss non-retryable failures

- [x] **Task 6: Anomaly Detection & Alerts** (AC: #5)
  - [x] 6.1: Create `getDeliveryAnomalies` query - detect unusual patterns
  - [x] 6.2: Flag anomalies: high failure rate (>5%), no deliveries in 24h, sudden volume spike
  - [x] 6.3: Create `AnomalyAlertBanner.tsx` - warning banner for dashboard
  - [x] 6.4: Anomaly alerts shown on delivery monitoring page (displays when anomalies exist)
  - [x] 6.5: N/A - Cloudflare Worker dashboard is external (console.cloudflare.com)

- [x] **Task 7: Navigation & Integration** (AC: all)
  - [x] 7.1: Add "Email Delivery" link to admin sidebar/navigation
  - [x] 7.2: Delivery stats accessible from Email Delivery page (not duplicated on main dashboard)
  - [x] 7.3: Skipped - quick stats in header not needed (dedicated delivery page suffices)

- [x] **Task 8: Comprehensive Testing** (All ACs)
  - [x] 8.1: Test delivery log creation via internal mutation contract tests
  - [x] 8.2: Test status transitions via contract tests documenting behavior
  - [x] 8.3: Test failed status with error capture via contract tests
  - [x] 8.4: Test `getDeliveryStats` returns correct counts (contract tests)
  - [x] 8.5: Test `listDeliveryLogs` pagination and filtering (contract tests)
  - [x] 8.6: Test `getFailedDeliveries` only returns failed items (contract tests)
  - [x] 8.7: Test anomaly detection thresholds (contract tests documenting thresholds)
  - [x] 8.8: Test DeliveryStatsCard component rendering
  - [x] 8.9: Test DeliveryLogTable with mock data
  - [x] 8.10: Test DeliveryStatusBadge for all states
  - [x] 8.11: Skipped - retry functionality not implemented (see Task 5.4)

## Dev Notes

### Architecture Context - Email Delivery Monitoring

**This is Story 7.2 of Epic 7 (Admin & System Operations) - building on Story 7.1's admin foundation.**

**Key architectural decisions:**
1. **Delivery logs are SEPARATE from userNewsletters** - track the delivery pipeline, not the final content
2. **Log at each stage** - received, processing, stored, failed - for full visibility
3. **Admin queries MUST use `requireAdmin` helper** - same pattern as Story 7.1
4. **Real-time via Convex subscriptions** - admins see live updates
5. **Graceful failure handling** - log failures don't break email processing

### Schema Changes Required

```typescript
// convex/schema.ts - ADD new table

/**
 * Email Delivery Logs - tracks email processing pipeline
 * Story 7.2: Email Delivery Monitoring
 *
 * Captures each email's journey through the system:
 * 1. received - Email worker received the email
 * 2. processing - Parsing and content extraction started
 * 3. stored - Successfully stored in userNewsletters/R2
 * 4. failed - Processing failed with error
 */
emailDeliveryLogs: defineTable({
  // Email metadata (captured at receipt)
  recipientEmail: v.string(),      // User's dedicated email address
  senderEmail: v.string(),
  senderName: v.optional(v.string()),
  subject: v.string(),
  messageId: v.string(),           // Email message ID for deduplication

  // User linkage (resolved during processing)
  userId: v.optional(v.id("users")),

  // Delivery status tracking
  status: v.union(
    v.literal("received"),
    v.literal("processing"),
    v.literal("stored"),
    v.literal("failed")
  ),

  // Timestamps (all Unix milliseconds)
  receivedAt: v.number(),          // When email worker received
  processingStartedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),

  // Error information (only for failed status)
  errorMessage: v.optional(v.string()),
  errorCode: v.optional(v.string()),  // e.g., "PARSE_ERROR", "USER_NOT_FOUND", "R2_UPLOAD_FAILED"

  // Processing metadata
  contentSizeBytes: v.optional(v.number()),
  hasHtmlContent: v.optional(v.boolean()),
  hasPlainTextContent: v.optional(v.boolean()),

  // Retry tracking
  retryCount: v.number(),          // Starts at 0
  isAcknowledged: v.boolean(),     // Admin has reviewed failed delivery
})
  .index("by_status", ["status"])
  .index("by_receivedAt", ["receivedAt"])
  .index("by_userId", ["userId"])
  .index("by_messageId", ["messageId"])  // For deduplication
  .index("by_status_receivedAt", ["status", "receivedAt"]),  // For filtered queries
```

### Email Worker Integration Pattern

```typescript
// apps/email-worker/src/index.ts - MODIFY email handling

import { ConvexHttpClient } from "convex/browser"
import { api } from "packages/backend/convex/_generated/api"

// At email receipt (before any processing)
const logId = await convex.mutation(api.admin.logEmailDelivery, {
  internalKey: CONVEX_INTERNAL_KEY,
  recipientEmail: email.to,
  senderEmail: email.from,
  senderName: email.fromName,
  subject: email.subject,
  messageId: email.messageId,
})

try {
  // Update to processing
  await convex.mutation(api.admin.updateDeliveryStatus, {
    internalKey: CONVEX_INTERNAL_KEY,
    logId,
    status: "processing",
  })

  // ... existing processing logic ...

  // Update to stored on success
  await convex.mutation(api.admin.updateDeliveryStatus, {
    internalKey: CONVEX_INTERNAL_KEY,
    logId,
    status: "stored",
    contentSizeBytes: htmlContent.length,
    hasHtmlContent: !!htmlContent,
    hasPlainTextContent: !!plainText,
  })

} catch (error) {
  // Log failure
  await convex.mutation(api.admin.updateDeliveryStatus, {
    internalKey: CONVEX_INTERNAL_KEY,
    logId,
    status: "failed",
    errorMessage: error.message,
    errorCode: categorizeError(error),  // Helper to categorize error type
  })

  throw error  // Re-throw to let worker handle (dead letter queue, etc.)
}
```

### Admin Queries Implementation

```typescript
// convex/admin.ts - ADD delivery monitoring queries

import { v } from "convex/values"
import { query, internalMutation } from "./_generated/server"
import { requireAdmin } from "./_internal/auth"

/**
 * Get delivery statistics for a time period
 * Story 7.2 Task 3.1
 */
export const getDeliveryStats = query({
  args: {
    hoursAgo: v.optional(v.number()),  // defaults to 24
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const hoursAgo = args.hoursAgo ?? 24
    const cutoff = Date.now() - (hoursAgo * 60 * 60 * 1000)

    const logs = await ctx.db
      .query("emailDeliveryLogs")
      .withIndex("by_receivedAt")
      .filter((q) => q.gte(q.field("receivedAt"), cutoff))
      .collect()

    // Count by status
    const stats = {
      received: 0,
      processing: 0,
      stored: 0,
      failed: 0,
    }

    for (const log of logs) {
      stats[log.status]++
    }

    const total = logs.length
    const successRate = total > 0
      ? Math.round((stats.stored / total) * 100)
      : 100

    return {
      ...stats,
      total,
      successRate,
      periodHours: hoursAgo,
    }
  },
})

/**
 * List delivery logs with pagination and filtering
 * Story 7.2 Task 3.2
 */
export const listDeliveryLogs = query({
  args: {
    status: v.optional(v.union(
      v.literal("received"),
      v.literal("processing"),
      v.literal("stored"),
      v.literal("failed")
    )),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const limit = Math.min(args.limit ?? 50, 100)  // Cap at 100

    let query = ctx.db.query("emailDeliveryLogs")

    if (args.status) {
      query = query.withIndex("by_status_receivedAt", (q) =>
        q.eq("status", args.status)
      )
    } else {
      query = query.withIndex("by_receivedAt")
    }

    const logs = await query
      .order("desc")
      .take(limit + 1)  // +1 to detect if more pages exist

    const hasMore = logs.length > limit
    const items = hasMore ? logs.slice(0, limit) : logs

    return {
      items,
      hasMore,
      nextCursor: hasMore ? items[items.length - 1]._id : null,
    }
  },
})

/**
 * Get failed deliveries that need attention
 * Story 7.2 Task 3.3
 */
export const getFailedDeliveries = query({
  args: {
    includeAcknowledged: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const failed = await ctx.db
      .query("emailDeliveryLogs")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .collect()

    // Filter acknowledged if needed
    const filtered = args.includeAcknowledged
      ? failed
      : failed.filter((log) => !log.isAcknowledged)

    // Sort by receivedAt desc (most recent first)
    filtered.sort((a, b) => b.receivedAt - a.receivedAt)

    return filtered
  },
})

/**
 * Get delivery rate statistics over multiple time periods
 * Story 7.2 Task 3.4
 */
export const getDeliveryRateStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)

    const now = Date.now()
    const periods = [
      { label: "1h", cutoff: now - (1 * 60 * 60 * 1000) },
      { label: "24h", cutoff: now - (24 * 60 * 60 * 1000) },
      { label: "7d", cutoff: now - (7 * 24 * 60 * 60 * 1000) },
    ]

    const results = []

    for (const period of periods) {
      const logs = await ctx.db
        .query("emailDeliveryLogs")
        .withIndex("by_receivedAt")
        .filter((q) => q.gte(q.field("receivedAt"), period.cutoff))
        .collect()

      const total = logs.length
      const stored = logs.filter((l) => l.status === "stored").length
      const failed = logs.filter((l) => l.status === "failed").length

      results.push({
        period: period.label,
        total,
        stored,
        failed,
        successRate: total > 0 ? Math.round((stored / total) * 100) : 100,
      })
    }

    return results
  },
})

/**
 * Detect delivery anomalies
 * Story 7.2 Task 6.1
 */
export const getDeliveryAnomalies = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)

    const anomalies: Array<{
      type: "high_failure_rate" | "no_deliveries" | "volume_spike"
      severity: "warning" | "critical"
      message: string
      details: Record<string, unknown>
    }> = []

    const now = Date.now()
    const last24h = now - (24 * 60 * 60 * 1000)
    const last1h = now - (1 * 60 * 60 * 1000)

    // Get last 24h logs
    const logs24h = await ctx.db
      .query("emailDeliveryLogs")
      .withIndex("by_receivedAt")
      .filter((q) => q.gte(q.field("receivedAt"), last24h))
      .collect()

    // Check for high failure rate (>5%)
    const failed = logs24h.filter((l) => l.status === "failed").length
    const total = logs24h.length

    if (total > 10 && (failed / total) > 0.05) {
      anomalies.push({
        type: "high_failure_rate",
        severity: (failed / total) > 0.2 ? "critical" : "warning",
        message: `High failure rate: ${Math.round((failed / total) * 100)}% of emails failed in last 24h`,
        details: { failed, total, rate: (failed / total) },
      })
    }

    // Check for no deliveries in 24h (if system should be receiving)
    // Only flag if there's historical data (not a new system)
    const allLogs = await ctx.db.query("emailDeliveryLogs").take(1)
    if (allLogs.length > 0 && logs24h.length === 0) {
      anomalies.push({
        type: "no_deliveries",
        severity: "warning",
        message: "No email deliveries in the last 24 hours",
        details: {},
      })
    }

    // Check for volume spike (>3x average)
    // Compare last 1h to average hourly rate over 24h
    const logs1h = logs24h.filter((l) => l.receivedAt >= last1h)
    const avgHourlyRate = total / 24

    if (avgHourlyRate > 5 && logs1h.length > avgHourlyRate * 3) {
      anomalies.push({
        type: "volume_spike",
        severity: "warning",
        message: `Unusual volume spike: ${logs1h.length} emails in last hour (avg: ${Math.round(avgHourlyRate)}/hour)`,
        details: { lastHour: logs1h.length, avgHourly: avgHourlyRate },
      })
    }

    return anomalies
  },
})

// Internal mutations for email worker calls

/**
 * Log initial email delivery receipt
 * Called by email worker at email receipt
 * Story 7.2 Task 2.5
 */
export const logEmailDelivery = internalMutation({
  args: {
    internalKey: v.string(),
    recipientEmail: v.string(),
    senderEmail: v.string(),
    senderName: v.optional(v.string()),
    subject: v.string(),
    messageId: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate internal key
    if (args.internalKey !== process.env.CONVEX_INTERNAL_KEY) {
      throw new Error("Invalid internal key")
    }

    // Check for duplicate messageId (idempotency)
    const existing = await ctx.db
      .query("emailDeliveryLogs")
      .withIndex("by_messageId", (q) => q.eq("messageId", args.messageId))
      .first()

    if (existing) {
      return existing._id  // Return existing log ID
    }

    // Create delivery log
    const logId = await ctx.db.insert("emailDeliveryLogs", {
      recipientEmail: args.recipientEmail,
      senderEmail: args.senderEmail,
      senderName: args.senderName,
      subject: args.subject,
      messageId: args.messageId,
      status: "received",
      receivedAt: Date.now(),
      retryCount: 0,
      isAcknowledged: false,
    })

    return logId
  },
})

/**
 * Update delivery status
 * Called by email worker during processing
 * Story 7.2 Task 2.6
 */
export const updateDeliveryStatus = internalMutation({
  args: {
    internalKey: v.string(),
    logId: v.id("emailDeliveryLogs"),
    status: v.union(
      v.literal("processing"),
      v.literal("stored"),
      v.literal("failed")
    ),
    userId: v.optional(v.id("users")),
    errorMessage: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    contentSizeBytes: v.optional(v.number()),
    hasHtmlContent: v.optional(v.boolean()),
    hasPlainTextContent: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Validate internal key
    if (args.internalKey !== process.env.CONVEX_INTERNAL_KEY) {
      throw new Error("Invalid internal key")
    }

    const update: Record<string, unknown> = {
      status: args.status,
    }

    if (args.status === "processing") {
      update.processingStartedAt = Date.now()
      if (args.userId) update.userId = args.userId
    }

    if (args.status === "stored" || args.status === "failed") {
      update.completedAt = Date.now()
    }

    if (args.status === "failed") {
      update.errorMessage = args.errorMessage
      update.errorCode = args.errorCode
    }

    if (args.contentSizeBytes !== undefined) {
      update.contentSizeBytes = args.contentSizeBytes
    }
    if (args.hasHtmlContent !== undefined) {
      update.hasHtmlContent = args.hasHtmlContent
    }
    if (args.hasPlainTextContent !== undefined) {
      update.hasPlainTextContent = args.hasPlainTextContent
    }

    await ctx.db.patch(args.logId, update)
  },
})

/**
 * Acknowledge a failed delivery (admin action)
 * Story 7.2 Task 5.6
 */
export const acknowledgeFailedDelivery = mutation({
  args: {
    logId: v.id("emailDeliveryLogs"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    await ctx.db.patch(args.logId, {
      isAcknowledged: true,
    })
  },
})
```

### Frontend Components

```typescript
// apps/web/src/routes/_authed/admin/delivery.tsx - NEW

import { createFileRoute } from "@tanstack/react-router"
import { convexQuery } from "@convex-dev/react-query"
import { useQuery } from "@tanstack/react-query"
import { api } from "~/convex/_generated/api"
import { useState } from "react"
import { DeliveryStatsCard } from "~/components/admin/DeliveryStatsCard"
import { DeliveryLogTable } from "~/components/admin/DeliveryLogTable"
import { AnomalyAlertBanner } from "~/components/admin/AnomalyAlertBanner"
import { Skeleton } from "~/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"

export const Route = createFileRoute("/_authed/admin/delivery")({
  component: DeliveryMonitoring,
})

type DeliveryStatus = "all" | "received" | "processing" | "stored" | "failed"

function DeliveryMonitoring() {
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus>("all")

  const { data: stats, isPending: statsLoading } = useQuery(
    convexQuery(api.admin.getDeliveryStats, { hoursAgo: 24 })
  )

  const { data: rateStats, isPending: rateStatsLoading } = useQuery(
    convexQuery(api.admin.getDeliveryRateStats, {})
  )

  const { data: logs, isPending: logsLoading } = useQuery(
    convexQuery(api.admin.listDeliveryLogs, {
      status: statusFilter === "all" ? undefined : statusFilter,
      limit: 50,
    })
  )

  const { data: anomalies, isPending: anomaliesLoading } = useQuery(
    convexQuery(api.admin.getDeliveryAnomalies, {})
  )

  const { data: failedCount } = useQuery(
    convexQuery(api.admin.getFailedDeliveries, { includeAcknowledged: false })
  )

  return (
    <div className="space-y-6">
      {/* Anomaly Alerts */}
      {!anomaliesLoading && anomalies && anomalies.length > 0 && (
        <AnomalyAlertBanner anomalies={anomalies} />
      )}

      {/* Delivery Stats Cards */}
      <section aria-label="Delivery Statistics">
        <h2 className="text-lg font-medium mb-3">Delivery Statistics (24h)</h2>
        {statsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[100px]" />
            ))}
          </div>
        ) : stats ? (
          <DeliveryStatsCard stats={stats} />
        ) : null}
      </section>

      {/* Rate Stats by Period */}
      <section aria-label="Success Rates">
        <Card>
          <CardHeader>
            <CardTitle>Success Rates by Period</CardTitle>
          </CardHeader>
          <CardContent>
            {rateStatsLoading ? (
              <Skeleton className="h-[60px]" />
            ) : rateStats ? (
              <div className="grid grid-cols-3 gap-4">
                {rateStats.map((period) => (
                  <div key={period.period} className="text-center">
                    <p className="text-sm text-muted-foreground">{period.period}</p>
                    <p className={`text-2xl font-bold ${
                      period.successRate >= 95 ? "text-green-600" :
                      period.successRate >= 80 ? "text-yellow-600" :
                      "text-red-600"
                    }`}>
                      {period.successRate}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {period.stored}/{period.total} delivered
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>

      {/* Delivery Logs */}
      <section aria-label="Delivery Logs">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              Delivery Logs
              {failedCount && failedCount.length > 0 && (
                <span className="ml-2 text-sm font-normal text-red-600">
                  ({failedCount.length} failed)
                </span>
              )}
            </CardTitle>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as DeliveryStatus)}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="received">Received</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="stored">Stored</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {logsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : logs ? (
              <DeliveryLogTable logs={logs.items} hasMore={logs.hasMore} />
            ) : null}
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
```

```typescript
// apps/web/src/components/admin/DeliveryStatsCard.tsx - NEW

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { CheckCircle, AlertCircle, Clock, Download } from "lucide-react"

interface DeliveryStats {
  received: number
  processing: number
  stored: number
  failed: number
  total: number
  successRate: number
}

interface DeliveryStatsCardProps {
  stats: DeliveryStats
}

export function DeliveryStatsCard({ stats }: DeliveryStatsCardProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total Received</CardTitle>
          <Download className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total}</div>
          <p className="text-xs text-muted-foreground">emails in 24h</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Successfully Stored</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{stats.stored}</div>
          <p className="text-xs text-muted-foreground">{stats.successRate}% success rate</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Processing</CardTitle>
          <Clock className="h-4 w-4 text-yellow-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-yellow-600">
            {stats.received + stats.processing}
          </div>
          <p className="text-xs text-muted-foreground">in progress</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Failed</CardTitle>
          <AlertCircle className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
          <p className="text-xs text-muted-foreground">need attention</p>
        </CardContent>
      </Card>
    </div>
  )
}
```

```typescript
// apps/web/src/components/admin/DeliveryStatusBadge.tsx - NEW

import { Badge } from "~/components/ui/badge"
import { CheckCircle, Clock, Download, AlertCircle } from "lucide-react"
import { cn } from "~/lib/utils"

type DeliveryStatus = "received" | "processing" | "stored" | "failed"

interface DeliveryStatusBadgeProps {
  status: DeliveryStatus
}

const statusConfig: Record<DeliveryStatus, {
  label: string
  variant: "default" | "secondary" | "destructive" | "outline"
  icon: typeof CheckCircle
  className?: string
}> = {
  received: {
    label: "Received",
    variant: "outline",
    icon: Download,
  },
  processing: {
    label: "Processing",
    variant: "secondary",
    icon: Clock,
    className: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  stored: {
    label: "Stored",
    variant: "default",
    icon: CheckCircle,
    className: "bg-green-600 hover:bg-green-700",
  },
  failed: {
    label: "Failed",
    variant: "destructive",
    icon: AlertCircle,
  },
}

export function DeliveryStatusBadge({ status }: DeliveryStatusBadgeProps) {
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <Badge variant={config.variant} className={cn("flex items-center gap-1", config.className)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  )
}
```

```typescript
// apps/web/src/components/admin/DeliveryLogTable.tsx - NEW

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { DeliveryStatusBadge } from "./DeliveryStatusBadge"
import { DeliveryDetailPanel } from "./DeliveryDetailPanel"
import { ChevronDown, ChevronRight } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { Button } from "~/components/ui/button"
import type { Doc } from "packages/backend/convex/_generated/dataModel"

type DeliveryLog = Doc<"emailDeliveryLogs">

interface DeliveryLogTableProps {
  logs: DeliveryLog[]
  hasMore: boolean
}

export function DeliveryLogTable({ logs, hasMore }: DeliveryLogTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (logs.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        No delivery logs found
      </p>
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]"></TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Sender</TableHead>
            <TableHead>Recipient</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Received</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <>
              <TableRow
                key={log._id}
                className={cn(
                  "cursor-pointer hover:bg-muted/50",
                  log.status === "failed" && "bg-red-50 dark:bg-red-950/20"
                )}
                onClick={() => setExpandedId(
                  expandedId === log._id ? null : log._id
                )}
              >
                <TableCell>
                  {expandedId === log._id ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </TableCell>
                <TableCell className="font-medium truncate max-w-[200px]">
                  {log.subject}
                </TableCell>
                <TableCell className="truncate max-w-[150px]">
                  {log.senderName || log.senderEmail}
                </TableCell>
                <TableCell className="truncate max-w-[150px]">
                  {log.recipientEmail}
                </TableCell>
                <TableCell>
                  <DeliveryStatusBadge status={log.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDistanceToNow(log.receivedAt, { addSuffix: true })}
                </TableCell>
              </TableRow>
              {expandedId === log._id && (
                <TableRow key={`${log._id}-detail`}>
                  <TableCell colSpan={6} className="bg-muted/30">
                    <DeliveryDetailPanel log={log} />
                  </TableCell>
                </TableRow>
              )}
            </>
          ))}
        </TableBody>
      </Table>

      {hasMore && (
        <div className="text-center py-4">
          <Button variant="outline" size="sm">
            Load More
          </Button>
        </div>
      )}
    </>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}
```

```typescript
// apps/web/src/components/admin/DeliveryDetailPanel.tsx - NEW

import { useMutation } from "@tanstack/react-query"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "~/convex/_generated/api"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { formatDistanceToNow, format } from "date-fns"
import type { Doc } from "packages/backend/convex/_generated/dataModel"

type DeliveryLog = Doc<"emailDeliveryLogs">

interface DeliveryDetailPanelProps {
  log: DeliveryLog
}

export function DeliveryDetailPanel({ log }: DeliveryDetailPanelProps) {
  const acknowledgeMutation = useMutation({
    mutationFn: useConvexMutation(api.admin.acknowledgeFailedDelivery),
  })

  return (
    <div className="p-4 space-y-4">
      {/* Email Details */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground">Message ID</p>
          <p className="font-mono text-xs">{log.messageId}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Recipient</p>
          <p>{log.recipientEmail}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Sender</p>
          <p>{log.senderName ? `${log.senderName} <${log.senderEmail}>` : log.senderEmail}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Subject</p>
          <p>{log.subject}</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="border-t pt-4">
        <p className="font-medium mb-2">Processing Timeline</p>
        <div className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Received:</span>{" "}
            {format(log.receivedAt, "PPpp")}
          </p>
          {log.processingStartedAt && (
            <p>
              <span className="text-muted-foreground">Processing started:</span>{" "}
              {format(log.processingStartedAt, "PPpp")}
            </p>
          )}
          {log.completedAt && (
            <p>
              <span className="text-muted-foreground">Completed:</span>{" "}
              {format(log.completedAt, "PPpp")}
              {" "}
              <span className="text-muted-foreground">
                ({log.completedAt - log.receivedAt}ms total)
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Content Info */}
      {(log.contentSizeBytes !== undefined || log.hasHtmlContent !== undefined) && (
        <div className="border-t pt-4">
          <p className="font-medium mb-2">Content Info</p>
          <div className="flex gap-2">
            {log.contentSizeBytes !== undefined && (
              <Badge variant="outline">
                {Math.round(log.contentSizeBytes / 1024)} KB
              </Badge>
            )}
            {log.hasHtmlContent && <Badge variant="outline">HTML</Badge>}
            {log.hasPlainTextContent && <Badge variant="outline">Plain Text</Badge>}
          </div>
        </div>
      )}

      {/* Error Info (for failed) */}
      {log.status === "failed" && (
        <div className="border-t pt-4">
          <p className="font-medium mb-2 text-red-600">Error Details</p>
          {log.errorCode && (
            <Badge variant="destructive" className="mb-2">
              {log.errorCode}
            </Badge>
          )}
          <pre className="bg-red-50 dark:bg-red-950/30 p-3 rounded text-sm text-red-800 dark:text-red-200 overflow-auto">
            {log.errorMessage || "Unknown error"}
          </pre>

          <div className="mt-4 flex gap-2">
            {!log.isAcknowledged && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => acknowledgeMutation.mutate({ logId: log._id })}
                disabled={acknowledgeMutation.isPending}
              >
                {acknowledgeMutation.isPending ? "..." : "Acknowledge"}
              </Button>
            )}
            {log.isAcknowledged && (
              <Badge variant="secondary">Acknowledged</Badge>
            )}
          </div>
        </div>
      )}

      {/* User Link (if resolved) */}
      {log.userId && (
        <div className="border-t pt-4">
          <p className="text-muted-foreground text-sm">
            User ID: <span className="font-mono">{log.userId}</span>
          </p>
        </div>
      )}
    </div>
  )
}
```

```typescript
// apps/web/src/components/admin/AnomalyAlertBanner.tsx - NEW

import { AlertTriangle, XCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"

interface Anomaly {
  type: "high_failure_rate" | "no_deliveries" | "volume_spike"
  severity: "warning" | "critical"
  message: string
}

interface AnomalyAlertBannerProps {
  anomalies: Anomaly[]
}

export function AnomalyAlertBanner({ anomalies }: AnomalyAlertBannerProps) {
  const criticalAnomalies = anomalies.filter((a) => a.severity === "critical")
  const warningAnomalies = anomalies.filter((a) => a.severity === "warning")

  return (
    <div className="space-y-2">
      {criticalAnomalies.map((anomaly, index) => (
        <Alert key={`critical-${index}`} variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Critical Alert</AlertTitle>
          <AlertDescription>{anomaly.message}</AlertDescription>
        </Alert>
      ))}

      {warningAnomalies.map((anomaly, index) => (
        <Alert key={`warning-${index}`} className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-800 dark:text-yellow-200">Warning</AlertTitle>
          <AlertDescription className="text-yellow-700 dark:text-yellow-300">
            {anomaly.message}
          </AlertDescription>
        </Alert>
      ))}
    </div>
  )
}
```

### File Locations

| File | Action | Purpose |
|------|--------|---------|
| `packages/backend/convex/schema.ts` | MODIFY | Add `emailDeliveryLogs` table |
| `packages/backend/convex/admin.ts` | MODIFY | Add delivery monitoring queries and mutations |
| `packages/backend/convex/admin.test.ts` | MODIFY | Add delivery monitoring tests |
| `apps/email-worker/src/index.ts` | MODIFY | Add delivery logging calls |
| `apps/web/src/routes/_authed/admin/delivery.tsx` | NEW | Delivery monitoring page |
| `apps/web/src/routes/_authed/admin/delivery.test.tsx` | NEW | Delivery page tests |
| `apps/web/src/components/admin/DeliveryStatsCard.tsx` | NEW | Stats display component |
| `apps/web/src/components/admin/DeliveryStatsCard.test.tsx` | NEW | Component tests |
| `apps/web/src/components/admin/DeliveryStatusBadge.tsx` | NEW | Status badge component |
| `apps/web/src/components/admin/DeliveryStatusBadge.test.tsx` | NEW | Component tests |
| `apps/web/src/components/admin/DeliveryLogTable.tsx` | NEW | Log table with expand |
| `apps/web/src/components/admin/DeliveryLogTable.test.tsx` | NEW | Component tests |
| `apps/web/src/components/admin/DeliveryDetailPanel.tsx` | NEW | Expandable detail panel |
| `apps/web/src/components/admin/DeliveryDetailPanel.test.tsx` | NEW | Component tests |
| `apps/web/src/components/admin/AnomalyAlertBanner.tsx` | NEW | Alert banner component |
| `apps/web/src/components/admin/AnomalyAlertBanner.test.tsx` | NEW | Component tests |
| `apps/web/src/routes/_authed/admin/route.tsx` | MODIFY | Add delivery nav link |

### Project Structure Notes

- **Delivery page under admin route group**: `routes/_authed/admin/delivery.tsx` - protected by admin guard from Story 7.1
- **Admin components folder**: Extends `components/admin/` with delivery-specific components
- **Email worker integration**: Minimal changes to existing worker - just add logging calls
- **Schema addition**: New table, no changes to existing tables

### Critical Implementation Rules

1. **EVERY admin query MUST call `requireAdmin`** - same pattern as Story 7.1
2. **Email worker logging is NON-BLOCKING** - failures in logging should not prevent email processing
3. **Use ConvexError with FORBIDDEN code** for non-admin access
4. **Real-time via Convex subscriptions** - NOT manual polling
5. **Date storage as Unix timestamps** - format on display only
6. **Internal mutations validate internalKey** - secure worker-to-Convex communication
7. **Idempotent log creation** - check messageId before creating duplicate
8. **Pagination for large log tables** - cap at 100 items per page

### Security Considerations

1. **Admin-only access** - All queries protected by `requireAdmin`
2. **Internal key validation** - Worker mutations verify CONVEX_INTERNAL_KEY
3. **No sensitive data in logs** - Don't store email body content, just metadata
4. **User ID linkage** - Track which user was affected for support purposes

### Performance Considerations

1. **Indexed queries** - Use `by_status_receivedAt` for filtered pagination
2. **Bounded queries** - Anomaly detection uses time-bounded queries
3. **Pagination** - Log table uses cursor-based pagination
4. **Count limitations** - `.collect()` + `.length` for counts (no COUNT aggregation in Convex)
5. **Real-time subscriptions** - Convex handles efficiently

### Error Codes for Categorization

```typescript
// Helper function for email worker
function categorizeError(error: Error): string {
  const message = error.message.toLowerCase()

  if (message.includes("parse") || message.includes("invalid email")) {
    return "PARSE_ERROR"
  }
  if (message.includes("user not found") || message.includes("no user")) {
    return "USER_NOT_FOUND"
  }
  if (message.includes("r2") || message.includes("storage") || message.includes("upload")) {
    return "R2_UPLOAD_FAILED"
  }
  if (message.includes("convex") || message.includes("database")) {
    return "DATABASE_ERROR"
  }
  if (message.includes("timeout")) {
    return "TIMEOUT"
  }

  return "UNKNOWN_ERROR"
}
```

### Testing Requirements

**Backend Contract Tests:**
1. `logEmailDelivery` creates log entry with "received" status
2. `logEmailDelivery` is idempotent (same messageId returns existing logId)
3. `updateDeliveryStatus` transitions status correctly
4. `updateDeliveryStatus` records timestamps appropriately
5. `getDeliveryStats` returns correct counts by status
6. `getDeliveryStats` respects time window parameter
7. `listDeliveryLogs` returns paginated results
8. `listDeliveryLogs` filters by status correctly
9. `getFailedDeliveries` returns only failed items
10. `getFailedDeliveries` respects includeAcknowledged flag
11. `getDeliveryRateStats` calculates success rates correctly
12. `getDeliveryAnomalies` detects high failure rate
13. `getDeliveryAnomalies` detects no deliveries
14. `acknowledgeFailedDelivery` sets isAcknowledged flag

**Frontend Component Tests:**
1. DeliveryStatsCard renders all stat values
2. DeliveryStatsCard shows correct colors for success rate
3. DeliveryStatusBadge renders all 4 status states
4. DeliveryLogTable renders log entries
5. DeliveryLogTable expands row on click
6. DeliveryLogTable shows empty state
7. DeliveryDetailPanel shows timeline
8. DeliveryDetailPanel shows error details for failed
9. DeliveryDetailPanel acknowledge button works
10. AnomalyAlertBanner renders critical alerts
11. AnomalyAlertBanner renders warning alerts

### Previous Story Intelligence (Story 7.1)

**Patterns to reuse:**
- Admin route guard layout structure
- `requireAdmin` helper pattern
- StatCard component pattern
- ServiceStatusBadge component pattern
- Loading skeletons for async data
- Card-based dashboard layout
- Real-time subscriptions via `useQuery` + `convexQuery`

**From code review fixes applied:**
- Add explicit TypeScript types for all props
- Add ARIA labels for accessibility
- Handle loading/error states comprehensively
- Use `isPending` for loading state (not `isLoading`)
- Add route contract tests

### Git Intelligence (Recent Commits)

```
566e924 feat: Add admin dashboard and system health monitoring with code review fixes (Story 7.1)
1643b9b feat: Add browse newsletters not personally received with code review fixes (Story 6.4)
```

**Established patterns:**
- Feature commits include "with code review fixes"
- Stories typically have 5-10 issues fixed in code review
- HIGH severity issues: security, accessibility, data integrity
- MEDIUM severity issues: type safety, error handling, UX

### Dependencies

**No New Dependencies Required** - Uses existing:
- `lucide-react` for icons (Download, AlertCircle, Clock, CheckCircle, ChevronRight, ChevronDown, AlertTriangle, XCircle)
- `date-fns` for time formatting
- `@tanstack/react-query` for data fetching
- `@convex-dev/react-query` for Convex integration
- shadcn/ui components (Card, Badge, Button, Table, Select, Alert)

### Cloudflare Worker Integration Notes

**External Monitoring (Documentation Only):**
- Cloudflare Dashboard URL: `https://dash.cloudflare.com/{account_id}/workers/services/view/email-worker`
- Consider adding link to Cloudflare dashboard in admin UI (non-functional, just documentation)
- Real-time logs: Cloudflare `wrangler tail` command for live debugging

**Worker Dead Letter Queue:**
- Cloudflare Workers have built-in retry mechanisms
- Consider: Queue failed emails for manual retry via Cloudflare Queues (future enhancement)

### References

- [Source: planning-artifacts/epics.md#Story 7.2] - Original acceptance criteria
- [Source: planning-artifacts/architecture.md#Email Worker] - Email worker structure
- [Source: planning-artifacts/architecture.md#Admin/Operations] - Admin route structure
- [Source: planning-artifacts/architecture.md#Convex Patterns] - Query/mutation patterns
- [Source: project-context.md#Convex Patterns] - Naming conventions
- [Source: project-context.md#Critical Implementation Rules] - Auth patterns
- [Source: 7-1-admin-dashboard-system-health.md] - Previous story implementation

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - no significant issues encountered during implementation.

### Completion Notes List

1. **Task 2 Implementation Note:** The delivery logging was integrated into the `emailIngestion.ts` HTTP action (server-side) rather than the email-worker (client-side). This is because the internal mutations can only be called from within Convex. The email worker only forwards email data to the Convex HTTP action, which handles all processing and logging.

2. **Task 4.6 Skipped:** Date range filter not implemented. The page shows 24h stats by default with success rates for 1h/24h/7d periods which provides sufficient time-based visibility.

3. **Tasks 5.4 & 5.5 Skipped:** Retry functionality not implemented. When an email fails to process, the original email content is not persisted (only the log entry). Retrying would require the email to be re-sent by the original sender or for the email worker to queue failed emails (Cloudflare Queues - future enhancement).

4. **Task 7.2 & 7.3 Simplified:** Delivery stats are accessible from the dedicated Email Delivery page rather than duplicating them on the main admin dashboard. This keeps the main dashboard focused on overall system health while the delivery page provides deep dive monitoring.

5. **UI Components Added:** Created `alert.tsx` and `table.tsx` shadcn/ui components that were missing from the project.

### File List

**Backend - Convex Schema & Functions:**
- `packages/backend/convex/schema.ts` - Added `emailDeliveryLogs` table with status enum and indexes
- `packages/backend/convex/admin.ts` - Added delivery monitoring queries and mutations:
  - `getDeliveryStats` - counts by status for time period
  - `listDeliveryLogs` - paginated log table with filters
  - `getFailedDeliveries` - failed items with acknowledge filter
  - `getDeliveryRateStats` - success rates for 1h/24h/7d
  - `getDeliveryAnomalies` - detect unusual patterns
  - `acknowledgeFailedDelivery` - admin mutation to mark reviewed
  - `logEmailDelivery` - internal mutation to create delivery log
  - `updateDeliveryStatus` - internal mutation to update log status
- `packages/backend/convex/emailIngestion.ts` - Integrated delivery logging into email processing pipeline
- `packages/backend/convex/admin.test.ts` - Added contract tests for all new queries/mutations

**Frontend - Routes:**
- `apps/web/src/routes/_authed/admin/route.tsx` - Added "Email Delivery" navigation link
- `apps/web/src/routes/_authed/admin/delivery.tsx` - New delivery monitoring page
- `apps/web/src/routes/_authed/admin/route.test.tsx` - Updated to document new nav link
- `apps/web/src/routes/_authed/admin/delivery.test.tsx` - Contract tests for delivery page

**Frontend - Components:**
- `apps/web/src/components/admin/DeliveryStatsCard.tsx` - Stats grid with success/failure rates
- `apps/web/src/components/admin/DeliveryStatsCard.test.tsx` - Component tests
- `apps/web/src/components/admin/DeliveryStatusBadge.tsx` - Status indicator badge
- `apps/web/src/components/admin/DeliveryStatusBadge.test.tsx` - Component tests
- `apps/web/src/components/admin/DeliveryLogTable.tsx` - Paginated log table with expandable rows
- `apps/web/src/components/admin/DeliveryLogTable.test.tsx` - Component tests
- `apps/web/src/components/admin/DeliveryDetailPanel.tsx` - Expandable row details with acknowledge
- `apps/web/src/components/admin/DeliveryDetailPanel.test.tsx` - Component tests
- `apps/web/src/components/admin/AnomalyAlertBanner.tsx` - Warning/critical alert banners
- `apps/web/src/components/admin/AnomalyAlertBanner.test.tsx` - Component tests

**Frontend - UI Components (New):**
- `apps/web/src/components/ui/alert.tsx` - shadcn/ui Alert component
- `apps/web/src/components/ui/table.tsx` - shadcn/ui Table component
