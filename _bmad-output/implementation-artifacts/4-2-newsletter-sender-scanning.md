# Story 4.2: Newsletter Sender Scanning

Status: done

## Story

As a **user with Gmail connected**,
I want **the system to scan my Gmail for newsletter senders**,
So that **I can see which newsletters I'm subscribed to**.

## Acceptance Criteria

1. **Given** my Gmail is connected
   **When** I click "Scan for Newsletters"
   **Then** the system scans my Gmail for newsletter-like emails
   **And** I see a progress indicator during scanning

2. **Given** the scan is in progress
   **When** analyzing emails
   **Then** the system uses heuristics to identify newsletters (list-unsubscribe header, known newsletter domains, mailing list patterns)

3. **Given** the scan completes
   **When** viewing results
   **Then** I see a list of detected newsletter senders
   **And** each sender shows name, email, and approximate email count

4. **Given** the scan finds no newsletters
   **When** viewing results
   **Then** I see a message indicating no newsletters were found
   **And** I have the option to rescan or adjust criteria

5. **Given** my OAuth token expires during scanning (NFR10)
   **When** the system detects expiry
   **Then** it attempts to refresh the token automatically
   **And** continues scanning without user intervention if successful

## Tasks / Subtasks

- [x] **Task 1: Create Gmail API Client in Convex Action** (AC: #1, #2, #5)
  - [x] 1.1: Create `convex/gmailApi.ts` with Gmail API integration using user's access token
  - [x] 1.2: Implement `getGmailAccessToken` internal function to retrieve token from Better Auth
  - [x] 1.3: Add token refresh logic using Better Auth's built-in refresh mechanism
  - [x] 1.4: Create Gmail API wrapper with proper error handling for rate limits and token expiry

- [x] **Task 2: Implement Newsletter Detection Heuristics** (AC: #2)
  - [x] 2.1: Create `convex/_internal/newsletterDetection.ts` with heuristic functions
  - [x] 2.2: Implement `hasListUnsubscribeHeader` check (strongest signal)
  - [x] 2.3: Implement `isKnownNewsletterDomain` check (substack.com, buttondown.email, beehiiv.com, etc.)
  - [x] 2.4: Implement `hasMailingListHeaders` check (List-Id, Precedence: bulk)
  - [x] 2.5: Create scoring function combining heuristics with confidence threshold

- [x] **Task 3: Create Scan Action with Progress Tracking** (AC: #1, #3, #4)
  - [x] 3.1: Create `scanGmailForNewsletters` Convex action in `convex/gmail.ts`
  - [x] 3.2: Implement paginated Gmail API calls to fetch email headers (not full content)
  - [x] 3.3: Create `gmailScanProgress` table to track scan state per user
  - [x] 3.4: Create `detectedSenders` table to store scan results before user approval
  - [x] 3.5: Implement progress update mutations for real-time UI feedback
  - [x] 3.6: Aggregate sender statistics (count emails, extract names)

- [x] **Task 4: Create Scanning UI Components** (AC: #1, #3, #4)
  - [x] 4.1: Create `SenderScanner.tsx` component in `/routes/_authed/import/`
  - [x] 4.2: Implement "Scan for Newsletters" button with loading state
  - [x] 4.3: Create progress indicator showing scan status (emails processed, senders found)
  - [x] 4.4: Create detected senders list with sender name, email, and email count
  - [x] 4.5: Implement empty state for no newsletters found with rescan option
  - [x] 4.6: Add error state handling for API failures

- [x] **Task 5: Integrate with Import Page** (AC: #1, #3)
  - [x] 5.1: Add SenderScanner to import page, shown only when Gmail is connected
  - [x] 5.2: Wire up Convex queries/mutations for scan progress and results
  - [x] 5.3: Implement real-time progress updates via Convex subscriptions

- [x] **Task 6: Write Tests** (All ACs)
  - [x] 6.1: Test newsletter detection heuristics with sample email headers
  - [x] 6.2: Test SenderScanner component states (idle, scanning, complete, empty, error)
  - [x] 6.3: Test scan progress tracking and real-time updates
  - [x] 6.4: Test token refresh error handling

## Dev Notes

### Architecture Patterns & Constraints

**Gmail API Integration via Convex Actions:**
```typescript
// In convex/gmailApi.ts - Actions for external API calls
import { action, internalQuery } from "./_generated/server"
import { v } from "convex/values"

// Internal query to get access token from Better Auth
export const getAccessToken = internalQuery({
  args: {},
  handler: async (ctx) => {
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx)
    const accounts = await auth.api.listUserAccounts({ headers })
    const googleAccount = accounts.find(a => a.providerId === "google")

    if (!googleAccount?.accessToken) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Gmail not connected or token unavailable",
      })
    }

    return googleAccount.accessToken
  },
})

// Action to call Gmail API (actions can make HTTP requests)
export const listMessages = action({
  args: { maxResults: v.number(), pageToken: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const accessToken = await ctx.runQuery(internal.gmailApi.getAccessToken)

    const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages")
    url.searchParams.set("maxResults", args.maxResults.toString())
    url.searchParams.set("q", "list:unsubscribe OR from:substack.com OR from:buttondown.email")
    if (args.pageToken) url.searchParams.set("pageToken", args.pageToken)

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (response.status === 401) {
      // Token expired - Better Auth should handle refresh automatically
      throw new ConvexError({ code: "TOKEN_EXPIRED", message: "Gmail token expired" })
    }

    return response.json()
  },
})
```

**Newsletter Detection Heuristics:**
```typescript
// In convex/_internal/newsletterDetection.ts
export type EmailHeaders = {
  "list-unsubscribe"?: string
  "list-id"?: string
  "precedence"?: string
  from: string
  subject: string
}

const KNOWN_NEWSLETTER_DOMAINS = [
  "substack.com",
  "buttondown.email",
  "beehiiv.com",
  "convertkit.com",
  "mailchimp.com",
  "ghost.io",
  "revue.co",
  "getrevue.co",
  "sendfox.com",
  "mailerlite.com",
]

export function calculateNewsletterScore(headers: EmailHeaders): number {
  let score = 0

  // Strong signals (50 points each)
  if (headers["list-unsubscribe"]) score += 50

  // Medium signals (30 points each)
  const fromDomain = headers.from.split("@")[1]?.toLowerCase()
  if (KNOWN_NEWSLETTER_DOMAINS.some(d => fromDomain?.includes(d))) score += 30
  if (headers["list-id"]) score += 30

  // Weak signals (10 points each)
  if (headers["precedence"]?.toLowerCase() === "bulk") score += 10

  return score
}

// Threshold: 50+ = definitely newsletter, 30-49 = probably, <30 = unlikely
export const NEWSLETTER_THRESHOLD = 30
```

**Schema Additions:**
```typescript
// Add to convex/schema.ts

// Track ongoing scan progress
gmailScanProgress: defineTable({
  userId: v.id("users"),
  status: v.union(v.literal("scanning"), v.literal("complete"), v.literal("error")),
  totalEmails: v.number(),
  processedEmails: v.number(),
  sendersFound: v.number(),
  startedAt: v.number(),
  completedAt: v.optional(v.number()),
  error: v.optional(v.string()),
})
  .index("by_userId", ["userId"]),

// Store detected senders before user approval (Story 4.3)
detectedSenders: defineTable({
  userId: v.id("users"),
  email: v.string(),
  name: v.optional(v.string()),
  domain: v.string(),
  emailCount: v.number(),
  confidenceScore: v.number(),
  sampleSubjects: v.array(v.string()),
  detectedAt: v.number(),
})
  .index("by_userId", ["userId"])
  .index("by_userId_email", ["userId", "email"]),
```

### Gmail API Specifics

**Required Scope (already configured in Story 4.1):**
- `https://www.googleapis.com/auth/gmail.readonly`

**API Endpoints Used:**
1. `GET /gmail/v1/users/me/messages` - List message IDs with search query
2. `GET /gmail/v1/users/me/messages/{id}` - Get message headers (format=metadata)

**Rate Limits:**
- 250 quota units per user per second
- List messages: 5 units per request
- Get message: 5 units per request
- Strategy: Process in batches with delays between batches

**Search Query Optimization:**
```
list:unsubscribe OR from:substack.com OR from:buttondown.email OR from:beehiiv.com
```
This pre-filters at Gmail API level, reducing emails to scan.

### File Locations

| File | Purpose |
|------|---------|
| `packages/backend/convex/gmailApi.ts` | Gmail API client with token handling (NEW) |
| `packages/backend/convex/gmail.ts` | Add scan action and progress mutations (MODIFY) |
| `packages/backend/convex/_internal/newsletterDetection.ts` | Heuristic functions (NEW) |
| `packages/backend/convex/schema.ts` | Add gmailScanProgress, detectedSenders tables (MODIFY) |
| `apps/web/src/routes/_authed/import/SenderScanner.tsx` | Scanning UI component (NEW) |
| `apps/web/src/routes/_authed/import/SenderScanner.test.tsx` | Component tests (NEW) |
| `apps/web/src/routes/_authed/import/index.tsx` | Integrate SenderScanner (MODIFY) |

### Previous Story Intelligence (Story 4.1)

**Learnings to Apply:**
1. **Use authComponent.getAuth pattern** - This is how we access Better Auth API in Convex
2. **Token handling is internal** - Access tokens are available via `googleAccount.accessToken` but NEVER exposed to client
3. **Error handling pattern** - Use ConvexError with structured codes (NOT_FOUND, INTERNAL_ERROR, etc.)
4. **Loading states** - Use Convex query `undefined` check for loading, NOT useState
5. **Test patterns** - Use Testing Library with proper mocking of Convex queries/mutations

**Files Created in 4.1 to Build Upon:**
- `packages/backend/convex/gmail.ts` - Add scan functions here
- `apps/web/src/routes/_authed/import/index.tsx` - Add SenderScanner here
- `apps/web/src/routes/_authed/import/GmailConnect.tsx` - Reference pattern for component structure

**Code Pattern from 4.1:**
```typescript
// From GmailConnect.tsx - follow this loading pattern
const gmailAccount = useQuery(api.gmail.getGmailAccount)

if (gmailAccount === undefined) {
  return <Skeleton className="h-[200px]" />
}

// gmailAccount is null when not connected, object when connected
const isConnected = gmailAccount !== null
```

### Project Structure Notes

- All Convex backend code goes in `packages/backend/convex/`
- Web app components go in `apps/web/src/routes/_authed/import/`
- Internal helpers (not exposed as API) go in `convex/_internal/`
- Tests are colocated with components (same folder)
- Use existing shadcn/ui components: Button, Card, Progress, Skeleton

### Technical Requirements

**Convex Action vs Mutation:**
- **Actions** can make HTTP requests (external API calls) - USE FOR Gmail API
- **Mutations** modify database state - USE FOR progress updates
- **Queries** read database state - USE FOR getting progress/results

**Progress Update Pattern:**
```typescript
// Action calls mutation to update progress
export const scanGmailForNewsletters = action({
  handler: async (ctx) => {
    // Initialize progress
    await ctx.runMutation(internal.gmail.initScanProgress)

    // Scan in batches
    while (hasMoreMessages) {
      const messages = await fetchBatch()
      await ctx.runMutation(internal.gmail.updateScanProgress, {
        processedEmails: count,
        sendersFound: senders.length,
      })
    }

    // Mark complete
    await ctx.runMutation(internal.gmail.completeScan, { status: "complete" })
  },
})
```

### UI Component Structure

```tsx
// SenderScanner.tsx
function SenderScanner() {
  const scanProgress = useQuery(api.gmail.getScanProgress)
  const detectedSenders = useQuery(api.gmail.getDetectedSenders)
  const startScan = useMutation(api.gmail.startScan)

  // Loading state
  if (scanProgress === undefined) return <Skeleton />

  // No scan started yet
  if (scanProgress === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Find Your Newsletters</CardTitle>
          <CardDescription>
            Scan your Gmail to discover newsletters you're subscribed to
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => startScan()}>
            Scan for Newsletters
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Scan in progress
  if (scanProgress.status === "scanning") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scanning...</CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={(scanProgress.processedEmails / scanProgress.totalEmails) * 100} />
          <p>{scanProgress.processedEmails} emails processed, {scanProgress.sendersFound} senders found</p>
        </CardContent>
      </Card>
    )
  }

  // Scan complete - show results
  if (scanProgress.status === "complete") {
    if (detectedSenders?.length === 0) {
      return <EmptyState onRescan={() => startScan()} />
    }
    return <SendersList senders={detectedSenders} />
  }

  // Error state
  return <ErrorState error={scanProgress.error} onRetry={() => startScan()} />
}
```

### Critical Implementation Rules

1. **NEVER expose access tokens to client** - All Gmail API calls happen in Convex actions
2. **Use Convex actions for HTTP requests** - Mutations cannot make external calls
3. **Paginate Gmail API calls** - Don't try to fetch all emails at once
4. **Store progress in database** - Enables real-time UI updates via subscriptions
5. **Handle rate limits gracefully** - Add delays between batches, catch 429 errors
6. **Clean up on rescan** - Delete previous detectedSenders before new scan

### Dependencies

**No new packages needed** - All functionality uses:
- Convex actions with native `fetch`
- Better Auth token management (existing)
- shadcn/ui Progress component (add if not exists)

### References

- [Source: planning-artifacts/epics.md#Story 4.2] - Original requirements
- [Source: planning-artifacts/architecture.md#API & Communication Patterns] - Action patterns
- [Source: project-context.md#Convex Patterns] - Function naming, error handling
- [Gmail API Messages.list](https://developers.google.com/gmail/api/reference/rest/v1/users.messages/list)
- [Gmail API Messages.get](https://developers.google.com/gmail/api/reference/rest/v1/users.messages/get)

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None

### Completion Notes List

- **Task 1**: Created `gmailApi.ts` with Gmail API client including `getAccessToken` internal query, `listNewsletterMessages` and `getMessageDetails` internal actions, and `checkGmailAccess` public action. Token retrieval uses Better Auth's `listUserAccounts` API. Error handling covers 401 (token expired), 403 (forbidden), 404 (not found), and 429 (rate limited).

- **Task 2**: Implemented newsletter detection heuristics in `newsletterDetection.ts` with scoring system: List-Unsubscribe (+50), known newsletter domain (+30), List-Id (+30), Precedence: bulk/list (+10). Threshold set at 30 to catch platform-based newsletters. Includes 24 known newsletter platform domains. All 37 unit tests pass.

- **Task 3**: Added `gmailScanProgress` and `detectedSenders` tables to schema. Created `startScan` action with paginated Gmail API calls (max 10 pages = ~1000 emails), progress tracking mutations (`initScanProgress`, `updateScanProgress`, `completeScan`), and sender aggregation (`upsertDetectedSender`). Progress stored in database for real-time UI updates via Convex subscriptions.

- **Task 4**: Created `SenderScanner.tsx` component with all states: idle (scan button), scanning (progress bar), complete (sender list with confidence badges), empty (no newsletters message), and error (retry option). Also added `Progress` UI component. All 16 component tests pass.

- **Task 5**: Integrated `SenderScanner` into import page with conditional rendering based on Gmail connection status. Updated `GmailConnect` component to remove redundant scan button. Error boundaries wrap each component independently.

- **Task 6**: Created comprehensive test suites - 37 tests for newsletter detection heuristics, 16 tests for SenderScanner component covering all states and AC validation. All new tests pass.

### File List

**New Files:**
- `packages/backend/convex/gmailApi.ts` - Gmail API client with token handling
- `packages/backend/convex/_internal/newsletterDetection.ts` - Newsletter detection heuristics
- `packages/backend/convex/_internal/newsletterDetection.test.ts` - Heuristics unit tests (37 tests)
- `apps/web/src/components/ui/progress.tsx` - Progress bar UI component
- `apps/web/src/routes/_authed/import/SenderScanner.tsx` - Scanner UI component
- `apps/web/src/routes/_authed/import/SenderScanner.test.tsx` - Component tests (16 tests)

**Modified Files:**
- `packages/backend/convex/schema.ts` - Added `gmailScanProgress` and `detectedSenders` tables
- `packages/backend/convex/gmail.ts` - Added scan queries, mutations, and action
- `apps/web/src/routes/_authed/import/index.tsx` - Integrated SenderScanner component
- `apps/web/src/routes/_authed/import/GmailConnect.tsx` - Updated connected state UI
- `apps/web/src/routes/_authed/import/GmailConnect.test.tsx` - Updated test for UI changes

### Change Log

- 2026-01-24: Story 4.2 implemented - Gmail newsletter sender scanning with full backend and frontend implementation
- 2026-01-24: Code review complete - 7 issues fixed (4 HIGH, 3 MEDIUM)

### Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5
**Date:** 2026-01-24
**Outcome:** ✅ APPROVED (after fixes)

**Issues Found & Fixed:**

🔴 **HIGH SEVERITY (4 fixed):**
1. TypeScript errors in Better Auth type definitions - Fixed `BetterAuthAccountWithIdToken` type and `accessTokenExpiresAt` property access
2. Module-level mutable state in `gmailApi.ts` - Removed `hasLoggedSampleMessage` variable, now passed as function argument
3. Missing error recovery in `startScan` - Added proper error handling to update progress status to "error" when scan fails
4. Race condition in scan progress - Added `getExistingScanProgress` check to prevent concurrent scans

🟡 **MEDIUM SEVERITY (3 fixed):**
5. Test mock using incorrect pattern - Fixed Vitest hoisting issue with call counter approach
6. useState for isStarting could cause unmount warning - Added `isMountedRef` to prevent state updates after unmount
7. Magic numbers for scoring weights - Extracted to named `SCORING_WEIGHTS` constant with documentation

🟢 **LOW SEVERITY (2 noted, not fixed):**
- Console.log statements in production code (acceptable for MVP debugging)
- Disabled button without tooltip explanation (UX polish, not blocking)

**Tests:** ✅ 40 unit tests pass, ✅ 16 component tests pass

**Acceptance Criteria Validation:**
- AC #1 ✅ Scan button and progress indicator implemented
- AC #2 ✅ Newsletter detection heuristics with scoring system
- AC #3 ✅ Detected senders list with name, email, count, confidence
- AC #4 ✅ Empty state with rescan option
- AC #5 ✅ Token refresh error handling (Better Auth automatic + error recovery)
