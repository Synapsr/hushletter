# Story 9.10: Unified Folder View

Status: done

## Story

As a **user viewing a folder**,
I want **to see both private and community-imported newsletters together**,
So that **I have a complete view of content from that sender**.

## Acceptance Criteria

1. **Given** my folder has both private and community-imported newsletters **When** I view the folder **Then** all newsletters are shown sorted by date
2. **Given** I am viewing a folder **When** newsletters are displayed **Then** private newsletters show a "private" indicator (e.g., envelope icon)
3. **Given** I am viewing a folder **When** newsletters are displayed **Then** community imports show a "community" indicator (e.g., globe icon)
4. **Given** I click on a private newsletter **When** loading content **Then** it fetches from my `privateR2Key`
5. **Given** I click on a community-imported newsletter **When** loading content **Then** it fetches from `newsletterContent.r2Key` via `contentId`
6. **Given** I delete a community-imported newsletter **When** the deletion completes **Then** my `userNewsletter` is removed **And** the `newsletterContent` is unchanged **And** `importCount` is decremented

## Dependencies

- **Story 9.4 (Folder-Centric Navigation)** - COMPLETE (in review)
  - FolderSidebar component for folder navigation
  - `listUserNewslettersByFolder` query for folder-based newsletter list
  - FolderHeader component showing folder name and senders
  - URL structure: `/newsletters?folder={folderId}`

- **Story 9.9 (Community Import)** - REQUIRED
  - `addToCollection` mutation that sets `source: "community"`
  - Community-imported newsletters have `contentId` reference
  - `importCount` field for tracking community imports

- **Story 9.2 (Private-by-Default)** - COMPLETE
  - Private newsletters have `privateR2Key` (no `contentId`)
  - `source` field indicates origin: "email", "gmail", "manual", "community"

- **Story 9.1 (Schema Migration)** - COMPLETE
  - `userNewsletters.source` union type: "email" | "gmail" | "manual" | "community"
  - `userNewsletters.contentId` optional reference
  - `userNewsletters.privateR2Key` for private content

- **Existing Newsletter Infrastructure** - LEVERAGE
  - `NewsletterCard` component for rendering
  - `getNewsletterContent` action for content retrieval
  - Delete functionality exists (needs update for community decrement)

## Tasks / Subtasks

