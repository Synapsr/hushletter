# Story 2.2: Email Parsing & Content Storage

Status: done

## Story

As a **user receiving newsletters**,
I want **the system to parse and store my newsletter content**,
so that **I can read them later in the app**.

## Acceptance Criteria

**AC1: Email Parsing**
**Given** the email worker receives a newsletter email
**When** it parses the email
**Then** it extracts subject, sender email, sender name, date, HTML content, and plain text

**AC2: R2 Content Storage**
**Given** a newsletter is parsed successfully
**When** storing the content
**Then** the HTML body is uploaded to Cloudflare R2 via the Convex R2 component
**And** an R2 key is generated and stored with the newsletter metadata

**AC3: Newsletter Record Creation**
**Given** the newsletter metadata is ready
**When** the Convex mutation is called
**Then** a newsletter record is created in the newsletters table
**And** it includes userId, senderId (optional), subject, receivedAt (Unix timestamp), r2Key, isRead (false), isHidden (false)

**AC4: Plain Text Fallback**
**Given** a newsletter with only plain text (no HTML)
**When** it is processed
**Then** the plain text is stored and displayed correctly

## Tasks / Subtasks

- [x] Task 1: Install and configure Convex R2 component (AC: 2)
  - [x] Install `@convex-dev/r2` package in packages/backend
  - [x] Register R2 component in `convex.config.ts`
  - [x] Set R2 environment variables in Convex dashboard
  - [x] Create R2 client instance in `convex/r2.ts`

- [x] Task 2: Implement email parsing logic in email worker (AC: 1, 4)
  - [x] Create `src/emailParser.ts` with `parseEmail` function
  - [x] Use `postal-mime` library to parse raw email stream
  - [x] Extract: subject, from, date, html, text, attachments (metadata only)
  - [x] Handle multipart MIME correctly (prefer HTML, fallback to text)
  - [x] Sanitize HTML content to prevent XSS
  - [x] Add unit tests for email parsing

- [x] Task 3: Update email worker to send parsed content to Convex (AC: 1, 3)
  - [x] Modify `src/index.ts` to use emailParser
  - [x] Read raw email stream from `message.raw`
  - [x] Parse email content
  - [x] Send full payload (including HTML content) to Convex HTTP action

- [x] Task 4: Create Convex action to store content in R2 (AC: 2, 3)
  - [x] Create `storeNewsletterContent` action in newsletters.ts
  - [x] Use R2 component to upload HTML/text content
  - [x] Generate R2 key and store with newsletter record
  - [x] Handle upload errors gracefully

- [x] Task 5: Update Convex email ingestion to create newsletter (AC: 3)
  - [x] Update `emailIngestion.ts` to accept htmlContent field
  - [x] Call `storeNewsletterContent` action to upload to R2
  - [x] Call `createNewsletter` mutation with r2Key
  - [x] Update `newsletters.ts` mutation to store r2Key

- [x] Task 6: Add content retrieval with signed URLs (AC: 2, 3)
  - [x] Create `getNewsletterWithContent` query in newsletters.ts
  - [x] Use R2 component's `getUrl` to generate signed URL
  - [x] Include signed URL in query response
  - [x] Ensure privacy filtering is applied

- [x] Task 7: Testing and validation (AC: 1, 2, 3, 4)
  - [x] Add integration test for full email → Convex → R2 flow
  - [x] Test HTML email parsing
  - [x] Test plain text email fallback
  - [x] Test R2 upload via Convex component
  - [x] Verify newsletter record creation with r2Key

## Dev Notes

### CRITICAL IMPLEMENTATION GUARDRAILS

**CRITICAL: Use Convex R2 Component - NOT direct R2 binding in email worker!**

The correct architecture is:
1. Email Worker parses email and sends content to Convex
2. Convex action uses `@convex-dev/r2` component to upload to R2
3. This provides: type safety, signed URLs, unified API, better error handling

