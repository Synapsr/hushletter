/**
 * Gmail Connections Management
 *
 * Manages multiple Gmail account connections per user, independent of Better Auth.
 * Better Auth handles authentication only; this module manages Gmail OAuth tokens
 * for importing newsletters from multiple accounts.
 *
 * Features:
 * - Auto-connect from Better Auth (first Google sign-in)
 * - Custom OAuth flow for additional accounts
 * - Token refresh via Google's token endpoint
 * - Per-connection token retrieval for Gmail API calls
 */

import { query, action, internalMutation, internalQuery, internalAction } from "./_generated/server"
import { v, ConvexError } from "convex/values"
import { internal } from "./_generated/api"
import { authComponent, createAuth } from "./auth"
import { httpAction } from "./_generated/server"
import type { Id } from "./_generated/dataModel"

// ============================================================
// Queries
// ============================================================

/**
 * Get all active Gmail connections for the current user
 */
export const getGmailConnections = query({
  args: {},
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx)
    if (!authUser) return []

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
      .first()
    if (!user) return []

    const connections = await ctx.db
      .query("gmailConnections")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()

    // Only return active connections, and never expose tokens
    return connections
      .filter((c) => c.isActive)
      .map((c) => ({
        _id: c._id,
        email: c.email,
        connectedAt: c.connectedAt,
        source: c.source,
      }))
  },
})

/**
 * Internal query to get a connection with tokens (for Gmail API calls)
 */
export const getConnectionWithTokens = internalQuery({
  args: { gmailConnectionId: v.id("gmailConnections") },
  handler: async (ctx, args) => {
    const connection = await ctx.db.get("gmailConnections", args.gmailConnectionId)
    if (!connection || !connection.isActive) return null
    return connection
  },
})

/**
 * Internal query to find a connection by userId and email
 */
export const getConnectionByEmail = internalQuery({
  args: { userId: v.id("users"), email: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("gmailConnections")
      .withIndex("by_userId_email", (q) =>
        q.eq("userId", args.userId).eq("email", args.email)
      )
      .first()
  },
})

// ============================================================
// Auto-connect from Better Auth
// ============================================================

/**
 * Bootstrap the first Gmail connection from Better Auth.
 * Called when user visits the import page. If user signed in with Google
 * and has no gmailConnections entry for that email, create one.
 */
export const autoConnectFromBetterAuth = action({
  args: {},
  handler: async (ctx): Promise<{ connected: boolean; email?: string }> => {
    const authUser = await ctx.runQuery(internal.auth.getCurrentAuthUser)
    if (!authUser) return { connected: false }

    const user = await ctx.runQuery(internal.gmail.getUserByAuthId, {
      authId: authUser.id,
    })
    if (!user) return { connected: false }

    // Check if Better Auth has a Google account linked
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx)

    const accounts = await auth.api.listUserAccounts({ headers }) as Array<{
      providerId: string
      accountId: string
      accessToken?: string | null
      refreshToken?: string | null
      accessTokenExpiresAt?: number | Date | null
      idToken?: string | null
    }>

    const googleAccount = accounts.find((a) => a.providerId === "google")
    if (!googleAccount?.accessToken) return { connected: false }

    // Decode email from idToken
    let googleEmail: string | null = null
    if (googleAccount.idToken) {
      try {
        const parts = googleAccount.idToken.split(".")
        if (parts.length === 3) {
          const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/")
          const decoded = atob(payload)
          const parsed = JSON.parse(decoded) as { email?: string }
          googleEmail = parsed.email ?? null
        }
      } catch {
        // fallback to auth email
      }
    }

    const email = googleEmail ?? authUser.email
    if (!email) return { connected: false }

    // Check if connection already exists
    const existing = await ctx.runQuery(internal.gmailConnections.getConnectionByEmail, {
      userId: user._id,
      email,
    })
    if (existing) {
      // Connection exists - update tokens if newer
      if (existing.isActive) return { connected: true, email }

      // Reactivate with fresh tokens
      await ctx.runMutation(internal.gmailConnections.upsertConnection, {
        userId: user._id,
        email,
        accessToken: googleAccount.accessToken,
        refreshToken: googleAccount.refreshToken ?? undefined,
        accessTokenExpiresAt: googleAccount.accessTokenExpiresAt
          ? typeof googleAccount.accessTokenExpiresAt === "number"
            ? googleAccount.accessTokenExpiresAt
            : googleAccount.accessTokenExpiresAt.getTime()
          : Date.now() + 3600 * 1000,
        source: "betterauth",
      })
      return { connected: true, email }
    }

    // Create new connection
    await ctx.runMutation(internal.gmailConnections.upsertConnection, {
      userId: user._id,
      email,
      accessToken: googleAccount.accessToken,
      refreshToken: googleAccount.refreshToken ?? undefined,
      accessTokenExpiresAt: googleAccount.accessTokenExpiresAt
        ? typeof googleAccount.accessTokenExpiresAt === "number"
          ? googleAccount.accessTokenExpiresAt
          : googleAccount.accessTokenExpiresAt.getTime()
        : Date.now() + 3600 * 1000,
      source: "betterauth",
    })

    return { connected: true, email }
  },
})

