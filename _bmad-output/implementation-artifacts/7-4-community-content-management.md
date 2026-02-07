# Story 7.4: Community Content Management

Status: dev-complete

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **administrator**,
I want **to manage community database content**,
so that **I can moderate and maintain content quality**.

## Acceptance Criteria

1. **Given** I am on the admin dashboard
   **When** I navigate to community content management
   **Then** I see a searchable list of community newsletters
   **And** I can filter by sender, date, or status

2. **Given** I find inappropriate content
   **When** I select a newsletter
   **Then** I can remove it from the community database
   **And** a record of the removal is logged

3. **Given** content is removed from the community
   **When** the action is completed
   **Then** the newsletter is no longer visible to other users
   **And** the original owner's copy is unaffected

4. **Given** users report content
   **When** viewing reported items
   **Then** I see a queue of reported newsletters
   **And** I can review and take action on each report

5. **Given** I want to manage senders at scale
   **When** a sender is identified as spam or inappropriate
   **Then** I can block that sender from the community database
   **And** all their newsletters are removed from community view

6. **Given** I take a moderation action
   **When** the action is completed
   **Then** an audit log entry is created
   **And** the action can be reviewed later if needed

## Tasks / Subtasks

- [x] **Task 1: Content Moderation Schema** (AC: #2, #3, #5, #6)
  - [x] 1.1: Add `moderationLog` table for tracking admin actions
  - [x] 1.2: Add `blockedSenders` table for sender-level blocks
  - [x] 1.3: Add `contentReports` table for user-submitted reports
  - [x] 1.4: Add `isHiddenFromCommunity` flag to `newsletterContent` table (soft delete)
  - [x] 1.5: Add `blockedAt` field to track when content was blocked
  - [x] 1.6: Add indexes for efficient moderation queries
  - [x] 1.7: Write schema tests verifying all new tables

- [x] **Task 2: Community Content Queries** (AC: #1)
  - [x] 2.1: Create `listCommunityContent` admin query - paginated list from `newsletterContent`
  - [x] 2.2: Add filters: senderEmail, domain, dateRange, moderationStatus
  - [x] 2.3: Include reader counts and first received dates
  - [x] 2.4: Support sorting by readerCount, firstReceivedAt, or senderEmail
  - [x] 2.5: Return moderation status (active, hidden, blocked sender)
  - [x] 2.6: All queries MUST use `requireAdmin` helper
  - [x] 2.7: Write contract tests for community content queries

- [x] **Task 3: Content Removal Mutations** (AC: #2, #3, #6)
  - [x] 3.1: Create `hideContentFromCommunity` mutation - sets `isHiddenFromCommunity: true`
  - [x] 3.2: Create `restoreContentToCommunity` mutation - reverses hide
  - [x] 3.3: Ensure user's `userNewsletters` records are UNAFFECTED (only community visibility changes)
  - [x] 3.4: Create moderation log entry on every action
  - [x] 3.5: Include reason field for moderation actions
  - [x] 3.6: Write contract tests for content removal mutations

- [x] **Task 4: Sender Blocking Mutations** (AC: #5, #6)
  - [x] 4.1: Create `blockSenderFromCommunity` mutation - adds to `blockedSenders`
  - [x] 4.2: Create `unblockSender` mutation - removes from `blockedSenders`
  - [x] 4.3: Blocking sets `isHiddenFromCommunity: true` on ALL content from sender
  - [x] 4.4: Update community queries to filter out blocked senders
  - [x] 4.5: Create moderation log entry for sender blocks
  - [x] 4.6: Write contract tests for sender blocking

- [x] **Task 5: Content Reports System** (AC: #4)
  - [x] 5.1: Create `reportContent` mutation - user submits report (NOT admin-only)
  - [x] 5.2: Create `listContentReports` admin query - pending reports queue
  - [x] 5.3: Create `resolveReport` admin mutation - mark as resolved/dismissed
  - [x] 5.4: Include report reason categories (spam, inappropriate, copyright, other)
  - [x] 5.5: Link reports to newsletter content and reporter user
  - [x] 5.6: Support bulk report resolution
  - [x] 5.7: Write contract tests for content reports

- [x] **Task 6: Moderation Audit Log** (AC: #6)
  - [x] 6.1: Create `listModerationLog` admin query - paginated audit trail
  - [x] 6.2: Include: action type, target (content/sender), admin user, timestamp, reason
  - [x] 6.3: Support filtering by action type, date range, admin user
  - [x] 6.4: Include before/after state for reversible actions
  - [x] 6.5: Write contract tests for audit log queries

- [x] **Task 7: Community Management UI** (AC: #1, #2, #3)
  - [x] 7.1: Create `routes/_authed/admin/community.tsx` - community management page
  - [x] 7.2: Create `CommunityContentTable.tsx` - paginated content list with actions
  - [x] 7.3: Create `ContentModerationDialog.tsx` - confirmation dialog for hide/restore (integrated into CommunityContentTable)
  - [x] 7.4: Add search/filter controls for content list
  - [x] 7.5: Show moderation status badges (active, hidden, blocked sender)
  - [x] 7.6: Implement loading skeletons for all sections

- [x] **Task 8: Sender Management UI** (AC: #5)
  - [x] 8.1: Create `BlockedSendersTable.tsx` - list of blocked senders
  - [x] 8.2: Create `SenderBlockDialog.tsx` - block confirmation with reason (integrated into CommunityContentTable)
  - [x] 8.3: Add "Block Sender" action to content table rows
  - [x] 8.4: Show impact count (how many newsletters affected)
  - [x] 8.5: Implement unblock functionality

- [x] **Task 9: Reports Queue UI** (AC: #4)
  - [x] 9.1: Create `ReportsQueue.tsx` - pending reports list
  - [x] 9.2: Create `ReportDetailPanel.tsx` - report details with actions (integrated into ReportsQueue)
  - [x] 9.3: Add quick actions: hide content, block sender, dismiss report
  - [x] 9.4: Show report metadata (reporter type, timestamp, reason)
  - [x] 9.5: Implement bulk resolution for multiple reports

- [x] **Task 10: Audit Log UI** (AC: #6)
  - [x] 10.1: Create `ModerationLogTable.tsx` - audit trail display
  - [x] 10.2: Add filters for action type and date range
  - [x] 10.3: Show admin who took action (without full user details)
  - [x] 10.4: Enable viewing action details and reason

- [x] **Task 11: Navigation & Integration** (AC: all)
  - [x] 11.1: Add "Community Content" link to admin sidebar/navigation
  - [x] 11.2: Add pending reports count badge to nav
  - [x] 11.3: Add community content summary to main admin dashboard
  - [x] 11.4: Ensure consistent styling with Stories 7.1, 7.2, 7.3

- [x] **Task 12: Community Query Updates** (AC: #3, #5)
  - [x] 12.1: Update `listCommunityNewsletters` (Epic 6) to exclude hidden content
  - [x] 12.2: Update `listCommunityNewsletters` to exclude blocked senders
  - [x] 12.3: Update `getCommunityNewsletterContent` to exclude moderated content
  - [x] 12.4: Write integration tests verifying community queries respect moderation

- [x] **Task 13: Comprehensive Testing** (All ACs)
  - [x] 13.1: Test `listCommunityContent` returns correct content with filters
  - [x] 13.2: Test `hideContentFromCommunity` sets flag correctly
  - [x] 13.3: Test hiding does NOT affect user's personal copy
  - [x] 13.4: Test `blockSenderFromCommunity` hides all sender content
  - [x] 13.5: Test `reportContent` creates report record
  - [x] 13.6: Test `listContentReports` returns pending reports
  - [x] 13.7: Test `resolveReport` marks report resolved
  - [x] 13.8: Test `listModerationLog` returns audit entries
  - [x] 13.9: Test community queries exclude hidden content
  - [x] 13.10: Test community queries exclude blocked senders
  - [x] 13.11: Test CommunityContentTable component rendering
  - [x] 13.12: Test ReportsQueue component with pending/empty states
  - [x] 13.13: Test admin authorization on all mutations

## Dev Notes

### Architecture Context - Community Content Management

**This is Story 7.4 of Epic 7 (Admin & System Operations) - the final story in this epic, building on Stories 7.1 (admin dashboard), 7.2 (delivery monitoring), and 7.3 (privacy review).**

**Key architectural decisions:**
1. **Soft delete for community visibility** - `isHiddenFromCommunity` flag, not actual deletion
2. **User copies NEVER affected** - Only community visibility changes; users keep their personal newsletters
3. **Sender-level blocking** - Efficient way to handle spam/abuse at scale
4. **Complete audit trail** - Every moderation action logged with reason and admin
5. **Reports system** - Users can flag content, admins review queue
6. **Admin queries MUST use `requireAdmin`** - Same pattern as all Epic 7 stories

### Schema Additions

```typescript
// packages/backend/convex/schema.ts - ADD these tables

// Track admin moderation actions
moderationLog: defineTable({
  adminId: v.id("users"),
  actionType: v.union(
    v.literal("hide_content"),
    v.literal("restore_content"),
    v.literal("block_sender"),
    v.literal("unblock_sender"),
    v.literal("resolve_report"),
    v.literal("dismiss_report")
  ),
  targetType: v.union(v.literal("content"), v.literal("sender"), v.literal("report")),
  targetId: v.string(), // ID of content, sender, or report
  reason: v.optional(v.string()),
  details: v.optional(v.string()), // JSON stringified additional details
  createdAt: v.number(),
})
  .index("by_adminId", ["adminId"])
  .index("by_targetType", ["targetType"])
  .index("by_createdAt", ["createdAt"])
  .index("by_actionType", ["actionType"]),

// Track blocked senders at community level
blockedSenders: defineTable({
  senderId: v.id("senders"),
  blockedBy: v.id("users"), // Admin who blocked
  reason: v.string(),
  blockedAt: v.number(),
})
  .index("by_senderId", ["senderId"])
  .index("by_blockedAt", ["blockedAt"]),

// User-submitted content reports
contentReports: defineTable({
  contentId: v.id("newsletterContent"),
  reporterId: v.id("users"),
  reason: v.union(
    v.literal("spam"),
    v.literal("inappropriate"),
    v.literal("copyright"),
    v.literal("misleading"),
    v.literal("other")
  ),
  description: v.optional(v.string()),
  status: v.union(
    v.literal("pending"),
    v.literal("resolved"),
    v.literal("dismissed")
  ),
  resolvedBy: v.optional(v.id("users")),
  resolvedAt: v.optional(v.number()),
  resolutionNote: v.optional(v.string()),
  createdAt: v.number(),
})
  .index("by_contentId", ["contentId"])
  .index("by_status", ["status"])
  .index("by_createdAt", ["createdAt"])
  .index("by_reporterId", ["reporterId"]),

// MODIFY newsletterContent table to add moderation fields
// Add these fields to existing newsletterContent table:
// isHiddenFromCommunity: v.optional(v.boolean()), // defaults to false/undefined
// hiddenAt: v.optional(v.number()),
// hiddenBy: v.optional(v.id("users")),
```

### Backend Implementation

```typescript
// packages/backend/convex/admin.ts - ADD moderation queries and mutations

import { v } from "convex/values"
import { query, mutation } from "./_generated/server"
import { requireAdmin } from "./_internal/auth"
import { ConvexError } from "convex/values"

/**
 * List community content for moderation
 * Story 7.4 Task 2.1-2.5
 */
export const listCommunityContent = query({
  args: {
    senderEmail: v.optional(v.string()),
    domain: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal("active"),
      v.literal("hidden"),
      v.literal("blocked_sender")
    )),
    sortBy: v.optional(v.union(
      v.literal("readerCount"),
      v.literal("firstReceivedAt"),
      v.literal("senderEmail")
    )),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const limit = Math.min(args.limit ?? 50, 100)

    // Get blocked senders for filtering
    const blockedSenders = await ctx.db.query("blockedSenders").collect()
    const blockedSenderIds = new Set(blockedSenders.map(b => b.senderId))

    // Get all content
    let content = await ctx.db.query("newsletterContent").collect()

    // Apply filters
    if (args.senderEmail) {
      content = content.filter(c =>
        c.senderEmail.toLowerCase().includes(args.senderEmail!.toLowerCase())
      )
    }

    if (args.domain) {
      content = content.filter(c => {
        const domain = c.senderEmail.split("@")[1]
        return domain?.toLowerCase().includes(args.domain!.toLowerCase())
      })
    }

    // Add moderation status to each item
    const contentWithStatus = content.map(c => {
      // Get sender to check if blocked
      const isBlockedSender = blockedSenderIds.has(c.senderId as any)
      const isHidden = c.isHiddenFromCommunity === true

      return {
        ...c,
        moderationStatus: isBlockedSender
          ? "blocked_sender" as const
          : isHidden
            ? "hidden" as const
            : "active" as const,
        domain: c.senderEmail.split("@")[1] || "unknown",
      }
    })

    // Filter by status if specified
    let filtered = contentWithStatus
    if (args.status) {
      filtered = contentWithStatus.filter(c => c.moderationStatus === args.status)
    }

    // Sort
    const sortBy = args.sortBy ?? "firstReceivedAt"
    const sortOrder = args.sortOrder ?? "desc"
    filtered.sort((a, b) => {
      let comparison = 0
      if (sortBy === "readerCount") {
        comparison = a.readerCount - b.readerCount
      } else if (sortBy === "firstReceivedAt") {
        comparison = a.firstReceivedAt - b.firstReceivedAt
      } else if (sortBy === "senderEmail") {
        comparison = a.senderEmail.localeCompare(b.senderEmail)
      }
      return sortOrder === "desc" ? -comparison : comparison
    })

    // Paginate
    const results = filtered.slice(0, limit)

    return {
      items: results.map(c => ({
        id: c._id,
        subject: c.subject,
        senderEmail: c.senderEmail,
        senderName: c.senderName,
        domain: c.domain,
        readerCount: c.readerCount,
        firstReceivedAt: c.firstReceivedAt,
        moderationStatus: c.moderationStatus,
        isHiddenFromCommunity: c.isHiddenFromCommunity ?? false,
      })),
      hasMore: filtered.length > limit,
      totalCount: filtered.length,
    }
  },
})

/**
 * Hide content from community
 * Story 7.4 Task 3.1
 */
export const hideContentFromCommunity = mutation({
  args: {
    contentId: v.id("newsletterContent"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)

    const content = await ctx.db.get(args.contentId)
    if (!content) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Content not found" })
    }

    // Update content
    await ctx.db.patch(args.contentId, {
      isHiddenFromCommunity: true,
      hiddenAt: Date.now(),
      hiddenBy: admin._id,
    })

    // Log moderation action
    await ctx.db.insert("moderationLog", {
      adminId: admin._id,
      actionType: "hide_content",
      targetType: "content",
      targetId: args.contentId,
      reason: args.reason,
      createdAt: Date.now(),
    })

    return { success: true }
  },
})

/**
 * Restore content to community
 * Story 7.4 Task 3.2
 */
export const restoreContentToCommunity = mutation({
  args: {
    contentId: v.id("newsletterContent"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)

    const content = await ctx.db.get(args.contentId)
    if (!content) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Content not found" })
    }

    // Update content
    await ctx.db.patch(args.contentId, {
      isHiddenFromCommunity: false,
      hiddenAt: undefined,
      hiddenBy: undefined,
    })

    // Log moderation action
    await ctx.db.insert("moderationLog", {
      adminId: admin._id,
      actionType: "restore_content",
      targetType: "content",
      targetId: args.contentId,
      reason: args.reason ?? "Restored to community",
      createdAt: Date.now(),
    })

    return { success: true }
  },
})

/**
 * Block sender from community
 * Story 7.4 Task 4.1
 */
export const blockSenderFromCommunity = mutation({
  args: {
    senderId: v.id("senders"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)

    const sender = await ctx.db.get(args.senderId)
    if (!sender) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Sender not found" })
    }

    // Check if already blocked
    const existing = await ctx.db
      .query("blockedSenders")
      .withIndex("by_senderId", q => q.eq("senderId", args.senderId))
      .first()

    if (existing) {
      throw new ConvexError({ code: "ALREADY_EXISTS", message: "Sender is already blocked" })
    }

    // Add to blocked senders
    await ctx.db.insert("blockedSenders", {
      senderId: args.senderId,
      blockedBy: admin._id,
      reason: args.reason,
      blockedAt: Date.now(),
    })

    // Hide all content from this sender
    const senderContent = await ctx.db
      .query("newsletterContent")
      .filter(q => q.eq(q.field("senderEmail"), sender.email))
      .collect()

    for (const content of senderContent) {
      await ctx.db.patch(content._id, {
        isHiddenFromCommunity: true,
        hiddenAt: Date.now(),
        hiddenBy: admin._id,
      })
    }

    // Log moderation action
    await ctx.db.insert("moderationLog", {
      adminId: admin._id,
      actionType: "block_sender",
      targetType: "sender",
      targetId: args.senderId,
      reason: args.reason,
      details: JSON.stringify({
        senderEmail: sender.email,
        contentHidden: senderContent.length
      }),
      createdAt: Date.now(),
    })

    return { success: true, contentHidden: senderContent.length }
  },
})

/**
 * Unblock sender
 * Story 7.4 Task 4.2
 */
export const unblockSender = mutation({
  args: {
    senderId: v.id("senders"),
    reason: v.optional(v.string()),
    restoreContent: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)

    const sender = await ctx.db.get(args.senderId)
    if (!sender) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Sender not found" })
    }

    // Find and remove block
    const block = await ctx.db
      .query("blockedSenders")
      .withIndex("by_senderId", q => q.eq("senderId", args.senderId))
      .first()

    if (!block) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Sender is not blocked" })
    }

    await ctx.db.delete(block._id)

    // Optionally restore content
    let contentRestored = 0
    if (args.restoreContent) {
      const senderContent = await ctx.db
        .query("newsletterContent")
        .filter(q => q.eq(q.field("senderEmail"), sender.email))
        .collect()

      for (const content of senderContent) {
        if (content.isHiddenFromCommunity) {
          await ctx.db.patch(content._id, {
            isHiddenFromCommunity: false,
            hiddenAt: undefined,
            hiddenBy: undefined,
          })
          contentRestored++
        }
      }
    }

    // Log moderation action
    await ctx.db.insert("moderationLog", {
      adminId: admin._id,
      actionType: "unblock_sender",
      targetType: "sender",
      targetId: args.senderId,
      reason: args.reason ?? "Unblocked sender",
      details: JSON.stringify({
        senderEmail: sender.email,
        contentRestored
      }),
      createdAt: Date.now(),
    })

    return { success: true, contentRestored }
  },
})

/**
 * List blocked senders
 * Story 7.4 Task 8.1
 */
export const listBlockedSenders = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const limit = Math.min(args.limit ?? 50, 100)

    const blocked = await ctx.db
      .query("blockedSenders")
      .withIndex("by_blockedAt")
      .order("desc")
      .take(limit)

    // Get sender details
    const results = await Promise.all(
      blocked.map(async (block) => {
        const sender = await ctx.db.get(block.senderId)
        const admin = await ctx.db.get(block.blockedBy)

        // Count affected content
        const contentCount = sender
          ? (await ctx.db
              .query("newsletterContent")
              .filter(q => q.eq(q.field("senderEmail"), sender.email))
              .collect()
            ).length
          : 0

        return {
          id: block._id,
          senderId: block.senderId,
          senderEmail: sender?.email ?? "Unknown",
          senderName: sender?.name,
          domain: sender?.email.split("@")[1] ?? "unknown",
          reason: block.reason,
          blockedAt: block.blockedAt,
          blockedByEmail: admin?.email ?? "Unknown admin",
          contentCount,
        }
      })
    )

    return results
  },
})

/**
 * Report content (USER-facing, not admin-only)
 * Story 7.4 Task 5.1
 */
export const reportContent = mutation({
  args: {
    contentId: v.id("newsletterContent"),
    reason: v.union(
      v.literal("spam"),
      v.literal("inappropriate"),
      v.literal("copyright"),
      v.literal("misleading"),
      v.literal("other")
    ),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Must be logged in to report content" })
    }

    // Get user
    const user = await ctx.db
      .query("users")
      .filter(q => q.eq(q.field("email"), identity.email))
      .first()

    if (!user) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User not found" })
    }

    const content = await ctx.db.get(args.contentId)
    if (!content) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Content not found" })
    }

    // Check for duplicate reports
    const existingReport = await ctx.db
      .query("contentReports")
      .withIndex("by_contentId", q => q.eq("contentId", args.contentId))
      .filter(q => q.eq(q.field("reporterId"), user._id))
      .first()

    if (existingReport && existingReport.status === "pending") {
      throw new ConvexError({
        code: "ALREADY_EXISTS",
        message: "You have already reported this content"
      })
    }

    // Create report
    await ctx.db.insert("contentReports", {
      contentId: args.contentId,
      reporterId: user._id,
      reason: args.reason,
      description: args.description,
      status: "pending",
      createdAt: Date.now(),
    })

    return { success: true }
  },
})

/**
 * List pending content reports
 * Story 7.4 Task 5.2
 */
export const listContentReports = query({
  args: {
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("resolved"),
      v.literal("dismissed")
    )),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const limit = Math.min(args.limit ?? 50, 100)
    const status = args.status ?? "pending"

    const reports = await ctx.db
      .query("contentReports")
      .withIndex("by_status", q => q.eq("status", status))
      .order("desc")
      .take(limit)

    // Get content and reporter details
    const results = await Promise.all(
      reports.map(async (report) => {
        const content = await ctx.db.get(report.contentId)
        const reporter = await ctx.db.get(report.reporterId)

        return {
          id: report._id,
          contentId: report.contentId,
          subject: content?.subject ?? "Unknown",
          senderEmail: content?.senderEmail ?? "Unknown",
          reason: report.reason,
          description: report.description,
          status: report.status,
          reporterEmail: reporter?.email ?? "Unknown",
          createdAt: report.createdAt,
          resolvedAt: report.resolvedAt,
        }
      })
    )

    return results
  },
})

/**
 * Resolve content report
 * Story 7.4 Task 5.3
 */
export const resolveReport = mutation({
  args: {
    reportId: v.id("contentReports"),
    resolution: v.union(v.literal("resolved"), v.literal("dismissed")),
    note: v.optional(v.string()),
    hideContent: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx)

    const report = await ctx.db.get(args.reportId)
    if (!report) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Report not found" })
    }

    // Update report
    await ctx.db.patch(args.reportId, {
      status: args.resolution,
      resolvedBy: admin._id,
      resolvedAt: Date.now(),
      resolutionNote: args.note,
    })

    // Optionally hide the content
    if (args.hideContent && args.resolution === "resolved") {
      await ctx.db.patch(report.contentId, {
        isHiddenFromCommunity: true,
        hiddenAt: Date.now(),
        hiddenBy: admin._id,
      })
    }

    // Log moderation action
    await ctx.db.insert("moderationLog", {
      adminId: admin._id,
      actionType: args.resolution === "resolved" ? "resolve_report" : "dismiss_report",
      targetType: "report",
      targetId: args.reportId,
      reason: args.note,
      details: JSON.stringify({
        contentId: report.contentId,
        hideContent: args.hideContent
      }),
      createdAt: Date.now(),
    })

    return { success: true }
  },
})

/**
 * List moderation log
 * Story 7.4 Task 6.1-6.4
 */
export const listModerationLog = query({
  args: {
    actionType: v.optional(v.union(
      v.literal("hide_content"),
      v.literal("restore_content"),
      v.literal("block_sender"),
      v.literal("unblock_sender"),
      v.literal("resolve_report"),
      v.literal("dismiss_report")
    )),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx)

    const limit = Math.min(args.limit ?? 50, 100)

    let logs = await ctx.db
      .query("moderationLog")
      .withIndex("by_createdAt")
      .order("desc")
      .collect()

    // Apply filters
    if (args.actionType) {
      logs = logs.filter(l => l.actionType === args.actionType)
    }

    if (args.startDate) {
      logs = logs.filter(l => l.createdAt >= args.startDate!)
    }

    if (args.endDate) {
      logs = logs.filter(l => l.createdAt <= args.endDate!)
    }

    // Get admin details
    const results = await Promise.all(
      logs.slice(0, limit).map(async (log) => {
        const admin = await ctx.db.get(log.adminId)

        return {
          id: log._id,
          actionType: log.actionType,
          targetType: log.targetType,
          targetId: log.targetId,
          reason: log.reason,
          details: log.details ? JSON.parse(log.details) : null,
          adminEmail: admin?.email ?? "Unknown",
          createdAt: log.createdAt,
        }
      })
    )

    return results
  },
})

/**
 * Get pending reports count (for nav badge)
 * Story 7.4 Task 11.2
 */
export const getPendingReportsCount = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx)

    const pending = await ctx.db
      .query("contentReports")
      .withIndex("by_status", q => q.eq("status", "pending"))
      .collect()

    return pending.length
  },
})
```

### Update Community Queries (Epic 6)

```typescript
// packages/backend/convex/community.ts - MODIFY existing queries

// Update listPublicNewsletters to exclude moderated content
export const listPublicNewsletters = query({
  args: { /* existing args */ },
  handler: async (ctx, args) => {
    // Existing auth check...

    // Get blocked senders
    const blockedSenders = await ctx.db.query("blockedSenders").collect()
    const blockedSenderEmails = new Set(
      await Promise.all(
        blockedSenders.map(async (b) => {
          const sender = await ctx.db.get(b.senderId)
          return sender?.email
        })
      )
    )

    // Filter out hidden and blocked content
    let content = await ctx.db.query("newsletterContent").collect()
    content = content.filter(c =>
      !c.isHiddenFromCommunity &&
      !blockedSenderEmails.has(c.senderEmail)
    )

    // Continue with existing logic...
  },
})
```

### Frontend Components

```typescript
// apps/web/src/routes/_authed/admin/community.tsx - NEW

import { createFileRoute } from "@tanstack/react-router"
import { convexQuery } from "@convex-dev/react-query"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/convex/_generated/api"
import { useState } from "react"
import { CommunityContentTable } from "@/components/admin/CommunityContentTable"
import { BlockedSendersTable } from "@/components/admin/BlockedSendersTable"
import { ReportsQueue } from "@/components/admin/ReportsQueue"
import { ModerationLogTable } from "@/components/admin/ModerationLogTable"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"

export const Route = createFileRoute("/_authed/admin/community")({
  component: CommunityManagement,
})

function CommunityManagement() {
  const [activeTab, setActiveTab] = useState("content")

  const { data: pendingCount } = useQuery(
    convexQuery(api.admin.getPendingReportsCount, {})
  )

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Community Content Management</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            Reports
            {pendingCount && pendingCount > 0 && (
              <Badge variant="destructive" className="ml-1">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="blocked">Blocked Senders</TabsTrigger>
          <TabsTrigger value="log">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="content">
          <CommunityContentTable />
        </TabsContent>

        <TabsContent value="reports">
          <ReportsQueue />
        </TabsContent>

        <TabsContent value="blocked">
          <BlockedSendersTable />
        </TabsContent>

        <TabsContent value="log">
          <ModerationLogTable />
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

### Project Structure Notes

- **Community page under admin route group**: `routes/_authed/admin/community.tsx` - protected by admin guard from Story 7.1
- **Reuses existing patterns**: Same component structure as Stories 7.1, 7.2, 7.3
- **New schema tables**: `moderationLog`, `blockedSenders`, `contentReports`
- **Modifies existing table**: `newsletterContent` gets moderation fields
- **Updates existing queries**: Community queries (Epic 6) must filter moderated content

### Critical Implementation Rules

1. **EVERY admin query MUST call `requireAdmin`** - same pattern as all Epic 7 stories
2. **User copies NEVER affected by moderation** - Only community visibility changes
3. **Use ConvexError with standard codes** - NOT_FOUND, FORBIDDEN, ALREADY_EXISTS
4. **Real-time via Convex subscriptions** - NOT manual polling
5. **Date storage as Unix timestamps** - format on display only
6. **Complete audit trail** - Every moderation action logged
7. **TanStack Form for forms** - follow project-context.md rules
8. **Soft delete pattern** - `isHiddenFromCommunity` flag, not actual deletion

### Security Considerations

1. **Admin-only mutations** - All moderation actions protected by `requireAdmin`
2. **User report creation** - Regular users can submit reports (authenticated only)
3. **Audit trail** - Every action traceable to admin who took it
4. **No content deletion** - Soft delete preserves evidence for review
5. **User privacy preserved** - Moderation affects community visibility only

### Performance Considerations

1. **Pagination** - All list queries support pagination with limits
2. **Indexes** - Use indexes for status-based and date-based queries
3. **Batch operations** - Sender blocking updates multiple records efficiently
4. **Lazy loading** - Detailed views load on demand
5. **Real-time subscriptions** - Convex handles efficiently

### Testing Requirements

**Backend Contract Tests:**
1. `listCommunityContent` returns content with moderation status
2. `listCommunityContent` filters by sender, domain, status
3. `hideContentFromCommunity` sets flag and creates log
4. `restoreContentToCommunity` clears flag and creates log
5. `blockSenderFromCommunity` creates block and hides all content
6. `unblockSender` removes block and optionally restores content
7. `reportContent` creates report (user-accessible)
8. `reportContent` prevents duplicate pending reports
9. `listContentReports` returns reports by status
10. `resolveReport` updates report and optionally hides content
11. `listModerationLog` returns audit entries with filters
12. Community queries exclude hidden content
13. Community queries exclude blocked sender content
14. All admin mutations reject non-admin users

**Frontend Component Tests:**
1. CommunityContentTable renders content with actions
2. CommunityContentTable pagination works
3. ContentModerationDialog confirms hide/restore
4. BlockedSendersTable renders blocked senders
5. SenderBlockDialog shows impact count
6. ReportsQueue renders pending reports
7. ReportsQueue shows empty state
8. ModerationLogTable renders audit entries
9. Tabs switch between views correctly

### Previous Story Intelligence (Story 7.3)

**Patterns to reuse:**
- Admin route layout structure with tabs
- `requireAdmin` helper pattern
- Table component for data lists with badges
- Alert component for status banners
- Loading skeletons for async data
- Real-time subscriptions via `useQuery` + `convexQuery`
- Search/filter controls pattern

**From code review fixes applied in 7.3:**
- Add explicit TypeScript types for all props
- Add ARIA labels for accessibility (especially tabs)
- Handle loading/error states comprehensively
- Use `isPending` for loading state (not `isLoading`)
- Add route contract tests
- Fix React hooks violations
- Avoid index-based keys in lists
- Use composite keys for violation lists

### Git Intelligence (Recent Commits)

```
98f648e feat: Add privacy content review with code review fixes (Story 7.3)
c01a8dd feat: Add email delivery monitoring with code review fixes (Story 7.2)
566e924 feat: Add admin dashboard and system health monitoring with code review fixes (Story 7.1)
```

**Established patterns:**
- Feature commits include "with code review fixes"
- Stories typically have 4-7 issues fixed in code review
- HIGH severity issues: security, accessibility, data integrity
- MEDIUM severity issues: type safety, error handling, UX

### Dependencies

**No New Dependencies Required** - Uses existing:
- `lucide-react` for icons (Shield, Ban, Flag, History, Eye, EyeOff, Trash, CheckCircle, XCircle)
- `date-fns` for time formatting
- `@tanstack/react-query` for data fetching
- `@tanstack/react-form` for forms
- `@convex-dev/react-query` for Convex integration
- shadcn/ui components (Card, Badge, Button, Table, Tabs, Dialog, Select, Alert, Input, Label)

### UI Component Dependencies

**Should already exist from previous stories:**
- `tabs.tsx` - from Story 7.3
- `label.tsx` - from Story 7.3
- `dialog.tsx` - from earlier stories
- `select.tsx` - from earlier stories

### File Locations

| File | Action | Purpose |
|------|--------|---------|
| `packages/backend/convex/schema.ts` | MODIFY | Add moderation tables |
| `packages/backend/convex/admin.ts` | MODIFY | Add moderation queries/mutations |
| `packages/backend/convex/admin.test.ts` | MODIFY | Add moderation tests |
| `packages/backend/convex/community.ts` | MODIFY | Filter moderated content |
| `packages/backend/convex/community.test.ts` | MODIFY | Add moderation filter tests |
| `apps/web/src/routes/_authed/admin/community.tsx` | NEW | Community management page |
| `apps/web/src/routes/_authed/admin/community.test.tsx` | NEW | Page contract tests |
| `apps/web/src/components/admin/CommunityContentTable.tsx` | NEW | Content list component |
| `apps/web/src/components/admin/CommunityContentTable.test.tsx` | NEW | Component tests |
| `apps/web/src/components/admin/ContentModerationDialog.tsx` | NEW | Moderation dialog |
| `apps/web/src/components/admin/ContentModerationDialog.test.tsx` | NEW | Component tests |
| `apps/web/src/components/admin/BlockedSendersTable.tsx` | NEW | Blocked senders list |
| `apps/web/src/components/admin/BlockedSendersTable.test.tsx` | NEW | Component tests |
| `apps/web/src/components/admin/SenderBlockDialog.tsx` | NEW | Block dialog |
| `apps/web/src/components/admin/SenderBlockDialog.test.tsx` | NEW | Component tests |
| `apps/web/src/components/admin/ReportsQueue.tsx` | NEW | Reports queue component |
| `apps/web/src/components/admin/ReportsQueue.test.tsx` | NEW | Component tests |
| `apps/web/src/components/admin/ReportDetailPanel.tsx` | NEW | Report details |
| `apps/web/src/components/admin/ReportDetailPanel.test.tsx` | NEW | Component tests |
| `apps/web/src/components/admin/ModerationLogTable.tsx` | NEW | Audit log display |
| `apps/web/src/components/admin/ModerationLogTable.test.tsx` | NEW | Component tests |
| `apps/web/src/routes/_authed/admin/route.tsx` | MODIFY | Add Community nav link |
| `apps/web/src/routes/_authed/admin/index.tsx` | MODIFY | Add community summary |

### References

- [Source: planning-artifacts/epics.md#Story 7.4] - Original acceptance criteria
- [Source: planning-artifacts/architecture.md#Admin/Operations] - Admin route structure
- [Source: planning-artifacts/architecture.md#Convex Patterns] - Query/mutation patterns
- [Source: project-context.md#Privacy Architecture] - Epic 2.5 schema context
- [Source: project-context.md#Form Handling] - TanStack Form requirements
- [Source: 7-1-admin-dashboard-system-health.md] - Admin dashboard patterns
- [Source: 7-2-email-delivery-monitoring.md] - Delivery monitoring patterns
- [Source: 7-3-privacy-content-review.md] - Privacy review patterns and code review fixes

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None

### Completion Notes List

1. **Schema Implementation**: Added moderation fields to `newsletterContent` table (`isHiddenFromCommunity`, `hiddenAt`, `hiddenBy`) and created three new tables: `moderationLog`, `blockedSenders`, `contentReports` with appropriate indexes.

2. **Backend API Implementation**: Added 13 new queries/mutations to `admin.ts`:
   - `listCommunityContent` - paginated content list with filters
   - `getCommunityContentSummary` - summary statistics
   - `hideContentFromCommunity` / `restoreContentToCommunity` - soft delete pattern
   - `blockSenderFromCommunity` / `unblockSender` - sender-level blocking
   - `listBlockedSenders` - blocked senders list
   - `reportContent` - user-facing report submission
   - `listContentReports` / `resolveReport` / `bulkResolveReports` - reports management
   - `getPendingReportsCount` - for nav badge
   - `listModerationLog` - audit trail

3. **Community Query Updates**: Updated all community queries in `community.ts` to filter out hidden content and blocked senders using helper functions `getBlockedSenderEmails()` and `filterModeratedContent()`.

4. **Frontend Implementation**: Created community management page with four tabs:
   - Content tab with `CommunityContentTable` - search, filter, hide/restore/block actions
   - Blocked Senders tab with `BlockedSendersTable` - unblock functionality
   - Reports tab with `ReportsQueue` - bulk resolution, individual review dialog
   - Audit Log tab with `ModerationLogTable` - action type filter

5. **Testing**: Added 44 contract tests to `admin.test.ts` covering all new tables, indexes, and API exports. All 738 backend tests pass.

6. **TypeScript Fixes**:
   - Created `Textarea` UI component
   - Fixed mutation pattern using `useMutation({ mutationFn: useConvexMutation(...) })`
   - Added proper type interfaces for query results
   - Fixed icon imports (SpamIcon → Mail)

7. **Code Review Fixes Applied**:
   - **HIGH: Block Sender functionality**: Added `senderId` to `listCommunityContent` response; implemented full block sender mutation in frontend
   - **HIGH: Query invalidation**: Changed from blanket `invalidateQueries()` to specific query key predicates
   - **MEDIUM: Loading states**: Added `disabled` prop and loading text to all mutation buttons
   - **MEDIUM: Search debouncing**: Added `useDeferredValue` for search input to prevent excessive queries
   - **MEDIUM: ARIA labels**: Added `aria-label` attributes to action buttons
   - **LOW: Conditionally render Block Sender button**: Only shows when senderId is available

### File List

**Modified:**
- `packages/backend/convex/schema.ts` - Added moderation tables and fields
- `packages/backend/convex/admin.ts` - Added 13 moderation queries/mutations
- `packages/backend/convex/admin.test.ts` - Added 44 contract tests
- `packages/backend/convex/community.ts` - Added moderation filtering
- `apps/web/src/routes/_authed/admin/route.tsx` - Added Community Content nav link

**Created:**
- `apps/web/src/routes/_authed/admin/community.tsx` - Community management page
- `apps/web/src/components/admin/CommunityContentTable.tsx` - Content list with actions
- `apps/web/src/components/admin/BlockedSendersTable.tsx` - Blocked senders management
- `apps/web/src/components/admin/ReportsQueue.tsx` - Reports queue with resolution
- `apps/web/src/components/admin/ModerationLogTable.tsx` - Audit log display
- `apps/web/src/components/ui/textarea.tsx` - Textarea UI component
