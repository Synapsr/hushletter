import { useState } from "react";
import { Button } from "@hushletter/ui";
import { Check, Copy, X } from "lucide-react";
import { m } from "@/paraglide/messages.js";

interface DedicatedEmailDisplayProps {
  email: string;
}

type CopyState = "idle" | "copied" | "error";

/**
 * Displays the user's dedicated newsletter email address with copy functionality
 * Shows visual feedback when the email is copied to clipboard or if copy fails
 */
export function DedicatedEmailDisplay({ email }: DedicatedEmailDisplayProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopyState("copied");
      // Reset state after 2 seconds
      setTimeout(() => setCopyState("idle"), 2000);
    } catch (err) {
      console.error("Failed to copy email to clipboard:", err);
      setCopyState("error");
      // Reset error state after 3 seconds
      setTimeout(() => setCopyState("idle"), 3000);
    }
  };

  const getButtonLabel = () => {
    switch (copyState) {
      case "copied":
        return m.dedicatedEmail_copied();
      case "error":
        return m.dedicatedEmail_failedToCopy();
      default:
        return m.dedicatedEmail_copyEmailAddress();
    }
  };

  return (
    <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-muted-foreground">{m.dedicatedEmail_yourNewsletterEmail()}</p>
        <p className="text-lg font-mono font-medium truncate">{email}</p>
      </div>
      <div className="flex items-center gap-2">
        {copyState === "error" && (
          <span className="text-sm text-destructive" role="alert">
            {m.dedicatedEmail_copyFailed()}
          </span>
        )}
        <Button variant="outline" size="icon" onClick={handleCopy} aria-label={getButtonLabel()}>
          {copyState === "copied" ? (
            <Check className="h-4 w-4 text-green-600" />
          ) : copyState === "error" ? (
            <X className="h-4 w-4 text-destructive" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
