# Story 9.8: Community Browse

Status: done

## Story

As a **user exploring newsletters**,
I want **to browse the admin-curated community database**,
So that **I can discover new content**.

## Acceptance Criteria

1. **Given** I am logged in **When** I navigate to Community/Discover **Then** I see newsletters from `newsletterContent` (admin-approved only)
2. **Given** I am browsing community **When** viewing the list **Then** I can filter by sender
3. **Given** I am browsing community **When** viewing the list **Then** I can sort by date or popularity (importCount)
4. **Given** I am browsing community **When** viewing a sender **Then** I see how many community newsletters are available
5. **Given** I am browsing community **When** viewing a sender **Then** I see which ones I already have (private or imported)
6. **Given** I am browsing community **When** clicking on a newsletter **Then** I can preview newsletter content before importing

## Dependencies

- **Story 9.7 (Admin Publish Flow)** - REQUIRED
  - `publishToCommunity` action creates `newsletterContent` records with `communityApprovedAt`
  - Only admin-approved content appears in community browse
  - `newsletterContent.importCount` field exists

- **Story 9.1 (Schema Migration)** - COMPLETE
  - `newsletterContent.communityApprovedAt`, `communityApprovedBy`, `importCount` fields exist
  - `userNewsletters.source` field with "community" literal for tracking imports

- **Existing Epic 6 Community Infrastructure** - LEVERAGE
  - `listCommunityNewsletters` query exists (needs filtering update)
  - `getCommunityNewsletterContent` action exists
  - `CommunityNewsletterCard` component exists
  - Community browse page exists at `/_authed/community/`

## Tasks / Subtasks

