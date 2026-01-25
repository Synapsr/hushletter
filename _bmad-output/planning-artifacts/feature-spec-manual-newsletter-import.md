# Feature Spec: Manual Newsletter Import

## Problem Statement

Users receive newsletters across multiple email providers (Gmail, ProtonMail, Outlook, etc.). Currently, only Gmail has automated import. Users with other providers have no way to bring their newsletters into Hushletter.

## Solution

Provide two manual import methods that work with any email provider:

1. **Drag-and-drop `.eml` files** directly into the app
2. **Forward emails** to a dedicated import address (`import@hushletter.com`)

## User Flows

### Flow A: Drag-and-Drop Import

1. User exports `.eml` file(s) from their email client
2. User drags file(s) onto the Hushletter import zone
3. System parses email(s) and extracts content
4. System matches sender to existing newsletter source (or creates new)
5. Newsletter(s) appear in user's library

### Flow B: Email Forwarding

1. User forwards newsletter to `import@hushletter.com` (from their registered email)
2. Email worker receives and processes the forwarded email
3. System extracts the original newsletter from the forwarded message
4. System matches sender to existing newsletter source (or creates new)
5. Newsletter appears in user's library

## Data Extracted

- Sender name & email address
- Subject line
- Date received (original, not forward date)
- Body content (HTML + plain text fallback)
- Inline images
- Attachments (if any)

## Business Rules

| Scenario | Behavior |
|----------|----------|
| Sender matches existing newsletter source | Merge into existing source |
| Sender doesn't match any source | Auto-create new newsletter source |
| Duplicate email detected (same message ID or content hash) | Reject silently, don't import |
| Bulk import (.eml) | Process all files, report success/failure count |
| Forwarded email from unregistered address | Reject (security) |

## Acceptance Criteria

- [ ] User can drag-and-drop single `.eml` file and see it imported
- [ ] User can drag-and-drop multiple `.eml` files (bulk import)
- [ ] User can forward email to `import@hushletter.com` and see it imported
- [ ] Imported newsletters display identically to Gmail-imported ones
- [ ] Duplicate emails are not imported (no error shown to user)
- [ ] New newsletter sources are auto-created when sender is unknown
- [ ] Existing newsletter sources receive imported emails correctly
- [ ] Forward-to-import only works from user's registered email address(es)

## Out of Scope

- `.mbox` file support (future enhancement)
- Copy-paste HTML import
- Editing/correcting extracted data before import
- Import from URL/RSS

## Technical Notes

- Leverage existing email worker infrastructure
- Reuse existing sender matching/merge logic
- Consider rate limiting on forward-to-import to prevent abuse
