import { useState, useCallback } from "react";
import {
  Dialog,
  DialogTrigger,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
} from "@hushletter/ui";
import { Button } from "@hushletter/ui";
import { ArrowLeft } from "lucide-react";
import { ImportMethodPicker } from "./ImportMethodPicker";
import { ForwardingInstructions } from "./ForwardingInstructions";
import { EmlUploadStep } from "./EmlUploadStep";
import { GmailImportStep } from "./GmailImportStep";
import { m } from "@/paraglide/messages.js";

type DialogStep = "pick" | "forwarding" | "upload" | "gmail";

interface ImportMethodDialogProps {
  dedicatedEmail: string | null;
  children: React.ReactNode;
}

const stepTitles: Record<DialogStep, () => string> = {
  pick: () => m.importDialog_title(),
  forwarding: () => m.importDialog_forwardingTitle(),
  upload: () => m.importDialog_uploadTitle(),
  gmail: () => m.importDialog_gmailTitle(),
};

export function ImportMethodDialog({ dedicatedEmail, children }: ImportMethodDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<DialogStep>("pick");

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setStep("pick");
    }
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setStep("pick");
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={children as React.ReactElement} />
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
          {step === "upload" && (
            <EmlUploadStep onClose={handleClose} />
          )}
          {step === "gmail" && (
            <GmailImportStep />
          )}
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}
