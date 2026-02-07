/**
 * Sender Detail View for Community
 * Story 6.3: Task 2.3-2.5
 * Story 6.4: Task 2.1-2.4 - Added follow button, subscriber badge, subscribe info
 *
 * Shows all newsletters from a specific sender in the community database.
 * Displays sender info with subscriber count badge.
 * Uses infinite scroll for efficient loading of newsletters.
 *
 * PRIVACY: Only shows public data from newsletterContent and senders tables.
 * No user-specific data is exposed.
 */
import { useRef, useCallback } from "react"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery, useInfiniteQuery } from "@tanstack/react-query"
import { useConvex } from "convex/react"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@hushletter/backend"
import type { Id } from "@hushletter/backend/convex/_generated/dataModel"
import {
  CommunityNewsletterCard,
  type CommunityNewsletterData,
} from "~/components/CommunityNewsletterCard"
import { FollowButton } from "~/components/FollowButton"
import { SubscribeInfo } from "~/components/SubscribeInfo"
import { ArrowLeft, Users, Mail, Loader2 } from "lucide-react"

export const Route = createFileRoute("/_authed/community/sender/$senderEmail")({
  component: SenderDetailPage,
})

/** Response type from getSenderByEmailPublic query */
type SenderData = {
  _id: string
  email: string
  name: string | undefined
  displayName: string
  domain: string
  subscriberCount: number
  newsletterCount: number
}

/** Response type from listCommunityNewslettersBySender query */
type NewslettersResponse = {
  items: CommunityNewsletterData[]
  nextCursor: string | null
}

/**
 * Skeleton loader for sender detail page
 */
function SenderDetailSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Header skeleton */}
      <div className="mb-6">
        <div className="h-8 bg-muted rounded w-1/3 mb-2" />
        <div className="h-4 bg-muted rounded w-1/4 mb-4" />
        <div className="h-4 bg-muted rounded w-1/5" />
      </div>
      {/* List skeleton */}
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="bg-card border rounded-xl p-4 space-y-2"
          >
            <div className="flex justify-between">
              <div className="h-4 bg-muted rounded w-1/4" />
              <div className="h-3 bg-muted rounded w-16" />
            </div>
            <div className="h-5 bg-muted rounded w-3/4" />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Empty state when sender has no newsletters
 */
function EmptySenderState({ senderEmail }: { senderEmail: string }) {
  return (
    <div className="text-center py-12">
      <Mail className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
      <p className="text-lg font-medium mb-2">No newsletters yet</p>
      <p className="text-muted-foreground">
        No newsletters from {senderEmail} have been shared to the community.
      </p>
    </div>
  )
}

/**
 * Not found state when sender doesn't exist
 */
function SenderNotFound({ senderEmail }: { senderEmail: string }) {
  return (
    <div className="text-center py-12">
      <p className="text-lg font-medium mb-2">Sender not found</p>
      <p className="text-muted-foreground">
        No sender with email {senderEmail} was found in the community.
      </p>
      <Link
        to="/community"
        className="inline-flex items-center gap-1 mt-4 text-sm text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Community
      </Link>
    </div>
  )
}

/**
 * SenderDetailPage - Show all newsletters from a sender
 * Story 6.3: Task 2.3-2.5
 *
 * Displays:
 * - Sender name/email
 * - Subscriber count badge ("X users subscribe")
 * - Newsletter count
 * - List of newsletters with infinite scroll
 */
function SenderDetailPage() {
  const { senderEmail } = Route.useParams()
  const decodedEmail = decodeURIComponent(senderEmail)
  const convex = useConvex()
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Fetch sender info - Story 6.3 Task 2.4
  const { data: sender, isPending: isSenderPending, error: senderError } = useQuery({
    ...convexQuery(api.senders.getSenderByEmailPublic, { email: decodedEmail }),
  })

  // Fetch newsletters with infinite scroll - Story 6.3 Task 2.4 (improved)
  const {
    data: newslettersData,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    isPending: isNewslettersPending,
    error: newslettersError,
  } = useInfiniteQuery({
    queryKey: ["sender-newsletters", decodedEmail],
    queryFn: async ({ pageParam }) => {
      const result = await convex.query(api.community.listCommunityNewslettersBySender, {
        senderEmail: decodedEmail,
        sortBy: "recent",
        cursor: pageParam as Id<"newsletterContent"> | undefined,
        limit: 20,
      })
      return result as NewslettersResponse
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })

  const senderData = sender as SenderData | null | undefined
  const newsletters = newslettersData?.pages.flatMap((page: NewslettersResponse) => page.items) ?? []

  const isLoading = isSenderPending || isNewslettersPending

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

  // Error state - MEDIUM-5 fix: Add error handling
  if (senderError || newslettersError) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-4xl">
        <div className="mb-4">
          <Link
            to="/community"
            search={{ tab: "senders" }}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Browse by Sender
          </Link>
        </div>
        <div className="text-center py-12">
          <p className="text-lg font-medium mb-2 text-destructive">Something went wrong</p>
          <p className="text-muted-foreground">
            Failed to load sender details. Please try again later.
          </p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-4xl">
        {/* Back button */}
        <div className="mb-4">
          <Link
            to="/community"
            search={{ tab: "senders" }}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Browse by Sender
          </Link>
        </div>
        <SenderDetailSkeleton />
      </div>
    )
  }

  // Sender not found
  if (!senderData) {
    return (
      <div className="container mx-auto py-6 px-4 max-w-4xl">
        <div className="mb-4">
          <Link
            to="/community"
            search={{ tab: "senders" }}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Browse by Sender
          </Link>
        </div>
        <SenderNotFound senderEmail={decodedEmail} />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-4xl">
      {/* Back button */}
      <div className="mb-4">
        <Link
          to="/community"
          search={{ tab: "senders" }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Browse by Sender
        </Link>
      </div>

      {/* Sender header - Story 6.3 Task 2.4, 2.5, Story 6.4 Task 2.1-2.4 */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              {senderData.displayName}
            </h1>
            {senderData.name && (
              <p className="text-muted-foreground mt-1">{senderData.email}</p>
            )}
          </div>
          {/* Story 6.4 Task 1.5, 2.4: Follow button */}
          <FollowButton
            senderEmail={senderData.email}
            senderName={senderData.displayName}
          />
        </div>
        <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
          {/* Story 6.4 Task 2.1: Subscriber count badge - "X users subscribe to this" */}
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            <span>
              {senderData.subscriberCount}{" "}
              {senderData.subscriberCount === 1 ? "user subscribes" : "users subscribe"} to this
            </span>
          </div>
          <span>|</span>
          <span>
            {senderData.newsletterCount}{" "}
            {senderData.newsletterCount === 1 ? "newsletter" : "newsletters"}
          </span>
        </div>
      </div>

      {/* Story 6.4 Task 2.2: Subscribe info section */}
      <div className="mb-6">
        <SubscribeInfo
          senderEmail={senderData.email}
          senderName={senderData.displayName}
          domain={senderData.domain}
        />
      </div>

      {/* Newsletter list with infinite scroll */}
      {newsletters.length === 0 ? (
        <EmptySenderState senderEmail={decodedEmail} />
      ) : (
        <div className="space-y-3">
          {newsletters.map((newsletter) => (
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
            {!hasNextPage && newsletters.length > 0 && (
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
