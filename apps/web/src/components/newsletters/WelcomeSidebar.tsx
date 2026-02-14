import { Tabs, TabsList, TabsTrigger, ScrollArea } from "@hushletter/ui";
import { SenderAvatar } from "./SenderAvatar";
import { m } from "@/paraglide/messages.js";

/**
 * Lightweight visual stand-in for SenderFolderSidebar when the user has
 * zero newsletters. Matches the real sidebar's dimensions and style but
 * displays a single virtual "Hushletter" folder entry.
 */
export function WelcomeSidebar() {
  return (
    <aside
      className="w-[300px] border-r bg-background flex flex-col"
      role="navigation"
      aria-label={m.newsletters_folderNavigation()}
    >
      {/* Header — matches SenderFolderSidebar tabs */}
      <div className="p-2 pb-0">
        <Tabs value="all">
          <TabsList className="w-full h-8">
            <TabsTrigger value="all" className="flex-1 text-xs h-7">
              {m.sidebar_filterAll()}
            </TabsTrigger>
            <TabsTrigger value="unread" className="flex-1 text-xs h-7" disabled>
              {m.sidebar_filterUnread()}
            </TabsTrigger>
            <TabsTrigger value="starred" className="flex-1 text-xs h-7" disabled>
              {m.sidebar_filterStarred()}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Virtual folder entry */}
      <ScrollArea className="flex-1 mt-2">
        <div className="px-2 pb-2 space-y-0.5">
          {/* Sender folder row — selected state */}
          <div className="rounded-lg bg-accent/70 px-3 py-2">
            <div className="flex items-center gap-2.5">
              <SenderAvatar
                senderName={m.welcome_senderName()}
                senderEmail="hello@hushletter.com"
                size="sm"
              />
              <span className="text-sm font-medium text-foreground truncate">
                {m.welcome_senderName()}
              </span>
            </div>
          </div>

          {/* Nested newsletter item — selected state */}
          <div className="ml-4 rounded-lg bg-accent px-3 py-1.5">
            <p className="text-xs font-medium text-foreground truncate">
              {m.welcome_subject()}
            </p>
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}
