# Story 8.3: Forward-to-Import Endpoint

Status: done

## Story

As a **user with newsletters in any email provider**,
I want **to forward emails to `import@hushletter.com`**,
so that **I can import newsletters without exporting files**.

## Acceptance Criteria

1. **Given** the forward-to-import endpoint is deployed, **When** an email is forwarded to `import@hushletter.com`, **Then** the email worker receives and processes the forwarded message, **And** the original newsletter is extracted from the forwarded email.

2. **Given** a forwarded email arrives, **When** the system identifies the forwarding user, **Then** it checks if the "From" address matches a registered user's email, **And** if matched, the import proceeds for that user, **And** if not matched, the email is rejected (FR36 - security).

3. **Given** a forwarded email is from an unregistered address, **When** the email worker processes it, **Then** the email is rejected silently (no bounce to prevent information leakage), **And** an admin log entry is created for monitoring.

4. **Given** a valid forwarded email is processed, **When** extracting the original newsletter, **Then** the system unwraps the forwarded message structure, **And** extracts the original sender (not the forwarding user), **And** extracts the original date (not the forward date), **And** extracts the original subject (without "Fwd:" prefix).

5. **Given** the original newsletter is extracted, **When** storing the newsletter, **Then** it follows the same flow as drag-drop import, **And** sender matching/creation uses existing logic (Story 2.3), **And** the newsletter appears in the user's list in real-time.

6. **Given** rate limiting is enabled, **When** a user forwards more than 50 emails per hour, **Then** subsequent emails are queued or rate-limited, **And** the user is not notified of rate limiting (silent queue).

7. **Given** the email worker is deployed, **When** reviewing the configuration, **Then** `import@hushletter.com` routes to the email worker, **And** the worker has a dedicated handler for import emails (separate from dedicated address flow).

## Tasks / Subtasks

