import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { useAction } from "convex/react";
import { api } from "@hushletter/backend";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  ScrollArea,
  Button,
  Skeleton,
} from "@hushletter/ui";
import { cn } from "@/lib/utils";
import { EyeOff, AlertCircle } from "lucide-react";
import { SenderFolderItem } from "./SenderFolderItem";
import { NewsletterListItem } from "./NewsletterListItem";
import type { FolderData } from "@/components/FolderSidebar";
import type { NewsletterData } from "@/components/NewsletterCard";
import { m } from "@/paraglide/messages.js";
import { SidebarFooter } from "./SidebarFooter";

type SidebarFilter = "all" | "unread" | "starred";

const FILTER_HIDDEN = "hidden" as const;
const FILTER_STARRED = "starred" as const;
const LAST_NEWSLETTERS_VISIT_KEY = "hushletter:lastNewslettersVisit";
const RECENT_UNREAD_HEAD_SIZE = 8;
const RECENT_UNREAD_PAGE_SIZE = 20;
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
  onToggleFavorite: (
    newsletterId: string,
    currentValue: boolean,
  ) => Promise<void>;
  canLoadMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
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
      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
        <Skeleton className="h-7 flex-1 rounded-md" />
        <Skeleton className="h-7 flex-1 rounded-md" />
        <Skeleton className="h-7 flex-1 rounded-md" />
      </div>

      {/* Folder items */}
      <div className="space-y-1 pt-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 px-2 py-2.5">
            <Skeleton className="size-8 rounded-lg shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-2.5 w-16" />
            </div>
            <Skeleton className="h-5 w-5 rounded-full" />
          </div>
        ))}
      </div>
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
  canLoadMore,
  isLoadingMore,
  onLoadMore,
}: SenderFolderSidebarProps) {
  const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>(
    selectedFilter === FILTER_STARRED ? "starred" : "all",
  );
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [lastConnectedAt, setLastConnectedAt] = useState<number | undefined>(
    undefined,
  );
  const [isLastConnectedReady, setIsLastConnectedReady] = useState(false);
  const [recentTailPages, setRecentTailPages] = useState<NewsletterData[][]>(
    [],
  );
  const [recentCursor, setRecentCursor] = useState<string | null>(null);
  const [recentIsDone, setRecentIsDone] = useState(true);
  const [recentIsLoadingMore, setRecentIsLoadingMore] = useState(false);
  const [dismissedRecentNewsletterIds, setDismissedRecentNewsletterIds] =
    useState<Set<string>>(() => new Set());
  const recentLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const recentSectionRef = useRef<HTMLDivElement | null>(null);
  const loadRecentUnreadPage = useAction(
    api.newsletters.listRecentUnreadNewslettersPage,
  );

  const {
    data: folders,
    isPending: foldersPending,
    isError: foldersError,
  } = useQuery(convexQuery(api.folders.listVisibleFoldersWithUnreadCounts, {}));

  // When a newsletter is open via `?newsletter=...` (without `?folder=...`),
  // fetch its metadata so we can highlight the corresponding sender folder row.
  const { data: selectedNewsletterMeta } = useQuery(
    convexQuery(
      api.newsletters.getUserNewsletter,
      selectedNewsletterId
        ? { userNewsletterId: selectedNewsletterId as Id<"userNewsletters"> }
        : "skip",
    ),
  );

  const { data: hiddenCount, isPending: hiddenCountPending } = useQuery(
    convexQuery(api.newsletters.getHiddenNewsletterCount, {}),
  );
  const shouldShowRecentSection =
    sidebarFilter === "all" &&
    selectedFilter !== FILTER_HIDDEN &&
    selectedFilter !== FILTER_STARRED;

  const { data: recentUnreadHead, isPending: recentUnreadPending } = useQuery(
    convexQuery(
      api.newsletters.listRecentUnreadNewslettersHead,
      shouldShowRecentSection && isLastConnectedReady
        ? {
            lastConnectedAt,
            numItems: RECENT_UNREAD_HEAD_SIZE,
          }
        : "skip",
    ),
  );

  const folderList = useMemo(() => {
    if (!folders) return [];
    return (folders as unknown[]).filter(isFolderData);
  }, [folders]);

  const selectedNewsletterFolderId = useMemo(() => {
    const folderId = (
      selectedNewsletterMeta as { folderId?: unknown } | null | undefined
    )?.folderId;
    return typeof folderId === "string" ? folderId : null;
  }, [selectedNewsletterMeta]);

  const effectiveSelectedFolderId =
    selectedFolderId ?? selectedNewsletterFolderId ?? null;

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
  const recentHeadPage = useMemo(() => {
    const data = recentUnreadHead as unknown as
      | { page?: NewsletterData[] }
      | undefined;
    return (data?.page ?? []) as NewsletterData[];
  }, [recentUnreadHead]);

  const recentUnreadNewsletters = useMemo(() => {
    const merged: NewsletterData[] = [];
    const seen = new Set<string>();
    for (const newsletter of [...recentHeadPage, ...recentTailPages.flat()]) {
      const id = String(newsletter._id);
      if (seen.has(id)) continue;
      seen.add(id);
      if (newsletter.isRead) continue;
      if (dismissedRecentNewsletterIds.has(id)) continue;
      merged.push(newsletter);
    }
    return merged;
  }, [recentHeadPage, recentTailPages, dismissedRecentNewsletterIds]);

  const hasRecentUnreadSection = shouldShowRecentSection
    ? recentUnreadPending || recentUnreadNewsletters.length > 0
    : false;

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

  useEffect(() => {
    let previousVisit: number | undefined;
    try {
      const rawValue = localStorage.getItem(LAST_NEWSLETTERS_VISIT_KEY);
      if (rawValue) {
        const parsed = Number(rawValue);
        if (Number.isFinite(parsed) && parsed > 0) {
          previousVisit = parsed;
        }
      }
      localStorage.setItem(LAST_NEWSLETTERS_VISIT_KEY, String(Date.now()));
    } catch {
      // localStorage unavailable
    }
    setLastConnectedAt(previousVisit);
    setIsLastConnectedReady(true);
  }, []);

  useEffect(() => {
    if (!shouldShowRecentSection) {
      setRecentTailPages([]);
      setRecentCursor(null);
      setRecentIsDone(true);
      setRecentIsLoadingMore(false);
      setDismissedRecentNewsletterIds(new Set());
      return;
    }
    setRecentTailPages([]);
    setRecentCursor(null);
    setRecentIsDone(true);
    setRecentIsLoadingMore(false);
    setDismissedRecentNewsletterIds(new Set());
  }, [shouldShowRecentSection, lastConnectedAt, isLastConnectedReady]);

  const handleDismissRecentNewsletter = useCallback((newsletterId: string) => {
    setDismissedRecentNewsletterIds((previous) => {
      if (previous.has(newsletterId)) return previous;
      const next = new Set(previous);
      next.add(newsletterId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (
      !shouldShowRecentSection ||
      !isLastConnectedReady ||
      !recentUnreadHead
    ) {
      return;
    }
    if (recentCursor !== null || recentTailPages.length > 0) return;
    const data = recentUnreadHead as unknown as {
      continueCursor: string | null;
      isDone: boolean;
    };
    setRecentCursor(data.continueCursor ?? null);
    setRecentIsDone(data.isDone ?? true);
  }, [
    shouldShowRecentSection,
    isLastConnectedReady,
    recentUnreadHead,
    recentCursor,
    recentTailPages.length,
  ]);

  const canLoadMoreRecent =
    shouldShowRecentSection && !recentIsDone && recentCursor !== null;

  const handleLoadMoreRecent = useCallback(async () => {
    if (!canLoadMoreRecent || recentIsLoadingMore || recentCursor === null)
      return;
    setRecentIsLoadingMore(true);
    try {
      const result = await loadRecentUnreadPage({
        cursor: recentCursor,
        numItems: RECENT_UNREAD_PAGE_SIZE,
        lastConnectedAt,
      });
      const page = (result.page ?? []) as NewsletterData[];
      setRecentTailPages((previous) => [...previous, page]);
      setRecentCursor(result.continueCursor ?? null);
      setRecentIsDone(result.isDone ?? true);
    } finally {
      setRecentIsLoadingMore(false);
    }
  }, [
    canLoadMoreRecent,
    recentIsLoadingMore,
    recentCursor,
    loadRecentUnreadPage,
    lastConnectedAt,
  ]);

  useEffect(() => {
    if (!canLoadMoreRecent) return;
    const sentinel = recentLoadMoreRef.current;
    const section = recentSectionRef.current;
    if (!sentinel || !section) return;

    const viewport = section.querySelector<HTMLElement>(
      "[data-slot='scroll-area-viewport']",
    );
    if (!viewport) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void handleLoadMoreRecent();
        }
      },
      { root: viewport, threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [canLoadMoreRecent, handleLoadMoreRecent]);

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
      <div className="p-2 pb-0">
        {/* <h2 className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase px-2 mb-2">
          {m.sidebar_senderFolders()}
        </h2> */}

        {/* Filter tabs */}
        <Tabs
          value={sidebarFilter}
          onValueChange={(val) => handleTabChange(val as SidebarFilter)}
        >
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
          {hasRecentUnreadSection && (
            <>
              <div className="px-2 py-1">
                <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {m.sidebar_recentUnreadSinceLastVisit()}
                </p>
              </div>

              <div
                ref={recentSectionRef}
                className="max-h-60 rounded-lg border border-border/70 bg-muted/20"
              >
                <ScrollArea className="h-full">
                  <div className="p-1 space-y-0.5">
                    {recentUnreadPending ? (
                      <div className="space-y-1 py-1">
                        {[0, 1, 2].map((index) => (
                          <div key={index} className="animate-pulse px-3 py-2">
                            <div className="h-3.5 bg-muted rounded w-4/5" />
                            <div className="h-3 bg-muted rounded w-1/2 mt-1" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      recentUnreadNewsletters.map((newsletter) => (
                        <NewsletterListItem
                          key={newsletter._id}
                          newsletter={newsletter}
                          isSelected={selectedNewsletterId === newsletter._id}
                          isFavorited={getIsFavorited(
                            newsletter._id,
                            Boolean(newsletter.isFavorited),
                          )}
                          isFavoritePending={isFavoritePending(newsletter._id)}
                          enableHideAction
                          onHide={handleDismissRecentNewsletter}
                          onClick={onNewsletterSelect}
                          onToggleFavorite={onToggleFavorite}
                        />
                      ))
                    )}

                    {canLoadMoreRecent && (
                      <div ref={recentLoadMoreRef} className="h-8" />
                    )}
                    {recentIsLoadingMore && (
                      <p className="px-3 py-2 text-xs text-muted-foreground">
                        Loading...
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>

              <div className="h-px bg-border my-2 mx-2" role="separator" />
            </>
          )}

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
                {canLoadMore && onLoadMore && (
                  <div className="px-2 py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      disabled={Boolean(isLoadingMore)}
                      onClick={() => onLoadMore()}
                    >
                      {isLoadingMore ? "Loading..." : "Load more"}
                    </Button>
                  </div>
                )}
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
                {canLoadMore && onLoadMore && (
                  <div className="px-2 py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      disabled={Boolean(isLoadingMore)}
                      onClick={() => onLoadMore()}
                    >
                      {isLoadingMore ? "Loading..." : "Load more"}
                    </Button>
                  </div>
                )}
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
                isSelected={effectiveSelectedFolderId === folder._id}
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
          {!hiddenCountPending &&
            ((hiddenCount ?? 0) > 0 || selectedFilter === FILTER_HIDDEN) && (
              <>
                <div className="h-px bg-border my-2 mx-2" role="separator" />
                <button
                  onClick={handleHiddenClick}
                  aria-current={
                    selectedFilter === "hidden" ? "page" : undefined
                  }
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
      <SidebarFooter />
    </aside>
  );
}
