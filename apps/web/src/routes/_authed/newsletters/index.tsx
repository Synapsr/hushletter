import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { useAction } from "convex/react";
import { api } from "@hushletter/backend";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";
import {
  NewsletterCard,
  type NewsletterData,
} from "@/components/NewsletterCard";
import { EmptyNewsletterState } from "@/components/EmptyNewsletterState";
import {
  FolderSidebar,
  type FolderData,
} from "@/components/FolderSidebar";
import { SenderFolderSidebar } from "@/components/newsletters/SenderFolderSidebar";
import { InlineReaderPane } from "@/components/newsletters/InlineReaderPane";
import { ContentSkeleton } from "@/components/ReaderView";
import { WelcomeSidebar } from "@/components/newsletters/WelcomeSidebar";
import { WelcomeReaderPane } from "@/components/newsletters/WelcomeReaderPane";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useOptimisticNewsletterFavorite } from "@/hooks/useOptimisticNewsletterFavorite";
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
  Button,
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
  Skeleton,
} from "@hushletter/ui";
import { Menu, Inbox } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import { toast } from "sonner";

/** Code review fix: Extract magic string to constant */
const FILTER_HIDDEN = "hidden" as const;
const FILTER_STARRED = "starred" as const;
const FILTER_BIN = "bin" as const;
const LAST_READ_KEY = "hushletter:lastNewsletter";
type FilterType =
  | typeof FILTER_HIDDEN
  | typeof FILTER_STARRED
  | typeof FILTER_BIN;

/**
 * Search params schema for URL-based filtering
 * - /newsletters                                    → All newsletters
 * - /newsletters?folder={folderId}                 → Folder view
 * - /newsletters?filter=hidden                     → Hidden newsletters
 * - /newsletters?filter=starred                    → Favorited newsletters
 * - /newsletters?filter=bin                        → Binned newsletters
 * - /newsletters?folder={folderId}&newsletter={id} → Folder + inline reader (desktop)
 * - /newsletters?newsletter={id}                   → Inline reader (desktop)
 */
type NewsletterSearchParams = {
  folder?: string;
  filter?: FilterType;
  newsletter?: string;
};

interface GetStarredAutoSelectionIdArgs {
  isDesktop: boolean;
  isFilteringByStarred: boolean;
  isPending: boolean;
  selectedNewsletterId?: string;
  newsletters: Array<{ _id: string }>;
}

interface GetPostEmptyBinSearchArgs {
  effectiveFilter: FilterType | null;
  selectedNewsletterId?: string | null;
}

function isValidConvexId(id: string | undefined): boolean {
  if (!id || typeof id !== "string") return false;
  return id.length > 0 && id.trim() === id && !/\s/.test(id);
}

export function getStarredAutoSelectionId({
  isDesktop,
  isFilteringByStarred,
  isPending,
  selectedNewsletterId,
  newsletters,
}: GetStarredAutoSelectionIdArgs): string | null {
  if (
    !isDesktop ||
    !isFilteringByStarred ||
    isPending ||
    newsletters.length === 0
  ) {
    return null;
  }

  const selectedStillVisible =
    selectedNewsletterId !== undefined &&
    newsletters.some((newsletter) => newsletter._id === selectedNewsletterId);

  if (selectedStillVisible) {
    return null;
  }

  return newsletters[0]?._id ?? null;
}

export function getPostEmptyBinSearch({
  effectiveFilter,
  selectedNewsletterId,
}: GetPostEmptyBinSearchArgs): NewsletterSearchParams | null {
  if (effectiveFilter !== FILTER_BIN) return null;

  // Keep user in Bin filter while clearing any open newsletter selection.
  // selectedNewsletterId is accepted for call-site clarity.
  void selectedNewsletterId;
  return { filter: FILTER_BIN };
}

