import { convexQuery } from "@convex-dev/react-query"
import { useQuery } from "@tanstack/react-query"
import { api } from "@hushletter/backend"
import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select"
import { Badge } from "~/components/ui/badge"
import { Skeleton } from "~/components/ui/skeleton"
import {
  Eye,
  EyeOff,
  Ban,
  Unlock,
  CheckCircle,
  XCircle,
  History,
} from "lucide-react"
import type { Id } from "@hushletter/backend/convex/_generated/dataModel"

/** Moderation log item returned from listModerationLog */
interface ModerationLogItem {
  id: Id<"moderationLog">
  actionType:
    | "hide_content"
    | "restore_content"
    | "block_sender"
    | "unblock_sender"
    | "resolve_report"
    | "dismiss_report"
  targetType: "content" | "sender" | "report"
  targetId: string
  reason: string | undefined
  details: Record<string, unknown> | null
  adminEmail: string
  createdAt: number
}

/**
 * Moderation Log Table - Displays audit trail of moderation actions
 * Story 7.4: Task 10.1-10.4 - Moderation audit log UI
 *
 * Features:
 * - Paginated list of moderation actions
 * - Filter by action type
 * - Show action details, admin, timestamp, reason
 */

const actionIcons: Record<string, React.ReactNode> = {
  hide_content: <EyeOff className="h-4 w-4" />,
  restore_content: <Eye className="h-4 w-4" />,
  block_sender: <Ban className="h-4 w-4" />,
  unblock_sender: <Unlock className="h-4 w-4" />,
  resolve_report: <CheckCircle className="h-4 w-4" />,
  dismiss_report: <XCircle className="h-4 w-4" />,
}

const actionLabels: Record<string, string> = {
  hide_content: "Hid Content",
  restore_content: "Restored Content",
  block_sender: "Blocked Sender",
  unblock_sender: "Unblocked Sender",
  resolve_report: "Resolved Report",
  dismiss_report: "Dismissed Report",
}

const actionVariants: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  hide_content: "secondary",
  restore_content: "default",
  block_sender: "destructive",
  unblock_sender: "default",
  resolve_report: "default",
  dismiss_report: "secondary",
}

type ActionType =
  | "hide_content"
  | "restore_content"
  | "block_sender"
  | "unblock_sender"
  | "resolve_report"
  | "dismiss_report"

export function ModerationLogTable() {
  const [actionFilter, setActionFilter] = useState<ActionType | "all">("all")

  // Query
  const { data, isPending, isError } = useQuery(
    convexQuery(api.admin.listModerationLog, {
      actionType: actionFilter === "all" ? undefined : actionFilter,
      limit: 50,
    })
  )

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString()
  }

  if (isError) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Failed to load moderation log
      </div>
    )
  }

  const logs = (data ?? []) as ModerationLogItem[]

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-4">
        <Select
          value={actionFilter}
          onValueChange={(v) => setActionFilter(v as ActionType | "all")}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="hide_content">Hide Content</SelectItem>
            <SelectItem value="restore_content">Restore Content</SelectItem>
            <SelectItem value="block_sender">Block Sender</SelectItem>
            <SelectItem value="unblock_sender">Unblock Sender</SelectItem>
            <SelectItem value="resolve_report">Resolve Report</SelectItem>
            <SelectItem value="dismiss_report">Dismiss Report</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={`row-skeleton-${i}`} className="h-16" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12">
          <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No Moderation History</h3>
          <p className="text-muted-foreground">
            {actionFilter === "all"
              ? "No moderation actions have been taken yet."
              : `No "${actionLabels[actionFilter]}" actions found.`}
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <Badge
                      variant={actionVariants[log.actionType]}
                      className="flex items-center gap-1 w-fit"
                    >
                      {actionIcons[log.actionType]}
                      {actionLabels[log.actionType]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm capitalize">{log.targetType}</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {log.targetId.slice(0, 16)}...
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="max-w-[250px]">
                    <span className="text-sm truncate block">
                      {log.reason || "-"}
                    </span>
                    {log.details && (
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer hover:text-foreground">
                          View details
                        </summary>
                        <pre className="mt-1 text-xs overflow-auto max-w-[200px]">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </TableCell>
                  <TableCell>{log.adminEmail}</TableCell>
                  <TableCell>{formatDate(log.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
