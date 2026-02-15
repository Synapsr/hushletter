import { useRef, useCallback, useMemo, useState, useDeferredValue } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useConvex, useMutation } from "convex/react";
import { api } from "@hushletter/backend";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";
import {
  CommunityNewsletterCard,
  type CommunityNewsletterData,
  type OwnershipStatus,
} from "@/components/CommunityNewsletterCard";
import { CommunityNewsletterPreviewModal } from "@/components/CommunityNewsletterPreviewModal";
import { BulkImportBar } from "@/components/BulkImportBar";
import { SharingOnboardingModal } from "@/components/SharingOnboardingModal";
import {
  Button,
  Card,
  CardContent,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@hushletter/ui";
import { convexQuery } from "@convex-dev/react-query";
import {
  Loader2,
  Search,
  Users,
  ChevronRight,
  CheckSquare,
  Square,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";
import { m } from "@/paraglide/messages.js";

/** Response type from listCommunityNewsletters query */
type CommunityNewslettersResponse = {
  items: CommunityNewsletterData[];
  nextCursor: Id<"newsletterContent"> | null;
  cursorValue: number | null;
  cursorId: Id<"newsletterContent"> | null;
};

/** Response type from listCommunitySenders query */
type CommunitySenderData = {
  email: string;
  name: string | undefined;
  newsletterCount: number;
  totalReaders: number;
};

/** Response type from listTopCommunitySenders query - Story 6.3 */
type TopCommunitySenderData = {
  email: string;
  name: string | undefined;
  displayName: string;
  domain: string;
  subscriberCount: number;
  newsletterCount: number;
};

/**
 * Search params for community browse page
 * Story 6.1: Task 2.3-2.4
 * Story 6.3: Added tab for browse modes
 * Story 6.4: Added domain filter
 * Story 9.8: Added "imports" sort option
 */
type CommunitySearchParams = {
  sort?: "popular" | "recent" | "imports"; // Story 9.8: Added imports sort
  sender?: string;
  domain?: string; // Story 6.4: Domain filter
  tab?: "newsletters" | "senders";
};

export const Route = createFileRoute("/_authed/_navigation/community/")({
  component: CommunityBrowsePage,
  validateSearch: (search: Record<string, unknown>): CommunitySearchParams => {
    // Story 9.8: Added "imports" sort option
    const sort =
      search.sort === "recent" ? "recent" : search.sort === "imports" ? "imports" : undefined; // Default is popular
    const sender = typeof search.sender === "string" ? search.sender : undefined;
    const domain = typeof search.domain === "string" ? search.domain : undefined; // Story 6.4
    const tab = search.tab === "senders" ? "senders" : undefined; // Default is newsletters
    return { sort, sender, domain, tab };
  },
});

/**
 * Skeleton loader for community newsletter list
 */
function CommunityListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
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

/**
 * Empty state when no community newsletters found
 * Story 9.8 Task 6.3: Updated to reflect admin-curated nature
 */
function EmptyCommunityState({ senderFilter }: { senderFilter?: string }) {
  if (senderFilter) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{m.community_noSenderNewsletters()}</p>
      </div>
    );
  }

  return (
    <div className="text-center py-12">
      <p className="text-xl font-medium mb-2">{m.community_noNewslettersTitle()}</p>
      <p className="text-muted-foreground">
        {m.community_noNewslettersDesc()}
      </p>
    </div>
  );
}

/**
 * Empty state when no search results found
 * Story 6.3: Task 1.5 - Friendly empty state for search queries
 */
function EmptySearchState({ searchQuery }: { searchQuery: string }) {
  return (
    <div className="text-center py-12">
      <Search className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
      <p className="text-lg font-medium mb-2">{m.community_noResultsTitle()}</p>
      <p className="text-muted-foreground">
        {m.community_noResultsDesc({ query: searchQuery })}
      </p>
    </div>
  );
}

/**
 * Error state for community page
 * MEDIUM-5 fix: Add error handling
 */
function CommunityErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="text-center py-12">
      <p className="text-lg font-medium mb-2 text-destructive">{m.community_somethingWentWrong()}</p>
      <p className="text-muted-foreground mb-4">
        {m.community_loadError()}
      </p>
      {onRetry && (
        <button onClick={onRetry} className="text-sm text-primary hover:underline">
          {m.common_tryAgain()}
        </button>
      )}
    </div>
  );
}

/**
 * Sender card for "Browse by Sender" section
 * Story 6.3: Task 2.1
 */
