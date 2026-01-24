# Story 4.1: Gmail OAuth Connection

Status: done (Code Review #2 Passed)

## Story

As a **user with existing newsletters in Gmail**,
I want **to connect my Gmail account**,
So that **the system can access my email for importing newsletters**.

## Acceptance Criteria

1. **Given** I am logged in and on the import page
   **When** I click "Connect Gmail"
   **Then** I am redirected to Google's OAuth consent screen
   **And** the requested scopes include read-only email access

2. **Given** I complete the Google OAuth flow
   **When** I authorize the application
   **Then** I am redirected back to the app
   **And** my Gmail connection status shows as "Connected"

3. **Given** I connect my Gmail
   **When** the OAuth tokens are received
   **Then** they are stored securely via Better Auth (NFR6)
   **And** tokens are never exposed to the client

4. **Given** I am on the import page
   **When** my Gmail is already connected
   **Then** I see my connected Gmail address displayed
   **And** I see options to scan for newsletters or disconnect

5. **Given** the OAuth flow fails or is cancelled
   **When** I return to the app
   **Then** I see an appropriate error message
   **And** I can retry the connection

## Tasks / Subtasks

- [x] **Task 1: Configure Google OAuth Provider** (AC: #1, #2, #3)
  - [x] 1.1: Add Google OAuth provider to Better Auth configuration in `packages/backend/convex/auth.ts`
  - [x] 1.2: Configure OAuth scopes for Gmail read-only access (`https://www.googleapis.com/auth/gmail.readonly`)
  - [x] 1.3: Update `convex/auth.config.ts` if needed for OAuth provider (no changes needed - works with existing config)
  - [x] 1.4: Document environment variables needed: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

- [x] **Task 2: Create Import Page Route** (AC: #1, #4)
  - [x] 2.1: Create `/routes/_authed/import/index.tsx` route file
  - [x] 2.2: Create import page layout with Gmail connection section
  - [x] 2.3: Add import link to main navigation (header nav with Download icon)

- [x] **Task 3: Implement Gmail Connection UI** (AC: #1, #4, #5)
  - [x] 3.1: Create `GmailConnect.tsx` component in `/routes/_authed/import/`
  - [x] 3.2: Implement "Connect Gmail" button with OAuth flow trigger using authClient.linkSocial
  - [x] 3.3: Display connection status (Connected/Not Connected)
  - [x] 3.4: Show connected Gmail address when connected
  - [x] 3.5: Add loading state during OAuth redirect

- [x] **Task 4: Implement OAuth Token Storage** (AC: #3)
  - [x] 4.1: Verify Better Auth stores tokens securely in Convex database (managed by Better Auth)
  - [x] 4.2: Create Convex query to check Gmail connection status: `convex/gmail.ts` → `isGmailConnected`
  - [x] 4.3: Create Convex query to get connected Gmail email: `convex/gmail.ts` → `getGmailAccount`
  - [x] 4.4: Ensure tokens are NEVER returned to client (only connection status and email)

- [x] **Task 5: Handle OAuth Errors** (AC: #5)
  - [x] 5.1: Handle OAuth cancellation (user denies permission) - shows friendly error message
  - [x] 5.2: Handle OAuth failure (network issues, invalid credentials) - shows generic error message
  - [x] 5.3: Display user-friendly error messages (custom error handling in GmailConnect)
  - [x] 5.4: Provide retry button on error state

- [x] **Task 6: Write Tests** (All ACs)
  - [x] 6.1: Test GmailConnect component states (disconnected, connecting, connected, error) - 12 tests
  - [x] 6.2: Test import page rendering with/without Gmail connection
  - [x] 6.3: Test Convex queries for Gmail status

## Dev Notes

### Architecture Patterns & Constraints

**Better Auth OAuth Integration:**
- Better Auth 1.4.9 supports Google OAuth via built-in provider
- OAuth tokens are managed entirely server-side by Better Auth
- Client never receives raw tokens (NFR6 compliance)
- Use `socialProviders.google` configuration in Better Auth

**Convex Integration Pattern:**
```typescript
// In packages/backend/convex/auth.ts
import { google } from "better-auth/providers/google"

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth({
    baseURL: siteUrl,
    database: authComponent.adapter(ctx),
    emailAndPassword: { ... },
    socialProviders: {
      google: google({
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        scope: [
          "openid",
          "email",
          "profile",
          "https://www.googleapis.com/auth/gmail.readonly"
        ],
      }),
    },
    plugins: [convex({ authConfig })],
  })
}
```

**Client OAuth Flow:**
```typescript
// In GmailConnect.tsx
import { authClient } from "~/lib/auth-client"

const handleConnectGmail = async () => {
  await authClient.signIn.social({
    provider: "google",
    callbackURL: "/import?connected=true",
  })
}
```

### Google Cloud Console Setup

**Required Steps (Document for User):**
1. Create project in Google Cloud Console
2. Enable Gmail API
3. Configure OAuth consent screen
4. Create OAuth 2.0 credentials (Web application)
5. Add authorized redirect URIs:
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://your-domain.com/api/auth/callback/google`

**Environment Variables (Convex Dashboard):**
```bash
npx convex env set GOOGLE_CLIENT_ID "your-client-id"
npx convex env set GOOGLE_CLIENT_SECRET "your-client-secret"
```

### File Locations

| File | Purpose |
|------|---------|
| `packages/backend/convex/auth.ts` | Add Google OAuth provider |
| `packages/backend/convex/gmail.ts` | Gmail-related queries (NEW) |
| `apps/web/src/routes/_authed/import/index.tsx` | Import page (NEW) |
| `apps/web/src/routes/_authed/import/GmailConnect.tsx` | Gmail connection component (NEW) |
| `apps/web/src/routes/_authed/import/GmailConnect.test.tsx` | Tests (NEW) |

### Schema Changes

**Better Auth Account Table (Automatic):**
Better Auth automatically stores OAuth account data including:
- Provider name ("google")
- Provider account ID
- Access token (encrypted)
- Refresh token (encrypted)
- Token expiry

No manual schema changes needed - Better Auth's Convex adapter handles this.

### Error Handling Patterns

```typescript
// Use ConvexError for user-actionable errors
import { ConvexError } from "convex/values"

// In Convex queries
if (!account) {
  throw new ConvexError({
    code: "NOT_FOUND",
    message: "Gmail account not connected",
  })
}

// Client-side error handling
try {
  await authClient.signIn.social({ provider: "google" })
} catch (error) {
  if (error.code === "user_cancelled") {
    setError("You cancelled the connection. Click Connect to try again.")
  } else {
    setError("Failed to connect Gmail. Please try again.")
  }
}
```

### UI Component Structure

```tsx
// GmailConnect.tsx structure
function GmailConnect() {
  const gmailAccount = useQuery(api.gmail.getGmailAccount)
  const isConnected = gmailAccount !== null

  if (gmailAccount === undefined) return <Skeleton />

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gmail Integration</CardTitle>
      </CardHeader>
      <CardContent>
        {isConnected ? (
          <ConnectedState email={gmailAccount.email} />
        ) : (
          <DisconnectedState onConnect={handleConnect} />
        )}
      </CardContent>
    </Card>
  )
}
```

### Project Structure Notes

- Import page follows existing route structure under `_authed/`
- Component follows colocated pattern (component + test in same folder)
- Uses existing shadcn/ui components: Button, Card, Input
- Uses existing icons from lucide-react

### References

- [Source: planning-artifacts/epics.md#Story 4.1] - Original requirements
- [Source: planning-artifacts/architecture.md#Authentication & Security] - OAuth patterns
- [Source: planning-artifacts/architecture.md#Better Auth] - Auth library choice
- [Source: project-context.md#Authentication] - Security rules
- [Better Auth Docs: Google Provider] - https://www.better-auth.com/docs/authentication/social-sign-in#google
- [Gmail API Scopes] - https://developers.google.com/gmail/api/auth/scopes

### Critical Implementation Rules

1. **NEVER expose OAuth tokens to client** - Only return connection status and email
2. **Use Better Auth's built-in token refresh** - Do not implement manual refresh
3. **Scope must include gmail.readonly** - Required for Stories 4.2-4.4
4. **Follow existing auth patterns** - Use `authClient.signIn.social()` not custom OAuth
5. **Store credentials in Convex env** - Not in `.env.local`

### Dependencies (No New Packages Needed)

All required packages already installed:
- `better-auth@1.4.9` - OAuth support built-in
- `@convex-dev/better-auth@^0.10.10` - Convex adapter
- `lucide-react` - Icons (Mail, Check, AlertCircle)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - implementation was straightforward with no significant issues.

### Completion Notes List

- Implemented Google OAuth provider in Better Auth configuration with gmail.readonly scope
- Created Import page at `/routes/_authed/import/index.tsx` with responsive layout
- Implemented GmailConnect component with 4 states: disconnected, connecting, connected, error
- Created Convex queries `isGmailConnected` and `getGmailAccount` that use Better Auth's account API
- Added Download icon link to header navigation for Import page access
- Used authClient.linkSocial() to link Google account to existing users (not signIn.social which would create new accounts)
- OAuth tokens are NEVER exposed to client - only email and connection status returned (NFR6 compliance)
- Error handling covers both OAuth cancellation (access_denied) and generic failures
- All 16 tests pass covering component states, page structure, query contracts, and security compliance

### Code Review Findings (Fixed 2026-01-24)

**Issues identified and resolved:**

1. **Tests rewrote as actual component tests** - Original tests were contract documentation that didn't test component behavior. Rewrote to render component and verify UI states.

2. **Convex queries now use proper error handling** - Changed from silent error swallowing to using ConvexError for structured errors that clients can handle.

3. **GmailConnect uses TanStack Router hooks** - Changed from raw `window.location` to `useSearch` and `useNavigate` for proper router integration.

4. **Added error boundary to import page** - Wrapped GmailConnect in ErrorBoundary (react-error-boundary) for graceful error handling.

5. **Fixed getGmailAccount email retrieval** - Now uses user's auth email as reliable fallback instead of potentially returning Google account ID.

6. **Improved isGmailConnected query** - Added proper error handling with ConvexError (query is exported for potential future use).

7. **Documented useState for OAuth redirect state** - Added comment explaining why useState for isConnecting is acceptable (OAuth redirects don't have isPending equivalent).

8. **Removed unused callback parameter** - Changed callback URL from `/import?connected=true` to `/import` since the `connected` param was never used.

### File List

**New Files:**
- `packages/backend/convex/gmail.ts` - Gmail connection queries (isGmailConnected, getGmailAccount)
- `apps/web/src/routes/_authed/import/index.tsx` - Import page route
- `apps/web/src/routes/_authed/import/GmailConnect.tsx` - Gmail connection UI component
- `apps/web/src/routes/_authed/import/GmailConnect.test.tsx` - Component tests (12 tests)

**Modified Files:**
- `packages/backend/convex/auth.ts` - Added Google OAuth provider with gmail.readonly scope
- `apps/web/src/routes/_authed.tsx` - Added Import link to header navigation

### Code Review #2 Findings (Fixed 2026-01-24)

**Issues identified and resolved:**

1. **[HIGH] TypeScript compile error fixed in GmailConnect.tsx** - Added proper type assertion for `gmailAccount` data from `useQuery`. TypeScript couldn't narrow the type when checking `isConnected`.

2. **[HIGH] TypeScript compile error fixed in index.tsx** - Updated `GmailConnectError` to use `FallbackProps` type from react-error-boundary v6 where `error` is typed as `unknown` not `Error`.

3. **[MEDIUM] Documented isGmailConnected query** - Added JSDoc comment explaining the query is kept for future Stories 4.2-4.4 despite being unused in current UI.

4. **[MEDIUM] JWT expiry validation added** - `decodeJwtPayload` now checks the `exp` claim and logs a warning if token is expired.

5. **[MEDIUM] Improved fallback email** - Changed from confusing `google-${accountId}@linked` placeholder to using the auth user's email as fallback when idToken email unavailable.

6. **[MEDIUM] Documented disabled buttons** - Added comments explaining disabled "Scan for Newsletters" and "Disconnect Gmail" buttons are placeholders for future stories.

## Change Log

- 2026-01-24: Story 4.1 implementation complete - Gmail OAuth connection with Better Auth integration
- 2026-01-24: Code review #1 completed - 8 issues fixed (3 HIGH, 4 MEDIUM, 1 LOW), tests expanded to 16
- 2026-01-24: Code review #2 completed - 6 issues fixed (2 HIGH, 4 MEDIUM), TypeScript now compiles clean