**DO NOT:**
- Add R2 bucket binding to email worker's wrangler.toml
- Upload directly from email worker to R2
- Create separate R2 storage utilities in email worker

### Epic 2 Context

Epic 2 builds the newsletter reception pipeline:
- Story 2.1 (DONE): Email Worker setup & basic reception
- Story 2.2 (THIS): Email parsing & content storage (R2 via Convex)
- Story 2.3: Automatic sender detection
- Story 2.4: Real-time newsletter display

### Previous Story Intelligence (Story 2.1)

**Key Learnings:**
1. Email worker structure is in `apps/email-worker/`
2. `ForwardableEmailMessage.raw` provides the raw email stream for parsing
3. Convex HTTP action at `/api/email/ingest` receives email data
4. Internal API key authentication is already implemented
5. User lookup by `dedicatedEmail` is working
6. `createNewsletter` mutation exists but needs expansion for r2Key

**Files from Story 2.1 (MODIFY, DO NOT RECREATE):**
- `apps/email-worker/src/index.ts` - Email handler (MODIFY for parsing)
- `apps/email-worker/src/convexClient.ts` - Convex calls (MODIFY for content)
- `packages/backend/convex/emailIngestion.ts` - HTTP action (MODIFY)
- `packages/backend/convex/newsletters.ts` - Mutations (MODIFY)
- `packages/backend/convex/schema.ts` - Schema has r2Key field ready

### Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **@convex-dev/r2** | Latest | Convex R2 component for storage |
| **postal-mime** | Latest | Email parsing in worker |
| **Convex** | 1.25.0+ | Database + R2 integration |

### Convex R2 Component Setup

**1. Install the component:**
```bash
cd packages/backend
pnpm add @convex-dev/r2
```

**2. Register in convex.config.ts:**
```typescript
// packages/backend/convex/convex.config.ts - MODIFY EXISTING
import { defineApp } from "convex/server"
import r2 from "@convex-dev/r2/convex.config.js"

const app = defineApp()
app.use(r2)
export default app
```

**3. Set environment variables (via Convex dashboard):**
```bash
npx convex env set R2_TOKEN "your-api-token"
npx convex env set R2_ACCESS_KEY_ID "your-access-key"
npx convex env set R2_SECRET_ACCESS_KEY "your-secret-key"
npx convex env set R2_ENDPOINT "https://your-account.r2.cloudflarestorage.com"
npx convex env set R2_BUCKET "newsletter-content"
```

**4. Create R2 client:**
```typescript
// packages/backend/convex/r2.ts - NEW FILE
import { R2 } from "@convex-dev/r2"
import { components } from "./_generated/api"

export const r2 = new R2(components.r2)
```

### Email Parser (Email Worker)

```typescript
// apps/email-worker/src/emailParser.ts - NEW FILE
import PostalMime from "postal-mime"

export interface ParsedEmail {
  subject: string
  from: string
  senderName?: string
  date: Date
  html?: string
  text?: string
  hasAttachments: boolean
}

/**
 * Parse raw email stream into structured data
 */
export async function parseEmail(rawStream: ReadableStream<Uint8Array>): Promise<ParsedEmail> {
  const reader = rawStream.getReader()
  const chunks: Uint8Array[] = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }

  const emailBuffer = new Uint8Array(
    chunks.reduce((acc, chunk) => acc + chunk.length, 0)
  )
  let offset = 0
  for (const chunk of chunks) {
    emailBuffer.set(chunk, offset)
    offset += chunk.length
  }

  const parser = new PostalMime()
  const email = await parser.parse(emailBuffer)

  return {
    subject: email.subject || "(no subject)",
    from: email.from?.address || "",
    senderName: email.from?.name,
    date: email.date ? new Date(email.date) : new Date(),
    html: email.html,
    text: email.text,
    hasAttachments: (email.attachments?.length ?? 0) > 0,
  }
}

/**
 * Sanitize HTML content to prevent XSS
 */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/javascript:/gi, "")
}

/**
 * Get storable content - prefer HTML, fallback to text
 */
export function getStorableContent(parsed: ParsedEmail): {
  content: string
  contentType: "html" | "text"
} {
  if (parsed.html) {
    return { content: sanitizeHtml(parsed.html), contentType: "html" }
  }
  return { content: parsed.text || "", contentType: "text" }
}
```

