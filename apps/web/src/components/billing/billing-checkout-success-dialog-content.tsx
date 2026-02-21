"use client";

import {
  Button,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogTitle,
} from "@hushletter/ui";
import { m } from "@/paraglide/messages.js";

type BillingCheckoutSuccessDialogContentProps = {
  isPro: boolean;
  billingSyncPending: boolean;
  billingSyncError: string | null;
  onRetrySync: () => void;
  onClose: () => void;
};

export function BillingCheckoutSuccessDialogContent({
  isPro,
  billingSyncPending,
  billingSyncError,
  onRetrySync,
  onClose,
}: BillingCheckoutSuccessDialogContentProps) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {isPro
            ? m.billingSuccessDialog_titlePro()
            : m.billingSuccessDialog_titleActivatingPro()}
        </DialogTitle>
        <DialogDescription>
          {isPro
            ? m.billingSuccessDialog_descriptionPro()
            : m.billingSuccessDialog_descriptionActivating()}
        </DialogDescription>
      </DialogHeader>

      <DialogPanel className="space-y-3">
        {billingSyncError && (
          <p className="text-sm text-destructive" role="alert">
            {billingSyncError}
          </p>
        )}

        {!isPro ? (
          <div className="text-sm text-muted-foreground">
            {billingSyncPending
              ? m.billingSuccessDialog_syncingStatus()
              : m.billingSuccessDialog_waitingStatus()}
          </div>
        ) : (
          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
            <li>{m.billingSuccessDialog_featureAiSummaries()}</li>
            <li>{m.billingSuccessDialog_featureGmailImportSync()}</li>
            <li>{m.billingSuccessDialog_featureVanityEmailAlias()}</li>
            <li>{m.billingSuccessDialog_featureReaderAppearance()}</li>
            <li>{m.billingSuccessDialog_featureUnlocksLockedNewsletters()}</li>
          </ul>
        )}
      </DialogPanel>

      <DialogFooter>
        {!isPro && (
          <Button
            type="button"
            variant="outline"
            onClick={onRetrySync}
            disabled={billingSyncPending}
          >
            {m.billingSuccessDialog_retrySync()}
          </Button>
        )}
        <Button type="button" onClick={onClose}>
          {isPro ? m.billingSuccessDialog_continue() : m.common_close()}
        </Button>
      </DialogFooter>
    </>
  );
}
