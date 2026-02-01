---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - prd.md
  - architecture.md
  - feature-spec-manual-newsletter-import.md
workflowType: 'epics-and-stories'
project_name: 'newsletter manager'
user_name: 'Teogoulois'
date: '2026-01-25'
status: complete
completedAt: '2026-01-25'
---

# Newsletter Manager - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Newsletter Manager, decomposing the requirements from the PRD and Architecture into implementable stories.

## Requirements Inventory

### Functional Requirements

**User Management**
- FR1: Users can sign up for an account
- FR2: Users can log in and log out
- FR3: Users can receive a unique dedicated email address upon registration
- FR4: Users can view and manage their account settings

**Email Infrastructure**
- FR5: System can receive emails at user's dedicated address
- FR6: System can parse and store incoming newsletter content
- FR7: System can detect and identify newsletter senders automatically
- FR8: Users see new newsletters appear in real-time without refresh

**Gmail Import**
- FR9: Users can connect their Gmail account via OAuth
- FR10: System can scan Gmail for newsletter senders
- FR11: Users can review and approve detected newsletter senders
- FR12: System can import historical emails from approved senders
- FR13: Users can disconnect their Gmail account

**Newsletter Reading**
- FR14: Users can view all newsletters organized by sender
- FR15: Users can read newsletter content in a clean interface
- FR16: Users can browse newsletters by category/folder
- FR17: Users can mark newsletters as read
- FR18: Users can hide newsletters without unsubscribing

**AI Features**
- FR19: Users can generate an AI summary of any newsletter
- FR20: System displays summary alongside original content

**Community Database**
- FR21: Newsletters are shared to community database by default
- FR22: Users can mark specific senders as private (excluded from sharing)
- FR23: Users can access back-catalog of newsletters from community database
- FR24: New users can browse newsletters they haven't personally received

**Admin & Operations**
- FR25: Admin can view system health metrics
- FR26: Admin can monitor email delivery status
- FR27: Admin can review content flagged as private
- FR28: Admin can manage community database content

**Manual Newsletter Import**
- FR29: Users can drag-and-drop single `.eml` file and see it imported
- FR30: Users can drag-and-drop multiple `.eml` files (bulk import)
- FR31: Users can forward email to `import@hushletter.com` and see it imported
- FR32: Imported newsletters display identically to Gmail-imported ones
- FR33: Duplicate emails are not imported (no error shown to user)
- FR34: New newsletter sources are auto-created when sender is unknown
- FR35: Existing newsletter sources receive imported emails correctly
- FR36: Forward-to-import only works from user's registered email address(es)

### NonFunctional Requirements

**Performance**
- NFR1: Newsletter list loads within 1 second
- NFR2: Individual newsletter renders within 500ms
- NFR3: AI summary generates within 10 seconds
- NFR4: Real-time updates appear within 2 seconds of email receipt

**Security**
- NFR5: All data encrypted in transit (HTTPS)
- NFR6: OAuth tokens stored securely, never exposed to client
- NFR7: Private newsletters never synced to community database
- NFR8: User data handling complies with GDPR basics (delete on request)

**Reliability**
- NFR9: Email delivery has zero message loss (critical path)
- NFR10: System gracefully handles Gmail OAuth token expiry
- NFR11: AI summarization failures don't block reading experience

**Integration**
- NFR12: Gmail OAuth follows Google's current API requirements
- NFR13: Cloudflare Email Workers handle standard newsletter formats
- NFR14: Convex subscriptions maintain connection stability

### Additional Requirements

**From Architecture - Starter Template (CRITICAL FOR EPIC 1):**
- Project uses Turborepo monorepo structure
- TanStack Start for web application (SPA)
- Convex for database and real-time functionality
- Better Auth for authentication
- shadcn/ui + Base UI for components
- Cloudflare Email Workers for email handling
- Cloudflare R2 for newsletter content storage
- OpenRouter + Kimi K2 for AI summarization

**Infrastructure Requirements:**
- Turborepo workspace configuration
- Convex schema and function organization
- Cloudflare Pages deployment for web app
- Cloudflare Workers deployment for email handler
- R2 bucket setup for newsletter content storage
- GitHub Actions for CI/CD pipeline

**Integration Requirements:**
- Email Worker → Convex communication via HTTP actions with internal API key
- Client → Convex via WebSocket with Better Auth session
- AI summarization proxied through Convex server actions

**Implementation Pattern Requirements:**
- Privacy enforcement at query level (mandatory on all newsletter queries)
- ConvexError for user-actionable errors
- Unix timestamps for all date storage
- camelCase naming throughout
- Colocated test files

**Cross-Cutting Concerns:**
- Authentication & Authorization (user sessions + OAuth token management)
- Privacy Boundary Enforcement (public/private content separation)
- External Service Resilience (Gmail, AI, email services can fail independently)
- Real-Time Synchronization (Convex subscriptions consistency)
- Email Delivery Reliability (foundation layer - zero message loss)

### FR Coverage Map

| FR | Epic | Description |
|----|------|-------------|
| FR1 | Epic 1 | Users can sign up for an account |
| FR2 | Epic 1 | Users can log in and log out |
| FR3 | Epic 1 | Users can receive a unique dedicated email address upon registration |
| FR4 | Epic 1 | Users can view and manage their account settings |
| FR5 | Epic 2 | System can receive emails at user's dedicated address |
| FR6 | Epic 2 | System can parse and store incoming newsletter content |
| FR7 | Epic 2 | System can detect and identify newsletter senders automatically |
| FR8 | Epic 2 | Users see new newsletters appear in real-time without refresh |
| - | Epic 2.5 | **Enables FR21-24** via shared content architecture (deduplication, global senders) |
| FR9 | Epic 4 | Users can connect their Gmail account via OAuth |
| FR10 | Epic 4 | System can scan Gmail for newsletter senders |
| FR11 | Epic 4 | Users can review and approve detected newsletter senders |
| FR12 | Epic 4 | System can import historical emails from approved senders |
| FR13 | Epic 4 | Users can disconnect their Gmail account |
| FR14 | Epic 3 | Users can view all newsletters organized by sender |
| FR15 | Epic 3 | Users can read newsletter content in a clean interface |
| FR16 | Epic 3 | Users can browse newsletters by category/folder |
| FR17 | Epic 3 | Users can mark newsletters as read |
| FR18 | Epic 3 | Users can hide newsletters without unsubscribing |
| FR19 | Epic 5 | Users can generate an AI summary of any newsletter |
| FR20 | Epic 5 | System displays summary alongside original content |
| FR21 | Epic 6 | Newsletters are shared to community database by default |
| FR22 | Epic 6 | Users can mark specific senders as private (excluded from sharing) |
| FR23 | Epic 6 | Users can access back-catalog of newsletters from community database |
| FR24 | Epic 6 | New users can browse newsletters they haven't personally received |
| FR25 | Epic 7 | Admin can view system health metrics |
| FR26 | Epic 7 | Admin can monitor email delivery status |
| FR27 | Epic 7 | Admin can review content flagged as private |
| FR28 | Epic 7 | Admin can manage community database content |
| FR29 | Epic 8 | Users can drag-and-drop single `.eml` file and see it imported |
| FR30 | Epic 8 | Users can drag-and-drop multiple `.eml` files (bulk import) |
| FR31 | Epic 8 | Users can forward email to `import@hushletter.com` and see it imported |
| FR32 | Epic 8 | Imported newsletters display identically to Gmail-imported ones |
| FR33 | Epic 8 | Duplicate emails are not imported (no error shown to user) |
| FR34 | Epic 8 | New newsletter sources are auto-created when sender is unknown |
| FR35 | Epic 8 | Existing newsletter sources receive imported emails correctly |
| FR36 | Epic 8 | Forward-to-import only works from user's registered email address(es) |

