import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import { Skeleton } from "@hushletter/ui";
import { cn } from "@/lib/utils";
import { FolderIcon, EyeOff, AlertCircle, Star } from "lucide-react";
import { FolderActionsDropdown } from "./FolderActionsDropdown";
import { m } from "@/paraglide/messages.js";

/**
 * Folder data from listVisibleFoldersWithUnreadCounts query
 * Story 9.4: Folder-centric navigation
 *
 * Note: This interface should match the return type of the Convex query.
 * Ideally we'd derive this from FunctionReturnType, but Convex types
 * aren't directly exported. Keep in sync with folders.ts.
 */
export interface FolderData {
  _id: string;
  userId: string;
  name: string;
  color?: string;
  isHidden: boolean;
  createdAt: number;
  updatedAt: number;
  newsletterCount: number;
  unreadCount: number;
  senderCount: number;
}

/** Type guard to validate folder data at runtime */
function isFolderData(item: unknown): item is FolderData {
  if (typeof item !== "object" || item === null) return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj._id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.newsletterCount === "number" &&
    typeof obj.unreadCount === "number"
  );
}

/** Filter type constant */
const FILTER_HIDDEN = "hidden" as const;
const FILTER_STARRED = "starred" as const;
type FilterType = typeof FILTER_HIDDEN | typeof FILTER_STARRED;

interface FolderSidebarProps {
  selectedFolderId: string | null;
  selectedFilter: FilterType | null; // "hidden" for hidden newsletters
  onFolderSelect: (folderId: string | null) => void;
  onFilterSelect: (filter: FilterType | null) => void;
}

/**
 * Loading skeleton for FolderSidebar
 * Story 9.4: Task 1.8
 */
export function FolderSidebarSkeleton() {
  return (
    <aside className="w-64 border-r bg-background p-4 space-y-1">
      {/* "All Newsletters" row */}
      <div className="flex items-center justify-between px-3 py-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-6" />
      </div>
      <div className="h-px bg-border my-2" />
      {/* Folder rows */}
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-2 px-3 py-2">
          <Skeleton className="h-4 w-4 rounded-sm shrink-0" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-3 w-5" />
        </div>
      ))}
    </aside>
  );
}

/**
 * FolderSidebar - Folder-centric navigation sidebar
 * Story 9.4: AC1, AC2, AC3 - Primary navigation by folders
 *
 * Features:
 * - "All Newsletters" at top (aggregate across visible folders)
 * - Folder list (visible folders only, sorted alphabetically)
 * - Each folder shows unread indicator and newsletter count
 * - "Hidden" section at bottom (count of hidden newsletters)
 *
 * Key differences from SenderSidebar:
 * - No individual sender list in sidebar (senders shown in folder detail view)
 * - No "Uncategorized" virtual folder (all newsletters have folders in Epic 9)
 * - No "Following" section (community features moved)
 */
