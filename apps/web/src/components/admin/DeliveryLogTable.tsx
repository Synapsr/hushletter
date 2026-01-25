import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { DeliveryStatusBadge } from "./DeliveryStatusBadge"
import { DeliveryDetailPanel } from "./DeliveryDetailPanel"
import { ChevronDown, ChevronRight } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { Button } from "~/components/ui/button"
import { cn } from "~/lib/utils"
import type { Id } from "@newsletter-manager/backend/convex/_generated/dataModel"

/**
 * Delivery log item type from listDeliveryLogs query
 * Story 7.2: Task 4.3
 * Exported for reuse in DeliveryDetailPanel
 */
export interface DeliveryLog {
  _id: Id<"emailDeliveryLogs">
  recipientEmail: string
  senderEmail: string
  senderName?: string
  subject: string
  messageId: string
  userId?: Id<"users">
  status: "received" | "processing" | "stored" | "failed"
  receivedAt: number
  processingStartedAt?: number
  completedAt?: number
  errorMessage?: string
  errorCode?: string
  contentSizeBytes?: number
  hasHtmlContent?: boolean
  hasPlainTextContent?: boolean
  retryCount: number
  isAcknowledged: boolean
}

/**
 * Props for the DeliveryLogTable component
 */
interface DeliveryLogTableProps {
  /** Array of delivery log items to display */
  logs: DeliveryLog[]
  /** Whether more items exist for pagination */
  hasMore: boolean
}

/**
 * DeliveryLogTable displays a paginated table of delivery logs with expandable rows
 * Story 7.2: Task 4.3 - Paginated log table with filters
 *
 * Features:
 * - Expandable rows showing detailed information
 * - Status badges for visual status indication
 * - Failed rows highlighted with red background
 * - Relative timestamps for received time
 *
 * @example
 * <DeliveryLogTable logs={deliveryLogs} hasMore={true} />
 */
export function DeliveryLogTable({ logs, hasMore }: DeliveryLogTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (logs.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        No delivery logs found
      </p>
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">
              <span className="sr-only">Expand row</span>
            </TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Sender</TableHead>
            <TableHead>Recipient</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Received</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => {
            const isExpanded = expandedId === log._id
            return (
              <TableRowWithDetail
                key={log._id}
                log={log}
                isExpanded={isExpanded}
                onToggle={() => setExpandedId(isExpanded ? null : log._id)}
              />
            )
          })}
        </TableBody>
      </Table>

      {hasMore && (
        <div className="text-center py-4 text-sm text-muted-foreground">
          Showing first 50 results. Use status filter to narrow results.
        </div>
      )}
    </>
  )
}

/**
 * Internal component for a table row with expandable detail
 */
function TableRowWithDetail({
  log,
  isExpanded,
  onToggle,
}: {
  log: DeliveryLog
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <>
      <TableRow
        className={cn(
          "cursor-pointer hover:bg-muted/50",
          log.status === "failed" && "bg-red-50 dark:bg-red-950/20"
        )}
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <TableCell>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            aria-label={isExpanded ? "Collapse row" : "Expand row"}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        </TableCell>
        <TableCell className="font-medium truncate max-w-[200px]" title={log.subject}>
          {log.subject}
        </TableCell>
        <TableCell className="truncate max-w-[150px]" title={log.senderEmail}>
          {log.senderName || log.senderEmail}
        </TableCell>
        <TableCell className="truncate max-w-[150px]" title={log.recipientEmail}>
          {log.recipientEmail}
        </TableCell>
        <TableCell>
          <DeliveryStatusBadge status={log.status} />
        </TableCell>
        <TableCell className="text-muted-foreground">
          {formatDistanceToNow(log.receivedAt, { addSuffix: true })}
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/30 p-0">
            <DeliveryDetailPanel log={log} />
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