### Updated Email Worker

```typescript
// apps/email-worker/src/index.ts - MODIFY EXISTING
import type { Env } from "./types"
import { callConvex } from "./convexClient"
import { parseEmail, getStorableContent } from "./emailParser"

export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const toAddress = message.to
    const fromAddress = message.from

    console.log(`[Email Worker] Received email to: ${toAddress}`)

    try {
      // Parse the raw email content
      const parsed = await parseEmail(message.raw)
      console.log(`[Email Worker] Parsed: "${parsed.subject}"`)

      // Get the content to store
      const { content, contentType } = getStorableContent(parsed)

      // Send everything to Convex - R2 upload happens there
      const result = await callConvex(env, {
        to: toAddress,
        from: fromAddress,
        subject: parsed.subject,
        senderName: parsed.senderName,
        receivedAt: parsed.date.getTime(),
        htmlContent: contentType === "html" ? content : undefined,
        textContent: contentType === "text" ? content : undefined,
      })

      if (result.success) {
        console.log(`[Email Worker] Newsletter created: ${result.newsletterId}`)
      } else {
        console.log(`[Email Worker] Processing returned: ${result.error}`)
      }
    } catch (error) {
      console.error("[Email Worker] Failed to process email:", error)
    }
  },
}
```

### Convex R2 Storage Action

```typescript
// packages/backend/convex/newsletters.ts - ADD TO EXISTING
import { action, internalMutation, query } from "./_generated/server"
import { internal } from "./_generated/api"
import { v } from "convex/values"
import { r2 } from "./r2"

/**
 * Store newsletter content in R2 and create newsletter record
 * Called from emailIngestion HTTP action
 */
export const storeNewsletterContent = action({
  args: {
    userId: v.id("users"),
    subject: v.string(),
    senderEmail: v.string(),
    senderName: v.optional(v.string()),
    receivedAt: v.number(),
    htmlContent: v.optional(v.string()),
    textContent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const content = args.htmlContent || args.textContent || ""
    const contentType = args.htmlContent ? "text/html" : "text/plain"

    // Generate unique key
    const timestamp = Date.now()
    const ext = args.htmlContent ? "html" : "txt"
    const key = `${args.userId}/${timestamp}-${crypto.randomUUID()}.${ext}`

    // Upload to R2 via Convex component
    const blob = new Blob([content], { type: `${contentType}; charset=utf-8` })
    await r2.store(ctx, blob, { key, type: contentType })

    // Create newsletter record with r2Key
    const newsletterId = await ctx.runMutation(internal.newsletters.createNewsletter, {
      userId: args.userId,
      subject: args.subject,
      senderEmail: args.senderEmail,
      senderName: args.senderName,
      receivedAt: args.receivedAt,
      r2Key: key,
    })

    return { newsletterId, r2Key: key }
  },
})

/**
 * Create newsletter record (internal mutation)
 */
export const createNewsletter = internalMutation({
  args: {
    userId: v.id("users"),
    subject: v.string(),
    senderEmail: v.string(),
    senderName: v.optional(v.string()),
    receivedAt: v.number(),
    r2Key: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("newsletters", {
      userId: args.userId,
      subject: args.subject,
      senderEmail: args.senderEmail,
      senderName: args.senderName,
      receivedAt: args.receivedAt,
      r2Key: args.r2Key,
      isRead: false,
      isHidden: false,
      isPrivate: false,
    })
  },
})

/**
 * Get newsletter with signed R2 URL for content
 */
export const getNewsletterWithContent = query({
  args: { newsletterId: v.id("newsletters") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Not authenticated" })
    }

    const newsletter = await ctx.db.get(args.newsletterId)
    if (!newsletter) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Newsletter not found" })
    }

    // Privacy check
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()

    if (!user) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "User not found" })
    }

    if (newsletter.isPrivate && newsletter.userId !== user._id) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" })
    }

    // Generate signed URL for R2 content (expires in 1 hour)
    let contentUrl: string | null = null
    if (newsletter.r2Key) {
      contentUrl = await r2.getUrl(newsletter.r2Key, { expiresIn: 3600 })
    }

    return { ...newsletter, contentUrl }
  },
})

/**
 * List newsletters for current user
 */
export const listNewsletters = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", identity.subject))
      .first()

    if (!user) return []

    return await ctx.db
      .query("newsletters")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect()
  },
})
```

