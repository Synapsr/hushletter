import { convexQuery } from "@convex-dev/react-query"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@newsletter-manager/backend"
import { useConvexMutation } from "@convex-dev/react-query"
import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { Button } from "~/components/ui/button"
import { Skeleton } from "~/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { Label } from "~/components/ui/label"
import { Ban, Unlock, FileText } from "lucide-react"
import type { Id } from "@newsletter-manager/backend/convex/_generated/dataModel"

/** Blocked sender item returned from listBlockedSenders */
interface BlockedSenderItem {
  id: Id<"blockedSenders">
  senderId: Id<"senders">
  senderEmail: string
  senderName: string | undefined
  domain: string
  reason: string
  blockedAt: number
  blockedByEmail: string
  contentCount: number
}

/**
 * Blocked Senders Table - Displays blocked senders with unblock actions
 * Story 7.4: Task 8.1 - Blocked senders management
 *
 * Features:
 * - List of blocked senders with details
 * - Content count for each sender
 * - Unblock action with option to restore content
 */
export function BlockedSendersTable() {
  const queryClient = useQueryClient()
  const [unblockDialogOpen, setUnblockDialogOpen] = useState(false)
  const [selectedSender, setSelectedSender] = useState<{
    senderId: string
    senderEmail: string
    contentCount: number
  } | null>(null)
  const [restoreContent, setRestoreContent] = useState(true)

  // Query
  const { data, isPending, isError } = useQuery(
    convexQuery(api.admin.listBlockedSenders, { limit: 50 })
  )

  // Mutation
  const unblockSenderFn = useConvexMutation(api.admin.unblockSender)
  const unblockMutation = useMutation({ mutationFn: unblockSenderFn })

  /** Invalidate blocked senders queries */
  const invalidateBlockedSendersQueries = async () => {
    await queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        query.queryKey.some(
          (key) =>
            typeof key === "string" &&
            (key.includes("listBlockedSenders") ||
              key.includes("listCommunityContent") ||
              key.includes("getCommunityContentSummary") ||
              key.includes("listModerationLog"))
        ),
    })
  }

  const handleUnblock = async () => {
    if (!selectedSender) return

    await unblockMutation.mutateAsync({
      senderId: selectedSender.senderId as Id<"senders">,
      restoreContent,
    })

    await invalidateBlockedSendersQueries()

    setUnblockDialogOpen(false)
    setSelectedSender(null)
    setRestoreContent(true)
  }

  const openUnblockDialog = (sender: {
    senderId: string
    senderEmail: string
    contentCount: number
  }) => {
    setSelectedSender(sender)
    setRestoreContent(true)
    setUnblockDialogOpen(true)
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString()
  }

  if (isError) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Failed to load blocked senders
      </div>
    )
  }

  if (isPending) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={`row-skeleton-${i}`} className="h-16" />
        ))}
      </div>
    )
  }

  const blockedSenders = (data ?? []) as BlockedSenderItem[]

  if (blockedSenders.length === 0) {
    return (
      <div className="text-center py-12">
        <Ban className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium">No Blocked Senders</h3>
        <p className="text-muted-foreground">
          No senders have been blocked from the community.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sender</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>
                <div className="flex items-center gap-1">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  Content
                </div>
              </TableHead>
              <TableHead>Blocked At</TableHead>
              <TableHead>Blocked By</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {blockedSenders.map((sender) => (
              <TableRow key={sender.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{sender.senderEmail}</span>
                    {sender.senderName && (
                      <span className="text-xs text-muted-foreground">
                        {sender.senderName}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>{sender.domain}</TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {sender.reason}
                </TableCell>
                <TableCell>{sender.contentCount} items</TableCell>
                <TableCell>{formatDate(sender.blockedAt)}</TableCell>
                <TableCell>{sender.blockedByEmail}</TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={unblockMutation.isPending}
                    onClick={() =>
                      openUnblockDialog({
                        senderId: sender.senderId,
                        senderEmail: sender.senderEmail,
                        contentCount: sender.contentCount,
                      })
                    }
                    aria-label={`Unblock ${sender.senderEmail}`}
                  >
                    <Unlock className="h-4 w-4 mr-1" aria-hidden="true" />
                    Unblock
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Unblock Dialog */}
      <Dialog open={unblockDialogOpen} onOpenChange={setUnblockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unblock Sender</DialogTitle>
            <DialogDescription>
              This will allow the sender's content to appear in the community
              again.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium">Sender</Label>
              <p className="text-sm text-muted-foreground">
                {selectedSender?.senderEmail}
              </p>
            </div>
            <div>
              <Label className="text-sm font-medium">Content affected</Label>
              <p className="text-sm text-muted-foreground">
                {selectedSender?.contentCount} newsletters
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="restore-content"
                checked={restoreContent}
                onChange={(e) => setRestoreContent(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="restore-content" className="text-sm">
                Restore all hidden content from this sender
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setUnblockDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleUnblock} disabled={unblockMutation.isPending}>
              {unblockMutation.isPending ? "Unblocking..." : "Unblock Sender"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
