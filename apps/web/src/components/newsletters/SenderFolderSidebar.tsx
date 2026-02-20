import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { useAction, useMutation } from "convex/react";
import { api } from "@hushletter/backend";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  ScrollArea,
  Button,
  Skeleton,
  ArchiveBoldIcon,
  TrashBoldIcon,
} from "@hushletter/ui";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  Trash2,
  Archive,
  ArrowLeft,
  Star,
  CheckCircle2,
} from "lucide-react";
import { SidebarEmptyState } from "./SidebarEmptyState";
import {
  Reorder,
  useDragControls,
  useMotionValue,
  useVelocity,
  useTransform,
  animate,
  AnimatePresence,
  motion,
} from "motion/react";
import { SenderFolderItem } from "./SenderFolderItem";
import { NewsletterListItem } from "./NewsletterListItem";
import type { FolderData } from "@/components/FolderSidebar";
import type { NewsletterData } from "@/components/NewsletterCard";
import { m } from "@/paraglide/messages.js";
import { SidebarFooter } from "./SidebarFooter";

type SidebarFilter = "all" | "unread" | "starred";

const FILTER_HIDDEN = "hidden" as const;
const FILTER_STARRED = "starred" as const;
const FILTER_BIN = "bin" as const;
const LAST_NEWSLETTERS_VISIT_KEY = "hushletter:lastNewslettersVisit";
const RECENT_UNREAD_HEAD_SIZE = 8;
const RECENT_UNREAD_PAGE_SIZE = 20;
type FilterType =
  | typeof FILTER_HIDDEN
  | typeof FILTER_STARRED
  | typeof FILTER_BIN;
type ManagementFolderGroup = {
  key: string;
  folder: FolderData;
  newsletters: NewsletterData[];
  useLiveFolderFeed: boolean;
  canUnarchiveFolder: boolean;
};

interface HiddenFolderData {
  _id: string;
  userId?: string;
  name: string;
  senderEmail?: string;
  senderPreviews?: Array<{
    senderEmail: string;
    senderName?: string;
  }>;
  color?: string;
  isHidden?: boolean;
  createdAt?: number;
  updatedAt?: number;
  newsletterCount: number;
  unreadCount?: number;
  senderCount: number;
}

function isHiddenFolderData(item: unknown): item is HiddenFolderData {
  if (typeof item !== "object" || item === null) return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj._id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.newsletterCount === "number" &&
    typeof obj.senderCount === "number"
  );
}

interface SenderFolderSidebarProps {
  selectedFolderId: string | null;
  selectedNewsletterId: string | null;
  selectedFilter: FilterType | null;
  hiddenNewsletters: NewsletterData[];
  hiddenPending: boolean;
  binnedNewsletters: NewsletterData[];
  binnedPending: boolean;
  favoritedNewsletters: NewsletterData[];
  favoritedPending: boolean;
  onFolderSelect: (folderId: string | null) => void;
  onNewsletterSelect: (newsletterId: string) => void;
  onFilterSelect: (filter: FilterType | null) => void;
  getIsFavorited: (newsletterId: string, serverValue?: boolean) => boolean;
  isFavoritePending: (newsletterId: string) => boolean;
  onToggleFavorite: (
    newsletterId: string,
    currentValue: boolean,
  ) => Promise<void>;
  onEmptyBin?: () => Promise<void> | void;
  isEmptyingBin?: boolean;
  canLoadMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
}

function isFolderData(item: unknown): item is FolderData {
  if (typeof item !== "object" || item === null) return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj._id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.newsletterCount === "number" &&
    typeof obj.unreadCount === "number"
  );
}

