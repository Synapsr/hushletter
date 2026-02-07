import { convexQuery } from "@convex-dev/react-query";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@hushletter/backend";
import { useConvexMutation } from "@convex-dev/react-query";
import { useState, useDeferredValue } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Eye, EyeOff, Ban, Search, Users, Calendar } from "lucide-react";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";

/** Content item returned from listCommunityContent */
interface ContentItem {
  id: Id<"newsletterContent">;
  senderId: Id<"senders"> | undefined;
  subject: string;
  senderEmail: string;
  senderName: string | undefined;
  domain: string;
  readerCount: number;
  firstReceivedAt: number;
  moderationStatus: "active" | "hidden" | "blocked_sender";
  isHiddenFromCommunity: boolean;
  hiddenAt: number | undefined;
}

/**
 * Community Content Table - Displays community content with moderation actions
 * Story 7.4: Task 7.2 - Community content table
 *
 * Features:
 * - Paginated list of community content
 * - Search/filter by sender email, domain
 * - Filter by moderation status
 * - Hide/restore content actions
 * - Block sender action
 */
export function CommunityContentTable() {
  const queryClient = useQueryClient();
  const [searchEmail, setSearchEmail] = useState("");
  const deferredSearchEmail = useDeferredValue(searchEmail);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "hidden" | "blocked_sender">(
    "all",
  );

  // Dialog state
  const [hideDialogOpen, setHideDialogOpen] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [selectedContent, setSelectedContent] = useState<{
    id: string;
    senderId: string | undefined;
    subject: string;
    senderEmail: string;
  } | null>(null);
  const [reason, setReason] = useState("");

  // Queries - use deferred value for debounced search
  const { data, isPending, isError } = useQuery(
    convexQuery(api.admin.listCommunityContent, {
      senderEmail: deferredSearchEmail || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      sortBy: "firstReceivedAt",
      sortOrder: "desc",
      limit: 50,
    }),
  );

  // Mutations - wrap with useMutation
  const hideContentFn = useConvexMutation(api.admin.hideContentFromCommunity);
  const hideContentMutation = useMutation({ mutationFn: hideContentFn });

  const restoreContentFn = useConvexMutation(api.admin.restoreContentToCommunity);
  const restoreContentMutation = useMutation({ mutationFn: restoreContentFn });

  const blockSenderFn = useConvexMutation(api.admin.blockSenderFromCommunity);
  const blockSenderMutation = useMutation({ mutationFn: blockSenderFn });

  /** Invalidate community content queries */
  const invalidateCommunityQueries = async () => {
    [
      await queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey.some(
            (key) =>
              typeof key === "string" &&
              (key.includes("listCommunityContent") ||
                key.includes("getCommunityContentSummary") ||
                key.includes("listBlockedSenders")),
          ),
      }),
    ];
  };

  const handleHide = async () => {
    if (!selectedContent || !reason.trim()) return;

    await hideContentMutation.mutateAsync({
      contentId: selectedContent.id as Id<"newsletterContent">,
      reason: reason.trim(),
    });

    await invalidateCommunityQueries();

    setHideDialogOpen(false);
    setSelectedContent(null);
    setReason("");
  };

  const handleRestore = async (contentId: string) => {
    await restoreContentMutation.mutateAsync({
      contentId: contentId as Id<"newsletterContent">,
    });
    await invalidateCommunityQueries();
  };

  const handleBlockSender = async () => {
    if (!selectedContent || !reason.trim() || !selectedContent.senderId) return;

    await blockSenderMutation.mutateAsync({
      senderId: selectedContent.senderId as Id<"senders">,
      reason: reason.trim(),
    });

    await invalidateCommunityQueries();

    setBlockDialogOpen(false);
    setSelectedContent(null);
    setReason("");
  };

  const openHideDialog = (content: {
    id: string;
    senderId: string | undefined;
    subject: string;
    senderEmail: string;
  }) => {
    setSelectedContent(content);
    setReason("");
    setHideDialogOpen(true);
  };

  const openBlockDialog = (content: {
    id: string;
    senderId: string | undefined;
    subject: string;
    senderEmail: string;
  }) => {
    setSelectedContent(content);
    setReason("");
    setBlockDialogOpen(true);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  if (isError) {
    return (
      <div className="text-center py-8 text-muted-foreground">Failed to load community content</div>
    );
  }

  const dataTyped = data as { items?: ContentItem[] } | undefined;
  const items = dataTyped?.items ?? [];

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by sender email..."
            value={searchEmail}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchEmail(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) =>
            setStatusFilter(v as "all" | "active" | "hidden" | "blocked_sender")
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="hidden">Hidden</SelectItem>
            <SelectItem value="blocked_sender">Blocked Sender</SelectItem>
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
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Sender</TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" aria-hidden="true" />
                    Readers
                  </div>
                </TableHead>
                <TableHead>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" aria-hidden="true" />
                    First Received
                  </div>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    No content found
                  </TableCell>
                </TableRow>
              ) : (
                items.map((content) => (
                  <TableRow key={content.id}>
                    <TableCell className="font-medium max-w-[300px] truncate">
                      {content.subject}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">{content.senderEmail}</span>
                        {content.senderName && (
                          <span className="text-xs text-muted-foreground">
                            {content.senderName}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{content.readerCount}</TableCell>
                    <TableCell>{formatDate(content.firstReceivedAt)}</TableCell>
                    <TableCell>
                      {content.moderationStatus === "active" ? (
                        <Badge variant="default" className="bg-green-600">
                          <Eye className="h-3 w-3 mr-1" aria-hidden="true" />
                          Active
                        </Badge>
                      ) : content.moderationStatus === "hidden" ? (
                        <Badge variant="secondary">
                          <EyeOff className="h-3 w-3 mr-1" aria-hidden="true" />
                          Hidden
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <Ban className="h-3 w-3 mr-1" aria-hidden="true" />
                          Blocked Sender
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {content.moderationStatus === "active" ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={hideContentMutation.isPending}
                              onClick={() =>
                                openHideDialog({
                                  id: content.id,
                                  senderId: content.senderId,
                                  subject: content.subject,
                                  senderEmail: content.senderEmail,
                                })
                              }
                              aria-label={`Hide ${content.subject}`}
                            >
                              <EyeOff className="h-4 w-4 mr-1" aria-hidden="true" />
                              Hide
                            </Button>
                            {content.senderId && (
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={blockSenderMutation.isPending}
                                onClick={() =>
                                  openBlockDialog({
                                    id: content.id,
                                    senderId: content.senderId,
                                    subject: content.subject,
                                    senderEmail: content.senderEmail,
                                  })
                                }
                                aria-label={`Block sender ${content.senderEmail}`}
                              >
                                <Ban className="h-4 w-4 mr-1" aria-hidden="true" />
                                Block Sender
                              </Button>
                            )}
                          </>
                        ) : content.moderationStatus === "hidden" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={restoreContentMutation.isPending}
                            onClick={() => handleRestore(content.id)}
                            aria-label={`Restore ${content.subject}`}
                          >
                            <Eye className="h-4 w-4 mr-1" aria-hidden="true" />
                            Restore
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Hide Content Dialog */}
      <Dialog open={hideDialogOpen} onOpenChange={setHideDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hide Content from Community</DialogTitle>
            <DialogDescription>
              This will remove the newsletter from community visibility. Users who have added it to
              their collection will not be affected.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium">Newsletter</Label>
              <p className="text-sm text-muted-foreground">{selectedContent?.subject}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hide-reason">Reason for hiding</Label>
              <Textarea
                id="hide-reason"
                placeholder="Enter reason for moderation action..."
                value={reason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHideDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleHide} disabled={!reason.trim() || hideContentMutation.isPending}>
              {hideContentMutation.isPending ? "Hiding..." : "Hide Content"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block Sender Dialog */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Block Sender from Community</DialogTitle>
            <DialogDescription>
              This will hide ALL newsletters from this sender. Users' personal copies will not be
              affected.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium">Sender</Label>
              <p className="text-sm text-muted-foreground">{selectedContent?.senderEmail}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="block-reason">Reason for blocking</Label>
              <Textarea
                id="block-reason"
                placeholder="Enter reason for blocking this sender..."
                value={reason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBlockSender}
              disabled={
                !reason.trim() || !selectedContent?.senderId || blockSenderMutation.isPending
              }
            >
              {blockSenderMutation.isPending ? "Blocking..." : "Block Sender"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
