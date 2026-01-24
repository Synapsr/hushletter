# Story 2.5.1: Shared Content Schema Implementation

Status: done

## Story

As a **developer**,
I want **to implement a shared content schema for newsletters**,
so that **public newsletters can be deduplicated and discovered by other users**.

## Acceptance Criteria

**AC1: New Tables Created**
**Given** the new schema is implemented
**When** reviewing the database structure
**Then** `newsletterContent` table exists for shared public content
**And** `userNewsletters` table exists for per-user newsletter relationships
**And** `senders` table is global (not user-scoped)
**And** `userSenderSettings` table exists for per-user sender preferences
**And** `folders` table exists for organizing senders (used in Epic 3)

**AC2: Clean Schema Replacement**
**Given** the schema migration completes
**When** the system starts
**Then** the old `newsletters` table is DELETED (clean slate - no users yet)
**And** the old `senders` table is REPLACED with global version
**And** all existing code references are updated to new table names

**AC3: Public/Private Content Separation**
**Given** the new schema is in place
**When** creating newsletter records
**Then** public newsletters reference `newsletterContent.contentId`
**And** private newsletters store content directly via `privateR2Key`

## Tasks / Subtasks

- [x] Task 1: Create new Convex schema with all five tables (AC: 1)
  - [x] Define `newsletterContent` table with contentHash, r2Key, subject, senderEmail, senderName, firstReceivedAt, readerCount
  - [x] Define `userNewsletters` table with userId, senderId, contentId (optional), privateR2Key (optional), subject, senderEmail, senderName, receivedAt, isRead, isHidden, isPrivate, readProgress
  - [x] Refactor `senders` table to be global with subscriberCount, newsletterCount (remove userIds array)
  - [x] Define `userSenderSettings` table with userId, senderId, isPrivate (default false), folderId
  - [x] Define `folders` table with userId, name, color, createdAt (for Epic 3, created now to avoid schema changes later)

- [x] Task 2: Add all required indexes (AC: 1)
  - [x] `newsletterContent`: by_contentHash, by_senderEmail, by_readerCount
  - [x] `userNewsletters`: by_userId, by_userId_receivedAt, by_senderId, by_contentId
  - [x] `senders`: by_email, by_domain, by_subscriberCount
  - [x] `userSenderSettings`: by_userId, by_userId_senderId
  - [x] `folders`: by_userId

- [x] Task 3: Replace existing functions for new schema (AC: 2, 3)
  - [x] DELETE old `newsletters` table from schema (clean slate)
  - [x] REPLACE `senders` table with global version (remove userIds, add counts)
  - [x] Rewrite `newsletters.ts` queries to use `userNewsletters` table
  - [x] Rewrite `newsletters.ts` mutations to handle public vs private content paths
  - [x] Update `emailIngestion.ts` to use new schema flow

- [x] Task 4: Create helper functions for privacy determination (AC: 3)
  - [x] Create `getUserSenderSettings` query to check if sender is private for user
  - [x] Create `getOrCreateSender` mutation to handle global sender creation
  - [x] Create `getOrCreateUserSenderSettings` mutation for user-specific preferences

- [x] Task 5: Deploy and verify clean schema (AC: 2)
  - [x] Run `npx convex dev` to deploy new schema
  - [x] Verify old tables are removed and new tables are created
  - [x] Test email ingestion flow works with new schema
  - [x] Verify newsletter listing works with userNewsletters table

## Dev Notes

### CRITICAL IMPLEMENTATION GUARDRAILS

**CLEAN SLATE APPROACH - No existing users or important data!**

