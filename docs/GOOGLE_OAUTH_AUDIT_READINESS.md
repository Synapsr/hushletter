# Google OAuth Audit Readiness (Hushletter)

Last updated: February 21, 2026

## Goal
Prepare Hushletter for Google OAuth verification for Gmail import (`gmail.readonly`) with the cleanest possible least-privilege setup.

## What was changed in code

### 1) Login Google scope reduced to identity only
- File: `packages/backend/convex/auth.ts`
- Change: Removed `https://www.googleapis.com/auth/gmail.readonly` from the default Google sign-in provider.
- Why: Gmail access is now requested only when the user explicitly clicks **Connect Gmail**.

### 2) Gmail OAuth flow hardened for incremental consent
- File: `packages/backend/convex/gmailConnections.ts`
- Changes:
  - Added `include_granted_scopes=true`
  - Changed prompt to `consent select_account`
  - Added `login_hint` when available
- Why: improves compatibility with Google incremental authorization and multi-account consent UX.

### 3) Removed implicit Gmail auto-connect on import page
- File: `apps/web/src/routes/_authed/_navigation/import/-GmailConnect.tsx`
- Change: Removed automatic Better Auth Gmail connection attempt on page load.
- Why: keeps consent explicit and user-initiated, aligned with least privilege and verification expectations.

### 4) Legal links normalized
- File: `apps/web/src/components/landing/landing-footer.tsx`
- Change: links now point to `/privacy` and `/terms`.

### 5) Privacy policy strengthened for verification
- File: `apps/web/src/routes/{-$locale}/privacy.tsx`
- Updates include:
  - explicit OAuth scope usage
  - explicit Gmail read-only limitation
  - explicit Limited Use alignment
  - explicit no ads/no selling data/no generalized AI/ML training statement
  - user controls, retention and deletion details

### 6) Terms page aligned with Gmail access language
- File: `apps/web/src/routes/{-$locale}/terms.tsx`
- Updates include:
  - read-only Gmail usage limits
  - disconnect/revoke instructions
  - link to privacy policy

## Required Google Console configuration (must match code)

## OAuth consent / Data access
- User Type: `External` (if public users)
- App publishing status: `In production` only when ready
- Authorized domains: include your production domain
- Privacy Policy URL: `https://<your-domain>/privacy`
- Terms of Service URL: `https://<your-domain>/terms`

## Scopes to declare
- `openid`
- `email`
- `profile`
- `https://www.googleapis.com/auth/gmail.readonly`

## OAuth client settings
- Authorized redirect URIs must include exactly:
  - `https://<your-domain>/import/callback`

## API enablement
- Gmail API enabled in the same Google Cloud project as your OAuth client.

## Text to use in the verification form (<= 1000 chars)

Hushletter helps users import and organize newsletter emails from their own Gmail account. We request openid, email, and profile only to authenticate the user and identify which Google account is connected. We request https://www.googleapis.com/auth/gmail.readonly only after the user clicks “Connect Gmail.” We use it to read newsletter emails and import them into the user’s private Hushletter library for reading, organization, search, and optional summaries. We do not request write scopes, and we do not send, delete, or modify emails, labels, or mailbox settings. Metadata-only scopes are insufficient because we must access message body content to display and import newsletters. Data is used only for user-facing features with consent, never sold, and never used for ads. Users can disconnect Gmail and request deletion.

## Demo video checklist (YouTube unlisted)
Show all of these in one continuous flow:
1. Open app and sign in.
2. Open import page.
3. Click **Connect Gmail**.
4. Show Google consent screen with requested scopes.
5. Complete consent and return to app callback.
6. Show connected Gmail account in app.
7. Run newsletter scan/import flow.
8. Show where user disconnects Gmail.
9. Open `/privacy` and `/terms` pages in browser.

Notes:
- Voice-over is optional; captions/text overlays are enough.
- Keep video short (2-4 minutes), clear, and deterministic.

## CASA / security assessment note
Because `gmail.readonly` is a restricted Gmail scope, Google may require a CASA (independent security assessment) before final production approval. Plan budget/time for this if requested by Google.

## Pre-submission QA checklist
- [ ] Consent screen branding fully approved.
- [ ] Privacy/Terms URLs publicly accessible without auth.
- [ ] Redirect URI exactly matches code and console.
- [ ] No Gmail scope requested during plain sign-in.
- [ ] Gmail scope requested only from Connect Gmail flow.
- [ ] Gmail disconnect works and revokes token.
- [ ] Unverified warning disappears for approved users after verification is completed.

