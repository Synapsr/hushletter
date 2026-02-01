# Story 9.2: Private-by-Default

Status: done

## Story

As a **user receiving newsletters**,
I want **all my newsletters to be stored privately**,
So that **my content is never shared without explicit admin curation**.

## Acceptance Criteria

1. **Given** an email arrives at my dedicated address **When** the system stores it **Then** it uses `privateR2Key` (uploads to R2 with user-specific key) **And** `contentId` is null (no community reference) **And** `source` is set to "email"
2. **Given** I import via Gmail **When** newsletters are stored **Then** they use `privateR2Key` **And** `source` is "gmail"
3. **Given** I import via drag-drop or forward **When** newsletters are stored **Then** they use `privateR2Key` **And** `source` is "manual"
4. **Given** the old deduplication logic exists **When** reviewing the codebase **Then** automatic deduplication to `newsletterContent` is removed **And** `newsletterContent` is only created by admin action

## Dependencies

- **Story 9.1 (Schema Migration)** - Must be completed first
  - `userNewsletters.source` field must exist
  - `userNewsletters.folderId` field must exist

## Tasks / Subtasks

- [x] **Task 1: Refactor storeNewsletterContent Action** (AC: #1, #4)
  - [x] 1.1 Remove the PUBLIC PATH code block (lines ~205-301 in newsletters.ts)
  - [x] 1.2 Always use private R2 key pattern: `private/${userId}/${timestamp}-${randomId}.${ext}`
  - [x] 1.3 Remove `isPrivate` parameter - it's now always true conceptually
  - [x] 1.4 Add `source` parameter: `v.union(v.literal("email"), v.literal("gmail"), v.literal("manual"), v.literal("community"))`
  - [x] 1.5 Remove calls to `findByContentHash` and `incrementReaderCount` for deduplication
  - [x] 1.6 Remove call to `createNewsletterContent` for user ingestion
  - [x] 1.7 Keep duplicate detection logic (messageId and content hash for user's own newsletters)

- [x] **Task 2: Update createUserNewsletter Mutation** (AC: #1, #2, #3)
  - [x] 2.1 Add `source` parameter (required)
  - [x] 2.2 Add `folderId` parameter (required - from Story 9.1 schema)
  - [x] 2.3 Always set `isPrivate: true` for user-ingested content
  - [x] 2.4 Always set `contentId: undefined` for user-ingested content
  - [x] 2.5 Update return type documentation

- [x] **Task 3: Update Email Worker Ingestion** (AC: #1)
  - [x] 3.1 Update `emailIngestion` HTTP action to pass `source: "email"`
  - [x] 3.2 Update `emailIngestion` to resolve/create folder for sender
  - [x] 3.3 Remove `isPrivate` lookup from `userSenderSettings` (no longer needed for storage decision)
  - [x] 3.4 Update email worker's Convex client calls if needed

- [x] **Task 4: Update Gmail Import** (AC: #2)
  - [x] 4.1 Find Gmail import storage function (likely in `gmail.ts` or `gmailImport.ts`)
  - [x] 4.2 Update to pass `source: "gmail"` to storeNewsletterContent
  - [x] 4.3 Update to resolve/create folder for sender
  - [x] 4.4 Remove any public deduplication logic specific to Gmail import

- [x] **Task 5: Update Manual Import** (AC: #3)
  - [x] 5.1 Update `importHandler.ts` HTTP endpoint to pass `source: "manual"`
  - [x] 5.2 Update drag-and-drop import UI backend to pass `source: "manual"`
  - [x] 5.3 Update to resolve/create folder for sender

- [x] **Task 6: Clean Up Unused Code** (AC: #4)
  - [x] 6.1 Mark `findByContentHash` as deprecated or admin-only
  - [x] 6.2 Mark `incrementReaderCount` as deprecated or admin-only
  - [x] 6.3 Remove `normalizeForHash` usage from user ingestion paths (keep for admin curation later)
  - [x] 6.4 Update `createNewsletterContent` documentation - now admin-only
  - [x] 6.5 Keep `newsletterContent` table and related queries for admin curation (Story 9.7)

- [x] **Task 7: Write Tests** (AC: all)
  - [x] 7.1 Test email ingestion always stores with privateR2Key
  - [x] 7.2 Test email ingestion sets source to "email"
  - [x] 7.3 Test Gmail import stores with privateR2Key
  - [x] 7.4 Test Gmail import sets source to "gmail"
  - [x] 7.5 Test manual import stores with privateR2Key
  - [x] 7.6 Test manual import sets source to "manual"
  - [x] 7.7 Test no newsletterContent records created during user ingestion
  - [x] 7.8 Test duplicate detection still works (messageId and user-level content hash)

## Dev Notes

### Critical Context: Privacy-First Architecture

This is the core change that makes ALL user newsletters private by default. The key insight:

```
BEFORE (Current):
- isPrivate=false → Dedup to newsletterContent → Shared in community
- isPrivate=true → privateR2Key → User's own storage

AFTER (Epic 9):
- ALL user newsletters → privateR2Key → User's own storage
- newsletterContent → ONLY created by admin curation (Story 9.7)
- Community is 100% admin-curated, not user-contributed
```

### Current Code Analysis

**`storeNewsletterContent` in `packages/backend/convex/newsletters.ts`** has two paths:

```typescript
// CURRENT STRUCTURE (lines 48-304)
export const storeNewsletterContent = internalAction({
  args: {
    // ...
    isPrivate: v.boolean(), // THIS DRIVES THE PATH DECISION
  },
  handler: async (ctx, args) => {
    // Duplicate detection (KEEP THIS)

    if (args.isPrivate) {
      // ========================================
      // PRIVATE PATH - bypass deduplication
      // ========================================
      // This becomes the ONLY path
    } else {
      // ========================================
      // PUBLIC PATH - with deduplication  <-- REMOVE THIS ENTIRE BLOCK
      // ========================================
      // - normalizeForHash()
      // - computeContentHash()
      // - findByContentHash()
      // - createNewsletterContent()
      // - incrementReaderCount()
    }
  }
})
```

### Refactored Code Structure

```typescript
// NEW STRUCTURE
export const storeNewsletterContent = internalAction({
  args: {
    userId: v.id("users"),
    senderId: v.id("senders"),
    folderId: v.id("folders"), // NEW - required for folder-centric
    subject: v.string(),
    senderEmail: v.string(),
    senderName: v.optional(v.string()),
    receivedAt: v.number(),
    htmlContent: v.optional(v.string()),
    textContent: v.optional(v.string()),
    source: v.union(  // NEW - replaces isPrivate
      v.literal("email"),
      v.literal("gmail"),
      v.literal("manual"),
      v.literal("community")
    ),
    messageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // DUPLICATE DETECTION (kept - but only checks user's own newsletters)
    if (args.messageId) {
      const existing = await checkDuplicateByMessageId(...)
      if (existing) return { skipped: true, ... }
    }

    // Content hash duplicate check (user-level only)
    const contentHash = await computeContentHash(...)
    const existing = await checkUserDuplicateByHash(ctx, args.userId, contentHash)
    if (existing) return { skipped: true, ... }

    // ALWAYS PRIVATE PATH
    const r2Key = `private/${args.userId}/${Date.now()}-${randomUUID()}.${ext}`
    await r2.store(ctx, blob, { key: r2Key, type: contentType })

    const userNewsletterId = await ctx.runMutation(
      internal.newsletters.createUserNewsletter,
      {
        userId: args.userId,
        senderId: args.senderId,
        folderId: args.folderId,           // NEW
        subject: args.subject,
        senderEmail: args.senderEmail,
        senderName: args.senderName,
        receivedAt: args.receivedAt,
        isPrivate: true,                    // ALWAYS true now
        privateR2Key: r2Key,
        contentId: undefined,               // NEVER set for user ingestion
        source: args.source,                // NEW
        messageId: args.messageId,
      }
    )

    return { userNewsletterId, r2Key }
  }
})
```

### Files to Modify

| File | Changes |
|------|---------|
| `packages/backend/convex/newsletters.ts` | Refactor `storeNewsletterContent`, update `createUserNewsletter` |
| `packages/backend/convex/http.ts` | Update `emailIngestion` endpoint to pass `source: "email"` and `folderId` |
| `packages/backend/convex/gmail.ts` | Update Gmail import to pass `source: "gmail"` and `folderId` |
| `packages/backend/convex/manualImport.ts` | Update to pass `source: "manual"` and `folderId` |
| `apps/email-worker/src/importHandler.ts` | Update payload to include `source: "manual"` |

### Folder Resolution Pattern

Every ingestion path now needs to resolve a folder for the sender:

```typescript
// Helper function (add to senders.ts or folders.ts)
export const getOrCreateFolderForSender = internalMutation({
  args: {
    userId: v.id("users"),
    senderId: v.id("senders"),
  },
  handler: async (ctx, args) => {
    // Check if userSenderSettings exists with folderId
    const settings = await ctx.db
      .query("userSenderSettings")
      .withIndex("by_userId_senderId", q =>
        q.eq("userId", args.userId).eq("senderId", args.senderId)
      )
      .first()

    if (settings?.folderId) {
      return settings.folderId
    }

    // Create folder for this sender
    const sender = await ctx.db.get(args.senderId)
    const folderName = sender?.name || sender?.email || "Unknown Sender"

    const folderId = await ctx.db.insert("folders", {
      userId: args.userId,
      name: folderName,
      isHidden: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })

    // Update or create userSenderSettings
    if (settings) {
      await ctx.db.patch(settings._id, { folderId })
    } else {
      await ctx.db.insert("userSenderSettings", {
        userId: args.userId,
        senderId: args.senderId,
        isPrivate: true, // Default to private (though this field is now less relevant)
        folderId,
      })
    }

    return folderId
  }
})
```

### What NOT to Remove

Keep these for admin curation (Story 9.7):
- `newsletterContent` table
- `createNewsletterContent` mutation (mark as admin-only)
- `findByContentHash` query (mark as admin-only)
- `incrementReaderCount` mutation (mark as admin-only)
- Content normalization utilities (`normalizeForHash`, `computeContentHash`)

These will be used when admin publishes sanitized content to community.

### Backward Compatibility

- Existing `userNewsletters` with `contentId` set should continue to work (they reference existing community content)
- Reading content checks both `privateR2Key` and `contentId` - this logic stays the same
- Only NEW newsletters will always use `privateR2Key`

### Project Structure Notes

**Key locations:**
- Schema: `packages/backend/convex/schema.ts`
- Newsletter storage: `packages/backend/convex/newsletters.ts`
- HTTP endpoints: `packages/backend/convex/http.ts`
- Gmail import: `packages/backend/convex/gmail.ts`
- Email worker: `apps/email-worker/src/`

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-02-01.md] - Privacy-first architecture
- [Source: _bmad-output/planning-artifacts/epics.md#story-92-private-by-default] - Story acceptance criteria
- [Source: packages/backend/convex/newsletters.ts:48-304] - Current `storeNewsletterContent` implementation
- [Source: _bmad-output/project-context.md] - Convex patterns and naming conventions
- [Source: _bmad-output/implementation-artifacts/9-1-schema-migration.md] - Dependency: schema changes

### Critical Constraints

1. **Depends on Story 9.1** - Schema must be migrated first (source, folderId fields)
2. **Keep duplicate detection** - Users shouldn't get duplicate newsletters in their own account
3. **Keep content reading logic** - `getUserNewsletterWithContent` must still work for both old (contentId) and new (privateR2Key) records
4. **Don't delete newsletterContent** - Admin curation (Story 9.7) will use it
5. **R2 key pattern** - Must use user-specific path: `private/${userId}/...`

### Testing Approach

```typescript
// Test file: packages/backend/convex/newsletters.test.ts

describe("Private-by-Default (Story 9.2)", () => {
  describe("Email Ingestion", () => {
    it("stores newsletter with privateR2Key (no contentId)")
    it("sets source to 'email'")
    it("sets folderId from sender's folder")
    it("does NOT create newsletterContent record")
  })

  describe("Gmail Import", () => {
    it("stores newsletter with privateR2Key (no contentId)")
    it("sets source to 'gmail'")
    it("sets folderId from sender's folder")
  })

  describe("Manual Import", () => {
    it("stores newsletter with privateR2Key (no contentId)")
    it("sets source to 'manual'")
    it("sets folderId from sender's folder")
  })

  describe("Duplicate Detection", () => {
    it("detects duplicates by messageId for same user")
    it("detects duplicates by content hash for same user")
    it("allows same content for different users (no cross-user dedup)")
  })

  describe("Backward Compatibility", () => {
    it("reads content from existing contentId references")
    it("reads content from new privateR2Key references")
  })
})
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- TypeScript compilation: PASSED
- Convex codegen: PASSED
- All 854 tests pass (23 new tests added for Story 9.2)

### Completion Notes List

1. **Task 1 Complete**: Refactored `storeNewsletterContent` to always use private path
   - Removed PUBLIC PATH code block entirely
   - Added `source` and `folderId` parameters (required)
   - Removed `isPrivate` parameter (always private now)
   - User-level duplicate detection preserved (messageId + content hash)
   - Cross-user deduplication to newsletterContent removed

2. **Task 2 Complete**: Updated `createUserNewsletter` mutation
   - Added `source` parameter (required)
   - Added `folderId` parameter (required)
   - Now stores `source` and `folderId` on userNewsletters record

3. **Task 3 Complete**: Updated email ingestion
   - Now passes `source: "email"`
   - Calls `getOrCreateFolderForSender` to resolve folder
   - Removed `isPrivate` lookup from userSenderSettings

4. **Task 4 Complete**: Updated Gmail import
   - `processAndStoreImportedEmail` now passes `source: "gmail"`
   - Calls `getOrCreateFolderForSender` for folder resolution

5. **Task 5 Complete**: Updated manual import paths
   - `importIngestion.ts` (forward-to-import) passes `source: "manual"`
   - `manualImport.ts` (drag-drop) passes `source: "manual"`
   - Both call `getOrCreateFolderForSender` for folder resolution

6. **Task 6 Complete**: Marked admin-only functions
   - `createNewsletterContent`: Added @deprecated JSDoc, marked as admin-only
   - `findByContentHash`: Added @deprecated JSDoc, marked as admin-only
   - `incrementReaderCount`: Added @deprecated JSDoc, marked as admin-only
   - These functions preserved for Story 9.7 admin curation

7. **Task 7 Complete**: Added 23 new contract tests
   - Tests for storeNewsletterContent API changes
   - Tests for each ingestion path (email, gmail, manual)
   - Tests for deduplication behavior changes
   - Tests for backward compatibility

### File List

| File | Change Type |
|------|-------------|
| packages/backend/convex/newsletters.ts | Modified - Refactored storeNewsletterContent and createUserNewsletter |
| packages/backend/convex/senders.ts | Modified - Added getOrCreateFolderForSender mutation |
| packages/backend/convex/emailIngestion.ts | Modified - Updated for private-by-default |
| packages/backend/convex/gmail.ts | Modified - Updated processAndStoreImportedEmail |
| packages/backend/convex/importIngestion.ts | Modified - Updated receiveImportEmail |
| packages/backend/convex/manualImport.ts | Modified - Updated importEmlNewsletter |
| packages/backend/convex/newsletters.test.ts | Modified - Added 23 Story 9.2 tests |

### Change Log

**2026-02-01**: Implemented Story 9.2 Private-by-Default
- All user newsletters now stored with privateR2Key (no contentId)
- Added source tracking: "email", "gmail", "manual", "community"
- Added folderId requirement for folder-centric architecture
- Removed cross-user content deduplication (preserved user-level)
- Marked newsletterContent functions as admin-only for Story 9.7
- All 854 tests pass

**2026-02-01**: Code Review Fixes Applied (5 fixes)
- [HIGH] Added race condition protection to `getOrCreateFolderForSender` - mirrors `getOrCreateUserSenderSettings` pattern
- [HIGH] Fixed subscriber count increment to only occur when new relationship is created (not on race loss)
- [MEDIUM] Added comprehensive JSDoc documenting race condition handling behavior
- [MEDIUM] Updated comment for isPrivate field to reflect Story 9.2 private-by-default model
- [MEDIUM] Added 13 new tests for folder auto-creation and race condition handling
- All 867 tests pass
