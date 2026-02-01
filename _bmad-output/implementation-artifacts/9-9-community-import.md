# Story 9.9: Community Import

Status: done

## Story

As a **user who found interesting community content**,
I want **to import newsletters to my personal collection**,
So that **I can read them alongside my private newsletters**.

## Acceptance Criteria

1. **Given** I am viewing a community newsletter **When** I click "Import" or "Add to Collection" **Then** a `userNewsletter` is created with `contentId` (not privateR2Key) **And** `source` is set to "community"
2. **Given** I import a community newsletter **When** the import completes **Then** it's placed in my folder for that sender (or creates one if I don't have one)
3. **Given** I import a community newsletter **When** the import completes **Then** `newsletterContent.importCount` is incremented
4. **Given** I already have a folder for this sender **When** I import a community newsletter **Then** it appears in my existing folder **And** it's mixed with my private newsletters by date
5. **Given** I want to import multiple newsletters **When** selecting bulk import **Then** all selected newsletters are imported **And** I see progress and confirmation

## Dependencies

- **Story 9.8 (Community Browse)** - REQUIRED
  - `checkUserHasNewsletters` query for detecting duplicates
  - Community browse UI for selecting newsletters to import
  - Preview modal with import action already implemented

- **Story 9.7 (Admin Publish Flow)** - REQUIRED
  - `newsletterContent` records with `communityApprovedAt` exist
  - `importCount` field on `newsletterContent` for tracking imports

- **Story 9.3 (Folder Auto-Creation)** - REQUIRED
  - `getOrCreateSenderFolder` helper for folder auto-creation logic
  - Pattern for creating folders when importing from new senders

- **Story 9.1 (Schema Migration)** - COMPLETE
  - `userNewsletters.source` field with "community" literal
  - `userNewsletters.folderId` for folder assignment
  - `newsletterContent.importCount` field

- **Existing Community Infrastructure** - LEVERAGE
  - `addToCollection` mutation exists (needs updates for Epic 9)
  - `CommunityNewsletterCard` component with import action

## Tasks / Subtasks

