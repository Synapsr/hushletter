# Story 3.5: Hide Newsletters

Status: completed

## Story

As a **user managing my inbox**,
I want **to hide newsletters without unsubscribing**,
so that **I can declutter my view without losing the subscription**.

## Acceptance Criteria

**AC1: Hide from List/Detail View**
**Given** I am viewing a newsletter (list or detail)
**When** I click the hide button
**Then** the newsletter is hidden from my main views
**And** a confirmation or undo option is briefly shown

**AC2: Hidden Newsletters Excluded from Main List**
**Given** newsletters are hidden
**When** I view my main newsletter list
**Then** hidden newsletters are not displayed

**AC3: View Hidden Newsletters**
**Given** I want to see hidden newsletters
**When** I navigate to a "Hidden" filter or section
**Then** I can view all my hidden newsletters

**AC4: Unhide/Restore Newsletter**
**Given** I am viewing a hidden newsletter
**When** I click "Unhide" or "Restore"
**Then** the newsletter returns to my main views

**AC5: Subscription Preserved**
**Given** I hide a newsletter
**When** checking my subscription status
**Then** the sender remains active (not unsubscribed)
**And** future newsletters from that sender still arrive

## Tasks / Subtasks

- [x] Task 1: Create public mutations for hide/unhide (AC: 1, 4)
  - [x] 1.1 Create `hideNewsletter` public mutation in newsletters.ts (wraps internal toggleHidden)
  - [x] 1.2 Create `unhideNewsletter` public mutation in newsletters.ts
  - [x] 1.3 Add ownership validation to both public mutations

- [x] Task 2: Update queries to filter hidden newsletters by default (AC: 2)
  - [x] 2.1 Modify `listUserNewsletters` to exclude hidden newsletters
  - [x] 2.2 Modify `listUserNewslettersBySender` to exclude hidden newsletters
  - [x] 2.3 Modify `listUserNewslettersByFolder` to exclude hidden newsletters
  - [x] 2.4 Update senders' unread counts to exclude hidden newsletters

- [x] Task 3: Create query for hidden newsletters (AC: 3)
  - [x] 3.1 Create `listHiddenNewsletters` query in newsletters.ts
  - [x] 3.2 Add index optimization if needed for hidden filter (uses existing by_userId_receivedAt index)

- [x] Task 4: Add hide button to newsletter detail view (AC: 1)
  - [x] 4.1 Add EyeOff icon button to NewsletterHeader component in $id.tsx
  - [x] 4.2 Call hideNewsletter mutation on click
  - [x] 4.3 Navigate back to list after hiding

- [x] Task 5: Add hide action to newsletter list items (AC: 1)
  - [x] 5.1 Add hover action button to NewsletterCard (EyeOff icon appears on hover)
  - [x] 5.2 Add "Hide" option using EyeOff icon
  - [x] 5.3 Event propagation stopped to prevent navigation on hide click

- [x] Task 6: Add "Hidden" filter to SenderSidebar navigation (AC: 3)
  - [x] 6.1 Add "Hidden" section/link in SenderSidebar component
  - [x] 6.2 Show count of hidden newsletters as badge
  - [x] 6.3 Update URL routing: /newsletters?filter=hidden

- [x] Task 7: Create hidden newsletters view (AC: 3, 4)
  - [x] 7.1 Update newsletters/index.tsx to handle filter=hidden param
  - [x] 7.2 Show "Unhide" button instead of "Hide" for hidden items (showUnhide prop)
  - [x] 7.3 Show empty state when no hidden newsletters

- [x] Task 8: Add tests (AC: 1-5)
  - [x] 8.1 Backend contract tests for hideNewsletter, unhideNewsletter mutations
  - [x] 8.2 Backend tests for hidden newsletter filtering in queries
  - [x] 8.3 Frontend tests for hide/unhide UI interactions (SenderSidebar Hidden section tests)

## Dev Notes

### Implementation Summary

**Backend Changes:**
- Added `hideNewsletter` and `unhideNewsletter` public mutations following Story 3.4 patterns
- Added `listHiddenNewsletters` query to fetch only hidden newsletters
- Modified `listUserNewsletters`, `listUserNewslettersBySender`, `listUserNewslettersByFolder` to filter out hidden newsletters
- Modified `listSendersForUserWithUnreadCounts` in senders.ts to exclude hidden from counts

