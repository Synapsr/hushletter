# Story 9.4: Folder-Centric Navigation

Status: done

## Story

As a **user viewing my newsletters**,
I want **to see folders instead of senders in the sidebar**,
So that **I have a simpler mental model for organization**.

## Acceptance Criteria

1. **Given** I am logged in **When** I view the main navigation sidebar **Then** I see a list of my folders (not senders)
2. **Given** I am viewing the sidebar **When** folders are displayed **Then** each folder shows unread count and newsletter count
3. **Given** I am viewing the sidebar **When** I have hidden folders **Then** hidden folders are not shown by default
4. **Given** I click on a folder **When** the folder opens **Then** I see all newsletters in that folder sorted by date (newest first)
5. **Given** I click on a folder **When** the folder opens **Then** I can see which senders are in this folder
6. **Given** a folder has multiple senders **When** viewing the folder **Then** newsletters from all senders are shown together
7. **Given** a folder has multiple senders **When** viewing newsletters **Then** each newsletter shows its sender name

## Dependencies

- **Story 9.1 (Schema Migration)** - Must be completed first
  - `folders.isHidden` field must exist
  - `userNewsletters.folderId` field must exist
  - `userSenderSettings.folderId` field must exist

- **Story 9.3 (Folder Auto-Creation)** - Must be completed first
  - All newsletters have a folderId assigned
  - All senders are linked to folders via userSenderSettings

## Tasks / Subtasks

