---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - brainstorming-session-2026-01-13.md
date: 2026-01-14
author: Teogoulois
project_name: newsletter manager
status: complete
---

# Product Brief: Newsletter Manager

## Executive Summary

Newsletter Manager is an open-source newsletter reader that gives users a dedicated inbox for their subscriptions, separating newsletter content from their primary email while providing power features like AI analysis and audio conversion. Built for people who want control over their reading experience, it offers both self-hosted deployment and a convenient hosted option.

**Core Value:** Get newsletters out of your main inbox. Read them on your terms. Transform them into formats that fit your life.

---

## Core Vision

### Problem Statement

Email newsletters have become a major source of inbox pollution. Subscribers accumulate dozens of newsletters they genuinely want to read but lack time for, creating a backlog that clutters their primary inbox and generates constant low-level guilt. Current solutions either don't exist, are closed-source with no self-hosting option, or lack meaningful features for managing newsletter overload.

### Problem Impact

- **Inbox pollution**: Newsletters compete with work emails, personal messages, and urgent communications
- **Reading backlog**: Interesting content piles up unread, becoming noise rather than value
- **Loss of control**: Users can't easily analyze, search, or transform their newsletter content
- **Platform lock-in**: Existing tools like Meco are closed-source with no data portability or self-hosting

### Why Existing Solutions Fall Short

**Meco and similar tools:**
- Closed source with no self-hosting option
- Users must trust a third party with all their reading data
- No path to data ownership or privacy control

**Email clients:**
- Newsletters mixed with everything else
- No specialized reading experience
- No power features for newsletter-specific workflows

### Proposed Solution

A dedicated newsletter management app that:
1. Provides a unique email address exclusively for newsletter subscriptions
2. Imports existing newsletters from Gmail and other providers
3. Offers a clean, focused reading experience separate from main email
4. Enables power features: AI summarization, audio conversion, full-text search
5. Supports both self-hosted deployment and a convenient hosted tier

### Key Differentiators

| Differentiator | Why It Matters |
|----------------|----------------|
| **Open Source** | Transparency, community trust, no vendor lock-in |
| **Self-Hostable** | Full data ownership for privacy-conscious users |
| **Hosted Option** | Convenience for users who don't want infrastructure overhead |
| **Power Features** | Analysis, audio conversion, and control beyond basic reading |

---

## Target Users

### Primary User: The Newsletter Collector

**Profile:** Someone who subscribes to many newsletters they genuinely want to read, but these newsletters pollute their main inbox and pile up unread.

**Characteristics:**
- Subscribes to 10-50+ newsletters across various interests
- Newsletters compete with work/personal email for attention
- Values open source software and data transparency
- Comfortable using a cloud-hosted service
- Wants the product to "just work" without complexity

**Core Need:** A dedicated inbox that separates newsletters from everything else, with room to grow into power features (AI summaries, audio) over time.

**Success Looks Like:** Opening the app, seeing only newsletters organized cleanly, and reading without guilt or distraction from other emails.

### Secondary Users

N/A for MVP - focusing on the primary use case first.

### User Journey

1. **Discovery:** Finds the project on GitHub or through word-of-mouth
2. **Onboarding:** Signs up, gets a dedicated email address, imports existing newsletters from Gmail
3. **Core Usage:** Checks the app when ready to read, browses by newsletter or category
4. **Success Moment:** Realizes their main inbox is clean and newsletters are waiting patiently in one place
5. **Long-term:** Power features (summaries, audio) become part of the routine

---

## Success Metrics

### Core Success Criteria

**The "Yes, It Works" Moment:**
1. Can receive newsletters at a custom/dedicated email address
2. Can import existing newsletters from current email client (Gmail)
3. Can read newsletters in a clean, dedicated interface

If these three things work, the MVP is successful.

### Project Success Definition

| Criteria | Measurement |
|----------|-------------|
| **Functional** | The app works and can be used daily |
| **Personal Use** | Creator (and users like them) actually use it |
| **Open Source** | Code is public on GitHub |

### Nice-to-Have Metrics (Post-MVP)

Basic usage insights for personal curiosity:

- **Newsletters received:** Count of newsletters in the system
- **Reading activity:** Which newsletters get opened/read
- **Time saved:** Estimate based on newsletters processed vs. inbox clutter avoided

### What We're NOT Measuring

- GitHub stars or social proof
- User acquisition funnels
- Conversion rates
- Revenue metrics

This is a tool that works, not a growth machine.

---

## MVP Scope

### Core Features

**1. Email Infrastructure**
- Dedicated email address per user (e.g., user@newslettermanager.app)
- Receive and store incoming newsletters
- Newsletter sender detection (auto-identify newsletter sources)

**2. Gmail Import**
- OAuth connection to Gmail
- Detect newsletter senders automatically
- Import existing newsletters from identified senders
- Pull historical emails from newsletter senders

**3. Reader Interface**
- Clean, focused reading experience
- Category/folder organization
- Default: one folder per sender (auto-created)
- Browse by sender or category

**4. Authentication & Hosting**
- User accounts with Better Auth (or similar)
- Cloud-hosted infrastructure
- Secure, production-ready auth flow

**5. Basic AI Summarization**
- AI-generated summary per newsletter
- Simple one-click summarize functionality

**6. Shared Newsletter Database**
- All newsletters stored in central database
- Default: newsletters are shared (visible in back-catalog)
- Users can mark specific newsletters/senders as "private" (stored but hidden from others)
- New users see historical issues from shared newsletters

### Out of Scope for MVP

| Feature | Status | Rationale |
|---------|--------|-----------|
| Audio conversion | Post-MVP | Nice-to-have, not core |
| Mobile app | Post-MVP | Web-first, mobile later |
| Community features | Post-MVP | No social, comments, likes |
| Self-hosting docs | Post-MVP | Cloud-first, self-host later |
| Advanced analytics | Post-MVP | Basic metrics only |

### MVP Success Criteria

The MVP is complete when:
1. Users can sign up and get a dedicated email address
2. Users can import newsletters from Gmail
3. Newsletters are organized by sender (folders)
4. Users can read newsletters in a clean interface
5. Users can generate AI summaries of newsletters
6. New users can access back-catalog from shared database
7. Users can mark newsletters as private

### Future Vision

Post-MVP enhancements:
- Audio conversion (listen to newsletters)
- Mobile apps (iOS/Android via Expo)
- Advanced AI features (cross-newsletter insights, topic extraction)
- Self-hosting documentation and Docker deployment
- Newsletter discovery ("readers of X also like Y")
