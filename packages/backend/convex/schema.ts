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
  })
    .index("by_email", ["email"])
    .index("by_authId", ["authId"])
    .index("by_dedicatedEmail", ["dedicatedEmail"]),

  // ============================================================
  // Epic 2.5: Shared Content Schema
  // ============================================================

  // Shared newsletter content (deduplicated) - only for public newsletters
  // Story 2.5.1: Task 1 - newsletterContent table
  newsletterContent: defineTable({
    contentHash: v.string(), // SHA-256 of normalized HTML
    r2Key: v.string(),
    subject: v.string(),
    senderEmail: v.string(),
    senderName: v.optional(v.string()),
    firstReceivedAt: v.number(), // Unix timestamp ms
    readerCount: v.number(), // Denormalized count for community discovery
  })
    .index("by_contentHash", ["contentHash"])
    .index("by_senderEmail", ["senderEmail"])
    .index("by_readerCount", ["readerCount"]),

  // User's relationship to newsletters (per-user, references shared content or private)
  // Story 2.5.1: Task 1 - userNewsletters table
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
  })
    .index("by_userId", ["userId"])
    .index("by_userId_receivedAt", ["userId", "receivedAt"])
    .index("by_userId_senderId", ["userId", "senderId"]) // Story 2.3: Efficient per-user sender queries
    .index("by_senderId", ["senderId"])
    .index("by_contentId", ["contentId"]),

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
})
