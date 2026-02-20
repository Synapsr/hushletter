import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { useAction } from "convex/react";
import { api } from "@hushletter/backend";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsiblePanel,
  Badge,
  ScrollArea,
  Button,
} from "@hushletter/ui";
import { cn } from "@/lib/utils";
import { NewsletterListItem } from "./NewsletterListItem";
import { SenderAvatar, SenderAvatarGroup } from "./SenderAvatar";
import { FolderActionsDropdown } from "@/components/FolderActionsDropdown";
import type { FolderData } from "@/components/FolderSidebar";
import type { NewsletterData } from "@/components/NewsletterCard";
import { m } from "@/paraglide/messages.js";
import { ChevronRightIcon } from "@hushletter/ui";
import { RotateCcw } from "lucide-react";
import type { DragControls } from "motion/react";

interface SenderFolderItemProps {
  folder: FolderData;
  isSelected: boolean;
  selectedNewsletterId: string | null;
  sidebarFilter: "all" | "unread" | "starred";
  isExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onFolderSelect: (folderId: string) => void;
  onNewsletterSelect: (newsletterId: string) => void;
  newslettersOverride?: NewsletterData[];
  newslettersPendingOverride?: boolean;
  selectFolderOnClick?: boolean;
  showFolderActions?: boolean;
  getIsFavorited: (newsletterId: string, serverValue?: boolean) => boolean;
  isFavoritePending: (newsletterId: string) => boolean;
  onToggleFavorite: (
    newsletterId: string,
    currentValue: boolean,
  ) => Promise<void>;
  onToggleRead: (newsletterId: string, currentValue: boolean) => Promise<void>;
  onArchive?: (newsletterId: string) => Promise<void>;
  onUnarchive?: (newsletterId: string) => Promise<void>;
  onBin?: (newsletterId: string) => Promise<void>;
  onHideSuccess?: () => void;
  onRestoreFolder?: (folderId: string) => Promise<void> | void;
  isRestoreFolderPending?: boolean;
  dragControls?: DragControls;
}

/**
 * Expandable sender folder with lazy-loaded newsletter items.
 * Fetches newsletters only when the folder is expanded.
 */