export function validateNewsletterSearch(
  search: Record<string, unknown>,
): NewsletterSearchParams {
  const folder = typeof search.folder === "string" ? search.folder : undefined;
  const filter = typeof search.filter === "string" ? search.filter : undefined;
  const newsletter =
    typeof search.newsletter === "string" ? search.newsletter : undefined;

  return {
    folder: isValidConvexId(folder) ? folder : undefined,
    filter:
      filter === FILTER_HIDDEN ||
      filter === FILTER_STARRED ||
      filter === FILTER_BIN
        ? (filter as FilterType)
        : undefined,
    newsletter: isValidConvexId(newsletter) ? newsletter : undefined,
  };
}

export const Route = createFileRoute("/_authed/newsletters/")({
  component: NewslettersPage,
  validateSearch: validateNewsletterSearch,
});

type CurrentUserData = {
  id: string;
  email: string;
  name: string | null;
  dedicatedEmail: string | null;
  vanityEmail: string | null;
} | null;

/**
 * Sender data returned by listSendersInFolder query
 */
interface FolderSenderData {
  _id: string;
  email: string;
  name?: string;
  displayName: string;
  domain: string;
}

function NewsletterCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <div
      className="rounded-2xl border bg-card shadow-xs/5 py-4 px-6"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: unread dot area + text */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <Skeleton className="h-2 w-2 rounded-full mt-2 shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-4.5 w-3/4" />
          </div>
        </div>
        {/* Right: date + action icons */}
        <div className="flex items-center gap-2 shrink-0">
          <Skeleton className="h-3.5 w-3.5 rounded-full" />
          <Skeleton className="h-3 w-14" />
          <Skeleton className="h-7 w-7 rounded-md" />
        </div>
      </div>
    </div>
  );
}

function NewsletterListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <NewsletterCardSkeleton key={i} delay={i * 75} />
      ))}
    </div>
  );
}

function ReaderPaneSkeleton() {
  return (
    <div className="flex-1 min-w-0 flex flex-col">
      {/* Action bar skeleton — matches ReaderActionBar's px-6 py-2 border-b */}
      <div className="flex items-center justify-between px-6 py-2 border-b bg-background/95">
        <div className="flex items-center gap-1">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="h-3 w-32" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>

      {/* Content skeleton — matches ScrollArea > .px-6.pt-6.pb-12.max-w-3xl.mx-auto */}
      <div className="flex-1 overflow-hidden px-6 pt-6 pb-12 max-w-3xl mx-auto w-full">
        <ContentSkeleton />
      </div>
    </div>
  );
}

function SidebarSkeletonPane() {
  return (
    <aside className="w-[300px] border-r bg-background flex flex-col">
      {/* Tab bar */}
      <div className="p-3 pb-0">
        <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
          <Skeleton className="h-7 flex-1 rounded-md" />
          <Skeleton className="h-7 flex-1 rounded-md" />
          <Skeleton className="h-7 flex-1 rounded-md" />
        </div>
      </div>

      {/* Folder list */}
      <div className="flex-1 p-3 space-y-1">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
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

      {/* Footer */}
      <div className="border-t p-3">
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>
    </aside>
  );
}

function PageSkeleton() {
  return (
    <div className="h-screen overflow-hidden">
      {/* Desktop */}
      <div className="hidden md:flex h-full">
        <SidebarSkeletonPane />
        <ReaderPaneSkeleton />
      </div>

      {/* Mobile */}
      <main className="md:hidden flex-1 p-6 pt-16">
        <Skeleton className="h-8 w-40 mb-6" />
        <NewsletterListSkeleton />
      </main>
    </div>
  );
}

function FolderHeader({ folderId }: { folderId: string }) {
  const { data: folderData } = useQuery(
    convexQuery(api.folders.getFolderWithSenders, {
      folderId: folderId as Id<"folders">,
    }),
  );

  if (!folderData) return null;

  const senderList = (folderData.senders ?? []) as FolderSenderData[];

  return (
    <div className="mb-6">
      <h1 className="text-3xl font-bold text-foreground">{folderData.name}</h1>
      {senderList.length > 0 && (
        <p className="text-sm text-muted-foreground mt-1">
          {m.newsletters_fromSender({
            displayName:
              senderList.length === 1
                ? senderList[0].displayName
                : senderList.map((s) => s.displayName).join(", "),
          })}
        </p>
      )}
    </div>
  );
}

