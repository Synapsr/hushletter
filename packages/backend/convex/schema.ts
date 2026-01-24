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

  // Initial schema - expand in future stories
})
