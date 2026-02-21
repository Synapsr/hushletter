"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { useAction } from "convex/react";
import { api } from "@hushletter/backend";
import { Dialog, DialogPopup } from "@hushletter/ui";
import { BillingCheckoutSuccessDialogContent } from "@/components/billing/billing-checkout-success-dialog-content";
import { m } from "@/paraglide/messages.js";

type EntitlementsData = {
  isPro: boolean;
  proExpiresAt: number | null;
};

const SETTINGS_DIALOG_BILLING_SOURCE = "settings_dialog";

export function BillingCheckoutSuccessDialog() {
  const { data: entitlementsData } = useQuery(
    convexQuery(api.entitlements.getEntitlements, {}),
  );
  const entitlements = entitlementsData as EntitlementsData | null | undefined;
  const isPro = Boolean(entitlements?.isPro);

  const syncProStatus = useAction(api.billing.syncProStatusFromStripe);

  const [open, setOpen] = useState(false);
  const [billingSyncPending, setBillingSyncPending] = useState(false);
  const [billingSyncError, setBillingSyncError] = useState<string | null>(null);

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
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const billing = params.get("billing");
    const billingSource = params.get("billingSource");

    if (billingSource !== SETTINGS_DIALOG_BILLING_SOURCE) return;
    if (billing !== "success" && billing !== "cancel") return;

    params.delete("billing");
    params.delete("billingSource");
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);

    if (billing === "cancel") return;

    setOpen(true);
    void handleBillingSync();
  }, [handleBillingSync]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setBillingSyncError(null);
      }}
    >
      <DialogPopup>
        <BillingCheckoutSuccessDialogContent
          isPro={isPro}
          billingSyncPending={billingSyncPending}
          billingSyncError={billingSyncError}
          onRetrySync={() => void handleBillingSync()}
          onClose={() => setOpen(false)}
        />
      </DialogPopup>
    </Dialog>
  );
}
