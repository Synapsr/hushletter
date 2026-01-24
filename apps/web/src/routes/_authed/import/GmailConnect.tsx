/**
 * GmailConnect Component
 * Story 4.1: Task 3 (AC #1, #3, #4, #5)
 *
 * Displays Gmail connection status and provides OAuth connection flow.
 * Handles connected, disconnected, connecting, and error states.
 */

import { useState } from "react"
import { useSearch, useNavigate } from "@tanstack/react-router"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useAction } from "convex/react"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@newsletter-manager/backend"
import { authClient } from "~/lib/auth-client"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import { Button } from "~/components/ui/button"
import { Mail, Check, AlertCircle, Loader2, RefreshCw } from "lucide-react"

// Search params type for this route
type ImportSearchParams = {
  error?: string
}

/**
 * Connected state - shows Gmail account info and next actions
 * Story 4.1: Task 3.3, 3.4 (AC #4)
 */
function ConnectedState({
  email,
  onDisconnect,
  isDisconnecting,
}: {
  email: string
  onDisconnect: () => void
  isDisconnecting: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900">
        <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
          <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <p className="font-medium text-green-800 dark:text-green-200">
            Gmail Connected
          </p>
          <p className="text-sm text-green-600 dark:text-green-400">{email}</p>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          Your Gmail is connected. You can now scan for newsletters below.
        </p>
      </div>

      <div className="pt-2">
        <Button
          onClick={onDisconnect}
          disabled={isDisconnecting}
          variant="ghost"
          size="sm"
        >
          {isDisconnecting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Disconnecting...
            </>
          ) : (
            "Disconnect Gmail"
          )}
        </Button>
      </div>
    </div>
  )
}

/**
 * Disconnected state - shows connect button
 * Story 4.1: Task 3.2 (AC #1)
 */
function DisconnectedState({
  onConnect,
  isConnecting,
}: {
  onConnect: () => void
  isConnecting: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="h-10 w-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <Mail className="h-5 w-5 text-gray-500" />
        </div>
        <div>
          <p className="font-medium">Gmail Not Connected</p>
          <p className="text-sm text-muted-foreground">
            Connect to import your newsletters
          </p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        We&apos;ll request read-only access to your Gmail to scan for
        newsletters. Your email content stays private and secure.
      </p>

      <Button onClick={onConnect} disabled={isConnecting} className="w-full">
        {isConnecting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Connecting...
          </>
        ) : (
          <>
            <Mail className="mr-2 h-4 w-4" />
            Connect Gmail
          </>
        )}
      </Button>
    </div>
  )
}

/**
 * Error state - shows error message and retry option
 * Story 4.1: Task 5.3, 5.4 (AC #5)
 */
function ErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-900">
        <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <p className="font-medium text-red-800 dark:text-red-200">
            Connection Failed
          </p>
          <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
        </div>
      </div>

      <Button onClick={onRetry} variant="outline" className="w-full">
        <RefreshCw className="mr-2 h-4 w-4" />
        Try Again
      </Button>
    </div>
  )
}

/**
 * Loading skeleton for the component
 * Story 4.1: Task 3.5
 */
function LoadingSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-6 bg-muted rounded w-1/3 animate-pulse" />
        <div className="h-4 bg-muted rounded w-2/3 animate-pulse mt-2" />
      </CardHeader>
      <CardContent>
        <div className="h-20 bg-muted rounded animate-pulse" />
      </CardContent>
    </Card>
  )
}

/**
 * GmailConnect - Main component for Gmail OAuth connection
 * Story 4.1: Task 3 (All ACs)
 */
export function GmailConnect() {
  // Note: useState for isConnecting is acceptable here because OAuth flows redirect
  // away from the page. This tracks "user clicked, waiting for redirect" which is
  // UI state, not data loading state. There's no isPending equivalent for redirects.
  const [isConnecting, setIsConnecting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  // Use TanStack Router hooks for URL params
  const searchParams = useSearch({ strict: false }) as ImportSearchParams
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Disconnect Gmail action
  const disconnectGmail = useAction(api.gmail.disconnectGmail)

  // Type for Gmail account data returned by the query
  type GmailAccountData = { email: string; connectedAt: number } | null

  // Query Gmail connection status
  const { data, isPending, error: queryError } = useQuery(
    convexQuery(api.gmail.getGmailAccount, {})
  )
  const gmailAccount = data as GmailAccountData | undefined

  // Determine connection state - must check for both null (not connected) and undefined (loading)
  const isConnected = gmailAccount !== null && gmailAccount !== undefined

  // Derive error from multiple sources: URL params, local state, or query error
  const getErrorMessage = (): string | null => {
    // Local errors from OAuth flow take precedence
    if (localError) return localError

    // Check URL params for OAuth callback errors
    if (searchParams?.error === "access_denied") {
      return "You cancelled the connection. Click Connect to try again."
    }
    if (searchParams?.error) {
      return "Failed to connect Gmail. Please try again."
    }

    // Query errors (from Convex)
    if (queryError) {
      return "Unable to check Gmail connection. Please refresh the page."
    }

    return null
  }

  const displayError = getErrorMessage()

  /**
   * Initiate Google OAuth flow
   * Story 4.1: Task 3.2 (AC #1, #2)
   */
  const handleConnect = async () => {
    setIsConnecting(true)
    setLocalError(null)

    try {
      // Use Better Auth's social sign-in with linkSocial for existing users
      // This links the Google account to the existing user rather than creating a new account
      await authClient.linkSocial({
        provider: "google",
        callbackURL: "/import",
      })
      // User will be redirected to Google OAuth consent screen
    } catch (err) {
      // Handle errors that occur before redirect
      setIsConnecting(false)
      if (err instanceof Error) {
        if (err.message.includes("cancelled") || err.message.includes("denied")) {
          setLocalError("You cancelled the connection. Click Connect to try again.")
        } else {
          setLocalError("Failed to connect Gmail. Please try again.")
        }
      } else {
        setLocalError("An unexpected error occurred. Please try again.")
      }
    }
  }

  /**
   * Clear error and retry connection
   * Story 4.1: Task 5.4 (AC #5)
   */
  const handleRetry = () => {
    setLocalError(null)
    // Clear URL params using router navigation
    navigate({ to: "/import", search: {}, replace: true })
  }

  /**
   * Disconnect Gmail account
   * Removes the Google account link and cleans up scan data
   */
  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    setLocalError(null)

    try {
      await disconnectGmail({})
      // Invalidate queries to refresh UI state
      await queryClient.invalidateQueries()
    } catch (err) {
      setIsDisconnecting(false)
      if (err instanceof Error) {
        setLocalError(err.message)
      } else {
        setLocalError("Failed to disconnect Gmail. Please try again.")
      }
    }
  }

  // Show loading skeleton while fetching connection status
  if (isPending) {
    return <LoadingSkeleton />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Gmail Integration
        </CardTitle>
        <CardDescription>
          Import newsletters from your existing Gmail inbox
        </CardDescription>
      </CardHeader>
      <CardContent>
        {displayError ? (
          <ErrorState message={displayError} onRetry={handleRetry} />
        ) : isConnected ? (
          <ConnectedState
            email={gmailAccount.email}
            onDisconnect={handleDisconnect}
            isDisconnecting={isDisconnecting}
          />
        ) : (
          <DisconnectedState
            onConnect={handleConnect}
            isConnecting={isConnecting}
          />
        )}
      </CardContent>
    </Card>
  )
}
