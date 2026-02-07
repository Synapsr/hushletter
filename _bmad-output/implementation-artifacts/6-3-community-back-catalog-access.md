# Story 6.3: Community Back-Catalog Access

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **user exploring newsletters**,
I want **to access the back-catalog of newsletters from the community database**,
so that **I can read newsletters I missed or discover new content**.

## Acceptance Criteria

1. **Given** I am logged in
   **When** I navigate to the Community or Explore section
   **Then** I see a browsable list from `newsletterContent` table
   **And** newsletters are organized by sender (via `senderEmail`) or sorted by `readerCount`

2. **Given** I am browsing the community back-catalog
   **When** I search or filter
   **Then** I can find newsletters by sender name, subject
   **And** results load quickly (NFR1) - direct query on `newsletterContent`

3. **Given** I find an interesting newsletter in the community
   **When** I click on it
   **Then** I can read the full content (signed URL from `newsletterContent.r2Key`)
   **And** the experience is the same as reading my own newsletters

4. **Given** I am viewing a community newsletter
   **When** I want to save it
   **Then** I can add it to my personal collection
   **And** a `userNewsletter` record is created referencing the `contentId`
   **And** it appears in my newsletter list

5. **Given** privacy is enforced by architecture
   **When** querying the community database
   **Then** only `newsletterContent` is queried (inherently public)
   **And** private newsletters never enter `newsletterContent` (Epic 2.5 design)

## Tasks / Subtasks