## Epic List

### Epic 1: Project Foundation & User Onboarding
Users can create an account and receive their dedicated newsletter email address.

**FRs covered:** FR1, FR2, FR3, FR4

**Implementation Notes:**
- Turborepo + TanStack Start + Convex project initialization (per Architecture)
- Better Auth setup with email/password + Google OAuth
- Dedicated email address generation system

---

### Epic 2: Newsletter Reception & Real-Time Delivery
Newsletters sent to a user's dedicated address are received, parsed, and appear instantly in the app.

**FRs covered:** FR5, FR6, FR7, FR8

**Implementation Notes:**
- Cloudflare Email Workers for inbound email handling
- Cloudflare R2 for newsletter content storage
- Convex real-time subscriptions for instant updates
- Automatic sender detection and categorization

---

### Epic 2.5: Content Sharing Architecture
Refactor newsletter storage to support shared content for community discovery while maintaining privacy controls.

**FRs covered:** Enables FR21, FR22, FR23, FR24 (Community Database features)

**Implementation Notes:**
- Schema migration from per-user to shared content model
- Content deduplication via normalization and hashing
- Privacy-first design: private newsletters bypass deduplication entirely
- Global senders enable "X users subscribe to this" discovery
- Foundation for community back-catalog (Epic 6)

**Why This Epic Exists:**
The original per-user newsletter storage (Story 2.2) doesn't scale for community discovery features. This epic introduces a shared content model where:
- Public newsletter content is deduplicated (stored once, referenced by many)
- Private newsletters are stored per-user (maximum privacy isolation)
- Senders become global entities enabling cross-user statistics

---

### Epic 3: Newsletter Reading Experience
Users can read their newsletters in a clean, organized interface.

**FRs covered:** FR14, FR15, FR16, FR17, FR18

**Implementation Notes:**
- Clean reader view with proper HTML rendering
- Sender-based organization and folder/category browsing
- Read/unread state management
- Hide functionality (soft archive)

---

### Epic 4: Gmail Import
Users can import their existing newsletter subscriptions and history from Gmail.

**FRs covered:** FR9, FR10, FR11, FR12, FR13

**Implementation Notes:**
- Gmail OAuth integration via Better Auth
- Newsletter sender detection heuristics
- Bulk historical import with progress tracking
- Disconnect/revoke capability

---

### Epic 5: AI Summaries
Users can generate AI summaries to quickly understand newsletter content.

**FRs covered:** FR19, FR20

**Implementation Notes:**
- OpenRouter + Kimi K2 integration
- On-demand summarization (user-triggered)
- Summary displayed alongside original content
- Graceful failure handling (NFR11)

---

### Epic 6: Community Back-Catalog
Users can discover and access newsletters from the shared community database.

**FRs covered:** FR21, FR22, FR23, FR24

**Implementation Notes:**
- Privacy boundary enforcement (mandatory query filtering)
- Default public sharing with opt-out per sender
- Community browse interface
- Privacy controls in settings

---

### Epic 7: Admin & System Operations
Administrators can monitor system health and manage the platform.

**FRs covered:** FR25, FR26, FR27, FR28

**Implementation Notes:**
- Admin dashboard with health metrics
- Email delivery monitoring
- Privacy flag review tools
- Community content moderation

---

### Epic 8: Manual Newsletter Import
Users can import newsletters from any email provider via drag-and-drop `.eml` files or email forwarding.

**FRs covered:** FR29, FR30, FR31, FR32, FR33, FR34, FR35, FR36

**Implementation Notes:**
- Drag-and-drop `.eml` file import (single and bulk)
- Forward-to-import via `import@hushletter.com`
- Reuse existing email worker infrastructure and sender matching logic
- Duplicate detection via message ID or content hash
- Rate limiting on forward-to-import endpoint

---

## Epic 1: Project Foundation & User Onboarding

Users can create an account and receive their dedicated newsletter email address.

### Story 1.1: Project Initialization & Landing Page

**As a** developer,
**I want** a properly initialized monorepo with the core tech stack,
**So that** development can begin on a solid foundation.

**Acceptance Criteria:**

**Given** a developer clones the repository
**When** they run `pnpm install && pnpm dev`
**Then** the development server starts successfully
**And** the landing page is accessible at localhost

**Given** the project is initialized
**When** reviewing the project structure
**Then** it follows the Turborepo monorepo structure from Architecture
**And** apps/web contains TanStack Start with Convex integration
**And** packages/shared exists for shared types/utilities

**Given** the landing page is loaded
**When** a visitor views it
**Then** they see a marketing page explaining the newsletter manager
**And** there are clear calls-to-action for Sign Up and Login

---

### Story 1.2: User Registration

**As a** new user,
**I want** to create an account with my email and password,
**So that** I can start using the newsletter manager.

**Acceptance Criteria:**

**Given** I am on the signup page
**When** I enter a valid email and password (min 8 characters)
**Then** my account is created
**And** I am redirected to the authenticated area

**Given** I am on the signup page
**When** I enter an email that already exists
**Then** I see an error message "An account with this email already exists"
**And** I am not registered

**Given** I am on the signup page
**When** I enter an invalid email format
**Then** I see a validation error
**And** the form is not submitted

**Given** I am on the signup page
**When** I enter a password shorter than 8 characters
**Then** I see a validation error indicating password requirements

---

### Story 1.3: User Login & Logout

**As a** registered user,
**I want** to log in and log out of my account,
**So that** I can access my newsletters securely.

**Acceptance Criteria:**

**Given** I am a registered user on the login page
**When** I enter my correct email and password
**Then** I am authenticated and redirected to the newsletters page

**Given** I am on the login page
**When** I enter incorrect credentials
**Then** I see an error message "Invalid email or password"
**And** I remain on the login page

**Given** I am logged in
**When** I click the logout button
**Then** my session is terminated
**And** I am redirected to the landing page

**Given** I am not logged in
**When** I try to access an authenticated route (e.g., /newsletters)
**Then** I am redirected to the login page

---

### Story 1.4: Dedicated Email Address Generation

**As a** newly registered user,
**I want** to receive a unique dedicated email address upon registration,
**So that** I have a place to receive my newsletters separately from my personal inbox.

**Acceptance Criteria:**

**Given** I complete registration successfully
**When** my account is created
**Then** a unique dedicated email address is generated for me
**And** the format is `{username}@{domain}` or similar unique pattern

**Given** I am a registered user
**When** I view my dashboard or settings
**Then** I can see my dedicated email address displayed prominently
**And** there is a copy-to-clipboard button for easy copying

**Given** the system generates email addresses
**When** two users register
**Then** each user receives a unique, non-conflicting email address

---

### Story 1.5: Account Settings

**As a** logged-in user,
**I want** to view and manage my account settings,
**So that** I can update my profile and see my dedicated email address.

**Acceptance Criteria:**

**Given** I am logged in
**When** I navigate to the settings page
**Then** I see my account information (email, name if provided)
**And** I see my dedicated newsletter email address

**Given** I am on the settings page
**When** I update my display name
**Then** the change is saved
**And** I see a confirmation message

**Given** I am on the settings page
**When** I view my dedicated email section
**Then** I see instructions on how to use the dedicated address
**And** I can copy the address to clipboard

---

## Epic 2: Newsletter Reception & Real-Time Delivery

Newsletters sent to a user's dedicated address are received, parsed, and appear instantly in the app.

### Story 2.1: Email Worker Setup & Basic Reception

**As a** user with a dedicated email address,
**I want** the system to receive emails sent to my address,
**So that** my newsletters are captured by the platform.

**Acceptance Criteria:**

