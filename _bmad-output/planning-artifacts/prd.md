---
stepsCompleted:
  - step-01-init
  - step-02-discovery
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-06-innovation
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
inputDocuments:
  - product-brief-newsletter-manager-2026-01-14.md
  - brainstorming-session-2026-01-13.md
documentCounts:
  briefs: 1
  research: 0
  brainstorming: 1
  projectDocs: 0
classification:
  projectType: web_app + mobile_app
  domain: general
  complexity: medium
  projectContext: greenfield
workflowType: 'prd'
project_name: newsletter manager
author: Teogoulois
date: 2026-01-14
status: complete
---

# Product Requirements Document - Newsletter Manager

**Author:** Teogoulois
**Date:** 2026-01-14

## Executive Summary

**Newsletter Manager** is an open-source newsletter reader that gives users a dedicated inbox for subscriptions, separating newsletter content from their primary email.

**Key Differentiator:** Community back-catalog — new users instantly access years of newsletters contributed by other users. Network effect Meco can't replicate.

**Tech Stack:** TanStack Start (SPA) + Convex (database/real-time) + Cloudflare Email Workers

**MVP Scope:** Dedicated email, Gmail import, clean reader, AI summaries, shared newsletter database

## Success Criteria

### User Success

| Criteria | Definition |
|----------|------------|
| **Newsletter separation** | User's main inbox is clean — newsletters live elsewhere |
| **Zero friction receiving** | Newsletters arrive at dedicated address without setup headaches |
| **Gmail migration works** | User can import existing subscriptions and see historical issues |
| **Clean reading experience** | User can read without distractions, organized by sender |
| **AI summaries useful** | One-click summary captures the gist when user doesn't have time to read |

**Success moment:** User opens the app, sees their newsletters waiting, reads on their terms, and their main inbox stays clean.

### Business Success

| Criteria | Definition |
|----------|------------|
| **Functional product** | The app works and can be used daily |
| **Dogfooding** | You (and users like you) actually use it |
| **Open source** | Code is public on GitHub |

No vanity metrics. No growth hacking. A tool that works.

### Technical Success

| Criteria | Definition |
|----------|------------|
| **Email delivery reliable** | Newsletters arrive consistently, no lost emails |
| **Gmail OAuth stable** | Import flow works without errors or token issues |
| **AI summarization functional** | Summaries are useful more often than not |
| **Community database scales** | Shared back-catalog doesn't break under load |

## Product Scope

### MVP - Minimum Viable Product

- Dedicated email address per user
- Gmail import (OAuth, detect senders, pull history)
- Clean reader interface, organized by sender
- AI summarization (one-click)
- Shared newsletter database (default public, opt-out private)
- User authentication

### Growth Features (Post-MVP)

- Audio conversion (listen to newsletters)
- Mobile apps (iOS/Android via Expo)
- Advanced AI (cross-newsletter insights, topic extraction)
- Keyboard shortcuts (vim-style navigation)
- Highlighting and annotations

### Vision (Future)

- Newsletter discovery ("readers of X also like Y")
- Self-hosting documentation and Docker deployment
- Newsletter Wrapped (yearly reading summary)
- Support for other email providers beyond Gmail

## User Journeys

### Journey 1: Sarah — Inbox Liberation (Primary User)

**Who:** Marketing director, 73 newsletters drowning her inbox

**Flow:**
1. Signs up → gets dedicated email (sarah@newslettermanager.app)
2. Connects Gmail → system detects her newsletter senders
3. Approves import → historical newsletters pull in, organized by sender
4. Updates subscriptions to use new address
5. Opens app when ready to read → newsletters waiting, main inbox clean

**Success:** Gmail inbox goes from 2,847 unread to manageable. Newsletters have a home.

### Journey 2: Jordan — Sunday Morning Reader (Casual User)

**Who:** Designer, 8 newsletters, reads on weekends

**Flow:**
1. Signs up → gets dedicated email
2. Manually updates 8 subscriptions (no Gmail import needed)
3. Ignores app all week
4. Sunday morning → opens app, sees what arrived, reads with coffee
5. Occasionally hits "summarize" when short on time

**Success:** Simple, calm, no pressure. Newsletters are there when wanted.

### Journey 3: You — Keeping the Lights On (Admin/Ops)

**Who:** You, running the system

**Flow:**
1. Monitor email delivery — are newsletters arriving?
2. Check community database — any abuse or spam newsletters?
3. Review flagged "private" content — ensure privacy boundaries hold
4. Basic health checks — OAuth tokens working, AI summarization responsive

**Success:** System runs without drama. You use it yourself daily.

### Journey Requirements Summary

| Journey | Capabilities Needed |
|---------|---------------------|
| **Sarah** | Sign-up, email provisioning, Gmail OAuth, sender detection, bulk import, folder organization |
| **Jordan** | Sign-up, email provisioning, reader interface, AI summarization |
| **Admin** | Monitoring dashboard (basic), content moderation tools, system health visibility |

## Web App + Mobile App Specific Requirements

### Project-Type Overview

