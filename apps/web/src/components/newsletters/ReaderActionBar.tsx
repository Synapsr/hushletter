import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
  MinusCircleIcon,
  CornerUpLeftIcon,
  MailIcon,
  MailOpenIcon,
  ShareIcon,
  StarIcon,
  ArchiveBoldIcon,
  ArchiveUpBoldIcon,
  TrashBoldIcon,
  SparklesIcon,
  GlassesIcon,
} from "@hushletter/ui";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Maximize2,
  Minimize2,
  MoreHorizontal,
} from "lucide-react";
import {
  type ReaderBackgroundPreference,
  type ReaderFontPreference,
  type ReaderFontSizePreference,
  type ReaderPreferences,
  READER_BACKGROUND_OPTIONS,
  READER_FONT_OPTIONS,
} from "@/hooks/useReaderPreferences";
import { m } from "@/paraglide/messages.js";
import { cn } from "@hushletter/ui/lib/utils";
import { formatForDisplay, useHotkey } from "@tanstack/react-hotkeys";
import { useAppHotkeys } from "@/hooks/use-app-hotkeys";

interface ReaderActionBarProps {
  isRead: boolean;
  isHidden: boolean;
  isFavorited: boolean;
  isFavoritePending: boolean;
  isArchivePending?: boolean;
  onArchive: () => void;
  onToggleFavorite: () => void;
  onShare?: () => void;
  onToggleRead?: () => void;
  onBin?: () => void;
  preferences?: ReaderPreferences;
  onBackgroundChange?: (value: ReaderBackgroundPreference) => void;
  onFontChange?: (value: ReaderFontPreference) => void;
  onFontSizeChange?: (value: ReaderFontSizePreference) => void;
  /** Pro-only: reader appearance controls */
  isPro?: boolean;
  isAppearanceOpen?: boolean;
  onAppearanceOpenChange?: (open: boolean) => void;
  onToggleSummary?: () => void;
  isSummaryOpen?: boolean;
  canGoPrevious?: boolean;
  canGoNext?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  onOpenFullscreen?: () => void;
  isFullscreen?: boolean;
  isReadEstimateHidden?: boolean;
  onShowReadEstimate?: () => void;
  onUpgradeToPro?: () => void;
  senderName?: string;
  subject?: string;
  date?: string;
  isBinPending?: boolean;
}

/**
 * Top action bar above the inline reader.
 * Archive maps to hideNewsletter. Star is fully wired with optimistic favorite state.
 */
export function ReaderActionBar({
  isRead,
  isHidden,
  onArchive,
  onToggleFavorite,
  onShare,
  onToggleRead,
  onBin,
  isFavorited,
  isFavoritePending,
  isArchivePending = false,
  preferences,
  onBackgroundChange,
  onFontChange,
  isPro = false,
  isAppearanceOpen,
  onAppearanceOpenChange,
  onToggleSummary,
  isSummaryOpen = false,
  canGoPrevious = false,
  canGoNext = false,
  onPrevious,
  onNext,
  onOpenFullscreen,
  isFullscreen = false,
  isReadEstimateHidden = false,
  onShowReadEstimate,
  onUpgradeToPro,
  senderName,
  subject,
  isBinPending = false,
}: ReaderActionBarProps) {
  const { bindings } = useAppHotkeys();
  const archiveLabel = isHidden ? m.newsletters_unhide() : m.reader_archive();
  const binLabel = m.bin_label?.() ?? "Bin";
  const fullscreenHotkeyLabel = formatForDisplay(
    bindings.toggleReaderFullscreen,
  );

  useHotkey(bindings.toggleReaderFullscreen, () => {
    onOpenFullscreen?.();
  });

  return (
    <div className="flex items-center justify-between px-2 py-2 border-b bg-background/70 backdrop-blur-sm absolute w-full top-0 z-10">
      <TooltipProvider>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={
                    isFullscreen
                      ? "Exit fullscreen reader"
                      : "Open fullscreen reader"
                  }
                  onClick={onOpenFullscreen}
                  disabled={!onOpenFullscreen}
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </Button>
              }
            />
            <TooltipContent>
              {isFullscreen
                ? `Exit fullscreen (${fullscreenHotkeyLabel})`
                : `Fullscreen (${fullscreenHotkeyLabel})`}
            </TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-4 mx-1" />

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Previous newsletter"
                  onClick={onPrevious}
                  disabled={!canGoPrevious}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              }
            />
            <TooltipContent>Previous</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Next newsletter"
                  onClick={onNext}
                  disabled={!canGoNext}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              }
            />
            <TooltipContent>Next</TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-2 px-4">
          <div className="flex flex-col text-center">
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
          {/* AI summary */}
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
                  <SparklesIcon
                    className={cn("size-5", isSummaryOpen && "fill-current")}
                  />
                </Button>
              }
            />
            <TooltipContent>{m.floatingSummary_toggle()}</TooltipContent>
          </Tooltip>

          {/* Pro-only: reader appearance controls */}
          <Popover
            open={isAppearanceOpen}
            onOpenChange={onAppearanceOpenChange}
          >
            <PopoverTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Reader appearance"
                >
                  <GlassesIcon className="size-5" />
                </Button>
              }
            />
            <PopoverContent align="end" className="w-72">
              {!isPro ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">Reader appearance</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Reader appearance controls are included with Hushletter Pro.
                  </p>
                  <Button
                    className="w-full"
                    onClick={onUpgradeToPro}
                    disabled={!onUpgradeToPro}
                  >
                    Upgrade to Pro
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
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
                          onBackgroundChange(
                            value as ReaderBackgroundPreference,
                          );
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
                </div>
              )}
            </PopoverContent>
          </Popover>

          <Separator orientation="vertical" className="h-4" />

          <div className="flex items-center gap-0.5">
            {/* Favorite */}
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
                    <StarIcon
                      className={cn("size-4", isFavorited && "fill-current")}
                    />
                  </Button>
                }
              />
              <TooltipContent>{m.reader_star()}</TooltipContent>
            </Tooltip>

            {/* Archive */}
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
                      <ArchiveUpBoldIcon className="size-4 text-muted-foreground" />
                    ) : (
                      <ArchiveBoldIcon className="size-4 text-muted-foreground" />
                    )}
                  </Button>
                }
              />
              <TooltipContent>{archiveLabel}</TooltipContent>
            </Tooltip>

            {/* Bin */}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={binLabel}
                    disabled={isBinPending || !onBin}
                    onClick={onBin}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <TrashBoldIcon className="size-4" />
                  </Button>
                }
              />
              <TooltipContent>{binLabel}</TooltipContent>
            </Tooltip>

            {/* More actions */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon" aria-label="More actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                }
              />
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onClick={() => {
                    onShare?.();
                  }}
                  disabled={!onShare}
                >
                  <ShareIcon />
                  {m.reader_share()}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    onToggleRead?.();
                  }}
                  disabled={!onToggleRead}
                >
                  {isRead ? <MailIcon /> : <MailOpenIcon />}
                  {isRead
                    ? m.newsletters_markUnread()
                    : m.newsletters_markAsRead()}
                </DropdownMenuItem>
                {isReadEstimateHidden ? (
                  <DropdownMenuItem
                    onClick={() => {
                      onShowReadEstimate?.();
                    }}
                    disabled={!onShowReadEstimate}
                  >
                    <Clock3 className="h-4 w-4" />
                    Show read time
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled>
                  <MinusCircleIcon />
                  Unsubscribe (coming soon)
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <CornerUpLeftIcon />
                  Reply (coming soon)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </TooltipProvider>
    </div>
  );
}
