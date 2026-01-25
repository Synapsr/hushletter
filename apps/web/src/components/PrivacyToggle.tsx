/**
 * PrivacyToggle Component
 * Story 6.2: Reusable privacy toggle for sender settings
 * Uses existing updateSenderSettings mutation from senders.ts
 */

import { useState } from "react"
import { useQueryClient, useMutation } from "@tanstack/react-query"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@newsletter-manager/backend"
import type { Id } from "@newsletter-manager/backend/convex/_generated/dataModel"
import { Lock, Unlock, AlertCircle } from "lucide-react"
import { Switch } from "~/components/ui/switch"
import { Tooltip } from "~/components/ui/tooltip"

interface PrivacyToggleProps {
  senderId: Id<"senders">
  isPrivate: boolean
  /** Optional: Show compact version without label */
  compact?: boolean
}

/**
 * Privacy toggle component for sender settings
 * AC #1: Toggle "Private" option for a sender, updates userSenderSettings.isPrivate
 */
export function PrivacyToggle({ senderId, isPrivate, compact = false }: PrivacyToggleProps) {
  const queryClient = useQueryClient()
  const mutationFn = useConvexMutation(api.senders.updateSenderSettings)
  const [error, setError] = useState<string | null>(null)

  const { mutateAsync, isPending } = useMutation({
    mutationFn,
    onSuccess: () => {
      setError(null)
      queryClient.invalidateQueries()
    },
  })

  const handleToggle = async (checked: boolean) => {
    try {
      setError(null)
      await mutateAsync({ senderId, isPrivate: checked })
    } catch (err) {
      console.error("[PrivacyToggle] Failed to update privacy setting:", err)
      setError("Failed to update")
      // Clear error after 3 seconds
      setTimeout(() => setError(null), 3000)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error ? (
        <Tooltip content={error}>
          <AlertCircle className="h-4 w-4 text-destructive" aria-label="Error updating privacy" />
        </Tooltip>
      ) : isPrivate ? (
        <Lock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      ) : (
        <Unlock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      )}
      <Switch
        checked={isPrivate}
        onCheckedChange={handleToggle}
        disabled={isPending}
        aria-label={isPrivate ? "Mark sender as public" : "Mark sender as private"}
      />
      {!compact && (
        <span className="text-sm text-muted-foreground">
          {isPrivate ? "Private" : "Public"}
        </span>
      )}
    </div>
  )
}
