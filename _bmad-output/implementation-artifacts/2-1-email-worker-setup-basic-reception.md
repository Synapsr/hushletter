# Story 2.1: Email Worker Setup & Basic Reception

Status: done

## Story

As a **user with a dedicated email address**,
I want **the system to receive emails sent to my address**,
so that **my newsletters are captured by the platform**.

## Acceptance Criteria

**AC1: Email Worker Deployed & Functional**
**Given** the email worker is deployed
**When** an email is sent to a user's dedicated address
**Then** the email worker receives and acknowledges the email
**And** no emails are lost (NFR9)

**AC2: Project Structure Compliance**
**Given** the monorepo structure exists
**When** reviewing the email-worker app
**Then** it follows the Architecture structure under apps/email-worker
**And** wrangler.toml is properly configured

**AC3: Worker → Convex Communication**
**Given** the email worker receives an email
**When** it processes the incoming message
**Then** it calls the Convex HTTP endpoint with the email data
**And** authenticates using the internal API key

**AC4: Invalid Address Handling**
**Given** an email arrives for an unknown/invalid user address
**When** the worker processes it
**Then** the email is rejected or logged appropriately
**And** no error crashes the worker

## Tasks / Subtasks

- [x] Task 1: Create email-worker app in monorepo (AC: 2)
  - [x] Create apps/email-worker directory structure
  - [x] Configure wrangler.toml for Cloudflare Email Workers
  - [x] Add package.json with correct dependencies
  - [x] Configure TypeScript for worker runtime
  - [x] Add to Turborepo workspace

- [x] Task 2: Implement email reception handler (AC: 1)
  - [x] Create src/index.ts with email worker entry point
  - [x] Handle EmailMessage event from Cloudflare
  - [x] Extract envelope data (from, to, date)
  - [x] Parse email headers (subject, sender name)
  - [x] Implement basic logging for debugging

- [x] Task 3: Implement worker → Convex communication (AC: 3)
  - [x] Create src/convexClient.ts for Convex integration
  - [x] Add environment variable for CONVEX_URL
  - [x] Add internal API key authentication (INTERNAL_API_KEY)
  - [x] Create HTTP action in Convex for receiving email data
  - [x] Add packages/backend/convex/emailIngestion.ts for inbound email handling

- [x] Task 4: Add user lookup and validation (AC: 4)
  - [x] Lookup user by dedicated email address in Convex
  - [x] Return appropriate response for unknown addresses
  - [x] Handle errors gracefully without crashing worker
  - [x] Add logging for rejected emails

- [x] Task 5: Add Convex schema updates for newsletters (AC: 1, 3)
  - [x] Add newsletters table to schema.ts
  - [x] Add senders table to schema.ts
  - [x] Add appropriate indexes for querying
  - [x] Create basic createNewsletter mutation (placeholder for Story 2.2)

- [x] Task 6: Local development & testing setup (AC: 1, 2)
  - [x] Add wrangler dev configuration
  - [x] Document local testing with email simulation
  - [x] Add basic unit tests for email parsing

## Dev Notes

### CRITICAL IMPLEMENTATION GUARDRAILS

**This is the FIRST story in Epic 2 - Email Infrastructure foundation!**

Epic 2 builds the newsletter reception pipeline:
- Story 2.1 (this): Email Worker setup & basic reception
- Story 2.2: Email parsing & content storage (R2)
- Story 2.3: Automatic sender detection
- Story 2.4: Real-time newsletter display

