---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - prd.md
  - architecture.md
workflowType: 'epics-and-stories'
project_name: 'newsletter manager'
user_name: 'Teogoulois'
date: '2026-01-22'
status: complete
completedAt: '2026-01-22'
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

**Given** a newsletter arrives from a new sender
**When** the system processes it
**Then** a new sender record is created automatically
**And** it captures sender email, sender name, and domain

**Given** a newsletter arrives from an existing sender
**When** the system processes it
**Then** it links to the existing sender record
**And** no duplicate sender is created

**Given** a sender record exists
**When** viewing sender information
**Then** the sender name is displayed (or email if name unavailable)
**And** the domain is extracted correctly (e.g., "substack.com" from "newsletter@substack.com")

**Given** a sender has the isPrivate flag set
**When** new newsletters arrive from that sender
**Then** the newsletters inherit the private status

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

**Given** Convex real-time subscriptions are active
**When** the connection is stable
**Then** updates are pushed automatically (NFR14)
**And** the UI reflects the current state

**Given** I have no newsletters yet
**When** I view the newsletters page
**Then** I see an empty state with instructions to use my dedicated email address

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

### Story 6.1: Default Public Sharing

**As a** user receiving newsletters,
**I want** my newsletters to be shared to the community database by default,
**So that** other users can benefit from the shared back-catalog.

**Acceptance Criteria:**

**Given** a newsletter is received at my dedicated address
**When** it is stored in the system
**Then** it is marked as public by default (`isPrivate: false`)
**And** it becomes available in the community database

**Given** newsletters are stored in the database
**When** querying for community newsletters
**Then** the query uses mandatory privacy filtering
**And** only newsletters with `isPrivate: false` are returned

**Given** I am a new user
**When** I sign up
**Then** the default sharing preference is explained during onboarding
**And** I understand my newsletters will be shared by default

**Given** newsletters are shared to the community
**When** other users view them
**Then** they can see the content but not which user contributed it
**And** user privacy is maintained

---

### Story 6.2: Privacy Controls for Senders

**As a** user with sensitive newsletters,
**I want** to mark specific senders as private,
**So that** their newsletters are excluded from the community database.

**Acceptance Criteria:**

**Given** I am viewing my senders list or a sender's settings
**When** I toggle the "Private" option for a sender
**Then** that sender is marked as private
**And** all newsletters from that sender are marked as private

**Given** a sender is marked as private
**When** new newsletters arrive from that sender
**Then** they are automatically marked as private
**And** they never appear in the community database (NFR7)

**Given** I have private senders
**When** viewing my own newsletter list
**Then** I can still see and read all my newsletters (private and public)
**And** private newsletters are indicated with a lock icon or similar

**Given** I change a sender from private to public
**When** the change is saved
**Then** existing newsletters from that sender become public
**And** they appear in the community database

**Given** I am in settings
**When** I navigate to privacy settings
**Then** I see a list of all my senders with their privacy status
**And** I can bulk-manage privacy settings

---

### Story 6.3: Community Back-Catalog Access

**As a** user exploring newsletters,
**I want** to access the back-catalog of newsletters from the community database,
**So that** I can read newsletters I missed or discover new content.

**Acceptance Criteria:**

**Given** I am logged in
**When** I navigate to the Community or Explore section
**Then** I see a browsable list of public newsletters from all users
**And** newsletters are organized by sender or topic

**Given** I am browsing the community back-catalog
**When** I search or filter
**Then** I can find newsletters by sender name, subject, or content
**And** results load quickly (NFR1)

**Given** I find an interesting newsletter in the community
**When** I click on it
**Then** I can read the full content in the reader view
**And** the experience is the same as reading my own newsletters

**Given** I am viewing a community newsletter
**When** I want to save it
**Then** I can add it to my personal collection
**And** it appears in my newsletter list

**Given** privacy filtering is enforced
**When** querying the community database
**Then** only public newsletters are ever returned
**And** private newsletters are never exposed

---

### Story 6.4: Browse Newsletters Not Personally Received

**As a** new user,
**I want** to browse newsletters I haven't personally received,
**So that** I can explore content and discover new newsletters to subscribe to.

**Acceptance Criteria:**

**Given** I am a new user with no newsletters yet
**When** I access the app
**Then** I can browse the community back-catalog immediately
**And** I see popular or recommended newsletters

**Given** I am browsing community newsletters
**When** I find a sender I like
**Then** I can see all public newsletters from that sender
**And** I can "follow" or save that sender for easy access

**Given** I follow a sender from the community
**When** I view my senders list
**Then** that sender appears (even if I haven't received emails from them)
**And** I can access their back-catalog from my personal view

**Given** I am exploring newsletters
**When** viewing the discover section
**Then** I see newsletters sorted by popularity, recency, or topic
**And** I can filter by category or sender domain

**Given** I find a newsletter I want to subscribe to
**When** viewing the newsletter or sender
**Then** I see information about how to subscribe (the sender's signup link if available)
**And** I'm encouraged to update my subscription to use my dedicated email

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