### Updated Email Ingestion HTTP Action

```typescript
// packages/backend/convex/emailIngestion.ts - MODIFY receiveEmail handler
// After user validation, call the storeNewsletterContent action:

// ... existing validation code ...

// Store content and create newsletter
const result = await ctx.runAction(internal.newsletters.storeNewsletterContent, {
  userId: user._id,
  subject: validatedSubject,
  senderEmail: validatedFrom,
  senderName: validatedSenderName,
  receivedAt: validatedReceivedAt,
  htmlContent: body.htmlContent as string | undefined,
  textContent: body.textContent as string | undefined,
})

return new Response(
  JSON.stringify({ success: true, userId: user._id, newsletterId: result.newsletterId }),
  { status: 200, headers: { "Content-Type": "application/json" } }
)
```

### Anti-Patterns to Avoid

```typescript
// ❌ DON'T upload from email worker directly
// wrangler.toml:
// [[r2_buckets]]
// binding = "NEWSLETTER_CONTENT"  // WRONG - don't do this

// ✅ DO use Convex R2 component
await r2.store(ctx, blob, { key, type: contentType })

// ❌ DON'T return raw r2Key to client without signed URL
return { r2Key: newsletter.r2Key }

// ✅ DO generate signed URLs
const contentUrl = await r2.getUrl(newsletter.r2Key, { expiresIn: 3600 })
return { ...newsletter, contentUrl }

// ❌ DON'T skip privacy filtering
const all = await ctx.db.query("newsletters").collect()

// ✅ DO filter by user
if (newsletter.isPrivate && newsletter.userId !== user._id) {
  throw new ConvexError({ code: "FORBIDDEN", message: "Access denied" })
}
```

### Project Structure Notes

**Files to Create:**
- `apps/email-worker/src/emailParser.ts` - Email parsing utilities
- `apps/email-worker/src/emailParser.test.ts` - Parser tests
- `packages/backend/convex/r2.ts` - R2 client instance

**Files to Modify:**
- `apps/email-worker/src/index.ts` - Add parsing, send content to Convex
- `apps/email-worker/src/convexClient.ts` - Add htmlContent/textContent fields
- `apps/email-worker/package.json` - Add postal-mime dependency
- `packages/backend/convex/convex.config.ts` - Register R2 component
- `packages/backend/convex/emailIngestion.ts` - Handle content, call action
- `packages/backend/convex/newsletters.ts` - Add R2 storage action, queries
- `packages/backend/package.json` - Add @convex-dev/r2 dependency

### Dependencies

**Email Worker (apps/email-worker/package.json):**
```json
{
  "dependencies": {
    "postal-mime": "^2.4.1"
  }
}
```

**Backend (packages/backend/package.json):**
```json
{
  "dependencies": {
    "@convex-dev/r2": "latest"
  }
}
```

### Environment Variables

