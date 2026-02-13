import { useState, useMemo, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";
import { NewsletterCard, type NewsletterData } from "@/components/NewsletterCard";
import { EmptyNewsletterState } from "@/components/EmptyNewsletterState";
import { FolderSidebar, FolderSidebarSkeleton, type FolderData } from "@/components/FolderSidebar";
import { SenderFolderSidebar } from "@/components/newsletters/SenderFolderSidebar";
import { InlineReaderPane } from "@/components/newsletters/InlineReaderPane";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useOptimisticNewsletterFavorite } from "@/hooks/useOptimisticNewsletterFavorite";
import { Button, Sheet, SheetContent, SheetTitle, SheetTrigger } from "@hushletter/ui";
import { Menu, Inbox } from "lucide-react";
import { m } from "@/paraglide/messages.js";

/** Code review fix: Extract magic string to constant */
const FILTER_HIDDEN = "hidden" as const;
const FILTER_STARRED = "starred" as const;
const LAST_READ_KEY = "hushletter:lastNewsletter";
type FilterType = typeof FILTER_HIDDEN | typeof FILTER_STARRED;

/**
 * Search params schema for URL-based filtering
 * - /newsletters                                    → All newsletters
 * - /newsletters?folder={folderId}                 → Folder view
 * - /newsletters?filter=hidden                     → Hidden newsletters
 * - /newsletters?filter=starred                    → Favorited newsletters
 * - /newsletters?folder={folderId}&newsletter={id} → Folder + inline reader (desktop)
 * - /newsletters?newsletter={id}                   → Inline reader (desktop)
 */
type NewsletterSearchParams = {
  folder?: string;
  filter?: FilterType;
  newsletter?: string;
};

function isValidConvexId(id: string | undefined): boolean {
  if (!id || typeof id !== "string") return false;
  return id.length > 0 && id.trim() === id && !/\s/.test(id);
}

export const Route = createFileRoute("/_authed/newsletters/")({
  component: NewslettersPage,
  validateSearch: (search: Record<string, unknown>): NewsletterSearchParams => {
    const folder = typeof search.folder === "string" ? search.folder : undefined;
    const filter = typeof search.filter === "string" ? search.filter : undefined;
    const newsletter =
      typeof search.newsletter === "string" ? search.newsletter : undefined;

    return {
      folder: isValidConvexId(folder) ? folder : undefined,
      filter:
        filter === FILTER_HIDDEN || filter === FILTER_STARRED
          ? (filter as FilterType)
          : undefined,
      newsletter: isValidConvexId(newsletter) ? newsletter : undefined,
    };
  },
});

