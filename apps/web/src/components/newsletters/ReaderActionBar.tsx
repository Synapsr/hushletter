import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@hushletter/ui";
import {
  Archive,
  ArchiveRestore,
  Star,
  Sparkles,
  Share2,
  SlidersHorizontal,
  MoreHorizontal,
} from "lucide-react";
import {
  type ReaderBackgroundPreference,
  type ReaderFontPreference,
  type ReaderFontSizePreference,
  type ReaderPreferences,
  READER_BACKGROUND_OPTIONS,
  READER_FONT_OPTIONS,
  READER_FONT_SIZE_OPTIONS,
} from "@/hooks/useReaderPreferences";
import { m } from "@/paraglide/messages.js";

interface ReaderActionBarProps {
  isRead: boolean;
  isHidden: boolean;
  isFavorited: boolean;
  isFavoritePending: boolean;
  isArchivePending?: boolean;
  onArchive: () => void;
  onToggleFavorite: () => void;
  onShare?: () => void;
  /** 0 means under 1 minute, positive integers are rounded-up minutes */
  estimatedReadMinutes?: number;
  preferences?: ReaderPreferences;
  onBackgroundChange?: (value: ReaderBackgroundPreference) => void;
  onFontChange?: (value: ReaderFontPreference) => void;
  onFontSizeChange?: (value: ReaderFontSizePreference) => void;
  /** Pro-only: reader appearance controls */
  isPro?: boolean;
  onToggleSummary?: () => void;
  isSummaryOpen?: boolean;
  senderName?: string;
  subject?: string;
  date?: string;
}

/**
 * Top action bar above the inline reader.
 * Archive maps to hideNewsletter. Star is fully wired with optimistic favorite state.
 */
export function ReaderActionBar({
  isHidden,
  onArchive,
  onToggleFavorite,
  onShare,
  isFavorited,
  isFavoritePending,
  isArchivePending = false,
  estimatedReadMinutes,
  preferences,
  onBackgroundChange,
  onFontChange,
  onFontSizeChange,
  isPro = false,
  onToggleSummary,
  isSummaryOpen = false,
  senderName,
  subject,
}: ReaderActionBarProps) {
  const hasReadEstimate =
    estimatedReadMinutes !== undefined && estimatedReadMinutes !== null;
  const readEstimateLabel = hasReadEstimate
    ? estimatedReadMinutes < 1
      ? m.reader_minuteRead({ minutes: "<1" })
      : m.reader_minuteRead({ minutes: estimatedReadMinutes })
    : null;
  const archiveLabel = isHidden ? m.newsletters_unhide() : m.reader_archive();

  return (
    <div className="flex items-center justify-between px-6 py-2 border-b bg-background/95 backdrop-blur-sm">
      <TooltipProvider>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={archiveLabel}
                  disabled={isArchivePending}
                  onClick={onArchive}
                >
                  {isHidden ? (
                    <ArchiveRestore className="h-4 w-4" />
                  ) : (
                    <Archive className="h-4 w-4" />
                  )}
                </Button>
              }
            />
            <TooltipContent>{archiveLabel}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-pressed={isFavorited}
                  aria-label={
                    isFavorited
                      ? m.newsletters_removeFromFavoritesAria()
                      : m.newsletters_addToFavoritesAria()
                  }
                  disabled={isFavoritePending}
                  onClick={onToggleFavorite}
                  className={isFavorited ? "text-yellow-500" : undefined}
                >
                  <Star
                    className={isFavorited ? "h-4 w-4 fill-current" : "h-4 w-4"}
                  />
                </Button>
              }
            />
            <TooltipContent>{m.reader_star()}</TooltipContent>
          </Tooltip>

          {/* TODO: Highlight feature – hidden until implemented
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
          */}
        </div>
      </TooltipProvider>

      <div className="flex items-center gap-2 px-4">
        <div className="flex flex-col  text-center">
          <p className="text-[10px] text-muted-foreground line-clamp-1">
            {senderName}
          </p>
          <p
            title={subject}
            className="text-xs font-medium text-foreground line-clamp-1"
          >
            {subject}
          </p>
          {/*  <span className="text-[10px] text-muted-foreground">{date}</span> */}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {readEstimateLabel && (
          <span className="text-sm text-muted-foreground text-nowrap">
            {readEstimateLabel}
          </span>
        )}

        <Separator orientation="vertical" className="h-4" />

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label={m.floatingSummary_toggle()}
                aria-pressed={isSummaryOpen}
                onClick={onToggleSummary}
                className={isSummaryOpen ? "text-amber-500" : undefined}
              >
                <Sparkles
                  className={isSummaryOpen ? "h-4 w-4 fill-current" : "h-4 w-4"}
                />
              </Button>
            }
          />
          <TooltipContent>{m.floatingSummary_toggle()}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Share newsletter"
                onClick={onShare}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            }
          />
          <TooltipContent>{m.reader_share()}</TooltipContent>
        </Tooltip>

        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Reader appearance"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
            }
          />
          <PopoverContent align="end" className="w-72">
            {!isPro ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Reader appearance</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Reader appearance controls are included with Hushletter Pro.
                </p>
                <Button className="w-full" render={<a href="/settings" />}>
                  Upgrade to Pro
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Reader appearance</p>
                </div>

                <div className="space-y-1">
                  <label
                    className="text-xs text-muted-foreground"
                    htmlFor="reader-background"
                  >
                    Background
                  </label>
                  <Select
                    value={preferences?.background}
                    onValueChange={(value) => {
                      if (value !== null && onBackgroundChange) {
                        onBackgroundChange(value as ReaderBackgroundPreference);
                      }
                    }}
                  >
                    <SelectTrigger
                      id="reader-background"
                      className="h-8 text-xs"
                      aria-label="Reader background"
                    >
                      <SelectValue placeholder="Background" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(READER_BACKGROUND_OPTIONS).map(
                        ([value, option]) => (
                          <SelectItem key={value} value={value}>
                            {option.label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label
                    className="text-xs text-muted-foreground"
                    htmlFor="reader-font"
                  >
                    Font
                  </label>
                  <Select
                    value={preferences?.font}
                    onValueChange={(value) => {
                      if (value !== null && onFontChange) {
                        onFontChange(value as ReaderFontPreference);
                      }
                    }}
                  >
                    <SelectTrigger
                      id="reader-font"
                      className="h-8 text-xs"
                      aria-label="Reader font"
                    >
                      <SelectValue placeholder="Font" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(READER_FONT_OPTIONS).map(
                        ([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label
                    className="text-xs text-muted-foreground"
                    htmlFor="reader-font-size"
                  >
                    Font size
                  </label>
                  <Select
                    value={preferences?.fontSize}
                    onValueChange={(value) => {
                      if (value !== null && onFontSizeChange) {
                        onFontSizeChange(value as ReaderFontSizePreference);
                      }
                    }}
                  >
                    <SelectTrigger
                      id="reader-font-size"
                      className="h-8 text-xs"
                      aria-label="Reader font size"
                    >
                      <SelectValue placeholder="Font size" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(READER_FONT_SIZE_OPTIONS).map(
                        ([value, option]) => (
                          <SelectItem key={value} value={value}>
                            {option.label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
