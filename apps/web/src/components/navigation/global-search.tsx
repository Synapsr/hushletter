"use client";
import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogPopup,
  CommandDialogTrigger,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandSeparator,
  Button,
  Kbd,
  KbdGroup,
} from "@hushletter/ui/components";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CornerDownLeftIcon,
  SearchIcon,
  EyeOffIcon,
} from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Fragment } from "react/jsx-runtime";
import { formatForDisplay, useHotkey } from "@tanstack/react-hotkeys";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useConvex, useMutation } from "convex/react";
import { api } from "@hushletter/backend";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";

type Props = {};

const LAST_READ_KEY = "hushletter:lastNewsletter";

type NewsletterSearchResult = {
  userNewsletterId: Id<"userNewsletters">;
  subject: string;
  senderEmail: string;
  senderName?: string;
  receivedAt: number;
  isHidden: boolean;
  isRead: boolean;
};

export type NewsletterItem = {
  kind: "newsletter";
  value: string;
  label: string;
  disabled?: boolean;
  userNewsletterId: Id<"userNewsletters">;
  senderLine: string;
  receivedAt: number;
  isHidden: boolean;
  isRead: boolean;
};

export type InfoItem = {
  kind: "info";
  value: string;
  label: string;
  disabled: true;
};

export type Item = NewsletterItem | InfoItem;

export type Group = {
  value: string;
  items: Item[];
};

