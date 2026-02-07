/**
 * DisconnectConfirmDialog Component
 * Story 4.5: Task 2 (AC #1)
 *
 * Confirmation dialog for disconnecting Gmail account.
 * Explains what will be removed and what will be preserved.
 */

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2 } from "lucide-react";

interface DisconnectConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** Callback when user confirms disconnect */
  onConfirm: () => void;
  /** Whether disconnect is in progress */
  isPending: boolean;
  /** The connected Gmail address */
  gmailAddress: string;
}

/**
 * Confirmation dialog that explains what happens when disconnecting Gmail
 * Story 4.5: Task 2.2 (AC #1) - Explains what will be removed/preserved
 */
export function DisconnectConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
  gmailAddress,
}: DisconnectConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Disconnect Gmail?
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-4 pt-2">
              <p>
                You&apos;re about to disconnect <strong>{gmailAddress}</strong>.
              </p>

              <div className="space-y-2">
                <p className="font-medium text-foreground">What will be removed:</p>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  <li>Gmail connection and access</li>
                  <li>Scan progress and detected senders</li>
                  <li>Pending import queue</li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="font-medium text-foreground">What will be preserved:</p>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  <li>All newsletters already imported</li>
                  <li>Your reading history and preferences</li>
                  <li>All other account data</li>
                </ul>
              </div>

              <p className="text-sm">
                You can reconnect Gmail at any time to scan and import again.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Disconnecting...
              </>
            ) : (
              "Disconnect"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