- [x] **Task 1: Update addToCollection Mutation for Epic 9 Model** (AC: #1, #2, #3)
  - [x] 1.1 Update `addToCollection` to set `source: "community"` on created `userNewsletter`
  - [x] 1.2 Update `addToCollection` to assign `folderId` using folder auto-creation pattern from Story 9.3
  - [x] 1.3 Increment `importCount` on `newsletterContent` (not just `readerCount`)
  - [x] 1.4 Ensure `isPrivate: false` is set (community imports are public by nature)
  - [x] 1.5 Add comprehensive error handling with ConvexError

- [x] **Task 2: Create Folder for Community Imports** (AC: #2, #4)
  - [x] 2.1 Import/reuse `getOrCreateSenderFolder` from Story 9.3 implementation
  - [x] 2.2 When importing, get or create folder named after sender
  - [x] 2.3 Create `userSenderSettings` with folderId if new sender relationship
  - [x] 2.4 If user already has folder for sender, use existing folder

- [x] **Task 3: Bulk Import Implementation** (AC: #5)
  - [x] 3.1 Create `bulkImportFromCommunity` mutation that accepts array of contentIds
  - [x] 3.2 Process imports in batch, tracking success/skip/error for each
  - [x] 3.3 Return detailed results: { imported: number, skipped: number, failed: number, results: [] }
  - [x] 3.4 Optimize folder creation (create once per sender, not per newsletter)
  - [x] 3.5 Batch increment `importCount` efficiently

- [x] **Task 4: Update Preview Modal Import Flow** (AC: #1)
  - [x] 4.1 Update `CommunityNewsletterPreviewModal` to use updated `addToCollection`
  - [x] 4.2 Show success toast with folder name where newsletter was placed
  - [x] 4.3 Handle already-imported case gracefully (show info toast)
  - [x] 4.4 Navigate to folder or newsletter after import (optional)

- [x] **Task 5: Add Bulk Import UI to Community Browse** (AC: #5)
  - [x] 5.1 Add selection mode toggle to community browse page
  - [x] 5.2 Add checkboxes to `CommunityNewsletterCard` when in selection mode
  - [x] 5.3 Add floating action bar with "Import Selected (X)" button
  - [x] 5.4 Show progress indicator during bulk import
  - [x] 5.5 Show completion summary with imported/skipped counts
  - [x] 5.6 Add "Select All Visible" and "Clear Selection" actions

- [x] **Task 6: Update Community Newsletter Card** (AC: #1, #4)
  - [x] 6.1 Add quick "Import" button to card (not just preview modal)
  - [x] 6.2 Change button to "In Collection" with checkmark when already imported
  - [x] 6.3 Show folder destination in import confirmation
  - [x] 6.4 Update ownership badges to reflect new import state

- [x] **Task 7: Write Tests** (AC: all)
  - [x] 7.1 Test `addToCollection` sets `source: "community"`
  - [x] 7.2 Test `addToCollection` assigns correct folderId (existing or new)
  - [x] 7.3 Test `importCount` is incremented on successful import
  - [x] 7.4 Test duplicate import returns `alreadyExists: true` without incrementing
  - [x] 7.5 Test folder auto-creation when importing from new sender
  - [x] 7.6 Test `bulkImportFromCommunity` handles mixed success/skip/error
  - [x] 7.7 Test bulk import creates folders efficiently (one per sender)
  - [x] 7.8 Test UI shows correct state for imported vs available newsletters
  - [x] 7.9 Test selection mode UI and bulk import flow

## Dev Notes

### Critical Context: Epic 9 Community Import Model

This story implements the user-facing import flow for the admin-curated community model:

**Flow:**
1. Admin publishes sanitized newsletters to `newsletterContent` (Story 9.7)
2. Users browse admin-approved content (Story 9.8)
3. Users import newsletters to their personal collection (THIS STORY)
4. Imported newsletters appear in unified folder view (Story 9.10)

**Key Differences from Epic 6 addToCollection:**

| Aspect | Epic 6 | Epic 9 |
|--------|--------|--------|
| Source tracking | None | `source: "community"` |
| Folder assignment | Optional | Required (auto-created) |
| Counter increment | `readerCount` only | `readerCount` + `importCount` |
| Privacy flag | `isPrivate: false` | Same (unchanged) |

### Backend Updates

**Updated `addToCollection` Mutation:**

```typescript
// packages/backend/convex/community.ts

/**
 * Add a community newsletter to user's personal collection
 * Story 6.1 Task 4.1-4.3
 * Story 9.9: Updated for Epic 9 folder-centric and source tracking
 *
 * Creates userNewsletter with:
 * - contentId reference (from community)
 * - source: "community" (Epic 9 tracking)
 * - folderId: auto-created or existing folder for sender
 *
 * Also:
 * - Creates userSenderSettings with folderId if new sender relationship
 * - Increments readerCount AND importCount on newsletterContent
 */
export const addToCollection = mutation({
  args: { contentId: v.id("newsletterContent") },
  handler: async (ctx, args) => {
    // 1. Auth check
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Not authenticated" })
    }

    // 2. Get user
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()

    if (!user) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "User not found" })
    }

    // 3. Get the content
    const content = await ctx.db.get(args.contentId)
    if (!content) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Newsletter content not found" })
    }

    // Story 9.8: Verify content is community-approved
    if (!content.communityApprovedAt) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Content not available in community" })
    }

    // 4. Check if already in collection (by userId + contentId)
    const existingUserNewsletters = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()

    const existing = existingUserNewsletters.find((n) => n.contentId === args.contentId)

    if (existing) {
      // Story 9.9: Get folder name for response
      const folder = existing.folderId ? await ctx.db.get(existing.folderId) : null
      return {
        alreadyExists: true,
        userNewsletterId: existing._id,
        folderName: folder?.name ?? null
      }
    }

    // 5. Get or create global sender
    let sender = await ctx.db
      .query("senders")
      .withIndex("by_email", (q) => q.eq("email", content.senderEmail))
      .first()

    if (!sender) {
      // Create sender (rare case - sender should exist from original receipt)
      const senderId = await ctx.db.insert("senders", {
        email: content.senderEmail,
        name: content.senderName,
        domain: content.senderEmail.split("@")[1] || "unknown",
        subscriberCount: 1,
        newsletterCount: 1,
      })
      sender = (await ctx.db.get(senderId))!
    }

    // 6. Story 9.9: Get or create folder for this sender
    // This follows the folder auto-creation pattern from Story 9.3
    const existingSettings = await ctx.db
      .query("userSenderSettings")
      .withIndex("by_userId_senderId", (q) =>
        q.eq("userId", user._id).eq("senderId", sender._id)
      )
      .first()

    let folderId: Id<"folders">
    let folderName: string

    if (existingSettings?.folderId) {
      // Use existing folder
      folderId = existingSettings.folderId
      const folder = await ctx.db.get(folderId)
      folderName = folder?.name ?? sender.name ?? sender.email
    } else {
      // Create folder for this sender (Story 9.3 pattern)
      const senderDisplayName = sender.name ?? sender.email.split("@")[0]

      // Check if folder with this name exists (avoid duplicates)
      const existingFolder = await ctx.db
        .query("folders")
        .withIndex("by_userId", (q) => q.eq("userId", user._id))
        .filter((q) => q.eq(q.field("name"), senderDisplayName))
        .first()

      if (existingFolder) {
        folderId = existingFolder._id
        folderName = existingFolder.name
      } else {
        const now = Date.now()
        folderId = await ctx.db.insert("folders", {
          userId: user._id,
          name: senderDisplayName,
          isHidden: false,
          createdAt: now,
          updatedAt: now,
        })
        folderName = senderDisplayName
      }

      // Create or update userSenderSettings with folderId
      if (existingSettings) {
        await ctx.db.patch(existingSettings._id, { folderId })
      } else {
        await ctx.db.insert("userSenderSettings", {
          userId: user._id,
          senderId: sender._id,
          isPrivate: false, // Community imports are public
          folderId,
        })
        // Increment subscriberCount since this is a new user-sender relationship
        await ctx.db.patch(sender._id, {
          subscriberCount: sender.subscriberCount + 1,
        })
      }
    }

    // 7. Create userNewsletter with contentId reference
    // Story 9.9: Set source to "community" and assign folderId
    const userNewsletterId = await ctx.db.insert("userNewsletters", {
      userId: user._id,
      senderId: sender._id,
      folderId, // Story 9.9: Required folder assignment
      contentId: args.contentId,
      subject: content.subject,
      senderEmail: content.senderEmail,
      senderName: content.senderName,
      receivedAt: content.firstReceivedAt,
      isRead: false,
      isHidden: false,
      isPrivate: false, // Community imports are public
      source: "community", // Story 9.9: Track origin
    })

    // 8. Increment readerCount AND importCount
    // Story 9.9: Track imports separately from reader count
    await ctx.db.patch(args.contentId, {
      readerCount: content.readerCount + 1,
      importCount: (content.importCount ?? 0) + 1,
    })

    return {
      alreadyExists: false,
      userNewsletterId,
      folderName, // Story 9.9: Return folder name for UI confirmation
    }
  },
})
```

**New `bulkImportFromCommunity` Mutation:**

```typescript
// packages/backend/convex/community.ts

/**
 * Bulk import multiple community newsletters
 * Story 9.9 Task 3
 *
 * Efficiently imports multiple newsletters by:
 * - Batching folder creation (one per sender)
 * - Processing imports in sequence to avoid race conditions
 * - Returning detailed results for each item
 */
export const bulkImportFromCommunity = mutation({
  args: {
    contentIds: v.array(v.id("newsletterContent")),
  },
  handler: async (ctx, args) => {
    // Auth check
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

    // Limit batch size to prevent timeout
    if (args.contentIds.length > 50) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Maximum 50 newsletters can be imported at once"
      })
    }

    // Get user's existing newsletters for duplicate detection
    const existingNewsletters = await ctx.db
      .query("userNewsletters")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()
    const existingContentIds = new Set(
      existingNewsletters
        .filter(n => n.contentId)
        .map(n => n.contentId)
    )

    // Get user's existing settings for folder lookup
    const existingSettings = await ctx.db
      .query("userSenderSettings")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()
    const settingsBySenderId = new Map(
      existingSettings.map(s => [s.senderId, s])
    )

    // Get user's existing folders
    const existingFolders = await ctx.db
      .query("folders")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()
    const foldersByName = new Map(
      existingFolders.map(f => [f.name, f])
    )

    // Track created folders in this batch to avoid duplicates
    const createdFoldersThisBatch = new Map<string, Id<"folders">>()

    // Results tracking
    const results: Array<{
      contentId: string
      status: "imported" | "skipped" | "error"
      error?: string
      folderName?: string
    }> = []

    let imported = 0
    let skipped = 0
    let failed = 0

    for (const contentId of args.contentIds) {
      try {
        // Skip if already in collection
        if (existingContentIds.has(contentId)) {
          results.push({ contentId, status: "skipped" })
          skipped++
          continue
        }

        // Get content
        const content = await ctx.db.get(contentId)
        if (!content) {
          results.push({ contentId, status: "error", error: "Content not found" })
          failed++
          continue
        }

        // Verify community-approved
        if (!content.communityApprovedAt) {
          results.push({ contentId, status: "error", error: "Not community-approved" })
          failed++
          continue
        }

        // Get or create sender
        let sender = await ctx.db
          .query("senders")
          .withIndex("by_email", (q) => q.eq("email", content.senderEmail))
          .first()

        if (!sender) {
          const senderId = await ctx.db.insert("senders", {
            email: content.senderEmail,
            name: content.senderName,
            domain: content.senderEmail.split("@")[1] || "unknown",
            subscriberCount: 1,
            newsletterCount: 1,
          })
          sender = (await ctx.db.get(senderId))!
        }

        // Get or create folder
        const senderDisplayName = sender.name ?? sender.email.split("@")[0]
        let folderId: Id<"folders">
        let folderName: string

        const existingSetting = settingsBySenderId.get(sender._id)
        if (existingSetting?.folderId) {
          folderId = existingSetting.folderId
          const folder = await ctx.db.get(folderId)
          folderName = folder?.name ?? senderDisplayName
        } else {
          // Check if folder exists or was created in this batch
          const existingFolder = foldersByName.get(senderDisplayName)
          const batchCreatedFolderId = createdFoldersThisBatch.get(senderDisplayName)

          if (existingFolder) {
            folderId = existingFolder._id
            folderName = existingFolder.name
          } else if (batchCreatedFolderId) {
            folderId = batchCreatedFolderId
            folderName = senderDisplayName
          } else {
            const now = Date.now()
            folderId = await ctx.db.insert("folders", {
              userId: user._id,
              name: senderDisplayName,
              isHidden: false,
              createdAt: now,
              updatedAt: now,
            })
            folderName = senderDisplayName
            createdFoldersThisBatch.set(senderDisplayName, folderId)
          }

          // Create or update settings
          if (existingSetting) {
            await ctx.db.patch(existingSetting._id, { folderId })
            settingsBySenderId.set(sender._id, { ...existingSetting, folderId })
          } else {
            const settingsId = await ctx.db.insert("userSenderSettings", {
              userId: user._id,
              senderId: sender._id,
              isPrivate: false,
              folderId,
            })
            settingsBySenderId.set(sender._id, {
              _id: settingsId,
              userId: user._id,
              senderId: sender._id,
              isPrivate: false,
              folderId,
            } as any)
            await ctx.db.patch(sender._id, {
              subscriberCount: sender.subscriberCount + 1,
            })
          }
        }

        // Create userNewsletter
        await ctx.db.insert("userNewsletters", {
          userId: user._id,
          senderId: sender._id,
          folderId,
          contentId,
          subject: content.subject,
          senderEmail: content.senderEmail,
          senderName: content.senderName,
          receivedAt: content.firstReceivedAt,
          isRead: false,
          isHidden: false,
          isPrivate: false,
          source: "community",
        })

        // Increment counts
        await ctx.db.patch(contentId, {
          readerCount: content.readerCount + 1,
          importCount: (content.importCount ?? 0) + 1,
        })

        // Track as imported
        existingContentIds.add(contentId)
        results.push({ contentId, status: "imported", folderName })
        imported++
      } catch (error) {
        results.push({
          contentId,
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error"
        })
        failed++
      }
    }

    return {
      imported,
      skipped,
      failed,
      total: args.contentIds.length,
      results,
    }
  },
})
```

### Frontend Updates

**Updated Preview Modal with Enhanced Import Flow:**

```tsx
// apps/web/src/components/CommunityNewsletterPreviewModal.tsx

import { useState, useEffect } from "react"
import { useAction, useMutation } from "convex/react"
import { api } from "@newsletter-manager/backend"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "~/components/ui/dialog"
import { Button } from "~/components/ui/button"
import { Loader2, Download, X, FolderOpen, Check } from "lucide-react"
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

  const getContent = useAction(api.community.getCommunityNewsletterContent)
  const addToCollection = useMutation(api.community.addToCollection)

  // Load content on mount
  useEffect(() => {
    async function loadContent() {
      try {
        const result = await getContent({ contentId })
        setContentUrl(result.contentUrl)
        setSummary(result.summary)
      } catch {
        toast.error("Failed to load newsletter content")
      } finally {
        setIsLoading(false)
      }
    }
    loadContent()
  }, [contentId, getContent])

  const handleImport = async () => {
    try {
      const result = await addToCollection({ contentId })
      if (result.alreadyExists) {
        toast.info("Newsletter already in your collection", {
          description: result.folderName ? `In folder: ${result.folderName}` : undefined
        })
      } else {
        toast.success("Newsletter added to your collection", {
          description: result.folderName ? `Added to folder: ${result.folderName}` : undefined,
          icon: <FolderOpen className="h-4 w-4" />
        })
      }
      onClose()
    } catch {
      toast.error("Failed to import newsletter")
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
          {alreadyOwned ? (
            <Button disabled variant="secondary">
              <Check className="h-4 w-4 mr-2" />
              In Your Collection
            </Button>
          ) : (
            <Button onClick={handleImport}>
              <Download className="h-4 w-4 mr-2" />
              Import to Collection
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Bulk Import Selection UI Component:**

```tsx
// apps/web/src/components/BulkImportBar.tsx

import { useState } from "react"
import { useMutation } from "convex/react"
import { api } from "@newsletter-manager/backend"
import { Button } from "~/components/ui/button"
import { Progress } from "~/components/ui/progress"
import { Download, X, CheckCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { Id } from "@newsletter-manager/backend/convex/_generated/dataModel"

interface Props {
  selectedIds: Set<Id<"newsletterContent">>
  onClearSelection: () => void
  onImportComplete: () => void
}

export function BulkImportBar({ selectedIds, onClearSelection, onImportComplete }: Props) {
  const [isImporting, setIsImporting] = useState(false)
  const [progress, setProgress] = useState(0)

  const bulkImport = useMutation(api.community.bulkImportFromCommunity)

  const handleBulkImport = async () => {
    setIsImporting(true)
    setProgress(0)

    try {
      const result = await bulkImport({
        contentIds: Array.from(selectedIds)
      })

      setProgress(100)

      // Show results
      if (result.imported > 0 && result.skipped === 0 && result.failed === 0) {
        toast.success(`Imported ${result.imported} newsletter${result.imported !== 1 ? 's' : ''}`)
      } else {
        toast.info(
          `Import complete: ${result.imported} imported, ${result.skipped} already in collection, ${result.failed} failed`,
          { duration: 5000 }
        )
      }

      onImportComplete()
      onClearSelection()
    } catch (error) {
      toast.error("Bulk import failed")
    } finally {
      setIsImporting(false)
    }
  }

  if (selectedIds.size === 0) return null

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-background border rounded-lg shadow-lg p-4 flex items-center gap-4">
        {isImporting ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            <div className="w-48">
              <Progress value={progress} />
            </div>
            <span className="text-sm text-muted-foreground">
              Importing...
            </span>
          </>
        ) : (
          <>
            <span className="text-sm font-medium">
              {selectedIds.size} selected
            </span>
            <Button onClick={handleBulkImport} size="sm">
              <Download className="h-4 w-4 mr-2" />
              Import Selected
            </Button>
            <Button variant="ghost" size="sm" onClick={onClearSelection}>
              <X className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
```

### Project Structure Notes

**Files to Modify:**
- `packages/backend/convex/community.ts` - Update `addToCollection`, add `bulkImportFromCommunity`
- `apps/web/src/components/CommunityNewsletterPreviewModal.tsx` - Enhanced import flow
- `apps/web/src/components/CommunityNewsletterCard.tsx` - Add quick import button, selection checkbox
- `apps/web/src/routes/_authed/community/index.tsx` - Add selection mode, bulk import bar

**Files to Create:**
- `apps/web/src/components/BulkImportBar.tsx` - Floating bulk import action bar

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-02-01.md] - Epic 9 course correction proposal
- [Source: _bmad-output/planning-artifacts/epics.md#story-99-community-import] - Story acceptance criteria
- [Source: _bmad-output/implementation-artifacts/9-8-community-browse.md] - Previous story with browse infrastructure
- [Source: _bmad-output/implementation-artifacts/9-3-folder-auto-creation.md] - Folder auto-creation pattern
- [Source: packages/backend/convex/community.ts#addToCollection] - Existing mutation to update
- [Source: packages/backend/convex/folders.ts] - Folder creation patterns
- [Source: packages/backend/convex/schema.ts#userNewsletters] - Schema with source and folderId fields
- [Source: _bmad-output/project-context.md#convex-patterns] - Naming conventions, error handling

### Critical Constraints

1. **Source tracking** - ALL community imports MUST set `source: "community"` for analytics and display
2. **Folder required** - ALL community imports MUST have `folderId` set (auto-create if needed)
3. **Import count** - MUST increment both `readerCount` AND `importCount`
4. **Community-approved only** - MUST verify `communityApprovedAt` before importing
5. **Duplicate prevention** - Check existing `userNewsletters` by `contentId` to avoid duplicates
6. **Batch limits** - Bulk import limited to 50 items to prevent timeout
7. **Folder deduplication** - When creating folders, check by name to avoid duplicates

### Relationship to Other Stories

- **Story 9.7 (Admin Publish Flow)** - Creates the content that users import here
- **Story 9.8 (Community Browse)** - Provides the discovery UI where imports originate
- **Story 9.10 (Unified Folder View)** - Displays imported community content alongside private
- **Story 9.3 (Folder Auto-Creation)** - Folder creation pattern reused for community imports

### Testing Approach

```typescript
// Test file: packages/backend/convex/community.test.ts (update)

describe("Community Import (Story 9.9)", () => {
  describe("addToCollection mutation", () => {
    it("sets source to 'community' on imported newsletter")
    it("assigns folderId using existing folder when available")
    it("creates new folder when no folder exists for sender")
    it("increments both readerCount and importCount")
    it("returns alreadyExists: true without incrementing for duplicates")
    it("returns folderName in response for UI confirmation")
    it("rejects import for content without communityApprovedAt")
    it("creates userSenderSettings with folderId for new sender relationship")
    it("increments subscriberCount for new sender relationship")
  })

  describe("bulkImportFromCommunity mutation", () => {
    it("imports multiple newsletters successfully")
    it("skips newsletters already in collection")
    it("returns detailed results for each item")
    it("creates folders efficiently (one per sender)")
    it("handles mixed success/skip/error gracefully")
    it("rejects requests over 50 items")
    it("rolls up counts correctly in response")
  })
})

// Test file: apps/web/src/components/BulkImportBar.test.tsx

describe("BulkImportBar (Story 9.9)", () => {
  it("renders only when items are selected")
  it("shows selected count correctly")
  it("calls bulkImportFromCommunity on Import Selected click")
  it("shows progress during import")
  it("displays completion summary toast")
  it("clears selection on complete")
  it("clears selection on X button click")
})

// Test file: apps/web/src/components/CommunityNewsletterCard.test.tsx (update)

describe("CommunityNewsletterCard Import (Story 9.9)", () => {
  it("shows quick Import button when not owned")
  it("shows 'In Collection' with checkmark when owned")
  it("shows checkbox in selection mode")
  it("calls selection callback when checkbox toggled")
  it("shows folder name in import success toast")
})
```

### Key Implementation Notes

1. **Reuse folder auto-creation pattern** from Story 9.3 - the same logic that creates folders when emails arrive should create folders when importing from community

2. **importCount vs readerCount** - `readerCount` is incremented for ANY reader (Epic 6 model), `importCount` is specific to community imports (Epic 9 model). Both should be incremented for community imports to maintain backwards compatibility

3. **Folder naming** - Use sender's display name (name if available, otherwise email prefix) matching the pattern from Story 9.3

4. **Selection state** - Manage selection in parent component (community browse page) and pass down to cards as props. Don't store selection in card component local state

5. **Batch efficiency** - The `bulkImportFromCommunity` mutation pre-fetches user's existing newsletters, settings, and folders to avoid N+1 queries during the batch loop

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None

### Completion Notes List

1. **Task 1-2: Updated `addToCollection` mutation** - Modified to set `source: "community"`, assign `folderId` using folder auto-creation pattern, increment both `readerCount` and `importCount`, and return `folderName` in response.

2. **Task 3: Created `bulkImportFromCommunity` mutation** - New mutation that accepts array of contentIds (max 50), processes imports with batch optimization (one folder per sender), and returns detailed results with imported/skipped/failed counts.

3. **Task 4: Updated `CommunityNewsletterPreviewModal`** - Added FolderOpen and Check icons, enhanced toast messages to show folder name, changed button to show "In Your Collection" when already owned.

4. **Task 5: Created `BulkImportBar` component** - Floating action bar component that shows selected count, import progress, completion summary, and clear selection action.

5. **Task 6: Updated `CommunityNewsletterCard`** - Added selection mode props (selectionMode, isSelected, onSelectionChange), added quick import button (onQuickImport prop), checkbox for bulk selection, and "In Collection" badge when owned.

6. **Task 7: Tests written** - Backend tests added to community.test.ts, BulkImportBar.test.tsx created (8 tests including error and loading state tests), CommunityNewsletterCard.test.tsx updated with Story 9.9 contract tests (12 Story 9.9 tests). All Story 9.9 tests pass.

### Test Results

- Backend: community.test.ts includes Story 9.9 contract tests
- BulkImportBar.test.tsx: 8 tests (added error handling and loading state tests)
- CommunityNewsletterCard.test.tsx: 12 Story 9.9-specific contract tests

### File List

**Modified:**
- `packages/backend/convex/community.ts` - Updated `addToCollection`, added `bulkImportFromCommunity`
- `packages/backend/convex/community.test.ts` - Added Story 9.9 test contracts
- `apps/web/src/components/CommunityNewsletterPreviewModal.tsx` - Enhanced import flow
- `apps/web/src/components/CommunityNewsletterCard.tsx` - Selection mode, quick import
- `apps/web/src/components/CommunityNewsletterCard.test.tsx` - Story 9.9 contract tests
- `apps/web/src/routes/_authed/community/index.tsx` - Selection mode, bulk import integration

**Created:**
- `apps/web/src/components/BulkImportBar.tsx` - Floating bulk import action bar
- `apps/web/src/components/BulkImportBar.test.tsx` - BulkImportBar tests

## Senior Developer Review (AI)

### Review Date: 2026-02-01

### Issues Found and Fixed

**HIGH Issues Fixed:**
1. **BulkImportBar fake progress** - Removed misleading progress bar that jumped 10%→100%. Now shows spinner with item count ("Importing X newsletters...") for honest UX.
2. **Duplicate comment in community.ts** - Removed duplicate "Track created folders" comment at line 984-985.
3. **Missing error test** - Added test for bulk import error handling (`shows error toast when bulk import fails`).
4. **Missing loading state test** - Added test verifying loading message shows correct count (`shows loading state with item count during import`).

**MEDIUM Issues Fixed:**
1. **Magic number for batch limit** - Added `MAX_BULK_IMPORT_BATCH = 50` constant and updated error message to use it.
2. **Test count documentation** - Updated story to reflect accurate test counts (8 BulkImportBar tests, 12 Story 9.9 CommunityNewsletterCard tests).

**LOW Issues Fixed:**
1. **Removed console.error** - Removed `console.error` from BulkImportBar (production code shouldn't use console).

### Issues Noted (Not Fixed)
- CommunityNewsletterCard tests are contract/documentation tests per project pattern (component render tests require TanStack Router setup).
- PreviewModal uses useState for isImporting which is correct for Convex (useMutation doesn't expose isPending).

### Review Outcome: APPROVED with fixes applied

### Change Log Entry
- 2026-02-01: Code review fixes applied - removed fake progress, added missing tests, fixed duplicate comment, added batch limit constant