- [x] Task 1: Create import handler in email worker (AC: #1, #7)
  - [x] 1.1: Create `apps/email-worker/src/importHandler.ts` with forwarded email detection
  - [x] 1.2: Add routing logic in `index.ts` to detect `import@` addresses and route to import handler
  - [x] 1.3: Use PostalMime to parse the forwarded email structure
  - [x] 1.4: Handle both MIME-attached and inline-quoted forward formats

- [x] Task 2: Implement user lookup by registered email (AC: #2, #3)
  - [x] 2.1: Add `findByRegisteredEmail` query in `convex/_internal/users.ts`
  - [x] 2.2: Check if forwarding user's email matches any registered user's `email` field
  - [x] 2.3: Reject silently if user not found (return success but don't import - FR36)
  - [x] 2.4: Log rejected emails to delivery logs for admin monitoring

- [x] Task 3: Extract original newsletter from forwarded message (AC: #4)
  - [x] 3.1: Create `extractForwardedNewsletter()` function in `importHandler.ts`
  - [x] 3.2: Detect RFC 822 message/rfc822 attached original (MIME forward)
  - [x] 3.3: Detect inline-quoted forwards and extract headers (fallback parsing)
  - [x] 3.4: Strip "Fwd:", "Fw:", "Re:" prefixes from subject
  - [x] 3.5: Parse original sender from forwarded headers
  - [x] 3.6: Parse original date from forwarded headers (not forward date)

- [x] Task 4: Create Convex HTTP endpoint for import ingestion (AC: #5)
  - [x] 4.1: Add `/api/email/import` route in `convex/http.ts`
  - [x] 4.2: Create `receiveImportEmail` handler in `convex/importIngestion.ts`
  - [x] 4.3: Reuse sender matching from `internal.senders.getOrCreateSender`
  - [x] 4.4: Reuse content storage from `internal.newsletters.storeNewsletterContent`
  - [x] 4.5: Return success response with userNewsletterId

- [x] Task 5: Implement rate limiting (AC: #6)
  - [x] 5.1: Use Cloudflare Workers KV for rate limit tracking
  - [x] 5.2: Key: `import-rate:{userId}`, Value: count, TTL: 1 hour
  - [x] 5.3: Rate limit: 50 imports per hour per user
  - [x] 5.4: On rate limit hit, log but don't process (silent rejection)
  - [x] 5.5: Add rate limit counter increment after successful import

- [x] Task 6: Write tests (All ACs)
  - [x] 6.1: Unit tests for `importHandler.ts` (forward detection, extraction)
  - [x] 6.2: Unit tests for forwarded email parsing (MIME and inline formats)
  - [x] 6.3: Integration tests for Convex endpoint (user lookup, storage)
  - [x] 6.4: Unit tests for rate limiting logic

## Dev Notes

### Architecture Compliance

**Email Worker Files:**
```
apps/email-worker/src/
├── index.ts                    # MODIFY - Add import@ routing
├── importHandler.ts            # NEW - Forward-to-import processing
├── importHandler.test.ts       # NEW - Tests
├── emailParser.ts              # EXISTING - Reuse for parsing
├── convexClient.ts             # EXISTING - Reuse for Convex calls
└── types.ts                    # MODIFY - Add import-specific types
```

**Convex Backend:**
```
packages/backend/convex/
├── http.ts                     # MODIFY - Add /api/email/import route
├── importIngestion.ts          # NEW - Import-specific HTTP action
├── _internal/
│   └── users.ts                # MODIFY - Add findByRegisteredEmail query
├── senders.ts                  # EXISTING - Reuse getOrCreateSender
└── newsletters.ts              # EXISTING - Reuse storeNewsletterContent
```

### Email Worker Routing Pattern (index.ts)

The email worker already routes based on email address. Add import detection:

```typescript
// In apps/email-worker/src/index.ts
import { handleImportEmail } from "./importHandler"

export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const toAddress = message.to
    const fromAddress = message.from

    // Route import@ emails to dedicated handler
    if (toAddress.startsWith("import@")) {
      console.log(`[Email Worker] Import email from: ${fromAddress}`)
      await handleImportEmail(message, env)
      return
    }

    // Existing dedicated address handling continues below...
    // ... existing code ...
  },
}
```

### Forwarded Email Structure Detection

Forwarded emails come in two formats that must both be handled:

**Format 1: MIME Attached (RFC 822)**
The original email is attached as `message/rfc822`:
```
Content-Type: multipart/mixed; boundary="..."

--boundary
Content-Type: text/plain
Here's the newsletter I mentioned...

--boundary
Content-Type: message/rfc822
Content-Disposition: attachment

[Original email as nested MIME]
```

**Format 2: Inline Quoted (Common in web clients)**
The original is quoted inline with headers:
```
Subject: Fwd: Weekly Tech Digest
From: user@example.com

---------- Forwarded message ---------
From: newsletter@techdigest.com
Date: Mon, Jan 20, 2026 at 10:00 AM
Subject: Weekly Tech Digest
To: user@example.com

[Original newsletter content]
```

### Import Handler Structure

```typescript
// apps/email-worker/src/importHandler.ts
import PostalMime from "postal-mime"
import type { Env } from "./types"
import { callConvex, extractSenderName, type ConvexConfig } from "./convexClient"

interface ExtractedNewsletter {
  originalFrom: string
  originalFromName?: string
  originalSubject: string
  originalDate: Date
  htmlContent?: string
  textContent?: string
}

/**
 * Handle email forwarded to import@hushletter.com
 * Extracts the original newsletter and imports it for the forwarding user
 */
export async function handleImportEmail(
  message: ForwardableEmailMessage,
  env: Env
): Promise<void> {
  const forwardingUserEmail = message.from

  console.log(`[Import] Processing forward from: ${forwardingUserEmail}`)

  try {
    // Get Convex config (import always uses prod)
    const convexConfig = getImportConvexConfig(env)
    if (!convexConfig) {
      console.log("[Import] No valid Convex config")
      return
    }

    // Step 1: Verify forwarding user is registered
    const userResult = await verifyForwardingUser(convexConfig, forwardingUserEmail)
    if (!userResult.found) {
      console.log(`[Import] Rejected - user not found: ${forwardingUserEmail}`)
      // Log for admin monitoring but don't bounce (security - no info leakage)
      await logRejectedImport(convexConfig, forwardingUserEmail, "USER_NOT_FOUND")
      return
    }

    // Step 2: Check rate limit
    const rateLimited = await checkRateLimit(env, userResult.userId)
    if (rateLimited) {
      console.log(`[Import] Rate limited: ${forwardingUserEmail}`)
      await logRejectedImport(convexConfig, forwardingUserEmail, "RATE_LIMITED")
      return
    }

    // Step 3: Parse the forwarded email
    const rawEmail = await readEmailStream(message.raw)
    const parsed = await new PostalMime().parse(rawEmail)

    // Step 4: Extract the original newsletter
    const newsletter = await extractForwardedNewsletter(parsed)
    if (!newsletter) {
      console.log(`[Import] Could not extract forwarded newsletter`)
      await logRejectedImport(convexConfig, forwardingUserEmail, "EXTRACTION_FAILED")
      return
    }

    // Step 5: Send to Convex for storage
    const result = await callConvexImport(convexConfig, {
      userId: userResult.userId,
      forwardingUserEmail,
      originalFrom: newsletter.originalFrom,
      originalFromName: newsletter.originalFromName,
      originalSubject: newsletter.originalSubject,
      originalDate: newsletter.originalDate.getTime(),
      htmlContent: newsletter.htmlContent,
      textContent: newsletter.textContent,
    })

    // Step 6: Increment rate limit counter on success
    if (result.success) {
      await incrementRateLimit(env, userResult.userId)
      console.log(`[Import] Success: ${result.userNewsletterId}`)
    }

  } catch (error) {
    console.error("[Import] Failed:", error)
    // Don't throw - we don't want to bounce the email
  }
}
```

### Extracting Forwarded Newsletter

```typescript
/**
 * Extract the original newsletter from a forwarded email
 * Handles both MIME-attached and inline-quoted formats
 */
async function extractForwardedNewsletter(
  parsed: PostalMime.Email
): Promise<ExtractedNewsletter | null> {

  // Strategy 1: Check for RFC 822 attached message
  const attachedOriginal = parsed.attachments?.find(
    att => att.mimeType === "message/rfc822"
  )

  if (attachedOriginal) {
    // Parse the attached original email
    const originalParser = new PostalMime()
    const original = await originalParser.parse(
      new Uint8Array(attachedOriginal.content as ArrayBuffer)
    )

    return {
      originalFrom: original.from?.address ?? "",
      originalFromName: original.from?.name,
      originalSubject: original.subject ?? "(no subject)",
      originalDate: original.date ? new Date(original.date) : new Date(),
      htmlContent: original.html,
      textContent: original.text,
    }
  }

  // Strategy 2: Parse inline-quoted forward
  return extractInlineForward(parsed)
}

/**
 * Extract forwarded content from inline-quoted format
 * Parses "---------- Forwarded message ---------" style forwards
 */
function extractInlineForward(
  parsed: PostalMime.Email
): ExtractedNewsletter | null {
  const body = parsed.text || parsed.html || ""

  // Common forward separators
  const forwardPatterns = [
    /---------- Forwarded message ---------/i,
    /-------- Original Message --------/i,
    /Begin forwarded message:/i,
    /----- Forwarded message from .+ -----/i,
  ]

  let forwardStart = -1
  for (const pattern of forwardPatterns) {
    const match = body.search(pattern)
    if (match !== -1) {
      forwardStart = match
      break
    }
  }

  if (forwardStart === -1) {
    // No forward marker found - might be simple prefix-only forward
    // Fall back to using the whole body but strip Fwd: from subject
    return {
      originalFrom: extractHeaderFromBody(body, "From") ?? "",
      originalFromName: undefined,
      originalSubject: stripForwardPrefix(parsed.subject ?? ""),
      originalDate: extractDateFromBody(body) ?? new Date(),
      htmlContent: parsed.html,
      textContent: parsed.text,
    }
  }

  // Extract headers from the forwarded section
  const forwardedSection = body.slice(forwardStart)

  return {
    originalFrom: extractHeaderFromBody(forwardedSection, "From") ?? "",
    originalFromName: undefined,
    originalSubject: extractHeaderFromBody(forwardedSection, "Subject")
      ?? stripForwardPrefix(parsed.subject ?? ""),
    originalDate: extractDateFromBody(forwardedSection) ?? new Date(),
    htmlContent: extractContentAfterHeaders(forwardedSection, parsed.html),
    textContent: extractContentAfterHeaders(forwardedSection, parsed.text),
  }
}

/**
 * Strip forward prefixes from subject
 */
function stripForwardPrefix(subject: string): string {
  return subject
    .replace(/^(Fwd|Fw|Re):\s*/gi, "")
    .replace(/^\[Fwd\]\s*/i, "")
    .trim()
}

/**
 * Extract a header value from forwarded message body text
 */
function extractHeaderFromBody(body: string, headerName: string): string | null {
  // Pattern: "From: name@example.com" or "From: Name <name@example.com>"
  const pattern = new RegExp(`^${headerName}:\\s*(.+)$`, "im")
  const match = body.match(pattern)

  if (!match) return null

  // For From header, extract email address
  if (headerName === "From") {
    const emailMatch = match[1].match(/<([^>]+)>/) || match[1].match(/([^\s<>]+@[^\s<>]+)/)
    return emailMatch ? emailMatch[1].trim() : match[1].trim()
  }

  return match[1].trim()
}

/**
 * Extract date from forwarded message body
 */
function extractDateFromBody(body: string): Date | null {
  // Pattern: "Date: Mon, Jan 20, 2026 at 10:00 AM" or RFC 2822 format
  const pattern = /^Date:\s*(.+)$/im
  const match = body.match(pattern)

  if (!match) return null

  try {
    return new Date(match[1])
  } catch {
    return null
  }
}
```

### Convex HTTP Endpoint for Import

```typescript
// packages/backend/convex/importIngestion.ts
import { httpAction } from "./_generated/server"
import { internal } from "./_generated/api"

/**
 * HTTP action to receive forwarded email imports
 * Similar to receiveEmail but looks up user by their registered email
 * instead of dedicated email address
 */
export const receiveImportEmail = httpAction(async (ctx, request) => {
  // Validate internal API key
  const apiKey = request.headers.get("X-Internal-API-Key")
  const expectedKey = process.env.INTERNAL_API_KEY

  if (!expectedKey || apiKey !== expectedKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  const body = await request.json()
  const {
    userId,
    forwardingUserEmail,
    originalFrom,
    originalFromName,
    originalSubject,
    originalDate,
    htmlContent,
    textContent,
  } = body

  // Validate user exists
  const user = await ctx.runQuery(internal._internal.users.findById, { userId })
  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }

  // Get or create sender (same as regular email flow)
  const sender = await ctx.runMutation(internal.senders.getOrCreateSender, {
    email: originalFrom,
    name: originalFromName,
  })

  // Get user sender settings for privacy
  const userSenderSettings = await ctx.runMutation(
    internal.senders.getOrCreateUserSenderSettings,
    {
      userId: user._id,
      senderId: sender._id,
    }
  )

  // Store newsletter content (same as regular email flow)
  const result = await ctx.runAction(internal.newsletters.storeNewsletterContent, {
    userId: user._id,
    senderId: sender._id,
    subject: originalSubject,
    senderEmail: originalFrom,
    senderName: originalFromName,
    receivedAt: originalDate,
    htmlContent,
    textContent,
    isPrivate: userSenderSettings.isPrivate,
  })

  return new Response(
    JSON.stringify({
      success: true,
      userNewsletterId: result.userNewsletterId,
      senderId: sender._id,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  )
})
```

### User Lookup by Registered Email

Add to `convex/_internal/users.ts`:

```typescript
/**
 * Find a user by their registered email address
 * Used by import handler to verify forwarding user is registered
 */
export const findByRegisteredEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    // Normalize email to lowercase for case-insensitive matching
    const normalizedEmail = args.email.toLowerCase()

    return await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", normalizedEmail))
      .first()
  },
})

/**
 * Find a user by their ID
 * Used for validation in import ingestion
 */
export const findById = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId)
  },
})
```

### Rate Limiting with Cloudflare Workers KV

```typescript
// In apps/email-worker/src/importHandler.ts

/**
 * Check if user is rate limited for imports
 * Uses Cloudflare Workers KV for distributed rate limiting
 */
async function checkRateLimit(env: Env, userId: string): Promise<boolean> {
  if (!env.IMPORT_RATE_LIMIT) {
    // KV namespace not configured - skip rate limiting
    return false
  }

  const key = `import-rate:${userId}`
  const count = await env.IMPORT_RATE_LIMIT.get(key)

  if (!count) return false

  return parseInt(count, 10) >= RATE_LIMIT_PER_HOUR
}

/**
 * Increment rate limit counter after successful import
 */
async function incrementRateLimit(env: Env, userId: string): Promise<void> {
  if (!env.IMPORT_RATE_LIMIT) return

  const key = `import-rate:${userId}`
  const current = await env.IMPORT_RATE_LIMIT.get(key)
  const count = current ? parseInt(current, 10) + 1 : 1

  // Set with 1 hour TTL
  await env.IMPORT_RATE_LIMIT.put(key, count.toString(), {
    expirationTtl: 3600, // 1 hour in seconds
  })
}

const RATE_LIMIT_PER_HOUR = 50
```

### Wrangler Configuration Update

Add to `apps/email-worker/wrangler.toml`:

```toml
# KV namespace for rate limiting (optional)
# Create with: wrangler kv:namespace create "IMPORT_RATE_LIMIT"
# [[kv_namespaces]]
# binding = "IMPORT_RATE_LIMIT"
# id = "YOUR_KV_NAMESPACE_ID"
```

### Types Update

Add to `apps/email-worker/src/types.ts`:

```typescript
export interface Env {
  // Production
  CONVEX_URL: string
  INTERNAL_API_KEY: string
  // Development (optional)
  CONVEX_URL_DEV?: string
  INTERNAL_API_KEY_DEV?: string
  // Rate limiting (optional)
  IMPORT_RATE_LIMIT?: KVNamespace
}

/**
 * Import-specific payload for Convex
 */
export interface ImportEmailPayload {
  userId: string
  forwardingUserEmail: string
  originalFrom: string
  originalFromName?: string
  originalSubject: string
  originalDate: number
  htmlContent?: string
  textContent?: string
}

/**
 * Response from Convex import endpoint
 */
export interface ConvexImportResponse {
  success: boolean
  userNewsletterId?: string
  senderId?: string
  error?: string
}
```

### Project Structure Notes

- Import handler in `apps/email-worker/src/importHandler.ts` - separate from main email flow
- Routing in `index.ts` checks for `import@` prefix before dedicated address handling
- Convex endpoint at `/api/email/import` - separate from `/api/email/ingest`
- Rate limiting via Cloudflare Workers KV (optional - degrades gracefully if not configured)
- User lookup by registered email, not dedicated email

### Previous Story Intelligence (Story 8.2)

From Story 8.2 code review:
- **Race condition fix:** Use queue.shift() instead of shared index variable
- **useEffect cleanup:** Added cancelledRef to prevent state updates after unmount
- **Keyboard accessibility:** Add role, tabIndex, onKeyDown handler
- **Error message map:** Include all parser error codes

Applicable learnings for Story 8.3:
- Silent rejection pattern for security (no bounce, no info leakage)
- Reuse existing `storeNewsletterContent` action - don't duplicate R2 upload logic
- Comprehensive error logging for admin monitoring

### Email Worker Pattern (from existing code)

The email worker follows this pattern:
1. Parse raw email stream
2. Get storable content (prefer HTML, fallback to text)
3. Call Convex endpoint with parsed data
4. Convex handles R2 upload and database operations

Import handler should follow the same pattern, with additional:
- User verification by registered email
- Forwarded message extraction
- Rate limiting

### Testing Approach

- Use Vitest (project standard)
- Mock PostalMime for unit tests
- Mock Cloudflare Workers KV for rate limit tests
- Test both MIME-attached and inline-quoted forward formats
- Test user lookup rejection scenarios

### Naming Conventions (per Architecture)

- Files: camelCase for non-component files (`importHandler.ts`, `importIngestion.ts`)
- Functions: camelCase (`extractForwardedNewsletter`, `checkRateLimit`)
- Types: PascalCase (`ImportEmailPayload`, `ExtractedNewsletter`)
- Convex tables: plural lowercase (`userNewsletters`)
- Convex fields: camelCase (`receivedAt`, `senderEmail`)

### Security Considerations (FR36)

- **Email verification:** Only process forwards from registered users
- **Silent rejection:** Don't bounce rejected emails (prevents email enumeration)
- **Admin logging:** Log all rejections for security monitoring
- **Rate limiting:** Prevent abuse of import endpoint

### References

- [Source: apps/email-worker/src/index.ts] - Existing email worker routing
- [Source: apps/email-worker/src/emailParser.ts] - Email parsing with PostalMime
- [Source: apps/email-worker/src/convexClient.ts] - Convex API call pattern
- [Source: packages/backend/convex/emailIngestion.ts] - Email ingestion HTTP action
- [Source: packages/backend/convex/http.ts] - HTTP routing configuration
- [Source: packages/backend/convex/_internal/users.ts] - User lookup queries
- [Source: packages/backend/convex/senders.ts] - Sender creation (getOrCreateSender)
- [Source: packages/backend/convex/newsletters.ts] - Newsletter storage (storeNewsletterContent)
- [Source: _bmad-output/planning-artifacts/epics.md#Story-8.3] - Story requirements
- [Source: _bmad-output/planning-artifacts/architecture.md] - Worker patterns
- [Source: _bmad-output/implementation-artifacts/8-2-drag-and-drop-import-ui.md] - Previous story learnings

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - Implementation completed successfully without blocking issues.

### Completion Notes List

- **Task 1:** Created `importHandler.ts` with comprehensive forwarded email detection. Handles both MIME-attached (RFC 822 message/rfc822) and inline-quoted forward formats (Gmail, Apple Mail, Outlook). Added routing in `index.ts` to detect `import@` addresses.

- **Task 2:** Implemented user lookup via `findByRegisteredEmail` and `findById` queries in `convex/_internal/users.ts`. Created three HTTP endpoints: `/api/email/import/verify-user`, `/api/email/import/log-rejection`, and `/api/email/import` for the full import flow.

- **Task 3:** Created `extractForwardedNewsletter()` function with two strategies: (1) MIME-attached original detection via message/rfc822, (2) inline-quoted forward parsing with header extraction. Strips "Fwd:", "Fw:", "Re:" prefixes from subjects.

- **Task 4:** Created `importIngestion.ts` with `receiveImportEmail` HTTP action. Reuses existing `getOrCreateSender`, `getOrCreateUserSenderSettings`, and `storeNewsletterContent` functions for consistent behavior with regular email flow.

- **Task 5:** Implemented rate limiting using Cloudflare Workers KV with 50 imports/hour/user limit. Rate limit is optional (degrades gracefully if KV not configured). Uses 1-hour TTL for automatic counter reset.

- **Task 6:** Created comprehensive test suites: 42 tests for importHandler.ts (forward detection, header extraction, rate limiting, API validation) and 28 tests for importIngestion.ts (validation, response structures). All tests pass.

### File List

**New Files:**
- `apps/email-worker/src/importHandler.ts` - Forward-to-import email processing
- `apps/email-worker/src/importHandler.test.ts` - 42 unit tests
- `packages/backend/convex/importIngestion.ts` - HTTP endpoints for import flow
- `packages/backend/convex/importIngestion.test.ts` - 28 unit tests

**Modified Files:**
- `apps/email-worker/src/index.ts` - Added import@ routing (isImportEmail function)
- `apps/email-worker/src/types.ts` - Added ImportEmailPayload, ConvexImportResponse, IMPORT_RATE_LIMIT KV
- `packages/backend/convex/http.ts` - Added 3 new routes for import endpoints
- `packages/backend/convex/_internal/users.ts` - Added findByRegisteredEmail and findById queries

## Change Log

- 2026-01-25: Initial implementation of forward-to-import endpoint (Story 8.3)
- 2026-01-25: Code review fixes - timing-safe API key comparison, email format validation, content requirement validation, rate limiting race condition mitigation with soft limit buffer, ReDoS prevention in regex patterns
- 2026-01-25: Code review round 2 fixes:
  - Added email format validation on forwarding user email (importHandler.ts)
  - Added max email size protection (25MB limit) in readEmailStream to prevent memory exhaustion
  - Moved SOFT_LIMIT_BUFFER to module-level constant
  - Fixed logRejection endpoint to properly set status to "failed" (calls updateDeliveryStatus)
  - Added documentation clarifying case-sensitivity assumption in findByRegisteredEmail
  - Improved tests to use exported _testing functions instead of duplicating logic
  - Added tests for email validation and size limit constants
  - Test count increased from 75 to 79