export function SenderFolderItem({
  folder,
  isSelected,
  selectedNewsletterId,
  sidebarFilter,
  isExpanded,
  onExpandedChange,
  onFolderSelect,
  onNewsletterSelect,
  newslettersOverride,
  newslettersPendingOverride = false,
  selectFolderOnClick = true,
  showFolderActions = true,
  getIsFavorited,
  isFavoritePending,
  onToggleFavorite,
  onToggleRead,
  onArchive,
  onUnarchive,
  onBin,
  onHideSuccess,
  onRestoreFolder,
  isRestoreFolderPending = false,
  dragControls,
}: SenderFolderItemProps) {
  const folderId = folder._id as Id<"folders">;
  const usesStaticNewsletters = newslettersOverride !== undefined;

  // Reactive head page (subscribed) only while expanded.
  const { data: head, isPending: headPending } = useQuery(
    convexQuery(
      api.newsletters.listUserNewslettersByFolderHead,
      isExpanded && !usesStaticNewsletters
        ? { folderId, numItems: 20 }
        : "skip",
    ),
  );

  const loadPage = useAction(api.newsletters.listUserNewslettersByFolderPage);
  const [tailPages, setTailPages] = useState<NewsletterData[][]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    if (!isExpanded) return;
    setTailPages([]);
    setCursor(null);
    setIsDone(true);
    setIsLoadingMore(false);
  }, [isExpanded, folderId]);

  useEffect(() => {
    if (!isExpanded) return;
    if (!head) return;
    if (cursor !== null || tailPages.length > 0) return;

    const data = head as unknown as {
      continueCursor: string | null;
      isDone: boolean;
    };
    setCursor(data.continueCursor);
    setIsDone(data.isDone);
  }, [isExpanded, head, cursor, tailPages.length]);

  const liveHeadPage = useMemo(() => {
    const data = head as unknown as { page?: NewsletterData[] } | undefined;
    return (data?.page ?? []) as NewsletterData[];
  }, [head]);

  const headPage = newslettersOverride ?? liveHeadPage;
  const isHeadPending = usesStaticNewsletters
    ? newslettersPendingOverride
    : headPending;

  const senderPreviews = useMemo(() => {
    if (folder.senderPreviews && folder.senderPreviews.length > 0) {
      return folder.senderPreviews;
    }

    const deduped = new Map<
      string,
      { senderEmail: string; senderName?: string }
    >();
    for (const newsletter of headPage) {
      if (!newsletter.senderEmail || deduped.has(newsletter.senderEmail))
        continue;
      deduped.set(newsletter.senderEmail, {
        senderEmail: newsletter.senderEmail,
        senderName: newsletter.senderName,
      });
      if (deduped.size >= 3) break;
    }

    return [...deduped.values()];
  }, [folder.senderPreviews, headPage]);

  const mergedNewsletters = useMemo(() => {
    if (usesStaticNewsletters) {
      return headPage;
    }
    const merged: NewsletterData[] = [];
    const seen = new Set<string>();
    for (const newsletter of [...headPage, ...tailPages.flat()]) {
      const id = String(newsletter._id);
      if (seen.has(id)) continue;
      seen.add(id);
      merged.push(newsletter);
    }
    return merged;
  }, [headPage, tailPages, usesStaticNewsletters]);

  // Apply sidebar filter
  const filteredNewsletters =
    sidebarFilter === "unread"
      ? mergedNewsletters.filter((n) => !n.isRead)
      : mergedNewsletters;

  const canLoadMore =
    !usesStaticNewsletters && isExpanded && !isDone && cursor !== null;
  const handleLoadMore = useCallback(async () => {
    if (!canLoadMore || isLoadingMore || cursor === null) return;
    setIsLoadingMore(true);
    try {
      const result = await loadPage({ folderId, cursor, numItems: 50 });
      const page = (result.page ?? []) as NewsletterData[];
      setTailPages((prev) => [...prev, page]);
      setCursor(result.continueCursor ?? null);
      setIsDone(result.isDone ?? true);
    } finally {
      setIsLoadingMore(false);
    }
  }, [canLoadMore, isLoadingMore, cursor, loadPage, folderId]);

  const handleFolderSelect = () => {
    if (selectFolderOnClick) {
      onFolderSelect(folder._id);
    }
    /*  if (!isExpanded) {
      onExpandedChange(true);
    } */

    onExpandedChange(!isExpanded);
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={onExpandedChange}>
      <div
        className={cn(
          "group flex items-center rounded-lg",
          "hover:bg-hover",
          isSelected && "bg-hover",
        )}
      >
        <button
          type="button"
          onClick={handleFolderSelect}
          aria-current={isSelected ? "page" : undefined}
          className="flex items-center gap-2 flex-1 px-1 py-2 min-w-0 text-left"
        >
          <span
            onPointerDown={(e) => {
              if (!dragControls) return;
              e.preventDefault();
              e.stopPropagation();
              dragControls.start(e);
            }}
            onClick={(e) => {
              if (!dragControls) return;
              e.preventDefault();
              e.stopPropagation();
            }}
            className={cn(
              "shrink-0",
              dragControls &&
                "select-none cursor-grab active:cursor-grabbing touch-none relative",
            )}
          >
            {senderPreviews.length > 1 ? (
              <SenderAvatarGroup
                senders={senderPreviews}
                className={cn(
                  folder.unreadCount ? "" : "*:border",
                  folder.unreadCount > 0 || isExpanded
                    ? "text-primary"
                    : "text-muted-foreground group-hover:text-foreground",
                )}
              />
            ) : (
              <SenderAvatar
                className={cn(
                  folder.unreadCount ? "" : "border",
                  folder.unreadCount > 0 || isExpanded
                    ? "text-primary"
                    : "text-muted-foreground group-hover:text-foreground",
                )}
                senderName={folder.name}
                senderEmail={
                  senderPreviews[0]?.senderEmail ??
                  folder.senderEmail ??
                  headPage[0]?.senderEmail ??
                  folder.name
                }
              />
            )}
            {folder.unreadCount > 0 && (
              <Badge
                variant="default"
                className="!size-4 p-0 z-20 shrink-0 text-[10px] absolute -top-1  -right-1 font-medium  opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {folder.unreadCount}
              </Badge>
            )}
          </span>
          <span
            className={cn(
              "text-sm truncate font-medium transition-colors",
              folder.unreadCount > 0 || isExpanded
                ? "text-primary"
                : "text-muted-foreground group-hover:text-foreground",
            )}
          >
            {folder.name}
          </span>
        </button>

        {(showFolderActions || onRestoreFolder) && (
          <div className="flex items-center gap-1 shrink-0">
            {onRestoreFolder && (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void onRestoreFolder(folder._id);
                }}
                aria-label={
                  m.hiddenFolders_unhideAriaLabel?.({
                    folderName: folder.name,
                  }) ??
                  m.hiddenFolders_unhide?.() ??
                  "Unhide"
                }
                disabled={isRestoreFolderPending}
                className={cn(
                  "flex items-center justify-center size-8 shrink-0 rounded-md hover:bg-accent/60 transition-colors",
                  isRestoreFolderPending && "opacity-50 cursor-not-allowed",
                )}
              >
                <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}

            {showFolderActions && (
              <FolderActionsDropdown
                folderId={folder._id}
                folderName={folder.name}
                onHideSuccess={onHideSuccess}
              />
            )}
          </div>
        )}

        <CollapsibleTrigger
          className="flex items-center justify-center size-8 shrink-0 rounded-md hover:bg-accent/60 transition-colors"
          aria-label={
            isExpanded
              ? m.sidebar_collapseFolder({ folderName: folder.name })
              : m.sidebar_expandFolder({ folderName: folder.name })
          }
        >
          <ChevronRightIcon
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ease-in-out duration-150",
              "stroke-[2.5px]",
              folder.unreadCount > 0 || isExpanded
                ? "text-primary"
                : "text-muted-foreground/70",
              isExpanded && "rotate-90",
            )}
          />
        </CollapsibleTrigger>
      </div>

      <CollapsiblePanel
        className={cn(isExpanded && "-mt-3 pt-3")}
        render={<ScrollArea scrollFade className="max-h-[245px]" />}
      >
        <div className="ml-4 border-l border-border pl-2 py-1 space-y-0.5 ">
          {isHeadPending ? (
            // Loading skeleton for newsletter items
            <div className="space-y-1 py-1">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse px-3 py-2">
                  <div className="h-3.5 bg-muted rounded w-4/5" />
                  <div className="h-3 bg-muted rounded w-1/2 mt-1" />
                </div>
              ))}
            </div>
          ) : filteredNewsletters.length === 0 ? (
            <p className="text-xs text-muted-foreground px-3 py-2">
              {sidebarFilter === "unread"
                ? "All read"
                : m.newsletters_noNewslettersInFolder({
                    folderName: folder.name,
                  })}
            </p>
          ) : (
            <>
              {filteredNewsletters.map((newsletter) => (
                <NewsletterListItem
                  key={newsletter._id}
                  newsletter={newsletter}
                  isSelected={selectedNewsletterId === newsletter._id}
                  isFavorited={getIsFavorited(
                    newsletter._id,
                    Boolean(newsletter.isFavorited),
                  )}
                  isFavoritePending={isFavoritePending(newsletter._id)}
                  onClick={onNewsletterSelect}
                  onToggleFavorite={onToggleFavorite}
                  onToggleRead={onToggleRead}
                  onArchive={onArchive}
                  onUnarchive={onUnarchive}
                  onBin={onBin}
                />
              ))}

              {canLoadMore && (
                <div className="px-3 py-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    disabled={isLoadingMore}
                    onClick={() => void handleLoadMore()}
                  >
                    {isLoadingMore ? "Loading..." : "Load more"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </CollapsiblePanel>
    </Collapsible>
  );
}
