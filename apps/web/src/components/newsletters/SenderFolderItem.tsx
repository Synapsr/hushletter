import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsiblePanel,
  Badge,
} from "@hushletter/ui";
import { cn } from "@/lib/utils";
import { ChevronRight, Star } from "lucide-react";
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
  onFolderSelect: (folderId: string) => void;
  onNewsletterSelect: (newsletterId: string) => void;
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
  onFolderSelect,
  onNewsletterSelect,
  onHideSuccess,
}: SenderFolderItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

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

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
    onFolderSelect(folder._id);
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <div
        className={cn(
          "group flex items-center rounded-lg transition-colors",
          "hover:bg-accent/50",
          isSelected && "bg-accent/70",
        )}
      >
        <CollapsibleTrigger
          onClick={handleToggle}
          className="flex items-center gap-2 flex-1 px-2 py-2 min-w-0"
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
          <SenderAvatar
            senderName={folder.name}
            senderEmail={folder.name}
            size="sm"
          />
          <span className="text-sm truncate font-medium">{folder.name}</span>
        </CollapsibleTrigger>

        <div className="flex items-center gap-1 pr-2 shrink-0">
          {folder.unreadCount > 0 && (
            <Badge
              variant="default"
              className="h-5 min-w-5 px-1.5 text-[11px] font-semibold"
            >
              {folder.unreadCount}
            </Badge>
          )}
          <Star className="h-3.5 w-3.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:text-yellow-500" />
          <FolderActionsDropdown
            folderId={folder._id}
            folderName={folder.name}
            onHideSuccess={onHideSuccess}
          />
        </div>
      </div>

      <CollapsiblePanel>
        <div className="ml-4 border-l border-border pl-2 py-1 space-y-0.5">
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
                onClick={onNewsletterSelect}
              />
            ))
          )}
        </div>
      </CollapsiblePanel>
    </Collapsible>
  );
}
