/**
 * GmailConnect Component - Multi-Account Support
 *
 * Displays connected Gmail accounts and allows adding/removing connections.
 * Auto-connects from Better Auth if user signed in with Google.
 */

import { useState, useEffect } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAction } from "convex/react";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import { Button } from "@hushletter/ui";
import {
  AlertCircle,
  Loader2,
  Plus,
  RefreshCw,
  Unplug,
} from "lucide-react";
import { DisconnectConfirmDialog } from "./-DisconnectConfirmDialog";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";

type ImportSearchParams = {
  error?: string;
  connected?: string;
};

type GmailConnection = {
  _id: Id<"gmailConnections">;
  email: string;
  connectedAt: number;
  source: "betterauth" | "oauth";
};

/** Gmail icon from Skill Icons */
function GmailLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      fill="none"
    >
      <rect width="256" height="256" fill="#F4F2ED" rx="60" />
      <path fill="#4285F4" d="M41.636 203.039h31.818v-77.273L28 91.676v97.727c0 7.545 6.114 13.636 13.636 13.636" />
      <path fill="#34A853" d="M182.545 203.039h31.819c7.545 0 13.636-6.114 13.636-13.636V91.675l-45.455 34.091" />
      <path fill="#FBBC04" d="M182.545 66.675v59.091L228 91.676V73.492c0-16.863-19.25-26.477-32.727-16.363" />
      <path fill="#EA4335" d="M73.455 125.766v-59.09L128 107.583l54.545-40.909v59.091L128 166.675" />
      <path fill="#C5221F" d="M28 73.493v18.182l45.454 34.091v-59.09L60.727 57.13C47.227 47.016 28 56.63 28 73.493" />
    </svg>
  );
}