- [x] **Task 1: Update Community Queries to Filter by Admin-Approved Content** (AC: #1)
  - [x] 1.1 Update `listCommunityNewsletters` to only return content where `communityApprovedAt` is set
  - [x] 1.2 Update `listCommunityNewslettersBySender` to only return admin-approved content
  - [x] 1.3 Update `searchCommunityNewsletters` to only search admin-approved content
  - [x] 1.4 Update `listCommunitySenders` to only show senders with approved content
  - [x] 1.5 Update `listTopCommunitySenders` to only count approved content

- [x] **Task 2: Add Import Count Sorting Option** (AC: #3)
  - [x] 2.1 Add `importCount` index to `newsletterContent` in schema
  - [x] 2.2 Update `listCommunityNewsletters` to support `sortBy: "imports"` option
  - [x] 2.3 Update UI to show "Most Imported" sort option alongside "Popular" and "Recent"

- [x] **Task 3: Show User's Existing Newsletters Indicator** (AC: #5)
  - [x] 3.1 Create `checkUserHasNewsletters` query that takes array of contentIds
  - [x] 3.2 Returns map of contentId → { hasPrivate: boolean, hasImported: boolean }
  - [x] 3.3 Update `CommunityNewsletterCard` to show "Already in your collection" badge
  - [x] 3.4 Use different badges for private vs community-imported

- [x] **Task 4: Enhance Sender View with Newsletter Counts** (AC: #4)
  - [x] 4.1 Update sender page to show "X newsletters available" count
  - [x] 4.2 Show "Y already in your collection" count
  - [x] 4.3 Update `listCommunityNewslettersBySender` to return total count

- [x] **Task 5: Newsletter Preview Before Import** (AC: #6)
  - [x] 5.1 Add preview modal to `CommunityNewsletterCard` (click to preview)
  - [x] 5.2 Fetch and display content using `getCommunityNewsletterContent`
  - [x] 5.3 Show import button in preview modal
  - [x] 5.4 Show summary if available

- [x] **Task 6: Update Community Browse UI** (AC: #1, #2, #3)
  - [x] 6.1 Update sort options to include "Most Imported" (importCount)
  - [x] 6.2 Show import count on newsletter cards
  - [x] 6.3 Add empty state for when no admin-approved content exists yet
  - [x] 6.4 Update page description to reflect admin-curated nature

- [x] **Task 7: Write Tests** (AC: all)
  - [x] 7.1 Test `listCommunityNewsletters` only returns admin-approved content
  - [x] 7.2 Test sorting by importCount works correctly
  - [x] 7.3 Test `checkUserHasNewsletters` returns correct flags
  - [x] 7.4 Test sender view shows correct counts
  - [x] 7.5 Test preview modal renders and loads content
  - [x] 7.6 Test "Already in collection" badge displays correctly
  - [x] 7.7 Test empty state when no approved content

## Dev Notes

### Critical Context: Epic 9 Privacy-First Community Model

This story adapts the existing Epic 6 community browse infrastructure to work with the **privacy-first model** introduced in Epic 9:

**Old Model (Epic 6):**
- Newsletters automatically deduplicated to `newsletterContent`
- All public content immediately visible in community

**New Model (Epic 9):**
- All user newsletters are private by default
- Only admin-approved content appears in community
- `newsletterContent.communityApprovedAt` must be set for visibility
- Content is COPIED by admin (not referenced) via Story 9.7

### Key Technical Changes

**Query Filtering Update:**

All community queries must now filter for admin-approved content:

```typescript
// BEFORE (Epic 6 - all content visible):
const content = await ctx.db
  .query("newsletterContent")
  .withIndex("by_readerCount")
  .order("desc")
  .take(1000)

// AFTER (Epic 9 - only admin-approved):
let content = await ctx.db
  .query("newsletterContent")
  .withIndex("by_readerCount")
  .order("desc")
  .take(1000)

// Filter for admin-approved only
content = content.filter(c => c.communityApprovedAt !== undefined)
```

**Note:** We filter in-memory rather than adding a new index because:
1. The existing indexes are used for sorting
2. Convex doesn't support compound indexes with optional fields efficiently
3. Expected community content volume is reasonable for in-memory filtering

### Schema Addition

```typescript
// Add to schema.ts - newsletterContent table (if not already done in 9.7)
// Add index for importCount sorting
.index("by_importCount", ["importCount"])
```

### Backend Query Updates

**Updated `listCommunityNewsletters`:**

```typescript
// packages/backend/convex/community.ts

export const listCommunityNewsletters = query({
  args: {
    sortBy: v.optional(v.union(v.literal("popular"), v.literal("recent"), v.literal("imports"))),
    senderEmail: v.optional(v.string()),
    domain: v.optional(v.string()),
    cursorValue: v.optional(v.number()),
    cursorId: v.optional(v.id("newsletterContent")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Auth check
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return { items: [], nextCursor: null, cursorValue: null, cursorId: null }

    const sortBy = args.sortBy ?? "popular"
    const limit = Math.min(args.limit ?? 20, 100)

    // Story 7.4: Get blocked senders for filtering
    const blockedSenderEmails = await getBlockedSenderEmails(ctx)

    let contentQuery = ctx.db.query("newsletterContent")

    if (args.senderEmail) {
      contentQuery = contentQuery.withIndex("by_senderEmail", (q) =>
        q.eq("senderEmail", args.senderEmail!)
      )
    } else {
      // Use appropriate index based on sort
      const indexName = sortBy === "imports"
        ? "by_importCount"
        : sortBy === "recent"
          ? "by_firstReceivedAt"
          : "by_readerCount"
      contentQuery = contentQuery.withIndex(indexName)
    }

    let allItems = await contentQuery.order("desc").take(1000)

    // Story 7.4: Filter out moderated content
    allItems = filterModeratedContent(allItems, blockedSenderEmails)

    // Story 9.8: CRITICAL - Only show admin-approved content
    allItems = allItems.filter(c => c.communityApprovedAt !== undefined)

    // Story 6.4: Apply domain filter if provided
    if (args.domain) {
      allItems = allItems.filter((item) => {
        const itemDomain = item.senderEmail.split("@")[1]
        return itemDomain === args.domain
      })
    }

    // Sort by desired field
    const sortedItems = [...allItems]
    if (sortBy === "recent") {
      sortedItems.sort((a, b) => {
        const diff = b.firstReceivedAt - a.firstReceivedAt
        return diff !== 0 ? diff : a._id.localeCompare(b._id)
      })
    } else if (sortBy === "imports") {
      sortedItems.sort((a, b) => {
        const diff = (b.importCount ?? 0) - (a.importCount ?? 0)
        return diff !== 0 ? diff : a._id.localeCompare(b._id)
      })
    } else {
      // popular = by readerCount
      sortedItems.sort((a, b) => {
        const diff = b.readerCount - a.readerCount
        return diff !== 0 ? diff : a._id.localeCompare(b._id)
      })
    }

    // ... pagination logic unchanged ...

    return {
      items: resultItems.map((c) => ({
        _id: c._id,
        subject: c.subject,
        senderEmail: c.senderEmail,
        senderName: c.senderName,
        firstReceivedAt: c.firstReceivedAt,
        readerCount: c.readerCount,
        importCount: c.importCount ?? 0, // Story 9.8: Add import count
        hasSummary: Boolean(c.summary),
      })),
      nextCursor: hasMore ? nextCursorId : null,
      cursorValue: hasMore ? nextCursorValue : null,
      cursorId: hasMore ? nextCursorId : null,
    }
  },
})
```

**New `checkUserHasNewsletters` Query:**

```typescript
/**
 * Check which community content items the user already has
 * Story 9.8 Task 3.1-3.2
 *
 * Returns a map of contentId → ownership status
 * Used to show "Already in collection" badges in community browse
 */
export const checkUserHasNewsletters = query({
  args: {
    contentIds: v.array(v.id("newsletterContent")),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return {}

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()
    if (!user) return {}

    // Get user's newsletters that reference these contentIds
    const userNewsletters = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()

    // Build map of contentId → ownership
    const result: Record<string, { hasPrivate: boolean; hasImported: boolean }> = {}

    for (const contentId of args.contentIds) {
      // Check if user has this content (either via contentId reference or same subject/sender)
      const matching = userNewsletters.filter(n => n.contentId === contentId)

      // Also check for private copies (same sender/subject but with privateR2Key)
      // This handles the case where user received same newsletter privately
      const contentRecord = await ctx.db.get(contentId)
      if (!contentRecord) continue

      const privateMatches = userNewsletters.filter(n =>
        n.senderEmail === contentRecord.senderEmail &&
        n.subject === contentRecord.subject &&
        n.privateR2Key !== undefined
      )

      result[contentId] = {
        hasPrivate: privateMatches.length > 0,
        hasImported: matching.some(n => n.source === "community"),
      }
    }

    return result
  },
})
```

### Frontend Component Updates

**Updated `CommunityNewsletterCard` with ownership indicator:**

```tsx
// apps/web/src/components/CommunityNewsletterCard.tsx

import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@newsletter-manager/backend"
import { Badge } from "@/components/ui/badge"
import { Lock, Download } from "lucide-react"

interface Props {
  newsletter: CommunityNewsletterData
  ownershipStatus?: { hasPrivate: boolean; hasImported: boolean }
}

export function CommunityNewsletterCard({ newsletter, ownershipStatus }: Props) {
  // ... existing code ...

  return (
    <Card className="...">
      <CardContent>
        {/* ... existing content ... */}

        {/* Ownership indicators - Story 9.8 Task 3.3-3.4 */}
        <div className="flex gap-2">
          {ownershipStatus?.hasPrivate && (
            <Badge variant="secondary" className="text-xs">
              <Lock className="h-3 w-3 mr-1" />
              In your collection
            </Badge>
          )}
          {ownershipStatus?.hasImported && !ownershipStatus?.hasPrivate && (
            <Badge variant="outline" className="text-xs">
              <Download className="h-3 w-3 mr-1" />
              Already imported
            </Badge>
          )}
        </div>

        {/* Import count badge - Story 9.8 Task 6.2 */}
        {newsletter.importCount > 0 && (
          <Badge variant="outline" className="text-xs">
            {newsletter.importCount} imports
          </Badge>
        )}
      </CardContent>
    </Card>
  )
}
```

**Preview Modal Component:**

```tsx
// apps/web/src/components/CommunityNewsletterPreviewModal.tsx

import { useState } from "react"
import { useAction, useMutation } from "convex/react"
import { api } from "@newsletter-manager/backend"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2, Download, X } from "lucide-react"
import { toast } from "sonner"
import type { Id } from "@newsletter-manager/backend/convex/_generated/dataModel"

interface Props {
  contentId: Id<"newsletterContent">
  subject: string
  senderName?: string
  senderEmail: string
  onClose: () => void
  alreadyOwned?: boolean
}

export function CommunityNewsletterPreviewModal({
  contentId,
  subject,
  senderName,
  senderEmail,
  onClose,
  alreadyOwned,
}: Props) {
  const [isLoading, setIsLoading] = useState(true)
  const [contentUrl, setContentUrl] = useState<string | null>(null)
  const [summary, setSummary] = useState<string | undefined>()
  const [isImporting, setIsImporting] = useState(false)

  const getContent = useAction(api.community.getCommunityNewsletterContent)
  const addToCollection = useMutation(api.community.addToCollection)

  // Load content on mount
  useEffect(() => {
    async function loadContent() {
      try {
        const result = await getContent({ contentId })
        setContentUrl(result.contentUrl)
        setSummary(result.summary)
      } catch (error) {
        toast.error("Failed to load newsletter content")
      } finally {
        setIsLoading(false)
      }
    }
    loadContent()
  }, [contentId, getContent])

  const handleImport = async () => {
    setIsImporting(true)
    try {
      const result = await addToCollection({ contentId })
      if (result.alreadyExists) {
        toast.info("Newsletter already in your collection")
      } else {
        toast.success("Newsletter added to your collection")
      }
      onClose()
    } catch (error) {
      toast.error("Failed to import newsletter")
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{subject}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            From: {senderName || senderEmail}
          </p>
        </DialogHeader>

        {/* Summary section */}
        {summary && (
          <div className="bg-muted/50 p-4 rounded-lg mb-4">
            <h4 className="font-medium mb-2">AI Summary</h4>
            <p className="text-sm">{summary}</p>
          </div>
        )}

        {/* Content preview */}
        <div className="flex-1 overflow-auto border rounded-lg">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : contentUrl ? (
            <iframe
              src={contentUrl}
              className="w-full h-full min-h-[400px]"
              sandbox="allow-same-origin"
              title="Newsletter preview"
            />
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Content not available
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
          <Button
            onClick={handleImport}
            disabled={isImporting || alreadyOwned}
          >
            {isImporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {alreadyOwned ? "Already Imported" : "Import to Collection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

### Project Structure Notes

**Files to Modify:**
- `packages/backend/convex/schema.ts` - Add `by_importCount` index to `newsletterContent`
- `packages/backend/convex/community.ts` - Update queries for admin-approved filtering, add `checkUserHasNewsletters`
- `apps/web/src/routes/_authed/community/index.tsx` - Update sort options, add ownership indicators
- `apps/web/src/components/CommunityNewsletterCard.tsx` - Add ownership badges, import count

**Files to Create:**
- `apps/web/src/components/CommunityNewsletterPreviewModal.tsx` - Preview modal with import action

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-02-01.md] - Epic 9 course correction proposal
- [Source: _bmad-output/planning-artifacts/epics.md#story-98-community-browse] - Story acceptance criteria
- [Source: _bmad-output/implementation-artifacts/9-7-admin-publish-flow.md] - Previous story with publish flow
- [Source: packages/backend/convex/community.ts] - Existing community queries to update
- [Source: apps/web/src/routes/_authed/community/index.tsx] - Existing community browse page
- [Source: apps/web/src/components/CommunityNewsletterCard.tsx] - Existing card component
- [Source: packages/backend/convex/schema.ts#newsletterContent] - Schema with communityApprovedAt field
- [Source: _bmad-output/project-context.md#convex-patterns] - Naming conventions, error handling

### Critical Constraints

1. **Admin-approved only** - ALL community queries MUST filter for `communityApprovedAt !== undefined`
2. **Existing moderation applies** - Continue to exclude hidden content and blocked senders
3. **Privacy maintained** - Never expose user data in community queries
4. **Backwards compatible** - Existing community infrastructure must continue working
5. **Performance** - In-memory filtering is acceptable given expected content volume
6. **Import count** - Use `importCount` (not `readerCount`) for Epic 9 "popular" sorting

### Relationship to Other Stories

- **Story 9.7 (Admin Publish Flow)** - Creates the `newsletterContent` records this story displays
- **Story 9.9 (Community Import)** - Imports content discovered here, increments `importCount`
- **Story 9.10 (Unified Folder View)** - Displays imported community content alongside private
- **Epic 6 Stories** - This story updates the existing Epic 6 community infrastructure

### Key Differences from Epic 6 Community

| Aspect | Epic 6 (Automatic) | Epic 9 (Admin-Curated) |
|--------|-------------------|------------------------|
| Content source | Auto-deduplication | Admin publish action |
| Visibility trigger | `newsletterContent` exists | `communityApprovedAt` set |
| Popularity metric | `readerCount` | `importCount` |
| User indicator | None | "In your collection" badge |
| Content preview | Direct navigation | Preview modal before import |

### Testing Approach

```typescript
// Test file: packages/backend/convex/community.test.ts

describe("Community Browse (Story 9.8)", () => {
  describe("Admin-approved filtering", () => {
    it("listCommunityNewsletters excludes content without communityApprovedAt")
    it("listCommunityNewslettersBySender excludes unapproved content")
    it("searchCommunityNewsletters excludes unapproved content")
    it("listCommunitySenders only includes senders with approved content")
  })

  describe("Import count sorting", () => {
    it("sortBy imports orders by importCount descending")
    it("returns importCount in response items")
  })

  describe("User ownership check", () => {
    it("checkUserHasNewsletters returns hasPrivate=true for private copies")
    it("checkUserHasNewsletters returns hasImported=true for community imports")
    it("checkUserHasNewsletters returns false for content user doesn't have")
    it("handles contentIds user doesn't have gracefully")
  })

  describe("Sender counts", () => {
    it("listCommunityNewslettersBySender returns totalCount of approved content")
    it("sender page shows correct available count")
  })
})

// Test file: apps/web/src/components/CommunityNewsletterPreviewModal.test.tsx

describe("CommunityNewsletterPreviewModal (Story 9.8)", () => {
  it("renders loading state initially")
  it("displays content in iframe when loaded")
  it("shows summary when available")
  it("import button triggers addToCollection mutation")
  it("shows Already Imported when alreadyOwned=true")
  it("closes modal on successful import")
  it("handles content load errors gracefully")
})

// Test file: apps/web/src/routes/_authed/community/index.test.tsx (update)

describe("Community Browse Page (Story 9.8 updates)", () => {
  it("shows Most Imported sort option")
  it("displays import count on newsletter cards")
  it("shows ownership badges for user's content")
  it("empty state when no admin-approved content")
})
```

## Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5
**Date:** 2026-02-01
**Outcome:** ✅ APPROVED

### Review Summary

All tasks verified as complete. All acceptance criteria implemented correctly. 4 MEDIUM and 3 LOW issues identified and fixed.

### Issues Fixed

**MEDIUM-1:** Extracted magic number `1000` to constant `MAX_COMMUNITY_CONTENT_SCAN` for clarity and maintainability.

**MEDIUM-2:** Added `MAX_OWNERSHIP_CHECK_BATCH = 100` limit to `checkUserHasNewsletters` query to prevent performance issues with large requests.

**MEDIUM-3:** (Documented) The useEffect cleanup in preview modal correctly uses `isMounted` flag - no code change needed.

**MEDIUM-4:** (Documentation correction) Test count clarified - 26 preview modal tests + Story 9.8 backend tests.

**LOW-1:** Fixed icon inconsistency - changed `ArrowDownToLine` to `Download` for import count badge to match ownership badges.

**LOW-3:** Magic numbers now use named constants throughout community.ts.

**LOW-5:** Removed unused `vi` import from preview modal test file.

### Verification

- All 126 community.test.ts tests pass
- All 26 CommunityNewsletterPreviewModal tests pass
- All 1074 backend tests pass

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - implementation completed without issues.

### Completion Notes List

1. **Task 1 Complete** - Updated all community queries (`listCommunityNewsletters`, `listCommunityNewslettersBySender`, `searchCommunityNewsletters`, `listCommunitySenders`, `listTopCommunitySenders`) to filter for admin-approved content only (`communityApprovedAt !== undefined`). Added admin-approval check to `filterModeratedContent` helper.

2. **Task 2 Complete** - Added `by_importCount` index to schema. Updated `listCommunityNewsletters` to support `sortBy: "imports"` option. Frontend sort dropdown now includes "Most Imported" option.

3. **Task 3 Complete** - Created `checkUserHasNewsletters` query returning ownership status map. Updated `CommunityNewsletterCard` to display "In your collection" (Lock icon) for private copies and "Already imported" (Download icon) for community imports.

4. **Task 4 Complete** - Updated `listCommunityNewslettersBySender` to return `totalCount` of approved content. Query now correctly filters for admin-approved content only.

5. **Task 5 Complete** - Created `CommunityNewsletterPreviewModal` component with content loading, summary display, and import button. Modal opens on newsletter card click.

6. **Task 6 Complete** - Updated community browse UI with "Most Imported" sort option, import count badges on cards, admin-curated empty state, and updated page description.

7. **Task 7 Complete** - Added 36 new contract tests covering admin-approved filtering, import count sorting, ownership checking, sender counts, preview modal, and badges. All 1074 backend tests pass.

8. **Additional Changes** - Updated `addToCollection` mutation to verify content is admin-approved before import, set `source: "community"`, and increment `importCount`.

### Change Log

- 2026-02-01: Implemented Story 9.8 - Admin-curated community browse with all acceptance criteria satisfied
- 2026-02-01: Code review complete - Fixed 4 MEDIUM and 3 LOW issues; extracted constants, limited batch size, fixed icon consistency

### File List

**Modified:**
- `packages/backend/convex/schema.ts` - Added `by_importCount` index to `newsletterContent`
- `packages/backend/convex/community.ts` - Updated all community queries for admin-approved filtering, added `checkUserHasNewsletters` query, added `sortBy: "imports"` support, updated `addToCollection` mutation
- `packages/backend/convex/community.test.ts` - Added 36 Story 9.8 contract tests
- `apps/web/src/components/CommunityNewsletterCard.tsx` - Added ownership badges, import count display, preview click handler
- `apps/web/src/routes/_authed/community/index.tsx` - Added preview modal integration, ownership checks, "Most Imported" sort option, updated empty state

**Created:**
- `apps/web/src/components/CommunityNewsletterPreviewModal.tsx` - Preview modal component with content loading, summary display, and import action
- `apps/web/src/components/CommunityNewsletterPreviewModal.test.tsx` - 26 contract tests for preview modal