**Given** the email worker is deployed
**When** an email is sent to a user's dedicated address
**Then** the email worker receives and acknowledges the email
**And** no emails are lost (NFR9)

**Given** the monorepo structure exists
**When** reviewing the email-worker app
**Then** it follows the Architecture structure under apps/email-worker
**And** wrangler.toml is properly configured

**Given** the email worker receives an email
**When** it processes the incoming message
**Then** it calls the Convex HTTP endpoint with the email data
**And** authenticates using the internal API key

**Given** an email arrives for an unknown/invalid user address
**When** the worker processes it
**Then** the email is rejected or logged appropriately
**And** no error crashes the worker

---

### Story 2.2: Email Parsing & Content Storage

**As a** user receiving newsletters,
**I want** the system to parse and store my newsletter content,
**So that** I can read them later in the app.

**Acceptance Criteria:**

**Given** the email worker receives a newsletter email
**When** it parses the email
**Then** it extracts subject, sender email, sender name, date, HTML content, and plain text

**Given** a newsletter is parsed successfully
**When** storing the content
**Then** the HTML body is uploaded to Cloudflare R2
**And** an R2 key is generated and stored with the newsletter metadata

**Given** the newsletter metadata is ready
**When** the Convex mutation is called
**Then** a newsletter record is created in the newsletters table
**And** it includes userId, senderId, subject, receivedAt (Unix timestamp), r2Key, isRead (false), isHidden (false)

**Given** a newsletter with only plain text (no HTML)
**When** it is processed
**Then** the plain text is stored and displayed correctly

---

### Story 2.3: Automatic Sender Detection

**As a** user receiving newsletters,
**I want** the system to automatically detect and categorize senders,
**So that** my newsletters are organized without manual effort.

**Acceptance Criteria:**

**Given** a newsletter arrives from a new sender (globally)
**When** the system processes it
**Then** a new global `senders` record is created
**And** it captures sender email, sender name, and domain
**And** `subscriberCount` is set to 1
**And** `newsletterCount` is set to 1

**Given** a newsletter arrives from an existing global sender
**When** the system processes it
**Then** it links to the existing sender record
**And** no duplicate sender is created
**And** `newsletterCount` is incremented

**Given** a user receives from a sender for the first time
**When** the system processes the newsletter
**Then** a `userSenderSettings` record is created for that user/sender
**And** `isPrivate` defaults to false
**And** the sender's `subscriberCount` is incremented

**Given** a sender record exists
**When** viewing sender information
**Then** the sender name is displayed (or email if name unavailable)
**And** the domain is extracted correctly (e.g., "substack.com" from "newsletter@substack.com")
**And** `subscriberCount` shows how many users receive from this sender

**Given** a user has marked a sender as private in `userSenderSettings`
**When** new newsletters arrive from that sender
**Then** the newsletters are stored with `privateR2Key` (bypassing deduplication)
**And** the `userNewsletter.isPrivate` is set to true

**Implementation Notes (Epic 2.5 Schema):**
- Senders are now GLOBAL (shared across all users)
- User-specific sender preferences live in `userSenderSettings`
- Privacy is determined by `userSenderSettings.isPrivate`, not `senders.isPrivate`

---

### Story 2.4: Real-Time Newsletter Display

**As a** user with newsletters arriving,
**I want** to see new newsletters appear instantly without refreshing,
**So that** I always have the latest content available.

**Acceptance Criteria:**

**Given** I am logged in and viewing the newsletters page
**When** a new newsletter arrives at my dedicated address
**Then** it appears in my list within 2 seconds (NFR4)
**And** I do not need to refresh the page

**Given** the newsletters page is loaded
**When** viewing my newsletters
**Then** they are displayed in reverse chronological order (newest first)
**And** each item shows sender name, subject, and received date
**And** the data comes from the `userNewsletters` table (not old `newsletters` table)

**Given** I click on a newsletter to read it
**When** retrieving the content
**Then** the system checks if `contentId` is set (public newsletter)
**And** if public, fetches signed URL from `newsletterContent.r2Key`
**And** if private, fetches signed URL from `userNewsletters.privateR2Key`

**Given** Convex real-time subscriptions are active
**When** the connection is stable
**Then** updates are pushed automatically (NFR14)
**And** the UI reflects the current state

**Given** I have no newsletters yet
**When** I view the newsletters page
**Then** I see an empty state with instructions to use my dedicated email address

**Implementation Notes (Epic 2.5 Schema):**
- Query `userNewsletters` for user's newsletter list (denormalized fields for fast listing)
- For content retrieval: check `contentId` vs `privateR2Key` to determine R2 key source
- Join to `senders` table for additional sender metadata if needed

---

## Epic 2.5: Content Sharing Architecture

Refactor newsletter storage to support shared content for community discovery while maintaining privacy controls.

### Story 2.5.1: Shared Content Schema Implementation

**As a** developer,
**I want** to implement a shared content schema for newsletters,
**So that** public newsletters can be deduplicated and discovered by other users.

**Acceptance Criteria:**

**Given** the new schema is implemented
**When** reviewing the database structure
**Then** `newsletterContent` table exists for shared public content
**And** `userNewsletters` table exists for per-user newsletter relationships
**And** `senders` table is global (not user-scoped)
**And** `userSenderSettings` table exists for per-user sender preferences

**Given** the schema migration completes
**When** the system starts
**Then** the old `newsletters` table data is cleared (dev environment)
**And** existing code references are updated to new table names

**Given** the new schema is in place
**When** creating newsletter records
**Then** public newsletters reference `newsletterContent.contentId`
**And** private newsletters store content directly via `privateR2Key`

**Schema Definition:**
```typescript
// Shared content (deduplicated) - only for public newsletters
newsletterContent: defineTable({
  contentHash: v.string(),        // SHA-256 of normalized HTML
  r2Key: v.string(),
  subject: v.string(),
  senderEmail: v.string(),
  senderName: v.optional(v.string()),
  firstReceivedAt: v.number(),
  readerCount: v.number(),        // Denormalized count
})
  .index("by_contentHash", ["contentHash"])
  .index("by_senderEmail", ["senderEmail"])
  .index("by_readerCount", ["readerCount"]),

// Global sender registry
senders: defineTable({
  email: v.string(),
  name: v.optional(v.string()),
  domain: v.string(),
  subscriberCount: v.number(),
  newsletterCount: v.number(),
})
  .index("by_email", ["email"])
  .index("by_domain", ["domain"])
  .index("by_subscriberCount", ["subscriberCount"]),

// User's relationship to newsletters
userNewsletters: defineTable({
  userId: v.id("users"),
  senderId: v.id("senders"),
  contentId: v.optional(v.id("newsletterContent")),  // If public
  privateR2Key: v.optional(v.string()),              // If private
  subject: v.string(),
  senderEmail: v.string(),
  senderName: v.optional(v.string()),
  receivedAt: v.number(),
  isRead: v.boolean(),
  isHidden: v.boolean(),
  isPrivate: v.boolean(),
  readProgress: v.optional(v.number()),
})
  .index("by_userId", ["userId"])
  .index("by_userId_receivedAt", ["userId", "receivedAt"])
  .index("by_senderId", ["senderId"])
  .index("by_contentId", ["contentId"]),

// User's sender-specific settings
userSenderSettings: defineTable({
  userId: v.id("users"),
  senderId: v.id("senders"),
  isPrivate: v.boolean(),
  folderId: v.optional(v.id("folders")),
})
  .index("by_userId", ["userId"])
  .index("by_userId_senderId", ["userId", "senderId"]),
```

---

### Story 2.5.2: Content Deduplication Pipeline

**As a** user receiving newsletters,
**I want** the system to deduplicate public newsletter content,
**So that** storage is efficient and community discovery is enabled.

**Acceptance Criteria:**