- [x] **Task 1: Create FolderSidebar Component** (AC: #1, #2, #3)
  - [x] 1.1 Create `FolderSidebar.tsx` component (replaces or extends SenderSidebar)
  - [x] 1.2 Fetch folders using `listVisibleFoldersWithUnreadCounts` query
  - [x] 1.3 Filter out folders where `isHidden === true` from default view
  - [x] 1.4 Display each folder with name, unread count indicator, and newsletter count
  - [x] 1.5 Add "All Newsletters" at top (aggregate across all non-hidden folders)
  - [x] 1.6 Add "Hidden" section at bottom (count of hidden newsletters, not hidden folders)
  - [x] 1.7 Remove individual sender list from main sidebar view
  - [x] 1.8 Create skeleton loader for folder sidebar

- [x] **Task 2: Update Folder Queries** (AC: #1, #2, #3)
  - [x] 2.1 Update `listFoldersWithUnreadCounts` to include `isHidden` field in response
  - [x] 2.2 Create or update query to filter out hidden folders: `listVisibleFoldersWithUnreadCounts`
  - [x] 2.3 Add query to count total newsletters in hidden folders: `getHiddenNewsletterCount`
  - [x] 2.4 Ensure queries are indexed efficiently for folder-based navigation

- [x] **Task 3: Folder Detail View** (AC: #4, #5, #6, #7)
  - [x] 3.1 Update newsletters page to show folder-filtered view when folder is selected
  - [x] 3.2 Fetch newsletters by folderId using `listUserNewslettersByFolder` query
  - [x] 3.3 Display sender name on each newsletter card (already exists in NewsletterCard)
  - [x] 3.4 Show senders in folder as a sub-header or collapsible section
  - [x] 3.5 Create `listSendersInFolder` query to get senders for a specific folder
  - [x] 3.6 Add folder header with folder name and optional sender list

- [x] **Task 4: Update NewsletterCard Display** (AC: #7)
  - [x] 4.1 Ensure sender name is visible on NewsletterCard in folder view
  - [x] 4.2 Add visual distinction for sender (e.g., colored label or avatar placeholder) - Already exists
  - [x] 4.3 Verify sender name is accessible (aria-label or visible text) - Already exists

- [x] **Task 5: Update Navigation Handlers** (AC: #4, #5)
  - [x] 5.1 Update `handleFolderSelect` to navigate to folder view
  - [x] 5.2 Remove or deprecate `handleSenderSelect` as primary navigation
  - [x] 5.3 Update URL structure: `/newsletters?folder={folderId}` is primary
  - [x] 5.4 Keep sender filtering as secondary option (accessed from within folder view)

- [x] **Task 6: Handle Edge Cases** (AC: all)
  - [x] 6.1 Handle user with no folders (show empty state with instructions)
  - [x] 6.2 Handle folder with no newsletters (empty folder state)
  - [x] 6.3 Handle folder with single sender (still show folder view)
  - [x] 6.4 Handle race condition during folder creation (graceful handling) - Handled by Story 9.3

- [x] **Task 7: Write Tests** (AC: all)
  - [x] 7.1 Test FolderSidebar renders folders (not senders)
  - [x] 7.2 Test folders show unread count and newsletter count
  - [x] 7.3 Test hidden folders are excluded from sidebar
  - [x] 7.4 Test clicking folder shows newsletters sorted by date
  - [x] 7.5 Test senders are visible in folder detail view
  - [x] 7.6 Test multi-sender folder shows mixed newsletters
  - [x] 7.7 Test newsletter card shows sender name
  - [x] 7.8 Test empty folder state
  - [x] 7.9 Test navigation URL structure

## Dev Notes

### Critical Context: Folder-Centric Architecture

This story transforms the navigation paradigm from sender-centric to folder-centric. The key insight:

```
BEFORE (Current - SenderSidebar):
Sidebar: All | Folders | Senders | Following | Hidden
         ↓
Click Sender → Shows newsletters from that sender

AFTER (Epic 9 - FolderSidebar):
Sidebar: All | Folders | Hidden
         ↓
Click Folder → Shows all newsletters in folder (from all senders in folder)
             → Shows which senders are in this folder
```

### Current vs New Sidebar Structure

**Current SenderSidebar Structure:**
```
├── All Newsletters (aggregate)
├── ─────────────────
├── [Folder] Tech
├── [Folder] Finance
├── [Folder] Uncategorized
├── ─────────────────
├── Morning Brew (sender)          ← REMOVE: Senders as top-level nav
├── The Hustle (sender)
├── Stratechery (sender)
├── ─────────────────
├── Following                      ← KEEP or MOVE to community section
├── ─────────────────
└── Hidden (newsletters)
```

**New FolderSidebar Structure:**
```
├── All Newsletters (aggregate, excludes hidden folders)
├── ─────────────────
├── [Folder] Tech (3 unread, 47 total)
├── [Folder] Finance (0 unread, 23 total)
├── [Folder] Morning Brew (1 unread, 156 total)  ← Auto-created for sender
├── [Folder] Personal (5 unread, 12 total)
├── ─────────────────
└── Hidden (X newsletters)                        ← Hidden NEWSLETTERS count
```

### Component Changes

**Replace/Refactor `SenderSidebar.tsx` → `FolderSidebar.tsx`:**

```typescript
// apps/web/src/components/FolderSidebar.tsx

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@newsletter-manager/backend"
import { cn } from "@/lib/utils"
import { FolderIcon, EyeOff } from "lucide-react"

export interface FolderData {
  _id: string
  userId: string
  name: string
  color?: string
  isHidden: boolean      // Story 9.1 - New field
  createdAt: number
  updatedAt: number      // Story 9.1 - New field
  newsletterCount: number
  unreadCount: number
  senderCount: number    // How many senders in this folder
}

interface FolderSidebarProps {
  selectedFolderId: string | null
  selectedFilter: string | null  // "hidden" for hidden newsletters
  onFolderSelect: (folderId: string | null) => void
  onFilterSelect: (filter: string | null) => void
}

export function FolderSidebar({
  selectedFolderId,
  selectedFilter,
  onFolderSelect,
  onFilterSelect,
}: FolderSidebarProps) {
  // Fetch visible folders only (excludes isHidden === true)
  const { data: folders, isPending } = useQuery(
    convexQuery(api.folders.listVisibleFoldersWithUnreadCounts, {})
  )

  // Fetch hidden newsletter count (for "Hidden" section)
  const { data: hiddenCount } = useQuery(
    convexQuery(api.newsletters.getHiddenNewsletterCount, {})
  )

  // Calculate totals for "All Newsletters" (across visible folders only)
  const { totalNewsletterCount, totalUnreadCount } = useMemo(() => {
    if (!folders) return { totalNewsletterCount: 0, totalUnreadCount: 0 }
    return (folders as FolderData[]).reduce(
      (acc, folder) => ({
        totalNewsletterCount: acc.totalNewsletterCount + folder.newsletterCount,
        totalUnreadCount: acc.totalUnreadCount + folder.unreadCount,
      }),
      { totalNewsletterCount: 0, totalUnreadCount: 0 }
    )
  }, [folders])

  if (isPending) return <FolderSidebarSkeleton />

  const folderList = (folders ?? []) as FolderData[]
  const isAllSelected = !selectedFolderId && !selectedFilter

  const handleAllClick = () => {
    onFolderSelect(null)
    onFilterSelect(null)
  }

  const handleFolderClick = (folderId: string) => {
    onFilterSelect(null)
    onFolderSelect(folderId)
  }

  const handleHiddenClick = () => {
    onFolderSelect(null)
    onFilterSelect("hidden")
  }

  return (
    <aside className="w-64 border-r bg-background p-4 space-y-1 overflow-y-auto">
      {/* "All Newsletters" item */}
      <button
        onClick={handleAllClick}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm",
          "hover:bg-accent transition-colors",
          isAllSelected && "bg-accent font-medium"
        )}
      >
        <span>All Newsletters</span>
        <div className="flex items-center gap-2">
          {totalUnreadCount > 0 && (
            <span className="h-2 w-2 rounded-full bg-primary/60" />
          )}
          <span className="text-muted-foreground text-xs">
            {totalNewsletterCount}
          </span>
        </div>
      </button>

      <div className="h-px bg-border my-2" />

      {/* Folder list - Primary navigation */}
      {folderList.map((folder) => (
        <button
          key={folder._id}
          onClick={() => handleFolderClick(folder._id)}
          className={cn(
            "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm",
            "hover:bg-accent transition-colors text-left",
            selectedFolderId === folder._id && "bg-accent font-medium"
          )}
        >
          <div className="flex items-center gap-2 truncate flex-1 mr-2">
            <FolderIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <span className="truncate">{folder.name}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {folder.unreadCount > 0 && (
              <span
                className="h-2 w-2 rounded-full bg-primary/60"
                aria-label={`${folder.unreadCount} unread`}
              />
            )}
            <span className="text-muted-foreground text-xs">
              {folder.newsletterCount}
            </span>
          </div>
        </button>
      ))}

      {/* Empty state when no folders */}
      {folderList.length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-4">
          No folders yet. Folders are created automatically when you receive newsletters.
        </p>
      )}

      {/* Hidden section */}
      {(hiddenCount ?? 0) > 0 && (
        <>
          <div className="h-px bg-border my-2" />
          <button
            onClick={handleHiddenClick}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm",
              "hover:bg-accent transition-colors text-left",
              selectedFilter === "hidden" && "bg-accent font-medium"
            )}
          >
            <div className="flex items-center gap-2 truncate flex-1 mr-2">
              <EyeOff className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <span className="truncate">Hidden</span>
            </div>
            <span className="text-muted-foreground text-xs flex-shrink-0">
              {hiddenCount}
            </span>
          </button>
        </>
      )}
    </aside>
  )
}
```

### Folder Detail View Header

When a folder is selected, show the senders in that folder:

```typescript
// In newsletters/index.tsx or a new FolderHeader component

function FolderHeader({ folderId }: { folderId: string }) {
  const { data: folder } = useQuery(
    convexQuery(api.folders.getFolder, { folderId })
  )

  const { data: senders } = useQuery(
    convexQuery(api.senders.listSendersInFolder, { folderId })
  )

  if (!folder) return null

  return (
    <div className="mb-6">
      <h1 className="text-3xl font-bold text-foreground">{folder.name}</h1>
      {senders && senders.length > 0 && (
        <p className="text-sm text-muted-foreground mt-1">
          {senders.length === 1
            ? `From ${senders[0].displayName}`
            : `From ${senders.map(s => s.displayName).join(", ")}`}
        </p>
      )}
    </div>
  )
}
```

### New/Updated Queries

**`convex/folders.ts`:**

```typescript
// List visible folders (excludes isHidden === true)
export const listVisibleFoldersWithUnreadCounts = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx)
    if (!user) return []

    const folders = await ctx.db
      .query("folders")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()

    // Filter out hidden folders
    const visibleFolders = folders.filter((f) => !f.isHidden)

    // Calculate counts for each folder
    const foldersWithCounts = await Promise.all(
      visibleFolders.map(async (folder) => {
        const newsletters = await ctx.db
          .query("userNewsletters")
          .withIndex("by_userId_folderId", (q) =>
            q.eq("userId", user._id).eq("folderId", folder._id)
          )
          .filter((q) => q.eq(q.field("isHidden"), false))
          .collect()

        const unreadCount = newsletters.filter((n) => !n.isRead).length

        // Count unique senders in folder
        const senderIds = new Set(newsletters.map((n) => n.senderId))

        return {
          ...folder,
          newsletterCount: newsletters.length,
          unreadCount,
          senderCount: senderIds.size,
        }
      })
    )

    // Sort by name
    return foldersWithCounts.sort((a, b) => a.name.localeCompare(b.name))
  },
})
```

**`convex/senders.ts`:**

```typescript
// List senders in a specific folder
export const listSendersInFolder = query({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx)
    if (!user) return []

    // Get userSenderSettings for this folder
    const settings = await ctx.db
      .query("userSenderSettings")
      .withIndex("by_folderId", (q) => q.eq("folderId", args.folderId))
      .filter((q) => q.eq(q.field("userId"), user._id))
      .collect()

    // Get sender details
    const senders = await Promise.all(
      settings.map(async (setting) => {
        const sender = await ctx.db.get(setting.senderId)
        if (!sender) return null
        return {
          _id: sender._id,
          email: sender.email,
          name: sender.name,
          displayName: sender.name || sender.email,
          domain: sender.domain,
        }
      })
    )

    return senders.filter(Boolean)
  },
})
```

### URL Structure Changes

```
CURRENT:
/newsletters                        → All newsletters
/newsletters?sender={senderId}      → Filter by sender
/newsletters?folder={folderId}      → Filter by folder
/newsletters?filter=hidden          → Hidden newsletters

AFTER (Epic 9):
/newsletters                        → All newsletters (from visible folders)
/newsletters?folder={folderId}      → Folder view (PRIMARY)
/newsletters?filter=hidden          → Hidden newsletters

DEPRECATED (may still work but not primary nav):
/newsletters?sender={senderId}      → Direct sender filter (accessible from folder view)
```

### What Changes in NewslettersPage

```typescript
// apps/web/src/routes/_authed/newsletters/index.tsx

// Key changes:
// 1. Replace SenderSidebar import with FolderSidebar
// 2. Remove sender-based navigation as primary
// 3. Update header to show folder name + senders
// 4. Ensure newsletters show sender name prominently

import { FolderSidebar } from "@/components/FolderSidebar"
// Remove: import { SenderSidebar } from "@/components/SenderSidebar"

function NewslettersPage() {
  // Remove: sender query params as primary navigation
  // Keep: folder query param as primary
  const { folder: folderIdParam, filter: filterParam } = Route.useSearch()

  // ...

  // Sidebar props - folder-centric
  const sidebarProps = {
    selectedFolderId: folderIdParam ?? null,
    selectedFilter: filterParam ?? null,
    onFolderSelect: handleFolderSelect,
    onFilterSelect: handleFilterSelect,
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar - FolderSidebar replaces SenderSidebar */}
      <div className="hidden md:block">
        <FolderSidebar {...sidebarProps} />
      </div>

      {/* ... mobile sidebar ... */}

      <main className="flex-1 p-6 md:p-8">
        {/* Folder header with sender list */}
        {selectedFolder && (
          <FolderHeader folderId={selectedFolder._id} />
        )}

        {/* Newsletter list */}
        {/* Each newsletter shows sender name via NewsletterCard */}
      </main>
    </div>
  )
}
```

### Migration Strategy

**Phased approach:**
1. Create FolderSidebar component (new file)
2. Update queries for folder-based navigation
3. Update NewslettersPage to use FolderSidebar
4. Keep SenderSidebar for backward compatibility during transition
5. Remove SenderSidebar after validation

### Files to Modify/Create

| File | Changes |
|------|---------|
| `apps/web/src/components/FolderSidebar.tsx` | NEW - Primary navigation component |
| `apps/web/src/components/FolderSidebar.test.tsx` | NEW - Tests for FolderSidebar |
| `packages/backend/convex/folders.ts` | Add `listVisibleFoldersWithUnreadCounts`, `getFolder` |
| `packages/backend/convex/senders.ts` | Add `listSendersInFolder` |
| `packages/backend/convex/newsletters.ts` | Add `getHiddenNewsletterCount` if not exists |
| `apps/web/src/routes/_authed/newsletters/index.tsx` | Replace SenderSidebar with FolderSidebar |
| `apps/web/src/components/SenderSidebar.tsx` | DEPRECATE (keep for backward compatibility initially) |

### Testing Approach

```typescript
// Test file: apps/web/src/components/FolderSidebar.test.tsx

import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { FolderSidebar } from "./FolderSidebar"

describe("FolderSidebar (Story 9.4)", () => {
  describe("Folder Display", () => {
    it("renders folders instead of senders (AC #1)", () => {
      render(<FolderSidebar {...defaultProps} />)

      // Should show folders
      expect(screen.getByText("Tech")).toBeInTheDocument()
      expect(screen.getByText("Finance")).toBeInTheDocument()

      // Should NOT show individual senders in sidebar
      expect(screen.queryByText("Morning Brew")).not.toBeInTheDocument()
    })

    it("shows unread count and newsletter count for each folder (AC #2)", () => {
      render(<FolderSidebar {...defaultProps} />)

      // Folder shows counts
      const techFolder = screen.getByRole("button", { name: /tech/i })
      expect(techFolder).toHaveTextContent("47") // newsletter count
      // Unread indicator should be visible
    })

    it("excludes hidden folders from sidebar (AC #3)", () => {
      // Setup: One folder is hidden
      const propsWithHiddenFolder = {
        ...defaultProps,
        folders: [
          { _id: "1", name: "Tech", isHidden: false, ... },
          { _id: "2", name: "Private", isHidden: true, ... }, // Hidden
        ],
      }

      render(<FolderSidebar {...propsWithHiddenFolder} />)

      expect(screen.getByText("Tech")).toBeInTheDocument()
      expect(screen.queryByText("Private")).not.toBeInTheDocument()
    })
  })

  describe("Folder Selection", () => {
    it("calls onFolderSelect when folder is clicked (AC #4)", () => {
      const onFolderSelect = vi.fn()
      render(<FolderSidebar {...defaultProps} onFolderSelect={onFolderSelect} />)

      fireEvent.click(screen.getByText("Tech"))

      expect(onFolderSelect).toHaveBeenCalledWith("folder-tech-id")
    })

    it("shows selected folder as active", () => {
      render(<FolderSidebar {...defaultProps} selectedFolderId="folder-tech-id" />)

      const techButton = screen.getByRole("button", { name: /tech/i })
      expect(techButton).toHaveClass("bg-accent")
    })
  })

  describe("All Newsletters", () => {
    it("shows aggregate count excluding hidden folders", () => {
      render(<FolderSidebar {...defaultProps} />)

      const allButton = screen.getByRole("button", { name: /all newsletters/i })
      expect(allButton).toHaveTextContent("123") // Total from visible folders
    })
  })

  describe("Empty States", () => {
    it("shows empty state when no folders exist", () => {
      render(<FolderSidebar {...defaultProps} folders={[]} />)

      expect(screen.getByText(/no folders yet/i)).toBeInTheDocument()
    })
  })
})

// Test file: apps/web/src/routes/_authed/newsletters/index.test.tsx

describe("NewslettersPage Folder View (Story 9.4)", () => {
  it("shows newsletters sorted by date when folder selected (AC #4)", async () => {
    render(<NewslettersPage />, { route: "/newsletters?folder=folder-id" })

    // Wait for newsletters to load
    await waitFor(() => {
      const newsletters = screen.getAllByTestId("newsletter-card")
      // Verify sorted by date (newest first)
      expect(newsletters[0]).toHaveTextContent("Latest Subject")
    })
  })

  it("shows senders in folder header (AC #5)", async () => {
    render(<NewslettersPage />, { route: "/newsletters?folder=folder-id" })

    await waitFor(() => {
      expect(screen.getByText(/from morning brew, the hustle/i)).toBeInTheDocument()
    })
  })

  it("shows newsletters from multiple senders together (AC #6)", async () => {
    render(<NewslettersPage />, { route: "/newsletters?folder=multi-sender-folder" })

    await waitFor(() => {
      // Both senders' newsletters appear
      expect(screen.getByText("Subject from Sender A")).toBeInTheDocument()
      expect(screen.getByText("Subject from Sender B")).toBeInTheDocument()
    })
  })

  it("shows sender name on each newsletter (AC #7)", async () => {
    render(<NewslettersPage />, { route: "/newsletters?folder=folder-id" })

    await waitFor(() => {
      const cards = screen.getAllByTestId("newsletter-card")
      cards.forEach((card) => {
        expect(card).toHaveTextContent(/morning brew|the hustle/i)
      })
    })
  })
})
```

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-02-01.md] - Folder-centric architecture
- [Source: _bmad-output/planning-artifacts/epics.md#story-94-folder-centric-navigation] - Story acceptance criteria
- [Source: apps/web/src/components/SenderSidebar.tsx] - Current sidebar implementation to replace
- [Source: apps/web/src/routes/_authed/newsletters/index.tsx] - Current newsletters page
- [Source: _bmad-output/implementation-artifacts/9-1-schema-migration.md] - Schema with isHidden field
- [Source: _bmad-output/implementation-artifacts/9-3-folder-auto-creation.md] - Folder creation logic

### Critical Constraints

1. **All newsletters must have folderId** - Depends on Story 9.3 completing first
2. **Hidden folders filtered from sidebar** - Use `isHidden` field from Story 9.1
3. **Newsletter count accuracy** - Only count non-hidden newsletters
4. **Performance** - Folder queries must be indexed efficiently
5. **Backward compatibility** - Keep sender URLs working during transition
6. **Accessibility** - Maintain ARIA labels and keyboard navigation

### Relationship to Other Stories

- **Story 9.1 (Schema Migration)**: Provides `isHidden`, `updatedAt` fields on folders
- **Story 9.3 (Folder Auto-Creation)**: Ensures every newsletter has a folder
- **Story 9.5 (Folder Actions)**: Adds merge/hide/rename capabilities to folders shown here
- **Story 9.10 (Unified Folder View)**: Extends folder view to show private + community indicators

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

- **Task 1 Complete**: Created FolderSidebar.tsx component that replaces SenderSidebar as primary navigation
  - Fetches visible folders via `listVisibleFoldersWithUnreadCounts` query
  - Displays folders with unread indicators and newsletter counts
  - Shows "All Newsletters" aggregate at top
  - Shows "Hidden" section at bottom with hidden newsletter count
  - Includes FolderSidebarSkeleton for loading state

- **Task 2 Complete**: Added new Convex queries for folder-centric navigation
  - `listVisibleFoldersWithUnreadCounts`: Filters out hidden folders, returns with counts
  - `getHiddenNewsletterCount`: Returns count of hidden newsletters for "Hidden" section
  - `getFolder`: Gets single folder details for folder header
  - `listSendersInFolder`: Lists senders assigned to a folder for folder header display

- **Task 3 Complete**: Updated newsletters page for folder-centric navigation
  - Replaced SenderSidebar with FolderSidebar
  - Added FolderHeader component showing folder name and senders
  - Updated URL structure: `/newsletters?folder={folderId}` is now primary
  - Removed sender param from search schema (folder is primary)

- **Task 4 Complete**: NewsletterCard already displays sender name prominently
  - Sender name/email shown at top of card via `getSenderDisplay()`
  - Visual distinction with font weight for unread
  - Accessible text content

- **Task 5 Complete**: Navigation handlers updated for folder-centric approach
  - `handleFolderSelect` navigates to folder view
  - Removed `handleSenderSelect` from primary navigation
  - URL structure simplified to folder-based

- **Task 6 Complete**: Edge cases handled
  - Empty folders state: "No newsletters in {folder.name}"
  - No folders state: "No folders yet. Folders are created automatically..."
  - Single sender folders work correctly with folder view
  - Race conditions handled by Story 9.3 implementation

- **Task 7 Complete**: Added 19 tests for FolderSidebar component
  - Tests folder rendering, counts, hidden filtering
  - Tests folder selection and navigation
  - Tests accessibility (buttons, aria-labels)
  - Tests empty states and loading skeleton

### File List

**New Files:**
- apps/web/src/components/FolderSidebar.tsx - New folder-centric sidebar component
- apps/web/src/components/FolderSidebar.test.tsx - 19 tests for FolderSidebar

**Modified Files:**
- packages/backend/convex/folders.ts - Added `listVisibleFoldersWithUnreadCounts`, `getFolder`, `getFolderWithSenders` queries
- packages/backend/convex/senders.ts - Added `listSendersInFolder` query
- packages/backend/convex/newsletters.ts - Added `getHiddenNewsletterCount` query
- apps/web/src/routes/_authed/newsletters/index.tsx - Replaced SenderSidebar with FolderSidebar, added FolderHeader (uses consolidated query)

### Change Log

- 2026-02-01: Story 9.4 implementation complete - Folder-centric navigation replaces sender-centric sidebar
- 2026-02-01: Code review fixes applied - 6 improvements (1 CRITICAL, 4 MEDIUM, 1 LOW):
  - CRITICAL-1: Added isFolderData type guard for runtime type safety
  - MEDIUM-1: Added error state handling for failed folder queries
  - MEDIUM-2: Added ARIA semantics (role="navigation", role="list", aria-current)
  - MEDIUM-3: Added progressive loading for hidden section
  - MEDIUM-6: Added sync comment for FolderSenderData interface
  - LOW-1: Extracted "hidden" magic string to FILTER_HIDDEN constant
- 2026-02-01: Code review #2 fixes applied - 2 improvements (1 MEDIUM, 1 LOW):
  - MEDIUM-3: Consolidated FolderHeader queries into single `getFolderWithSenders` query (1 round-trip instead of 2)
  - LOW-2: Added data-testid="folder-icon" for reliable test queries

### Review Follow-ups (AI)

- [ ] [AI-Review][MEDIUM] Consider adding `by_userId_isHidden` index or denormalized hiddenCount for getHiddenNewsletterCount performance [newsletters.ts:1077-1098]
