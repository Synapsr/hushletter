/**
 * SubscribeInfo - Shows subscription information for a sender
 * Story 6.4 Task 2.2
 *
 * Displays:
 * - User's dedicated email address (for subscribing)
 * - Copy-to-clipboard button
 * - Instructions on how to subscribe
 * - Optional link to sender's website (domain)
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@hushletter/ui";
import { Copy, Check, Mail, ExternalLink } from "lucide-react";
import { m } from "@/paraglide/messages.js";

/** Type for getCurrentUser query response - matches auth.ts return type */
interface CurrentUserData {
  id: string;
  email: string;
  name: string | null;
  dedicatedEmail: string | null;
}

interface SubscribeInfoProps {
  senderEmail: string;
  senderName?: string;
  domain: string;
}

export function SubscribeInfo({ senderEmail, senderName, domain }: SubscribeInfoProps) {
  const [copied, setCopied] = useState(false);

  // Get current user's dedicated email
  const { data: userData, isError } = useQuery(convexQuery(api.auth.getCurrentUser, {}));

  const user = userData as CurrentUserData | null | undefined;
  const dedicatedEmail = user?.dedicatedEmail;

  const handleCopy = async () => {
    if (!dedicatedEmail) return;

    try {
      await navigator.clipboard.writeText(dedicatedEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Failed to copy - visual feedback will not show "copied"
      console.error("Failed to copy email to clipboard");
    }
  };

  const displayName = senderName || senderEmail;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4" />
          {m.subscribeInfo_title()}
        </CardTitle>
        <CardDescription>
          {m.subscribeInfo_description({ sender: displayName })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Dedicated email display */}
        {dedicatedEmail ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {m.subscribeInfo_subscribeInstructions()}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted px-3 py-2 rounded-md text-sm font-mono truncate">
                {dedicatedEmail}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                aria-label={
                  copied ? m.subscribeInfo_ariaCopied() : m.subscribeInfo_ariaCopy()
                }
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
              {/* Live region for screen reader announcement */}
              <span className="sr-only" role="status" aria-live="polite">
                {copied ? m.subscribeInfo_ariaCopied() : ""}
              </span>
            </div>
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">
            {m.subscribeInfo_errorLoadFailed()}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">{m.subscribeInfo_loadingEmail()}</p>
        )}

        {/* Instructions */}
        <div className="text-sm text-muted-foreground space-y-2">
          <p>{m.subscribeInfo_stepsTitle()}</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>{m.subscribeInfo_step1()}</li>
            <li>{m.subscribeInfo_step2()}</li>
            <li>{m.subscribeInfo_step3()}</li>
          </ol>
        </div>

        {/* Domain link */}
        {domain && (
          <a
            href={`https://${domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {m.subscribeInfo_visitDomain({ domain })}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </CardContent>
    </Card>
  );
}