function ConnectionCard({
  connection,
  isSelected,
  onSelect,
  onDisconnect,
}: {
  connection: GmailConnection;
  isSelected: boolean;
  onSelect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full overflow-hidden rounded-xl border text-left transition-colors ${
        isSelected
          ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
          : "border-border/60 bg-card hover:bg-muted/30"
      }`}
    >
      <div className="flex items-center gap-3.5 p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-muted/60">
          <GmailLogo className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground/70">Gmail</p>
          <p className="truncate text-sm text-muted-foreground">
            {connection.email}
          </p>
        </div>
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onDisconnect();
          }}
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground/50 hover:text-destructive"
          title="Disconnect Gmail"
        >
          <Unplug className="h-4 w-4" />
        </Button>
      </div>

      <div className="border-t border-border/40 px-4 py-3">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          {isSelected ? (
            <>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Selected — scan this inbox for newsletters below
            </>
          ) : (
            <>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
              Click to select this account
            </>
          )}
        </p>
      </div>
    </button>
  );
}

function AddAccountButton({
  onAdd,
  isAdding,
}: {
  onAdd: () => void;
  isAdding: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={isAdding}
      className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border/60 bg-card/50 px-4 py-3.5 text-left transition-colors hover:bg-muted/30 disabled:opacity-50"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60">
        {isAdding ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <Plus className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-muted-foreground">
          {isAdding ? "Redirecting to Google..." : "Add another Gmail account"}
        </p>
      </div>
    </button>
  );
}

function EmptyState({
  onConnect,
  isConnecting,
}: {
  onConnect: () => void;
  isConnecting: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
      <div className="flex flex-col items-center gap-4 p-6 pb-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60">
          <GmailLogo className="h-8 w-8" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">Connect your Gmail</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Read-only access to scan for newsletters. We never send emails.
          </p>
        </div>
        <Button
          onClick={onConnect}
          disabled={isConnecting}
          className="w-full"
        >
          {isConnecting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            "Connect Gmail"
          )}
        </Button>
      </div>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/20">
      <div className="flex items-start gap-3.5 p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/40">
          <AlertCircle className="h-5 w-5 text-red-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            Connection failed
          </p>
          <p className="mt-0.5 text-xs text-red-600/80 dark:text-red-400/80">
            {message}
          </p>
        </div>
      </div>
      <div className="border-t border-red-200/60 px-4 py-3 dark:border-red-900/40">
        <Button
          onClick={onRetry}
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs text-red-700 hover:text-red-800 dark:text-red-300"
        >
          <RefreshCw className="h-3 w-3" />
          Try again
        </Button>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
      <div className="flex items-center gap-3.5 p-4">
        <div className="h-11 w-11 shrink-0 animate-pulse rounded-lg bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          <div className="h-3.5 w-40 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="border-t border-border/40 px-4 py-3">
        <div className="h-3 w-48 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

export function GmailConnect({
  selectedConnectionId,
  onSelectConnection,
}: {
  selectedConnectionId: Id<"gmailConnections"> | null;
  onSelectConnection: (id: Id<"gmailConnections"> | null) => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<GmailConnection | null>(null);
  const [autoConnectDone, setAutoConnectDone] = useState(false);

  const searchParams = useSearch({ strict: false }) as ImportSearchParams;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const autoConnect = useAction(api.gmailConnections.autoConnectFromBetterAuth);
  const generateOAuthUrl = useAction(api.gmailConnections.generateOAuthUrl);
  const removeConnection = useAction(api.gmailConnections.removeConnection);

  const {
    data: connectionsData,
    isPending,
    error: queryError,
  } = useQuery(convexQuery(api.gmailConnections.getGmailConnections, {}));
  const connections = (connectionsData ?? []) as GmailConnection[];

  // Auto-connect from Better Auth on first load
  useEffect(() => {
    if (autoConnectDone || isPending || connections.length > 0) return;
    setAutoConnectDone(true);

    autoConnect({}).then((result) => {
      if (result.connected) {
        queryClient.invalidateQueries();
      }
    }).catch(() => {
      // silently fail - user can connect manually
    });
  }, [autoConnectDone, isPending, connections.length, autoConnect, queryClient]);

  // Auto-select first connection if none selected
  useEffect(() => {
    if (connections.length > 0 && !selectedConnectionId) {
      onSelectConnection(connections[0]._id);
    }
    // If selected connection was removed, clear selection
    if (selectedConnectionId && !connections.find((c) => c._id === selectedConnectionId)) {
      onSelectConnection(connections.length > 0 ? connections[0]._id : null);
    }
  }, [connections, selectedConnectionId, onSelectConnection]);

  // Handle ?connected= search param from OAuth callback
  useEffect(() => {
    if (searchParams?.connected) {
      queryClient.invalidateQueries();
      navigate({ to: "/import", search: {}, replace: true });
    }
  }, [searchParams?.connected, queryClient, navigate]);

  const getErrorMessage = (): string | null => {
    if (localError) return localError;
    if (searchParams?.error === "oauth_denied") {
      return "You cancelled the connection. Click Add to try again.";
    }
    if (searchParams?.error) {
      return "Failed to connect Gmail. Please try again.";
    }
    if (queryError) {
      return "Unable to load Gmail connections. Please refresh the page.";
    }
    return null;
  };

  const displayError = getErrorMessage();

  const handleAddAccount = async () => {
    setIsAdding(true);
    setLocalError(null);

    try {
      const { url } = await generateOAuthUrl({});
      window.location.href = url;
    } catch (err) {
      setIsAdding(false);
      setLocalError(err instanceof Error ? err.message : "Failed to start connection.");
    }
  };

  const handleRetry = () => {
    setLocalError(null);
    navigate({ to: "/import", search: {}, replace: true });
  };

  const handleConfirmDisconnect = async () => {
    if (!disconnectTarget) return;
    setIsDisconnecting(true);
    setLocalError(null);

    try {
      await removeConnection({ gmailConnectionId: disconnectTarget._id });
      await queryClient.invalidateQueries();
      setDisconnectTarget(null);
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "Failed to disconnect.");
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (isPending) return <LoadingSkeleton />;

  if (displayError) {
    return <ErrorState message={displayError} onRetry={handleRetry} />;
  }

  if (connections.length === 0) {
    return (
      <EmptyState
        onConnect={handleAddAccount}
        isConnecting={isAdding}
      />
    );
  }

  return (
    <>
      <div className="space-y-2">
        {connections.map((conn) => (
          <ConnectionCard
            key={conn._id}
            connection={conn}
            isSelected={selectedConnectionId === conn._id}
            onSelect={() => onSelectConnection(conn._id)}
            onDisconnect={() => setDisconnectTarget(conn)}
          />
        ))}

        <AddAccountButton onAdd={handleAddAccount} isAdding={isAdding} />
      </div>

      {disconnectTarget && (
        <DisconnectConfirmDialog
          open={!!disconnectTarget}
          onOpenChange={(open) => !open && setDisconnectTarget(null)}
          onConfirm={handleConfirmDisconnect}
          isPending={isDisconnecting}
          gmailAddress={disconnectTarget.email}
        />
      )}
    </>
  );
}
