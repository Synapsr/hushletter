import { convexQuery } from "@convex-dev/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@hushletter/backend";
import { useConvexMutation } from "@convex-dev/react-query";
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

const reasonLabels: Record<string, string> = {
  spam: "Spam",
  inappropriate: "Inappropriate",
  copyright: "Copyright",
  misleading: "Misleading",
  other: "Other",
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
      <div className="text-center py-8 text-muted-foreground">Failed to load content reports</div>
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
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
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
                ? "Processing..."
                : `Dismiss Selected (${selectedReports.size})`}
            </Button>
            <Button
              size="sm"
              disabled={bulkResolveMutation.isPending}
              onClick={() => handleBulkResolve("resolved")}
            >
              <Check className="h-4 w-4 mr-1" aria-hidden="true" />
              {bulkResolveMutation.isPending
                ? "Processing..."
                : `Resolve Selected (${selectedReports.size})`}
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
          <h3 className="text-lg font-medium">No Reports</h3>
          <p className="text-muted-foreground">
            {statusFilter === "pending"
              ? "No content reports awaiting review."
              : `No ${statusFilter} reports found.`}
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
                      aria-label="Select all reports"
                    />
                  </TableHead>
                )}
                <TableHead>Content</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Reporter</TableHead>
                <TableHead>Reported At</TableHead>
                {statusFilter !== "pending" && <TableHead>Resolved</TableHead>}
                <TableHead className="text-right">Actions</TableHead>
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
                        aria-label={`Select report for ${report.subject}`}
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
                      {reasonLabels[report.reason]}
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
                          Review
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
            <DialogTitle>Review Report</DialogTitle>
            <DialogDescription>Review the report and take appropriate action.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium">Content</Label>
              <p className="text-sm text-muted-foreground">{selectedReport?.subject}</p>
            </div>
            <div>
              <Label className="text-sm font-medium">Reason</Label>
              <Badge variant="outline" className="ml-2">
                {selectedReport?.reason && reasonLabels[selectedReport.reason]}
              </Badge>
            </div>
            {selectedReport?.description && (
              <div>
                <Label className="text-sm font-medium">Description</Label>
                <p className="text-sm text-muted-foreground">{selectedReport.description}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Resolution</Label>
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
                      Resolve (take action)
                    </div>
                  </SelectItem>
                  <SelectItem value="dismissed">
                    <div className="flex items-center gap-2">
                      <X className="h-4 w-4 text-muted-foreground" />
                      Dismiss (no action needed)
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
                  Hide this content from community
                </Label>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="resolution-note">Note (optional)</Label>
              <Textarea
                id="resolution-note"
                placeholder="Add a note about this resolution..."
                value={note}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleResolve}
              variant={resolution === "resolved" ? "default" : "secondary"}
              disabled={resolveReportMutation.isPending}
            >
              {resolveReportMutation.isPending
                ? "Processing..."
                : resolution === "resolved"
                  ? "Resolve Report"
                  : "Dismiss Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
