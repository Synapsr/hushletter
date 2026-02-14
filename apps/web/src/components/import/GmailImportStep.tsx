import { Link } from "@tanstack/react-router";
import { Button, DialogClose } from "@hushletter/ui";
import { Mail, Shield, ArrowRight } from "lucide-react";
import { m } from "@/paraglide/messages.js";

export function GmailImportStep() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-muted mx-auto">
        <Mail className="w-6 h-6 text-muted-foreground" />
      </div>

      <p className="text-sm text-muted-foreground text-center">
        {m.importDialog_gmailExplanation()}
      </p>

      <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
        <Shield className="w-4 h-4 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground">
          {m.importDialog_gmailPrivacyNote()}
        </p>
      </div>

      <DialogClose
        render={<Button className="w-full" render={<Link to="/import" />} />}
      >
        {m.importDialog_gmailGoToImport()}
        <ArrowRight className="ml-2 w-4 h-4" />
      </DialogClose>
    </div>
  );
}
