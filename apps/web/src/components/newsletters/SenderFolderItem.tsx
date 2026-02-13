import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsiblePanel,
  Badge,
  ScrollArea,
} from "@hushletter/ui";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import { NewsletterListItem } from "./NewsletterListItem";
import { SenderAvatar } from "./SenderAvatar";
import { FolderActionsDropdown } from "@/components/FolderActionsDropdown";
import type { FolderData } from "@/components/FolderSidebar";
import type { NewsletterData } from "@/components/NewsletterCard";
import { m } from "@/paraglide/messages.js";

interface SenderFolderItemProps {
  folder: FolderData;
  isSelected: boolean;
  selectedNewsletterId: string | null;
  sidebarFilter: "all" | "unread" | "starred";
  isExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onFolderSelect: (folderId: string) => void;
  onNewsletterSelect: (newsletterId: string) => void;
  getIsFavorited: (newsletterId: string, serverValue?: boolean) => boolean;
  isFavoritePending: (newsletterId: string) => boolean;
  onToggleFavorite: (
    newsletterId: string,
    currentValue: boolean,
  ) => Promise<void>;
  onHideSuccess: () => void;
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
  getIsFavorited,
  isFavoritePending,
  onToggleFavorite,
  onHideSuccess,
}: SenderFolderItemProps) {
  // Lazy-load newsletters only when expanded
  const { data: newsletters, isPending } = useQuery({
    ...convexQuery(api.newsletters.listUserNewslettersByFolder, {
      folderId: folder._id as Id<"folders">,
    }),
    enabled: isExpanded,
    staleTime: 30_000,
  });

  const newsletterList = (newsletters ?? []) as NewsletterData[];

  // Apply sidebar filter
  const filteredNewsletters =
    sidebarFilter === "unread"
      ? newsletterList.filter((n) => !n.isRead)
      : newsletterList;

  const handleFolderSelect = () => {
    onFolderSelect(folder._id);
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={onExpandedChange}>
      <div
        className={cn(
          "group flex items-center rounded-lg transition-colors",
          "hover:bg-accent/50",
          isSelected && "bg-accent/70",
        )}
      >
        <CollapsibleTrigger
          className="flex items-center justify-center h-8 w-8 shrink-0 rounded-md hover:bg-accent/60 transition-colors"
          aria-label={
            isExpanded
              ? m.sidebar_collapseFolder({ folderName: folder.name })
              : m.sidebar_expandFolder({ folderName: folder.name })
          }
        >
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
              isExpanded && "rotate-90",
            )}
          />
        </CollapsibleTrigger>

        <button
          type="button"
          onClick={handleFolderSelect}
          aria-current={isSelected ? "page" : undefined}
          className="flex items-center gap-2 flex-1 px-1 py-2 min-w-0 text-left"
        >
          <SenderAvatar
            senderName={folder.name}
            senderEmail={folder.name}
            size="sm"
          />
          <span
            className={cn(
              "text-sm truncate font-medium",
              folder.unreadCount === 0 && "text-muted-foreground",
            )}
          >
            {folder.name}
          </span>
        </button>

        <div className="flex items-center gap-1 pr-2 shrink-0">
          {folder.unreadCount > 0 && (
            <Badge
              variant="default"
              className="h-5 min-w-5 px-1.5 text-[11px] font-semibold opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {folder.unreadCount}
            </Badge>
          )}
          <FolderActionsDropdown
            folderId={folder._id}
            folderName={folder.name}
            onHideSuccess={onHideSuccess}
          />
        </div>
      </div>

      <CollapsiblePanel
        render={<ScrollArea scrollFade className="max-h-[245px]" />}
      >
        <div className="ml-4 border-l border-border pl-2 py-1 space-y-0.5 ">
          {isPending ? (
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
            filteredNewsletters.map((newsletter) => (
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
              />
            ))
          )}
        </div>
      </CollapsiblePanel>
    </Collapsible>
  );
}
