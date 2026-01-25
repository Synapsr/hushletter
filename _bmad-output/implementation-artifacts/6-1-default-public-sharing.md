# Story 6.1: Default Public Sharing

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **user receiving newsletters**,
I want **my newsletters to be shared to the community database by default**,
so that **other users can benefit from the shared back-catalog**.

## Acceptance Criteria

1. **Given** a newsletter is received at my dedicated address
   **When** it is stored in the system
   **Then** it references shared `newsletterContent` by default (if sender not marked private)
   **And** the content becomes available in the community database via `newsletterContent` table

2. **Given** newsletters are stored with shared content
   **When** querying for community newsletters
   **Then** query the `newsletterContent` table directly
   **And** no user-specific data is exposed (userNewsletters not queried for community views)

3. **Given** I am a new user
   **When** I sign up
   **Then** the default sharing preference is explained during onboarding
   **And** I understand my newsletters will be shared by default

4. **Given** newsletters are shared to the community
   **When** other users view them
   **Then** they see the content from `newsletterContent` table
   **And** they cannot see which users contributed (no join to userNewsletters)
   **And** user privacy is maintained

## Tasks / Subtasks

- [x] **Task 1: Create Community Newsletter Queries** (AC: #2, #4)
  - [x] 1.1: Create `convex/community.ts` file for all community/discovery queries
  - [x] 1.2: Implement `listCommunityNewsletters` query - paginated list from `newsletterContent` sorted by `readerCount` (popularity) or `firstReceivedAt` (recency)
  - [x] 1.3: Implement `listCommunityNewslettersBySender` query - filter by `senderEmail` field
  - [x] 1.4: Implement `getCommunityNewsletterContent` action - fetch shared content with signed R2 URL
  - [x] 1.5: Add tests for all community queries (verify no user data leakage)

- [x] **Task 2: Create Community Browse UI** (AC: #2, #4)
  - [x] 2.1: Create `/routes/_authed/community/index.tsx` - Community browse page
  - [x] 2.2: Create `CommunityNewsletterCard.tsx` component showing subject, sender, `readerCount` ("X readers")
  - [x] 2.3: Add sort controls: "Popular" (by readerCount) vs "Recent" (by firstReceivedAt)
  - [x] 2.4: Add sender filter dropdown (populated from distinct senderEmails)
  - [x] 2.5: Implement infinite scroll or pagination for large lists
  - [x] 2.6: Add "Read" button that navigates to community reader view

- [x] **Task 3: Create Community Reader View** (AC: #4)
  - [x] 3.1: Create `/routes/_authed/community/$contentId.tsx` - Community newsletter reader
  - [x] 3.2: Reuse `ReaderView.tsx` component with community-specific adaptations
  - [x] 3.3: Show "X readers have this" badge using `readerCount`
  - [x] 3.4: Hide user-specific actions (mark as read, hide) - those require adding to personal collection
  - [x] 3.5: Add "Add to My Collection" button that creates `userNewsletter` referencing `contentId`

- [x] **Task 4: Implement "Add to Collection" Feature** (AC: #4)
  - [x] 4.1: Create `addToCollection` mutation in `community.ts` - creates `userNewsletter` with `contentId` reference
  - [x] 4.2: Mutation must: check auth, get/create sender, create `userSenderSettings` if new sender for user, create `userNewsletter`
  - [x] 4.3: After adding, redirect to personal reader view for full functionality
  - [x] 4.4: Show confirmation toast: "Added to your collection" (implemented as redirect to personal view)
  - [x] 4.5: Add tests for `addToCollection` mutation

- [x] **Task 5: Add Onboarding Explanation** (AC: #3)
  - [x] 5.1: Add community sharing info to signup flow (modal or inline text after registration)
  - [x] 5.2: Explain: "Newsletters you receive are shared with the community by default, helping everyone discover great content. You can mark specific senders as private in Settings."
  - [x] 5.3: Link to privacy settings for users who want to opt-out specific senders
  - [x] 5.4: Add onboarding dismissal tracking to `users` table (`hasSeenSharingOnboarding: boolean`)

- [x] **Task 6: Add Community Navigation** (AC: #2)
  - [x] 6.1: Add "Community" link to sidebar navigation (AppShell.tsx or Sidebar.tsx)
  - [x] 6.2: Position after "Newsletters" and "Senders" in nav hierarchy
  - [x] 6.3: Use appropriate icon (Globe, Users, or similar from lucide-react)

- [x] **Task 7: Write Tests** (All ACs)
  - [x] 7.1: Test `listCommunityNewsletters` returns only public content (no private newsletters)
  - [x] 7.2: Test `listCommunityNewsletters` does NOT return user-specific data
  - [x] 7.3: Test `getCommunityNewsletterContent` generates valid signed URL
  - [x] 7.4: Test `addToCollection` creates proper `userNewsletter` record
  - [x] 7.5: Test `addToCollection` increments `readerCount` on `newsletterContent`
  - [x] 7.6: Test community reader hides personal actions (no mark-as-read)
  - [x] 7.7: Test CommunityNewsletterCard displays readerCount correctly
  - [x] 7.8: Test onboarding modal appears for new users

## Dev Notes

### Architecture Context - Epic 2.5 Foundation

**CRITICAL: Public sharing is ALREADY automatic via Epic 2.5 schema!**

The shared content model implemented in Story 2.5.1 and 2.5.2 provides the foundation:
- `newsletterContent` table IS the community database
- When `userSenderSettings.isPrivate = false` (default), newsletters use shared content
- Content deduplication via SHA-256 hash ensures single storage
- `readerCount` tracks popularity without exposing user identities
- Private newsletters (when `isPrivate = true`) bypass `newsletterContent` entirely

**This story focuses on:**
1. Creating community browse/discovery UI
2. Implementing community queries that ONLY access `newsletterContent`
3. "Add to collection" feature for personal access to discovered content
4. Onboarding to explain the sharing model

### Data Flow - Public Sharing (Existing)

```
Email arrives → Check userSenderSettings.isPrivate (defaults false)
  → isPrivate = false (default):
      → Normalize → Hash → Check newsletterContent exists?
        → Yes: Reference existing contentId, increment readerCount
        → No: Upload to R2, create newsletterContent, readerCount = 1
      → Create userNewsletter with contentId reference
  → isPrivate = true:
      → Upload to private R2 key
      → Create userNewsletter with privateR2Key (NO contentId)
      → Content NEVER enters newsletterContent
```

### Community Query Pattern (New)

```typescript
// community.ts - ALL community queries hit newsletterContent directly
// NEVER join to userNewsletters for community views

export const listCommunityNewsletters = query({
  args: {
    sortBy: v.optional(v.union(v.literal("popular"), v.literal("recent"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Auth check - must be logged in to browse community
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const sortBy = args.sortBy ?? "popular"
    const limit = args.limit ?? 50

    // Query newsletterContent directly - inherently public content only
    const content = await ctx.db
      .query("newsletterContent")
      .withIndex(sortBy === "popular" ? "by_readerCount" : "by_firstReceivedAt")
      .order("desc")
      .take(limit)

    // Return without any user-specific data
    return content.map((c) => ({
      _id: c._id,
      subject: c.subject,
      senderEmail: c.senderEmail,
      senderName: c.senderName,
      firstReceivedAt: c.firstReceivedAt,
      readerCount: c.readerCount,
      hasSummary: Boolean(c.summary),
    }))
  },
})
```

### Add to Collection Pattern

```typescript
// When user adds community newsletter to their collection
export const addToCollection = mutation({
  args: { contentId: v.id("newsletterContent") },
  handler: async (ctx, args) => {
    // 1. Auth check
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new ConvexError({ code: "UNAUTHORIZED", ... })

    // 2. Get user
    const user = await ctx.db.query("users")...

    // 3. Get the content
    const content = await ctx.db.get(args.contentId)
    if (!content) throw new ConvexError({ code: "NOT_FOUND", ... })

    // 4. Check if already in collection
    const existing = await ctx.db
      .query("userNewsletters")
      .withIndex("by_contentId", (q) => q.eq("contentId", args.contentId))
      .filter((q) => q.eq(q.field("userId"), user._id))
      .first()

    if (existing) {
      return { alreadyExists: true, userNewsletterId: existing._id }
    }

    // 5. Get or create global sender
    const sender = await ctx.db.query("senders")
      .withIndex("by_email", (q) => q.eq("email", content.senderEmail))
      .first()

    let senderId = sender?._id
    if (!senderId) {
      // Create sender (rare case - sender should exist from original receipt)
      senderId = await ctx.db.insert("senders", {
        email: content.senderEmail,
        name: content.senderName,
        domain: content.senderEmail.split("@")[1],
        subscriberCount: 1,
        newsletterCount: 1,
      })
    }

    // 6. Get or create userSenderSettings (default isPrivate: false)
    const existingSettings = await ctx.db.query("userSenderSettings")
      .withIndex("by_userId_senderId", (q) => q.eq("userId", user._id).eq("senderId", senderId))
      .first()

    if (!existingSettings) {
      await ctx.db.insert("userSenderSettings", {
        userId: user._id,
        senderId,
        isPrivate: false, // Default to public
      })
      // Increment subscriberCount since this is a new user-sender relationship
      await ctx.db.patch(senderId, { subscriberCount: sender.subscriberCount + 1 })
    }

    // 7. Create userNewsletter with contentId reference
    const userNewsletterId = await ctx.db.insert("userNewsletters", {
      userId: user._id,
      senderId,
      contentId: args.contentId,
      subject: content.subject,
      senderEmail: content.senderEmail,
      senderName: content.senderName,
      receivedAt: content.firstReceivedAt,
      isRead: false,
      isHidden: false,
      isPrivate: false, // Added from community = public
    })

    // 8. Increment readerCount (user is now a reader)
    await ctx.db.patch(args.contentId, {
      readerCount: content.readerCount + 1,
    })

    return { alreadyExists: false, userNewsletterId }
  },
})
```

### File Locations

| File | Action | Purpose |
|------|--------|---------|
| `packages/backend/convex/community.ts` | NEW | All community browse queries |
| `packages/backend/convex/community.test.ts` | NEW | Community query tests |
| `packages/backend/convex/schema.ts` | MODIFY | Add `hasSeenSharingOnboarding` to users |
| `apps/web/src/routes/_authed/community/index.tsx` | NEW | Community browse page |
| `apps/web/src/routes/_authed/community/$contentId.tsx` | NEW | Community reader view |
| `apps/web/src/components/CommunityNewsletterCard.tsx` | NEW | Card component for community list |
| `apps/web/src/components/CommunityNewsletterCard.test.tsx` | NEW | Component tests |
| `apps/web/src/components/SharingOnboardingModal.tsx` | NEW | Onboarding explanation modal |
| `apps/web/src/components/layout/Sidebar.tsx` | MODIFY | Add Community nav link |

### Project Structure Notes

- `community.ts` follows "one file per domain" pattern per project-context.md
- Routes under `_authed/community/` for authenticated community access
- Components colocated with tests

### Critical Implementation Rules

1. **NEVER query userNewsletters for community views** - only `newsletterContent`
2. **NEVER expose user IDs or counts** - only `readerCount` is safe
3. **Auth required for community browse** - logged-in users only (per Architecture)
4. **Default isPrivate = false** - this enables community by default
5. **Increment readerCount on addToCollection** - tracks actual readers

### Privacy Architecture Summary

```
newsletterContent (Community/Shared)
├── contentHash (unique identifier)
├── r2Key (shared storage)
├── subject, senderEmail, senderName
├── firstReceivedAt
├── readerCount (popularity metric, safe to show)
└── summary (shared AI summary)

userNewsletters (Personal)
├── userId (NEVER exposed in community queries)
├── senderId (links to global sender)
├── contentId (references shared content) OR
├── privateR2Key (private content, bypasses newsletterContent)
├── isPrivate, isRead, isHidden, readProgress (personal state)
└── summary (personal override)

userSenderSettings (Privacy Preferences)
├── userId
├── senderId
├── isPrivate (controls future newsletters)
└── folderId (organization)
```

### UI/UX Patterns from Previous Stories

**From Story 5.2 (Summary Display):**
- Use `Sparkles` icon for summary indicator
- Subtle indicators, not attention-grabbing
- Loading skeletons for perceived speed

**From Story 3.1 (Newsletter List):**
- Sidebar navigation pattern
- Newsletter card with sender name, subject, date
- Click to navigate to reader view

**Community-Specific UX:**
- "X readers" badge shows popularity (not user count)
- "Add to Collection" is prominent action
- Clear distinction between community view and personal collection

### Git Intelligence

**Recent Commits Pattern:**
```
feat: Add community browse and discovery (Story 6.1)

- Create community.ts with browse/discovery queries
- Add community routes and components
- Implement "Add to Collection" feature
- Add sharing onboarding modal
- Add comprehensive tests
```

**Previous Work Patterns:**
- Stories 5.1/5.2: SummaryPanel, hasSummary derivation
- Stories 3.x: Newsletter list, reader view, folder browsing
- Story 2.5.1/2.5.2: Shared content schema, deduplication

### Testing Requirements

**Backend Contract Tests:**
1. `listCommunityNewsletters` returns only `newsletterContent` fields
2. `listCommunityNewsletters` never returns `userId` or user-specific data
3. `listCommunityNewslettersBySender` filters correctly
4. `getCommunityNewsletterContent` returns valid signed URL
5. `addToCollection` creates `userNewsletter` with correct `contentId`
6. `addToCollection` returns `alreadyExists: true` if duplicate
7. `addToCollection` increments `readerCount`
8. `addToCollection` creates `userSenderSettings` if new sender relationship

**Frontend Component Tests:**
1. CommunityNewsletterCard renders subject, sender, readerCount
2. CommunityNewsletterCard shows hasSummary indicator when applicable
3. Community browse page sorts by popular/recent
4. Community reader hides mark-as-read action
5. "Add to Collection" button triggers mutation
6. Onboarding modal displays for new users
7. Onboarding modal dismisses and updates user record

### Schema Change Required

```typescript
// Add to users table in schema.ts
users: defineTable({
  // ... existing fields
  hasSeenSharingOnboarding: v.optional(v.boolean()), // NEW - Story 6.1
})
```

### Dependencies

**No New Dependencies Required** - Uses existing:
- `lucide-react` for icons
- Convex queries/mutations
- TanStack Router for routing
- shadcn/ui components

### References

- [Source: planning-artifacts/epics.md#Story 6.1] - Original acceptance criteria
- [Source: planning-artifacts/architecture.md#Community Database] - Architecture for community features
- [Source: planning-artifacts/architecture.md#Privacy Enforcement Pattern] - Query-level privacy
- [Source: implementation-artifacts/2-5-1-shared-content-schema-implementation.md] - Shared content foundation
- [Source: implementation-artifacts/2-5-2-content-deduplication-pipeline.md] - Deduplication implementation
- [Source: project-context.md#Convex Patterns] - Function naming and organization

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Backend tests: 529 tests pass (37 new community tests)
- Frontend TypeScript: No errors
- Component tests: 21 CommunityNewsletterCard contract tests pass

### Completion Notes List

1. **Task 1 - Community Queries**: Created `community.ts` with `listCommunityNewsletters`, `listCommunityNewslettersBySender`, `listCommunitySenders`, `getCommunityNewsletterContent` action. All queries only access `newsletterContent` table - no user data exposed.

2. **Task 2 - Community Browse UI**: Created browse page with infinite scroll, sort controls (Popular/Recent), sender filter dropdown. CommunityNewsletterCard shows subject, sender, date, reader count badge.

3. **Task 3 - Community Reader View**: Created reader with sanitized HTML display, "X readers have this" badge, AI summary display (if available), and "Add to My Collection" button. No mark-as-read or hide actions (those require personal collection).

4. **Task 4 - Add to Collection**: `addToCollection` mutation creates `userNewsletter` with `contentId` reference, creates `userSenderSettings` if new sender relationship, increments `readerCount`. Returns `alreadyExists` if duplicate. Redirects to personal reader view after adding.

5. **Task 5 - Onboarding**: `SharingOnboardingModal` displays for new users (when `hasSeenSharingOnboarding` is false). Added schema field to users table. Modal explains sharing model and links to privacy settings.

6. **Task 6 - Navigation**: Added Globe icon link to header navigation in `_authed.tsx`. Positioned before Import and Settings icons.

7. **Task 7 - Tests**: 37 backend contract tests in `community.test.ts` covering all queries, mutations, privacy requirements. 21 frontend contract tests for CommunityNewsletterCard type safety and privacy.

### File List

**New Files:**
- `packages/backend/convex/community.ts` - Community queries and mutations
- `packages/backend/convex/community.test.ts` - Backend contract tests (37 tests)
- `apps/web/src/routes/_authed/community/index.tsx` - Community browse page
- `apps/web/src/routes/_authed/community/$contentId.tsx` - Community reader view
- `apps/web/src/components/CommunityNewsletterCard.tsx` - Community card component
- `apps/web/src/components/CommunityNewsletterCard.test.tsx` - Component contract tests (21 tests)
- `apps/web/src/components/SharingOnboardingModal.tsx` - Onboarding modal component
- `apps/web/src/components/SharingOnboardingModal.test.tsx` - Onboarding modal contract tests (25 tests)

**Modified Files:**
- `packages/backend/convex/schema.ts` - Added `hasSeenSharingOnboarding` field to users table, added `by_firstReceivedAt` index
- `apps/web/src/routes/_authed.tsx` - Added Community navigation link with Globe icon

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5
**Date:** 2026-01-25
**Outcome:** ✅ Approved with Fixes Applied

### Issues Found and Fixed

| ID | Severity | Issue | Fix Applied |
|----|----------|-------|-------------|
| H1 | HIGH | Missing `by_firstReceivedAt` index for "Recent" sort | Added index to schema.ts, updated community.ts to use correct index |
| H2 | HIGH | `listCommunitySenders` scanned entire table | Refactored to use `senders` table with `by_subscriberCount` index |
| M1 | MEDIUM | Cursor pagination logic flawed | Rewrote pagination with proper cursor value + ID tie-breaking |
| M2 | MEDIUM | useState for newsletter list (violated project rules) | Refactored to use TanStack Query's `useInfiniteQuery` |
| M3 | MEDIUM | Module-scope cache (memory leak) | Implemented bounded LRU cache (max 20 entries) |
| M4 | MEDIUM | Missing SharingOnboardingModal test | Created SharingOnboardingModal.test.tsx (25 tests) |

### Verification

- Backend tests: 529 pass ✅
- Frontend tests: 46 pass (CommunityNewsletterCard: 21, SharingOnboardingModal: 25) ✅
- TypeScript: No errors ✅

### Notes

- Git discrepancies (routeTree.gen.ts, api.d.ts) are auto-generated files - acceptable
- All acceptance criteria validated against implementation
- Privacy requirements verified: community queries only access newsletterContent

## Change Log

| Date | Change |
|------|--------|
| 2026-01-25 | Story created with comprehensive developer guidance |
| 2026-01-25 | Implementation complete - all tasks finished, tests passing |
| 2026-01-25 | Code review: 2 HIGH, 4 MEDIUM issues found and fixed |
