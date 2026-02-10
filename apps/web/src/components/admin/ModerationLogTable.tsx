import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { api } from "@hushletter/backend";
import { useState } from "react";
import { Badge, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@hushletter/ui";
import { Eye, EyeOff, Ban, Unlock, CheckCircle, XCircle, History } from "lucide-react";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";
import { m } from "@/paraglide/messages.js";

/** Moderation log item returned from listModerationLog */
interface ModerationLogItem {
  id: Id<"moderationLog">;
  actionType:
    | "hide_content"
    | "restore_content"
    | "block_sender"
    | "unblock_sender"
    | "resolve_report"
    | "dismiss_report";
  targetType: "content" | "sender" | "report";
  targetId: string;
  reason: string | undefined;
  details: Record<string, unknown> | null;
  adminEmail: string;
  createdAt: number;
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
};

const getActionLabel = (actionType: string): string => {
  switch (actionType) {
    case "hide_content":
      return m.modLog_actionHidContent();
    case "restore_content":
      return m.modLog_actionRestoreContent();
    case "block_sender":
      return m.modLog_actionBlockSender();
    case "unblock_sender":
      return m.modLog_actionUnblockSender();
    case "resolve_report":
      return m.modLog_actionResolveReport();
    case "dismiss_report":
      return m.modLog_actionDismissReport();
    default:
      return actionType;
  }
};

const actionVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  hide_content: "secondary",
  restore_content: "default",
  block_sender: "destructive",
  unblock_sender: "default",
  resolve_report: "default",
  dismiss_report: "secondary",
};

type ActionType =
  | "hide_content"
  | "restore_content"
  | "block_sender"
  | "unblock_sender"
  | "resolve_report"
  | "dismiss_report";

export function ModerationLogTable() {
  const [actionFilter, setActionFilter] = useState<ActionType | "all">("all");

  // Query
  const { data, isPending, isError } = useQuery(
    convexQuery(api.admin.listModerationLog, {
      actionType: actionFilter === "all" ? undefined : actionFilter,
      limit: 50,
    }),
  );

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  if (isError) {
    return (
      <div className="text-center py-8 text-muted-foreground">{m.modLog_errorLoadFailed()}</div>
    );
  }

  const logs = (data ?? []) as ModerationLogItem[];

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-4">
        <Select
          value={actionFilter}
          onValueChange={(v) => setActionFilter(v as ActionType | "all")}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder={m.modLog_filterByAction()} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{m.modLog_allActions()}</SelectItem>
            <SelectItem value="hide_content">{m.modLog_actionHideContent()}</SelectItem>
            <SelectItem value="restore_content">{m.modLog_actionRestoreContent()}</SelectItem>
            <SelectItem value="block_sender">{m.modLog_actionBlockSender()}</SelectItem>
            <SelectItem value="unblock_sender">{m.modLog_actionUnblockSender()}</SelectItem>
            <SelectItem value="resolve_report">{m.modLog_actionResolveReport()}</SelectItem>
            <SelectItem value="dismiss_report">{m.modLog_actionDismissReport()}</SelectItem>
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
          <h3 className="text-lg font-medium">{m.modLog_noHistoryTitle()}</h3>
          <p className="text-muted-foreground">
            {actionFilter === "all"
              ? m.modLog_noHistoryMessageAll()
              : m.modLog_noHistoryMessageFiltered({ actionType: getActionLabel(actionFilter) })}
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{m.modLog_columnAction()}</TableHead>
                <TableHead>{m.modLog_columnTarget()}</TableHead>
                <TableHead>{m.modLog_columnReason()}</TableHead>
                <TableHead>{m.modLog_columnAdmin()}</TableHead>
                <TableHead>{m.modLog_columnTimestamp()}</TableHead>
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
                      {getActionLabel(log.actionType)}
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
                    <span className="text-sm truncate block">{log.reason || "-"}</span>
                    {log.details && (
                      <details className="text-xs text-muted-foreground">
                        <summary className="cursor-pointer hover:text-foreground">
                          {m.modLog_viewDetails()}
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
  );
}
