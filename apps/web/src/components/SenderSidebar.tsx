import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@newsletter-manager/backend"
import { cn } from "~/lib/utils"
import { FolderIcon } from "lucide-react"

/**
 * Sender data from listSendersForUserWithUnreadCounts query
 */
export interface SenderData {
  _id: string
  email: string
  name?: string
  displayName: string
  domain: string
  userNewsletterCount: number
  unreadCount: number
  isPrivate: boolean
  folderId?: string
}

/**
 * Folder data from listFoldersWithUnreadCounts query
 * Story 3.3: Task 1.1
 */
export interface FolderData {
  _id: string
  userId: string
  name: string
  color?: string
  createdAt: number
  newsletterCount: number
  unreadCount: number
  senderCount: number
}

interface SenderSidebarProps {
  selectedSenderId: string | null
  selectedFolderId: string | null
  onSenderSelect: (senderId: string | null) => void
  onFolderSelect: (folderId: string | null) => void
  totalNewsletterCount: number
  totalUnreadCount: number
}

/**
 * Loading skeleton for SenderSidebar
 * Task 2: Shows while sender data is loading
 */
export function SenderSidebarSkeleton() {
  return (
    <aside className="w-64 border-r bg-background p-4 space-y-1">
      <div className="h-10 bg-muted rounded-lg animate-pulse" />
      <div className="h-px bg-border my-2" />
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-8 bg-muted rounded-lg animate-pulse" />
      ))}
      <div className="h-px bg-border my-2" />
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-10 bg-muted rounded-lg animate-pulse" />
      ))}
    </aside>
  )
}

/**
 * SenderSidebar - Navigation sidebar listing folders and senders
 * Story 3.1: Task 1-3 (AC1, AC2, AC3, AC4)
 * Story 3.3: Task 1 (AC4, AC5) - Added folder section
 *
 * Features:
 * - "All Newsletters" item at top with total count
 * - Folder section with unread indicators (Story 3.3)
 * - "Uncategorized" virtual folder (Story 3.3 AC5)
 * - Alphabetically sorted sender list
 * - Newsletter count badges per sender
 * - Subtle unread indicators (UX compliant - not anxiety-inducing)
 * - Visual highlighting for selected item
 */
export function SenderSidebar({
  selectedSenderId,
  selectedFolderId,
  onSenderSelect,
  onFolderSelect,
  totalNewsletterCount,
  totalUnreadCount,
}: SenderSidebarProps) {
  // Real-time subscription to senders with unread counts
  const { data: senders, isPending: sendersPending } = useQuery(
    convexQuery(api.senders.listSendersForUserWithUnreadCounts, {})
  )

  // Real-time subscription to folders with unread counts
  // Story 3.3 Task 1.1
  const { data: folders, isPending: foldersPending } = useQuery(
    convexQuery(api.folders.listFoldersWithUnreadCounts, {})
  )

  // Calculate uncategorized counts (senders without folderId)
  // Story 3.3 AC5
  const uncategorizedStats = useMemo(() => {
    if (!senders) return { newsletterCount: 0, unreadCount: 0 }
    const senderList = senders as SenderData[]
    const uncategorizedSenders = senderList.filter((s) => !s.folderId)
    return uncategorizedSenders.reduce(
      (acc, sender) => ({
        newsletterCount: acc.newsletterCount + sender.userNewsletterCount,
        unreadCount: acc.unreadCount + sender.unreadCount,
      }),
      { newsletterCount: 0, unreadCount: 0 }
    )
  }, [senders])

  if (sendersPending || foldersPending) return <SenderSidebarSkeleton />

  const senderList = (senders ?? []) as SenderData[]
  const folderList = (folders ?? []) as FolderData[]

  // Check if nothing is selected (show "All Newsletters" as active)
  const isAllSelected = !selectedSenderId && !selectedFolderId

  // Handle "All Newsletters" click - clear both filters
  const handleAllClick = () => {
    onSenderSelect(null)
    onFolderSelect(null)
  }

  // Handle folder click - clear sender filter, set folder filter
  // Story 3.3 Task 1.5
  const handleFolderClick = (folderId: string | null) => {
    onSenderSelect(null) // Clear sender filter
    onFolderSelect(folderId)
  }

  // Handle sender click - clear folder filter, set sender filter
  const handleSenderClick = (senderId: string) => {
    onFolderSelect(null) // Clear folder filter
    onSenderSelect(senderId)
  }

  return (
    <aside className="w-64 border-r bg-background p-4 space-y-1 overflow-y-auto">
      {/* "All Newsletters" item - Task 3 (AC3) */}
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
          {/* Subtle unread indicator (UX compliant) */}
          {totalUnreadCount > 0 && (
            <span
              className="h-2 w-2 rounded-full bg-primary/60"
              aria-label={`${totalUnreadCount} unread`}
            />
          )}
          <span className="text-muted-foreground text-xs">
            {totalNewsletterCount}
          </span>
        </div>
      </button>

      {/* Folder section - Story 3.3 Task 1.2 (AC4) */}
      {(folderList.length > 0 || uncategorizedStats.newsletterCount > 0) && (
        <>
          <div className="h-px bg-border my-2" />

          {/* User folders */}
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
                {/* Story 3.3 Task 1.3: Unread count badge */}
                {folder.unreadCount > 0 && (
                  <span
                    className="h-2 w-2 rounded-full bg-primary/60"
                    aria-label={`${folder.unreadCount} unread in ${folder.name}`}
                  />
                )}
                <span className="text-muted-foreground text-xs">
                  {folder.newsletterCount}
                </span>
              </div>
            </button>
          ))}

          {/* Uncategorized virtual folder - Story 3.3 Task 1.4 (AC5) */}
          {uncategorizedStats.newsletterCount > 0 && (
            <button
              onClick={() => handleFolderClick("uncategorized")}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm",
                "hover:bg-accent transition-colors text-left",
                selectedFolderId === "uncategorized" && "bg-accent font-medium"
              )}
            >
              <div className="flex items-center gap-2 truncate flex-1 mr-2">
                <FolderIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span className="truncate">Uncategorized</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {uncategorizedStats.unreadCount > 0 && (
                  <span
                    className="h-2 w-2 rounded-full bg-primary/60"
                    aria-label={`${uncategorizedStats.unreadCount} unread in Uncategorized`}
                  />
                )}
                <span className="text-muted-foreground text-xs">
                  {uncategorizedStats.newsletterCount}
                </span>
              </div>
            </button>
          )}
        </>
      )}

      <div className="h-px bg-border my-2" />

      {/* Sender list - Task 1 (AC1, AC2, AC4) */}
      {senderList.map((sender) => (
        <button
          key={sender._id}
          onClick={() => handleSenderClick(sender._id)}
          className={cn(
            "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm",
            "hover:bg-accent transition-colors text-left",
            selectedSenderId === sender._id && "bg-accent font-medium"
          )}
        >
          <span className="truncate flex-1 mr-2">{sender.displayName}</span>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Subtle unread indicator (UX compliant - not anxiety-inducing) */}
            {sender.unreadCount > 0 && (
              <span
                className="h-2 w-2 rounded-full bg-primary/60"
                aria-label={`${sender.unreadCount} unread from ${sender.displayName}`}
              />
            )}
            <span className="text-muted-foreground text-xs">
              {sender.userNewsletterCount}
            </span>
          </div>
        </button>
      ))}

      {/* Empty state when no senders */}
      {senderList.length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-4">
          No senders yet
        </p>
      )}
    </aside>
  )
}