| Aspect | Decision |
|--------|----------|
| **Web Architecture** | SPA (TanStack Start) |
| **Mobile Architecture** | Cross-platform (Expo/React Native) — post-MVP |
| **Browser Support** | Modern browsers only (Chrome, Firefox, Safari, Edge) |
| **SEO Strategy** | Basic — landing page only, app is behind auth |

### Technical Architecture Considerations

**Real-time Updates + Database:**
- **Convex** for database and real-time — single solution for both
- Newsletters appear instantly when they arrive (Convex subscriptions)
- No separate WebSocket infrastructure to manage

**Web Performance Targets:**
- Fast initial load (reader is text-heavy, should be snappy)
- Responsive design for tablet/desktop reading
- No IE11 or legacy browser polyfills needed

### Mobile Considerations (Post-MVP)

| Feature | Requirement |
|---------|-------------|
| **Offline Mode** | Cache newsletters for offline reading |
| **Push Notifications** | TBD — may conflict with "no guilt" philosophy |
| **Store Compliance** | Standard App Store / Play Store guidelines |

### Implementation Considerations

- **Web-first development** — mobile comes after core web experience works
- **Shared codebase** — Turbo monorepo for code sharing between web and mobile
- **Convex** — handles database, real-time, and backend functions in one stack

## Risk Mitigation Strategy

| Risk Type | Risk | Mitigation |
|-----------|------|------------|
| **Technical** | Email infrastructure (Cloudflare Workers receiving mail) | Test early, validate email delivery works before building UI |
| **Technical** | Gmail OAuth + newsletter detection accuracy | Start with simple heuristics, refine based on real data |
| **Market** | Users won't migrate from Gmail/Meco | Dogfood yourself first — if you use it daily, others will too |

## Functional Requirements

### User Management

- **FR1:** Users can sign up for an account
- **FR2:** Users can log in and log out
- **FR3:** Users can receive a unique dedicated email address upon registration
- **FR4:** Users can view and manage their account settings

### Email Infrastructure

- **FR5:** System can receive emails at user's dedicated address
- **FR6:** System can parse and store incoming newsletter content
- **FR7:** System can detect and identify newsletter senders automatically
- **FR8:** Users see new newsletters appear in real-time without refresh

### Gmail Import

- **FR9:** Users can connect their Gmail account via OAuth
- **FR10:** System can scan Gmail for newsletter senders
- **FR11:** Users can review and approve detected newsletter senders
- **FR12:** System can import historical emails from approved senders
- **FR13:** Users can disconnect their Gmail account

### Newsletter Reading

- **FR14:** Users can view all newsletters organized by folder. Each folder contains one or more senders.
- **FR15:** Users can read newsletter content in a clean interface
- **FR16:** Users can browse newsletters by folder (primary navigation)
- **FR17:** Users can mark newsletters as read
- **FR18:** Users can hide newsletters without unsubscribing

### AI Features

- **FR19:** Users can generate an AI summary of any newsletter
- **FR20:** System displays summary alongside original content

### Community Database

- **FR21:** All user newsletters are private by default. Community database is populated exclusively by admin curation.
- ~~**FR22:** Users can mark specific senders as private (excluded from sharing)~~ **REMOVED** - No longer needed; all private by default
- **FR23:** Users can browse and import newsletters from the admin-curated community database to their personal collection
- **FR24:** New users can browse newsletters they haven't personally received

### Admin & Operations

- **FR25:** Admin can view system health metrics
- **FR26:** Admin can monitor email delivery status
- **FR27:** Admin can review user newsletters and publish sanitized versions to community database
- **FR28:** Admin can manage community database content

### Folder Architecture (Course Correction - 2026-02-01)

- **FR37:** Senders are global (shared across all users and community)
- **FR38:** New senders are automatically mapped to a new folder on first receipt
- **FR39:** Users can merge folders to combine multiple senders into one folder
- **FR40:** Users can hide folders (soft-archive all newsletters within)
- **FR41:** Users can rename folders
- **FR42:** Admin can publish a newsletter to community by creating a sanitized copy (original user content unchanged)
- **FR43:** Users can import community newsletters to their existing folders, merging with their private collection from the same sender
- **FR44:** User's folder view shows both private and community-imported newsletters, sorted by date, with visual indicator of source

## Non-Functional Requirements

### Performance

- **NFR1:** Newsletter list loads within 1 second
- **NFR2:** Individual newsletter renders within 500ms
- **NFR3:** AI summary generates within 10 seconds
- **NFR4:** Real-time updates appear within 2 seconds of email receipt

### Security

- **NFR5:** All data encrypted in transit (HTTPS)
- **NFR6:** OAuth tokens stored securely, never exposed to client
- **NFR7:** Private newsletters never synced to community database
- **NFR8:** User data handling complies with GDPR basics (delete on request)

### Reliability

- **NFR9:** Email delivery has zero message loss (critical path)
- **NFR10:** System gracefully handles Gmail OAuth token expiry
- **NFR11:** AI summarization failures don't block reading experience

### Integration

- **NFR12:** Gmail OAuth follows Google's current API requirements
- **NFR13:** Cloudflare Email Workers handle standard newsletter formats
- **NFR14:** Convex subscriptions maintain connection stability
