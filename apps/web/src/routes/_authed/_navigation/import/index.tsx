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
import { useAction, useQuery } from "convex/react";
import { api } from "@hushletter/backend";
import { GmailConnect } from "./-GmailConnect";
import { SenderScanner } from "./-SenderScanner";
import { Button } from "@hushletter/ui";
import {
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Mail,
  ShieldCheck,
  Zap,
  Lock,
} from "lucide-react";
import { m } from "@/paraglide/messages.js";
import { PricingDialog } from "@/components/pricing-dialog";
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

function UpgradePrompt() {
  const [pricingOpen, setPricingOpen] = useState(false);

  return (
    <>
      <div className="rounded-xl border border-border/60 bg-card p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">
              Free preview: Gmail import
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Free accounts can import from Gmail as a lifetime preview.
              Upgrade to Pro for unlimited sender and email imports.
            </p>

            <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                Import from 1 sender lifetime on Free
              </li>
              <li className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Import up to 25 emails lifetime on Free
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Unlimited Gmail import with Pro
              </li>
            </ul>

            <Button onClick={() => setPricingOpen(true)} className="mt-5 gap-2">
              Upgrade to Pro
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <PricingDialog
        open={pricingOpen}
        onOpenChange={setPricingOpen}
        returnTo="import"
      />
    </>
  );
}

function ImportPage() {
  const syncProStatus = useAction(api.billing.syncProStatusFromStripe);
  const entitlements = useQuery(api.entitlements.getEntitlements) as
    | { isPro?: boolean }
    | null
    | undefined;
  const isPro = Boolean(entitlements?.isPro);
  const isEntitlementsLoading = entitlements === undefined;
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
            ? "Payment received, but subscription is still activating. Try again in a moment."
            : "Could not sync subscription status from Stripe. Please try again.",
        );
      }
    } catch {
      setBillingSyncError(
        "Could not sync subscription status from Stripe. Please try again.",
      );
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
      toast.info("Checkout canceled");
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
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-red-50 to-orange-50 ring-1 ring-red-200/60 dark:from-red-950/40 dark:to-orange-950/40 dark:ring-red-800/40">
          <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none">
            <path
              d="M2 6l10 7 10-7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-red-500"
            />
            <rect
              x="2"
              y="5"
              width="20"
              height="14"
              rx="3"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-red-400"
            />
          </svg>
        </div>
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
            Activating your Pro plan...
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
              Retry sync
            </Button>
          </div>
        )}

        {!isEntitlementsLoading && !isPro && !billingSyncPending && (
          <>
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Already completed payment?
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void handleBillingSync()}
                  disabled={billingSyncPending}
                >
                  Sync subscription
                </Button>
              </div>
            </div>
            <UpgradePrompt />
          </>
        )}

        <ErrorBoundary FallbackComponent={GmailConnectError}>
          <GmailConnect
            selectedConnectionId={selectedConnectionId}
            onSelectConnection={handleSelectConnection}
          />
        </ErrorBoundary>

        {selectedConnectionId && (
          <ErrorBoundary FallbackComponent={SenderScannerError}>
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