function NewslettersPage() {
  const {
    folder: folderIdParam,
    filter: filterParam,
    newsletter: newsletterIdParam,
  } = Route.useSearch();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // Mobile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingFilter, setPendingFilter] = useState<
    FilterType | null | undefined
  >(undefined);
  const effectiveFilter: FilterType | null =
    pendingFilter !== undefined ? pendingFilter : (filterParam ?? null);
  const isFilterTransitioning =
    pendingFilter !== undefined && (filterParam ?? null) !== pendingFilter;
  const effectiveNewsletterId = isFilterTransitioning
    ? undefined
    : newsletterIdParam;

  useEffect(() => {
    if (pendingFilter === undefined) return;
    if ((filterParam ?? null) === pendingFilter) {
      setPendingFilter(undefined);
    }
  }, [pendingFilter, filterParam]);

  // Restore last read newsletter on desktop when no newsletter param
  useEffect(() => {
    if (!isDesktop || newsletterIdParam) return;
    try {
      const lastId = localStorage.getItem(LAST_READ_KEY);
      if (lastId && isValidConvexId(lastId)) {
        navigate({
          to: "/newsletters",
          search: {
            ...(folderIdParam ? { folder: folderIdParam } : {}),
            ...(filterParam ? { filter: filterParam } : {}),
            newsletter: lastId,
          },
          replace: true,
        });
      }
    } catch {
      // localStorage unavailable
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop]);

  // Persist selected newsletter to localStorage
  useEffect(() => {
    if (!newsletterIdParam) return;
    try {
      localStorage.setItem(LAST_READ_KEY, newsletterIdParam);
    } catch {
      // localStorage unavailable
    }
  }, [newsletterIdParam]);

  // Mobile: redirect to detail page when newsletter param is present
  // Uses direct matchMedia check to avoid hydration timing issues with useSyncExternalStore
  useEffect(() => {
    if (!newsletterIdParam) return;
    const isMobile = !window.matchMedia("(min-width: 768px)").matches;
    if (isMobile) {
      navigate({
        to: "/newsletters/$id",
        params: { id: newsletterIdParam },
        replace: true,
      });
    }
  }, [newsletterIdParam, navigate]);

  // Get current user for dedicated email (used in empty state)
  const { data: userData, isPending: userPending } = useQuery(
    convexQuery(api.auth.getCurrentUser, {}),
  );
  const user = userData as CurrentUserData;

  // Get visible folders with unread counts
  const { data: foldersData, isPending: foldersPending } = useQuery(
    convexQuery(api.folders.listVisibleFoldersWithUnreadCounts, {}),
  );
  const folders = (foldersData ?? []) as FolderData[];

  // Determine filter type - mutually exclusive
  const isFilteringByHidden = effectiveFilter === FILTER_HIDDEN;
  const isFilteringByStarred = effectiveFilter === FILTER_STARRED;
  const isFilteringByBinned = effectiveFilter === FILTER_BIN;
  const isFilteringByFolder =
    !!folderIdParam &&
    !isFilteringByHidden &&
    !isFilteringByStarred &&
    !isFilteringByBinned;

  // Reactive head pages (subscribed) for the active list only.
  // Important: with @convex-dev/react-query, you must pass args === "skip" to avoid subscriptions.
  const { data: allHead, isPending: allHeadPending } = useQuery(
    convexQuery(
      api.newsletters.listAllNewslettersHead,
      !isDesktop &&
        !isFilteringByFolder &&
        !isFilteringByHidden &&
        !isFilteringByStarred &&
        !isFilteringByBinned
        ? { numItems: 30 }
        : "skip",
    ),
  );

  const { data: folderHead, isPending: folderHeadPending } = useQuery(
    convexQuery(
      api.newsletters.listUserNewslettersByFolderHead,
      !isDesktop && isFilteringByFolder
        ? { folderId: folderIdParam as Id<"folders">, numItems: 30 }
        : "skip",
    ),
  );

  const { data: hiddenHead, isPending: hiddenHeadPending } = useQuery(
    convexQuery(
      api.newsletters.listHiddenNewslettersHead,
      isFilteringByHidden ? { numItems: 30 } : "skip",
    ),
  );

  const { data: favoritedHead, isPending: favoritedHeadPending } = useQuery(
    convexQuery(
      api.newsletters.listFavoritedNewslettersHead,
      isFilteringByStarred ? { numItems: 30 } : "skip",
    ),
  );
  const { data: binnedHead, isPending: binnedHeadPending } = useQuery(
    convexQuery(
      (api.newsletters as any).listBinnedNewslettersHead,
      isFilteringByBinned ? { numItems: 30 } : "skip",
    ),
  );

  const listKey = useMemo(() => {
    if (isFilteringByHidden) return "hidden";
    if (isFilteringByStarred) return "starred";
    if (isFilteringByBinned) return "bin";
    if (isFilteringByFolder) return `folder:${folderIdParam}`;
    return "all";
  }, [
    isFilteringByHidden,
    isFilteringByStarred,
    isFilteringByBinned,
    isFilteringByFolder,
    folderIdParam,
  ]);

  const activeHead = isFilteringByHidden
    ? hiddenHead
    : isFilteringByStarred
      ? favoritedHead
      : isFilteringByBinned
        ? binnedHead
      : isFilteringByFolder
        ? folderHead
        : allHead;

  // On desktop, allHead and folderHead queries are skipped (their data comes
  // from SenderFolderSidebar instead). Skipped queries report isPending=true
  // permanently, so treat them as not pending to avoid an infinite skeleton.
  const isActiveQuerySkipped =
    isDesktop &&
    !isFilteringByHidden &&
    !isFilteringByStarred &&
    !isFilteringByBinned;

  const activeHeadPending = isActiveQuerySkipped
    ? false
    : isFilteringByHidden
      ? hiddenHeadPending
      : isFilteringByStarred
        ? favoritedHeadPending
        : isFilteringByBinned
          ? binnedHeadPending
        : isFilteringByFolder
          ? folderHeadPending
          : allHeadPending;

  const listAllPage = useAction(api.newsletters.listAllNewslettersPage);
  const listFolderPage = useAction(
    api.newsletters.listUserNewslettersByFolderPage,
  );
  const listHiddenPage = useAction(api.newsletters.listHiddenNewslettersPage);
  const listFavoritedPage = useAction(
    api.newsletters.listFavoritedNewslettersPage,
  );
  const listBinnedPage = useAction(
    (api.newsletters as any).listBinnedNewslettersPage,
  );
  const emptyBinAction = useAction((api.newsletters as any).emptyBin);

  const [tailPages, setTailPages] = useState<NewsletterData[][]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isEmptyingBin, setIsEmptyingBin] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setTailPages([]);
    setCursor(null);
    setIsDone(true);
    setIsLoadingMore(false);
  }, [listKey]);

  useEffect(() => {
    if (!activeHead) return;
    if (cursor !== null || tailPages.length > 0) return;
    const data = activeHead as unknown as {
      continueCursor: string | null;
      isDone: boolean;
    };
    setCursor(data.continueCursor);
    setIsDone(data.isDone);
  }, [activeHead, cursor, tailPages.length]);

  const headPage = useMemo(() => {
    const data = activeHead as unknown as
      | { page?: NewsletterData[] }
      | undefined;
    return (data?.page ?? []) as NewsletterData[];
  }, [activeHead]);

  const mergedActiveList = useMemo(() => {
    const merged: NewsletterData[] = [];
    const seen = new Set<string>();
    for (const newsletter of [...headPage, ...tailPages.flat()]) {
      const id = String(newsletter._id);
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push(newsletter);
    }
    return merged;
  }, [headPage, tailPages]);

  const canLoadMore = !isDone && cursor !== null;
  const handleLoadMore = useCallback(async () => {
    if (!canLoadMore || isLoadingMore || cursor === null) return;
    setIsLoadingMore(true);
    try {
      const numItems = 50;
      const result = isFilteringByFolder
        ? await listFolderPage({
            folderId: folderIdParam as Id<"folders">,
            cursor,
            numItems,
          })
        : isFilteringByHidden
          ? await listHiddenPage({ cursor, numItems })
          : isFilteringByStarred
            ? await listFavoritedPage({ cursor, numItems })
            : isFilteringByBinned
              ? await listBinnedPage({ cursor, numItems })
            : await listAllPage({ cursor, numItems });

      const page = (result.page ?? []) as NewsletterData[];
      setTailPages((prev) => [...prev, page]);
      setCursor(result.continueCursor ?? null);
      setIsDone(result.isDone ?? true);
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    canLoadMore,
    isLoadingMore,
    cursor,
    isFilteringByFolder,
    isFilteringByHidden,
    isFilteringByStarred,
    isFilteringByBinned,
    listFolderPage,
    listHiddenPage,
    listFavoritedPage,
    listBinnedPage,
    listAllPage,
    folderIdParam,
  ]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node) return;
    if (!canLoadMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void handleLoadMore();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [canLoadMore, handleLoadMore]);

  const selectedFolder = useMemo(() => {
    if (!folderIdParam) return null;
    return folders.find((f) => f._id === folderIdParam) ?? null;
  }, [folders, folderIdParam]);

  const favoriteSnapshots = useMemo(() => {
    const deduped = new Map<string, { _id: string; isFavorited?: boolean }>();
    for (const newsletter of mergedActiveList) {
      deduped.set(newsletter._id, {
        _id: newsletter._id,
        isFavorited: newsletter.isFavorited,
      });
    }
    return [...deduped.values()];
  }, [mergedActiveList]);

  const favoriteController = useOptimisticNewsletterFavorite(favoriteSnapshots);
  const getIsFavorited = favoriteController.getIsFavorited;
  const isFavoritePending = favoriteController.isFavoritePending;
  const onToggleFavorite = favoriteController.toggleFavorite;

  // Handle folder selection
  const handleFolderSelect = (selectedFolderId: string | null) => {
    setPendingFilter(null);
    navigate({
      to: "/newsletters",
      search: selectedFolderId
        ? { folder: selectedFolderId, newsletter: newsletterIdParam }
        : { newsletter: newsletterIdParam },
    });
    setSidebarOpen(false);
  };

  // Handle filter selection
  const handleFilterSelect = (filter: FilterType | null) => {
    setPendingFilter(filter);
    navigate({
      to: "/newsletters",
      search: filter ? { filter } : {},
    });
    setSidebarOpen(false);
  };

  // Handle newsletter selection for inline reader
  const handleNewsletterSelect = (id: string) => {
    navigate({
      to: "/newsletters",
      search: {
        ...(folderIdParam ? { folder: folderIdParam } : {}),
        ...(effectiveFilter ? { filter: effectiveFilter } : {}),
        newsletter: id,
      },
    });
  };

  const handleEmptyBin = useCallback(async () => {
    if (isEmptyingBin) return;
    setIsEmptyingBin(true);
    try {
      const result = await emptyBinAction({});
      toast.success(
        m.bin_emptySuccess?.({ count: result.deletedCount }) ??
          `${result.deletedCount} newsletters deleted from Bin`,
      );

      const postEmptyBinSearch = getPostEmptyBinSearch({
        effectiveFilter,
        selectedNewsletterId: effectiveNewsletterId ?? null,
      });
      if (postEmptyBinSearch) {
        navigate({
          to: "/newsletters",
          search: postEmptyBinSearch,
          replace: true,
        });
      }
    } catch (error) {
      console.error("[NewslettersPage] Failed to empty bin:", error);
      toast.error(m.bin_emptyFailed?.() ?? "Failed to empty Bin");
    } finally {
      setIsEmptyingBin(false);
    }
  }, [
    isEmptyingBin,
    emptyBinAction,
    effectiveFilter,
    effectiveNewsletterId,
    navigate,
  ]);

  const isInitialPagePending = userPending || foldersPending;
  const activeListPending = activeHeadPending;

  const dedicatedEmail = user?.vanityEmail ?? user?.dedicatedEmail ?? null;

  const newsletterList = mergedActiveList;

  const visibleNewsletterList = useMemo(() => {
    if (!isFilteringByStarred) return newsletterList;
    return newsletterList.filter((newsletter) =>
      getIsFavorited(newsletter._id, Boolean(newsletter.isFavorited)),
    );
  }, [isFilteringByStarred, newsletterList, getIsFavorited]);

  const visibleFavoritedNewsletters = useMemo(() => {
    if (!isFilteringByStarred) return [];
    return visibleNewsletterList;
  }, [isFilteringByStarred, visibleNewsletterList]);

  const autoSelectedStarredNewsletterId = getStarredAutoSelectionId({
    isDesktop,
    isFilteringByStarred,
    isPending: activeListPending,
    selectedNewsletterId: effectiveNewsletterId,
    newsletters: visibleFavoritedNewsletters,
  });

  useEffect(() => {
    if (!autoSelectedStarredNewsletterId) return;
    navigate({
      to: "/newsletters",
      search: {
        filter: FILTER_STARRED,
        newsletter: autoSelectedStarredNewsletterId,
      },
      replace: true,
    });
  }, [autoSelectedStarredNewsletterId, navigate]);

  if (isInitialPagePending) return <PageSkeleton />;

  // Desktop sidebar props for the new SenderFolderSidebar
  const senderFolderSidebarProps = {
    selectedFolderId: folderIdParam ?? null,
    selectedNewsletterId: effectiveNewsletterId ?? null,
    selectedFilter: effectiveFilter,
    hiddenNewsletters: isFilteringByHidden ? newsletterList : [],
    hiddenPending: isFilteringByHidden ? activeListPending : false,
    binnedNewsletters: isFilteringByBinned ? newsletterList : [],
    binnedPending: isFilteringByBinned ? activeListPending : false,
    favoritedNewsletters: visibleFavoritedNewsletters,
    favoritedPending: isFilteringByStarred ? activeListPending : false,
    canLoadMore:
      isFilteringByHidden || isFilteringByStarred || isFilteringByBinned
        ? canLoadMore
        : false,
    isLoadingMore:
      isFilteringByHidden || isFilteringByStarred || isFilteringByBinned
        ? isLoadingMore
        : false,
    onLoadMore:
      isFilteringByHidden || isFilteringByStarred || isFilteringByBinned
        ? () => {
            void handleLoadMore();
          }
        : undefined,
    onEmptyBin: handleEmptyBin,
    isEmptyingBin,
    onFolderSelect: handleFolderSelect,
    onNewsletterSelect: handleNewsletterSelect,
    onFilterSelect: handleFilterSelect,
    getIsFavorited,
    isFavoritePending,
    onToggleFavorite,
  };

  // Mobile sidebar props (old FolderSidebar)
  const mobileSidebarProps = {
    selectedFolderId: folderIdParam ?? null,
    selectedFilter: effectiveFilter,
    onFolderSelect: handleFolderSelect,
    onFilterSelect: handleFilterSelect,
  };

  // True empty state: no filtering active, user/folders loaded, zero folders
  // (folders are auto-created from newsletter senders, so zero folders = zero newsletters)
  const isGlobalEmpty =
    !isInitialPagePending &&
    !isFilteringByFolder &&
    !isFilteringByHidden &&
    !isFilteringByStarred &&
    !isFilteringByBinned &&
    folders.length === 0;

  // ── Desktop layout: split-pane ──
  // Left: SenderFolderSidebar | Right: InlineReaderPane or empty state
  const desktopLayout = isGlobalEmpty ? (
    <div className="hidden md:flex h-full">
      <WelcomeSidebar />
      <WelcomeReaderPane dedicatedEmail={dedicatedEmail} />
    </div>
  ) : (
    <div className="hidden md:flex h-full">
      <SenderFolderSidebar {...senderFolderSidebarProps} />

      {effectiveNewsletterId ? (
        <InlineReaderPane
          key={effectiveNewsletterId}
          newsletterId={effectiveNewsletterId as Id<"userNewsletters">}
          getIsFavorited={getIsFavorited}
          isFavoritePending={isFavoritePending}
          onToggleFavorite={onToggleFavorite}
        />
      ) : activeListPending ? (
        <ReaderPaneSkeleton />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
          <Inbox className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-lg">{m.reader_selectNewsletter()}</p>
        </div>
      )}
    </div>
  );

  // ── Mobile layout: card list (existing behavior) ──
  const mobileLayout = isGlobalEmpty ? (
    <div className="md:hidden flex flex-col h-full">
      <WelcomeReaderPane dedicatedEmail={dedicatedEmail} />
    </div>
  ) : (
    <div className="md:hidden flex flex-col h-full">
      {/* Mobile sidebar trigger */}
      <div className="fixed top-4 left-4 z-50">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger
            render={
              <Button
                variant="outline"
                size="icon"
                aria-label={m.newsletters_openFolderMenu()}
              />
            }
          >
            <Menu className="h-4 w-4" />
          </SheetTrigger>
          <SheetContent
            side="left"
            className="p-0 w-72"
            showCloseButton={false}
          >
            <SheetTitle className="sr-only">
              {m.newsletters_folderNavigation()}
            </SheetTitle>
            <FolderSidebar {...mobileSidebarProps} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Mobile main content */}
      <main className="flex-1 p-6 pt-16 overflow-y-auto">
        {isFilteringByHidden ? (
          <h1 className="text-3xl font-bold text-foreground mb-6">
            {m.newsletters_hiddenNewsletters()}
          </h1>
        ) : isFilteringByBinned ? (
          <div className="mb-6 flex items-center justify-between gap-3">
            <h1 className="text-3xl font-bold text-foreground">
              {m.bin_label?.() ?? "Bin"}
            </h1>
            {!activeListPending && visibleNewsletterList.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger
                  render={
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={isEmptyingBin}
                    />
                  }
                >
                  {m.bin_emptyAction?.() ?? "Empty Bin"}
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {m.bin_emptyConfirmTitle?.() ?? "Empty Bin?"}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {m.bin_emptyConfirmDescription?.() ??
                        "This will permanently delete all newsletters currently in Bin. This action cannot be undone."}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{m.common_cancel()}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => {
                        void handleEmptyBin();
                      }}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={isEmptyingBin}
                    >
                      {m.common_delete()}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        ) : isFilteringByStarred ? (
          <h1 className="text-3xl font-bold text-foreground mb-6">
            {m.newsletters_starredNewsletters()}
          </h1>
        ) : selectedFolder && folderIdParam ? (
          <FolderHeader folderId={folderIdParam} />
        ) : (
          <h1 className="text-3xl font-bold text-foreground mb-6">
            {m.newsletters_allNewsletters()}
          </h1>
        )}

        {activeListPending ? (
          <NewsletterListSkeleton />
        ) : visibleNewsletterList.length === 0 ? (
          isFilteringByHidden ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {m.newsletters_noHiddenNewsletters()}
              </p>
            </div>
          ) : isFilteringByBinned ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {m.bin_emptyState?.() ?? "No newsletters in Bin."}
              </p>
            </div>
          ) : isFilteringByStarred ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {m.newsletters_noStarredNewsletters()}
              </p>
            </div>
          ) : selectedFolder ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {m.newsletters_noNewslettersInFolder({
                  folderName: selectedFolder.name,
                })}
              </p>
            </div>
          ) : (
            <EmptyNewsletterState dedicatedEmail={dedicatedEmail} />
          )
        ) : (
          <div className="space-y-3">
            {visibleNewsletterList.map((newsletter) => (
              <NewsletterCard
                key={newsletter._id}
                newsletter={newsletter}
                showUnhide={isFilteringByHidden}
                isFavorited={getIsFavorited(
                  newsletter._id,
                  Boolean(newsletter.isFavorited),
                )}
                isFavoritePending={isFavoritePending(newsletter._id)}
                onToggleFavorite={onToggleFavorite}
              />
            ))}
            {canLoadMore && <div ref={loadMoreRef} className="h-10" />}
            {isLoadingMore && (
              <div className="text-center text-sm text-muted-foreground py-4">
                Loading more...
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );

  return (
    <div className="h-screen overflow-hidden">
      {desktopLayout}
      {mobileLayout}
    </div>
  );
}
