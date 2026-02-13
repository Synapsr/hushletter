import { Button, Separator, Tooltip, TooltipTrigger, TooltipContent } from "@hushletter/ui";
import { Archive, Star, Highlighter, Share2, MoreHorizontal } from "lucide-react";
import { m } from "@/paraglide/messages.js";

interface ReaderActionBarProps {
  isRead: boolean;
  isHidden: boolean;
  onArchive: () => void;
  estimatedReadMinutes?: number;
}

/**
 * Top action bar above the inline reader.
 * Archive maps to hideNewsletter. Star and Highlight are UI shells.
 */
export function ReaderActionBar({
  onArchive,
  estimatedReadMinutes,
}: ReaderActionBarProps) {
  return (
    <div className="flex items-center justify-between px-6 py-2 border-b bg-background/95 backdrop-blur-sm">
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="ghost" size="icon" onClick={onArchive}>
                <Archive className="h-4 w-4" />
              </Button>
            }
          />
          <TooltipContent>{m.reader_archive()}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="ghost" size="icon">
                <Star className="h-4 w-4" />
              </Button>
            }
          />
          <TooltipContent>{m.reader_star()}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="ghost" size="icon">
                <Highlighter className="h-4 w-4" />
              </Button>
            }
          />
          <TooltipContent>{m.reader_highlight()}</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex items-center gap-2">
        {estimatedReadMinutes && (
          <span className="text-sm text-muted-foreground">
            {m.reader_minuteRead({ minutes: estimatedReadMinutes })}
          </span>
        )}

        <Separator orientation="vertical" className="h-4" />

        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="ghost" size="icon">
                <Share2 className="h-4 w-4" />
              </Button>
            }
          />
          <TooltipContent>{m.reader_share()}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            }
          />
          <TooltipContent>{m.reader_moreActions()}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