**This story focuses ONLY on:**
1. Creating the email-worker app structure
2. Receiving emails and calling Convex
3. User address validation
4. NOT parsing content or storing to R2 (that's Story 2.2)

### Previous Story Intelligence (from Story 1.5)

**Key Learnings from Epic 1:**
1. Monorepo uses pnpm workspaces with Turborepo
2. Convex mutations use `ConvexError` for user-actionable errors
3. Internal helpers go in `convex/_internal/` directory
4. Tests are colocated with source files (*.test.ts)
5. Users table has `dedicatedEmail` field for email address lookup

**Files Created in Epic 1 (DO NOT RECREATE):**
- `packages/backend/convex/schema.ts` - Has users table with dedicatedEmail index
- `packages/backend/convex/auth.ts` - Better Auth integration
- `packages/backend/convex/http.ts` - HTTP router (MODIFY to add email endpoint)
- `packages/backend/convex/users.ts` - User mutations
- `packages/backend/convex/_internal/emailGeneration.ts` - Dedicated email generation

### Technology Stack References

| Technology | Version | Notes |
|------------|---------|-------|
| **Cloudflare Workers** | Latest | Email Workers runtime |
| **Cloudflare Email Routing** | Latest | Inbound email handling |
| **Convex** | 1.25.0+ | HTTP actions for worker communication |
| **wrangler** | Latest | Cloudflare Workers CLI |
| **TypeScript** | Strict mode | Worker-compatible types |

### Architecture Compliance Requirements

[Source: architecture.md#Monorepo Structure]
```
apps/
└── email-worker/           # Cloudflare Email Worker
    ├── src/
    │   ├── index.ts       # Worker entry point
    │   ├── emailHandler.ts    # Email parsing logic
    │   ├── r2Storage.ts       # R2 upload utilities (Story 2.2)
    │   ├── convexClient.ts    # Convex mutation calls
    │   └── types.ts           # Email-specific types
    ├── wrangler.toml
    └── package.json
```

### Email Worker Entry Point Pattern

[Source: architecture.md#API & Communication Patterns]
```typescript
// apps/email-worker/src/index.ts
import type { EmailMessage, ForwardableEmailMessage } from "cloudflare:email";
import { callConvex } from "./convexClient";

export interface Env {
  CONVEX_URL: string;
  INTERNAL_API_KEY: string;
  // R2 bucket will be added in Story 2.2
}

export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    const toAddress = message.to;
    const fromAddress = message.from;
    const subject = message.headers.get("subject") || "(no subject)";

    console.log(`Received email to: ${toAddress} from: ${fromAddress}`);

    try {
      // Call Convex to process the email
      await callConvex(env, {
        to: toAddress,
        from: fromAddress,
        subject,
        rawEmail: message.raw, // Will be parsed in Story 2.2
        receivedAt: Date.now(),
      });
    } catch (error) {
      console.error("Failed to process email:", error);
      // Don't throw - we don't want to reject the email
      // Log for debugging but accept delivery
    }
  },
};
```

### Convex HTTP Action Pattern

[Source: architecture.md#Communication Patterns]
```typescript
// packages/backend/convex/emailIngestion.ts - NEW FILE
import { httpAction } from "./_generated/server";
import { v } from "convex/values";

// Internal API key validation
const validateApiKey = (request: Request, env: any): boolean => {
  const apiKey = request.headers.get("X-Internal-API-Key");
  return apiKey === process.env.INTERNAL_API_KEY;
};

export const receiveEmail = httpAction(async (ctx, request) => {
  // Validate internal API key
  if (!validateApiKey(request, ctx)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json();
  const { to, from, subject, rawEmail, receivedAt } = body;

  // Lookup user by dedicated email address
  const user = await ctx.runQuery(internal.users.findByDedicatedEmail, {
    dedicatedEmail: to,
  });

  if (!user) {
    console.log(`No user found for address: ${to}`);
    return new Response(JSON.stringify({ error: "Unknown recipient" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // For Story 2.1, just acknowledge receipt
  // Story 2.2 will add parsing and storage
  console.log(`Email received for user ${user._id}: ${subject}`);

  return new Response(JSON.stringify({ success: true, userId: user._id }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
```

### Wrangler Configuration

```toml
# apps/email-worker/wrangler.toml
name = "newsletter-manager-email-worker"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
# These are set via wrangler secret or dashboard
# CONVEX_URL = "https://your-deployment.convex.cloud"
# INTERNAL_API_KEY = "your-secret-key"

# Email routing configuration
# The actual email routing is configured in Cloudflare dashboard
# This worker receives emails routed to it
```

### Schema Updates Required

```typescript
// packages/backend/convex/schema.ts - ADD TO EXISTING
// Newsletters table - for storing received newsletters
newsletters: defineTable({
  userId: v.id("users"),
  senderId: v.optional(v.id("senders")), // Will be set in Story 2.3
  subject: v.string(),
  senderEmail: v.string(),
  senderName: v.optional(v.string()),
  receivedAt: v.number(), // Unix timestamp ms
  r2Key: v.optional(v.string()), // Will be set in Story 2.2
  isRead: v.boolean(),
  isHidden: v.boolean(),
  isPrivate: v.boolean(),
  // Reading progress (Story 3.4)
  readProgress: v.optional(v.number()), // 0-100 percentage
})
  .index("by_userId", ["userId"])
  .index("by_userId_receivedAt", ["userId", "receivedAt"])
  .index("by_senderId", ["senderId"]),

// Senders table - for organizing newsletters by sender
senders: defineTable({
  email: v.string(),
  name: v.optional(v.string()),
  domain: v.string(),
  isPrivate: v.boolean(),
  // Users who have received newsletters from this sender
  userIds: v.array(v.id("users")),
})
  .index("by_email", ["email"])
  .index("by_domain", ["domain"]),
```

### HTTP Route Registration

```typescript
// packages/backend/convex/http.ts - MODIFY EXISTING
import { emailIngestion } from "./emailIngestion";

// Add email ingestion endpoint
http.route({
  path: "/api/email/ingest",
  method: "POST",
  handler: emailIngestion.receiveEmail,
});
```

### Internal Query for User Lookup

```typescript
// packages/backend/convex/_internal/users.ts - NEW FILE (or add to existing)
import { internalQuery } from "../_generated/server";
import { v } from "convex/values";

export const findByDedicatedEmail = internalQuery({
  args: { dedicatedEmail: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_dedicatedEmail", (q) => q.eq("dedicatedEmail", args.dedicatedEmail))
      .first();
  },
});
```

### Anti-Patterns to Avoid

```typescript
// ❌ Don't crash the worker on errors
export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    // This would reject the email, potentially losing it
    throw new Error("Processing failed");
  }
}

// ✅ Handle errors gracefully, log and continue
export default {
  async email(message: ForwardableEmailMessage, env: Env): Promise<void> {
    try {
      await processEmail(message, env);
    } catch (error) {
      console.error("Failed to process email:", error);
      // Accept delivery, log for investigation
    }
  }
}

// ❌ Don't expose internal API keys in response
return new Response(JSON.stringify({ key: env.INTERNAL_API_KEY }));

// ✅ Never include secrets in responses
return new Response(JSON.stringify({ success: true }));

// ❌ Don't use snake_case in Convex
sender_email: v.string()

// ✅ Use camelCase consistently
senderEmail: v.string()
```

### Project Structure Notes

**Alignment with Architecture:**
- New app: `apps/email-worker/` - Following architecture structure
- New file: `packages/backend/convex/emailIngestion.ts` - HTTP action for email reception
- Modify: `packages/backend/convex/http.ts` - Add email endpoint route
- Modify: `packages/backend/convex/schema.ts` - Add newsletters and senders tables
- New file: `packages/backend/convex/_internal/users.ts` - Internal user queries

**Files to Create:**
- `apps/email-worker/package.json`
- `apps/email-worker/tsconfig.json`
- `apps/email-worker/wrangler.toml`
- `apps/email-worker/src/index.ts`
- `apps/email-worker/src/types.ts`
- `apps/email-worker/src/convexClient.ts`
- `packages/backend/convex/emailIngestion.ts`
- `packages/backend/convex/_internal/users.ts`

**Files to Modify:**
- `packages/backend/convex/schema.ts` - Add newsletters and senders tables
- `packages/backend/convex/http.ts` - Add email ingestion route
- `pnpm-workspace.yaml` - Add email-worker to workspace (if needed)
- `turbo.json` - Add email-worker to pipeline (if needed)

### Dependencies for Email Worker

```json
{
  "name": "@newsletter-manager/email-worker",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "tail": "wrangler tail"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20241230.0",
    "wrangler": "^3.99.0",
    "typescript": "^5.7.0"
  }
}
```

### Environment Variables Required

| Variable | Location | Purpose |
|----------|----------|---------|
| `CONVEX_URL` | Cloudflare Worker secrets | URL to Convex deployment |
| `INTERNAL_API_KEY` | Cloudflare Worker secrets + Convex env | Authentication between worker and Convex |

### Cloudflare Email Routing Setup

1. **Domain Configuration:** Configure email routing in Cloudflare dashboard
2. **Catch-All Route:** Route `*@yourdomain.com` to the email worker
3. **Worker Binding:** Email worker receives routed emails automatically

### Testing This Story

**Manual Testing Checklist:**
```bash
# 1. Verify email-worker builds
cd apps/email-worker
pnpm build

# 2. Verify local dev works
pnpm dev

# 3. Use wrangler to simulate email (or test with real email)
# Cloudflare provides email simulation tools

# 4. Check Convex logs for email receipt
# View in Convex dashboard

# 5. Test invalid address rejection
# Send email to non-existent user address
# Verify appropriate response (404 or rejection)

# 6. Test error handling
# Simulate Convex being unavailable
# Verify email still accepted (not rejected/bounced)
```

**Unit Tests to Write:**
- Email address extraction from EmailMessage
- Convex client authentication header construction
- Error handling (worker doesn't crash)

### Git Commit Pattern

From recent commits:
```
feat: Complete Stories 1.4 & 1.5 with code review fixes
```

**Use for this story:**
```
feat: Add Email Worker for newsletter reception (Story 2.1)
```

### References

- [Source: architecture.md#Monorepo Structure] - apps/email-worker structure
- [Source: architecture.md#API & Communication Patterns] - Email Worker → Convex flow
- [Source: architecture.md#Infrastructure & Deployment] - Cloudflare deployment
- [Source: project-context.md#Convex Patterns] - Function naming, schema patterns
- [Source: epics.md#Story 2.1] - Original acceptance criteria
- [Source: packages/backend/convex/schema.ts] - Current schema with users table
- [Source: Cloudflare Email Workers Docs] - https://developers.cloudflare.com/email-routing/email-workers/

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Convex codegen successful
- All 32 tests pass (24 backend + 8 email-worker)

### Completion Notes List

- Created email-worker app structure following architecture spec under apps/email-worker
- Implemented email handler using ForwardableEmailMessage from @cloudflare/workers-types
- Created convexClient.ts with API key authentication and extractSenderName helper
- Added emailIngestion.ts HTTP action for receiving email data with API key validation
- Created internal users query for dedicated email lookup
- Updated schema.ts with newsletters and senders tables with appropriate indexes
- Created newsletters.ts with createNewsletter internal mutation placeholder
- Updated http.ts with /api/email/ingest endpoint
- Added vitest configuration and unit tests for convexClient (8 tests pass)
- Worker handles errors gracefully without crashing (emails accepted even on failures)

### File List

**Created:**
- apps/email-worker/package.json
- apps/email-worker/tsconfig.json
- apps/email-worker/wrangler.toml
- apps/email-worker/vitest.config.ts
- apps/email-worker/src/index.ts
- apps/email-worker/src/types.ts
- apps/email-worker/src/convexClient.ts
- apps/email-worker/src/convexClient.test.ts
- packages/backend/convex/emailIngestion.ts
- packages/backend/convex/emailIngestion.test.ts
- packages/backend/convex/newsletters.ts
- packages/backend/convex/_internal/users.ts

**Modified:**
- packages/backend/convex/schema.ts (added newsletters and senders tables)
- packages/backend/convex/http.ts (added email ingestion route)

### Change Log

- 2026-01-24: Story 2.1 implementation complete - Email Worker setup with Convex integration
- 2026-01-24: Code review fixes applied - Added input validation, tests for emailIngestion, updated wrangler compatibility date

## Senior Developer Review (AI)

### Review Date: 2026-01-24

**Reviewer:** Claude Opus 4.5 (Adversarial Code Review)

### Issues Found & Fixed

| Severity | Issue | Resolution |
|----------|-------|------------|
| HIGH | No tests for emailIngestion HTTP action | Added `emailIngestion.test.ts` with 14 tests for validation helpers |
| MEDIUM | Unused `EmailPayload.rawEmail` field with no context | Added JSDoc comments explaining future use in Story 2.2 |
| MEDIUM | Missing input validation in emailIngestion | Added `validateEmail`, `validateSubject`, `validateReceivedAt` helpers with proper type checking, length limits, and format validation |
| LOW | Wrangler compatibility date outdated (2024-01-01) | Updated to 2025-01-01 |

### Issues Deferred

| Severity | Issue | Reason |
|----------|-------|--------|
| MEDIUM | `createNewsletter` mutation never called | Intentionally a placeholder for Story 2.2 as documented |
| LOW | Inconsistent logging prefixes | Cosmetic; not blocking |

### Test Results Post-Fix

- Backend: 38 tests passing (was 24, added 14 for emailIngestion validation)
- Email Worker: 8 tests passing

### Verdict: APPROVED

All acceptance criteria verified. Code quality issues addressed. Ready for merge.

