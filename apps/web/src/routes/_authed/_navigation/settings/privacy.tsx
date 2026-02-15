/**
 * Privacy Settings Page
 * Story 6.2: Privacy Controls for Senders
 * AC #5: Privacy settings page with sender list and bulk management
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";
import { useState, useMemo, useDeferredValue } from "react";
import { Shield, Search, ArrowLeft, Info } from "lucide-react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, Input } from "@hushletter/ui";
import { PrivacyToggle } from "@/components/PrivacyToggle";
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/_authed/_navigation/settings/privacy")({
  component: PrivacySettingsPage,
});

// Type for sender data from listSendersForUserWithUnreadCounts query
type SenderData = {
  _id: Id<"senders">;
  email: string;
  name: string | null;
  displayName: string;
  domain: string;
  userNewsletterCount: number;
  unreadCount: number;
  isPrivate: boolean;
  folderId: Id<"folders"> | null;
};

function PrivacySettingsPage() {
  const queryClient = useQueryClient();
  const {
    data: senders,
    isPending,
    error,
  } = useQuery(convexQuery(api.senders.listSendersForUserWithUnreadCounts, {}));
  const senderList = senders as SenderData[] | undefined;

  // Search and selection state
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedSenders, setSelectedSenders] = useState<Set<Id<"senders">>>(new Set());

  // Bulk update mutation
  const mutationFn = useConvexMutation(api.senders.updateSenderSettings);
  const updateSettings = useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });

  // Filter senders by search query (using deferred value for performance)
  const filteredSenders = useMemo(() => {
    if (!senderList) return [];
    if (!deferredSearchQuery.trim()) return senderList;

    const query = deferredSearchQuery.toLowerCase();
    return senderList.filter(
      (sender) =>
        sender.displayName.toLowerCase().includes(query) ||
        sender.email.toLowerCase().includes(query) ||
        sender.domain.toLowerCase().includes(query),
    );
  }, [senderList, deferredSearchQuery]);

  // Selection handlers
  const toggleSenderSelection = (senderId: Id<"senders">) => {
    setSelectedSenders((prev) => {
      const next = new Set(prev);
      if (next.has(senderId)) {
        next.delete(senderId);
      } else {
        next.add(senderId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedSenders.size === filteredSenders.length) {
      setSelectedSenders(new Set());
    } else {
      setSelectedSenders(new Set(filteredSenders.map((s) => s._id)));
    }
  };

  // Bulk privacy update handlers
  const handleBulkPrivate = async () => {
    try {
      await Promise.all(
        Array.from(selectedSenders).map((senderId) =>
          updateSettings.mutateAsync({ senderId, isPrivate: true }),
        ),
      );
      setSelectedSenders(new Set());
    } catch (error) {
      console.error("[PrivacySettings] Bulk private update failed:", error);
    }
  };

  const handleBulkPublic = async () => {
    try {
      await Promise.all(
        Array.from(selectedSenders).map((senderId) =>
          updateSettings.mutateAsync({ senderId, isPrivate: false }),
        ),
      );
      setSelectedSenders(new Set());
    } catch (error) {
      console.error("[PrivacySettings] Bulk public update failed:", error);
    }
  };

  // Loading state
  if (isPending) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="h-4 bg-muted rounded w-2/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-destructive">
              {m.settingsPrivacy_loadError()}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isAllSelected =
    filteredSenders.length > 0 && selectedSenders.size === filteredSenders.length;
  const isSomeSelected = selectedSenders.size > 0 && selectedSenders.size < filteredSenders.length;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header with back navigation */}
      <div className="mb-6">
        <Link
          to="/settings"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          {m.settingsPrivacy_backToSettings()}
        </Link>
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold text-foreground">{m.settingsPrivacy_title()}</h1>
            <p className="text-muted-foreground mt-1">
              {m.settings_privacyDescription()}
            </p>
          </div>
        </div>
      </div>

      {/* Info card about privacy */}
      <Card className="mb-6 border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
        <CardContent className="py-4">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900 dark:text-blue-100 space-y-1">
              <p className="font-medium">{m.settingsPrivacy_howPrivacyWorks()}</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200">
                <li>
                  <strong>{m.settingsPrivacy_publicSenders()}</strong> {m.settingsPrivacy_publicDescription()}
                </li>
                <li>
                  <strong>{m.settingsPrivacy_privateSenders()}</strong> {m.settingsPrivacy_privateDescription()}
                </li>
                <li>
                  {m.settingsPrivacy_futureOnly()}
                </li>
                <li>{m.settingsPrivacy_existingKept()}</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main settings card */}
      <Card>
        <CardHeader>
          <CardTitle>{m.settingsPrivacy_senderPrivacy()}</CardTitle>
          <CardDescription>
            {senderList?.length === 0
              ? m.settingsPrivacy_noSenders()
              : `Manage privacy for ${senderList?.length} sender${senderList?.length === 1 ? "" : "s"}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {senderList && senderList.length > 0 && (
            <div className="space-y-4">
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={m.settingsPrivacy_searchPlaceholder()}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Bulk actions */}
              {selectedSenders.size > 0 && (
                <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm text-muted-foreground">
                    {m.settingsPrivacy_selected({ count: selectedSenders.size })}
                  </span>
                  <div className="flex-1" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkPrivate}
                    disabled={updateSettings.isPending}
                  >
                    {m.settingsPrivacy_markPrivate()}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkPublic}
                    disabled={updateSettings.isPending}
                  >
                    {m.settingsPrivacy_markPublic()}
                  </Button>
                </div>
              )}

              {/* Sender list */}
              <div className="border rounded-lg divide-y">
                {/* Header row */}
                <div className="flex items-center gap-4 px-4 py-3 bg-muted/30 text-sm font-medium text-muted-foreground">
                  <Checkbox
                    checked={isAllSelected}
                    indeterminate={isSomeSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label={isAllSelected ? m.settingsPrivacy_deselectAll() : m.settingsPrivacy_selectAll()}
                  />
                  <div className="flex-1">{m.settingsPrivacy_headerSender()}</div>
                  <div className="w-24 text-center hidden sm:block">{m.settingsPrivacy_headerNewsletters()}</div>
                  <div className="w-32 text-right">{m.settingsPrivacy_headerPrivacy()}</div>
                </div>

                {/* Sender rows */}
                {filteredSenders.length === 0 ? (
                  <div className="px-4 py-8 text-center text-muted-foreground">
                    {searchQuery ? m.settingsPrivacy_noMatch() : m.settingsPrivacy_noDisplay()}
                  </div>
                ) : (
                  filteredSenders.map((sender) => (
                    <div
                      key={sender._id}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-muted/20 transition-colors"
                    >
                      <Checkbox
                        checked={selectedSenders.has(sender._id)}
                        onCheckedChange={() => toggleSenderSelection(sender._id)}
                        aria-label={`Select ${sender.displayName}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{sender.displayName}</p>
                        <p className="text-sm text-muted-foreground truncate">{sender.email}</p>
                      </div>
                      <div className="w-24 text-center text-sm text-muted-foreground hidden sm:block">
                        {sender.userNewsletterCount}
                      </div>
                      <div className="w-32 flex justify-end">
                        <PrivacyToggle senderId={sender._id} isPrivate={sender.isPrivate} compact />
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Privacy stats */}
              {senderList.length > 0 && (
                <div className="flex gap-4 text-sm text-muted-foreground pt-2">
                  <span>{m.settingsPrivacy_privateCount({ count: senderList.filter((s) => s.isPrivate).length })}</span>
                  <span>•</span>
                  <span>{m.settingsPrivacy_publicCount({ count: senderList.filter((s) => !s.isPrivate).length })}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
