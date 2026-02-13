import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import { Tabs, TabsList, TabsTrigger, ScrollArea } from "@hushletter/ui";
import { cn } from "@/lib/utils";
import { EyeOff, AlertCircle } from "lucide-react";
import { SenderFolderItem } from "./SenderFolderItem";
import { NewsletterListItem } from "./NewsletterListItem";
import type { FolderData } from "@/components/FolderSidebar";
import type { NewsletterData } from "@/components/NewsletterCard";
import { m } from "@/paraglide/messages.js";

type SidebarFilter = "all" | "unread" | "starred";

const FILTER_HIDDEN = "hidden" as const;
const FILTER_STARRED = "starred" as const;
type FilterType = typeof FILTER_HIDDEN | typeof FILTER_STARRED;

interface SenderFolderSidebarProps {
  selectedFolderId: string | null;
  selectedNewsletterId: string | null;
  selectedFilter: FilterType | null;
  hiddenNewsletters: NewsletterData[];
  hiddenPending: boolean;
  favoritedNewsletters: NewsletterData[];
  favoritedPending: boolean;
  onFolderSelect: (folderId: string | null) => void;
  onNewsletterSelect: (newsletterId: string) => void;
  onFilterSelect: (filter: FilterType | null) => void;
  getIsFavorited: (newsletterId: string, serverValue?: boolean) => boolean;
  isFavoritePending: (newsletterId: string) => boolean;
  onToggleFavorite: (newsletterId: string, currentValue: boolean) => Promise<void>;
}

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

