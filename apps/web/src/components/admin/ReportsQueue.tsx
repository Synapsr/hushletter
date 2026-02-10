import { convexQuery } from "@convex-dev/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@hushletter/backend";
import { useConvexMutation } from "@convex-dev/react-query";
import { useState } from "react";
import { m } from "@/paraglide/messages.js";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from "@hushletter/ui";
import { Flag, Check, X, AlertTriangle, Copyright, Mail, MessageSquareWarning } from "lucide-react";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";

/** Report item returned from listContentReports */
interface ReportItem {
  id: Id<"contentReports">;
  contentId: Id<"newsletterContent">;
  subject: string;
  senderEmail: string;
  reason: "spam" | "inappropriate" | "copyright" | "misleading" | "other";
  description: string | undefined;
  status: "pending" | "resolved" | "dismissed";
  reporterEmail: string;
  createdAt: number;
  resolvedAt: number | undefined;
}

/**
 * Reports Queue - Displays content reports for admin review
 * Story 7.4: Task 9.1-9.5 - Reports queue UI
 *
 * Features:
 * - List of pending/resolved/dismissed reports
 * - Quick actions: resolve, dismiss, hide content
 * - Report details with reason and description
 * - Bulk resolution for multiple reports
 */

const reasonIcons: Record<string, React.ReactNode> = {
  spam: <Mail className="h-4 w-4" />,
  inappropriate: <AlertTriangle className="h-4 w-4" />,
  copyright: <Copyright className="h-4 w-4" />,
  misleading: <MessageSquareWarning className="h-4 w-4" />,
  other: <Flag className="h-4 w-4" />,
};

const getReasonLabel = (reason: string): string => {
  switch (reason) {
    case "spam":
      return m.reports_reasonSpam();
    case "inappropriate":
      return m.reports_reasonInappropriate();
    case "copyright":
      return m.reports_reasonCopyright();
    case "misleading":
      return m.reports_reasonMisleading();
    case "other":
      return m.reports_reasonOther();
    default:
      return reason;
  }
};

