import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";
import {
  Button,
  Input,
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
} from "@hushletter/ui";
import { ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { ModerationNewsletterModal } from "./ModerationNewsletterModal";

/** Sort options for the queue */
type SortOption = "newsletterCount" | "senderName" | "latestReceived";

/**
 * Moderation Queue Table Component
 * Story 9.6: Task 3.2-3.5
 *
 * Lists senders with newsletter counts for admin moderation.
 * Features:
 * - Expandable rows to show individual newsletters
 * - Click to open newsletter detail modal
 * - Filter by sender email
 * - Sort by count, sender name, or date
 */
export function ModerationQueueTable() {
  const [senderFilter, setSenderFilter] = useState("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortOption>("latestReceived");
  const [expandedSenders, setExpandedSenders] = useState<Set<string>>(new Set());
  const [selectedNewsletter, setSelectedNewsletter] = useState<Id<"userNewsletters"> | null>(null);

  // Convert date strings to Unix timestamps for the query
  const startDateMs = startDate ? new Date(startDate).getTime() : undefined;
  const endDateMs = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : undefined;

  const { data: queue, isPending } = useQuery(
    convexQuery(api.admin.listModerationQueue, {
      senderEmail: senderFilter || undefined,
      startDate: startDateMs,
      endDate: endDateMs,
      sortBy,
    }),
  );

  const clearFilters = () => {
    setSenderFilter("");
    setStartDate("");
    setEndDate("");
  };

  const hasActiveFilters = senderFilter || startDate || endDate;

  const toggleSender = (senderId: string) => {
    const newExpanded = new Set(expandedSenders);
    if (newExpanded.has(senderId)) {
      newExpanded.delete(senderId);
    } else {
      newExpanded.add(senderId);
    }
    setExpandedSenders(newExpanded);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Label htmlFor="sender-filter" className="text-xs text-muted-foreground mb-1 block">
            Sender
          </Label>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="sender-filter"
              placeholder="Filter by sender email..."
              value={senderFilter}
              onChange={(e) => setSenderFilter(e.target.value)}
              className="pl-9"
              aria-label="Filter by sender email"
            />
          </div>
        </div>
        <div className="min-w-[150px]">
          <Label htmlFor="start-date" className="text-xs text-muted-foreground mb-1 block">
            From Date
          </Label>
          <Input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            aria-label="Filter from date"
          />
        </div>
        <div className="min-w-[150px]">
          <Label htmlFor="end-date" className="text-xs text-muted-foreground mb-1 block">
            To Date
          </Label>
          <Input
            id="end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            aria-label="Filter to date"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Sort</Label>
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
            <SelectTrigger className="w-[180px]" aria-label="Sort by">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latestReceived">Latest Received</SelectItem>
              <SelectItem value="newsletterCount">Newsletter Count</SelectItem>
              <SelectItem value="senderName">Sender Name</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-10"
            aria-label="Clear all filters"
          >
            <X className="h-4 w-4 mr-1" aria-hidden="true" />
            Clear
          </Button>
        )}
      </div>

      {/* Queue Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Sender</TableHead>
              <TableHead className="text-right">Newsletters</TableHead>
              <TableHead>Latest Received</TableHead>
              <TableHead>Sample Subjects</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={`skeleton-${i}`}>
                  <TableCell>
                    <Skeleton className="h-4 w-4" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-8" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-60" />
                  </TableCell>
                </TableRow>
              ))
            ) : queue?.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No newsletters pending moderation
                </TableCell>
              </TableRow>
            ) : (
              queue?.items.map((sender) => (
                <SenderRow
                  key={sender.senderId}
                  sender={sender}
                  isExpanded={expandedSenders.has(sender.senderId)}
                  onToggle={() => toggleSender(sender.senderId)}
                  onSelectNewsletter={setSelectedNewsletter}
                  formatDate={formatDate}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination info */}
      {queue && (
        <div className="text-sm text-muted-foreground">
          Showing {queue.items.length} of {queue.totalSenders} senders
          {queue.hasMore && " (more available)"}
        </div>
      )}

      {/* Newsletter Detail Modal */}
      {selectedNewsletter && (
        <ModerationNewsletterModal
          userNewsletterId={selectedNewsletter}
          onClose={() => setSelectedNewsletter(null)}
        />
      )}
    </div>
  );
}

/** Props for SenderRow component */
interface SenderRowProps {
  sender: {
    senderId: Id<"senders">;
    senderEmail: string;
    senderName?: string;
    senderDomain: string;
    newsletterCount: number;
    latestReceived: number;
    sampleSubjects: string[];
  };
  isExpanded: boolean;
  onToggle: () => void;
  onSelectNewsletter: (id: Id<"userNewsletters">) => void;
  formatDate: (timestamp: number) => string;
}

/** Individual sender row with expandable newsletters */
function SenderRow({
  sender,
  isExpanded,
  onToggle,
  onSelectNewsletter,
  formatDate,
}: SenderRowProps) {
  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <TableCell>
          <button type="button" className="p-1" aria-label={isExpanded ? "Collapse" : "Expand"}>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </TableCell>
        <TableCell>
          <div>
            <p className="font-medium">{sender.senderName ?? sender.senderEmail}</p>
            {sender.senderName && (
              <p className="text-sm text-muted-foreground">{sender.senderEmail}</p>
            )}
          </div>
        </TableCell>
        <TableCell className="text-right font-medium">{sender.newsletterCount}</TableCell>
        <TableCell>{formatDate(sender.latestReceived)}</TableCell>
        <TableCell className="max-w-md">
          <p className="truncate text-sm text-muted-foreground">
            {sender.sampleSubjects.join(", ")}
          </p>
        </TableCell>
      </TableRow>

      {isExpanded && (
        <SenderNewsletterRows
          senderId={sender.senderId}
          onSelectNewsletter={onSelectNewsletter}
          formatDate={formatDate}
        />
      )}
    </>
  );
}

/** Props for SenderNewsletterRows component */
interface SenderNewsletterRowsProps {
  senderId: Id<"senders">;
  onSelectNewsletter: (id: Id<"userNewsletters">) => void;
  formatDate: (timestamp: number) => string;
}

/** Expanded newsletter rows for a sender */
function SenderNewsletterRows({
  senderId,
  onSelectNewsletter,
  formatDate,
}: SenderNewsletterRowsProps) {
  const { data: newsletters, isPending } = useQuery(
    convexQuery(api.admin.listModerationNewslettersForSender, { senderId }),
  );

  if (isPending) {
    return (
      <TableRow>
        <TableCell colSpan={5} className="pl-12">
          <Skeleton className="h-4 w-40" />
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      {newsletters?.map((newsletter) => (
        <TableRow key={newsletter.id} className="bg-muted/30">
          <TableCell />
          <TableCell colSpan={2} className="pl-8">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectNewsletter(newsletter.id);
              }}
              className="text-left hover:underline focus:underline focus:outline-none"
            >
              {newsletter.subject}
            </button>
          </TableCell>
          <TableCell>{formatDate(newsletter.receivedAt)}</TableCell>
          <TableCell className="text-sm text-muted-foreground">
            User: {newsletter.userEmail}
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