export const GlobalSearch = ({}: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const navigate = useNavigate();
  const convex = useConvex();
  const backfillSearchMeta = useMutation(
    api.newsletters.backfillNewsletterSearchMetaRecent,
  );
  const backfilledRef = useRef(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [lastOpenedId, setLastOpenedId] = useState<string | null>(null);

  const trimmedQuery = deferredQuery.trim();
  const searchEnabled = open && trimmedQuery.length >= 2;

  useEffect(() => {
    if (!open) return;
    try {
      const lastId = localStorage.getItem(LAST_READ_KEY);
      setLastOpenedId(lastId && lastId.trim() ? lastId : null);
    } catch {
      setLastOpenedId(null);
    }
  }, [open]);

  const {
    data: results,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["globalSearch", trimmedQuery],
    queryFn: async () => {
      return (await convex.query(api.newsletters.searchUserNewslettersMeta, {
        query: trimmedQuery,
        limit: 20,
      })) as NewsletterSearchResult[];
    },
    enabled: searchEnabled,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });

  const { data: lastOpened, isFetching: isFetchingLastOpened } = useQuery({
    queryKey: ["globalSearchLastOpened", lastOpenedId],
    queryFn: async () => {
      if (!lastOpenedId) return null;
      try {
        const doc = await convex.query(api.newsletters.getUserNewsletter, {
          userNewsletterId: lastOpenedId as Id<"userNewsletters">,
        });
        if (!doc) return null;

        return {
          userNewsletterId: doc._id as Id<"userNewsletters">,
          subject: doc.subject as string,
          senderEmail: doc.senderEmail as string,
          senderName: doc.senderName as string | undefined,
          receivedAt: doc.receivedAt as number,
          isHidden: doc.isHidden as boolean,
          isRead: doc.isRead as boolean,
        } satisfies NewsletterSearchResult;
      } catch {
        return null;
      }
    },
    enabled: open && trimmedQuery.length < 2 && Boolean(lastOpenedId),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    if (!searchEnabled || backfilledRef.current) return;
    backfilledRef.current = true;

    let cancelled = false;
    setIsIndexing(true);

    // One-time, bounded backfill so existing newsletters become searchable.
    // Keeps typeahead calls low-bandwidth (query reads only from `newsletterSearchMeta`).
    backfillSearchMeta({ limit: 500 })
      .then(() => refetch())
      .finally(() => {
        if (!cancelled) setIsIndexing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [searchEnabled, backfillSearchMeta, refetch]);

  const items = useMemo((): Group[] => {
    if (trimmedQuery.length < 2) {
      if (isFetchingLastOpened) {
        return [
          {
            value: "Recent",
            items: [
              {
                kind: "info",
                value: "loading-last",
                label: "Loading...",
                disabled: true,
              },
            ],
          },
        ];
      }

      if (lastOpened) {
        const senderLine = lastOpened.senderName
          ? `${lastOpened.senderName} <${lastOpened.senderEmail}>`
          : lastOpened.senderEmail;
        return [
          {
            value: "Recent",
            items: [
              {
                kind: "newsletter",
                value: String(lastOpened.userNewsletterId),
                label: lastOpened.subject,
                senderLine,
                receivedAt: lastOpened.receivedAt,
                isHidden: lastOpened.isHidden,
                isRead: lastOpened.isRead,
                userNewsletterId: lastOpened.userNewsletterId,
              },
            ],
          },
        ];
      }

      return [
        {
          value: "Search",
          items: [
            {
              kind: "info",
              value: "empty",
              label: "Start typing to search your newsletters...",
              disabled: true,
            },
          ],
        },
      ];
    }

    const newsletterItems: Item[] = (results ?? []).map((r) => {
      const senderLine = r.senderName
        ? `${r.senderName} <${r.senderEmail}>`
        : r.senderEmail;

      return {
        kind: "newsletter",
        value: String(r.userNewsletterId),
        label: r.subject,
        senderLine,
        receivedAt: r.receivedAt,
        isHidden: r.isHidden,
        isRead: r.isRead,
        userNewsletterId: r.userNewsletterId,
      };
    });

    // While searching, show a lightweight placeholder item instead of empty UI jitter.
    const effectiveItems =
      (isFetching || isIndexing) && newsletterItems.length === 0
        ? ([
            {
              kind: "info",
              value: "searching",
              label: isIndexing
                ? "Indexing recent newsletters..."
                : "Searching...",
              disabled: true,
            },
          ] satisfies Item[])
        : newsletterItems;

    return [{ value: "Newsletters", items: effectiveItems }];
  }, [
    trimmedQuery,
    results,
    isFetching,
    isIndexing,
    lastOpened,
    isFetchingLastOpened,
  ]);

  function handleItemClick(item: Item) {
    if (item.disabled) return;

    if (item.kind === "newsletter") {
      navigate({
        to: "/newsletters",
        search: { newsletter: String(item.userNewsletterId) },
      });
      setOpen(false);
      return;
    }

    setOpen(false);
  }

  useHotkey("Mod+K", () => {
    setOpen((open) => !open);
  });

  return (
    <CommandDialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
    >
      <CommandDialogTrigger
        /* render={
          <Input
            className="w-40 bg-white"
            size="sm"
            placeholder="Search..."
            prefix={(<SearchIcon className="size-4" />) as any}
            suffix={<Kbd>⌘K</Kbd>}
          />
        } */
        render={
          <Button
            variant="ghost"
            size="default"
            className="justify-between w-fit"
          >
            <div className="flex items-center gap-2">
              <SearchIcon className="size-4" />
              <span className="text-sm text-muted-foreground pr-2">Search</span>
            </div>
            <Kbd>{formatForDisplay("Mod+K")}</Kbd>
          </Button>
        }
      />

      <CommandDialogPopup>
        <Command
          items={items}
          mode="none"
          value={query}
          onValueChange={setQuery}
        >
          <CommandInput placeholder="Search newsletters by subject or sender..." />
          <CommandPanel>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandList>
              {(group: Group, index: number) => (
                <Fragment key={group.value}>
                  <CommandGroup items={group.items}>
                    <CommandGroupLabel>{group.value}</CommandGroupLabel>
                    <CommandCollection>
                      {(item: Item) => (
                        <CommandItem
                          key={item.value}
                          onClick={() => handleItemClick(item)}
                          value={item.value}
                          disabled={item.disabled}
                        >
                          {item.kind === "newsletter" ? (
                            <>
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-medium">
                                  {item.label}
                                </div>
                                <div className="truncate text-muted-foreground text-xs">
                                  {item.senderLine}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {item.isHidden && (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                    <EyeOffIcon className="size-3" />
                                    Hidden
                                  </span>
                                )}
                                <span className="text-muted-foreground text-xs">
                                  {formatDistanceToNow(item.receivedAt, {
                                    addSuffix: true,
                                  })}
                                </span>
                              </div>
                            </>
                          ) : (
                            <>
                              <span className="flex-1">{item.label}</span>
                            </>
                          )}
                        </CommandItem>
                      )}
                    </CommandCollection>
                  </CommandGroup>
                  {index < items.length - 1 && <CommandSeparator />}
                </Fragment>
              )}
            </CommandList>
          </CommandPanel>
          <CommandFooter>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <KbdGroup>
                  <Kbd>
                    <ArrowUpIcon />
                  </Kbd>
                  <Kbd>
                    <ArrowDownIcon />
                  </Kbd>
                </KbdGroup>
                <span>Navigate</span>
              </div>
              <div className="flex items-center gap-2">
                <Kbd>
                  <CornerDownLeftIcon />
                </Kbd>
                <span>Open</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Kbd>Esc</Kbd>
              <span>Close</span>
            </div>
          </CommandFooter>
        </Command>
      </CommandDialogPopup>
    </CommandDialog>
  );
};