function SidebarSkeleton() {
  return (
    <div className="p-3 space-y-2">
      <div className="h-9 bg-muted rounded-md animate-pulse" />
      <div className="h-px bg-border my-2" />
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="h-10 bg-muted rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

/**
 * Sender folder sidebar with filter tabs and expandable folders.
 * Replaces the old FolderSidebar with a richer, nested design.
 */
export function SenderFolderSidebar({
  selectedFolderId,
  selectedNewsletterId,
  selectedFilter,
  hiddenNewsletters,
  hiddenPending,
  favoritedNewsletters,
  favoritedPending,
  onFolderSelect,
  onNewsletterSelect,
  onFilterSelect,
  getIsFavorited,
  isFavoritePending,
  onToggleFavorite,
}: SenderFolderSidebarProps) {
  const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>(
    selectedFilter === FILTER_STARRED ? "starred" : "all",
  );
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(
    () => new Set(),
  );

  const {
    data: folders,
    isPending: foldersPending,
    isError: foldersError,
  } = useQuery(convexQuery(api.folders.listVisibleFoldersWithUnreadCounts, {}));

  const { data: hiddenCount, isPending: hiddenCountPending } = useQuery(
    convexQuery(api.newsletters.getHiddenNewsletterCount, {}),
  );

  const folderList = useMemo(() => {
    if (!folders) return [];
    return (folders as unknown[]).filter(isFolderData);
  }, [folders]);

  useEffect(() => {
    setExpandedFolderIds((previous) => {
      if (previous.size === 0) return previous;

      const visibleFolderIds = new Set(folderList.map((folder) => folder._id));
      const next = new Set(
        [...previous].filter((folderId) => visibleFolderIds.has(folderId)),
      );

      return next.size === previous.size ? previous : next;
    });
  }, [folderList]);

  // Filter folders based on sidebar tab
  const filteredFolders = useMemo(() => {
    if (sidebarFilter === "unread") {
      return folderList.filter((f) => f.unreadCount > 0);
    }
    return folderList;
  }, [folderList, sidebarFilter]);

  const visibleFavoritedNewsletters = useMemo(
    () =>
      favoritedNewsletters.filter((newsletter) =>
        getIsFavorited(newsletter._id, Boolean(newsletter.isFavorited)),
      ),
    [favoritedNewsletters, getIsFavorited],
  );

  const visibleHiddenNewsletters = useMemo(
    () => hiddenNewsletters,
    [hiddenNewsletters],
  );

  useEffect(() => {
    if (selectedFilter === FILTER_STARRED) {
      setSidebarFilter("starred");
      return;
    }
    setSidebarFilter((current) => (current === "starred" ? "all" : current));
  }, [selectedFilter]);

  const handleHiddenClick = () => {
    if (selectedFilter === FILTER_HIDDEN) {
      onFilterSelect(null);
      return;
    }

    setSidebarFilter("all");
    onFolderSelect(null);
    onFilterSelect(FILTER_HIDDEN);
  };

  const handleTabChange = (value: SidebarFilter) => {
    setSidebarFilter(value);

    if (value === "starred") {
      onFolderSelect(null);
      onFilterSelect(FILTER_STARRED);
      return;
    }

    if (selectedFilter === FILTER_STARRED || selectedFilter === FILTER_HIDDEN) {
      onFilterSelect(null);
    }
  };

  const handleFolderExpandedChange = (folderId: string, expanded: boolean) => {
    setExpandedFolderIds((previous) => {
      const next = new Set(previous);
      if (expanded) {
        next.add(folderId);
      } else {
        next.delete(folderId);
      }
      return next;
    });
  };

  if (foldersError) {
    return (
      <aside
        className="w-[300px] border-r bg-background"
        role="navigation"
        aria-label={m.newsletters_folderNavigation()}
      >
        <div className="flex items-center gap-2 text-destructive text-sm p-4">
          <AlertCircle className="h-4 w-4" />
          <span>{m.folder_loadError()}</span>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="w-[300px] border-r bg-background flex flex-col"
      role="navigation"
      aria-label={m.newsletters_folderNavigation()}
    >
      {/* Header */}
      <div className="p-3 pb-0">
        <h2 className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase px-2 mb-2">
          {m.sidebar_senderFolders()}
        </h2>

        {/* Filter tabs */}
        <Tabs value={sidebarFilter} onValueChange={(val) => handleTabChange(val as SidebarFilter)}>
          <TabsList className="w-full h-8">
            <TabsTrigger value="all" className="flex-1 text-xs h-7">
              {m.sidebar_filterAll()}
            </TabsTrigger>
            <TabsTrigger value="unread" className="flex-1 text-xs h-7">
              {m.sidebar_filterUnread()}
            </TabsTrigger>
            <TabsTrigger value="starred" className="flex-1 text-xs h-7">
              {m.sidebar_filterStarred()}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Folder list */}
      <ScrollArea className="flex-1 mt-2">
        <div className="px-2 pb-2 space-y-0.5">
          {selectedFilter === FILTER_HIDDEN ? (
            hiddenPending ? (
              <SidebarSkeleton />
            ) : visibleHiddenNewsletters.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8 px-4">
                {m.newsletters_noHiddenNewsletters()}
              </p>
            ) : (
              <div className="space-y-0.5">
                {visibleHiddenNewsletters.map((newsletter) => (
                  <NewsletterListItem
                    key={newsletter._id}
                    newsletter={newsletter}
                    isSelected={selectedNewsletterId === newsletter._id}
                    isFavorited={getIsFavorited(
                      newsletter._id,
                      Boolean(newsletter.isFavorited),
                    )}
                    isFavoritePending={isFavoritePending(newsletter._id)}
                    onClick={onNewsletterSelect}
                    onToggleFavorite={onToggleFavorite}
                  />
                ))}
              </div>
            )
          ) : sidebarFilter === "starred" ? (
            favoritedPending ? (
              <SidebarSkeleton />
            ) : visibleFavoritedNewsletters.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8 px-4">
                {m.newsletters_noStarredNewsletters()}
              </p>
            ) : (
              <div className="space-y-0.5">
                {visibleFavoritedNewsletters.map((newsletter) => (
                  <NewsletterListItem
                    key={newsletter._id}
                    newsletter={newsletter}
                    isSelected={selectedNewsletterId === newsletter._id}
                    isFavorited={getIsFavorited(
                      newsletter._id,
                      Boolean(newsletter.isFavorited),
                    )}
                    isFavoritePending={isFavoritePending(newsletter._id)}
                    onClick={onNewsletterSelect}
                    onToggleFavorite={onToggleFavorite}
                  />
                ))}
              </div>
            )
          ) : foldersPending ? (
            <SidebarSkeleton />
          ) : filteredFolders.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8 px-4">
              {sidebarFilter === "unread"
                ? "All caught up!"
                : m.folder_emptyState()}
            </p>
          ) : (
            filteredFolders.map((folder) => (
              <SenderFolderItem
                key={folder._id}
                folder={folder}
                isSelected={selectedFolderId === folder._id}
                selectedNewsletterId={selectedNewsletterId}
                sidebarFilter={sidebarFilter}
                isExpanded={expandedFolderIds.has(folder._id)}
                onExpandedChange={(expanded) =>
                  handleFolderExpandedChange(folder._id, expanded)
                }
                onFolderSelect={(id) => {
                  onFilterSelect(null);
                  onFolderSelect(id);
                }}
                onNewsletterSelect={onNewsletterSelect}
                getIsFavorited={getIsFavorited}
                isFavoritePending={isFavoritePending}
                onToggleFavorite={onToggleFavorite}
                onHideSuccess={() => {
                  if (selectedFolderId === folder._id) {
                    onFolderSelect(null);
                  }
                }}
              />
            ))
          )}

          {/* Hidden section */}
          {!hiddenCountPending && ((hiddenCount ?? 0) > 0 || selectedFilter === FILTER_HIDDEN) && (
            <>
              <div className="h-px bg-border my-2 mx-2" role="separator" />
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
                  <EyeOff
                    className="h-4 w-4 flex-shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="truncate">{m.folder_hidden()}</span>
                </div>
                <span className="text-muted-foreground text-xs flex-shrink-0">
                  {hiddenCount ?? visibleHiddenNewsletters.length}
                </span>
              </button>
            </>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
