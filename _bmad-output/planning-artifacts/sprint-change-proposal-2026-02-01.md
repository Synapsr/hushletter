# Sprint Change Proposal - Privacy-First & Folder-Centric Architecture

**Date:** 2026-02-01
**Author:** John (PM Agent)
**Status:** APPROVED
**Approved By:** Teogoulois

---

## Executive Summary

Two architectural changes based on stakeholder feedback:

1. **Privacy-First Community:** All user newsletters are private. Admin curates community content by creating sanitized copies.

2. **Folder-Centric Architecture:** Users see folders, not senders. Senders live inside folders. All actions at folder level.

**Key Principles:**
- User newsletters and community newsletters are **completely separate entities**
- Senders are **global** (shared across users and community)
- Users can **merge** private + community newsletters in the same folder
- Admin creates **sanitized copies** for community (user's original unchanged)

---

## Issue Summary

### Change 1: Privacy-First Community Model

**Problem:** Newsletters contain personalized data (names, unsubscribe tokens, tracking IDs) that could expose PII if shared to community by default. Current design puts privacy burden on users who may not realize the risk.

**Solution:** All newsletters private by default. Admin manually reviews and publishes sanitized versions to community database.

### Change 2: Folder-Centric Architecture

**Problem:** Managing both senders AND folders creates cognitive overhead. Users need a single organizational primitive that supports all operations (hide, merge, reorganize).

**Solution:** Replace sender-based navigation with folder-based navigation. Senders live inside folders; all user actions happen at folder level.

---

## Impact Analysis

### Epic Impact

| Epic | Impact Level | Notes |
|------|--------------|-------|
| Epic 1 (Foundation) | None | No changes needed |
| Epic 2 (Email Reception) | Low | Privacy default changes |
| Epic 2.5 (Content Sharing) | HIGH | Deduplication model changes significantly |
| Epic 3 (Reading Experience) | HIGH | Folder-centric view replaces sender view |
| Epic 4 (Gmail Import) | Low | Imported newsletters private by default |
| Epic 5 (AI Summaries) | None | No direct impact |
| Epic 6 (Community) | HIGH | Admin-curated model replaces user-contributed |
| Epic 7 (Admin) | HIGH | New admin curation workflows needed |
| Epic 8 (Manual Import) | Low | Imported newsletters private by default |

### Artifact Changes Required

| Artifact | Impact |
|----------|--------|
| **PRD** | 4 modified FRs, 8 new FRs |
| **Architecture** | Schema redesign, new patterns |
| **UX Design** | Folder-centric navigation, admin curation UI |
| **Epics** | New Epic 9 with 10 stories |

---

## Data Architecture

### Core Principle

```
USER'S PRIVATE WORLD          COMMUNITY DATABASE
─────────────────────         ──────────────────
userNewsletters               newsletterContent
  privateR2Key: ✓               r2Key: sanitized
  contentId: null               communityApprovedBy: admin

COMPLETELY SEPARATE STORAGE
User's content NEVER becomes community content directly
Admin creates sanitized COPY for community
```

### Global Senders

Senders are shared across all users and community:
- Same sender ID referenced by user newsletters AND community newsletters
- Enables "Browse community newsletters from Morning Brew"
- Enables merging private + community in same folder

### Unified Folder View

Users see both private and community-imported newsletters in one folder:
- Private: stored with `privateR2Key`
- Community import: references `contentId`
- Both sorted by date, with source indicator (📧 private / 🌐 community)

---

## Schema Design

```typescript
// GLOBAL - Shared across all users and community
senders: defineTable({
  email: v.string(),
  name: v.optional(v.string()),
  domain: v.string(),
})

// COMMUNITY - Admin-curated only
newsletterContent: defineTable({
  r2Key: v.string(),                    // Sanitized content
  subject: v.string(),
  senderId: v.id("senders"),            // Global sender
  originalDate: v.number(),
  communityApprovedAt: v.number(),
  communityApprovedBy: v.id("users"),
  importCount: v.number(),
})

// USER - Folders as primary organization
folders: defineTable({
  userId: v.id("users"),
  name: v.string(),
  isHidden: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
})

// USER - Sender-to-folder mapping
userSenderSettings: defineTable({
  userId: v.id("users"),
  senderId: v.id("senders"),
  folderId: v.id("folders"),            // Required
})

// USER - Newsletters (private OR community import)
userNewsletters: defineTable({
  userId: v.id("users"),
  senderId: v.id("senders"),
  folderId: v.id("folders"),            // Required

  // Content source - ONE of these set
  privateR2Key: v.optional(v.string()), // User's own
  contentId: v.optional(v.id("newsletterContent")), // From community

  source: v.union(
    v.literal("email"),
    v.literal("gmail"),
    v.literal("manual"),
    v.literal("community")
  ),

  subject: v.string(),
  senderEmail: v.string(),
  senderName: v.optional(v.string()),
  receivedAt: v.number(),
  isRead: v.boolean(),
  isHidden: v.boolean(),
  readProgress: v.optional(v.number()),
})
```

---

## PRD Changes

### Modified Requirements

| ID | Change |
|----|--------|
| FR14 | "Users can view all newsletters organized by **folder**" |
| FR21 | "All user newsletters are **private by default**. Community populated by admin curation." |
| FR22 | **REMOVED** — No longer needed |
| FR23 | "Users can browse and **import** from admin-curated community" |
| FR27 | "Admin can **publish sanitized versions** to community" |

### New Requirements

| ID | Requirement |
|----|-------------|
| FR37 | Senders are global (shared across users and community) |
| FR38 | New senders auto-create a folder |
| FR39 | Users can merge folders |
| FR40 | Users can hide folders |
| FR41 | Users can rename folders |
| FR42 | Admin publishes by creating sanitized copy |
| FR43 | Users can import community newsletters to their folders |
| FR44 | Folder view shows private + community together with source indicator |

---

## Epic 9: Course Correction

| Story | Title |
|-------|-------|
| 9.1 | Schema Migration |
| 9.2 | Private-by-Default |
| 9.3 | Folder Auto-Creation |
| 9.4 | Folder-Centric Navigation |
| 9.5 | Folder Actions (merge, hide, rename) |
| 9.6 | Admin Moderation Queue |
| 9.7 | Admin Publish Flow |
| 9.8 | Community Browse |
| 9.9 | Community Import |
| 9.10 | Unified Folder View |

---

## Implementation Handoff

| Role | Responsibility |
|------|----------------|
| **PM** | Update PRD with modified/new FRs |
| **Architect** | Update architecture with new schema |
| **SM** | Create Epic 9 in sprint-status.yaml |
| **Dev** | Implement stories 9.1 → 9.10 |

**Scope Classification:** MODERATE
- Significant changes but no fundamental replan needed
- All existing epics remain valid
- New epic contains all correction work

---

## Approval

- [x] Sprint Change Proposal reviewed
- [x] Impact analysis complete
- [x] Schema design approved
- [x] PRD changes identified
- [x] Epic 9 stories defined
- [x] **APPROVED BY USER: 2026-02-01**

---

## Next Steps

1. Update PRD with new/modified requirements
2. Update Architecture document with new schema
3. Add Epic 9 to epics.md
4. Update sprint-status.yaml with Epic 9 stories
5. Begin implementation with Story 9.1 (Schema Migration)
