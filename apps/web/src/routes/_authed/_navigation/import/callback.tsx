/**
 * OAuth Callback Route - /import/callback
 *
 * Handles the Google OAuth redirect after user grants Gmail access.
 * Receives ?code=...&state=... from Google, exchanges the code via Convex,
 * then redirects to /import?connected=email.
 */

import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { api } from "@hushletter/backend";
import { Loader2 } from "lucide-react";

type CallbackSearchParams = {
  code?: string;
  state?: string;
  error?: string;
};

export const Route = createFileRoute("/_authed/_navigation/import/callback")({
  validateSearch: (search: Record<string, unknown>): CallbackSearchParams => ({
    code: typeof search.code === "string" ? search.code : undefined,
    state: typeof search.state === "string" ? search.state : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
  }),
  component: OAuthCallbackPage,
});

function OAuthCallbackPage() {
  const { code, state, error: oauthError } = useSearch({ from: Route.id });
  const navigate = useNavigate();
  const processCallback = useAction(api.gmailConnections.processOAuthCallback);
  const [processed, setProcessed] = useState(false);

  useEffect(() => {
    if (processed) return;

    // Google returned an error (user cancelled, etc.)
    if (oauthError) {
      setProcessed(true);
      navigate({ to: "/import", search: { error: "oauth_denied" }, replace: true });
      return;
    }

    if (!code || !state) {
      setProcessed(true);
      navigate({ to: "/import", search: { error: "missing_params" }, replace: true });
      return;
    }

    setProcessed(true);
    processCallback({ code, state })
      .then((result) => {
        if (result.success && result.email) {
          navigate({
            to: "/import",
            search: { connected: result.email },
            replace: true,
          });
        } else {
          navigate({
            to: "/import",
            search: { error: "token_exchange" },
            replace: true,
          });
        }
      })
      .catch(() => {
        navigate({
          to: "/import",
          search: { error: "callback_failed" },
          replace: true,
        });
      });
  }, [code, state, oauthError, processCallback, navigate, processed]);

  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Connecting your Gmail account...
        </p>
      </div>
    </div>
  );
}