function SenderCard({ sender }: { sender: TopCommunitySenderData }) {
  return (
    <Link
      to="/community/sender/$senderEmail"
      params={{ senderEmail: sender.email }}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl group"
    >
      <Card className="transition-colors hover:bg-accent/50 cursor-pointer">
        <CardContent className="py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-base font-medium text-foreground truncate">{sender.displayName}</p>
              {sender.name && (
                <p className="text-sm text-muted-foreground truncate">{sender.email}</p>
              )}
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{m.community_subscriberCount({ count: sender.subscriberCount })}</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

/**
 * CommunityBrowsePage - Browse public newsletter content
 * Story 6.1: Task 2.1-2.6
 * Story 6.3: Added search functionality and "Browse by Sender" tab
 * Story 9.8: Admin-curated community, ownership badges, preview modal, import sort
 *
 * Features:
 * - Search newsletters by subject and sender name (Story 6.3)
 * - Browse by sender section with top senders (Story 6.3)
 * - List newsletters from newsletterContent (admin-approved only - Story 9.8)
 * - Sort by popular (readerCount), recent (firstReceivedAt), or imports (importCount)
 * - Filter by sender
 * - Infinite scroll pagination using TanStack Query's useInfiniteQuery
 * - Reader count and import count badges (Story 9.8)
 * - Ownership badges for newsletters user already has (Story 9.8)
 * - Preview modal before importing (Story 9.8)
 * - Navigate to community reader view
 *
 * Note: Uses useInfiniteQuery for proper infinite scroll state management,
 * which is the recommended pattern for paginated server data.
 * Uses useDeferredValue for search debouncing (per Story 6.2 pattern).
 */
function CommunityBrowsePage() {
  const { sort, sender, domain, tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const convex = useConvex();

  // Search state with useDeferredValue for debouncing (Story 6.3 Task 1.3)
  const [searchInput, setSearchInput] = useState("");
  const deferredSearchQuery = useDeferredValue(searchInput);
  const isSearching = searchInput !== deferredSearchQuery;

  // Story 9.8 Task 5.1: Preview modal state
  const [previewNewsletter, setPreviewNewsletter] = useState<CommunityNewsletterData | null>(null);

  // Story 9.9 Task 5.1-5.6: Selection mode state for bulk import
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<Id<"newsletterContent">>>(new Set());

  // Story 9.9 Task 6.1: Quick import mutation
  const addToCollection = useMutation(api.community.addToCollection);
  const queryClient = useQueryClient();

  // Infinite scroll observer ref
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Use TanStack Query's useInfiniteQuery for proper pagination state management
  const { data, fetchNextPage, hasNextPage, isFetching, isFetchingNextPage, isPending } =
    useInfiniteQuery({
      queryKey: ["community-newsletters", sort, sender, domain], // Story 6.4: Include domain in query key
      queryFn: async ({ pageParam }) => {
        const result = await convex.query(api.community.listCommunityNewsletters, {
          sortBy: sort || "popular",
          senderEmail: sender,
          domain, // Story 6.4: Domain filter
          cursorValue: pageParam?.cursorValue,
          cursorId: pageParam?.cursorId,
          limit: 20,
        });
        return result as CommunityNewslettersResponse;
      },
      initialPageParam: undefined as
        | { cursorValue: number; cursorId: Id<"newsletterContent"> }
        | undefined,
      getNextPageParam: (lastPage) => {
        if (!lastPage.cursorValue || !lastPage.cursorId) return undefined;
        return { cursorValue: lastPage.cursorValue, cursorId: lastPage.cursorId };
      },
      enabled: !deferredSearchQuery && tab !== "senders", // Disable when searching or on senders tab
    });

  // Story 6.4 Task 3.1: Fetch distinct domains for filter dropdown
  const { data: domainsData } = useQuery(
    convexQuery(api.senders.listDistinctDomains, { limit: 50 }),
  );
  const domains = (domainsData ?? []) as { domain: string; totalSubscribers: number }[];

  // Search query - Story 6.3 Task 1.2
  const {
    data: searchResults,
    isPending: isSearchPending,
    error: searchError,
    refetch: refetchSearch,
  } = useQuery({
    ...convexQuery(
      api.community.searchCommunityNewsletters,
      deferredSearchQuery.length > 0 && tab !== "senders"
        ? {
            searchQuery: deferredSearchQuery,
            limit: 50,
          }
        : "skip",
    ),
  });

  // Check if search results may be incomplete (MEDIUM-6 fix)
  const searchResultsMayBeIncomplete =
    (searchResults as CommunityNewsletterData[] | undefined)?.length === 50;

  // Story 9.8 Task 3.1-3.2: Check user ownership of displayed newsletters
  const displayNewslettersForOwnership = useMemo(() => {
    if (deferredSearchQuery) {
      return (searchResults as CommunityNewsletterData[] | undefined) ?? [];
    }
    return data?.pages.flatMap((page) => page.items) ?? [];
  }, [deferredSearchQuery, searchResults, data]);

  const contentIdsForOwnershipCheck = useMemo(
    () => displayNewslettersForOwnership.map((n) => n._id as Id<"newsletterContent">),
    [displayNewslettersForOwnership],
  );

  const { data: ownershipData } = useQuery({
    ...convexQuery(
      api.community.checkUserHasNewsletters,
      contentIdsForOwnershipCheck.length > 0 && tab !== "senders"
        ? { contentIds: contentIdsForOwnershipCheck }
        : "skip",
    ),
  });

  // Create ownership lookup map
  const ownershipMap = useMemo((): Record<string, OwnershipStatus> => {
    if (!ownershipData) return {};
    return ownershipData as Record<string, OwnershipStatus>;
  }, [ownershipData]);

  // Top senders for "Browse by Sender" tab - Story 6.3 Task 2.2
  const {
    data: topSenders,
    isPending: isSendersPending,
    error: sendersError,
    refetch: refetchSenders,
  } = useQuery({
    ...convexQuery(
      api.community.listTopCommunitySenders,
      tab === "senders" ? { limit: 30 } : "skip",
    ),
  });

  // Flatten paginated results
  const allNewsletters = useMemo(() => {
    return data?.pages.flatMap((page) => page.items) ?? [];
  }, [data]);

  // Fetch senders for filter dropdown
  const { data: sendersData } = useQuery(
    convexQuery(api.community.listCommunitySenders, { limit: 50 }),
  );
  const senders = (sendersData ?? []) as CommunitySenderData[];

  // Determine which newsletters to display
  const displayNewsletters = deferredSearchQuery
    ? ((searchResults as CommunityNewsletterData[] | undefined) ?? [])
    : allNewsletters;

  // Load more callback for infinite scroll
  const loadMore = useCallback(() => {
    if (!isFetching && hasNextPage && !deferredSearchQuery) {
      fetchNextPage();
    }
  }, [isFetching, hasNextPage, fetchNextPage, deferredSearchQuery]);

  // Intersection observer for infinite scroll
  const observerCallback = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting) {
        loadMore();
      }
    },
    [loadMore],
  );

  // Set up intersection observer
  const setLoadMoreRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        const observer = new IntersectionObserver(observerCallback, {
          threshold: 0.1,
        });
        observer.observe(node);
        return () => observer.disconnect();
      }
    },
    [observerCallback],
  );

  // Handle sort change - Story 9.8: Added "imports" option
  const handleSortChange = (value: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        sort: value === "popular" ? undefined : (value as "recent" | "imports"),
      }),
    });
  };

  // Handle sender filter change
  const handleSenderChange = (value: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        sender: value === "all" ? undefined : value,
      }),
    });
  };

  // Story 6.4 Task 3.2: Handle domain filter change
  const handleDomainChange = (value: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        domain: value === "all" ? undefined : value,
      }),
    });
  };

  // Handle tab change - Story 6.3 Task 2.1
  const handleTabChange = (newTab: "newsletters" | "senders") => {
    setSearchInput(""); // Clear search when switching tabs
    setSelectionMode(false); // Story 9.9: Clear selection mode on tab change
    setSelectedIds(new Set());
    navigate({
      search: (prev) => ({
        ...prev,
        tab: newTab === "newsletters" ? undefined : newTab,
      }),
    });
  };

  // Story 9.9 Task 5.1: Toggle selection mode
  const handleToggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    if (selectionMode) {
      setSelectedIds(new Set()); // Clear selection when exiting selection mode
    }
  };

  // Story 9.9 Task 5.2: Handle individual newsletter selection
  const handleSelectionChange = (contentId: Id<"newsletterContent">, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        next.add(contentId);
      } else {
        next.delete(contentId);
      }
      return next;
    });
  };

  // Story 9.9 Task 5.6: Select all visible (non-owned) newsletters
  const handleSelectAllVisible = () => {
    const nonOwnedIds = displayNewsletters
      .filter((n) => !ownershipMap[n._id]?.hasPrivate && !ownershipMap[n._id]?.hasImported)
      .map((n) => n._id as Id<"newsletterContent">);
    setSelectedIds(new Set(nonOwnedIds));
  };

  // Story 9.9 Task 5.6: Clear all selections
  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Story 9.9 Task 5.4-5.5: Handle import completion
  const handleImportComplete = () => {
    // Invalidate queries to refresh ownership data
    queryClient.invalidateQueries({ queryKey: ["community-newsletters"] });
  };

  // Story 9.9 Task 6.1: Quick import single newsletter
  const handleQuickImport = async (newsletter: CommunityNewsletterData) => {
    try {
      const result = await addToCollection({
        contentId: newsletter._id as Id<"newsletterContent">,
      });
      if (result.alreadyExists) {
        toast.info(m.community_alreadyInCollection(), {
          description: result.folderName ? m.previewModal_inFolder({ name: result.folderName }) : undefined,
        });
      } else {
        toast.success(m.community_addedToCollection(), {
          description: result.folderName ? m.previewModal_addedToFolder({ name: result.folderName }) : undefined,
          icon: <FolderOpen className="h-4 w-4" />,
        });
        // Invalidate to refresh ownership status
        queryClient.invalidateQueries({ queryKey: ["community-newsletters"] });
      }
    } catch (error) {
      console.error("[quick-import] Failed:", error);
      toast.error(m.community_importFailed());
    }
  };

  // Render newsletter list content
  const renderNewsletterList = () => {
    const isLoading = deferredSearchQuery ? isSearchPending || isSearching : isPending;

    // Error handling (MEDIUM-5 fix)
    if (searchError && deferredSearchQuery) {
      return <CommunityErrorState onRetry={() => refetchSearch()} />;
    }

    if (isLoading) {
      return <CommunityListSkeleton />;
    }

    if (deferredSearchQuery && displayNewsletters.length === 0) {
      return <EmptySearchState searchQuery={deferredSearchQuery} />;
    }

    if (displayNewsletters.length === 0) {
      return <EmptyCommunityState senderFilter={sender} />;
    }

    return (
      <div className="space-y-3">
        {displayNewsletters.map((newsletter) => (
          <CommunityNewsletterCard
            key={newsletter._id}
            newsletter={newsletter}
            ownershipStatus={ownershipMap[newsletter._id]}
            onPreviewClick={() => setPreviewNewsletter(newsletter)}
            // Story 9.9 Task 5.2, 6.1: Selection mode and quick import
            selectionMode={selectionMode}
            isSelected={selectedIds.has(newsletter._id as Id<"newsletterContent">)}
            onSelectionChange={(selected) =>
              handleSelectionChange(newsletter._id as Id<"newsletterContent">, selected)
            }
            onQuickImport={!selectionMode ? () => handleQuickImport(newsletter) : undefined}
          />
        ))}

        {/* Search results limit warning (MEDIUM-6 fix) */}
        {deferredSearchQuery && searchResultsMayBeIncomplete && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              {m.community_topResults()}
            </p>
          </div>
        )}

        {/* Infinite scroll trigger - only when not searching */}
        {!deferredSearchQuery && (
          <div
            ref={(node) => {
              loadMoreRef.current = node;
              setLoadMoreRef(node);
            }}
            className="h-20 flex items-center justify-center"
          >
            {isFetchingNextPage && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{m.community_loadingMore()}</span>
              </div>
            )}
            {!hasNextPage && displayNewsletters.length > 0 && (
              <p className="text-sm text-muted-foreground">{m.community_reachedEnd()}</p>
            )}
          </div>
        )}
      </div>
    );
  };

  // Render senders list content - Story 6.3 Task 2.1
  const renderSendersList = () => {
    // Error handling (MEDIUM-5 fix)
    if (sendersError) {
      return <CommunityErrorState onRetry={() => refetchSenders()} />;
    }

    if (isSendersPending) {
      return <CommunityListSkeleton />;
    }

    const sendersList = (topSenders ?? []) as TopCommunitySenderData[];

    if (sendersList.length === 0) {
      return (
        <div className="text-center py-12">
          <p className="text-xl font-medium mb-2">{m.community_noSendersTitle()}</p>
          <p className="text-muted-foreground">
            {m.community_noSendersDesc()}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {sendersList.map((senderItem) => (
          <SenderCard key={senderItem.email} sender={senderItem} />
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      {/* Onboarding modal - shows once for new users */}
      <SharingOnboardingModal />

      {/* Story 9.8 Task 5.1: Preview modal */}
      {previewNewsletter && (
        <CommunityNewsletterPreviewModal
          contentId={previewNewsletter._id as Id<"newsletterContent">}
          subject={previewNewsletter.subject}
          senderName={previewNewsletter.senderName}
          senderEmail={previewNewsletter.senderEmail}
          onClose={() => setPreviewNewsletter(null)}
          alreadyOwned={
            ownershipMap[previewNewsletter._id]?.hasPrivate ||
            ownershipMap[previewNewsletter._id]?.hasImported
          }
        />
      )}

      {/* Header - Story 9.8 Task 6.4: Updated description for admin-curated content */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">{m.community_title()}</h1>
        <p className="text-muted-foreground mt-1">
          {m.community_description()}
        </p>
      </div>

      {/* Tab navigation - Story 6.3 Task 2.1 (with accessibility attributes) */}
      <div
        role="tablist"
        aria-label="Community browse options"
        className="flex gap-2 mb-6 border-b"
      >
        <button
          role="tab"
          aria-selected={tab !== "senders"}
          aria-controls="newsletters-panel"
          id="newsletters-tab"
          onClick={() => handleTabChange("newsletters")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab !== "senders"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {m.community_newsletters()}
        </button>
        <button
          role="tab"
          aria-selected={tab === "senders"}
          aria-controls="senders-panel"
          id="senders-tab"
          onClick={() => handleTabChange("senders")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            tab === "senders"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {m.community_browseBySender()}
        </button>
      </div>

      {/* Newsletters tab content */}
      {tab !== "senders" && (
        <div role="tabpanel" id="newsletters-panel" aria-labelledby="newsletters-tab">
          {/* Search input - Story 6.3 Task 1.1 */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={m.community_searchPlaceholder()}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Controls: Sort + Sender filter + Domain filter + Selection mode - only show when not searching */}
          {!deferredSearchQuery && (
            <div className="flex flex-wrap items-center gap-3 mb-6">
              {/* Story 9.9 Task 5.1: Selection mode toggle */}
              <Button
                variant={selectionMode ? "secondary" : "outline"}
                size="sm"
                onClick={handleToggleSelectionMode}
                className="gap-2"
              >
                {selectionMode ? (
                  <>
                    <CheckSquare className="h-4 w-4" aria-hidden="true" />
                    {m.community_exitSelection()}
                  </>
                ) : (
                  <>
                    <Square className="h-4 w-4" aria-hidden="true" />
                    {m.community_selectMultiple()}
                  </>
                )}
              </Button>

              {/* Story 9.9 Task 5.6: Select All / Clear buttons when in selection mode */}
              {selectionMode && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSelectAllVisible}
                    disabled={
                      selectedIds.size ===
                      displayNewsletters.filter(
                        (n) =>
                          !ownershipMap[n._id]?.hasPrivate && !ownershipMap[n._id]?.hasImported,
                      ).length
                    }
                  >
                    {m.community_selectAllVisible()}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearSelection}
                    disabled={selectedIds.size === 0}
                  >
                    {m.community_clearSelection()}
                  </Button>
                  <span className="text-sm text-muted-foreground">{m.community_selectedCount({ count: selectedIds.size })}</span>
                </>
              )}

              {/* Separator when both selection mode controls and filters are shown */}
              {selectionMode && <div className="h-6 border-l border-border" />}
              {/* Sort control - Story 9.8 Task 6.1: Added Most Imported option */}
              <Select value={sort || "popular"} onValueChange={(v) => v !== null && handleSortChange(v)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder={m.community_sortBy()} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="popular">{m.community_sortPopular()}</SelectItem>
                  <SelectItem value="imports">{m.community_sortMostImported()}</SelectItem>
                  <SelectItem value="recent">{m.community_sortRecent()}</SelectItem>
                </SelectContent>
              </Select>

              {/* Sender filter */}
              <Select value={sender || "all"} onValueChange={(v) => v !== null && handleSenderChange(v)}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={m.community_allSenders()} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{m.community_allSenders()}</SelectItem>
                  {senders.map((s) => (
                    <SelectItem key={s.email} value={s.email}>
                      {s.name || s.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Story 6.4 Task 3.2: Domain filter */}
              <Select value={domain || "all"} onValueChange={(v) => v !== null && handleDomainChange(v)}>
                <SelectTrigger className="w-[180px]" aria-label={m.community_filterByDomain()}>
                  <SelectValue placeholder={m.community_allDomains()} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{m.community_allDomains()}</SelectItem>
                  {domains.map((d) => (
                    <SelectItem key={d.domain} value={d.domain}>
                      {d.domain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Newsletter list */}
          {renderNewsletterList()}

          {/* Story 9.9 Task 5.3-5.5: Bulk import bar */}
          <BulkImportBar
            selectedIds={selectedIds}
            onClearSelection={handleClearSelection}
            onImportComplete={handleImportComplete}
          />
        </div>
      )}

      {/* Senders tab content - Story 6.3 Task 2.1 */}
      {tab === "senders" && (
        <div role="tabpanel" id="senders-panel" aria-labelledby="senders-tab">
          {renderSendersList()}
        </div>
      )}
    </div>
  );
}
