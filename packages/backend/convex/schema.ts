import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  // Users table - application user data linked to Better Auth
  users: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    createdAt: v.number(),
    // Link to Better Auth user record
    authId: v.optional(v.string()),
    // Dedicated email address for receiving newsletters (Story 1.4)
    dedicatedEmail: v.optional(v.string()),
    // Story 6.1: Track if user has seen the community sharing onboarding
    hasSeenSharingOnboarding: v.optional(v.boolean()),
    // Story 7.1: Admin role flag - only set via direct DB edit or migration
    isAdmin: v.optional(v.boolean()),
  })
    .index("by_email", ["email"])
    .index("by_authId", ["authId"])
    .index("by_dedicatedEmail", ["dedicatedEmail"]),

  // ============================================================
  // Epic 2.5: Shared Content Schema
  // ============================================================

  // Shared newsletter content (deduplicated) - only for public newsletters
  // Story 2.5.1: Task 1 - newsletterContent table
  // Story 5.1: Task 1.1 - Added summary fields for shared AI summaries
  newsletterContent: defineTable({
    contentHash: v.string(), // SHA-256 of normalized HTML
    r2Key: v.string(),
    subject: v.string(),
    senderEmail: v.string(),
    senderName: v.optional(v.string()),
    firstReceivedAt: v.number(), // Unix timestamp ms
    readerCount: v.number(), // Denormalized count for community discovery
    // Story 5.1: AI Summary (shared for public newsletters - first user to generate shares with all)
    summary: v.optional(v.string()),
    summaryGeneratedAt: v.optional(v.number()), // Unix timestamp ms
  })
    .index("by_contentHash", ["contentHash"])
    .index("by_senderEmail", ["senderEmail"])
    .index("by_readerCount", ["readerCount"])
    .index("by_firstReceivedAt", ["firstReceivedAt"]), // Story 6.1: For "Recent" sort in community browse

  // User's relationship to newsletters (per-user, references shared content or private)
  // Story 2.5.1: Task 1 - userNewsletters table
  // Story 5.1: Task 1.2 - Added summary fields for personal/private summaries
  userNewsletters: defineTable({
    userId: v.id("users"),
    senderId: v.id("senders"),
    contentId: v.optional(v.id("newsletterContent")), // If public
    privateR2Key: v.optional(v.string()), // If private
    subject: v.string(),
    senderEmail: v.string(),
    senderName: v.optional(v.string()),
    receivedAt: v.number(), // Unix timestamp ms
    isRead: v.boolean(),
    isHidden: v.boolean(),
    isPrivate: v.boolean(),
    readProgress: v.optional(v.number()), // 0-100 percentage
    // Story 5.1: AI Summary (personal for private newsletters, or user-regenerated summaries)
    summary: v.optional(v.string()),
    summaryGeneratedAt: v.optional(v.number()), // Unix timestamp ms
  })
    .index("by_userId", ["userId"])
    .index("by_userId_receivedAt", ["userId", "receivedAt"])
    .index("by_userId_senderId", ["userId", "senderId"]) // Story 2.3: Efficient per-user sender queries
    .index("by_senderId", ["senderId"])
    .index("by_contentId", ["contentId"])
    .index("by_receivedAt", ["receivedAt"]), // Story 7.1: Admin recent activity queries

  // Global sender registry (not user-scoped)
  // Story 2.5.1: Task 1 - Refactored senders table
  senders: defineTable({
    email: v.string(),
    name: v.optional(v.string()),
    domain: v.string(),
    subscriberCount: v.number(), // How many users receive from this sender
    newsletterCount: v.number(), // Total newsletters from this sender
  })
    .index("by_email", ["email"])
    .index("by_domain", ["domain"])
    .index("by_subscriberCount", ["subscriberCount"]),

  // User's sender-specific settings (per-user preferences)
  // Story 2.5.1: Task 1 - userSenderSettings table
  userSenderSettings: defineTable({
    userId: v.id("users"),
    senderId: v.id("senders"),
    isPrivate: v.boolean(), // Does this user want this sender's newsletters private?
    folderId: v.optional(v.id("folders")),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_senderId", ["userId", "senderId"]),

  // Folders for organizing senders (created now for Epic 3)
  // Story 2.5.1: Task 1 - folders table
  folders: defineTable({
    userId: v.id("users"),
    name: v.string(),
    color: v.optional(v.string()), // Optional color for UI
    createdAt: v.number(), // Unix timestamp ms
  }).index("by_userId", ["userId"]),

  // ============================================================
  // Epic 4: Gmail Import Tables
  // Story 4.2: Newsletter Sender Scanning
  // ============================================================

  // Track ongoing Gmail scan progress per user
  // Story 4.2: Task 3.3 - gmailScanProgress table
  gmailScanProgress: defineTable({
    userId: v.id("users"),
    status: v.union(
      v.literal("scanning"),
      v.literal("complete"),
      v.literal("error")
    ),
    totalEmails: v.number(),
    processedEmails: v.number(),
    sendersFound: v.number(),
    startedAt: v.number(), // Unix timestamp ms
    completedAt: v.optional(v.number()), // Unix timestamp ms
    error: v.optional(v.string()),
  }).index("by_userId", ["userId"]),

  // Store detected newsletter senders before user approval (Story 4.3)
  // Story 4.2: Task 3.4 - detectedSenders table
  // Story 4.3: Task 1.1 - Added isSelected and isApproved fields
  detectedSenders: defineTable({
    userId: v.id("users"),
    email: v.string(),
    name: v.optional(v.string()),
    domain: v.string(),
    emailCount: v.number(),
    confidenceScore: v.number(), // 0-100 score from heuristics
    sampleSubjects: v.array(v.string()), // Up to 5 sample subjects
    detectedAt: v.number(), // Unix timestamp ms
    isSelected: v.optional(v.boolean()), // Story 4.3: Selection state for import approval (defaults to true)
    isApproved: v.optional(v.boolean()), // Story 4.3: Set to true after "Import Selected" clicked
  })
    .index("by_userId", ["userId"])
    .index("by_userId_email", ["userId", "email"])
    .index("by_userId_isSelected", ["userId", "isSelected"]), // Story 4.3: For efficient selected count queries

  // ============================================================
  // Story 4.4: Historical Email Import Progress
  // ============================================================

  // Track ongoing Gmail import progress per user
  // Story 4.4: Task 1.1 - gmailImportProgress table
  //
  // Status values:
  // - "pending": Reserved for future queue-based imports (not currently used)
  // - "importing": Import actively in progress
  // - "complete": Import finished successfully
  // - "error": Import failed with error
  gmailImportProgress: defineTable({
    userId: v.id("users"),
    status: v.union(
      v.literal("pending"), // Reserved for future queue-based imports
      v.literal("importing"),
      v.literal("complete"),
      v.literal("error")
    ),
    totalEmails: v.number(),
    importedEmails: v.number(),
    failedEmails: v.number(),
    skippedEmails: v.number(), // Duplicates
    startedAt: v.number(), // Unix timestamp ms
    completedAt: v.optional(v.number()), // Unix timestamp ms
    error: v.optional(v.string()),
  }).index("by_userId", ["userId"]),

  // ============================================================
  // Story 7.1: Admin Dashboard System Health
  // ============================================================

  // Historical metrics snapshots for trend display
  // Story 7.1: Task 4.1 - systemMetricsHistory table
  systemMetricsHistory: defineTable({
    date: v.string(), // "2026-01-25" format for deduplication
    totalUsers: v.number(),
    totalNewsletters: v.number(),
    totalSenders: v.number(),
    totalUserNewsletters: v.number(),
    storageUsedBytes: v.number(),
    recordedAt: v.number(), // Unix timestamp ms
  })
    .index("by_date", ["date"])
    .index("by_recordedAt", ["recordedAt"]),
})
