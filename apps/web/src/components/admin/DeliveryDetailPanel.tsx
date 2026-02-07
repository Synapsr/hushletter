import { useMutation } from "@tanstack/react-query"
import { useConvexMutation } from "@convex-dev/react-query"
import { api } from "@hushletter/backend"
import { Button } from "~/components/ui/button"
import { Badge } from "~/components/ui/badge"
import { format } from "date-fns"
import type { DeliveryLog } from "./DeliveryLogTable"

/**
 * Props for the DeliveryDetailPanel component
 */
interface DeliveryDetailPanelProps {
  /** The delivery log to display details for */
  log: DeliveryLog
}

/**
 * DeliveryDetailPanel displays detailed information about a delivery log
 * Story 7.2: Task 5.1 - Expandable row details
 *
 * Shows:
 * - Email metadata (message ID, sender, recipient, subject)
 * - Processing timeline with timestamps
 * - Content information (size, type)
 * - Error details for failed deliveries
 * - Acknowledge button for failed deliveries
 *
 * @example
 * <DeliveryDetailPanel log={selectedLog} />
 */
export function DeliveryDetailPanel({ log }: DeliveryDetailPanelProps) {
  // Fix: Call hooks at top level per Rules of Hooks
  const acknowledgeConvexMutation = useConvexMutation(api.admin.acknowledgeFailedDelivery)
  const acknowledgeMutation = useMutation({
    mutationFn: acknowledgeConvexMutation,
  })

  return (
    <div className="p-4 space-y-4">
      {/* Email Details */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground">Message ID</p>
          <p className="font-mono text-xs break-all">{log.messageId}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Recipient</p>
          <p>{log.recipientEmail}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Sender</p>
          <p>
            {log.senderName ? `${log.senderName} <${log.senderEmail}>` : log.senderEmail}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Subject</p>
          <p className="break-words">{log.subject}</p>
        </div>
      </div>

      {/* Timeline */}
      <div className="border-t pt-4">
        <p className="font-medium mb-2">Processing Timeline</p>
        <div className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Received:</span>{" "}
            {format(log.receivedAt, "PPpp")}
          </p>
          {log.processingStartedAt && (
            <p>
              <span className="text-muted-foreground">Processing started:</span>{" "}
              {format(log.processingStartedAt, "PPpp")}
            </p>
          )}
          {log.completedAt && (
            <p>
              <span className="text-muted-foreground">Completed:</span>{" "}
              {format(log.completedAt, "PPpp")}{" "}
              <span className="text-muted-foreground">
                ({log.completedAt - log.receivedAt}ms total)
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Content Info */}
      {(log.contentSizeBytes !== undefined ||
        log.hasHtmlContent !== undefined ||
        log.hasPlainTextContent !== undefined) && (
        <div className="border-t pt-4">
          <p className="font-medium mb-2">Content Info</p>
          <div className="flex gap-2">
            {log.contentSizeBytes !== undefined && (
              <Badge variant="outline">
                {Math.round(log.contentSizeBytes / 1024)} KB
              </Badge>
            )}
            {log.hasHtmlContent && <Badge variant="outline">HTML</Badge>}
            {log.hasPlainTextContent && <Badge variant="outline">Plain Text</Badge>}
          </div>
        </div>
      )}

      {/* Error Info (for failed) */}
      {log.status === "failed" && (
        <div className="border-t pt-4">
          <p className="font-medium mb-2 text-red-600 dark:text-red-400">
            Error Details
          </p>
          {log.errorCode && (
            <Badge variant="destructive" className="mb-2">
              {log.errorCode}
            </Badge>
          )}
          <pre className="bg-red-50 dark:bg-red-950/30 p-3 rounded text-sm text-red-800 dark:text-red-200 overflow-auto max-h-[200px]">
            {log.errorMessage || "Unknown error"}
          </pre>

          <div className="mt-4 flex gap-2">
            {!log.isAcknowledged && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  acknowledgeMutation.mutate({ logId: log._id })
                }}
                disabled={acknowledgeMutation.isPending}
              >
                {acknowledgeMutation.isPending ? "..." : "Acknowledge"}
              </Button>
            )}
            {log.isAcknowledged && (
              <Badge variant="secondary">Acknowledged</Badge>
            )}
          </div>
        </div>
      )}

      {/* User Link (if resolved) */}
      {log.userId && (
        <div className="border-t pt-4">
          <p className="text-muted-foreground text-sm">
            User ID: <span className="font-mono">{log.userId}</span>
          </p>
        </div>
      )}

      {/* Retry Count */}
      {log.retryCount > 0 && (
        <div className="border-t pt-4">
          <p className="text-muted-foreground text-sm">
            Retry attempts: <span className="font-medium">{log.retryCount}</span>
          </p>
        </div>
      )}
    </div>
  )
}
