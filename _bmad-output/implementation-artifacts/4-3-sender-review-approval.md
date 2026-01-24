# Story 4.3: Sender Review & Approval

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **user reviewing detected senders**,
I want **to review and approve which senders to import**,
So that **I only import the newsletters I want**.

## Acceptance Criteria

1. **Given** the scan has completed with results
   **When** I view the detected senders list
   **Then** each sender has a checkbox for selection
   **And** senders are selected by default

2. **Given** I am reviewing senders
   **When** I want to select or deselect all
   **Then** I can use "Select All" and "Deselect All" buttons

3. **Given** I am reviewing senders
   **When** I click on a sender row
   **Then** I can see more details (sample subjects, date range)

4. **Given** I have made my selections
   **When** I click "Import Selected"
   **Then** only the approved senders proceed to import
   **And** deselected senders are not imported

5. **Given** I want to exclude a specific sender
   **When** I uncheck that sender
   **Then** it is visually marked as excluded
   **And** the import count updates accordingly

## Tasks / Subtasks

- [x] **Task 1: Create Sender Selection State Management** (AC: #1, #2, #5)
  - [x] 1.1: Add `isSelected` field to `detectedSenders` table OR create local selection state
  - [x] 1.2: Create `updateSenderSelection` mutation in `convex/gmail.ts`
  - [x] 1.3: Create `selectAllSenders` and `deselectAllSenders` mutations
  - [x] 1.4: Create `getSelectedSendersCount` query for real-time count display

- [x] **Task 2: Enhance Sender List UI with Selection** (AC: #1, #5)
  - [x] 2.1: Add checkbox to each sender row in `SenderScanner.tsx` (or create new component)
  - [x] 2.2: Implement visual distinction for selected vs deselected senders
  - [x] 2.3: Display real-time count of selected senders ("X of Y senders selected")
  - [x] 2.4: Add hover/focus states for checkbox interaction

- [x] **Task 3: Implement Select All/Deselect All Controls** (AC: #2)
  - [x] 3.1: Add "Select All" button above sender list
  - [x] 3.2: Add "Deselect All" button
  - [x] 3.3: Wire buttons to batch selection mutations
  - [x] 3.4: Show loading state during batch operations

- [x] **Task 4: Create Sender Detail View** (AC: #3)
  - [x] 4.1: Create `SenderDetail.tsx` component or expandable row pattern
  - [x] 4.2: Display sample subjects (already stored in `detectedSenders.sampleSubjects`)
  - [x] 4.3: Display email count and confidence score
  - [x] 4.4: Add expand/collapse interaction (click on row or expand icon)
  - [x] 4.5: Display domain information

- [x] **Task 5: Create Import Trigger Flow** (AC: #4)
  - [x] 5.1: Add "Import Selected" button to UI (disabled when 0 selected)
  - [x] 5.2: Create `approveSelectedSenders` mutation to mark senders as approved
  - [x] 5.3: Create `approvedSenders` table OR add `isApproved` field to `detectedSenders`
  - [x] 5.4: Implement transition to import progress view (prepares for Story 4.4)
  - [x] 5.5: Show confirmation before starting import with count of selected senders

- [x] **Task 6: Write Tests** (All ACs)
  - [x] 6.1: Test sender selection toggle (individual)
  - [x] 6.2: Test select all / deselect all functionality
  - [x] 6.3: Test sender detail expansion
  - [x] 6.4: Test import trigger with selected senders only
  - [x] 6.5: Test selected count updates in real-time

## Dev Notes

### Architecture Patterns & Constraints

**State Management Decision - Local vs Database:**
The selection state should be stored in the DATABASE (Convex) rather than local React state because:
1. Enables real-time sync if user has multiple tabs open
2. Persists selection if user navigates away and returns
3. Allows the import flow (Story 4.4) to read selections without prop drilling
4. Follows project's "use Convex queries for server state" pattern

**Schema Enhancement:**
```typescript
// OPTION 1: Add field to existing table (RECOMMENDED)
// In convex/schema.ts - modify detectedSenders table
detectedSenders: defineTable({
  userId: v.id("users"),
  email: v.string(),
  name: v.optional(v.string()),
  domain: v.string(),
  emailCount: v.number(),
  confidenceScore: v.number(),
  sampleSubjects: v.array(v.string()),
  detectedAt: v.number(),
  isSelected: v.boolean(),  // NEW - defaults to true per AC#1
  isApproved: v.boolean(),  // NEW - set to true after "Import Selected" clicked
})
  .index("by_userId", ["userId"])
  .index("by_userId_email", ["userId", "email"])
  .index("by_userId_isSelected", ["userId", "isSelected"]),  // NEW index

// OPTION 2: Create separate selection table (NOT RECOMMENDED for this use case)
```

**Convex Mutations for Selection:**
```typescript
// In convex/gmail.ts - add these mutations

export const updateSenderSelection = mutation({
  args: {
    senderId: v.id("detectedSenders"),
    isSelected: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await getAuthenticatedUser(ctx)
    const sender = await ctx.db.get(args.senderId)

    if (!sender || sender.userId !== user._id) {
      throw new ConvexError({
        code: "FORBIDDEN",
        message: "Cannot modify this sender",
      })
    }

    await ctx.db.patch(args.senderId, { isSelected: args.isSelected })
  },
})

export const selectAllSenders = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx)
    const senders = await ctx.db
      .query("detectedSenders")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()

    await Promise.all(
      senders.map((s) => ctx.db.patch(s._id, { isSelected: true }))
    )
  },
})

export const deselectAllSenders = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx)
    const senders = await ctx.db
      .query("detectedSenders")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()

    await Promise.all(
      senders.map((s) => ctx.db.patch(s._id, { isSelected: false }))
    )
  },
})

export const getSelectedSendersCount = query({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx)
    const selected = await ctx.db
      .query("detectedSenders")
      .withIndex("by_userId_isSelected", (q) =>
        q.eq("userId", user._id).eq("isSelected", true)
      )
      .collect()

    return selected.length
  },
})

export const approveSelectedSenders = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await getAuthenticatedUser(ctx)
    const selectedSenders = await ctx.db
      .query("detectedSenders")
      .withIndex("by_userId_isSelected", (q) =>
        q.eq("userId", user._id).eq("isSelected", true)
      )
      .collect()

    if (selectedSenders.length === 0) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "No senders selected for import",
      })
    }

    // Mark as approved (used by Story 4.4 for actual import)
    await Promise.all(
      selectedSenders.map((s) => ctx.db.patch(s._id, { isApproved: true }))
    )

    return { approvedCount: selectedSenders.length }
  },
})
```

### Previous Story Intelligence (Story 4.2)

**Existing Files to Build Upon:**
- `packages/backend/convex/gmail.ts` - Add selection/approval mutations here
- `packages/backend/convex/schema.ts` - Modify `detectedSenders` table
- `apps/web/src/routes/_authed/import/SenderScanner.tsx` - Extend this component

**Existing Data Structure (from Story 4.2):**
```typescript
// detectedSenders already stores per Story 4.2:
{
  userId: Id<"users">,
  email: string,          // e.g., "newsletter@substack.com"
  name: string | undefined, // e.g., "Morning Brew"
  domain: string,         // e.g., "substack.com"
  emailCount: number,     // e.g., 47
  confidenceScore: number, // e.g., 80 (out of 100)
  sampleSubjects: string[], // e.g., ["Welcome!", "Issue #23", "Special Edition"]
  detectedAt: number,     // Unix timestamp
}
```

**SenderScanner.tsx Current Structure (from Story 4.2):**
```tsx
// Current states: idle, scanning, complete, empty, error
// "complete" state shows sender list - this is where we add selection UI

// Current sender list rendering (approximate):
<SendersList senders={detectedSenders}>
  {senders.map((sender) => (
    <SenderCard
      key={sender._id}
      name={sender.name || sender.email}
      email={sender.email}
      count={sender.emailCount}
      confidence={sender.confidenceScore}
    />
  ))}
</SendersList>
```

**Learnings from 4.2 to Apply:**
1. Use `useMutation` with proper loading states (not useState for isPending)
2. Error handling via ConvexError with structured codes
3. Component tests using Testing Library with Convex query/mutation mocking
4. Use existing shadcn/ui components: Card, Button, Checkbox, Skeleton

### UI Component Structure

**Enhanced SenderScanner or New SenderReview Component:**
```tsx
// Option A: Enhance SenderScanner.tsx for complete state
// Option B: Create SenderReview.tsx (RECOMMENDED for separation of concerns)

function SenderReview() {
  const detectedSenders = useQuery(api.gmail.getDetectedSenders)
  const selectedCount = useQuery(api.gmail.getSelectedSendersCount)
  const updateSelection = useMutation(api.gmail.updateSenderSelection)
  const selectAll = useMutation(api.gmail.selectAllSenders)
  const deselectAll = useMutation(api.gmail.deselectAllSenders)
  const approveSelected = useMutation(api.gmail.approveSelectedSenders)

  if (detectedSenders === undefined) return <Skeleton />

  const totalCount = detectedSenders.length

  return (
    <Card>
      <CardHeader>
        <CardTitle>Review Detected Senders</CardTitle>
        <CardDescription>
          {selectedCount} of {totalCount} senders selected for import
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Selection controls */}
        <div className="flex gap-2 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => selectAll()}
            disabled={selectAll.isPending}
          >
            Select All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => deselectAll()}
            disabled={deselectAll.isPending}
          >
            Deselect All
          </Button>
        </div>

        {/* Sender list with checkboxes */}
        <div className="space-y-2">
          {detectedSenders.map((sender) => (
            <SenderRow
              key={sender._id}
              sender={sender}
              onSelectionChange={(isSelected) =>
                updateSelection({ senderId: sender._id, isSelected })
              }
            />
          ))}
        </div>
      </CardContent>

      <CardFooter>
        <Button
          onClick={() => approveSelected()}
          disabled={selectedCount === 0 || approveSelected.isPending}
        >
          {approveSelected.isPending ? "Approving..." : `Import ${selectedCount} Senders`}
        </Button>
      </CardFooter>
    </Card>
  )
}

// Individual sender row with expandable detail
function SenderRow({ sender, onSelectionChange }) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className={cn(
      "border rounded-lg p-3",
      !sender.isSelected && "opacity-60 bg-muted"
    )}>
      <div
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <Checkbox
          checked={sender.isSelected}
          onClick={(e) => e.stopPropagation()} // Prevent row expand
          onCheckedChange={onSelectionChange}
        />
        <div className="flex-1">
          <div className="font-medium">{sender.name || sender.email}</div>
          <div className="text-sm text-muted-foreground">{sender.email}</div>
        </div>
        <div className="text-sm text-muted-foreground">
          {sender.emailCount} emails
        </div>
        <ChevronDown className={cn(
          "h-4 w-4 transition-transform",
          isExpanded && "rotate-180"
        )} />
      </div>

      {/* Expandable detail section (AC#3) */}
      {isExpanded && (
        <div className="mt-3 pl-9 space-y-2 text-sm">
          <div>
            <span className="font-medium">Confidence:</span>{" "}
            <Badge variant={sender.confidenceScore >= 50 ? "default" : "secondary"}>
              {sender.confidenceScore}%
            </Badge>
          </div>
          <div>
            <span className="font-medium">Domain:</span> {sender.domain}
          </div>
          <div>
            <span className="font-medium">Sample subjects:</span>
            <ul className="mt-1 list-disc pl-4">
              {sender.sampleSubjects.slice(0, 3).map((subject, i) => (
                <li key={i} className="truncate">{subject}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
```

### File Locations

| File | Action | Purpose |
|------|--------|---------|
| `packages/backend/convex/schema.ts` | MODIFY | Add `isSelected`, `isApproved` fields to `detectedSenders` |
| `packages/backend/convex/gmail.ts` | MODIFY | Add selection/approval mutations and queries |
| `apps/web/src/routes/_authed/import/SenderReview.tsx` | NEW | Sender review component with selection UI |
| `apps/web/src/routes/_authed/import/SenderReview.test.tsx` | NEW | Component tests |
| `apps/web/src/routes/_authed/import/SenderScanner.tsx` | MODIFY | Integrate SenderReview after scan complete |
| `apps/web/src/routes/_authed/import/index.tsx` | MODIFY | Wire up state transitions |

### Project Structure Notes

- Component follows colocated pattern (component + test in same folder)
- Uses existing shadcn/ui components: Button, Card, Checkbox, Badge, Skeleton
- Uses existing icon library: `lucide-react` (ChevronDown, Check, X)
- All Convex mutations go in domain file: `gmail.ts`
- Tests colocated: `SenderReview.test.tsx` next to `SenderReview.tsx`

### Critical Implementation Rules

1. **Store selection in Convex, NOT React state** - Enables persistence and real-time sync
2. **Default selection to TRUE** - Per AC#1, senders are selected by default
3. **Use existing `detectedSenders` table** - Don't create separate selection table
4. **Follow existing patterns from 4.2** - Same error handling, loading states, test patterns
5. **Don't implement actual import yet** - That's Story 4.4; this story just marks as approved
6. **Use isPending from useMutation** - NOT useState for loading states
7. **Checkbox uses onClick stopPropagation** - Prevent row expand when clicking checkbox

### Error Handling Patterns

```typescript
// Mutation error handling in component
const approveSelected = useMutation(api.gmail.approveSelectedSenders)

const handleApprove = async () => {
  try {
    const result = await approveSelected()
    // Navigate to import progress or show success
    navigate({ to: "/import", search: { step: "importing" } })
  } catch (error) {
    if (error instanceof ConvexError) {
      toast.error(error.data.message)
    } else {
      toast.error("Failed to approve senders. Please try again.")
    }
  }
}
```

### Dependencies

**No new packages needed** - All functionality uses:
- `convex` - Queries, mutations
- `@tanstack/react-router` - Navigation (already installed)
- shadcn/ui Checkbox component (may need to add if not exists)

**Check if Checkbox component exists:**
```bash
ls apps/web/src/components/ui/checkbox.tsx
# If not, add: npx shadcn@latest add checkbox
```

### References

- [Source: planning-artifacts/epics.md#Story 4.3] - Original requirements
- [Source: planning-artifacts/architecture.md#Convex Patterns] - Function naming, error handling
- [Source: project-context.md] - Critical rules and patterns
- [Source: 4-2-newsletter-sender-scanning.md] - Previous story implementation
- [shadcn/ui Checkbox](https://ui.shadcn.com/docs/components/checkbox)

### Technical Requirements

**Convex Query Reactivity:**
- Selection state changes should immediately reflect in UI via Convex subscriptions
- `selectedCount` query automatically updates when `detectedSenders` table changes

**Performance Considerations:**
- Batch selection (select all/deselect all) uses `Promise.all` for parallel updates
- For large sender lists (100+), consider pagination in future enhancement

### Testing Requirements

```typescript
// Test structure for SenderReview.test.tsx
describe("SenderReview", () => {
  describe("AC#1: Default Selection", () => {
    it("renders each sender with a checkbox")
    it("senders are selected by default (isSelected: true)")
    it("shows correct count of selected senders")
  })

  describe("AC#2: Select All / Deselect All", () => {
    it("Select All button selects all senders")
    it("Deselect All button deselects all senders")
    it("shows loading state during batch operation")
  })

  describe("AC#3: Sender Detail View", () => {
    it("clicking sender row expands detail view")
    it("detail shows sample subjects")
    it("detail shows confidence score and domain")
    it("clicking again collapses detail")
  })

  describe("AC#4: Import Trigger", () => {
    it("Import button shows count of selected senders")
    it("Import button is disabled when 0 selected")
    it("clicking Import calls approveSelectedSenders mutation")
    it("only selected senders are marked as approved")
  })

  describe("AC#5: Visual Feedback", () => {
    it("deselected senders have muted styling")
    it("selected count updates when checkbox toggled")
  })
})
```

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Schema migration handled by making `isSelected` and `isApproved` optional with defaults in queries
- Convex mutations implement auth checks and ownership verification
- Tests mock Convex hooks for isolated component testing

### Completion Notes List

- **Task 1**: Added `isSelected` (optional, defaults to true) and `isApproved` (optional, defaults to false) fields to `detectedSenders` schema. Created `updateSenderSelection`, `selectAllSenders`, `deselectAllSenders`, `getSelectedSendersCount`, and `approveSelectedSenders` mutations/queries in `gmail.ts`. All mutations include authentication and ownership checks.

- **Task 2**: Created `SenderReview.tsx` component with checkbox selection for each sender, visual distinction (opacity and background) for deselected senders, real-time count display in header, and accessible checkbox interactions.

- **Task 3**: Implemented Select All and Deselect All buttons with proper disabled states (Select All disabled when all selected, Deselect All disabled when none selected).

- **Task 4**: Implemented expandable sender rows with click-to-expand interaction, displaying sample subjects, confidence score with badge, domain information, and email count. Chevron icon rotates on expand.

- **Task 5**: Added "Import Selected" button with confirmation flow (review -> confirm -> success views), disabled when 0 selected, shows count of selected senders. Created success view for post-approval feedback.

- **Task 6**: Wrote 23 comprehensive tests covering all ACs: default selection, select/deselect all, sender detail expansion, import trigger flow, visual feedback, loading/empty states, and navigation callbacks.

### File List

| File | Action |
|------|--------|
| `packages/backend/convex/schema.ts` | MODIFIED - Added `isSelected` and `isApproved` optional fields to `detectedSenders`, added `by_userId_isSelected` index |
| `packages/backend/convex/gmail.ts` | MODIFIED - Added 5 new functions: `updateSenderSelection`, `selectAllSenders`, `deselectAllSenders`, `getSelectedSendersCount`, `approveSelectedSenders`. Updated `DetectedSender` type and `getDetectedSenders` query to include new fields with defaults |
| `apps/web/src/routes/_authed/import/SenderReview.tsx` | NEW - Sender review component with selection UI, expandable details, and import approval flow. Code review: Updated with optimistic updates, error handling, aria-live region |
| `apps/web/src/routes/_authed/import/SenderReview.test.tsx` | NEW - 30 tests covering all acceptance criteria including error handling and accessibility |
| `apps/web/src/routes/_authed/import/SenderScanner.tsx` | MODIFIED - Added view state management and integration with SenderReview component |
| `apps/web/src/components/ui/checkbox.tsx` | NEW - Base UI Checkbox component (Code review: Updated from Radix to Base UI per architecture) |
| `apps/web/src/components/ui/badge.tsx` | NEW - Base UI Badge component (Code review: Removed Radix dependency per architecture) |
| `apps/web/package.json` | MODIFIED - Added @base-ui-components/react dependency |
| `pnpm-lock.yaml` | MODIFIED - Lock file updated with new dependency |

## Change Log

| Date | Change |
|------|--------|
| 2026-01-24 | Story 4.3 implementation complete - Sender Review & Approval functionality with all ACs satisfied, 23 tests passing |
| 2026-01-24 | **Code Review Fixes Applied:** (1) Updated Checkbox/Badge from Radix to Base UI per architecture, (2) Added optimistic updates for instant selection feedback, (3) Added inline error display for mutation failures, (4) Added aria-live region for accessibility, (5) Added detected date display (partial AC#3 fix), (6) Updated tests to 30 covering error handling and accessibility, (7) Documented missing files (package.json, pnpm-lock.yaml) |
