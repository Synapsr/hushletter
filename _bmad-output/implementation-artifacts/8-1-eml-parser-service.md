# Story 8.1: EML Parser Service

Status: done

## Story

As a **developer**,
I want **a service that parses `.eml` files and extracts newsletter data**,
so that **users can import newsletters from any email client**.

## Acceptance Criteria

1. **Given** a valid `.eml` file is provided, **When** the parser processes the file, **Then** it extracts sender name, sender email, subject line, and received date, **And** it extracts HTML body content (with plain text fallback), **And** it extracts inline images and attachments.

2. **Given** an `.eml` file with only plain text content, **When** the parser processes the file, **Then** the plain text is extracted successfully, **And** HTML body is null or empty.

3. **Given** an `.eml` file with embedded images (Content-ID references), **When** the parser processes the file, **Then** inline images are extracted and preserved, **And** Content-ID references are resolved correctly.

4. **Given** a malformed or invalid `.eml` file, **When** the parser attempts to process it, **Then** a structured error is returned (not a crash), **And** the error indicates what was wrong (e.g., "Invalid MIME format").

5. **Given** the parser extracts a date, **When** storing the newsletter, **Then** the original received date is used (not the current import time), **And** the date is stored as Unix timestamp (per Architecture patterns).

## Tasks / Subtasks