function areFolderOrdersEqual(a: readonly string[], b: readonly string[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function groupNewslettersByFolder(
  newsletters: NewsletterData[],
  folderNameLookup: Map<string, string>,
): Array<{
  folderId: string | null;
  folderName: string;
  newsletters: NewsletterData[];
}> {
  const groups = new Map<string | null, NewsletterData[]>();
  for (const newsletter of newsletters) {
    const key = (newsletter as { folderId?: string }).folderId ?? null;
    const group = groups.get(key) ?? [];
    group.push(newsletter);
    groups.set(key, group);
  }
  return Array.from(groups.entries()).map(([folderId, items]) => ({
    folderId,
    folderName: folderId
      ? (folderNameLookup.get(folderId) ?? "Unknown")
      : "Uncategorized",
    newsletters: items,
  }));
}

function buildSenderPreviews(newsletters: NewsletterData[]) {
  const deduped = new Map<
    string,
    { senderEmail: string; senderName?: string }
  >();
  for (const newsletter of newsletters) {
    if (!newsletter.senderEmail || deduped.has(newsletter.senderEmail))
      continue;
    deduped.set(newsletter.senderEmail, {
      senderEmail: newsletter.senderEmail,
      senderName: newsletter.senderName,
    });
    if (deduped.size >= 3) break;
  }
  return [...deduped.values()];
}

function toFolderDataFromGroup({
  id,
  name,
  newsletters,
  baseFolder,
  isHidden,
}: {
  id: string;
  name: string;
  newsletters: NewsletterData[];
  baseFolder?: Partial<FolderData>;
  isHidden?: boolean;
}): FolderData {
  const senderPreviews =
    baseFolder?.senderPreviews && baseFolder.senderPreviews.length > 0
      ? baseFolder.senderPreviews
      : buildSenderPreviews(newsletters);

  return {
    _id: id,
    userId: baseFolder?.userId ?? "",
    name,
    senderEmail:
      baseFolder?.senderEmail ??
      senderPreviews[0]?.senderEmail ??
      newsletters[0]?.senderEmail,
    senderPreviews,
    color: baseFolder?.color,
    isHidden: isHidden ?? baseFolder?.isHidden ?? false,
    createdAt: baseFolder?.createdAt ?? 0,
    updatedAt: baseFolder?.updatedAt ?? 0,
    newsletterCount: newsletters.length,
    unreadCount: newsletters.filter((newsletter) => !newsletter.isRead).length,
    senderCount: senderPreviews.length,
  };
}

function SidebarSkeleton() {
  return (
    <div className="p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <Skeleton className="h-4 w-12" />
        <div className="flex gap-1">
          <Skeleton className="h-5 w-8 rounded-md" />
          <Skeleton className="h-5 w-12 rounded-md" />
          <Skeleton className="h-5 w-14 rounded-md" />
        </div>
      </div>

      {/* Folder items */}
      <div className="space-y-1 pt-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 px-2 py-2.5">
            <Skeleton className="size-8 rounded-lg shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-2.5 w-16" />
            </div>
            <Skeleton className="h-5 w-5 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Management section — always-visible footer rows for Archive and Bin.
 */
function ManagementSection({
  archiveCount,
  binCount,
  selectedFilter,
  onArchiveClick,
  onBinClick,
}: {
  archiveCount: number;
  binCount: number;
  selectedFilter: FilterType | null;
  onArchiveClick: () => void;
  onBinClick: () => void;
}) {
  return (
    <div className=" bg-background space-y-2">
      <div className="px-3 pt-2 pb-0.5">
        <p className="text-[13px] text-muted-foreground ">
          {m.sidebar_management()}
        </p>
      </div>
      <div className="px-2 pb-2 space-y-0.5">
        <button
          type="button"
          onClick={onArchiveClick}
          aria-current={selectedFilter === FILTER_HIDDEN ? "page" : undefined}
          className={cn(
            "w-full flex items-center font-medium text-muted-foreground justify-between px-3 py-2 rounded-lg text-sm",
            "hover:bg-accent hover:text-primary transition-colors text-left",
            selectedFilter === FILTER_HIDDEN && "bg-accent ",
          )}
        >
          <div className="flex items-center gap-2 truncate flex-1 mr-2">
            <ArchiveBoldIcon className="size-5 shrink-0 " aria-hidden="true" />
            <span className="truncate">{m.sidebar_archive()}</span>
          </div>
          <span className="text-muted-foreground text-xs flex-shrink-0">
            {archiveCount}
          </span>
        </button>

        <button
          type="button"
          onClick={onBinClick}
          aria-current={selectedFilter === FILTER_BIN ? "page" : undefined}
          className={cn(
            "w-full flex items-center font-medium text-muted-foreground justify-between px-3 py-2 rounded-lg text-sm",
            "hover:bg-accent hover:text-primary transition-colors text-left",
            selectedFilter === FILTER_BIN && "bg-accent ",
          )}
        >
          <div className="flex items-center gap-2 truncate flex-1 mr-2">
            <TrashBoldIcon className="size-5 shrink-0" aria-hidden="true" />
            <span className="truncate">{m.bin_label?.() ?? "Bin"}</span>
          </div>
          <span className="text-muted-foreground text-xs flex-shrink-0">
            {binCount}
          </span>
        </button>
      </div>
    </div>
  );
}

/**
 * Draggable wrapper for SenderFolderItem using Motion's Reorder.Item.
 * The folder avatar acts as the drag handle. Applies spring + tilt physics:
 * velocity-based rotateZ tilt, scale lift, and elevated shadow while dragging.
 *
 * Key design decisions:
 * - Keep `layout="position"` on for stable pointer tracking.
 * - Use a spring layout transition only while actively reordering; when not
 *   dragging, layout transition duration is 0 so expand/collapse doesn't cause
 *   springy sibling shifts.
 * - Shadow & scale via CSS transition (not motion's `whileDrag`) so they
 *   revert instantly and predictably when the drag ends.
 * - Tilt via motion values (useVelocity → useTransform) for 60 fps
 *   velocity-tracking without React re-renders. Spring-animated back to 0
 *   on drag end for follow-through.
 */
function DraggableFolderItem({
  folder,
  onDragStart,
  onDragEnd,
  isReordering = false,
  ...folderItemProps
}: Omit<
  React.ComponentProps<typeof SenderFolderItem>,
  "folder" | "dragControls"
> & {
  folder: FolderData;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  isReordering?: boolean;
}) {
  const dragControls = useDragControls();
  const [isDragging, setIsDragging] = useState(false);
  const suppressClickAfterDragRef = useRef(false);
  const clearSuppressClickTimeoutRef = useRef<number | null>(null);

  // Velocity-based tilt: track cumulative drag offset → derive velocity → map to degrees
  const dragY = useMotionValue(0);
  const dragVelocity = useVelocity(dragY);
  const tilt = useTransform(dragVelocity, [-800, 0, 800], [-3, 0, 3], {
    clamp: true,
  });

  useEffect(() => {
    return () => {
      if (clearSuppressClickTimeoutRef.current !== null) {
        clearTimeout(clearSuppressClickTimeoutRef.current);
      }
    };
  }, []);

  return (
    <Reorder.Item
      value={folder._id}
      as="div"
      layout="position"
      drag="y"
      dragSnapToOrigin
      transition={
        isReordering
          ? {
              layout: {
                type: "spring",
                stiffness: 520,
                damping: 42,
                mass: 0.5,
              },
            }
          : { layout: { duration: 0 } }
      }
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      style={{ rotateZ: tilt }}
      onDrag={(_: PointerEvent, info: { offset: { y: number } }) =>
        dragY.set(info.offset.y)
      }
      onDragStart={() => {
        if (clearSuppressClickTimeoutRef.current !== null) {
          clearTimeout(clearSuppressClickTimeoutRef.current);
          clearSuppressClickTimeoutRef.current = null;
        }
        suppressClickAfterDragRef.current = true;
        setIsDragging(true);
        onDragStart?.();
      }}
      onDragEnd={() => {
        setIsDragging(false);
        clearSuppressClickTimeoutRef.current = window.setTimeout(() => {
          suppressClickAfterDragRef.current = false;
          clearSuppressClickTimeoutRef.current = null;
        }, 180);
        // Spring tilt back to 0 for follow-through
        animate(dragY, 0, { type: "spring", stiffness: 300, damping: 20 });
        onDragEnd?.();
      }}
      onClickCapture={(event) => {
        if (!suppressClickAfterDragRef.current) return;
        event.preventDefault();
        event.stopPropagation();
      }}
      className={cn(
        "relative rounded-lg transition-shadow duration-150 ease-out",
        isDragging
          ? "z-50 scale-[1.015] shadow-[0_8px_32px_rgba(0,0,0,0.12)]"
          : "z-0 scale-100 shadow-none",
      )}
    >
      <SenderFolderItem
        folder={folder}
        dragControls={dragControls}
        {...folderItemProps}
      />
    </Reorder.Item>
  );
}

/**
 * Sender folder sidebar with filter tabs and expandable folders.
 * Replaces the old FolderSidebar with a richer, nested design.
 */
export function SenderFolderSidebar({
  selectedFolderId,
  selectedNewsletterId,
  selectedFilter,
  hiddenNewsletters,
  hiddenPending,
  binnedNewsletters,
  binnedPending,
  favoritedNewsletters,
  favoritedPending,
  onFolderSelect,
  onNewsletterSelect,
  onFilterSelect,
  getIsFavorited,
  isFavoritePending,
  onToggleFavorite,
  onEmptyBin,
  isEmptyingBin = false,
  canLoadMore,
  isLoadingMore,
  onLoadMore,
}: SenderFolderSidebarProps) {
  const [sidebarFilter, setSidebarFilter] = useState<SidebarFilter>(
    selectedFilter === FILTER_STARRED ? "starred" : "all",
  );
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [expandedArchiveFolderIds, setExpandedArchiveFolderIds] = useState<
    Set<string>
  >(() => new Set());
  const [expandedBinFolderIds, setExpandedBinFolderIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [lastConnectedAt, setLastConnectedAt] = useState<number | undefined>(
    undefined,
  );
  const [isLastConnectedReady, setIsLastConnectedReady] = useState(false);
  const [recentTailPages, setRecentTailPages] = useState<NewsletterData[][]>(
    [],
  );
  const [recentCursor, setRecentCursor] = useState<string | null>(null);
  const [recentIsDone, setRecentIsDone] = useState(true);
  const [recentIsLoadingMore, setRecentIsLoadingMore] = useState(false);
  const [dismissedRecentNewsletterIds, setDismissedRecentNewsletterIds] =
    useState<Set<string>>(() => new Set());
  const recentLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const recentSectionRef = useRef<HTMLDivElement | null>(null);
  const loadRecentUnreadPage = useAction(
    api.newsletters.listRecentUnreadNewslettersPage,
  );
  const markNewsletterRead = useMutation(api.newsletters.markNewsletterRead);
  const markNewsletterUnread = useMutation(
    api.newsletters.markNewsletterUnread,
  );
  const hideNewsletter = useMutation(api.newsletters.hideNewsletter);
  const unhideNewsletter = useMutation(api.newsletters.unhideNewsletter);
  const binNewsletter = useMutation((api.newsletters as any).binNewsletter);
  const unhideFolder = useMutation(api.folders.unhideFolder);
  const reorderFoldersMutation = useMutation(api.folders.reorderFolders);
  const [localFolderOrderIds, setLocalFolderOrderIds] = useState<string[]>([]);
  const [restoringFolderId, setRestoringFolderId] = useState<string | null>(
    null,
  );
  const isDraggingRef = useRef(false);
  const [isReordering, setIsReordering] = useState(false);
  const lastPersistedFolderOrderIdsRef = useRef<string[]>([]);

  const {
    data: folders,
    isPending: foldersPending,
    isError: foldersError,
  } = useQuery(convexQuery(api.folders.listVisibleFoldersWithUnreadCounts, {}));

  // When a newsletter is open via `?newsletter=...` (without `?folder=...`),
  // fetch its metadata so we can highlight the corresponding sender folder row.
  const { data: selectedNewsletterMeta } = useQuery(
    convexQuery(
      api.newsletters.getUserNewsletter,
      selectedNewsletterId
        ? { userNewsletterId: selectedNewsletterId as Id<"userNewsletters"> }
        : "skip",
    ),
  );

  const { data: hiddenCount, isPending: hiddenCountPending } = useQuery(
    convexQuery(api.newsletters.getHiddenNewsletterCount, {}),
  );
  const { data: binnedCount, isPending: binnedCountPending } = useQuery(
    convexQuery((api.newsletters as any).getBinnedNewsletterCount, {}),
  );

  // Fetch hidden folders only when the Archive detail panel is active
  const { data: hiddenFoldersRaw, isPending: hiddenFoldersPending } = useQuery(
    convexQuery(
      api.folders.listHiddenFolders,
      selectedFilter === FILTER_HIDDEN || selectedFilter === FILTER_BIN
        ? {}
        : "skip",
    ),
  );

  const hiddenFolders = useMemo(
    () =>
      (hiddenFoldersRaw as unknown[] | undefined)?.filter(isHiddenFolderData) ??
      [],
    [hiddenFoldersRaw],
  );

  const shouldShowRecentSection =
    sidebarFilter === "all" &&
    selectedFilter !== FILTER_HIDDEN &&
    selectedFilter !== FILTER_STARRED &&
    selectedFilter !== FILTER_BIN;

  const { data: recentUnreadHead, isPending: recentUnreadPending } = useQuery(
    convexQuery(
      api.newsletters.listRecentUnreadNewslettersHead,
      shouldShowRecentSection && isLastConnectedReady
        ? {
            lastConnectedAt,
            numItems: RECENT_UNREAD_HEAD_SIZE,
          }
        : "skip",
    ),
  );

  const folderList = useMemo(() => {
    if (!folders) return [];
    return (folders as unknown[]).filter(isFolderData);
  }, [folders]);

  const selectedNewsletterFolderId = useMemo(() => {
    const folderId = (
      selectedNewsletterMeta as { folderId?: unknown } | null | undefined
    )?.folderId;
    return typeof folderId === "string" ? folderId : null;
  }, [selectedNewsletterMeta]);

  const effectiveSelectedFolderId =
    selectedFolderId ?? selectedNewsletterFolderId ?? null;

  // Build a lookup map: folderId → folderName (from visible + hidden folders)
  const folderNameLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const folder of folderList) {
      map.set(folder._id, folder.name);
    }
    for (const folder of hiddenFolders) {
      map.set(folder._id, folder.name);
    }
    return map;
  }, [folderList, hiddenFolders]);

  useEffect(() => {
    setExpandedFolderIds((previous) => {
      if (previous.size === 0) return previous;

      const visibleFolderIds = new Set(folderList.map((folder) => folder._id));
      const next = new Set(
        [...previous].filter((folderId) => visibleFolderIds.has(folderId)),
      );

      return next.size === previous.size ? previous : next;
    });
  }, [folderList]);

  const serverFolderOrderIds = useMemo(
    () => folderList.map((folder) => folder._id),
    [folderList],
  );

  const visibleFolderIdSet = useMemo(
    () => new Set(serverFolderOrderIds),
    [serverFolderOrderIds],
  );

  const folderById = useMemo(
    () => new Map(folderList.map((folder) => [folder._id, folder])),
    [folderList],
  );
  const hiddenFolderById = useMemo(
    () => new Map(hiddenFolders.map((folder) => [folder._id, folder])),
    [hiddenFolders],
  );

  const groupedHiddenNewsletters = useMemo(
    () => groupNewslettersByFolder(hiddenNewsletters, folderNameLookup),
    [hiddenNewsletters, folderNameLookup],
  );

  const groupedBinnedNewsletters = useMemo(
    () => groupNewslettersByFolder(binnedNewsletters, folderNameLookup),
    [binnedNewsletters, folderNameLookup],
  );

  const archiveFolderGroups = useMemo<ManagementFolderGroup[]>(() => {
    const groups = new Map<string, ManagementFolderGroup>();

    for (const folder of hiddenFolders) {
      groups.set(folder._id, {
        key: folder._id,
        folder: {
          ...toFolderDataFromGroup({
            id: folder._id,
            name: folder.name,
            newsletters: [],
            baseFolder: folder,
            isHidden: true,
          }),
          newsletterCount: folder.newsletterCount,
          unreadCount: folder.unreadCount ?? 0,
          senderCount: folder.senderCount,
        },
        newsletters: [],
        useLiveFolderFeed: true,
        canUnarchiveFolder: true,
      });
    }

    for (const group of groupedHiddenNewsletters) {
      const key = group.folderId ?? "__archive_uncategorized__";
      const baseFolder = group.folderId
        ? (hiddenFolderById.get(group.folderId) ??
          folderById.get(group.folderId))
        : undefined;
      const folder = toFolderDataFromGroup({
        id: group.folderId ?? key,
        name: group.folderName,
        newsletters: group.newsletters,
        baseFolder,
        isHidden: true,
      });
      const existing = groups.get(key);
      groups.set(key, {
        key,
        folder: existing
          ? {
              ...folder,
              newsletterCount: Math.max(
                existing.folder.newsletterCount,
                group.newsletters.length,
              ),
              senderCount: Math.max(
                existing.folder.senderCount,
                folder.senderCount,
              ),
            }
          : folder,
        newsletters: existing?.newsletters.length
          ? existing.newsletters
          : group.newsletters,
        useLiveFolderFeed: existing?.useLiveFolderFeed ?? false,
        canUnarchiveFolder: existing?.canUnarchiveFolder ?? false,
      });
    }

    return [...groups.values()].sort((a, b) =>
      a.folder.name.localeCompare(b.folder.name),
    );
  }, [folderById, groupedHiddenNewsletters, hiddenFolderById, hiddenFolders]);

  const binnedFolderGroups = useMemo<ManagementFolderGroup[]>(
    () =>
      groupedBinnedNewsletters
        .map((group) => {
          const key = group.folderId ?? "__bin_uncategorized__";
          const baseFolder = group.folderId
            ? (folderById.get(group.folderId) ??
              hiddenFolderById.get(group.folderId))
            : undefined;
          return {
            key,
            folder: toFolderDataFromGroup({
              id: group.folderId ?? key,
              name: group.folderName,
              newsletters: group.newsletters,
              baseFolder,
            }),
            newsletters: group.newsletters,
            useLiveFolderFeed: false,
            canUnarchiveFolder: false,
          };
        })
        .sort((a, b) => a.folder.name.localeCompare(b.folder.name)),
    [folderById, groupedBinnedNewsletters, hiddenFolderById],
  );

  // Sync local drag order from server data when not mid-drag
  useEffect(() => {
    if (isDraggingRef.current) return;
    setLocalFolderOrderIds((previous) => {
      if (previous.length === 0) return serverFolderOrderIds;

      const retainedIds = previous.filter((id) => visibleFolderIdSet.has(id));
      const retainedIdSet = new Set(retainedIds);
      const newIds = serverFolderOrderIds.filter(
        (id) => !retainedIdSet.has(id),
      );
      const next = [...retainedIds, ...newIds];
      return areFolderOrdersEqual(previous, next) ? previous : next;
    });
    lastPersistedFolderOrderIdsRef.current = serverFolderOrderIds;
  }, [serverFolderOrderIds, visibleFolderIdSet]);

  const orderedFolders = useMemo(() => {
    if (localFolderOrderIds.length === 0) return folderList;

    const ordered = localFolderOrderIds
      .map((id) => folderById.get(id))
      .filter((folder): folder is FolderData => folder !== undefined);

    return ordered.length > 0 ? ordered : folderList;
  }, [localFolderOrderIds, folderById, folderList]);

  const visibleFolders = useMemo(() => {
    if (sidebarFilter === "unread") {
      return orderedFolders.filter((folder) => folder.unreadCount > 0);
    }
    return orderedFolders;
  }, [orderedFolders, sidebarFilter]);

  const canReorderFolders = sidebarFilter === "all";

  const handleFolderDragStart = useCallback(() => {
    setIsReordering(true);
    isDraggingRef.current = true;
  }, []);

  const handleFolderReorder = useCallback((nextIds: string[]) => {
    setLocalFolderOrderIds((previous) =>
      areFolderOrdersEqual(previous, nextIds) ? previous : nextIds,
    );
  }, []);

  const handleFolderDragEnd = useCallback(() => {
    setIsReordering(false);
    isDraggingRef.current = false;

    const reorderedIds = localFolderOrderIds.filter((id) =>
      visibleFolderIdSet.has(id),
    );
    if (reorderedIds.length === 0) return;

    if (
      areFolderOrdersEqual(reorderedIds, lastPersistedFolderOrderIdsRef.current)
    ) {
      return;
    }

    lastPersistedFolderOrderIdsRef.current = reorderedIds;
    void reorderFoldersMutation({
      orderedFolderIds: reorderedIds as Id<"folders">[],
    });
  }, [localFolderOrderIds, reorderFoldersMutation, visibleFolderIdSet]);

  const visibleFavoritedNewsletters = useMemo(
    () =>
      favoritedNewsletters.filter((newsletter) =>
        getIsFavorited(newsletter._id, Boolean(newsletter.isFavorited)),
      ),
    [favoritedNewsletters, getIsFavorited],
  );

  const visibleHiddenNewsletters = useMemo(
    () => hiddenNewsletters,
    [hiddenNewsletters],
  );
  const visibleBinnedNewsletters = useMemo(
    () => binnedNewsletters,
    [binnedNewsletters],
  );
  const recentHeadPage = useMemo(() => {
    const data = recentUnreadHead as unknown as
      | { page?: NewsletterData[] }
      | undefined;
    return (data?.page ?? []) as NewsletterData[];
  }, [recentUnreadHead]);

  const recentUnreadNewsletters = useMemo(() => {
    const merged: NewsletterData[] = [];
    const seen = new Set<string>();
    for (const newsletter of [...recentHeadPage, ...recentTailPages.flat()]) {
      const id = String(newsletter._id);
      if (seen.has(id)) continue;
      seen.add(id);
      if (newsletter.isRead) continue;
      if (dismissedRecentNewsletterIds.has(id)) continue;
      merged.push(newsletter);
    }
    return merged;
  }, [recentHeadPage, recentTailPages, dismissedRecentNewsletterIds]);

  const hasRecentUnreadSection = shouldShowRecentSection
    ? recentUnreadPending || recentUnreadNewsletters.length > 0
    : false;

  useEffect(() => {
    if (selectedFilter === FILTER_STARRED) {
      setSidebarFilter("starred");
      return;
    }
    setSidebarFilter((current) => (current === "starred" ? "all" : current));
  }, [selectedFilter]);

  const handleHiddenClick = () => {
    if (selectedFilter === FILTER_HIDDEN) {
      onFilterSelect(null);
      return;
    }

    setSidebarFilter("all");
    onFolderSelect(null);
    onFilterSelect(FILTER_HIDDEN);
  };

  const handleTabChange = (value: SidebarFilter) => {
    setSidebarFilter(value);

    if (value === "starred") {
      onFolderSelect(null);
      onFilterSelect(FILTER_STARRED);
      return;
    }

    if (
      selectedFilter === FILTER_STARRED ||
      selectedFilter === FILTER_HIDDEN ||
      selectedFilter === FILTER_BIN
    ) {
      onFilterSelect(null);
    }
  };

  const handleBinClick = () => {
    if (selectedFilter === FILTER_BIN) {
      onFilterSelect(null);
      return;
    }

    setSidebarFilter("all");
    onFolderSelect(null);
    onFilterSelect(FILTER_BIN);
  };

  const handleBackClick = () => {
    onFilterSelect(null);
  };

  const handleFolderExpandedChange = (folderId: string, expanded: boolean) => {
    setExpandedFolderIds((previous) => {
      const next = new Set(previous);
      if (expanded) {
        next.add(folderId);
      } else {
        next.delete(folderId);
      }
      return next;
    });
  };

  const handleArchiveFolderExpandedChange = (
    folderId: string,
    expanded: boolean,
  ) => {
    setExpandedArchiveFolderIds((previous) => {
      const next = new Set(previous);
      if (expanded) {
        next.add(folderId);
      } else {
        next.delete(folderId);
      }
      return next;
    });
  };

  const handleBinFolderExpandedChange = (
    folderId: string,
    expanded: boolean,
  ) => {
    setExpandedBinFolderIds((previous) => {
      const next = new Set(previous);
      if (expanded) {
        next.add(folderId);
      } else {
        next.delete(folderId);
      }
      return next;
    });
  };

  useEffect(() => {
    const keys = archiveFolderGroups.map((group) => group.key);
    setExpandedArchiveFolderIds((previous) => {
      const allowed = new Set(keys);
      const next = new Set([...previous].filter((key) => allowed.has(key)));
      return next.size === previous.size ? previous : next;
    });
  }, [archiveFolderGroups]);

  useEffect(() => {
    if (selectedFilter !== FILTER_HIDDEN) return;
    setExpandedArchiveFolderIds(new Set());
  }, [selectedFilter]);

  useEffect(() => {
    const keys = binnedFolderGroups.map((group) => group.key);
    setExpandedBinFolderIds((previous) => {
      const allowed = new Set(keys);
      const next = new Set([...previous].filter((key) => allowed.has(key)));
      return next.size === previous.size ? previous : next;
    });
  }, [binnedFolderGroups]);

  useEffect(() => {
    if (selectedFilter !== FILTER_BIN) return;
    setExpandedBinFolderIds(new Set());
  }, [selectedFilter]);

  useEffect(() => {
    let previousVisit: number | undefined;
    try {
      const rawValue = localStorage.getItem(LAST_NEWSLETTERS_VISIT_KEY);
      if (rawValue) {
        const parsed = Number(rawValue);
        if (Number.isFinite(parsed) && parsed > 0) {
          previousVisit = parsed;
        }
      }
      localStorage.setItem(LAST_NEWSLETTERS_VISIT_KEY, String(Date.now()));
    } catch {
      // localStorage unavailable
    }
    setLastConnectedAt(previousVisit);
    setIsLastConnectedReady(true);
  }, []);

  useEffect(() => {
    if (!shouldShowRecentSection) {
      setRecentTailPages([]);
      setRecentCursor(null);
      setRecentIsDone(true);
      setRecentIsLoadingMore(false);
      setDismissedRecentNewsletterIds(new Set());
      return;
    }
    setRecentTailPages([]);
    setRecentCursor(null);
    setRecentIsDone(true);
    setRecentIsLoadingMore(false);
    setDismissedRecentNewsletterIds(new Set());
  }, [shouldShowRecentSection, lastConnectedAt, isLastConnectedReady]);

  const handleDismissRecentNewsletter = useCallback((newsletterId: string) => {
    setDismissedRecentNewsletterIds((previous) => {
      if (previous.has(newsletterId)) return previous;
      const next = new Set(previous);
      next.add(newsletterId);
      return next;
    });
  }, []);

  const handleToggleRead = useCallback(
    async (newsletterId: string, currentValue: boolean) => {
      if (currentValue) {
        await markNewsletterUnread({
          userNewsletterId: newsletterId as Id<"userNewsletters">,
        });
        return;
      }
      await markNewsletterRead({
        userNewsletterId: newsletterId as Id<"userNewsletters">,
      });
    },
    [markNewsletterRead, markNewsletterUnread],
  );

  const handleArchive = useCallback(
    async (newsletterId: string) => {
      await hideNewsletter({
        userNewsletterId: newsletterId as Id<"userNewsletters">,
      });
    },
    [hideNewsletter],
  );

  const handleUnarchiveNewsletter = useCallback(
    async (newsletterId: string) => {
      await unhideNewsletter({
        userNewsletterId: newsletterId as Id<"userNewsletters">,
      });
    },
    [unhideNewsletter],
  );

  const handleMoveToBin = useCallback(
    async (newsletterId: string) => {
      await binNewsletter({
        userNewsletterId: newsletterId as Id<"userNewsletters">,
      });
    },
    [binNewsletter],
  );

  const handleUnarchiveFolder = useCallback(
    async (folderId: string) => {
      if (restoringFolderId !== null) return;
      setRestoringFolderId(folderId);
      try {
        await unhideFolder({ folderId: folderId as Id<"folders"> });
      } finally {
        setRestoringFolderId((current) =>
          current === folderId ? null : current,
        );
      }
    },
    [restoringFolderId, unhideFolder],
  );

  useEffect(() => {
    if (
      !shouldShowRecentSection ||
      !isLastConnectedReady ||
      !recentUnreadHead
    ) {
      return;
    }
    if (recentCursor !== null || recentTailPages.length > 0) return;
    const data = recentUnreadHead as unknown as {
      continueCursor: string | null;
      isDone: boolean;
    };
    setRecentCursor(data.continueCursor ?? null);
    setRecentIsDone(data.isDone ?? true);
  }, [
    shouldShowRecentSection,
    isLastConnectedReady,
    recentUnreadHead,
    recentCursor,
    recentTailPages.length,
  ]);

  const canLoadMoreRecent =
    shouldShowRecentSection && !recentIsDone && recentCursor !== null;

  const handleLoadMoreRecent = useCallback(async () => {
    if (!canLoadMoreRecent || recentIsLoadingMore || recentCursor === null)
      return;
    setRecentIsLoadingMore(true);
    try {
      const result = await loadRecentUnreadPage({
        cursor: recentCursor,
        numItems: RECENT_UNREAD_PAGE_SIZE,
        lastConnectedAt,
      });
      const page = (result.page ?? []) as NewsletterData[];
      setRecentTailPages((previous) => [...previous, page]);
      setRecentCursor(result.continueCursor ?? null);
      setRecentIsDone(result.isDone ?? true);
    } finally {
      setRecentIsLoadingMore(false);
    }
  }, [
    canLoadMoreRecent,
    recentIsLoadingMore,
    recentCursor,
    loadRecentUnreadPage,
    lastConnectedAt,
  ]);

  useEffect(() => {
    if (!canLoadMoreRecent) return;
    const sentinel = recentLoadMoreRef.current;
    const section = recentSectionRef.current;
    if (!sentinel || !section) return;

    const viewport = section.querySelector<HTMLElement>(
      "[data-slot='scroll-area-viewport']",
    );
    if (!viewport) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void handleLoadMoreRecent();
        }
      },
      { root: viewport, threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [canLoadMoreRecent, handleLoadMoreRecent]);

  // Whether one of the management detail panels is active
  const isManagementDetailActive =
    selectedFilter === FILTER_HIDDEN || selectedFilter === FILTER_BIN;

  if (foldersError) {
    return (
      <aside
        className="w-[300px] border-r bg-background"
        role="navigation"
        aria-label={m.newsletters_folderNavigation()}
      >
        <div className="flex items-center gap-2 text-destructive text-sm p-4">
          <AlertCircle className="h-4 w-4" />
          <span>{m.folder_loadError()}</span>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className="relative w-[300px] border-r bg-background flex flex-col overflow-hidden"
      role="navigation"
      aria-label={m.newsletters_folderNavigation()}
    >
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          {isManagementDetailActive ? (
            <motion.div
              key={`detail-${selectedFilter}`}
              className="absolute inset-0 flex flex-col min-h-0 overflow-hidden"
              initial={{ x: "100%", opacity: 0, filter: "blur(10px)" }}
              animate={{ x: 0, opacity: 1, filter: "blur(0px)" }}
              exit={{ x: "100%", opacity: 0, filter: "blur(10px)" }}
              //transition={{ type: "spring", stiffness: 400, damping: 35 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              {/* Detail panel header */}
              <div className="flex items-center gap-2 px-3 py-3 border-b flex-shrink-0">
                <button
                  type="button"
                  onClick={handleBackClick}
                  aria-label={m.sidebar_back?.() ?? "Back"}
                  className="p-1 rounded-md hover:bg-accent transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <h2 className="text-sm font-semibold">
                  {selectedFilter === FILTER_HIDDEN
                    ? m.sidebar_archive()
                    : (m.bin_label?.() ?? "Bin")}
                </h2>
              </div>

              {/* Archive detail content */}
              {selectedFilter === FILTER_HIDDEN && (
                <ScrollArea className="flex-1">
                  <div className="px-2 py-2 space-y-2">
                    {hiddenPending || hiddenFoldersPending ? (
                      <SidebarSkeleton />
                    ) : archiveFolderGroups.length > 0 ? (
                      <div className="space-y-0.5">
                        {archiveFolderGroups.map((group) => (
                          <SenderFolderItem
                            key={group.key}
                            folder={group.folder}
                            isSelected={expandedArchiveFolderIds.has(group.key)}
                            selectedNewsletterId={selectedNewsletterId}
                            sidebarFilter="all"
                            isExpanded={expandedArchiveFolderIds.has(group.key)}
                            onExpandedChange={(expanded) =>
                              handleArchiveFolderExpandedChange(
                                group.key,
                                expanded,
                              )
                            }
                            onFolderSelect={() => {}}
                            onNewsletterSelect={onNewsletterSelect}
                            newslettersOverride={
                              group.useLiveFolderFeed
                                ? undefined
                                : group.newsletters
                            }
                            selectFolderOnClick={false}
                            showFolderActions={false}
                            onRestoreFolder={
                              group.canUnarchiveFolder
                                ? handleUnarchiveFolder
                                : undefined
                            }
                            isRestoreFolderPending={
                              group.canUnarchiveFolder &&
                              restoringFolderId === group.folder._id
                            }
                            getIsFavorited={getIsFavorited}
                            isFavoritePending={isFavoritePending}
                            onToggleFavorite={onToggleFavorite}
                            onToggleRead={handleToggleRead}
                            onUnarchive={
                              group.useLiveFolderFeed
                                ? undefined
                                : handleUnarchiveNewsletter
                            }
                            onBin={handleMoveToBin}
                          />
                        ))}
                      </div>
                    ) : (
                      <SidebarEmptyState
                        icon={Archive}
                        title={m.archive_emptyState?.() ?? "No archived items"}
                        description={m.archive_emptyStateDesc?.() ?? "Newsletters and folders you archive will appear here."}
                      />
                    )}

                    {/* Load more */}
                    {canLoadMore && onLoadMore && (
                      <div className="px-2 py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          disabled={Boolean(isLoadingMore)}
                          onClick={() => onLoadMore()}
                        >
                          {isLoadingMore ? "Loading..." : "Load more"}
                        </Button>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              )}

              {/* Bin detail content */}
              {selectedFilter === FILTER_BIN && (
                <ScrollArea className="flex-1">
                  <div className="px-2 py-2 space-y-2">
                    {binnedPending ? (
                      <SidebarSkeleton />
                    ) : visibleBinnedNewsletters.length === 0 ? (
                      <SidebarEmptyState
                        icon={Trash2}
                        title={m.bin_emptyState?.() ?? "Bin is empty"}
                        description={m.bin_emptyStateDesc?.() ?? "Newsletters you delete will be moved here."}
                      />
                    ) : (
                      <>
                        {/* Empty bin action */}
                        {onEmptyBin && (
                          <div className="px-2 pt-1">
                            <AlertDialog>
                              <AlertDialogTrigger
                                render={
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="sm"
                                    className="w-full"
                                    disabled={isEmptyingBin}
                                  />
                                }
                              >
                                {m.bin_emptyAction?.() ?? "Empty Bin"}
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    {m.bin_emptyConfirmTitle?.() ??
                                      "Empty Bin?"}
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {m.bin_emptyConfirmDescription?.() ??
                                      "This will permanently delete all newsletters currently in Bin. This action cannot be undone."}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>
                                    {m.common_cancel()}
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => {
                                      void onEmptyBin();
                                    }}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    disabled={isEmptyingBin}
                                  >
                                    {m.common_delete()}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}

                        <div className="space-y-0.5">
                          {binnedFolderGroups.map((group) => (
                            <SenderFolderItem
                              key={group.key}
                              folder={group.folder}
                              isSelected={expandedBinFolderIds.has(group.key)}
                              selectedNewsletterId={selectedNewsletterId}
                              sidebarFilter="all"
                              isExpanded={expandedBinFolderIds.has(group.key)}
                              onExpandedChange={(expanded) =>
                                handleBinFolderExpandedChange(
                                  group.key,
                                  expanded,
                                )
                              }
                              onFolderSelect={() => {}}
                              onNewsletterSelect={onNewsletterSelect}
                              newslettersOverride={group.newsletters}
                              selectFolderOnClick={false}
                              showFolderActions={false}
                              getIsFavorited={getIsFavorited}
                              isFavoritePending={isFavoritePending}
                              onToggleFavorite={onToggleFavorite}
                              onToggleRead={handleToggleRead}
                            />
                          ))}
                        </div>

                        {/* Load more */}
                        {canLoadMore && onLoadMore && (
                          <div className="px-2 py-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="w-full"
                              disabled={Boolean(isLoadingMore)}
                              onClick={() => onLoadMore()}
                            >
                              {isLoadingMore ? "Loading..." : "Load more"}
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </ScrollArea>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="main"
              className="absolute inset-0 flex flex-col min-h-0 overflow-hidden"
              initial={{ x: "-100%", opacity: 0, filter: "blur(10px)" }}
              animate={{ x: 0, opacity: 1, filter: "blur(0px)" }}
              exit={{ x: "-100%", opacity: 0, filter: "blur(10px)" }}
              //transition={{ type: "spring", stiffness: 400, damping: 35 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              {/* Header: title + filter pills */}
              <div className="flex items-center justify-between px-4 pt-3 pb-1">
                <h2 className="text-[13px] text-muted-foreground">
                  {m.sidebar_core()}
                </h2>
                <div className="flex items-center gap-0.5">
                  {(
                    [
                      { value: "all", label: m.sidebar_filterAll() },
                      { value: "unread", label: m.sidebar_filterUnread() },
                      { value: "starred", label: m.sidebar_filterStarred() },
                    ] as const
                  ).map((filter) => (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() =>
                        handleTabChange(filter.value as SidebarFilter)
                      }
                      className={cn(
                        "px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors",
                        sidebarFilter === filter.value
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                      )}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Folder list */}
              <ScrollArea className="h-fit mt-2">
                <div className="px-2 pb-2 space-y-0.5">
                  {hasRecentUnreadSection && (
                    <>
                      <div className="px-2 py-1">
                        <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                          {m.sidebar_recentUnreadSinceLastVisit()}
                        </p>
                      </div>

                      <div
                        ref={recentSectionRef}
                        className="max-h-60 rounded-lg border border-border/70 bg-muted/20"
                      >
                        <ScrollArea className="h-full">
                          <div className="p-1 space-y-0.5">
                            {recentUnreadPending ? (
                              <div className="space-y-1 py-1">
                                {[0, 1, 2].map((index) => (
                                  <div
                                    key={index}
                                    className="animate-pulse px-3 py-2"
                                  >
                                    <div className="h-3.5 bg-muted rounded w-4/5" />
                                    <div className="h-3 bg-muted rounded w-1/2 mt-1" />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              recentUnreadNewsletters.map((newsletter) => (
                                <NewsletterListItem
                                  key={newsletter._id}
                                  newsletter={newsletter}
                                  isSelected={
                                    selectedNewsletterId === newsletter._id
                                  }
                                  isFavorited={getIsFavorited(
                                    newsletter._id,
                                    Boolean(newsletter.isFavorited),
                                  )}
                                  isFavoritePending={isFavoritePending(
                                    newsletter._id,
                                  )}
                                  enableHideAction
                                  onHide={handleDismissRecentNewsletter}
                                  onClick={onNewsletterSelect}
                                  onToggleFavorite={onToggleFavorite}
                                  onToggleRead={handleToggleRead}
                                  onBin={handleMoveToBin}
                                />
                              ))
                            )}

                            {canLoadMoreRecent && (
                              <div ref={recentLoadMoreRef} className="h-8" />
                            )}
                            {recentIsLoadingMore && (
                              <p className="px-3 py-2 text-xs text-muted-foreground">
                                Loading...
                              </p>
                            )}
                          </div>
                        </ScrollArea>
                      </div>

                      <div
                        className="h-px bg-border my-2 mx-2"
                        role="separator"
                      />
                    </>
                  )}

                  {sidebarFilter === "starred" ? (
                    favoritedPending ? (
                      <SidebarSkeleton />
                    ) : visibleFavoritedNewsletters.length === 0 ? (
                      <SidebarEmptyState
                        icon={Star}
                        title={m.newsletters_noStarredNewsletters()}
                        description={m.newsletters_noStarredDesc?.() ?? "Star newsletters you want to find again quickly."}
                      />
                    ) : (
                      <div className="space-y-0.5">
                        {visibleFavoritedNewsletters.map((newsletter) => (
                          <NewsletterListItem
                            key={newsletter._id}
                            newsletter={newsletter}
                            isSelected={selectedNewsletterId === newsletter._id}
                            isFavorited={getIsFavorited(
                              newsletter._id,
                              Boolean(newsletter.isFavorited),
                            )}
                            isFavoritePending={isFavoritePending(
                              newsletter._id,
                            )}
                            onClick={onNewsletterSelect}
                            onToggleFavorite={onToggleFavorite}
                            onToggleRead={handleToggleRead}
                            onArchive={handleArchive}
                            onBin={handleMoveToBin}
                          />
                        ))}
                        {canLoadMore && onLoadMore && (
                          <div className="px-2 py-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="w-full"
                              disabled={Boolean(isLoadingMore)}
                              onClick={() => onLoadMore()}
                            >
                              {isLoadingMore ? "Loading..." : "Load more"}
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  ) : foldersPending ? (
                    <SidebarSkeleton />
                  ) : visibleFolders.length === 0 ? (
                    sidebarFilter === "unread" ? (
                      <SidebarEmptyState
                        icon={CheckCircle2}
                        title={m.sidebar_allCaughtUp?.() ?? "All caught up!"}
                        description={m.sidebar_allCaughtUpDesc?.() ?? "No unread newsletters right now."}
                        iconClassName="text-emerald-500"
                      />
                    ) : (
                      <SidebarEmptyState
                        icon={Archive}
                        title={m.folder_emptyState()}
                      />
                    )
                  ) : !canReorderFolders ? (
                    <div className="space-y-0.5">
                      {visibleFolders.map((folder) => (
                        <SenderFolderItem
                          key={folder._id}
                          folder={folder}
                          isSelected={effectiveSelectedFolderId === folder._id}
                          selectedNewsletterId={selectedNewsletterId}
                          sidebarFilter={sidebarFilter}
                          isExpanded={expandedFolderIds.has(folder._id)}
                          onExpandedChange={(expanded) =>
                            handleFolderExpandedChange(folder._id, expanded)
                          }
                          onFolderSelect={(id) => {
                            onFilterSelect(null);
                            onFolderSelect(id);
                          }}
                          onNewsletterSelect={onNewsletterSelect}
                          getIsFavorited={getIsFavorited}
                          isFavoritePending={isFavoritePending}
                          onToggleFavorite={onToggleFavorite}
                          onToggleRead={handleToggleRead}
                          onArchive={handleArchive}
                          onBin={handleMoveToBin}
                          onHideSuccess={() => {
                            if (selectedFolderId === folder._id) {
                              onFolderSelect(null);
                            }
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <Reorder.Group
                      axis="y"
                      as="div"
                      layoutScroll
                      values={localFolderOrderIds}
                      onReorder={handleFolderReorder}
                      className="space-y-0.5"
                    >
                      {visibleFolders.map((folder) => (
                        <DraggableFolderItem
                          key={folder._id}
                          folder={folder}
                          isReordering={isReordering}
                          isSelected={effectiveSelectedFolderId === folder._id}
                          selectedNewsletterId={selectedNewsletterId}
                          sidebarFilter={sidebarFilter}
                          isExpanded={expandedFolderIds.has(folder._id)}
                          onExpandedChange={(expanded) =>
                            handleFolderExpandedChange(folder._id, expanded)
                          }
                          onFolderSelect={(id) => {
                            onFilterSelect(null);
                            onFolderSelect(id);
                          }}
                          onNewsletterSelect={onNewsletterSelect}
                          getIsFavorited={getIsFavorited}
                          isFavoritePending={isFavoritePending}
                          onToggleFavorite={onToggleFavorite}
                          onToggleRead={handleToggleRead}
                          onArchive={handleArchive}
                          onBin={handleMoveToBin}
                          onHideSuccess={() => {
                            if (selectedFolderId === folder._id) {
                              onFolderSelect(null);
                            }
                          }}
                          onDragStart={handleFolderDragStart}
                          onDragEnd={handleFolderDragEnd}
                        />
                      ))}
                    </Reorder.Group>
                  )}
                </div>
              </ScrollArea>

              {/* Management section — always-visible, pinned at bottom */}
              <ManagementSection
                archiveCount={
                  hiddenCountPending
                    ? 0
                    : (hiddenCount ?? visibleHiddenNewsletters.length)
                }
                binCount={
                  binnedCountPending
                    ? 0
                    : (binnedCount ?? visibleBinnedNewsletters.length)
                }
                selectedFilter={selectedFilter}
                onArchiveClick={handleHiddenClick}
                onBinClick={handleBinClick}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <SidebarFooter />
    </aside>
  );
}