1. **DELETE the old `newsletters` table completely** - no migration needed, start fresh
2. **REPLACE the old `senders` table** - remove userIds array, add subscriberCount/newsletterCount
3. **Privacy is NOW per-user, NOT per-sender** - `userSenderSettings.isPrivate` determines if a user's copy is private
4. **Global senders enable community features** - `subscriberCount` and `newsletterCount` for discovery
5. **Clear R2 bucket data** - optionally clear old newsletter content from R2 (or leave it, orphaned files don't hurt)

### Epic 2.5 Context

**Why This Epic Exists:**
The original per-user newsletter storage (Story 2.2) doesn't scale for community discovery features. This epic introduces a shared content model where:
- Public newsletter content is deduplicated (stored once, referenced by many)
- Private newsletters are stored per-user (maximum privacy isolation)
- Senders become global entities enabling cross-user statistics

**Execution Order:**
1. **Story 2.5.1 (THIS)**: Schema implementation - create new tables
2. **Story 2.5.2**: Content deduplication pipeline - implement normalization and hashing

**Stories That Depend on Epic 2.5:**
- Story 2.3: Automatic Sender Detection (updated for global senders model)
- Story 2.4: Real-Time Newsletter Display (updated for userNewsletters table)
- All of Epic 6: Community Back-Catalog

### Previous Story Intelligence (Story 2.2)

**Key Learnings from Email Parsing & Content Storage:**
1. R2 storage is working via Convex R2 component (`@convex-dev/r2`)
2. `storeNewsletterContent` action uploads to R2 and creates newsletter record
3. `getNewsletterWithContent` generates signed URLs for content retrieval
4. `createNewsletter` mutation inserts into `newsletters` table

**Files from Story 2.2 that MUST be REPLACED/REWRITTEN:**
- `packages/backend/convex/schema.ts` - DELETE old tables, CREATE new ones
- `packages/backend/convex/newsletters.ts` - REWRITE for new schema (userNewsletters)
- `packages/backend/convex/emailIngestion.ts` - REWRITE for new flow

### Current Schema State (BEFORE this story)

```typescript
// CURRENT STATE - packages/backend/convex/schema.ts
newsletters: defineTable({
  userId: v.id("users"),
  senderId: v.optional(v.id("senders")),
  subject: v.string(),
  senderEmail: v.string(),
  senderName: v.optional(v.string()),
  receivedAt: v.number(),
  r2Key: v.optional(v.string()),
  isRead: v.boolean(),
  isHidden: v.boolean(),
  isPrivate: v.boolean(),
  readProgress: v.optional(v.number()),
})
  .index("by_userId", ["userId"])
  .index("by_userId_receivedAt", ["userId", "receivedAt"])
  .index("by_senderId", ["senderId"]),

senders: defineTable({
  email: v.string(),
  name: v.optional(v.string()),
  domain: v.string(),
  isPrivate: v.boolean(),
  userIds: v.array(v.id("users")), // PROBLEM: doesn't scale, privacy is per-sender not per-user
})
  .index("by_email", ["email"])
  .index("by_domain", ["domain"]),
```

### Target Schema (AFTER this story)

```typescript
// NEW TABLES - packages/backend/convex/schema.ts

// Shared content (deduplicated) - only for public newsletters
newsletterContent: defineTable({
  contentHash: v.string(),        // SHA-256 of normalized HTML
  r2Key: v.string(),
  subject: v.string(),
  senderEmail: v.string(),
  senderName: v.optional(v.string()),
  firstReceivedAt: v.number(),
  readerCount: v.number(),        // Denormalized count for community discovery
})
  .index("by_contentHash", ["contentHash"])
  .index("by_senderEmail", ["senderEmail"])
  .index("by_readerCount", ["readerCount"]),

// Global sender registry (no longer per-user)
senders: defineTable({
  email: v.string(),
  name: v.optional(v.string()),
  domain: v.string(),
  subscriberCount: v.number(),    // How many users receive from this sender
  newsletterCount: v.number(),    // Total newsletters from this sender
})
  .index("by_email", ["email"])
  .index("by_domain", ["domain"])
  .index("by_subscriberCount", ["subscriberCount"]),

// User's relationship to newsletters (per-user, references shared content or private)
userNewsletters: defineTable({
  userId: v.id("users"),
  senderId: v.id("senders"),
  contentId: v.optional(v.id("newsletterContent")),  // If public
  privateR2Key: v.optional(v.string()),              // If private
  subject: v.string(),
  senderEmail: v.string(),
  senderName: v.optional(v.string()),
  receivedAt: v.number(),
  isRead: v.boolean(),
  isHidden: v.boolean(),
  isPrivate: v.boolean(),
  readProgress: v.optional(v.number()),
})
  .index("by_userId", ["userId"])
  .index("by_userId_receivedAt", ["userId", "receivedAt"])
  .index("by_senderId", ["senderId"])
  .index("by_contentId", ["contentId"]),

// User's sender-specific settings (per-user preferences)
userSenderSettings: defineTable({
  userId: v.id("users"),
  senderId: v.id("senders"),
  isPrivate: v.boolean(),         // Does this user want this sender's newsletters private?
  folderId: v.optional(v.id("folders")),
})
  .index("by_userId", ["userId"])
  .index("by_userId_senderId", ["userId", "senderId"]),

// Folders for organizing senders (created now, used in Epic 3)
folders: defineTable({
  userId: v.id("users"),
  name: v.string(),
  color: v.optional(v.string()),  // Optional color for UI
  createdAt: v.number(),
})
  .index("by_userId", ["userId"]),
```

### Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Convex** | 1.25.0+ | Database schema and functions |
| **@convex-dev/r2** | Latest | R2 storage (already installed) |

### Architectural Decisions for This Story

1. **Clean replacement**: DELETE old tables, CREATE new ones (no migration complexity)
2. **Schema-first implementation**: Get the schema right before updating functions
3. **Update all references**: All functions must use new table names immediately
4. **Global senders**: Remove `userIds` array, add `subscriberCount` and `newsletterCount`
5. **Privacy per-user**: `userSenderSettings.isPrivate` determines privacy, not `senders.isPrivate`

### Data Flow After Schema Change

**Public Newsletter Flow:**
```
Email arrives → Parse → Check userSenderSettings.isPrivate (false)
  → Normalize content → Hash → Check newsletterContent exists?
    → YES: Reference existing contentId, increment readerCount
    → NO: Upload to R2, create newsletterContent, set readerCount=1
  → Create userNewsletters with contentId reference
```

**Private Newsletter Flow:**
```
Email arrives → Parse → Check userSenderSettings.isPrivate (true)
  → Upload to R2 with user-specific key
  → Create userNewsletters with privateR2Key (no contentId)
  → NO entry in newsletterContent (private content never shared)
```

### Anti-Patterns to Avoid

```typescript
// ❌ DON'T keep the old newsletters table - DELETE IT
// Clean slate, no migration needed

// ❌ DON'T add isPrivate to the global senders table
// Privacy is per-user now, via userSenderSettings

// ❌ DON'T skip indexes - they're critical for query performance
// Especially by_contentHash for deduplication lookups

// ✅ DO use optional fields for contentId and privateR2Key
// A newsletter is either public (has contentId) OR private (has privateR2Key)

// ❌ DON'T duplicate data unnecessarily
// userNewsletters has denormalized subject/senderEmail/senderName for fast listing
// But the canonical content is in newsletterContent or privateR2Key

// ❌ DON'T leave old function references
// Update ALL queries/mutations to use new table names
```

### Project Structure Notes

**Files REWRITTEN:**
- `packages/backend/convex/schema.ts` - DELETE old tables, CREATE new schema
- `packages/backend/convex/newsletters.ts` - REWRITE all queries/mutations for userNewsletters (includes newsletterContent functions per domain-file pattern)
- `packages/backend/convex/emailIngestion.ts` - REWRITE for new schema flow

**Files CREATED:**
- `packages/backend/convex/senders.ts` - Global sender management + userSenderSettings functions (combined per project-context.md "one file per domain" pattern)
- `packages/backend/convex/folders.ts` - Folder CRUD functions (basic structure for Epic 3)
- `packages/backend/convex/_internal/users.ts` - Internal user lookup queries

**Files UNCHANGED:**
- `apps/email-worker/src/*` - No changes needed, Convex handles schema
- `packages/backend/convex/r2.ts` - R2 client remains the same

**Note:** Per project-context.md, functions are organized by domain (one file per domain), not by entity. This is why `userSenderSettings` functions are in `senders.ts` and `newsletterContent` functions are in `newsletters.ts`.

### Testing Strategy

**Schema Tests:**
- Verify all tables exist after deployment
- Verify all indexes are created
- Verify new fields accept correct types

**Query Tests:**
- Test `userNewsletters` query returns correct user data
- Test privacy filtering works with new schema
- Test sender lookup by email works

**Mutation Tests:**
- Test creating newsletter with contentId reference
- Test creating newsletter with privateR2Key
- Test global sender creation/lookup

### Dependencies

This story has no new package dependencies. It uses existing Convex functionality.

### Environment Variables

No new environment variables needed. Existing R2 configuration from Story 2.2 is sufficient.

### Migration Strategy

**CLEAN SLATE (This Story):**
- DELETE old `newsletters` table completely
- REPLACE old `senders` table with global version
- CREATE new `newsletterContent`, `userNewsletters`, `userSenderSettings` tables
- UPDATE all function references to use new tables
- No data migration needed - fresh start

**R2 Cleanup:**
- Leave orphaned R2 objects - they don't affect functionality and have no cost impact
- No manual cleanup required

**Scope Boundary:**
- This story: Schema + basic CRUD functions only
- Story 2.5.2: Content normalization, hashing, and deduplication pipeline

**Default Privacy:**
- New user-sender relationships default to `isPrivate: false` (public)
- This enables community discovery features in Epic 6

### References

- [Source: architecture.md#Data Architecture] - Newsletter storage pattern
- [Source: architecture.md#Privacy Enforcement Pattern] - Mandatory query filtering
- [Source: epics.md#Epic 2.5] - Complete epic description and stories
- [Source: epics.md#Story 2.5.1] - Full acceptance criteria with schema definition
- [Source: project-context.md#Convex Patterns] - Naming and function organization
- [Source: 2-2-email-parsing-content-storage.md] - R2 storage implementation details

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Convex codegen successful after schema changes
- All 88 tests pass (44 newsletter tests, 20 emailIngestion tests, 14 email generation tests, 10 user tests)

### Completion Notes List

1. **Task 1 Complete**: Created new Convex schema with all five tables:
   - `newsletterContent` - shared public content with deduplication support
   - `userNewsletters` - per-user newsletter relationships
   - `senders` - global sender registry with subscriber/newsletter counts
   - `userSenderSettings` - per-user sender preferences (privacy per-user)
   - `folders` - folder structure for Epic 3

2. **Task 2 Complete**: All required indexes added inline with table definitions

3. **Task 3 Complete**: Rewrote all functions for new schema:
   - `newsletters.ts` - Updated to use `userNewsletters`, handle public/private content paths
   - `emailIngestion.ts` - Updated to use global senders and user sender settings

4. **Task 4 Complete**: Created helper functions in `senders.ts`:
   - `getOrCreateSender` - global sender management with counts
   - `getOrCreateUserSenderSettings` - per-user privacy preferences
   - `getUserSenderSettings` - query user's privacy setting for sender
   - `updateUserSenderSettings` - allow users to change privacy settings
   - Created `folders.ts` with basic CRUD for Epic 3

5. **Task 5 Complete**: Schema deployed and verified:
   - Convex codegen successful
   - All tests pass (88 tests)
   - Old `newsletters` table removed
   - New tables created with proper indexes

### File List

**Modified:**
- `packages/backend/convex/schema.ts` - Complete schema rewrite with 5 new tables
- `packages/backend/convex/newsletters.ts` - Rewritten for userNewsletters table
- `packages/backend/convex/emailIngestion.ts` - Updated for new schema flow
- `packages/backend/convex/newsletters.test.ts` - Updated contract tests for new API

**Created:**
- `packages/backend/convex/senders.ts` - Global sender management + user sender settings functions
- `packages/backend/convex/folders.ts` - Folder CRUD functions for Epic 3
- `packages/backend/convex/_internal/users.ts` - Internal user lookup queries (findByDedicatedEmail, findByAuthId)

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2026-01-24 | Story implementation complete - all 5 tasks done | Claude Opus 4.5 |
| 2026-01-24 | Code review fixes: Fixed stale data bug in getOrCreateSender, updated docs, clarified test purpose | Claude Opus 4.5 |
