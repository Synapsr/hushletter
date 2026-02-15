import { useState, useCallback } from "react";
import {
  Dialog,
  DialogCreateHandle,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
  Button,
} from "@hushletter/ui";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import { ImportMethodPicker } from "./ImportMethodPicker";
import { ForwardingInstructions } from "./ForwardingInstructions";
import { EmlUploadStep } from "./EmlUploadStep";
import { GmailImportStep } from "./GmailImportStep";
import { m } from "@/paraglide/messages.js";

type DialogStep = "pick" | "forwarding" | "upload" | "gmail";

const stepTitles: Record<DialogStep, () => string> = {
  pick: () => m.importDialog_title(),
  forwarding: () => m.importDialog_forwardingTitle(),
  upload: () => m.importDialog_uploadTitle(),
  gmail: () => m.importDialog_gmailTitle(),
};

export const importDialogHandle = DialogCreateHandle();

export function ImportMethodDialog() {
  const [step, setStep] = useState<DialogStep>("pick");

  const { data: userData } = useQuery(convexQuery(api.auth.getCurrentUser, {}));
  const user = userData as {
    dedicatedEmail: string | null;
    vanityEmail: string | null;
  } | null;
  const dedicatedEmail = user?.vanityEmail ?? user?.dedicatedEmail ?? null;

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      setTimeout(() => {
        setStep("pick");
      }, 300);
    }
  }, []);

  const handleClose = useCallback(() => {
    importDialogHandle.close();
    setTimeout(() => {
      setStep("pick");
    }, 300);
  }, []);

  return (
    <Dialog handle={importDialogHandle} onOpenChange={handleOpenChange}>
      <DialogPopup>
        <DialogHeader>
          {step !== "pick" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep("pick")}
              className="w-fit -ml-2 mb-1"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              {m.importDialog_back()}
            </Button>
          )}
          <DialogTitle>{stepTitles[step]()}</DialogTitle>
          {step === "pick" && (
            <DialogDescription>
              {m.importDialog_description()}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogPanel>
          {step === "pick" && (
            <ImportMethodPicker onSelect={(method) => setStep(method)} />
          )}
          {step === "forwarding" && (
            <ForwardingInstructions dedicatedEmail={dedicatedEmail} />
          )}
          {step === "upload" && <EmlUploadStep onClose={handleClose} />}
          {step === "gmail" && <GmailImportStep />}
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