type CurrentUserData = {
  id: string;
  email: string;
  name: string | null;
  dedicatedEmail: string | null;
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

function NewsletterListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="animate-pulse bg-card border rounded-xl p-4 space-y-2">
          <div className="flex justify-between">
            <div className="h-4 bg-muted rounded w-1/4" />
            <div className="h-3 bg-muted rounded w-16" />
          </div>
          <div className="h-5 bg-muted rounded w-3/4" />
        </div>
      ))}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="flex h-full">
      <div className="hidden md:block">
        <FolderSidebarSkeleton />
      </div>
      <main className="flex-1 p-6">
        <div className="animate-pulse h-8 bg-muted rounded w-1/4 mb-6" />
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
  const isFilteringByHidden = filterParam === FILTER_HIDDEN;
  const isFilteringByStarred = filterParam === FILTER_STARRED;
  const isFilteringByFolder =
    !!folderIdParam && !isFilteringByHidden && !isFilteringByStarred;

  // Get newsletters by folder
  const { data: newslettersByFolder, isPending: newslettersByFolderPending } =
    useQuery({
      ...convexQuery(api.newsletters.listUserNewslettersByFolder, {
        folderId: folderIdParam as Id<"folders">,
      }),
      enabled: isFilteringByFolder,
    });

  // Get all newsletters when no folder is selected
  const { data: allNewsletters, isPending: allNewslettersPending } = useQuery({
    ...convexQuery(api.newsletters.listUserNewslettersBySender, {
      senderId: undefined,
    }),
    enabled: !isFilteringByFolder && !isFilteringByHidden && !isFilteringByStarred,
  });

  // Fetch hidden newsletters
  const { data: hiddenNewsletters, isPending: hiddenNewslettersPending } =
    useQuery(convexQuery(api.newsletters.listHiddenNewsletters, {}));

  // Fetch favorited newsletters (starred view)
  const { data: favoritedNewsletters, isPending: favoritedNewslettersPending } =
    useQuery({
      ...convexQuery(api.newsletters.listFavoritedNewsletters, {}),
      enabled: isFilteringByStarred,
    });

  const selectedFolder = useMemo(() => {
    if (!folderIdParam) return null;
    return folders.find((f) => f._id === folderIdParam) ?? null;
  }, [folders, folderIdParam]);

  const favoriteSnapshots = useMemo(() => {
    const allSnapshots = [
      ...((allNewsletters ?? []) as NewsletterData[]),
      ...((newslettersByFolder ?? []) as NewsletterData[]),
      ...((hiddenNewsletters ?? []) as NewsletterData[]),
      ...((favoritedNewsletters ?? []) as NewsletterData[]),
    ];
    const deduped = new Map<string, { _id: string; isFavorited?: boolean }>();
    for (const newsletter of allSnapshots) {
      deduped.set(newsletter._id, {
        _id: newsletter._id,
        isFavorited: newsletter.isFavorited,
      });
    }
    return [...deduped.values()];
  }, [allNewsletters, newslettersByFolder, hiddenNewsletters, favoritedNewsletters]);

  const favoriteController = useOptimisticNewsletterFavorite(favoriteSnapshots);
  const getIsFavorited = favoriteController.getIsFavorited;
  const isFavoritePending = favoriteController.isFavoritePending;
  const onToggleFavorite = favoriteController.toggleFavorite;

  // Handle folder selection
  const handleFolderSelect = (selectedFolderId: string | null) => {
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
        ...(filterParam ? { filter: filterParam } : {}),
        newsletter: id,
      },
    });
  };

  // Loading state
  const isPending =
    userPending ||
    foldersPending ||
    (isFilteringByHidden
      ? hiddenNewslettersPending
      : isFilteringByStarred
        ? favoritedNewslettersPending
        : isFilteringByFolder
          ? newslettersByFolderPending
          : allNewslettersPending);

  const dedicatedEmail = user?.dedicatedEmail ?? null;

  const newsletterList = isFilteringByHidden
    ? ((hiddenNewsletters ?? []) as NewsletterData[])
    : isFilteringByStarred
      ? ((favoritedNewsletters ?? []) as NewsletterData[])
    : isFilteringByFolder
      ? ((newslettersByFolder ?? []) as NewsletterData[])
      : ((allNewsletters ?? []) as NewsletterData[]);

  const visibleNewsletterList = useMemo(() => {
    if (!isFilteringByStarred) return newsletterList;
    return newsletterList.filter((newsletter) =>
      getIsFavorited(newsletter._id, Boolean(newsletter.isFavorited)),
    );
  }, [isFilteringByStarred, newsletterList, getIsFavorited]);

  const visibleFavoritedNewsletters = useMemo(
    () =>
      ((favoritedNewsletters ?? []) as NewsletterData[]).filter((newsletter) =>
        getIsFavorited(newsletter._id, Boolean(newsletter.isFavorited)),
      ),
    [favoritedNewsletters, getIsFavorited],
  );

  if (isPending) return <PageSkeleton />;

  // Desktop sidebar props for the new SenderFolderSidebar
  const senderFolderSidebarProps = {
    selectedFolderId: folderIdParam ?? null,
    selectedNewsletterId: newsletterIdParam ?? null,
    selectedFilter: filterParam ?? null,
    favoritedNewsletters: visibleFavoritedNewsletters,
    favoritedPending: favoritedNewslettersPending,
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
    selectedFilter: filterParam ?? null,
    onFolderSelect: handleFolderSelect,
    onFilterSelect: handleFilterSelect,
  };

  // ── Desktop layout: split-pane ──
  // Left: SenderFolderSidebar | Right: InlineReaderPane or empty state
  const desktopLayout = (
    <div className="hidden md:flex h-full">
      <SenderFolderSidebar {...senderFolderSidebarProps} />

      {newsletterIdParam ? (
        <InlineReaderPane
          key={newsletterIdParam}
          newsletterId={newsletterIdParam as Id<"userNewsletters">}
          getIsFavorited={getIsFavorited}
          isFavoritePending={isFavoritePending}
          onToggleFavorite={onToggleFavorite}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
          <Inbox className="h-12 w-12 text-muted-foreground/40" />
          <p className="text-lg">{m.reader_selectNewsletter()}</p>
        </div>
      )}
    </div>
  );

  // ── Mobile layout: card list (existing behavior) ──
  const mobileLayout = (
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
          <SheetContent side="left" className="p-0 w-72" showCloseButton={false}>
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

        {visibleNewsletterList.length === 0 ? (
          isFilteringByHidden ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {m.newsletters_noHiddenNewsletters()}
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
          </div>
        )}
      </main>
    </div>
  );

  return (
    <div className="h-full">
      {desktopLayout}
      {mobileLayout}
    </div>
  );
}