**Given** an email arrives for a user
**When** the sender is NOT marked private for that user
**Then** the content is normalized and hashed
**And** the system checks if `newsletterContent` exists with that hash
**And** if exists, the existing `contentId` is used (readerCount incremented)
**And** if not exists, new `newsletterContent` is created with R2 upload

**Given** an email arrives for a user
**When** the sender IS marked private for that user
**Then** the content is uploaded to R2 with a user-specific key
**And** a `userNewsletter` is created with `privateR2Key` (no contentId)
**And** no `newsletterContent` record is created

**Given** content normalization is performed
**When** computing the content hash
**Then** tracking pixels are stripped
**And** unique unsubscribe links are normalized
**And** personalized greetings are normalized
**And** email-specific IDs are stripped
**And** whitespace is normalized

**Given** two users receive the same public newsletter
**When** both emails are processed
**Then** only one `newsletterContent` record exists
**And** both users have `userNewsletter` records referencing the same `contentId`
**And** `readerCount` equals 2

**Content Normalization Algorithm:**
```typescript
function normalizeForHash(html: string): string {
  return html
    .replace(/<img[^>]*tracking[^>]*>/gi, '')
    .replace(/href="[^"]*unsubscribe[^"]*"/gi, 'href="UNSUBSCRIBE"')
    .replace(/Hi \w+,/gi, 'Hi USER,')
    .replace(/[a-f0-9]{32,}/gi, 'HASH')
    .replace(/\s+/g, ' ')
    .trim()
}
```

---

## Epic 3: Newsletter Reading Experience

Users can read their newsletters in a clean, organized interface.

### Story 3.1: Newsletter List Organized by Sender

**As a** user with newsletters,
**I want** to view my newsletters organized by sender,
**So that** I can easily find content from specific sources.

**Acceptance Criteria:**

**Given** I am logged in and have newsletters
**When** I view the newsletters page
**Then** I see a sidebar listing all my senders
**And** each sender shows the count of newsletters from them

**Given** I am viewing the sender sidebar
**When** I click on a sender
**Then** the newsletter list filters to show only newsletters from that sender
**And** the selected sender is visually highlighted

**Given** I want to see all newsletters
**When** I click "All" or clear the sender filter
**Then** I see newsletters from all senders
**And** they remain sorted by date (newest first)

**Given** I have newsletters from multiple senders
**When** viewing the sender list
**Then** senders are sorted alphabetically or by most recent activity

---

### Story 3.2: Clean Newsletter Reader

**As a** user reading newsletters,
**I want** to read newsletter content in a clean, distraction-free interface,
**So that** I can focus on the content.

**Acceptance Criteria:**

**Given** I am on the newsletter list
**When** I click on a newsletter
**Then** I navigate to a clean reader view
**And** the newsletter content is rendered within 500ms (NFR2)

**Given** I am viewing a newsletter
**When** the content loads
**Then** the HTML is rendered safely (sanitized to prevent XSS)
**And** images and formatting are preserved

**Given** I am reading a newsletter
**When** I view the reader interface
**Then** I see the subject, sender name, and received date clearly
**And** the reading area uses clean typography optimized for long-form reading

**Given** I am in the reader view
**When** I want to return to the list
**Then** there is a clear back navigation
**And** my list position/filter is preserved

---

### Story 3.3: Folder & Category Browsing

**As a** user with many newsletters,
**I want** to browse newsletters by category or folder,
**So that** I can organize my reading by topic.

**Acceptance Criteria:**

**Given** I am logged in
**When** I navigate to folder management
**Then** I can create a new folder with a name

**Given** I have created folders
**When** I view a sender's settings or the sender list
**Then** I can assign a sender to a folder

**Given** senders are assigned to folders
**When** I browse by folder
**Then** I see all newsletters from senders in that folder

**Given** I have folders
**When** viewing the navigation
**Then** folders appear in the sidebar
**And** each folder shows the unread count

**Given** a sender is not assigned to any folder
**When** browsing
**Then** the sender appears in an "Uncategorized" or default view

---

### Story 3.4: Reading Progress & Mark as Read

**As a** user reading newsletters,
**I want** to track my reading progress and mark newsletters as read or unread,
**So that** I can track my reading progress and resume where I left off.

**Acceptance Criteria:**

**Given** I open a newsletter in the reader view
**When** I scroll through the content
**Then** the system tracks my scroll position as a percentage read
**And** the percentage is stored in the database

**Given** I have partially read a newsletter
**When** I return to that newsletter later
**Then** I can see my reading progress (e.g., "45% read")
**And** I have the option to resume from where I left off

**Given** I scroll to the bottom of a newsletter (100% read)
**When** the reading is complete
**Then** the newsletter is automatically marked as read

**Given** I am viewing a newsletter (list or detail)
**When** I click the mark as unread option
**Then** the newsletter is marked as unread
**And** the UI updates immediately

**Given** I am viewing the newsletter list
**When** looking at newsletter items
**Then** unread newsletters are visually distinct (bold, indicator dot, etc.)
**And** partially read newsletters show a progress indicator

**Given** I have unread newsletters
**When** viewing senders or folders
**Then** I see unread counts displayed as badges

**Given** I want to mark multiple newsletters as read
**When** I select multiple items (if bulk actions available)
**Then** I can mark all selected as read in one action

---

### Story 3.5: Hide Newsletters

**As a** user managing my inbox,
**I want** to hide newsletters without unsubscribing,
**So that** I can declutter my view without losing the subscription.

**Acceptance Criteria:**

**Given** I am viewing a newsletter (list or detail)
**When** I click the hide button
**Then** the newsletter is hidden from my main views
**And** a confirmation or undo option is briefly shown

**Given** newsletters are hidden
**When** I view my main newsletter list
**Then** hidden newsletters are not displayed

**Given** I want to see hidden newsletters
**When** I navigate to a "Hidden" filter or section
**Then** I can view all my hidden newsletters

**Given** I am viewing a hidden newsletter
**When** I click "Unhide" or "Restore"
**Then** the newsletter returns to my main views

**Given** I hide a newsletter
**When** checking my subscription status
**Then** the sender remains active (not unsubscribed)
**And** future newsletters from that sender still arrive

---

## Epic 4: Gmail Import

Users can import their existing newsletter subscriptions and history from Gmail.

### Story 4.1: Gmail OAuth Connection

**As a** user with existing newsletters in Gmail,
**I want** to connect my Gmail account,
**So that** the system can access my email for importing newsletters.

**Acceptance Criteria:**

**Given** I am logged in and on the import page
**When** I click "Connect Gmail"
**Then** I am redirected to Google's OAuth consent screen
**And** the requested scopes include read-only email access

**Given** I complete the Google OAuth flow
**When** I authorize the application
**Then** I am redirected back to the app
**And** my Gmail connection status shows as "Connected"

**Given** I connect my Gmail
**When** the OAuth tokens are received
**Then** they are stored securely via Better Auth (NFR6)
**And** tokens are never exposed to the client

**Given** I am on the import page
**When** my Gmail is already connected
**Then** I see my connected Gmail address displayed
**And** I see options to scan for newsletters or disconnect

**Given** the OAuth flow fails or is cancelled
**When** I return to the app
**Then** I see an appropriate error message
**And** I can retry the connection

---

### Story 4.2: Newsletter Sender Scanning

**As a** user with Gmail connected,
**I want** the system to scan my Gmail for newsletter senders,
**So that** I can see which newsletters I'm subscribed to.

**Acceptance Criteria:**

**Given** my Gmail is connected
**When** I click "Scan for Newsletters"
**Then** the system scans my Gmail for newsletter-like emails
**And** I see a progress indicator during scanning