export function FolderSidebar({
  selectedFolderId,
  selectedFilter,
  onFolderSelect,
  onFilterSelect,
}: FolderSidebarProps) {
  // Fetch visible folders only (excludes isHidden === true)
  // Story 9.4 Task 2.2
  const {
    data: folders,
    isPending: foldersPending,
    isError: foldersError,
  } = useQuery(convexQuery(api.folders.listVisibleFoldersWithUnreadCounts, {}));

  // Fetch hidden newsletter count (for "Hidden" section)
  // Story 9.4 Task 2.3
  const { data: hiddenCount, isPending: hiddenPending } = useQuery(
    convexQuery(api.newsletters.getHiddenNewsletterCount, {}),
  );

  const { data: favoritedCount, isPending: favoritedCountPending } = useQuery(
    convexQuery(api.newsletters.getFavoritedNewsletterCount, {}),
  );

  // Code review fix: Validate folder data at runtime to ensure type safety
  const folderList = useMemo(() => {
    if (!folders) return [];
    return (folders as unknown[]).filter(isFolderData);
  }, [folders]);

  // Calculate totals for "All Newsletters" (across visible folders only)
  const { totalNewsletterCount, totalUnreadCount } = useMemo(() => {
    return folderList.reduce(
      (acc, folder) => ({
        totalNewsletterCount: acc.totalNewsletterCount + folder.newsletterCount,
        totalUnreadCount: acc.totalUnreadCount + folder.unreadCount,
      }),
      { totalNewsletterCount: 0, totalUnreadCount: 0 },
    );
  }, [folderList]);

  // Code review fix: Handle error state
  if (foldersError) {
    return (
      <aside
        className="w-64 border-r bg-background p-4"
        role="navigation"
        aria-label={m.newsletters_folderNavigation()}
      >
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <span>{m.folder_loadError()}</span>
        </div>
      </aside>
    );
  }

  if (foldersPending) return <FolderSidebarSkeleton />;

  const isAllSelected = !selectedFolderId && !selectedFilter;
  const starredCount =
    typeof favoritedCount === "number" ? favoritedCount : 0;

  // Handle "All Newsletters" click - clear all filters
  const handleAllClick = () => {
    onFolderSelect(null);
    onFilterSelect(null);
  };

  // Handle folder click - clear special filters, set folder filter
  const handleFolderClick = (folderId: string) => {
    onFilterSelect(null);
    onFolderSelect(folderId);
  };

  // Handle "Hidden" filter click
  const handleHiddenClick = () => {
    onFolderSelect(null);
    onFilterSelect(FILTER_HIDDEN);
  };

  const handleStarredClick = () => {
    onFolderSelect(null);
    onFilterSelect(FILTER_STARRED);
  };

  return (
    <aside
      className="w-64 border-r bg-background p-4 space-y-1 overflow-y-auto"
      role="navigation"
      aria-label={m.newsletters_folderNavigation()}
    >
      {/* "All Newsletters" item - Story 9.4 Task 1.5 */}
      <button
        onClick={handleAllClick}
        aria-current={isAllSelected ? "page" : undefined}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm",
          "hover:bg-accent transition-colors",
          isAllSelected && "bg-accent font-medium",
        )}
      >
        <span>{m.folder_allNewsletters()}</span>
        <div className="flex items-center gap-2">
          {/* Subtle unread indicator (UX compliant) */}
          {totalUnreadCount > 0 && (
            <span
              className="h-2 w-2 rounded-full bg-primary/60"
              role="status"
              aria-label={m.folder_unreadCount({ count: totalUnreadCount })}
            />
          )}
          <span className="text-muted-foreground text-xs">{totalNewsletterCount}</span>
        </div>
      </button>

      <div className="h-px bg-border my-2" role="separator" />

      {/* Folder list - Primary navigation - Story 9.4 Task 1.1-1.4, Story 9.5 Task 4.2 */}
      <ul role="list" className="space-y-1">
        {folderList.map((folder) => (
          <li key={folder._id} className="group relative">
            {/* Wrapper div instead of button to avoid nested buttons with dropdown */}
            <div
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm",
                "hover:bg-accent transition-colors text-left cursor-pointer",
                selectedFolderId === folder._id && "bg-accent font-medium",
              )}
            >
              {/* Main clickable area - triggers folder selection */}
              <button
                onClick={() => handleFolderClick(folder._id)}
                aria-current={selectedFolderId === folder._id ? "page" : undefined}
                className="flex items-center gap-2 truncate flex-1 mr-2 bg-transparent border-none p-0 text-left cursor-pointer"
              >
                <FolderIcon
                  className="h-4 w-4 flex-shrink-0 text-muted-foreground"
                  aria-hidden="true"
                  data-testid="folder-icon"
                />
                <span className="truncate">{folder.name}</span>
              </button>
              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Story 9.4 AC2: Unread count indicator */}
                {folder.unreadCount > 0 && (
                  <span
                    className="h-2 w-2 rounded-full bg-primary/60"
                    role="status"
                    aria-label={m.folder_unreadInFolder({ count: folder.unreadCount, name: folder.name })}
                  />
                )}
                <span className="text-muted-foreground text-xs group-hover:hidden">
                  {folder.newsletterCount}
                </span>
                {/* Story 9.5: Folder actions dropdown - appears on hover */}
                <FolderActionsDropdown
                  folderId={folder._id}
                  folderName={folder.name}
                  onHideSuccess={() => {
                    // If hidden folder was selected, clear selection
                    if (selectedFolderId === folder._id) {
                      onFolderSelect(null);
                    }
                  }}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Empty state when no folders - Story 9.4 Task 6.1 */}
      {folderList.length === 0 && (
        <p className="text-muted-foreground text-sm text-center py-4">
          {m.folder_emptyState()}
        </p>
      )}

      {/* Starred section */}
      {favoritedCountPending ? (
        <div className="flex items-center gap-2 px-3 py-2 mt-2">
          <Skeleton className="h-4 w-4 rounded-sm shrink-0" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ) : (
        <>
          <div className="h-px bg-border my-2" role="separator" />
          <button
            onClick={handleStarredClick}
            aria-current={selectedFilter === FILTER_STARRED ? "page" : undefined}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm",
              "hover:bg-accent transition-colors text-left",
              selectedFilter === FILTER_STARRED && "bg-accent font-medium",
            )}
          >
            <div className="flex items-center gap-2 truncate flex-1 mr-2">
              <Star
                className="h-4 w-4 flex-shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="truncate">{m.sidebar_filterStarred()}</span>
            </div>
            <span className="text-muted-foreground text-xs flex-shrink-0">
              {starredCount}
            </span>
          </button>
        </>
      )}

      {/* Hidden section - Story 9.4 Task 1.6 (AC3) */}
      {hiddenPending ? (
        <div className="flex items-center gap-2 px-3 py-2 mt-2">
          <Skeleton className="h-4 w-4 rounded-sm shrink-0" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ) : (hiddenCount ?? 0) > 0 ? (
        <>
          <div className="h-px bg-border my-2" role="separator" />
          <button
            onClick={handleHiddenClick}
            aria-current={selectedFilter === "hidden" ? "page" : undefined}
            className={cn(
              "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm",
              "hover:bg-accent transition-colors text-left",
              selectedFilter === "hidden" && "bg-accent font-medium",
            )}
          >
            <div className="flex items-center gap-2 truncate flex-1 mr-2">
              <EyeOff className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{m.folder_hidden()}</span>
            </div>
            <span className="text-muted-foreground text-xs flex-shrink-0">{hiddenCount}</span>
          </button>
        </>
      ) : null}
    </aside>
  );
}