| Variable | Location | Purpose |
|----------|----------|---------|
| `CONVEX_URL` | Cloudflare Worker secrets | URL to Convex |
| `INTERNAL_API_KEY` | Cloudflare Worker + Convex | Authentication |
| `R2_TOKEN` | Convex env | R2 API token |
| `R2_ACCESS_KEY_ID` | Convex env | R2 credentials |
| `R2_SECRET_ACCESS_KEY` | Convex env | R2 credentials |
| `R2_ENDPOINT` | Convex env | R2 service URL |
| `R2_BUCKET` | Convex env | Bucket name |

### R2 Setup in Cloudflare

1. Create bucket: `newsletter-content` in Cloudflare Dashboard
2. Create API token with "Object Read & Write" permissions
3. Set environment variables in Convex dashboard
4. Configure CORS for client-side content fetch

### Testing

**Unit Tests:**
- Email parsing with HTML content
- Email parsing with plain text only
- HTML sanitization
- R2 key generation format

**Integration Tests:**
- Full flow: raw email → parse → Convex → R2 → query with URL
- Verify newsletter record has r2Key populated
- Verify signed URL works for content retrieval

### References

- [Source: Convex R2 Component] - https://www.convex.dev/components/cloudflare-r2
- [Source: architecture.md#Newsletter Storage Pattern] - R2 + Convex storage
- [Source: project-context.md#Convex Patterns] - Query patterns, privacy
- [Source: 2-1-email-worker-setup-basic-reception.md] - Previous story
- [Source: postal-mime] - https://github.com/nicmz/postal-mime

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Convex deployment successful after R2 environment variables configured
- All 110 tests pass (78 backend + 32 email worker) after code review fixes
- Pre-existing TypeScript errors in auth.ts and http.ts not related to this story

### Completion Notes List

- Installed @convex-dev/r2 and postal-mime packages
- Created email parser with full MIME parsing, HTML sanitization (XSS prevention), and plain text fallback
- Implemented storeNewsletterContent action that uploads to R2 and creates newsletter record atomically
- Added getNewsletterWithContent query with signed URL generation (1 hour expiry) and privacy filtering
- Added listNewsletters query for user's newsletters
- Updated emailIngestion HTTP action to validate content fields and call R2 storage action
- Updated email worker to parse raw email stream and send parsed content to Convex
- All acceptance criteria satisfied:
  - AC1: Email parsing extracts subject, sender, date, HTML/text content
  - AC2: R2 storage via Convex component with generated keys
  - AC3: Newsletter records include all required fields with r2Key
  - AC4: Plain text fallback when no HTML present

### File List

**New Files:**
- apps/email-worker/src/emailParser.ts
- apps/email-worker/src/emailParser.test.ts
- packages/backend/convex/r2.ts
- packages/backend/convex/newsletters.test.ts
- packages/backend/convex/_internal/users.ts

**Modified Files:**
- apps/email-worker/src/index.ts
- apps/email-worker/src/convexClient.ts
- apps/email-worker/src/convexClient.test.ts
- apps/email-worker/src/types.ts
- apps/email-worker/package.json
- packages/backend/convex/convex.config.ts
- packages/backend/convex/emailIngestion.ts
- packages/backend/convex/emailIngestion.test.ts
- packages/backend/convex/newsletters.ts
- packages/backend/package.json
- pnpm-lock.yaml

### Change Log

- 2026-01-24: Story 2.2 implementation complete - email parsing, R2 storage, newsletter creation
- 2026-01-24: Code review fixes applied:
  - Created newsletters.test.ts with 16+ tests for newsletter functions
  - Converted getNewsletterWithContent to action (r2.getUrl requires action context)
  - Added getNewsletter query for metadata-only access
  - Added error handling for R2 store/getUrl operations
  - Added contentStatus field ("available" | "missing" | "error") to newsletter responses
  - Enhanced HTML sanitization (iframe, object, embed, form, meta, base, svg, vbscript)
  - Changed random ID from Math.random() to crypto.randomUUID()
  - Added findByAuthId internal query to _internal/users.ts
  - Updated File List with missing files