**Given** the scan is in progress
**When** analyzing emails
**Then** the system uses heuristics to identify newsletters (list-unsubscribe header, known newsletter domains, mailing list patterns)

**Given** the scan completes
**When** viewing results
**Then** I see a list of detected newsletter senders
**And** each sender shows name, email, and approximate email count

**Given** the scan finds no newsletters
**When** viewing results
**Then** I see a message indicating no newsletters were found
**And** I have the option to rescan or adjust criteria

**Given** my OAuth token expires during scanning (NFR10)
**When** the system detects expiry
**Then** it attempts to refresh the token automatically
**And** continues scanning without user intervention if successful

---

### Story 4.3: Sender Review & Approval

**As a** user reviewing detected senders,
**I want** to review and approve which senders to import,
**So that** I only import the newsletters I want.

**Acceptance Criteria:**

**Given** the scan has completed with results
**When** I view the detected senders list
**Then** each sender has a checkbox for selection
**And** senders are selected by default

**Given** I am reviewing senders
**When** I want to select or deselect all
**Then** I can use "Select All" and "Deselect All" buttons

**Given** I am reviewing senders
**When** I click on a sender row
**Then** I can see more details (sample subjects, date range)

**Given** I have made my selections
**When** I click "Import Selected"
**Then** only the approved senders proceed to import
**And** deselected senders are not imported

**Given** I want to exclude a specific sender
**When** I uncheck that sender
**Then** it is visually marked as excluded
**And** the import count updates accordingly

---

### Story 4.4: Historical Email Import

**As a** user with approved senders,
**I want** to import historical emails from those senders,
**So that** I have my newsletter archive in the app.

**Acceptance Criteria:**

**Given** I have approved senders for import
**When** the import begins
**Then** I see a progress indicator showing emails imported / total
**And** the import runs in the background

**Given** the import is in progress
**When** emails are processed
**Then** each email is parsed and stored (same as Epic 2 flow)
**And** sender records are created or linked

**Given** the import completes successfully
**When** viewing the results
**Then** I see a summary of imported newsletters
**And** the newsletters appear in my main list

**Given** some emails fail to import
**When** the import completes
**Then** I see a count of failed imports
**And** successful imports are still available

**Given** I navigate away during import
**When** I return to the import page
**Then** I can see the current progress
**And** the import continues in the background

**Given** an imported newsletter already exists
**When** processing duplicates
**Then** duplicates are detected and skipped
**And** no duplicate newsletters are created

---

### Story 4.5: Gmail Disconnect

**As a** user with Gmail connected,
**I want** to disconnect my Gmail account,
**So that** I can revoke access if I no longer want the integration.

**Acceptance Criteria:**

**Given** I am in settings or the import page
**When** I click "Disconnect Gmail"
**Then** I see a confirmation dialog explaining what will happen

**Given** I confirm the disconnection
**When** the disconnect is processed
**Then** the OAuth tokens are revoked and deleted
**And** my Gmail connection status shows as "Not Connected"

**Given** I disconnect Gmail
**When** checking my imported newsletters
**Then** previously imported newsletters remain in my account
**And** only the Gmail connection is removed

**Given** I have disconnected Gmail
**When** I want to reconnect
**Then** I can go through the OAuth flow again
**And** connect the same or a different Gmail account

**Given** I disconnect Gmail
**When** the tokens are revoked
**Then** the app can no longer access my Gmail
**And** Google shows the app as no longer having access

---

## Epic 5: AI Summaries

Users can generate AI summaries to quickly understand newsletter content.

### Story 5.1: AI Summary Generation

**As a** user reading a newsletter,
**I want** to generate an AI summary with one click,
**So that** I can quickly understand the key points when I don't have time to read the full content.

**Acceptance Criteria:**

**Given** I am viewing a newsletter in the reader
**When** I click the "Summarize" button
**Then** the system sends the newsletter content to the AI service
**And** I see a loading indicator while the summary is being generated

**Given** the AI is generating a summary
**When** the process completes
**Then** the summary is returned within 10 seconds (NFR3)
**And** the summary is stored in the database with the newsletter

**Given** the AI service is unavailable or fails
**When** I request a summary
**Then** I see a friendly error message
**And** the reading experience is not blocked (NFR11)
**And** I can retry later

**Given** a newsletter already has a generated summary
**When** I view that newsletter
**Then** the existing summary is displayed
**And** I don't need to regenerate it

**Given** I want to regenerate a summary
**When** I click "Regenerate Summary"
**Then** a new summary is generated
**And** it replaces the previous summary

---

### Story 5.2: Summary Display & Management

**As a** user who generated a summary,
**I want** to see the summary displayed alongside the original content,
**So that** I can quickly reference key points while reading.

**Acceptance Criteria:**

**Given** a newsletter has a summary
**When** I view the newsletter in the reader
**Then** I see the summary displayed in a dedicated panel or section
**And** the summary is visually distinct from the original content

**Given** I am viewing a newsletter with a summary
**When** I want to focus on the full content
**Then** I can collapse or hide the summary panel
**And** my preference is remembered

**Given** I am viewing the summary
**When** reading the summary content
**Then** it shows key points, main topics, and takeaways
**And** it is concise (appropriate length for quick scanning)

**Given** I am browsing my newsletter list
**When** a newsletter has a summary
**Then** I see an indicator that a summary is available
**And** I can optionally preview the summary from the list

**Given** the AI summarization failed previously
**When** viewing that newsletter
**Then** I see the original content without interruption
**And** I have the option to try generating a summary again

---

## Epic 6: Community Back-Catalog

Users can discover and access newsletters from the shared community database.

**Note:** Epic 2.5 (Content Sharing Architecture) provides the foundation for all community features. The shared content model with `newsletterContent` and global `senders` tables enables efficient community discovery.

### Story 6.1: Default Public Sharing

**As a** user receiving newsletters,
**I want** my newsletters to be shared to the community database by default,
**So that** other users can benefit from the shared back-catalog.

**Acceptance Criteria:**

**Given** a newsletter is received at my dedicated address
**When** it is stored in the system
**Then** it references shared `newsletterContent` by default (if sender not marked private)
**And** the content becomes available in the community database via `newsletterContent` table

**Given** newsletters are stored with shared content
**When** querying for community newsletters
**Then** query the `newsletterContent` table directly
**And** no user-specific data is exposed (userNewsletters not queried for community views)

**Given** I am a new user
**When** I sign up
**Then** the default sharing preference is explained during onboarding
**And** I understand my newsletters will be shared by default

**Given** newsletters are shared to the community
**When** other users view them
**Then** they see the content from `newsletterContent` table
**And** they cannot see which users contributed (no join to userNewsletters)
**And** user privacy is maintained

**Implementation Notes (Epic 2.5 enables this):**
- Public sharing is AUTOMATIC via the shared content model
- `newsletterContent` table IS the community database
- `readerCount` shows popularity without exposing user identities

---

### Story 6.2: Privacy Controls for Senders

**As a** user with sensitive newsletters,
**I want** to mark specific senders as private,
**So that** their newsletters are excluded from the community database.

**Acceptance Criteria:**

**Given** I am viewing my senders list or a sender's settings
**When** I toggle the "Private" option for a sender
**Then** my `userSenderSettings.isPrivate` is updated
**And** this affects FUTURE newsletters only (private newsletters store content separately)

**Given** a sender is marked as private in my settings
**When** new newsletters arrive from that sender
**Then** they are stored with `privateR2Key` (NOT in `newsletterContent`)
**And** they never appear in the community database (NFR7)
**And** `userNewsletters.isPrivate` is set to true

**Given** I have private senders
**When** viewing my own newsletter list
**Then** I can still see and read all my newsletters (private and public)
**And** private newsletters are indicated with a lock icon or similar