/**
 * Internal mutation to create or update a Gmail connection
 */
export const upsertConnection = internalMutation({
  args: {
    userId: v.id("users"),
    email: v.string(),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    accessTokenExpiresAt: v.number(),
    source: v.union(v.literal("betterauth"), v.literal("oauth")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("gmailConnections")
      .withIndex("by_userId_email", (q) =>
        q.eq("userId", args.userId).eq("email", args.email)
      )
      .first()

    if (existing) {
      await ctx.db.patch("gmailConnections", existing._id, {
        accessToken: args.accessToken,
        refreshToken: args.refreshToken ?? existing.refreshToken,
        accessTokenExpiresAt: args.accessTokenExpiresAt,
        isActive: true,
        source: args.source,
      })
      return existing._id
    }

    return await ctx.db.insert("gmailConnections", {
      userId: args.userId,
      email: args.email,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      accessTokenExpiresAt: args.accessTokenExpiresAt,
      connectedAt: Date.now(),
      isActive: true,
      source: args.source,
    })
  },
})

// ============================================================
// Custom OAuth Flow (for additional Gmail accounts)
// ============================================================

/**
 * Generate Google OAuth URL for connecting an additional Gmail account
 */
export const generateOAuthUrl = action({
  args: {},
  handler: async (ctx): Promise<{ url: string }> => {
    const authUser = await ctx.runQuery(internal.auth.getCurrentAuthUser)
    if (!authUser) throw new ConvexError({ code: "UNAUTHORIZED", message: "Please sign in." })

    const user = await ctx.runQuery(internal.gmail.getUserByAuthId, {
      authId: authUser.id,
    })
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found." })

    // Generate random state token for CSRF protection
    const state = crypto.randomUUID()

    // Store state in DB for verification
    await ctx.runMutation(internal.gmailConnections.storeOAuthState, {
      userId: user._id,
      state,
    })

    const clientId = process.env.GOOGLE_CLIENT_ID
    const siteUrl = process.env.SITE_URL
    if (!clientId || !siteUrl) {
      throw new ConvexError({ code: "CONFIG_ERROR", message: "OAuth not configured." })
    }

    // Build the app URL for the callback (so Google consent shows your domain)
    const appUrl = process.env.SITE_URL
    if (!appUrl) {
      throw new ConvexError({ code: "CONFIG_ERROR", message: "SITE_URL not configured." })
    }
    const redirectUri = `${appUrl}/import/callback`

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/gmail.readonly",
      ].join(" "),
      access_type: "offline",
      prompt: "consent select_account",
      include_granted_scopes: "true",
      state,
    })
    if (authUser.email) {
      params.set("login_hint", authUser.email)
    }

    return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` }
  },
})

/**
 * Store OAuth state token
 */
export const storeOAuthState = internalMutation({
  args: { userId: v.id("users"), state: v.string() },
  handler: async (ctx, args) => {
    // Clean up expired states for this user
    const existingStates = await ctx.db
      .query("oauthStates")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect()
    for (const s of existingStates) {
      if (s.expiresAt < Date.now()) {
        await ctx.db.delete("oauthStates", s._id)
      }
    }

    await ctx.db.insert("oauthStates", {
      userId: args.userId,
      state: args.state,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    })
  },
})

/**
 * Verify and consume OAuth state token. Returns the userId.
 */
export const verifyAndConsumeOAuthState = internalMutation({
  args: { state: v.string() },
  handler: async (ctx, args): Promise<{ userId: Id<"users"> } | null> => {
    const stateRecord = await ctx.db
      .query("oauthStates")
      .withIndex("by_state", (q) => q.eq("state", args.state))
      .first()

    if (!stateRecord) return null
    if (stateRecord.expiresAt < Date.now()) {
      await ctx.db.delete("oauthStates", stateRecord._id)
      return null
    }

    const userId = stateRecord.userId
    await ctx.db.delete("oauthStates", stateRecord._id)
    return { userId }
  },
})

/**
 * Exchange authorization code for tokens (called from HTTP callback)
 */
export const exchangeCodeForTokens = internalAction({
  args: {
    code: v.string(),
    state: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; email?: string; error?: string }> => {
    // Verify state token
    const stateResult = await ctx.runMutation(internal.gmailConnections.verifyAndConsumeOAuthState, {
      state: args.state,
    })
    if (!stateResult) {
      return { success: false, error: "Invalid or expired OAuth state." }
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const appUrl = process.env.SITE_URL
    if (!clientId || !clientSecret || !appUrl) {
      return { success: false, error: "OAuth not configured." }
    }
    const redirectUri = `${appUrl}/import/callback`

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: args.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    })

    if (!tokenRes.ok) {
      const err = await tokenRes.text().catch(() => "unknown")
      console.error("[gmailConnections] Token exchange failed:", err)
      return { success: false, error: "Failed to exchange authorization code." }
    }

    const tokenData = (await tokenRes.json()) as {
      access_token: string
      refresh_token?: string
      expires_in: number
      id_token?: string
    }

    // Extract email from id_token
    let email: string | null = null
    if (tokenData.id_token) {
      try {
        const parts = tokenData.id_token.split(".")
        if (parts.length === 3) {
          const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/")
          const decoded = atob(payload)
          const parsed = JSON.parse(decoded) as { email?: string }
          email = parsed.email ?? null
        }
      } catch {
        // fallback: use userinfo endpoint
      }
    }

    // Fallback: fetch userinfo if email not in id_token
    if (!email) {
      const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      })
      if (userinfoRes.ok) {
        const userinfo = (await userinfoRes.json()) as { email?: string }
        email = userinfo.email ?? null
      }
    }

    if (!email) {
      return { success: false, error: "Could not determine Gmail address." }
    }

    // Store the connection
    await ctx.runMutation(internal.gmailConnections.upsertConnection, {
      userId: stateResult.userId,
      email,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      accessTokenExpiresAt: Date.now() + tokenData.expires_in * 1000,
      source: "oauth",
    })

    return { success: true, email }
  },
})

/**
 * Public action for the frontend callback route to process the OAuth code exchange.
 * Called from /import/callback after Google redirects back to the app.
 */
export const processOAuthCallback = action({
  args: {
    code: v.string(),
    state: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean; email?: string; error?: string }> => {
    return await ctx.runAction(internal.gmailConnections.exchangeCodeForTokens, {
      code: args.code,
      state: args.state,
    })
  },
})

// ============================================================
// Token Management
// ============================================================

/**
 * Internal query to get a fresh access token for a Gmail connection.
 * If the token is expired, returns the stale token - caller should use
 * refreshAccessToken action when getting 401s.
 */
export const getAccessTokenForConnection = internalQuery({
  args: { gmailConnectionId: v.id("gmailConnections") },
  handler: async (ctx, args): Promise<{ accessToken: string; expiresAt: number; needsRefresh: boolean } | null> => {
    const connection = await ctx.db.get("gmailConnections", args.gmailConnectionId)
    if (!connection || !connection.isActive) return null

    const needsRefresh = connection.accessTokenExpiresAt < Date.now() + 5 * 60 * 1000 // 5 min buffer
    return {
      accessToken: connection.accessToken,
      expiresAt: connection.accessTokenExpiresAt,
      needsRefresh,
    }
  },
})

/**
 * Internal action to refresh an expired access token
 */
export const refreshAccessToken = internalAction({
  args: { gmailConnectionId: v.id("gmailConnections") },
  handler: async (ctx, args): Promise<{ accessToken: string; expiresAt: number } | null> => {
    const connection = await ctx.runQuery(internal.gmailConnections.getConnectionWithTokens, {
      gmailConnectionId: args.gmailConnectionId,
    })

    if (!connection) return null
    if (!connection.refreshToken) {
      console.error("[gmailConnections] No refresh token for connection:", args.gmailConnectionId)
      return null
    }

    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    if (!clientId || !clientSecret) return null

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: connection.refreshToken,
        grant_type: "refresh_token",
      }),
    })

    if (!tokenRes.ok) {
      console.error("[gmailConnections] Token refresh failed:", await tokenRes.text().catch(() => ""))
      return null
    }

    const tokenData = (await tokenRes.json()) as {
      access_token: string
      expires_in: number
    }

    const expiresAt = Date.now() + tokenData.expires_in * 1000

    // Update the connection with new token
    await ctx.runMutation(internal.gmailConnections.updateTokens, {
      gmailConnectionId: args.gmailConnectionId,
      accessToken: tokenData.access_token,
      accessTokenExpiresAt: expiresAt,
    })

    return { accessToken: tokenData.access_token, expiresAt }
  },
})

/**
 * Internal mutation to update access token after refresh
 */
export const updateTokens = internalMutation({
  args: {
    gmailConnectionId: v.id("gmailConnections"),
    accessToken: v.string(),
    accessTokenExpiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("gmailConnections", args.gmailConnectionId, {
      accessToken: args.accessToken,
      accessTokenExpiresAt: args.accessTokenExpiresAt,
    })
  },
})

// ============================================================
// Disconnect
// ============================================================

/**
 * Remove a Gmail connection and clean up associated scan data
 */
export const removeConnection = action({
  args: { gmailConnectionId: v.id("gmailConnections") },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const authUser = await ctx.runQuery(internal.auth.getCurrentAuthUser)
    if (!authUser) throw new ConvexError({ code: "UNAUTHORIZED", message: "Please sign in." })

    const user = await ctx.runQuery(internal.gmail.getUserByAuthId, {
      authId: authUser.id,
    })
    if (!user) throw new ConvexError({ code: "NOT_FOUND", message: "User not found." })

    // Verify the connection belongs to this user
    const connection = await ctx.runQuery(internal.gmailConnections.getConnectionWithTokens, {
      gmailConnectionId: args.gmailConnectionId,
    })
    if (!connection || connection.userId !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Cannot modify this connection." })
    }

    // Revoke token at Google (non-blocking)
    try {
      await fetch(
        `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(connection.accessToken)}`,
        { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      )
    } catch {
      // Non-blocking - continue even if revocation fails
    }

    // Deactivate the connection and clean up scan data
    await ctx.runMutation(internal.gmailConnections.deactivateConnection, {
      gmailConnectionId: args.gmailConnectionId,
    })

    return { success: true }
  },
})

/**
 * Internal mutation to deactivate a connection and clean up its scan data
 */
export const deactivateConnection = internalMutation({
  args: { gmailConnectionId: v.id("gmailConnections") },
  handler: async (ctx, args) => {
    // Deactivate the connection
    await ctx.db.patch("gmailConnections", args.gmailConnectionId, { isActive: false })

    // Clean up scan progress for this connection
    const scanProgress = await ctx.db
      .query("gmailScanProgress")
      .withIndex("by_gmailConnectionId", (q) => q.eq("gmailConnectionId", args.gmailConnectionId))
      .collect()
    for (const p of scanProgress) {
      await ctx.db.delete("gmailScanProgress", p._id)
    }

    // Clean up detected senders for this connection
    const senders = await ctx.db
      .query("detectedSenders")
      .withIndex("by_gmailConnectionId", (q) => q.eq("gmailConnectionId", args.gmailConnectionId))
      .collect()
    for (const s of senders) {
      await ctx.db.delete("detectedSenders", s._id)
    }

    // Clean up import progress for this connection
    const importProgress = await ctx.db
      .query("gmailImportProgress")
      .withIndex("by_gmailConnectionId", (q) => q.eq("gmailConnectionId", args.gmailConnectionId))
      .collect()
    for (const p of importProgress) {
      await ctx.db.delete("gmailImportProgress", p._id)
    }
  },
})

// ============================================================
// HTTP Callback Handler
// ============================================================

/**
 * HTTP action handler for Google OAuth callback
 */
export const handleOAuthCallback = httpAction(async (ctx, request) => {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const error = url.searchParams.get("error")

  const siteUrl = process.env.SITE_URL ?? "http://localhost:3000"

  if (error) {
    console.error("[gmailConnections] OAuth error:", error)
    return Response.redirect(`${siteUrl}/import?error=oauth_denied`, 302)
  }

  if (!code || !state) {
    return Response.redirect(`${siteUrl}/import?error=missing_params`, 302)
  }

  try {
    const result = await ctx.runAction(internal.gmailConnections.exchangeCodeForTokens, {
      code,
      state,
    })

    if (!result.success) {
      console.error("[gmailConnections] Token exchange failed:", result.error)
      return Response.redirect(`${siteUrl}/import?error=token_exchange`, 302)
    }

    return Response.redirect(
      `${siteUrl}/import?connected=${encodeURIComponent(result.email ?? "")}`,
      302
    )
  } catch (err) {
    console.error("[gmailConnections] OAuth callback error:", err)
    return Response.redirect(`${siteUrl}/import?error=callback_failed`, 302)
  }
})