export function ReportsQueue() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<"pending" | "resolved" | "dismissed">("pending");
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<{
    id: string;
    contentId: string;
    subject: string;
    reason: string;
    description?: string;
  } | null>(null);
  const [resolution, setResolution] = useState<"resolved" | "dismissed">("resolved");
  const [note, setNote] = useState("");
  const [hideContent, setHideContent] = useState(false);
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());

  // Query
  const { data, isPending, isError } = useQuery(
    convexQuery(api.admin.listContentReports, {
      status: statusFilter,
      limit: 50,
    }),
  );

  // Mutations
  const resolveReportFn = useConvexMutation(api.admin.resolveReport);
  const resolveReportMutation = useMutation({ mutationFn: resolveReportFn });

  const bulkResolveFn = useConvexMutation(api.admin.bulkResolveReports);
  const bulkResolveMutation = useMutation({ mutationFn: bulkResolveFn });

  /** Invalidate reports-related queries */
  const invalidateReportsQueries = async () => {
    await queryClient.invalidateQueries({
      predicate: (query) =>
        Array.isArray(query.queryKey) &&
        query.queryKey.some(
          (key) =>
            typeof key === "string" &&
            (key.includes("listContentReports") ||
              key.includes("getPendingReportsCount") ||
              key.includes("listModerationLog") ||
              key.includes("getCommunityContentSummary")),
        ),
    });
  };

  const handleResolve = async () => {
    if (!selectedReport) return;

    await resolveReportMutation.mutateAsync({
      reportId: selectedReport.id as Id<"contentReports">,
      resolution,
      note: note.trim() || undefined,
      hideContent: resolution === "resolved" ? hideContent : undefined,
    });

    await invalidateReportsQueries();

    setResolveDialogOpen(false);
    setSelectedReport(null);
    setNote("");
    setHideContent(false);
  };

  const handleBulkResolve = async (resolution: "resolved" | "dismissed") => {
    if (selectedReports.size === 0) return;

    await bulkResolveMutation.mutateAsync({
      reportIds: Array.from(selectedReports) as Id<"contentReports">[],
      resolution,
    });

    await invalidateReportsQueries();
    setSelectedReports(new Set());
  };

  const openResolveDialog = (report: {
    id: string;
    contentId: string;
    subject: string;
    reason: string;
    description?: string;
  }) => {
    setSelectedReport(report);
    setResolution("resolved");
    setNote("");
    setHideContent(false);
    setResolveDialogOpen(true);
  };

  const toggleReportSelection = (reportId: string) => {
    const newSelection = new Set(selectedReports);
    if (newSelection.has(reportId)) {
      newSelection.delete(reportId);
    } else {
      newSelection.add(reportId);
    }
    setSelectedReports(newSelection);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  if (isError) {
    return (
      <div className="text-center py-8 text-muted-foreground">{m.reports_errorLoadFailed()}</div>
    );
  }

  const reports = (data ?? []) as ReportItem[];

  return (
    <div className="space-y-4">
      {/* Filter and Bulk Actions */}
      <div className="flex items-center justify-between">
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as "pending" | "resolved" | "dismissed")}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={m.reports_filterByStatus()} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">{m.reports_statusPending()}</SelectItem>
            <SelectItem value="resolved">{m.reports_statusResolved()}</SelectItem>
            <SelectItem value="dismissed">{m.reports_statusDismissed()}</SelectItem>
          </SelectContent>
        </Select>

        {statusFilter === "pending" && selectedReports.size > 0 && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={bulkResolveMutation.isPending}
              onClick={() => handleBulkResolve("dismissed")}
            >
              <X className="h-4 w-4 mr-1" aria-hidden="true" />
              {bulkResolveMutation.isPending
                ? m.reports_processing()
                : m.reports_dismissSelected({ count: selectedReports.size })}
            </Button>
            <Button
              size="sm"
              disabled={bulkResolveMutation.isPending}
              onClick={() => handleBulkResolve("resolved")}
            >
              <Check className="h-4 w-4 mr-1" aria-hidden="true" />
              {bulkResolveMutation.isPending
                ? m.reports_processing()
                : m.reports_resolveSelected({ count: selectedReports.size })}
            </Button>
          </div>
        )}
      </div>

      {/* Table */}
      {isPending ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={`row-skeleton-${i}`} className="h-16" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12">
          <Flag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">{m.reports_noReportsTitle()}</h3>
          <p className="text-muted-foreground">
            {statusFilter === "pending"
              ? m.reports_noReportsMessagePending()
              : m.reports_noReportsMessageFiltered({ status: statusFilter })}
          </p>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {statusFilter === "pending" && (
                  <TableHead className="w-[50px]">
                    <input
                      type="checkbox"
                      checked={selectedReports.size === reports.length}
                      onChange={() => {
                        if (selectedReports.size === reports.length) {
                          setSelectedReports(new Set());
                        } else {
                          setSelectedReports(new Set(reports.map((r) => r.id)));
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300"
                      aria-label={m.reports_selectAllLabel()}
                    />
                  </TableHead>
                )}
                <TableHead>{m.reports_columnContent()}</TableHead>
                <TableHead>{m.reports_columnReason()}</TableHead>
                <TableHead>{m.reports_columnReporter()}</TableHead>
                <TableHead>{m.reports_columnReportedAt()}</TableHead>
                {statusFilter !== "pending" && <TableHead>{m.reports_columnResolved()}</TableHead>}
                <TableHead className="text-right">{m.reports_columnActions()}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => (
                <TableRow key={report.id}>
                  {statusFilter === "pending" && (
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedReports.has(report.id)}
                        onChange={() => toggleReportSelection(report.id)}
                        className="h-4 w-4 rounded border-gray-300"
                        aria-label={m.reports_selectReportLabel({ subject: report.subject })}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium max-w-[250px] truncate">{report.subject}</span>
                      <span className="text-xs text-muted-foreground">{report.senderEmail}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="flex items-center gap-1 w-fit">
                      {reasonIcons[report.reason]}
                      {getReasonLabel(report.reason)}
                    </Badge>
                    {report.description && (
                      <p className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate">
                        {report.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>{report.reporterEmail}</TableCell>
                  <TableCell>{formatDate(report.createdAt)}</TableCell>
                  {statusFilter !== "pending" && (
                    <TableCell>{report.resolvedAt ? formatDate(report.resolvedAt) : "-"}</TableCell>
                  )}
                  <TableCell className="text-right">
                    {statusFilter === "pending" ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            openResolveDialog({
                              id: report.id,
                              contentId: report.contentId,
                              subject: report.subject,
                              reason: report.reason,
                              description: report.description,
                            })
                          }
                        >
                          {m.reports_buttonReview()}
                        </Button>
                      </div>
                    ) : (
                      <Badge variant={report.status === "resolved" ? "default" : "secondary"}>
                        {report.status === "resolved" ? (
                          <Check className="h-3 w-3 mr-1" />
                        ) : (
                          <X className="h-3 w-3 mr-1" />
                        )}
                        {report.status}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Resolve Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{m.reports_reviewDialogTitle()}</DialogTitle>
            <DialogDescription>{m.reports_reviewDialogDescription()}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium">{m.reports_labelContent()}</Label>
              <p className="text-sm text-muted-foreground">{selectedReport?.subject}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">{m.reports_labelReason()}</Label>
              <Badge variant="outline" className="ml-2">
                {selectedReport?.reason && getReasonLabel(selectedReport.reason)}
              </Badge>
            </div>
            {selectedReport?.description && (
              <div>
                <Label className="text-sm font-medium">{m.reports_labelDescription()}</Label>
                <p className="text-sm text-muted-foreground">{selectedReport.description}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>{m.reports_labelResolution()}</Label>
              <Select
                value={resolution}
                onValueChange={(v) => setResolution(v as "resolved" | "dismissed")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="resolved">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600" />
                      {m.reports_resolutionResolve()}
                    </div>
                  </SelectItem>
                  <SelectItem value="dismissed">
                    <div className="flex items-center gap-2">
                      <X className="h-4 w-4 text-muted-foreground" />
                      {m.reports_resolutionDismiss()}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {resolution === "resolved" && (
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="hide-content"
                  checked={hideContent}
                  onChange={(e) => setHideContent(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="hide-content" className="text-sm">
                  {m.reports_hideContentCheckbox()}
                </Label>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="resolution-note">{m.reports_labelNote()}</Label>
              <Textarea
                id="resolution-note"
                placeholder={m.reports_notePlaceholder()}
                value={note}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
              {m.reports_buttonCancel()}
            </Button>
            <Button
              onClick={handleResolve}
              variant={resolution === "resolved" ? "default" : "secondary"}
              disabled={resolveReportMutation.isPending}
            >
              {resolveReportMutation.isPending
                ? m.reports_processing()
                : resolution === "resolved"
                  ? m.reports_buttonResolveReport()
                  : m.reports_buttonDismissReport()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
