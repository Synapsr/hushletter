/**
 * DisconnectConfirmDialog Component
 * Story 4.5: Task 2 (AC #1)
 *
 * Confirmation dialog for disconnecting Gmail account.
 * Explains what will be removed and what will be preserved.
 */

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@hushletter/ui";
import { AlertTriangle, Loader2 } from "lucide-react";
import { m } from "@/paraglide/messages.js";

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
            {m.disconnect_title()}
          </DialogTitle>
          <DialogDescription render={<div className="space-y-4 pt-2" />}>
              <p>
                {m.disconnect_description({ email: gmailAddress })}
              </p>

              <div className="space-y-2">
                <p className="font-medium text-foreground">{m.disconnect_removedTitle()}</p>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  <li>{m.disconnect_removed1()}</li>
                  <li>{m.disconnect_removed2()}</li>
                  <li>{m.disconnect_removed3()}</li>
                </ul>
              </div>

              <div className="space-y-2">
                <p className="font-medium text-foreground">{m.disconnect_preservedTitle()}</p>
                <ul className="list-disc pl-5 text-sm space-y-1">
                  <li>{m.disconnect_preserved1()}</li>
                  <li>{m.disconnect_preserved2()}</li>
                  <li>{m.disconnect_preserved3()}</li>
                </ul>
              </div>

              <p className="text-sm">
                {m.disconnect_reconnectNote()}
              </p>
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {m.common_cancel()}
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {m.disconnect_disconnecting()}
              </>
            ) : (
              m.disconnect_disconnect()
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