**Frontend Changes:**
- Added Hide/Unhide button to NewsletterHeader in detail view
- Added hover-revealed Hide button to NewsletterCard (EyeOff icon)
- Added Hidden section to SenderSidebar with count badge
- Added filter=hidden URL param handling to newsletters index page
- Added showUnhide prop to NewsletterCard for hidden newsletters view

**Key Design Decisions:**
1. No toast implementation - toast component doesn't exist in project; navigation feedback sufficient
2. Hover-reveal Hide button instead of dropdown menu - simpler, dropdown component not available
3. Filter in JavaScript post-query (no new DB index needed) per NFR1 guidance

### File Changes

**Backend (packages/backend/convex/):**
- `newsletters.ts` - ADDED: hideNewsletter, unhideNewsletter, listHiddenNewsletters; MODIFIED: listUserNewsletters, listUserNewslettersBySender, listUserNewslettersByFolder
- `senders.ts` - MODIFIED: listSendersForUserWithUnreadCounts to exclude hidden from counts
- `newsletters.test.ts` - ADDED: Story 3.5 contract tests (hideNewsletter, unhideNewsletter, listHiddenNewsletters, hidden filtering behavior, AC tests)

**Frontend (apps/web/src/):**
- `components/NewsletterCard.tsx` - ADDED: Hide button on hover, useMutation hooks, showUnhide prop
- `components/SenderSidebar.tsx` - ADDED: Hidden section, selectedFilter/onFilterSelect/hiddenCount props
- `routes/_authed/newsletters/$id.tsx` - ADDED: Hide/Unhide button to header, hideNewsletter/unhideNewsletter mutations
- `routes/_authed/newsletters/index.tsx` - ADDED: filter=hidden URL param handling, listHiddenNewsletters query
- `components/NewsletterCard.test.tsx` - ADDED: Convex mock for hide/unhide mutations
- `components/SenderSidebar.test.tsx` - ADDED: Hidden section tests, updated props for new parameters

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None

### Completion Notes List

1. All tasks completed successfully
2. Backend tests pass (311 total)
3. Frontend tests pass for NewsletterCard (26 tests) and SenderSidebar (28 tests)
4. Pre-existing test failures in DedicatedEmailDisplay (clipboard mock) and signup (missing import) are unrelated to this story
5. TypeScript compilation passes for frontend
6. Code Review #2 completed - 8 fixes applied (2 HIGH, 4 MEDIUM, 2 LOW documented)

### Code Review Fixes Applied

1. **Consolidated redundant query** - Removed duplicate `listHiddenNewsletters` query in index.tsx; now using single query for both count and display
2. **Added error handling** - Added try-catch blocks to hide/unhide handlers in NewsletterCard.tsx and $id.tsx
3. **Consistent async patterns** - Made handleUnhide async to match handleHide pattern

#### Second Code Review Fixes (Code Review #2)

4. **HIGH-1: Added confirmation feedback (AC1)** - Added visual feedback when hiding/unhiding newsletters:
   - Detail view ($id.tsx): Shows "Newsletter hidden" confirmation message before navigating back
   - List view (NewsletterCard.tsx): Shows "Hiding..." state and handles success/error feedback
   - Addresses AC1 requirement "confirmation or undo option is briefly shown"

5. **HIGH-2: Added missing hide/unhide tests** - Added comprehensive tests to NewsletterCard.test.tsx:
   - Tests for hide/unhide button rendering
   - Tests for mutation calls on click
   - Tests for event propagation stopping
   - Tests for error handling
   - Tests for mobile visibility styling

6. **MEDIUM-2: Added URL param validation** - Added `isValidConvexId()` validation in index.tsx:
   - Validates sender/folder IDs before passing to Convex queries
   - Prevents invalid URL params from causing server errors

7. **MEDIUM-3: Fixed mobile button visibility** - Hide button now visible on mobile:
   - Changed from `opacity-0` to `opacity-50 md:opacity-0`
   - Button is subtly visible on touch devices where hover doesn't work

8. **MEDIUM-1: Documented async handler pattern** - Added comments explaining intentional async void return pattern

### File List

- packages/backend/convex/newsletters.ts
- packages/backend/convex/senders.ts
- packages/backend/convex/newsletters.test.ts
- apps/web/src/components/NewsletterCard.tsx
- apps/web/src/components/NewsletterCard.test.tsx
- apps/web/src/components/SenderSidebar.tsx
- apps/web/src/components/SenderSidebar.test.tsx
- apps/web/src/routes/_authed/newsletters/$id.tsx
- apps/web/src/routes/_authed/newsletters/index.tsx
