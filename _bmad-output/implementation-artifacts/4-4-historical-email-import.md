# Story 4.4: Historical Email Import

Status: in-progress (Tasks 1-7 complete, Task 8 pending)

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **user with approved senders**,
I want **to import historical emails from those senders**,
So that **I have my newsletter archive in the app**.

## Acceptance Criteria

1. **Given** I have approved senders for import
   **When** the import begins
   **Then** I see a progress indicator showing emails imported / total
   **And** the import runs in the background

2. **Given** the import is in progress
   **When** emails are processed
   **Then** each email is parsed and stored (same as Epic 2 flow)
   **And** sender records are created or linked

3. **Given** the import completes successfully
   **When** viewing the results
   **Then** I see a summary of imported newsletters
   **And** the newsletters appear in my main list

4. **Given** some emails fail to import
   **When** the import completes
   **Then** I see a count of failed imports
   **And** successful imports are still available

5. **Given** I navigate away during import
   **When** I return to the import page
   **Then** I can see the current progress
   **And** the import continues in the background

6. **Given** an imported newsletter already exists
   **When** processing duplicates
   **Then** duplicates are detected and skipped
   **And** no duplicate newsletters are created

## Tasks / Subtasks

- [x] **Task 1: Create Import Progress Schema & State Management** (AC: #1, #5)
  - [x] 1.1: Add `gmailImportProgress` table to schema.ts with fields: userId, status (pending/importing/complete/error), totalEmails, importedEmails, failedEmails, skippedEmails, startedAt, completedAt, error
  - [x] 1.2: Create `initImportProgress` internal mutation
  - [x] 1.3: Create `updateImportProgress` internal mutation for real-time updates
  - [x] 1.4: Create `completeImport` internal mutation to mark import as done
  - [x] 1.5: Create `getImportProgress` public query for UI polling

- [x] **Task 2: Create Email Content Fetching Functions** (AC: #2)
  - [x] 2.1: Add `getFullMessageContents` internal action to gmailApi.ts that fetches full email (not just headers)
  - [x] 2.2: Extract HTML body from Gmail message (handle multipart/alternative, text/html, text/plain)
  - [x] 2.3: Add batch content fetching with rate limiting (similar to header batching)
  - [x] 2.4: Handle different Gmail message formats (MIME types, base64 encoding)

- [x] **Task 3: Implement Email Processing Pipeline** (AC: #2, #6)
  - [x] 3.1: Create `processImportedEmail` internal mutation that:
    - Extracts email content (subject, sender, date, HTML body)
    - Normalizes content for deduplication (Epic 2.5 pattern)
    - Checks for existing `newsletterContent` by content hash
    - Creates or references shared content (if not private)
    - Creates `userNewsletter` record
    - Creates/updates global `senders` record and `userSenderSettings`
  - [x] 3.2: Implement content normalization (reuses existing _internal/contentNormalization.ts)
  - [x] 3.3: Add duplicate detection via content hash lookup
  - [x] 3.4: Handle private vs public storage based on `userSenderSettings.isPrivate`

- [x] **Task 4: Implement R2 Upload for Imported Content** (AC: #2)
  - [x] 4.1: Create content storage via newsletterContent records (reuses existing R2 pattern)
  - [x] 4.2: Generate unique R2 keys for content (format: `content/{hash}.html` for public, `private/{userId}/{timestamp}-{uuid}.html` for private)
  - [x] 4.3: Handle storage failures gracefully (log and continue)

- [x] **Task 5: Create Main Import Action** (AC: #1, #2, #4, #5, #6)
  - [x] 5.1: Create `startHistoricalImport` action in gmail.ts that:
    - Gets approved senders from `detectedSenders`
    - Fetches all message IDs for each sender
    - Initializes import progress
    - Processes emails in batches with progress updates
    - Handles errors per-email (don't fail entire import)
  - [x] 5.2: Implement paginated email fetching per sender (`listMessagesFromSender`)
  - [x] 5.3: Add batch processing with configurable batch size (10 emails per batch)
  - [x] 5.4: Update progress after each batch
  - [x] 5.5: Handle partial failures gracefully (continue on individual email errors)

- [x] **Task 6: Build Import Progress UI** (AC: #1, #3, #4, #5)
  - [x] 6.1: Create `ImportProgress.tsx` component showing:
    - Progress bar (imported/total)
    - Current status text
    - Error count if any
  - [x] 6.2: Implement real-time progress updates via Convex subscription
  - [x] 6.3: Show completion summary with imported/skipped/failed counts
  - [x] 6.4: Add "View Newsletters" button on completion
  - [x] 6.5: Handle page refresh/navigation (restore progress from database)

- [x] **Task 7: Integrate Import Flow with Existing UI** (AC: #1, #3)
  - [x] 7.1: Modify SenderReview.tsx to trigger import after approval
  - [x] 7.2: Add state transition: approval success → import progress view
  - [x] 7.3: Update SenderScanner.tsx to handle import-in-progress state
  - [ ] 7.4: Show import status in sidebar/header during background import (deferred - optional enhancement)

- [x] **Task 8: Write Tests** (All ACs)
  - [x] 8.1: Test import progress initialization and updates
  - [x] 8.2: Test email content extraction (various MIME types)
  - [x] 8.3: Test deduplication logic
  - [x] 8.4: Test sender record creation/linking
  - [x] 8.5: Test partial failure handling
  - [x] 8.6: Test UI progress display and completion summary (contract tests)
  - [x] 8.7: Test page refresh preserves progress state (contract tests)

## Dev Notes

### Architecture Patterns & Constraints

**Epic 2.5 Shared Content Model:**
The import must follow the shared content architecture from Epic 2.5:
- Public newsletters → Create/reference `newsletterContent` record, link via `contentId`
- Private newsletters → Upload directly to R2, store key in `userNewsletters.privateR2Key`
- Global senders → Use existing `senders` table (increment `subscriberCount`, `newsletterCount`)
- User preferences → Create `userSenderSettings` record per user/sender

**Content Flow (matching email worker pattern):**
```typescript
// For each imported email:
1. Fetch full email content from Gmail API
2. Extract HTML body (handle MIME multipart)
3. Check userSenderSettings.isPrivate for this sender
   - If private: Upload to R2 with user-specific key, store as privateR2Key
   - If public:
     a. Normalize content (strip tracking, personalization)
     b. Hash normalized content
     c. Check newsletterContent for existing hash
     d. If exists: reuse contentId, increment readerCount
     e. If not: upload to R2, create newsletterContent record
4. Create userNewsletter record
5. Create/update senders record (increment counts)
6. Create userSenderSettings if not exists
```

### Previous Story Intelligence (Story 4.3)

**Existing Tables and Functions (build upon these):**
- `detectedSenders` table with `isApproved` field → Source of approved senders
- `approveSelectedSenders` mutation → Called before import starts
- `SenderReview.tsx` → Triggers approval, should transition to import view

**Gmail API Functions Available (from gmailApi.ts):**
- `listNewsletterMessages` → List message IDs with search query
- `getMessageDetails` → Fetch message headers (used in scanning)
- `batchGetGmailMessages` → Batch fetch with rate limiting
- Need to add: `getFullMessageContent` for full email body

**Schema Patterns (from schema.ts):**
```typescript
// Already exists - use these tables:
newsletterContent: defineTable({...})  // Shared content
userNewsletters: defineTable({...})     // Per-user records
senders: defineTable({...})             // Global senders
userSenderSettings: defineTable({...}) // Per-user sender prefs
detectedSenders: defineTable({...})     // From scan (has isApproved)

// NEW for this story:
gmailImportProgress: defineTable({
  userId: v.id("users"),
  status: v.union(
    v.literal("pending"),
    v.literal("importing"),
    v.literal("complete"),
    v.literal("error")
  ),
  totalEmails: v.number(),
  importedEmails: v.number(),
  failedEmails: v.number(),
  skippedEmails: v.number(), // Duplicates
  startedAt: v.number(),
  completedAt: v.optional(v.number()),
  error: v.optional(v.string()),
}).index("by_userId", ["userId"]),
```

### Gmail API for Full Content Fetching

**Getting Full Email Content:**
```typescript
// Current: format=metadata (headers only)
// Needed: format=full to get body content

async function getFullGmailMessage(
  accessToken: string,
  messageId: string
): Promise<GmailFullMessage> {
  const url = new URL(`${GMAIL_API_BASE}/messages/${messageId}`)
  url.searchParams.set("format", "full") // Get full content

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  return response.json()
}

// Gmail message structure with body:
type GmailFullMessage = {
  id: string
  threadId: string
  internalDate: string // Unix timestamp in ms as string
  payload: {
    mimeType: string
    headers: Array<{ name: string; value: string }>
    body?: {
      size: number
      data?: string // Base64url encoded content
    }
    parts?: Array<GmailMessagePart> // For multipart messages
  }
}

type GmailMessagePart = {
  mimeType: string
  body?: {
    size: number
    data?: string
  }
  parts?: GmailMessagePart[] // Nested parts
}
```

**Extracting HTML Body from Gmail Message:**
```typescript
function extractHtmlBody(message: GmailFullMessage): string | null {
  const payload = message.payload

  // Direct body (simple messages)
  if (payload.body?.data && payload.mimeType === "text/html") {
    return decodeBase64Url(payload.body.data)
  }

  // Multipart message - search for text/html part
  if (payload.parts) {
    const htmlPart = findPartByMimeType(payload.parts, "text/html")
    if (htmlPart?.body?.data) {
      return decodeBase64Url(htmlPart.body.data)
    }

    // Fallback to text/plain if no HTML
    const textPart = findPartByMimeType(payload.parts, "text/plain")
    if (textPart?.body?.data) {
      // Convert plain text to simple HTML
      const text = decodeBase64Url(textPart.body.data)
      return `<pre>${escapeHtml(text)}</pre>`
    }
  }

  return null
}

function findPartByMimeType(
  parts: GmailMessagePart[],
  mimeType: string
): GmailMessagePart | null {
  for (const part of parts) {
    if (part.mimeType === mimeType) {
      return part
    }
    // Recurse into nested parts
    if (part.parts) {
      const found = findPartByMimeType(part.parts, mimeType)
      if (found) return found
    }
  }
  return null
}

function decodeBase64Url(data: string): string {
  // Gmail uses base64url encoding (- and _ instead of + and /)
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
  return atob(base64)
}
```

### Content Normalization (from Epic 2.5)

**Normalize content before hashing for deduplication:**
```typescript
function normalizeForHash(html: string): string {
  return html
    // Strip tracking pixels
    .replace(/<img[^>]*tracking[^>]*>/gi, '')
    .replace(/<img[^>]*(1x1|pixel|beacon)[^>]*>/gi, '')
    // Normalize unsubscribe links (personalized)
    .replace(/href="[^"]*unsubscribe[^"]*"/gi, 'href="UNSUBSCRIBE"')
    // Normalize personalized greetings
    .replace(/Hi \w+,/gi, 'Hi USER,')
    .replace(/Hello \w+,/gi, 'Hello USER,')
    .replace(/Dear \w+,/gi, 'Dear USER,')
    // Strip email-specific IDs and tokens
    .replace(/[a-f0-9]{32,}/gi, 'HASH')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim()
}

async function computeContentHash(normalizedHtml: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(normalizedHtml)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
```

### R2 Upload Pattern (from email worker)

**Upload to R2 via Convex action:**
```typescript
// R2 key format for imports
function generateImportR2Key(userId: string, contentHash: string): string {
  const timestamp = Date.now()
  return `import/${userId}/${timestamp}-${contentHash.substring(0, 8)}.html`
}

// For private newsletters (user-specific storage)
function generatePrivateR2Key(userId: string, messageId: string): string {
  return `private/${userId}/${messageId}.html`
}
```

### Processing Pipeline Implementation

**Main Import Action Structure:**
```typescript
export const startHistoricalImport = action({
  args: {},
  handler: async (ctx): Promise<{ success: boolean; error?: string }> => {
    // 1. Get authenticated user
    const authUser = await ctx.runQuery(api.auth.getCurrentUser)
    if (!authUser) return { success: false, error: "Not authenticated" }

    const user = await ctx.runQuery(internal.gmail.getUserByAuthId, { authId: authUser.id })
    if (!user) return { success: false, error: "User not found" }

    // 2. Check for existing import in progress
    const existingProgress = await ctx.runQuery(internal.gmail.getExistingImportProgress, { userId: user._id })
    if (existingProgress?.status === "importing") {
      return { success: false, error: "Import already in progress" }
    }

    // 3. Get approved senders
    const approvedSenders = await ctx.runQuery(internal.gmail.getApprovedSenders, { userId: user._id })
    if (approvedSenders.length === 0) {
      return { success: false, error: "No approved senders" }
    }

    // 4. Estimate total emails from sender email counts
    const totalEstimate = approvedSenders.reduce((sum, s) => sum + s.emailCount, 0)

    // 5. Initialize import progress
    const progressId = await ctx.runMutation(internal.gmail.initImportProgress, {
      userId: user._id,
      totalEmails: totalEstimate,
    })

    // 6. Process each sender's emails
    let importedCount = 0
    let failedCount = 0
    let skippedCount = 0

    for (const sender of approvedSenders) {
      // Fetch all message IDs for this sender
      const messages = await fetchSenderMessages(ctx, sender.email)

      // Process in batches
      const BATCH_SIZE = 10
      for (let i = 0; i < messages.length; i += BATCH_SIZE) {
        const batch = messages.slice(i, i + BATCH_SIZE)

        // Fetch full content for batch
        const fullMessages = await ctx.runAction(internal.gmailApi.getFullMessageContents, {
          messageIds: batch.map(m => m.id),
        })

        // Process each message
        for (const message of fullMessages) {
          try {
            const result = await ctx.runMutation(internal.gmail.processImportedEmail, {
              userId: user._id,
              senderEmail: sender.email,
              message,
            })

            if (result.skipped) {
              skippedCount++
            } else {
              importedCount++
            }
          } catch (error) {
            failedCount++
            console.error("[import] Failed to import email:", error)
          }
        }

        // Update progress
        await ctx.runMutation(internal.gmail.updateImportProgress, {
          progressId,
          importedEmails: importedCount,
          failedEmails: failedCount,
          skippedEmails: skippedCount,
        })
      }
    }

    // 7. Mark import complete
    await ctx.runMutation(internal.gmail.completeImport, {
      progressId,
      status: "complete",
    })

    return { success: true }
  },
})
```

### UI Component Structure

**ImportProgress.tsx:**
```tsx
function ImportProgress() {
  const progress = useQuery(api.gmail.getImportProgress)

  if (progress === undefined) return <Skeleton />
  if (!progress) return null // No import in progress

  const { status, totalEmails, importedEmails, failedEmails, skippedEmails } = progress
  const processedEmails = importedEmails + failedEmails + skippedEmails
  const percentage = totalEmails > 0 ? Math.round((processedEmails / totalEmails) * 100) : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {status === "importing" ? "Importing Newsletters..." : "Import Complete"}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {status === "importing" && (
          <>
            <Progress value={percentage} className="mb-4" />
            <p className="text-sm text-muted-foreground">
              Processing {processedEmails} of {totalEmails} emails
            </p>
          </>
        )}

        {status === "complete" && (
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Imported:</span>
              <span className="font-medium">{importedEmails}</span>
            </div>
            {skippedEmails > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Skipped (duplicates):</span>
                <span>{skippedEmails}</span>
              </div>
            )}
            {failedEmails > 0 && (
              <div className="flex justify-between text-destructive">
                <span>Failed:</span>
                <span>{failedEmails}</span>
              </div>
            )}
          </div>
        )}

        {status === "error" && (
          <Alert variant="destructive">
            <AlertTitle>Import Failed</AlertTitle>
            <AlertDescription>{progress.error}</AlertDescription>
          </Alert>
        )}
      </CardContent>

      {status === "complete" && (
        <CardFooter>
          <Button asChild>
            <Link to="/newsletters">View Newsletters</Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}
```

### File Locations

| File | Action | Purpose |
|------|--------|---------|
| `packages/backend/convex/schema.ts` | MODIFY | Add `gmailImportProgress` table |
| `packages/backend/convex/gmail.ts` | MODIFY | Add import mutations/queries |
| `packages/backend/convex/gmailApi.ts` | MODIFY | Add `getFullMessageContent` action |
| `packages/backend/convex/newsletters.ts` | MODIFY (or CREATE) | Add `processImportedEmail` mutation |
| `apps/web/src/routes/_authed/import/ImportProgress.tsx` | NEW | Progress display component |
| `apps/web/src/routes/_authed/import/ImportProgress.test.tsx` | NEW | Component tests |
| `apps/web/src/routes/_authed/import/SenderReview.tsx` | MODIFY | Trigger import after approval |
| `apps/web/src/routes/_authed/import/index.tsx` | MODIFY | Route import progress state |

### Project Structure Notes

- Follows colocated test pattern (component + test in same folder)
- Uses existing shadcn/ui components: Button, Card, Progress, Alert, Skeleton
- Gmail API calls in `gmailApi.ts`, business logic in `gmail.ts`
- Newsletter storage logic should match email worker pattern
- Uses Convex real-time queries for progress updates (no polling needed)

### Critical Implementation Rules

1. **Follow Epic 2.5 shared content model** - Public content is deduplicated, private is user-specific
2. **Handle MIME types correctly** - Gmail messages can be multipart/alternative, text/html, or text/plain
3. **Base64url decoding** - Gmail uses URL-safe base64 (- and _ instead of + and /)
4. **Rate limiting** - Respect Gmail API quotas (250 quota units/sec)
5. **Partial failure handling** - Individual email failures should NOT fail entire import
6. **Progress persistence** - Import state in database allows resume after page refresh
7. **No duplicate newsletters** - Check content hash before creating new records
8. **Sender records** - Create/update global `senders` and `userSenderSettings`

### Error Handling Patterns

```typescript
// Per-email error handling - log and continue
for (const message of batch) {
  try {
    await processEmail(message)
    importedCount++
  } catch (error) {
    failedCount++
    console.error("[import] Email failed:", {
      messageId: message.id,
      error: error instanceof Error ? error.message : "Unknown error",
    })
    // Continue processing other emails
  }
}

// Fatal errors (e.g., token expired) - stop import
if (error.code === "TOKEN_EXPIRED") {
  await completeImport(progressId, "error", "Gmail token expired. Please reconnect.")
  return { success: false, error: "Token expired" }
}
```

### Testing Requirements

```typescript
describe("Historical Email Import", () => {
  describe("AC#1: Progress Indicator", () => {
    it("shows progress bar with imported/total count")
    it("updates in real-time as emails are processed")
    it("runs import in background (action)")
  })

  describe("AC#2: Email Processing", () => {
    it("extracts HTML from multipart/alternative messages")
    it("extracts HTML from text/html messages")
    it("falls back to text/plain when no HTML")
    it("creates sender record if not exists")
    it("links to existing sender record")
    it("creates userNewsletter record")
  })

  describe("AC#3: Completion Summary", () => {
    it("shows imported count on completion")
    it("newsletters appear in main list")
    it("provides navigation to newsletters")
  })

  describe("AC#4: Partial Failures", () => {
    it("shows failed count separately")
    it("continues processing after individual failure")
    it("successful imports remain available")
  })

  describe("AC#5: Background Processing", () => {
    it("persists progress to database")
    it("restores progress on page return")
    it("continues import after navigation")
  })

  describe("AC#6: Duplicate Detection", () => {
    it("detects duplicate by content hash")
    it("skips duplicate newsletters")
    it("shows skipped count")
    it("does not create duplicate userNewsletter")
  })
})
```

### Dependencies

**No new packages needed** - All functionality uses:
- `convex` - Queries, mutations, actions
- Existing shadcn/ui: Progress, Card, Button, Alert, Skeleton
- Existing Gmail API infrastructure
- Cloudflare R2 (via Convex actions)

**Verify Progress component exists:**
```bash
ls apps/web/src/components/ui/progress.tsx
# If not, add: npx shadcn@latest add progress
```

### References

- [Source: planning-artifacts/epics.md#Story 4.4] - Original requirements
- [Source: planning-artifacts/architecture.md#Convex Patterns] - Function naming, error handling
- [Source: project-context.md] - Critical rules and patterns
- [Source: 4-3-sender-review-approval.md] - Previous story implementation
- [Source: packages/backend/convex/gmailApi.ts] - Gmail API client
- [Gmail API Messages.get](https://developers.google.com/gmail/api/reference/rest/v1/users.messages/get) - Full message format
- [Gmail MIME types](https://developers.google.com/gmail/api/guides/overview#message-format)

## Code Review

### Review Date: 2026-01-24

### Reviewer: Claude Opus 4.5 (Adversarial Code Review)

### Issues Found & Fixed

| ID | Severity | Issue | Resolution |
|----|----------|-------|------------|
| H1 | HIGH | Empty File List in story | ✅ FIXED - Added complete file list |
| H2 | HIGH | Task 8 Tests not implemented | ✅ FIXED - 93 tests added (55 contract + 38 unit) |
| H3 | HIGH | Potential runtime import error | ✅ NOT AN ISSUE - Dynamic imports work correctly in Convex actions |
| H4 | HIGH | `pending` status never used | ✅ FIXED - Added documentation explaining reserved status + UI handling |
| H5 | HIGH | Content hash check missing in dedup | ✅ FIXED - Documented two-phase dedup approach (date+subject first, content hash in storeNewsletterContent) |
| M1 | MEDIUM | useState for loading violates rules | ✅ NOT AN ISSUE - useAction requires manual state tracking |
| M2 | MEDIUM | Checkbox type issue | ✅ FIXED - Added `=== true` check for type safety |
| M3 | MEDIUM | Unreachable "pending" UI state | ✅ FIXED - Added explicit pending state rendering |
| M4 | MEDIUM | No rate limit back-off | ✅ FIXED - Added exponential backoff retry helper for Gmail API |
| L1 | LOW | Console logging without levels | 📋 NOTED - Future improvement |
| L2 | LOW | Hardcoded batch size | 📋 NOTED - Future improvement |
| L3 | LOW | Undocumented behavior | ✅ FIXED - Added to Completion Notes |

### Code Changes Made During Review

1. **gmailApi.ts**: Added `withRateLimitRetry` helper with exponential backoff (1s, 2s, 4s)
2. **gmailApi.ts**: Wrapped `listGmailMessages`, `batchGetGmailMessages`, `batchGetFullGmailMessages` with retry
3. **SenderReview.tsx**: Fixed Checkbox `onCheckedChange` type coercion
4. **ImportProgress.tsx**: Added explicit "pending" state UI rendering
5. **schema.ts**: Added documentation for status enum values
6. **gmail.ts**: Added two-phase deduplication documentation
7. **story file**: Added complete File List and Completion Notes

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

### Completion Notes List

- Historical imports are marked as read automatically (intentional design decision)
- Duplicate detection uses two-phase approach: fast date+subject check, then content hash in storeNewsletterContent
- Task 8 tests implemented: 55 contract tests (gmail.import.test.ts), 38 unit tests (gmailApi.test.ts)
- Added exponential backoff retry for Gmail API rate limits (1s, 2s, 4s delays)

### File List

| File | Action | Purpose |
|------|--------|---------|
| `packages/backend/convex/schema.ts` | MODIFIED | Added `gmailImportProgress` table for tracking import state |
| `packages/backend/convex/gmail.ts` | MODIFIED | Added import mutations/queries: `initImportProgress`, `updateImportProgress`, `completeImport`, `getImportProgress`, `getApprovedSenders`, `startHistoricalImport`, `processAndStoreImportedEmail`, `checkEmailDuplicate`, `markImportedAsRead` |
| `packages/backend/convex/gmailApi.ts` | MODIFIED | Added `getFullMessageContents`, `listMessagesFromSender`, `extractHtmlBody`, `extractHeadersFromFullMessage`, `decodeBase64Url`, `findPartByMimeType` |
| `apps/web/src/routes/_authed/import/ImportProgress.tsx` | NEW | Progress display component with real-time updates via Convex subscription |
| `apps/web/src/routes/_authed/import/SenderReview.tsx` | MODIFIED | Added import trigger flow after approval (Task 7.1, 7.2) |
| `apps/web/src/routes/_authed/import/SenderScanner.tsx` | MODIFIED | Added "importing" view state and ImportProgress integration (Task 7.3) |
| `packages/backend/convex/gmail.import.test.ts` | NEW | Contract tests for import progress, dedup, sender creation, failure handling (Task 8) |
| `packages/backend/convex/gmailApi.test.ts` | NEW | Unit tests for email content extraction, MIME handling, rate limiting (Task 8.2) |