**Given** I change a sender from private to public
**When** the change is saved
**Then** FUTURE newsletters will use shared content model
**And** EXISTING private newsletters remain private (content already stored separately)
**And** UI indicates which newsletters are private vs public

**Given** I am in settings
**When** I navigate to privacy settings
**Then** I see a list of all my senders with their privacy status (from `userSenderSettings`)
**And** I can bulk-manage privacy settings

**Implementation Notes (Epic 2.5 enables this):**
- Privacy is per-user via `userSenderSettings.isPrivate`
- Global `senders` table has no privacy flag (privacy is user-specific)
- Changing privacy affects future newsletters, not retroactively (by design)

---

### Story 6.3: Community Back-Catalog Access

**As a** user exploring newsletters,
**I want** to access the back-catalog of newsletters from the community database,
**So that** I can read newsletters I missed or discover new content.

**Acceptance Criteria:**

**Given** I am logged in
**When** I navigate to the Community or Explore section
**Then** I see a browsable list from `newsletterContent` table
**And** newsletters are organized by sender (via `senderEmail`) or sorted by `readerCount`

**Given** I am browsing the community back-catalog
**When** I search or filter
**Then** I can find newsletters by sender name, subject
**And** results load quickly (NFR1) - direct query on `newsletterContent`

**Given** I find an interesting newsletter in the community
**When** I click on it
**Then** I can read the full content (signed URL from `newsletterContent.r2Key`)
**And** the experience is the same as reading my own newsletters

**Given** I am viewing a community newsletter
**When** I want to save it
**Then** I can add it to my personal collection
**And** a `userNewsletter` record is created referencing the `contentId`
**And** it appears in my newsletter list

**Given** privacy is enforced by architecture
**When** querying the community database
**Then** only `newsletterContent` is queried (inherently public)
**And** private newsletters never enter `newsletterContent` (Epic 2.5 design)

**Implementation Notes (Epic 2.5 enables this):**
- Community queries hit `newsletterContent` directly - simple and fast
- `readerCount` enables "popular newsletters" sorting
- Adding to personal collection = creating `userNewsletter` with `contentId` reference

---

### Story 6.4: Browse Newsletters Not Personally Received

**As a** new user,
**I want** to browse newsletters I haven't personally received,
**So that** I can explore content and discover new newsletters to subscribe to.

**Acceptance Criteria:**

**Given** I am a new user with no newsletters yet
**When** I access the app
**Then** I can browse the community back-catalog immediately
**And** I see popular newsletters sorted by `readerCount`

**Given** I am browsing community newsletters
**When** I find a sender I like
**Then** I can see all content from that sender via `newsletterContent.senderEmail`
**And** I see `senders.subscriberCount` showing "X users subscribe to this"
**And** I can "follow" the sender

**Given** I follow a sender from the community
**When** I view my senders list
**Then** a `userSenderSettings` record is created for me (even without newsletters)
**And** I can access their back-catalog from my personal view

**Given** I am exploring newsletters
**When** viewing the discover section
**Then** I see newsletters sorted by `readerCount` (popularity), `firstReceivedAt` (recency)
**And** I can filter by `senders.domain`

**Given** I find a newsletter I want to subscribe to
**When** viewing the newsletter or sender
**Then** I see information about how to subscribe (if available)
**And** I see my dedicated email address to use for subscription
**And** I see "X users also read this" from `readerCount`

**Implementation Notes (Epic 2.5 enables this):**
- Global `senders` table with `subscriberCount` enables "X users subscribe"
- `newsletterContent.readerCount` enables popularity-based discovery
- Following a sender creates `userSenderSettings` without requiring newsletters

---

## Epic 7: Admin & System Operations

Administrators can monitor system health and manage the platform.

### Story 7.1: Admin Dashboard & System Health

**As an** administrator,
**I want** to view system health metrics,
**So that** I can monitor the platform's operational status.

**Acceptance Criteria:**

**Given** I am logged in as an administrator
**When** I navigate to the admin section
**Then** I see an admin dashboard with system health overview
**And** regular users cannot access this section

**Given** I am on the admin dashboard
**When** viewing system health
**Then** I see key metrics including total users, total newsletters, and storage usage
**And** metrics are updated in real-time or near real-time

**Given** I am monitoring the system
**When** viewing the dashboard
**Then** I see Convex connection status
**And** I see recent activity summary

**Given** the system has issues
**When** a component is unhealthy
**Then** I see a visual indicator of the problem
**And** I can drill down for more details

**Given** I want historical data
**When** viewing metrics
**Then** I can see trends over time (daily/weekly)
**And** I can identify patterns or anomalies

---

### Story 7.2: Email Delivery Monitoring

**As an** administrator,
**I want** to monitor email delivery status,
**So that** I can ensure newsletters are being received reliably.

**Acceptance Criteria:**

**Given** I am on the admin dashboard
**When** I navigate to email delivery monitoring
**Then** I see email delivery statistics
**And** I see success/failure rates

**Given** emails are being received
**When** viewing delivery logs
**Then** I see recent email deliveries with timestamps
**And** I can filter by status (success, failed, pending)

**Given** an email delivery fails
**When** viewing the failure
**Then** I see the reason for failure
**And** I can identify which user was affected

**Given** I want to ensure zero message loss (NFR9)
**When** monitoring deliveries
**Then** I can see any emails that failed to process
**And** I have tools to retry failed deliveries if applicable

**Given** the email worker has issues
**When** monitoring the system
**Then** I see alerts for delivery anomalies
**And** I can view Cloudflare Worker logs/status

---

### Story 7.3: Privacy Content Review

**As an** administrator,
**I want** to review content flagged as private,
**So that** I can ensure privacy boundaries are being respected.

**Acceptance Criteria:**

**Given** I am on the admin dashboard
**When** I navigate to privacy review
**Then** I see statistics on private vs public content
**And** I see the number of users with private senders

**Given** I am reviewing privacy compliance
**When** viewing the privacy dashboard
**Then** I can verify that private newsletters are not in community queries
**And** I can audit the privacy filtering is working correctly

**Given** I want to verify NFR7 compliance
**When** running a privacy audit
**Then** the system confirms no private content is exposed publicly
**And** I see a compliance status indicator

**Given** there are privacy concerns
**When** a user reports an issue
**Then** I can investigate specific newsletters or senders
**And** I can verify their privacy status

**Given** I am reviewing privacy patterns
**When** viewing usage statistics
**Then** I see how many senders are marked private across all users
**And** I can identify any unusual patterns

---

### Story 7.4: Community Content Management

**As an** administrator,
**I want** to manage community database content,
**So that** I can moderate and maintain content quality.

**Acceptance Criteria:**

**Given** I am on the admin dashboard
**When** I navigate to community content management
**Then** I see a searchable list of community newsletters
**And** I can filter by sender, date, or status

**Given** I find inappropriate content
**When** I select a newsletter
**Then** I can remove it from the community database
**And** a record of the removal is logged

**Given** content is removed from the community
**When** the action is completed
**Then** the newsletter is no longer visible to other users
**And** the original owner's copy is unaffected

**Given** users report content
**When** viewing reported items
**Then** I see a queue of reported newsletters
**And** I can review and take action on each report

**Given** I want to manage senders at scale
**When** a sender is identified as spam or inappropriate
**Then** I can block that sender from the community database
**And** all their newsletters are removed from community view

**Given** I take a moderation action
**When** the action is completed
**Then** an audit log entry is created
**And** the action can be reviewed later if needed

---

## Epic 8: Manual Newsletter Import

Users can import newsletters from any email provider via drag-and-drop `.eml` files or email forwarding to `import@hushletter.com`.

### Story 8.1: EML Parser Service

**As a** developer,
**I want** a service that parses `.eml` files and extracts newsletter data,
**So that** users can import newsletters from any email client.