- [x] **Task 1: Add Search Functionality to Community Browse** (AC: #1, #2)
  - [x] 1.1: Add search input to community page header (`/routes/_authed/community/index.tsx`)
  - [x] 1.2: Create `searchCommunityNewsletters` query in `community.ts` - searches `subject` and `senderName` fields
  - [x] 1.3: Implement debounced search (use `useDeferredValue` per Story 6.2 pattern)
  - [x] 1.4: Display search results using existing `CommunityNewsletterCard` component
  - [x] 1.5: Add "No results found" empty state for search queries

- [x] **Task 2: Enhance Sender Organization** (AC: #1)
  - [x] 2.1: Add "Browse by Sender" section/tab to community page
  - [x] 2.2: Create `listTopCommunitySenders` query - returns senders with highest `subscriberCount`
  - [x] 2.3: Create sender detail view: `/routes/_authed/community/sender/$senderEmail.tsx`
  - [x] 2.4: Sender view shows: sender name, subscriber count, all newsletters from that sender
  - [x] 2.5: Add "X users subscribe" badge using `senders.subscriberCount`

- [x] **Task 3: Verify Reading Experience Parity** (AC: #3)
  - [x] 3.1: Verify community reader uses `getCommunityNewsletterContent` action for R2 signed URL
  - [x] 3.2: Verify `ReaderView` component is reused (sanitized HTML, typography, responsive)
  - [x] 3.3: Verify AI summary is displayed if `newsletterContent.summary` exists
  - [x] 3.4: Test reading experience matches personal newsletter reading

- [x] **Task 4: Verify Add to Collection Flow** (AC: #4)
  - [x] 4.1: Verify "Add to My Collection" button on community reader calls `addToCollection` mutation
  - [x] 4.2: Verify redirect to personal reader view after adding (Story 6.1 implementation)
  - [x] 4.3: Verify newsletter appears in personal list after adding
  - [x] 4.4: Verify `readerCount` increments correctly

- [x] **Task 5: Verify Privacy Enforcement** (AC: #5)
  - [x] 5.1: Verify all community queries ONLY access `newsletterContent` table
  - [x] 5.2: Verify no user-specific data exposed (no `userId`, no `userNewsletters` joins)
  - [x] 5.3: Add contract test: community search cannot return private content
  - [x] 5.4: Verify `isPrivate` newsletters never appear in search results

- [x] **Task 6: Write Comprehensive Tests** (All ACs)
  - [x] 6.1: Test `searchCommunityNewsletters` returns matching content by subject
  - [x] 6.2: Test `searchCommunityNewsletters` returns matching content by senderName
  - [x] 6.3: Test search debouncing with `useDeferredValue`
  - [x] 6.4: Test sender detail view displays correct newsletters
  - [x] 6.5: Test subscriber count badge displays correctly
  - [x] 6.6: Test empty state displays for no search results
  - [x] 6.7: Test privacy: search results never include private content
  - [x] 6.8: Test navigation from community browse to sender detail view

## Dev Notes

### Architecture Context - Epic 2.5 + Story 6.1 Foundation

**CRITICAL: Most community infrastructure is ALREADY complete from Story 6.1!**

Story 6.1 (Default Public Sharing) implemented:
- `community.ts` with browse queries (`listCommunityNewsletters`, `listCommunitySenders`)
- `getCommunityNewsletterContent` action for R2 signed URLs
- `addToCollection` mutation for personal collection
- Community browse page with infinite scroll, sort controls, sender filter
- Community reader view with "Add to Collection" button
- `CommunityNewsletterCard` component
- `SharingOnboardingModal` component

**This story focuses on:**
1. **Search functionality** - Find newsletters by subject/sender name
2. **Enhanced sender organization** - Browse by sender, sender detail view
3. **Verification** - Ensure all AC requirements are met by existing implementation

### Existing Backend Infrastructure (From Story 6.1)

```typescript
// community.ts - ALREADY EXISTS
export const listCommunityNewsletters = query({...})     // Paginated browse
export const listCommunityNewslettersBySender = query({...}) // Filter by sender
export const listCommunitySenders = query({...})         // Top senders for dropdown
export const getCommunityNewsletterContent = action({...}) // Signed R2 URL
export const addToCollection = mutation({...})           // Add to personal collection
export const hasSeenSharingOnboarding = query({...})     // Onboarding check
export const dismissSharingOnboarding = mutation({...})  // Onboarding dismiss
```

### New Search Query (Task 1.2)

```typescript
// community.ts - NEW
export const searchCommunityNewsletters = query({
  args: {
    searchQuery: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Auth check
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const limit = Math.min(args.limit ?? 20, 100)
    const searchLower = args.searchQuery.toLowerCase()

    // Fetch and filter in-memory (Convex doesn't have full-text search)
    // For MVP this is acceptable; consider external search (Algolia) for scale
    const allContent = await ctx.db
      .query("newsletterContent")
      .withIndex("by_readerCount")
      .order("desc")
      .take(500) // Reasonable limit for in-memory search

    const matches = allContent
      .filter((c) =>
        c.subject.toLowerCase().includes(searchLower) ||
        (c.senderName?.toLowerCase().includes(searchLower) ?? false) ||
        c.senderEmail.toLowerCase().includes(searchLower)
      )
      .slice(0, limit)

    // Return ONLY public fields
    return matches.map((c) => ({
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

### Sender Detail View Route (Task 2.3)

```typescript
// /routes/_authed/community/sender/$senderEmail.tsx - NEW
import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@newsletter-manager/backend"
import { CommunityNewsletterCard } from "@/components/CommunityNewsletterCard"

export const Route = createFileRoute("/_authed/community/sender/$senderEmail")({
  component: SenderDetailPage,
})

function SenderDetailPage() {
  const { senderEmail } = Route.useParams()

  // Get sender info from global senders table
  const { data: sender } = useQuery(
    convexQuery(api.senders.getSenderByEmail, { email: senderEmail })
  )

  // Get newsletters from this sender
  const { data: newslettersData } = useQuery(
    convexQuery(api.community.listCommunityNewslettersBySender, {
      senderEmail,
      sortBy: "recent",
      limit: 50,
    })
  )

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      {/* Sender header with subscriberCount badge */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{sender?.name || senderEmail}</h1>
        <div className="flex items-center gap-2 mt-2 text-muted-foreground">
          <span>{sender?.subscriberCount ?? 0} subscribers</span>
          <span>•</span>
          <span>{newslettersData?.items.length ?? 0} newsletters</span>
        </div>
      </div>

      {/* Newsletter list */}
      <div className="space-y-3">
        {newslettersData?.items.map((newsletter) => (
          <CommunityNewsletterCard key={newsletter._id} newsletter={newsletter} />
        ))}
      </div>
    </div>
  )
}
```

### File Locations

| File | Action | Purpose |
|------|--------|---------|
| `packages/backend/convex/community.ts` | MODIFY | Add `searchCommunityNewsletters` query |
| `packages/backend/convex/community.test.ts` | MODIFY | Add search tests, privacy tests |
| `packages/backend/convex/senders.ts` | MODIFY | Add `getSenderByEmail` query if missing |
| `apps/web/src/routes/_authed/community/index.tsx` | MODIFY | Add search input with debouncing |
| `apps/web/src/routes/_authed/community/sender/$senderEmail.tsx` | NEW | Sender detail view |
| `apps/web/src/routes/_authed/community/sender/$senderEmail.test.tsx` | NEW | Sender view tests |

### Project Structure Notes

- Routes follow `_authed/community/` pattern (auth required)
- Components colocated with tests (per project-context.md)
- Domain queries grouped in `community.ts` (one file per domain)
- Use `useDeferredValue` for search debouncing (per Story 6.2 pattern)

### Critical Implementation Rules

1. **NEVER query `userNewsletters` for community views** - only `newsletterContent`
2. **NEVER expose `userId`** - only `readerCount` and `subscriberCount` are safe
3. **Search is in-memory for MVP** - Convex lacks full-text search, 500-item scan acceptable
4. **Use existing components** - `CommunityNewsletterCard`, `ReaderView` are reusable
5. **Use `useDeferredValue`** for search debouncing (project pattern from 6.2)
6. **Auth required** for all community endpoints (logged-in users only)

### UI/UX Requirements (From ux-design-specification.md)

**Community Discovery:**
- "X readers" badge shows popularity (not user count)
- "X subscribers" badge on sender pages
- Clear visual distinction between community and personal views
- No pressure patterns - discovery should feel exploratory, not obligatory

**Search Experience:**
- Debounced search input (300ms via `useDeferredValue`)
- "No results" empty state is friendly, not alarming
- Search across subject AND sender name/email
- Results sorted by popularity (`readerCount`) by default

**Navigation Patterns:**
- Community → Sender detail → Newsletter reader → Back to sender
- Breadcrumb or back link for navigation context
- Smooth transitions (per UX spec animation principles)

### Previous Story Intelligence (Story 6.2)

**Patterns to reuse:**
- `useDeferredValue` for search debouncing (Task 1.3)
- Contract tests that verify no user data leakage (Task 5)
- Indeterminate checkbox support if multi-select needed
- Error feedback with AlertCircle icon pattern

**From code review fixes:**
- Tests should mirror actual component logic, not re-implement
- Use `useInfiniteQuery` for paginated lists (not useState)
- Bounded LRU cache if caching needed

### Git Intelligence (Recent Commits)

```
ba9ef3d feat: Add privacy controls for senders with code review fixes (Story 6.2)
92db5c6 feat: Add community browse and discovery with code review fixes (Story 6.1)
```

**Pattern from Story 6.1:**
- Community queries return ONLY `newsletterContent` fields
- `addToCollection` creates `userNewsletter` + increments `readerCount`
- `SharingOnboardingModal` shows once per user
- Globe icon in header for community navigation

### Testing Requirements

**Backend Contract Tests (community.test.ts):**
1. `searchCommunityNewsletters` returns matching content by subject
2. `searchCommunityNewsletters` returns matching content by senderName
3. `searchCommunityNewsletters` returns empty array for no matches
4. `searchCommunityNewsletters` NEVER returns private content
5. `searchCommunityNewsletters` NEVER returns userId or user-specific data
6. Search results are limited to specified limit
7. Search is case-insensitive

**Frontend Component Tests:**
1. Search input renders with debouncing
2. Search results display using CommunityNewsletterCard
3. Empty state displays for no results
4. Sender detail page displays sender info with subscriber count
5. Sender detail page lists newsletters from that sender
6. Navigation from sender card to sender detail works
7. Back navigation preserves search context

### Schema Reference (No Changes Needed)

```typescript
// newsletterContent - Community database (public content only)
newsletterContent: defineTable({
  contentHash: v.string(),
  r2Key: v.string(),
  subject: v.string(),              // ← Searchable
  senderEmail: v.string(),          // ← Searchable
  senderName: v.optional(v.string()), // ← Searchable
  firstReceivedAt: v.number(),
  readerCount: v.number(),
  summary: v.optional(v.string()),
  summaryGeneratedAt: v.optional(v.number()),
})
  .index("by_contentHash", ["contentHash"])
  .index("by_senderEmail", ["senderEmail"])
  .index("by_readerCount", ["readerCount"])
  .index("by_firstReceivedAt", ["firstReceivedAt"]),

// senders - Global sender registry
senders: defineTable({
  email: v.string(),
  name: v.optional(v.string()),
  domain: v.string(),
  subscriberCount: v.number(),      // ← "X users subscribe"
  newsletterCount: v.number(),
})
  .index("by_email", ["email"])
  .index("by_domain", ["domain"])
  .index("by_subscriberCount", ["subscriberCount"]),
```

### Dependencies

**No New Dependencies Required** - Uses existing:
- `lucide-react` for icons (Search icon)
- `@tanstack/react-query` for data fetching
- `@convex-dev/react-query` for Convex integration
- shadcn/ui components (Input, Card, etc.)
- TanStack Router for routing

### References

- [Source: planning-artifacts/epics.md#Story 6.3] - Original acceptance criteria
- [Source: planning-artifacts/architecture.md#Community Database] - Architecture for community features
- [Source: planning-artifacts/architecture.md#Privacy Enforcement Pattern] - Query-level privacy
- [Source: implementation-artifacts/6-1-default-public-sharing.md] - Community browse foundation
- [Source: implementation-artifacts/6-2-privacy-controls-for-senders.md] - Privacy toggle patterns
- [Source: project-context.md#Convex Patterns] - Function naming and organization
- [Source: planning-artifacts/ux-design-specification.md] - UX requirements for community discovery

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - Implementation proceeded without debug issues.

### Completion Notes List

1. **Task 1 (Search Functionality):** Added `searchCommunityNewsletters` query to `community.ts` with in-memory search across subject, senderName, and senderEmail fields. Search results sorted by popularity (readerCount). Added search UI with `useDeferredValue` for debouncing per Story 6.2 pattern.

2. **Task 2 (Sender Organization):** Added `listTopCommunitySenders` query for "Browse by Sender" tab. Created sender detail route at `/community/sender/$senderEmail.tsx`. Added tab navigation between newsletters and senders views. Added `getSenderByEmailPublic` query to senders.ts.

3. **Tasks 3-5 (Verification):** Confirmed existing Story 6.1 implementation satisfies all verification requirements:
   - Community reader uses `getCommunityNewsletterContent` action for R2 signed URLs
   - HTML is sanitized with DOMPurify, uses prose styling
   - AI summary displayed when available
   - `addToCollection` redirects to personal reader after success
   - All community queries only access `newsletterContent` table (no user data exposure)

4. **Task 6 (Tests):** Added comprehensive tests:
   - Backend `community.test.ts`: 63 total tests (includes Story 6.1 + 6.3 search/sender tests)
   - Frontend community tests: 42 tests for browse and sender detail pages

### File List

**New Files:**
- `apps/web/src/routes/_authed/community/sender/$senderEmail.tsx` - Sender detail page
- `apps/web/src/routes/_authed/community/sender/$senderEmail.test.tsx` - Sender detail tests
- `apps/web/src/routes/_authed/community/index.test.tsx` - Community browse tests

**Modified Files:**
- `packages/backend/convex/community.ts` - Added `searchCommunityNewsletters`, `listTopCommunitySenders`
- `packages/backend/convex/community.test.ts` - Added search and sender query tests
- `packages/backend/convex/senders.ts` - Added `getSenderByEmailPublic` query
- `apps/web/src/routes/_authed/community/index.tsx` - Added search UI, tabs, Browse by Sender
- `apps/web/src/routeTree.gen.ts` - Auto-generated route tree update
- `_bmad-output/planning-artifacts/ux-design-specification.md` - Updated community UX patterns
- `_bmad-output/implementation-artifacts/sprint-status.yaml` - Updated story status

## Change Log

| Date | Change |
|------|--------|
| 2026-01-25 | Story created with comprehensive developer guidance |
| 2026-01-25 | Implemented search functionality with debouncing (Task 1) |
| 2026-01-25 | Added Browse by Sender tab and sender detail view (Task 2) |
| 2026-01-25 | Verified reading experience, collection flow, and privacy enforcement (Tasks 3-5) |
| 2026-01-25 | Added comprehensive tests (Task 6) |
| 2026-01-25 | **Code Review Fixes:** Fixed pagination logic in listCommunityNewslettersBySender, added infinite scroll to sender detail page, added error handling to community components, added search results limit warning, improved tab accessibility with ARIA attributes |