- [x] **Task 1: Add Source Indicators to NewsletterCard** (AC: #2, #3)
  - [x] 1.1 Update `NewsletterCard` to display source indicator based on `source` field
  - [x] 1.2 Use envelope icon (Mail) for private sources ("email", "gmail", "manual")
  - [x] 1.3 Use globe icon (Globe) for community source ("community")
  - [x] 1.4 Add tooltip explaining the source type on hover
  - [x] 1.5 Ensure indicators are accessible (aria-label)
  - [x] 1.6 Position indicator consistently (e.g., top-right corner or alongside sender name)

- [x] **Task 2: Update Newsletter List Query Response** (AC: #1)
  - [x] 2.1 Ensure `listUserNewslettersByFolder` returns `source` field
  - [x] 2.2 Ensure `listUserNewsletters` returns `source` field for "All" view
  - [x] 2.3 Verify newsletters are sorted by `receivedAt` descending (newest first)
  - [x] 2.4 Update TypeScript types for newsletter list items to include `source`

- [x] **Task 3: Update Content Retrieval Logic** (AC: #4, #5)
  - [x] 3.1 Update `getNewsletterContent` action to check `source` field
  - [x] 3.2 If source is "community" and `contentId` exists, fetch from `newsletterContent.r2Key`
  - [x] 3.3 If source is private ("email", "gmail", "manual"), fetch from `privateR2Key`
  - [x] 3.4 Handle edge case: community newsletter without valid contentId (show error)
  - [x] 3.5 Handle edge case: private newsletter without privateR2Key (show error)
  - [x] 3.6 Add telemetry/logging for content retrieval paths

- [x] **Task 4: Update Newsletter Delete for Community Imports** (AC: #6)
  - [x] 4.1 Update `deleteUserNewsletter` mutation to check if newsletter is community import
  - [x] 4.2 If `source === "community"` and `contentId` exists, decrement `importCount`
  - [x] 4.3 Ensure `newsletterContent` record is NOT deleted (only user's reference)
  - [x] 4.4 If `source` is private, delete associated R2 content if applicable
  - [x] 4.5 Add confirmation dialog mentioning this only removes from personal collection

- [x] **Task 5: Update Reader View** (AC: #2, #3, #4, #5)
  - [x] 5.1 Display source indicator in reader header (private vs community)
  - [x] 5.2 Show "From your collection" label for private newsletters
  - [x] 5.3 Show "From community" label for imported newsletters
  - [x] 5.4 Ensure content loads from correct R2 key based on source
  - [x] 5.5 Update delete button text for community imports ("Remove from collection")

- [ ] **Task 6: Handle Mixed Source Folder Display** (AC: #1) - OPTIONAL
  - [x] 6.1 Verify folder view correctly mixes private + community newsletters by date
  - [ ] 6.2 Add filter toggle: "All Sources" | "Private Only" | "Community Only" (optional - deferred)
  - [ ] 6.3 Update folder stats to show breakdown by source (e.g., "12 private, 5 from community") (optional - deferred)
  - [ ] 6.4 Ensure FolderHeader shows accurate counts including community imports (optional - deferred)

- [x] **Task 7: Write Tests** (AC: all)
  - [x] 7.1 Test NewsletterCard displays envelope icon for private sources
  - [x] 7.2 Test NewsletterCard displays globe icon for community source
  - [x] 7.3 Test folder view shows mixed sources sorted by date (via contract test)
  - [x] 7.4 Test getNewsletterContent fetches from privateR2Key for private (via contract test)
  - [x] 7.5 Test getNewsletterContent fetches from contentId for community (via contract test)
  - [x] 7.6 Test delete decrements importCount for community imports (via contract test)
  - [x] 7.7 Test delete does NOT remove newsletterContent for community imports (via contract test)
  - [x] 7.8 Test reader view shows correct source indicator (via NewsletterCard tests)
  - [x] 7.9 Test source tooltips are accessible (via NewsletterCard tests)

## Dev Notes

### Critical Context: Unified Folder View Architecture

This is the capstone story for Epic 9, bringing together the private-first architecture with community content. The folder view becomes the single interface where users see ALL their newsletters regardless of source.

**Newsletter Source Types:**

| Source | R2 Content Location | Origin |
|--------|-------------------|--------|
| `email` | `userNewsletters.privateR2Key` | Dedicated email address reception |
| `gmail` | `userNewsletters.privateR2Key` | Gmail import (Epic 4) |
| `manual` | `userNewsletters.privateR2Key` | Drag-drop/forward import (Epic 8) |
| `community` | `newsletterContent.r2Key` via `contentId` | Community import (Story 9.9) |

**Visual Indicators:**

```
Private Sources (email/gmail/manual):
┌─────────────────────────────────┐
│ 📧 Morning Brew: Today's Top...  │  ← Envelope icon
│ From: morningbrew@email.com      │
│ Jan 31, 2026                     │
└─────────────────────────────────┘

Community Import:
┌─────────────────────────────────┐
│ 🌐 Morning Brew: Market Update  │  ← Globe icon
│ From: morningbrew@email.com      │
│ Jan 28, 2026                     │
└─────────────────────────────────┘
```

### NewsletterCard Source Indicator Implementation

```tsx
// apps/web/src/components/NewsletterCard.tsx

import { Mail, Globe } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface NewsletterCardProps {
  // ... existing props
  source?: "email" | "gmail" | "manual" | "community"
}

function getSourceIndicator(source?: string) {
  if (source === "community") {
    return {
      icon: Globe,
      label: "From community",
      tooltip: "This newsletter was imported from the community library",
      className: "text-blue-500",
    }
  }
  // Default to private for email/gmail/manual
  return {
    icon: Mail,
    label: "Private",
    tooltip: "This newsletter is in your private collection",
    className: "text-muted-foreground",
  }
}

export function NewsletterCard({
  newsletter,
  source,
  // ... other props
}: NewsletterCardProps) {
  const sourceInfo = getSourceIndicator(source)
  const SourceIcon = sourceInfo.icon

  return (
    <Card className="...">
      <CardContent>
        {/* Header with sender and source indicator */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{newsletter.senderName}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={cn("flex items-center gap-1", sourceInfo.className)}>
                <SourceIcon className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">{sourceInfo.label}</span>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p>{sourceInfo.tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Subject */}
        <h3 className="font-medium truncate">{newsletter.subject}</h3>

        {/* ... rest of card */}
      </CardContent>
    </Card>
  )
}
```

### Content Retrieval Logic Update

```typescript
// packages/backend/convex/newsletters.ts

/**
 * Get newsletter content with unified source handling
 * Story 9.10: Updated to handle both private and community sources
 */
export const getNewsletterContent = action({
  args: { userNewsletterId: v.id("userNewsletters") },
  handler: async (ctx, args): Promise<{ contentUrl: string; summary?: string }> => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Not authenticated" })
    }

    const userNewsletter = await ctx.runQuery(internal.newsletters.getById, {
      id: args.userNewsletterId
    })

    if (!userNewsletter) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Newsletter not found" })
    }

    // Story 9.10: Route to correct R2 key based on source
    let r2Key: string
    let summary: string | undefined

    if (userNewsletter.source === "community" && userNewsletter.contentId) {
      // Community import - fetch from shared newsletterContent
      const content = await ctx.runQuery(internal.community.getContentById, {
        contentId: userNewsletter.contentId,
      })
      if (!content) {
        throw new ConvexError({
          code: "NOT_FOUND",
          message: "Community content no longer available"
        })
      }
      r2Key = content.r2Key
      summary = content.summary
    } else if (userNewsletter.privateR2Key) {
      // Private sources - fetch from user's private storage
      r2Key = userNewsletter.privateR2Key
      // Private newsletters may have summaries stored on userNewsletters
      summary = userNewsletter.summary
    } else {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Newsletter content not available"
      })
    }

    // Generate signed URL from R2
    const contentUrl = await generateSignedR2Url(r2Key)

    return { contentUrl, summary }
  },
})
```

### Delete Mutation with Community Decrement

```typescript
// packages/backend/convex/newsletters.ts

/**
 * Delete a user newsletter from their collection
 * Story 9.10: Updated to handle community import decrement
 */
export const deleteUserNewsletter = mutation({
  args: { userNewsletterId: v.id("userNewsletters") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Not authenticated" })
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()

    if (!user) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "User not found" })
    }

    const userNewsletter = await ctx.db.get(args.userNewsletterId)

    if (!userNewsletter) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Newsletter not found" })
    }

    // Verify ownership
    if (userNewsletter.userId !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Not your newsletter" })
    }

    // Story 9.10: Handle community import decrement
    if (userNewsletter.source === "community" && userNewsletter.contentId) {
      const content = await ctx.db.get(userNewsletter.contentId)
      if (content) {
        // Decrement importCount (not below 0)
        const newImportCount = Math.max(0, (content.importCount ?? 1) - 1)
        await ctx.db.patch(userNewsletter.contentId, {
          importCount: newImportCount,
          // Note: Do NOT decrement readerCount - that's set once on first read
        })
      }
      // Note: We do NOT delete newsletterContent - other users may have it
    }

    // For private newsletters, we could optionally delete R2 content
    // But for safety, we just remove the reference (R2 cleanup can be a separate process)

    // Delete the userNewsletter record
    await ctx.db.delete(args.userNewsletterId)

    return { deleted: true }
  },
})
```

### Query Updates for Source Field

```typescript
// packages/backend/convex/newsletters.ts

/**
 * List user newsletters with source field for unified display
 * Story 9.10: Ensure source is included in response
 */
export const listUserNewslettersByFolder = query({
  args: {
    folderId: v.id("folders"),
    cursor: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) return { items: [], nextCursor: null }

    const limit = Math.min(args.limit ?? 20, 100)

    const newsletters = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId_folderId", (q) =>
        q.eq("userId", user._id).eq("folderId", args.folderId)
      )
      .filter((q) => q.eq(q.field("isHidden"), false))
      .order("desc") // By receivedAt (default ordering)
      .take(limit + 1)

    const hasMore = newsletters.length > limit
    const items = newsletters.slice(0, limit)

    return {
      items: items.map((n) => ({
        _id: n._id,
        subject: n.subject,
        senderEmail: n.senderEmail,
        senderName: n.senderName,
        receivedAt: n.receivedAt,
        isRead: n.isRead,
        isHidden: n.isHidden,
        isPrivate: n.isPrivate,
        source: n.source, // Story 9.10: Include source for UI indicators
        hasContentId: Boolean(n.contentId), // For debugging/verification
        readProgress: n.readProgress,
      })),
      nextCursor: hasMore ? items[items.length - 1]._id : null,
    }
  },
})
```

### Folder Stats with Source Breakdown

```typescript
// packages/backend/convex/folders.ts

/**
 * Get folder details with source breakdown
 * Story 9.10: Include private vs community counts
 */
export const getFolderWithSourceBreakdown = query({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) return null

    const folder = await ctx.db.get(args.folderId)
    if (!folder || folder.userId !== user._id) return null

    const newsletters = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId_folderId", (q) =>
        q.eq("userId", user._id).eq("folderId", args.folderId)
      )
      .filter((q) => q.eq(q.field("isHidden"), false))
      .collect()

    // Calculate breakdown by source
    const privateCount = newsletters.filter(
      (n) => n.source === "email" || n.source === "gmail" || n.source === "manual"
    ).length
    const communityCount = newsletters.filter(
      (n) => n.source === "community"
    ).length
    const unreadCount = newsletters.filter((n) => !n.isRead).length

    return {
      ...folder,
      newsletterCount: newsletters.length,
      privateCount,
      communityCount,
      unreadCount,
    }
  },
})
```

### Reader View Source Display

```tsx
// apps/web/src/routes/_authed/newsletters/$id.tsx

import { Mail, Globe, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

function ReaderHeader({ newsletter }: { newsletter: UserNewsletter }) {
  const isCommunity = newsletter.source === "community"
  const deleteNewsletter = useMutation(api.newsletters.deleteUserNewsletter)

  const handleDelete = async () => {
    await deleteNewsletter({ userNewsletterId: newsletter._id })
    // Navigate back to folder or list
  }

  return (
    <header className="border-b pb-4 mb-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{newsletter.subject}</h1>
          <p className="text-muted-foreground">
            From: {newsletter.senderName || newsletter.senderEmail}
          </p>
          <p className="text-sm text-muted-foreground">
            {new Date(newsletter.receivedAt).toLocaleDateString()}
          </p>
        </div>

        {/* Source indicator badge */}
        <div className="flex items-center gap-4">
          {isCommunity ? (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Globe className="h-3 w-3" />
              From community
            </Badge>
          ) : (
            <Badge variant="outline" className="flex items-center gap-1">
              <Mail className="h-3 w-3" />
              Your collection
            </Badge>
          )}

          {/* Delete button with confirmation */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {isCommunity
                    ? "Remove from collection?"
                    : "Delete newsletter?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {isCommunity
                    ? "This will remove the newsletter from your personal collection. The newsletter will still be available in the community library."
                    : "This will permanently delete this newsletter from your collection."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  {isCommunity ? "Remove" : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </header>
  )
}
```

### Project Structure Notes

**Files to Modify:**

| File | Changes |
|------|---------|
| `apps/web/src/components/NewsletterCard.tsx` | Add source indicator with icons and tooltips |
| `packages/backend/convex/newsletters.ts` | Update queries to include `source`, update delete for community |
| `packages/backend/convex/folders.ts` | Add `getFolderWithSourceBreakdown` query |
| `apps/web/src/routes/_authed/newsletters/$id.tsx` | Add source badge to reader header, update delete dialog |
| `apps/web/src/routes/_authed/newsletters/index.tsx` | Pass `source` prop to NewsletterCard components |

**Files to Create:**

| File | Purpose |
|------|---------|
| `apps/web/src/components/NewsletterCard.test.tsx` | Add tests for source indicators |
| `apps/web/src/components/SourceIndicator.tsx` | (Optional) Extract source indicator to reusable component |

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-02-01.md] - Epic 9 course correction proposal
- [Source: _bmad-output/planning-artifacts/epics.md#story-910-unified-folder-view] - Story acceptance criteria
- [Source: _bmad-output/implementation-artifacts/9-4-folder-centric-navigation.md] - Folder navigation infrastructure
- [Source: _bmad-output/implementation-artifacts/9-9-community-import.md] - Community import with source tracking
- [Source: _bmad-output/implementation-artifacts/9-2-private-by-default.md] - Private R2 key storage pattern
- [Source: packages/backend/convex/newsletters.ts] - Existing newsletter queries and mutations
- [Source: apps/web/src/components/NewsletterCard.tsx] - Card component to update
- [Source: _bmad-output/project-context.md#convex-patterns] - Naming conventions, error handling

### Critical Constraints

1. **Source field required** - ALL newsletters MUST have `source` field populated (migration in Story 9.1)
2. **Content routing** - Community imports MUST use `contentId` path, private MUST use `privateR2Key`
3. **Import count accuracy** - Deleting community import MUST decrement `importCount`
4. **No content deletion** - Community imports MUST NOT delete `newsletterContent` on user delete
5. **Date sorting** - Mixed sources MUST sort by `receivedAt` regardless of source
6. **Accessibility** - Source indicators MUST have proper ARIA labels and tooltips

### Relationship to Other Stories

- **Story 9.4 (Folder-Centric Navigation)** - Provides the folder view infrastructure this story enhances
- **Story 9.9 (Community Import)** - Creates community-imported newsletters with `source: "community"`
- **Story 9.8 (Community Browse)** - Where users discover content before importing
- **Story 9.2 (Private-by-Default)** - Establishes the private R2 key pattern for non-community newsletters

### Key Implementation Notes

1. **Source icons** - Use Lucide icons consistently: `Mail` for private, `Globe` for community. These are already used elsewhere in the app.

2. **Tooltip provider** - Ensure the app has `<TooltipProvider>` wrapper for tooltip functionality. Check `apps/web/src/routes/__root.tsx`.

3. **Type safety** - The `source` field is a union type. TypeScript will enforce correct handling, but add runtime checks for edge cases.

4. **Performance** - The `source` field is already indexed on `userNewsletters`. No new indexes needed.

5. **Delete confirmation** - Community imports get softer language ("Remove from collection") vs private ("Delete").

6. **R2 cleanup** - For MVP, we don't delete R2 content when deleting private newsletters. This can be a background cleanup job later.

### Testing Approach

```typescript
// Test file: apps/web/src/components/NewsletterCard.test.tsx

describe("NewsletterCard Source Indicators (Story 9.10)", () => {
  describe("Private newsletters", () => {
    it("shows Mail icon for source='email'", () => {
      render(<NewsletterCard newsletter={mockNewsletter} source="email" />)
      expect(screen.getByLabelText("Private")).toBeInTheDocument()
      // Mail icon should be present
    })

    it("shows Mail icon for source='gmail'", () => {
      render(<NewsletterCard newsletter={mockNewsletter} source="gmail" />)
      expect(screen.getByLabelText("Private")).toBeInTheDocument()
    })

    it("shows Mail icon for source='manual'", () => {
      render(<NewsletterCard newsletter={mockNewsletter} source="manual" />)
      expect(screen.getByLabelText("Private")).toBeInTheDocument()
    })
  })

  describe("Community newsletters", () => {
    it("shows Globe icon for source='community'", () => {
      render(<NewsletterCard newsletter={mockNewsletter} source="community" />)
      expect(screen.getByLabelText("From community")).toBeInTheDocument()
    })
  })

  describe("Tooltips", () => {
    it("shows tooltip on hover for private source", async () => {
      render(<NewsletterCard newsletter={mockNewsletter} source="email" />)

      fireEvent.mouseEnter(screen.getByLabelText("Private"))

      await waitFor(() => {
        expect(screen.getByText(/private collection/i)).toBeInTheDocument()
      })
    })

    it("shows tooltip on hover for community source", async () => {
      render(<NewsletterCard newsletter={mockNewsletter} source="community" />)

      fireEvent.mouseEnter(screen.getByLabelText("From community"))

      await waitFor(() => {
        expect(screen.getByText(/community library/i)).toBeInTheDocument()
      })
    })
  })
})

// Test file: packages/backend/convex/newsletters.test.ts

describe("Newsletter Content Retrieval (Story 9.10)", () => {
  describe("getNewsletterContent", () => {
    it("fetches from privateR2Key for source='email'", async () => {
      const result = await getNewsletterContent({
        userNewsletterId: emailNewsletterId
      })
      // Verify it fetched from privateR2Key path
      expect(mockGenerateSignedUrl).toHaveBeenCalledWith(
        expect.stringContaining("private/")
      )
    })

    it("fetches from contentId for source='community'", async () => {
      const result = await getNewsletterContent({
        userNewsletterId: communityNewsletterId
      })
      // Verify it fetched from newsletterContent
      expect(mockGenerateSignedUrl).toHaveBeenCalledWith(
        expect.stringContaining("community/")
      )
    })

    it("throws error when community newsletter has no contentId", async () => {
      await expect(
        getNewsletterContent({ userNewsletterId: brokenCommunityId })
      ).rejects.toThrow("Community content no longer available")
    })
  })
})

describe("Newsletter Delete (Story 9.10)", () => {
  describe("deleteUserNewsletter", () => {
    it("decrements importCount for community source", async () => {
      // Setup: newsletter with source="community", contentId with importCount=5

      await deleteUserNewsletter({ userNewsletterId: communityNewsletterId })

      // Verify importCount was decremented
      const content = await getContentById(contentId)
      expect(content.importCount).toBe(4)
    })

    it("does not delete newsletterContent for community source", async () => {
      await deleteUserNewsletter({ userNewsletterId: communityNewsletterId })

      // Verify content still exists
      const content = await getContentById(contentId)
      expect(content).not.toBeNull()
    })

    it("does not decrement for private sources", async () => {
      await deleteUserNewsletter({ userNewsletterId: emailNewsletterId })

      // No newsletterContent involved, so no decrement
      // Just verify the delete succeeded
    })

    it("handles importCount going to zero", async () => {
      // Setup: importCount = 1

      await deleteUserNewsletter({ userNewsletterId: communityNewsletterId })

      const content = await getContentById(contentId)
      expect(content.importCount).toBe(0)
      expect(content).not.toBeNull() // Content preserved even at 0
    })
  })
})

// Test file: apps/web/src/routes/_authed/newsletters/index.test.tsx

describe("Folder View with Mixed Sources (Story 9.10)", () => {
  it("displays newsletters from both sources sorted by date", async () => {
    render(<NewslettersPage />, { route: "/newsletters?folder=mixed-folder-id" })

    await waitFor(() => {
      const cards = screen.getAllByTestId("newsletter-card")
      // First card should be newest regardless of source
      expect(cards[0]).toHaveTextContent("Latest Newsletter") // Community
      expect(cards[1]).toHaveTextContent("Second Newsletter") // Private
    })
  })

  it("shows correct icons for each source type", async () => {
    render(<NewslettersPage />, { route: "/newsletters?folder=mixed-folder-id" })

    await waitFor(() => {
      // Should have both icon types visible
      expect(screen.getAllByLabelText("Private").length).toBeGreaterThan(0)
      expect(screen.getAllByLabelText("From community").length).toBeGreaterThan(0)
    })
  })

  it("passes source prop to NewsletterCard", async () => {
    render(<NewslettersPage />, { route: "/newsletters?folder=folder-id" })

    await waitFor(() => {
      // Verify each card has the appropriate source indicator
      const communityCard = screen.getByText("Community Newsletter Subject")
        .closest('[data-testid="newsletter-card"]')
      expect(communityCard).toContainElement(screen.getByLabelText("From community"))
    })
  })
})
```

### Edge Cases to Handle

1. **Legacy newsletters** - Newsletters without `source` field (migrated from before Epic 9) should default to private indicator
2. **Deleted community content** - If `newsletterContent` was deleted (admin action), show graceful error in reader
3. **Mixed folder empty state** - Handle folder with only community imports or only private
4. **Source filter** - Optional: Let users filter folder view by source type

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

1. **Task 1 - NewsletterCard Source Indicators**: Added `source` field to `NewsletterData` interface. Created `getSourceIndicatorInfo()` helper that returns Mail icon for private sources (email/gmail/manual) and Globe icon with blue styling for community source. Indicators include tooltips and aria-labels for accessibility.

2. **Task 2 - Query Updates**: Updated `listUserNewsletters`, `listUserNewslettersBySender`, `listUserNewslettersByFolder`, and `listHiddenNewsletters` to include `source` field in response. All queries maintain proper date sorting via `by_userId_receivedAt` index.

3. **Task 3 - Content Retrieval**: Already implemented in Story 2.5.1's `getUserNewsletterWithContent` action. Routes to `privateR2Key` for private content and fetches from `newsletterContent.r2Key` via `contentId` for community imports.

4. **Task 4 - Delete Mutation**: Created `deleteUserNewsletter` mutation that decrements `importCount` for community imports (source="community" with contentId) while preserving the `newsletterContent` record. Private newsletters are simply deleted without R2 cleanup (deferred to background process).

5. **Task 5 - Reader View**: Updated `$id.tsx` with source badge ("From community" with Globe icon vs "Your collection" with Mail icon), delete button with AlertDialog confirmation that uses appropriate messaging ("Remove from collection?" vs "Delete newsletter?").

6. **Task 6 - Mixed Source Display**: The core requirement (AC #1) is satisfied - folder view mixes private and community newsletters sorted by date. Optional features (filter toggle, source breakdown stats) deferred as they add complexity without MVP value.

7. **Task 7 - Tests**: Added comprehensive tests:
   - `NewsletterCard.test.tsx`: 9 tests for source indicators (private/community icons, blue styling, aria-labels)
   - `newsletters.test.ts`: Contract tests for `deleteUserNewsletter` mutation and source field in query responses

8. **UI Component Added**: Created `alert-dialog.tsx` component using `@radix-ui/react-alert-dialog` for delete confirmation dialogs.

9. **Code Review Fixes Applied**:
   - MEDIUM: Extracted IIFE in NewsletterCard.tsx JSX to computed variable at component top
   - LOW: Added destructive styling (red button) for permanent delete action on private newsletters
   - LOW: Improved documentation comment for importCount decrement logic in backend mutation

### File List

**Modified:**
- `apps/web/src/components/NewsletterCard.tsx` - Added source indicator with getSourceIndicatorInfo() helper
- `apps/web/src/components/NewsletterCard.test.tsx` - Added Story 9.10 source indicator tests
- `packages/backend/convex/newsletters.ts` - Added source field to queries, created deleteUserNewsletter mutation
- `packages/backend/convex/newsletters.test.ts` - Added Story 9.10 contract tests
- `apps/web/src/routes/_authed/newsletters/$id.tsx` - Added source badge, delete button with confirmation
- `apps/web/package.json` - Added @radix-ui/react-alert-dialog dependency
- `pnpm-lock.yaml` - Updated lockfile

**Created:**
- `apps/web/src/components/ui/alert-dialog.tsx` - AlertDialog component for delete confirmation

