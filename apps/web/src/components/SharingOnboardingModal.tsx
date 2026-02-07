import { useState } from "react"
import { Link } from "@tanstack/react-router"
import { useMutation } from "convex/react"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@hushletter/backend"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { Button } from "~/components/ui/button"
import { Globe, Lock, Users } from "lucide-react"

/**
 * SharingOnboardingModal - Explains community sharing to new users
 * Story 6.1: Task 5.1-5.4
 *
 * Shows once after user registration to explain:
 * - Newsletters are shared with the community by default
 * - This helps everyone discover great content
 * - Users can mark specific senders as private in Settings
 *
 * The modal auto-shows if hasSeenSharingOnboarding is false.
 * Dismissing updates the user record to prevent future display.
 */
export function SharingOnboardingModal() {
  const [isOpen, setIsOpen] = useState(true)

  // Check if user has already seen this onboarding
  const { data: hasSeen } = useQuery(
    convexQuery(api.community.hasSeenSharingOnboarding, {})
  )

  // Mutation to mark onboarding as seen
  const dismissOnboarding = useMutation(api.community.dismissSharingOnboarding)

  // Handle dismiss - update user record and close modal
  const handleDismiss = async () => {
    try {
      await dismissOnboarding()
    } catch (error) {
      console.error("[SharingOnboardingModal] Failed to dismiss:", error)
    }
    setIsOpen(false)
  }

  // Don't render if already seen or still loading
  if (hasSeen === undefined || hasSeen === true) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleDismiss()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Welcome to the Community
          </DialogTitle>
          <DialogDescription>
            Your newsletters help build a shared library for everyone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Benefit 1: Shared by default */}
          <div className="flex gap-3">
            <div className="shrink-0 mt-0.5">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Shared by Default</p>
              <p className="text-sm text-muted-foreground">
                Newsletters you receive are shared with the community,
                helping everyone discover great content from publishers
                they might not know about.
              </p>
            </div>
          </div>

          {/* Benefit 2: Privacy controls */}
          <div className="flex gap-3">
            <div className="shrink-0 mt-0.5">
              <Lock className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="font-medium text-sm">You're in Control</p>
              <p className="text-sm text-muted-foreground">
                You can mark specific senders as private anytime.
                Private newsletters are never shared and only you can see them.
              </p>
            </div>
          </div>

          {/* Privacy note */}
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-xs text-muted-foreground">
              Your identity is never revealed. Community members can see
              newsletter content but not who contributed it.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {/* Story 6.2: Link directly to privacy settings page */}
          <Link to="/settings/privacy" onClick={handleDismiss}>
            <Button variant="outline" size="sm">
              Privacy Settings
            </Button>
          </Link>
          <Button onClick={handleDismiss} size="sm">
            Got it, thanks!
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
