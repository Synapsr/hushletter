/**
 * Gmail Integration Queries
 * Story 4.1: Gmail OAuth Connection
 *
 * Provides queries to check Gmail connection status and retrieve account information.
 * Tokens are NEVER exposed to the client - only connection status and email are returned.
 */

import { query } from "./_generated/server"
import { ConvexError } from "convex/values"
import { authComponent, createAuth } from "./auth"

// Type for Better Auth account from listUserAccounts
type BetterAuthAccount = {
  providerId: string
  accountId: string
  createdAt: string | Date
  idToken?: string | null
}

/**
 * Decode the payload of a JWT without verification
 * We trust the token since it came from Google OAuth via Better Auth
 */
function decodeJwtPayload(jwt: string): { email?: string } | null {
  try {
    const parts = jwt.split(".")
    if (parts.length !== 3) return null

    // Decode the payload (second part)
    const payload = parts[1]
    // Handle base64url encoding
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/")
    const decoded = atob(base64)
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

/**
 * Internal helper to get Google account from Better Auth
 * Centralizes the account fetching logic to avoid duplication
 */
async function getGoogleAccount(
  ctx: Parameters<Parameters<typeof query>[0]["handler"]>[0]
): Promise<{ account: BetterAuthAccount; googleEmail: string | null } | null> {
  // Get authenticated user - returns null if not authenticated
  const authUser = await authComponent.safeGetAuthUser(ctx)
  if (!authUser) {
    return null
  }

  // Get Better Auth API to query linked accounts
  const { auth, headers } = await authComponent.getAuth(createAuth, ctx)

  // List all linked accounts for the current user
  const accounts = await auth.api.listUserAccounts({ headers })

  // Find Google account
  const googleAccount = accounts.find(
    (account: BetterAuthAccount) => account.providerId === "google"
  )

  if (!googleAccount) {
    return null
  }

  // Extract the Google email from the idToken if available
  let googleEmail: string | null = null
  if (googleAccount.idToken) {
    const payload = decodeJwtPayload(googleAccount.idToken)
    if (payload?.email) {
      googleEmail = payload.email
    }
  }

  return {
    account: googleAccount,
    googleEmail,
  }
}

/**
 * Check if the current user has a connected Gmail account
 * Story 4.1: Task 4.2 (AC #3, #4)
 *
 * @returns boolean indicating if Gmail is connected, or null if query failed
 */
export const isGmailConnected = query({
  args: {},
  handler: async (ctx): Promise<boolean> => {
    try {
      const result = await getGoogleAccount(ctx)
      return result !== null
    } catch (error) {
      // Log for debugging but don't expose internal errors
      console.error("[gmail.isGmailConnected] Failed to check connection:", error)
      // Throw structured error so client can handle it
      throw new ConvexError({
        code: "INTERNAL_ERROR",
        message: "Unable to check Gmail connection status. Please try again.",
      })
    }
  },
})

/**
 * Get the connected Gmail account email address
 * Story 4.1: Task 4.3 (AC #4)
 *
 * @returns The Gmail email address if connected, null otherwise
 * Note: Tokens are NEVER returned - only the email address (NFR6 compliance)
 */
export const getGmailAccount = query({
  args: {},
  handler: async (
    ctx
  ): Promise<{ email: string; connectedAt: number } | null> => {
    try {
      const result = await getGoogleAccount(ctx)

      if (!result) {
        return null
      }

      const { account, googleEmail } = result

      // The email comes from the Google idToken which contains the actual
      // Google account email. This allows users to link any Gmail account,
      // not just one matching their login email (allowDifferentEmails: true)
      // Fall back to accountId if idToken is unavailable (shouldn't happen)
      const email = googleEmail ?? `google-${account.accountId}@linked`

      return {
        email,
        connectedAt: new Date(account.createdAt).getTime(),
      }
    } catch (error) {
      // Log for debugging but don't expose internal errors
      console.error("[gmail.getGmailAccount] Failed to get account:", error)
      // Throw structured error so client can handle it
      throw new ConvexError({
        code: "INTERNAL_ERROR",
        message: "Unable to retrieve Gmail account. Please try again.",
      })
    }
  },
})