**Acceptance Criteria:**

**Given** a valid `.eml` file is provided
**When** the parser processes the file
**Then** it extracts sender name, sender email, subject line, and received date
**And** it extracts HTML body content (with plain text fallback)
**And** it extracts inline images and attachments

**Given** an `.eml` file with only plain text content
**When** the parser processes the file
**Then** the plain text is extracted successfully
**And** HTML body is null or empty

**Given** an `.eml` file with embedded images (Content-ID references)
**When** the parser processes the file
**Then** inline images are extracted and preserved
**And** Content-ID references are resolved correctly

**Given** a malformed or invalid `.eml` file
**When** the parser attempts to process it
**Then** a structured error is returned (not a crash)
**And** the error indicates what was wrong (e.g., "Invalid MIME format")

**Given** the parser extracts a date
**When** storing the newsletter
**Then** the original received date is used (not the current import time)
**And** the date is stored as Unix timestamp (per Architecture patterns)

**Implementation Notes:**
- Create `packages/shared/src/utils/emlParser.ts` for shared parsing logic
- Use existing email parsing patterns from `apps/email-worker/src/emailHandler.ts`
- Parser should be usable both client-side (drag-drop) and server-side (forward-to-import)

---

### Story 8.2: Drag-and-Drop Import UI

**As a** user with newsletters in another email client,
**I want** to drag-and-drop `.eml` files into Hushletter,
**So that** I can import newsletters without email forwarding.

**Acceptance Criteria:**

**Given** I am logged in and on the import page
**When** I view the import options
**Then** I see a drag-and-drop zone for `.eml` files
**And** the zone has clear visual instructions ("Drag .eml files here")

**Given** I drag a single `.eml` file onto the drop zone
**When** I release the file
**Then** the file is parsed using the EML parser
**And** I see a preview of the extracted newsletter (subject, sender, date)
**And** I can confirm or cancel the import

**Given** I confirm a single file import
**When** the import is processed
**Then** the newsletter content is uploaded to R2
**And** a `userNewsletter` record is created
**And** sender matching/creation follows existing logic (Story 2.3)
**And** I see a success message with the imported newsletter

**Given** I drag multiple `.eml` files onto the drop zone (FR30)
**When** I release the files
**Then** all files are queued for processing
**And** I see a progress indicator showing "X of Y processed"
**And** processing happens in parallel (up to reasonable concurrency limit)

**Given** bulk import completes
**When** viewing the results
**Then** I see a summary: "Imported X newsletters, Y duplicates skipped, Z failed"
**And** I can see details of any failures
**And** successfully imported newsletters appear in my list

**Given** I drag a non-`.eml` file onto the drop zone
**When** I release the file
**Then** the file is rejected with a clear message ("Only .eml files are supported")
**And** the drop zone returns to its ready state

**Given** I am on the import page
**When** I prefer to use a file picker instead of drag-drop
**Then** I can click a "Browse files" button to open a file picker
**And** the file picker filters to `.eml` files by default

**Implementation Notes:**
- Add route at `app/routes/_authed/import/manual.tsx`
- Use HTML5 Drag and Drop API with proper MIME type checking
- Client-side parsing for preview, server-side processing for storage
- Reuse `ImportProgress.tsx` component from Gmail import (Epic 4)

---

### Story 8.3: Forward-to-Import Endpoint

**As a** user with newsletters in any email provider,
**I want** to forward emails to `import@hushletter.com`,
**So that** I can import newsletters without exporting files.

**Acceptance Criteria:**

**Given** the forward-to-import endpoint is deployed
**When** an email is forwarded to `import@hushletter.com`
**Then** the email worker receives and processes the forwarded message
**And** the original newsletter is extracted from the forwarded email

**Given** a forwarded email arrives
**When** the system identifies the forwarding user
**Then** it checks if the "From" address matches a registered user's email
**And** if matched, the import proceeds for that user
**And** if not matched, the email is rejected (FR36 - security)

**Given** a forwarded email is from an unregistered address
**When** the email worker processes it
**Then** the email is rejected silently (no bounce to prevent information leakage)
**And** an admin log entry is created for monitoring

**Given** a valid forwarded email is processed
**When** extracting the original newsletter
**Then** the system unwraps the forwarded message structure
**And** extracts the original sender (not the forwarding user)
**And** extracts the original date (not the forward date)
**And** extracts the original subject (without "Fwd:" prefix)

**Given** the original newsletter is extracted
**When** storing the newsletter
**Then** it follows the same flow as drag-drop import
**And** sender matching/creation uses existing logic (Story 2.3)
**And** the newsletter appears in the user's list in real-time

**Given** rate limiting is enabled
**When** a user forwards more than 50 emails per hour
**Then** subsequent emails are queued or rate-limited
**And** the user is not notified of rate limiting (silent queue)

**Given** the email worker is deployed
**When** reviewing the configuration
**Then** `import@hushletter.com` routes to the email worker
**And** the worker has a dedicated handler for import emails (separate from dedicated address flow)

**Implementation Notes:**
- Add handler in `apps/email-worker/src/importHandler.ts`
- Cloudflare Email Routing rule: `import@hushletter.com` → import handler
- Use `convex/users.ts` to lookup user by email address
- Rate limiting via Cloudflare Workers KV or Durable Objects

---

### Story 8.4: Duplicate Detection

**As a** user importing newsletters,
**I want** duplicate emails to be automatically skipped,
**So that** I don't have duplicate newsletters in my library.

**Acceptance Criteria:**

**Given** I import a newsletter via drag-drop or forward
**When** the system checks for duplicates
**Then** it checks by Message-ID header first (most reliable)
**And** if no Message-ID, it checks by content hash (fallback)

**Given** a newsletter with the same Message-ID already exists for me
**When** I attempt to import it
**Then** the import is skipped silently (FR33 - no error shown)
**And** the existing newsletter is unchanged
**And** bulk import counts this as "duplicate skipped"

**Given** a newsletter with the same content hash exists for me
**When** I attempt to import it (and no Message-ID match)
**Then** the import is skipped as a duplicate
**And** content hash uses the same normalization as Epic 2.5 (Story 2.5.2)

**Given** the same newsletter content exists in the community database
**When** I import a newsletter that matches `newsletterContent.contentHash`
**Then** my `userNewsletter` references the existing `contentId` (deduplication)
**And** no new `newsletterContent` record is created
**And** `readerCount` is incremented

**Given** I have marked a sender as private
**When** I import a newsletter from that sender
**Then** duplicate detection uses my private content (not community)
**And** the imported newsletter is stored with `privateR2Key`

**Given** bulk import processes multiple files
**When** some files are duplicates
**Then** duplicates are detected and skipped
**And** the progress indicator shows "X imported, Y duplicates"
**And** non-duplicate files continue processing

**Implementation Notes:**
- Add `messageId` field to `userNewsletters` schema for deduplication
- Index: `.index("by_userId_messageId", ["userId", "messageId"])`
- Content hash fallback uses `normalizeForHash()` from Story 2.5.2
- Duplicate check happens before R2 upload (avoid unnecessary storage)

---

## Epic 9: Course Correction - Privacy-First & Folder-Centric Architecture

Refactor the application to make all newsletters private by default with admin-curated community content, and replace sender-based navigation with folder-based navigation.

**FRs covered:** FR14 (modified), FR21 (modified), FR23 (modified), FR27 (modified), FR37, FR38, FR39, FR40, FR41, FR42, FR43, FR44

**Implementation Notes:**
- This epic addresses stakeholder feedback about privacy risks and UX simplification
- All user newsletters are private by default (no automatic community sharing)
- Admin curates community by creating sanitized copies of user newsletters
- Folders become the primary organizational unit (senders live inside folders)
- Users can merge private + community newsletters in the same folder

