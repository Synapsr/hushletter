/**
 * FollowButton - Follow/Unfollow a sender from the community
 * Story 6.4 Task 1.5
 *
 * Two states:
 * - "Follow" (outline) - User is not following this sender
 * - "Following" (filled with checkmark) - User is following this sender
 *
 * Features:
 * - Loading state during mutation
 * - Optimistic update for immediate feedback
 * - Visual feedback on follow/unfollow
 */
import { useState } from "react"
import { useMutation } from "convex/react"
import { useQuery as useTanstackQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@newsletter-manager/backend"
import { Button } from "~/components/ui/button"
import { UserPlus, UserCheck, Loader2 } from "lucide-react"

interface FollowButtonProps {
  senderEmail: string
  senderName?: string
  /** Variant for different display contexts */
  variant?: "default" | "compact"
  /** Callback when follow state changes */
  onFollowChange?: (isFollowing: boolean) => void
}

export function FollowButton({
  senderEmail,
  senderName,
  variant = "default",
  onFollowChange,
}: FollowButtonProps) {
  const [isOptimisticFollowing, setIsOptimisticFollowing] = useState<boolean | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Check current follow status
  const { data: isFollowingData, isPending: isLoadingStatus } = useTanstackQuery(
    convexQuery(api.community.isFollowingSender, { senderEmail })
  )
  const isFollowing = isFollowingData as boolean | undefined

  // Follow/unfollow mutations
  const followSender = useMutation(api.community.followSender)
  const unfollowSender = useMutation(api.community.unfollowSender)

  // Determine displayed state (optimistic takes precedence)
  const displayFollowing = isOptimisticFollowing ?? isFollowing ?? false

  const handleClick = async () => {
    if (isLoading || isLoadingStatus) return

    setIsLoading(true)
    const wasFollowing: boolean = displayFollowing

    // Optimistic update
    setIsOptimisticFollowing(!wasFollowing)

    try {
      if (wasFollowing) {
        const result = await unfollowSender({ senderEmail })

        if (result.hasNewsletters) {
          // User has newsletters - can't fully unfollow, revert
          setIsOptimisticFollowing(true)
        } else {
          onFollowChange?.(false)
        }
      } else {
        await followSender({ senderEmail })
        onFollowChange?.(true)
      }
    } catch (_error) {
      // Revert optimistic update on error
      setIsOptimisticFollowing(wasFollowing)
    } finally {
      setIsLoading(false)
      // Clear optimistic state - the query will update with the real value
      // We delay slightly to avoid flicker if query updates quickly
      setTimeout(() => setIsOptimisticFollowing(null), 100)
    }
  }

  if (isLoadingStatus) {
    return (
      <Button
        variant="outline"
        size={variant === "compact" ? "sm" : "default"}
        disabled
        aria-label="Loading follow status"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        {variant === "default" && <span className="ml-2">Loading</span>}
      </Button>
    )
  }

  return (
    <Button
      variant={displayFollowing ? "default" : "outline"}
      size={variant === "compact" ? "sm" : "default"}
      onClick={handleClick}
      disabled={isLoading}
      aria-label={displayFollowing ? `Unfollow ${senderName || senderEmail}` : `Follow ${senderName || senderEmail}`}
      aria-pressed={displayFollowing ? "true" : "false"}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : displayFollowing ? (
        <UserCheck className="h-4 w-4" />
      ) : (
        <UserPlus className="h-4 w-4" />
      )}
      {variant === "default" && (
        <span className="ml-2">{displayFollowing ? "Following" : "Follow"}</span>
      )}
    </Button>
  )
}
