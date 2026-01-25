import { useRef, useCallback, useMemo } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { useConvex } from "convex/react"
import { api } from "@newsletter-manager/backend"
import type { Id } from "@newsletter-manager/backend/convex/_generated/dataModel"
import {
  CommunityNewsletterCard,
  type CommunityNewsletterData,
} from "~/components/CommunityNewsletterCard"
import { SharingOnboardingModal } from "~/components/SharingOnboardingModal"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { convexQuery } from "@convex-dev/react-query"
import { Loader2 } from "lucide-react"

/** Response type from listCommunityNewsletters query */
type CommunityNewslettersResponse = {
  items: CommunityNewsletterData[]
  nextCursor: Id<"newsletterContent"> | null
  cursorValue: number | null
  cursorId: Id<"newsletterContent"> | null
}

/** Response type from listCommunitySenders query */
type CommunitySenderData = {
  email: string
  name: string | undefined
  newsletterCount: number
  totalReaders: number
}

/**
 * Search params for community browse page
 * Story 6.1: Task 2.3-2.4
 */
type CommunitySearchParams = {
  sort?: "popular" | "recent"
  sender?: string
}

export const Route = createFileRoute("/_authed/community/")({
  component: CommunityBrowsePage,
  validateSearch: (search: Record<string, unknown>): CommunitySearchParams => {
    const sort = search.sort === "recent" ? "recent" : undefined // Default is popular
    const sender = typeof search.sender === "string" ? search.sender : undefined
    return { sort, sender }
  },
})

/**
 * Skeleton loader for community newsletter list
 */
function CommunityListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="animate-pulse bg-card border rounded-xl p-4 space-y-2"
        >
          <div className="flex justify-between">
            <div className="h-4 bg-muted rounded w-1/4" />
            <div className="h-3 bg-muted rounded w-16" />
          </div>
          <div className="h-5 bg-muted rounded w-3/4" />
        </div>
      ))}
    </div>
  )
}

/**
 * Empty state when no community newsletters found
 */
function EmptyCommunityState({ senderFilter }: { senderFilter?: string }) {
  if (senderFilter) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          No newsletters found from this sender in the community.
        </p>
      </div>
    )
  }

  return (
    <div className="text-center py-12">
      <p className="text-xl font-medium mb-2">No community newsletters yet</p>
      <p className="text-muted-foreground">
        Newsletters shared by users will appear here. Subscribe to some
        newsletters to help build the community library!
      </p>
    </div>
  )
}

/**
 * CommunityBrowsePage - Browse public newsletter content
 * Story 6.1: Task 2.1-2.6
 *
 * Features:
 * - List newsletters from newsletterContent (public/shared content only)
 * - Sort by popular (readerCount) or recent (firstReceivedAt)
 * - Filter by sender
 * - Infinite scroll pagination using TanStack Query's useInfiniteQuery
 * - Reader count badges
 * - Navigate to community reader view
 *
 * Note: Uses useInfiniteQuery for proper infinite scroll state management,
 * which is the recommended pattern for paginated server data.
 */
function CommunityBrowsePage() {
  const { sort, sender } = Route.useSearch()
  const navigate = Route.useNavigate()
  const convex = useConvex()

  // Infinite scroll observer ref
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Use TanStack Query's useInfiniteQuery for proper pagination state management
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isPending,
  } = useInfiniteQuery({
    queryKey: ["community-newsletters", sort, sender],
    queryFn: async ({ pageParam }) => {
      const result = await convex.query(api.community.listCommunityNewsletters, {
        sortBy: sort || "popular",
        senderEmail: sender,
        cursorValue: pageParam?.cursorValue,
        cursorId: pageParam?.cursorId,
        limit: 20,
      })
      return result as CommunityNewslettersResponse
    },
    initialPageParam: undefined as { cursorValue: number; cursorId: Id<"newsletterContent"> } | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.cursorValue || !lastPage.cursorId) return undefined
      return { cursorValue: lastPage.cursorValue, cursorId: lastPage.cursorId }
    },
  })

  // Flatten paginated results
  const allNewsletters = useMemo(() => {
    return data?.pages.flatMap((page) => page.items) ?? []
  }, [data])

  // Fetch senders for filter dropdown
  const { data: sendersData } = useQuery(
    convexQuery(api.community.listCommunitySenders, { limit: 50 })
  )
  const senders = (sendersData ?? []) as CommunitySenderData[]

  // Load more callback for infinite scroll
  const loadMore = useCallback(() => {
    if (!isFetching && hasNextPage) {
      fetchNextPage()
    }
  }, [isFetching, hasNextPage, fetchNextPage])

  // Intersection observer for infinite scroll
  const observerCallback = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting) {
        loadMore()
      }
    },
    [loadMore]
  )

  // Set up intersection observer
  const setLoadMoreRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        const observer = new IntersectionObserver(observerCallback, {
          threshold: 0.1,
        })
        observer.observe(node)
        return () => observer.disconnect()
      }
    },
    [observerCallback]
  )

  // Handle sort change
  const handleSortChange = (value: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        sort: value === "popular" ? undefined : (value as "recent"),
      }),
    })
  }

  // Handle sender filter change
  const handleSenderChange = (value: string) => {
    navigate({
      search: (prev) => ({
        ...prev,
        sender: value === "all" ? undefined : value,
      }),
    })
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      {/* Onboarding modal - shows once for new users */}
      <SharingOnboardingModal />

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Community</h1>
        <p className="text-muted-foreground mt-1">
          Discover newsletters shared by the community
        </p>
      </div>

      {/* Controls: Sort + Sender filter */}
      <div className="flex flex-wrap gap-3 mb-6">
        {/* Sort control */}
        <Select value={sort || "popular"} onValueChange={handleSortChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="popular">Popular</SelectItem>
            <SelectItem value="recent">Recent</SelectItem>
          </SelectContent>
        </Select>

        {/* Sender filter */}
        <Select value={sender || "all"} onValueChange={handleSenderChange}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All senders" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All senders</SelectItem>
            {senders.map((s) => (
              <SelectItem key={s.email} value={s.email}>
                {s.name || s.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Newsletter list */}
      {isPending ? (
        <CommunityListSkeleton />
      ) : allNewsletters.length === 0 ? (
        <EmptyCommunityState senderFilter={sender} />
      ) : (
        <div className="space-y-3">
          {allNewsletters.map((newsletter) => (
            <CommunityNewsletterCard key={newsletter._id} newsletter={newsletter} />
          ))}

          {/* Infinite scroll trigger */}
          <div
            ref={(node) => {
              loadMoreRef.current = node
              setLoadMoreRef(node)
            }}
            className="h-20 flex items-center justify-center"
          >
            {isFetchingNextPage && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Loading more...</span>
              </div>
            )}
            {!hasNextPage && allNewsletters.length > 0 && (
              <p className="text-sm text-muted-foreground">
                You've reached the end
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