**Key Architecture Changes:**
- Remove automatic deduplication to community
- Senders are global (shared across users and community)
- `userNewsletters.privateR2Key` for user content, `contentId` only for community imports
- `userNewsletters.source` tracks origin (email, gmail, manual, community)
- Folders required for all senders (`userSenderSettings.folderId` mandatory)

---

### Story 9.1: Schema Migration

**As a** developer,
**I want** to migrate the database schema to support privacy-first and folder-centric architecture,
**So that** the foundation is in place for subsequent stories.

**Acceptance Criteria:**

**Given** the migration runs
**When** reviewing the schema
**Then** `senders` table is global (no userId field)
**And** `folders` table exists with userId, name, isHidden, createdAt, updatedAt
**And** `userSenderSettings.folderId` is required (not optional)
**And** `userNewsletters.folderId` is required (not optional)
**And** `userNewsletters.source` field exists with union type
**And** `newsletterContent` has communityApprovedAt, communityApprovedBy, importCount fields

**Given** the migration runs on existing data
**When** processing existing newsletters
**Then** each existing sender gets a folder created (named after sender)
**And** existing `userSenderSettings` get folderId populated
**And** existing `userNewsletters` get folderId and source populated

---

### Story 9.2: Private-by-Default

**As a** user receiving newsletters,
**I want** all my newsletters to be stored privately,
**So that** my content is never shared without explicit admin curation.

**Acceptance Criteria:**

**Given** an email arrives at my dedicated address
**When** the system stores it
**Then** it uses `privateR2Key` (uploads to R2 with user-specific key)
**And** `contentId` is null (no community reference)
**And** `source` is set to "email"

**Given** I import via Gmail
**When** newsletters are stored
**Then** they use `privateR2Key`
**And** `source` is "gmail"

**Given** I import via drag-drop or forward
**When** newsletters are stored
**Then** they use `privateR2Key`
**And** `source` is "manual"

**Given** the old deduplication logic exists
**When** reviewing the codebase
**Then** automatic deduplication to `newsletterContent` is removed
**And** `newsletterContent` is only created by admin action

---

### Story 9.3: Folder Auto-Creation

**As a** user receiving newsletters from new senders,
**I want** a folder to be automatically created for each new sender,
**So that** my newsletters are organized without manual effort.

**Acceptance Criteria:**

**Given** a newsletter arrives from a new sender
**When** the system processes it
**Then** a new folder is created with the sender's name
**And** the sender is linked to this folder via `userSenderSettings`
**And** the newsletter is placed in this folder

**Given** a sender already exists with a folder
**When** a new newsletter arrives from that sender
**Then** no new folder is created
**And** the newsletter goes to the existing folder

---

### Story 9.4: Folder-Centric Navigation

**As a** user viewing my newsletters,
**I want** to see folders instead of senders in the sidebar,
**So that** I have a simpler mental model for organization.

**Acceptance Criteria:**

**Given** I am logged in
**When** I view the main navigation sidebar
**Then** I see a list of my folders (not senders)
**And** each folder shows unread count and newsletter count
**And** hidden folders are not shown by default

**Given** I click on a folder
**When** the folder opens
**Then** I see all newsletters in that folder
**And** newsletters are sorted by date (newest first)
**And** I can see which senders are in this folder

**Given** a folder has multiple senders
**When** viewing the folder
**Then** newsletters from all senders are shown together
**And** each newsletter shows its sender name

---

### Story 9.5: Folder Actions

**As a** user managing my newsletters,
**I want** to merge, hide, and rename folders,
**So that** I can organize my reading experience.

**Acceptance Criteria:**

**Given** I have two folders
**When** I merge folder B into folder A
**Then** all senders from B move to folder A
**And** all newsletters from B appear in folder A
**And** folder B is deleted
**And** the action can be undone

**Given** I have a folder
**When** I hide the folder
**Then** it disappears from main navigation
**And** newsletters in it are not shown in "All" view
**And** I can view hidden folders in settings
**And** I can unhide a folder

**Given** I have a folder
**When** I rename it
**Then** the new name is saved
**And** it appears in navigation with new name

---

### Story 9.6: Admin Moderation Queue

**As an** administrator,
**I want** to see a queue of user newsletters to review,
**So that** I can curate community content.

**Acceptance Criteria:**

**Given** I am logged in as admin
**When** I navigate to Content Moderation
**Then** I see newsletters grouped by sender
**And** I can see how many newsletters are from each sender
**And** I can filter by sender or date range

**Given** I am viewing the moderation queue
**When** I select a newsletter
**Then** I can view its full content
**And** I can see which user owns it (for audit, not displayed to community)
**And** I can identify potential PII or personalization

---

### Story 9.7: Admin Publish Flow

**As an** administrator,
**I want** to publish sanitized newsletters to the community database,
**So that** clean content is available for all users.

**Acceptance Criteria:**

**Given** I am reviewing a newsletter
**When** I click "Publish to Community"
**Then** the system creates a NEW `newsletterContent` record
**And** content is uploaded to R2 with new key (not user's key)
**And** `communityApprovedAt` is set to current time
**And** `communityApprovedBy` is set to my admin ID
**And** the original user's `privateR2Key` is unchanged

**Given** I am reviewing a newsletter
**When** I click "Reject"
**Then** the newsletter is marked as reviewed
**And** it won't appear in my queue again
**And** the user's newsletter is unchanged

**Given** I publish content
**When** the action completes
**Then** an audit log entry is created
**And** the community newsletter is immediately browsable

---

### Story 9.8: Community Browse

**As a** user exploring newsletters,
**I want** to browse the admin-curated community database,
**So that** I can discover new content.

**Acceptance Criteria:**

**Given** I am logged in
**When** I navigate to Community/Discover
**Then** I see newsletters from `newsletterContent` (admin-approved only)
**And** I can filter by sender
**And** I can sort by date or popularity (importCount)

**Given** I am browsing community
**When** viewing a sender
**Then** I see how many community newsletters are available
**And** I see which ones I already have (private or imported)
**And** I can preview newsletter content before importing

---

### Story 9.9: Community Import

**As a** user who found interesting community content,
**I want** to import newsletters to my personal collection,
**So that** I can read them alongside my private newsletters.

**Acceptance Criteria:**

**Given** I am viewing a community newsletter
**When** I click "Import" or "Add to Collection"
**Then** a `userNewsletter` is created with `contentId` (not privateR2Key)
**And** `source` is set to "community"
**And** it's placed in my folder for that sender (or creates one)
**And** `newsletterContent.importCount` is incremented

**Given** I already have a folder for this sender
**When** I import a community newsletter
**Then** it appears in my existing folder
**And** it's mixed with my private newsletters by date

**Given** I import multiple newsletters
**When** selecting bulk import
**Then** all selected newsletters are imported
**And** I see progress and confirmation

---

### Story 9.10: Unified Folder View

**As a** user viewing a folder,
**I want** to see both private and community-imported newsletters together,
**So that** I have a complete view of content from that sender.

**Acceptance Criteria:**

**Given** my folder has both private and community-imported newsletters
**When** I view the folder
**Then** all newsletters are shown sorted by date
**And** private newsletters show a "private" indicator (e.g., 📧)
**And** community imports show a "community" indicator (e.g., 🌐)

**Given** I click on a private newsletter
**When** loading content
**Then** it fetches from my `privateR2Key`

**Given** I click on a community-imported newsletter
**When** loading content
**Then** it fetches from `newsletterContent.r2Key` via `contentId`

**Given** I delete a community-imported newsletter
**When** the deletion completes
**Then** my `userNewsletter` is removed
**And** the `newsletterContent` is unchanged
**And** `importCount` is decremented
