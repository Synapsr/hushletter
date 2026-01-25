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
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@newsletter-manager/backend"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Copy, Check, Mail, ExternalLink } from "lucide-react"

/** Type for getCurrentUser query response - matches auth.ts return type */
interface CurrentUserData {
  id: string
  email: string
  name: string | null
  dedicatedEmail: string | null
}

interface SubscribeInfoProps {
  senderEmail: string
  senderName?: string
  domain: string
}

export function SubscribeInfo({ senderEmail, senderName, domain }: SubscribeInfoProps) {
  const [copied, setCopied] = useState(false)

  // Get current user's dedicated email
  const { data: userData, isError } = useQuery(
    convexQuery(api.auth.getCurrentUser, {})
  )

  const user = userData as CurrentUserData | null | undefined
  const dedicatedEmail = user?.dedicatedEmail

  const handleCopy = async () => {
    if (!dedicatedEmail) return

    try {
      await navigator.clipboard.writeText(dedicatedEmail)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Failed to copy - visual feedback will not show "copied"
      console.error("Failed to copy email to clipboard")
    }
  }

  const displayName = senderName || senderEmail

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Mail className="h-4 w-4" />
          How to Subscribe
        </CardTitle>
        <CardDescription>
          Get newsletters from {displayName} delivered to your inbox
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Dedicated email display */}
        {dedicatedEmail ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Subscribe using your dedicated email address:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted px-3 py-2 rounded-md text-sm font-mono truncate">
                {dedicatedEmail}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                aria-label={copied ? "Email address copied to clipboard" : "Copy email address to clipboard"}
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
              {/* Live region for screen reader announcement */}
              <span className="sr-only" role="status" aria-live="polite">
                {copied ? "Email address copied to clipboard" : ""}
              </span>
            </div>
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">
            Failed to load your dedicated email address. Please refresh the page.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Loading your dedicated email address...
          </p>
        )}

        {/* Instructions */}
        <div className="text-sm text-muted-foreground space-y-2">
          <p>To subscribe:</p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Visit the newsletter's website</li>
            <li>Enter your dedicated email address above</li>
            <li>New newsletters will appear automatically in your inbox</li>
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
            Visit {domain}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </CardContent>
    </Card>
  )
}
