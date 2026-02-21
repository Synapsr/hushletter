/**
 * Import Page - Gmail Multi-Account Import Experience
 *
 * Focused flow for connecting Gmail accounts and importing newsletters.
 * Steps: Connect → Scan → Review → Import
 * Supports multiple Gmail accounts.
 */

import { useState, useCallback, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { useAction } from "convex/react";
import { api } from "@hushletter/backend";
import { GmailConnect } from "./-GmailConnect";
import { SenderScanner } from "./-SenderScanner";
import { Button } from "@hushletter/ui";
import {
  AlertCircle,
  RefreshCw,
  Lock,
} from "lucide-react";
import { m } from "@/paraglide/messages.js";
import type { Id } from "@hushletter/backend/convex/_generated/dataModel";
import { toast } from "sonner";

export const Route = createFileRoute("/_authed/_navigation/import/")({
  component: ImportPage,
});

function ComponentError({
  error,
  resetErrorBoundary,
  title,
  description,
}: FallbackProps & { title: string; description: string }) {
  const errorMessage =
    error instanceof Error
      ? error.message
      : "An unexpected error occurred. Please try again.";

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5 dark:border-red-900/50 dark:bg-red-950/20">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-red-800 dark:text-red-200">{title}</p>
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {description}
          </p>
          <p className="mt-2 text-sm text-red-600/80 dark:text-red-400/80">
            {errorMessage}
          </p>
          <Button
            onClick={resetErrorBoundary}
            variant="outline"
            size="sm"
            className="mt-3"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            {m.common_tryAgain()}
          </Button>
        </div>
      </div>
    </div>
  );
}

function GmailConnectError(props: FallbackProps) {
  return (
    <ComponentError
      {...props}
      title={m.import_gmailError()}
      description={m.import_gmailErrorDesc()}
    />
  );
}

function SenderScannerError(props: FallbackProps) {
  return (
    <ComponentError
      {...props}
      title={m.import_scannerError()}
      description={m.import_scannerErrorDesc()}
    />
  );
}

function ImportPage() {
  const syncProStatus = useAction(api.billing.syncProStatusFromStripe);
  const [billingSyncPending, setBillingSyncPending] = useState(false);
  const [billingSyncError, setBillingSyncError] = useState<string | null>(null);

  const [selectedConnectionId, setSelectedConnectionId] =
    useState<Id<"gmailConnections"> | null>(null);

  const handleBillingSync = useCallback(async () => {
    setBillingSyncPending(true);
    setBillingSyncError(null);
    try {
      const res = await syncProStatus({});
      if (!res.ok) {
        setBillingSyncError(
          res.reason === "no_subscription_found"
            ? m.billingSuccessDialog_errorNoSubscriptionYet()
            : m.billingSuccessDialog_errorSyncFailed(),
        );
      }
    } catch {
      setBillingSyncError(m.billingSuccessDialog_errorSyncFailed());
    } finally {
      setBillingSyncPending(false);
    }
  }, [syncProStatus]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const billing = params.get("billing");
    if (billing !== "success" && billing !== "cancel") return;

    params.delete("billing");
    const next = params.toString();
    window.history.replaceState(
      {},
      "",
      `${window.location.pathname}${next ? `?${next}` : ""}`,
    );

    if (billing === "cancel") {
      toast.info(m.onboarding_checkoutCanceled());
      return;
    }

    void handleBillingSync();
  }, [handleBillingSync]);

  const handleSelectConnection = useCallback(
    (id: Id<"gmailConnections"> | null) => {
      setSelectedConnectionId(id);
    },
    [],
  );

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10 overflow-auto h-full min-h-0">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Import from Gmail
        </h1>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
          Connect your Gmail accounts to automatically discover and import your
          newsletter subscriptions.
        </p>
      </div>

      {/* Content */}
      <div className="space-y-5">
        {billingSyncPending && (
          <div className="rounded-xl border border-border/60 bg-card p-5 text-sm text-muted-foreground">
            {m.billingSuccessDialog_titleActivatingPro()}...
          </div>
        )}

        {billingSyncError && (
          <div className="rounded-xl border border-amber-300/70 bg-amber-50 dark:bg-amber-950/20 p-5 text-sm text-amber-900 dark:text-amber-200 space-y-3">
            <p>{billingSyncError}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleBillingSync()}
              disabled={billingSyncPending}
            >
              {m.billingSuccessDialog_retrySync()}
            </Button>
          </div>
        )}

        <ErrorBoundary FallbackComponent={GmailConnectError}>
          <GmailConnect
            selectedConnectionId={selectedConnectionId}
            onSelectConnection={handleSelectConnection}
          />
        </ErrorBoundary>

        {selectedConnectionId && (
          <ErrorBoundary key={selectedConnectionId} FallbackComponent={SenderScannerError}>
            <SenderScanner gmailConnectionId={selectedConnectionId} />
          </ErrorBoundary>
        )}
      </div>

      {/* Trust footer */}
      <div className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted-foreground/60">
        <Lock className="h-3 w-3" />
        <span>Read-only access. We never send emails on your behalf.</span>
      </div>
    </div>
  );
}