- [x] Task 1: Create EML parser utility in shared package (AC: #1, #2, #3, #4, #5)
  - [x] 1.1: Create `packages/shared/src/utils/emlParser.ts` with type definitions
  - [x] 1.2: Implement `parseEmlFile()` function using PostalMime (same library as email worker)
  - [x] 1.3: Implement `extractMessageId()` for duplicate detection
  - [x] 1.4: Add error handling for malformed files with structured `EmlParseError` type
  - [x] 1.5: Handle date extraction with Unix timestamp conversion
  - [x] 1.6: Export parser from `packages/shared/src/index.ts`

- [x] Task 2: Handle inline images and Content-ID references (AC: #3)
  - [x] 2.1: Implement `resolveInlineImages()` to convert CID references to base64 data URIs
  - [x] 2.2: Handle common image MIME types (image/png, image/jpeg, image/gif, image/webp)
  - [x] 2.3: Gracefully skip unresolvable CID references

- [x] Task 3: Add EML-specific types to shared package (AC: #1)
  - [x] 3.1: Create `packages/shared/src/types/eml.ts` with ParsedEml interface
  - [x] 3.2: Define EmlParseError type for structured error responses
  - [x] 3.3: Export types from package index

- [x] Task 4: Write comprehensive tests (AC: #1, #2, #3, #4, #5)
  - [x] 4.1: Create test fixtures (valid .eml, plain-text only, with CID images, malformed)
  - [x] 4.2: Write unit tests for `parseEmlFile()` function
  - [x] 4.3: Write unit tests for `resolveInlineImages()` function
  - [x] 4.4: Write unit tests for error handling scenarios
  - [x] 4.5: Test date extraction and Unix timestamp conversion

## Dev Notes

### Architecture Compliance

This story creates a foundational utility that will be used by:
- **Story 8.2**: Drag-and-drop UI (client-side parsing for preview)
- **Story 8.3**: Forward-to-import endpoint (server-side parsing)
- **Story 8.4**: Duplicate detection (via messageId extraction)

### Reuse Existing Email Parsing

The email worker already uses PostalMime for parsing. Key file to reference:
- `apps/email-worker/src/emailParser.ts`

This contains:
- `parseEmail()` - Uses PostalMime to parse raw email streams
- `sanitizeHtml()` - XSS sanitization (remove script tags, event handlers, etc.)
- `getStorableContent()` - Prefers HTML with plain text fallback

**DO NOT DUPLICATE** - Extract shared logic or import directly.

### PostalMime Library

PostalMime is already a project dependency used in the email worker:
```typescript
import PostalMime from 'postal-mime'
```

Key capabilities:
- Parses MIME multipart messages
- Extracts headers (From, Subject, Date, Message-ID)
- Handles Content-ID (CID) references for inline images
- Returns attachments array with content as Uint8Array

### File Structure

Create these new files:
```
packages/shared/
├── src/
│   ├── types/
│   │   └── eml.ts           # NEW: EML-specific types
│   ├── utils/
│   │   └── emlParser.ts     # NEW: EML parser utility
│   └── index.ts             # UPDATE: Export new utilities
```

### Key Interfaces

```typescript
// packages/shared/src/types/eml.ts

export interface ParsedEml {
  messageId: string | null          // For duplicate detection
  subject: string
  senderEmail: string
  senderName: string | null
  receivedAt: number                // Unix timestamp (ms)
  htmlContent: string | null        // Sanitized HTML
  textContent: string | null        // Plain text fallback
  inlineImages: InlineImage[]       // Resolved CID images
  attachments: EmlAttachment[]      // Non-inline attachments
}

export interface InlineImage {
  contentId: string                 // CID reference
  mimeType: string
  data: string                      // Base64 encoded
}

export interface EmlAttachment {
  filename: string
  mimeType: string
  size: number
  data: Uint8Array
}

export interface EmlParseError {
  code: 'INVALID_FORMAT' | 'MISSING_REQUIRED_FIELD' | 'DATE_PARSE_ERROR' | 'CONTENT_ERROR'
  message: string
  field?: string
}

export type EmlParseResult =
  | { success: true; data: ParsedEml }
  | { success: false; error: EmlParseError }
```

### Content-ID (CID) Resolution

EML files with inline images use CID references:
```html
<img src="cid:image001.png@01D12345.ABCD1234">
```

The parser must:
1. Find all `cid:*` references in HTML content
2. Match CID to attachment's Content-ID header
3. Replace with base64 data URI: `data:image/png;base64,...`

Example implementation:
```typescript
function resolveInlineImages(html: string, attachments: Attachment[]): string {
  const cidMap = new Map<string, string>()

  for (const att of attachments) {
    if (att.contentId) {
      const cleanCid = att.contentId.replace(/^<|>$/g, '')
      const base64 = Buffer.from(att.content).toString('base64')
      cidMap.set(cleanCid, `data:${att.mimeType};base64,${base64}`)
    }
  }

  return html.replace(/src="cid:([^"]+)"/gi, (match, cid) => {
    const dataUri = cidMap.get(cid)
    return dataUri ? `src="${dataUri}"` : match
  })
}
```

### Date Extraction

EML files contain the Date header in RFC 2822 format:
```
Date: Tue, 15 Jan 2026 10:30:00 -0500
```

Convert to Unix timestamp:
```typescript
function extractReceivedDate(dateString: string): number {
  const parsed = new Date(dateString)
  if (isNaN(parsed.getTime())) {
    throw new EmlParseError('DATE_PARSE_ERROR', `Invalid date: ${dateString}`)
  }
  return parsed.getTime() // Unix timestamp in milliseconds
}
```

### Sender Extraction

The From header can have multiple formats:
```
From: john@example.com
From: John Doe <john@example.com>
From: "John Doe" <john@example.com>
```

PostalMime normalizes this to:
```typescript
{ address: string, name?: string }
```

### Error Handling Pattern

Use structured errors matching Convex patterns:
```typescript
export class EmlParseError extends Error {
  constructor(
    public code: EmlParseError['code'],
    message: string,
    public field?: string
  ) {
    super(message)
    this.name = 'EmlParseError'
  }
}
```

### Security Considerations

1. **XSS Prevention**: Use existing `sanitizeHtml()` from email worker
2. **File Size Limits**: Enforce 10MB max file size before parsing
3. **Attachment Limits**: Cap total attachment size at 50MB
4. **Image Limits**: Cap inline images at 10 per email

### Testing Strategy

**Test Fixtures to Create:**
1. `valid-simple.eml` - Basic newsletter with HTML content
2. `valid-plaintext.eml` - Text-only email
3. `valid-with-images.eml` - Email with CID inline images
4. `valid-with-attachments.eml` - Email with PDF attachment
5. `malformed-no-headers.eml` - Missing required headers
6. `malformed-bad-mime.eml` - Invalid MIME structure
7. `edge-case-nested-multipart.eml` - Deeply nested MIME parts

### Project Structure Notes

- Create files in `packages/shared/` (NOT in apps/web or apps/email-worker)
- Parser should work in both browser (drag-drop preview) and Node.js (server processing)
- Use isomorphic approach - avoid Node-specific APIs
- PostalMime works in browsers and Node.js

### Naming Conventions (per Architecture)

- File names: camelCase (`emlParser.ts`)
- Exported functions: camelCase (`parseEmlFile`, `resolveInlineImages`)
- Types: PascalCase (`ParsedEml`, `EmlParseError`)
- Constants: SCREAMING_SNAKE_CASE (`MAX_FILE_SIZE`, `MAX_ATTACHMENTS`)

### Dependencies to Add

```bash
# Already installed in email-worker, may need to add to shared package
pnpm --filter shared add postal-mime
```

### References

- [Source: apps/email-worker/src/emailParser.ts] - Existing PostalMime usage
- [Source: apps/email-worker/src/types.ts] - ParsedEmail interface
- [Source: _bmad-output/planning-artifacts/architecture.md#Implementation-Patterns] - Naming conventions
- [Source: _bmad-output/planning-artifacts/epics.md#Story-8.1] - Story acceptance criteria
- [Source: _bmad-output/planning-artifacts/feature-spec-manual-newsletter-import.md] - Feature specification

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None - implementation proceeded without issues.

### Completion Notes List

- Created comprehensive EML parser utility in shared package using PostalMime (same library as email worker)
- Implemented isomorphic base64 encoding that works in both browser and Node.js environments
- Parser extracts: messageId, subject, senderEmail, senderName, receivedAt (Unix timestamp), htmlContent, textContent, inlineImages, attachments
- CID references in HTML are automatically resolved to base64 data URIs
- XSS sanitization applied to all HTML content (script tags, event handlers, javascript: URLs, iframes, etc.)
- Structured error handling with specific error codes: INVALID_FORMAT, MISSING_REQUIRED_FIELD, DATE_PARSE_ERROR, CONTENT_ERROR, FILE_TOO_LARGE, TOO_MANY_ATTACHMENTS
- Security limits enforced: 10MB max file size, 50MB max attachment size, 10 max inline images
- 59 unit tests covering all acceptance criteria pass (after code review fixes)

### File List

**New Files:**
- packages/shared/src/types/eml.ts
- packages/shared/src/utils/emlParser.ts
- packages/shared/src/utils/emlParser.test.ts
- packages/shared/src/utils/__fixtures__/valid-simple.eml
- packages/shared/src/utils/__fixtures__/valid-plaintext.eml
- packages/shared/src/utils/__fixtures__/valid-with-images.eml
- packages/shared/src/utils/__fixtures__/valid-with-attachments.eml
- packages/shared/src/utils/__fixtures__/malformed-no-headers.eml
- packages/shared/src/utils/__fixtures__/malformed-bad-mime.eml
- packages/shared/src/utils/__fixtures__/edge-case-nested-multipart.eml

**Modified Files:**
- packages/shared/src/types/index.ts (added eml export)
- packages/shared/src/utils/index.ts (added emlParser exports)
- packages/shared/package.json (added postal-mime, @types/node dependencies, vitest devDependency, test scripts)
- apps/email-worker/src/emailParser.ts (import sanitizeHtml from shared package - DRY)
- apps/email-worker/package.json (added @newsletter-manager/shared workspace dependency)
- pnpm-lock.yaml (updated dependencies)
- _bmad-output/implementation-artifacts/sprint-status.yaml (status: review → done)

### Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5
**Date:** 2026-01-25
**Outcome:** APPROVED (after fixes)

**Issues Found & Fixed:**

| Severity | Issue | Resolution |
|----------|-------|------------|
| HIGH | H1: Code duplication - sanitizeHtml copied from email-worker | Fixed: email-worker now imports from shared package |
| HIGH | H2: Missing test fixture FILES (only inline strings) | Fixed: Created 7 .eml fixture files in __fixtures__ directory |
| HIGH | H3: Weak CID test assertion (>=0 passes with zero images) | Fixed: Strengthened to require >=1 image and verify structure |
| MEDIUM | M1: Future date rejection too strict (24h) | Fixed: Increased to 7 days, added documentation |
| MEDIUM | M2: No tests for ArrayBuffer/base64 edge cases | Fixed: Added 4 new edge case tests |
| MEDIUM | M3: Security constants export gap | Noted: EML_PARSE_DEFAULTS exported, Story 8.2 can use it |
| MEDIUM | M4: No nested MIME structure test | Fixed: Added edge-case-nested-multipart.eml fixture and test |
| LOW | L1: ESLint disable comment (project uses oxlint) | Fixed: Replaced with proper type annotation |
| LOW | L2: Inconsistent error code naming | Noted: Minor style issue, not blocking |

**Tests:** 59 passing (12 new tests added)
**TypeScript:** Clean (no errors)
**Build:** Email-worker builds successfully with shared package import

### Change Log

- 2026-01-25: Story 8.1 implemented - EML parser service with 47 passing tests
- 2026-01-25: Code review completed - 9 issues found, 7 fixed, 59 tests now passing
