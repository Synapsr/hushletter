# Story 1.5: Account Settings

Status: done

## Story

As a **logged-in user**,
I want **to view and manage my account settings**,
so that **I can update my profile and see my dedicated email address**.

## Acceptance Criteria

**AC1: Settings Page Access**
**Given** I am logged in
**When** I navigate to the settings page
**Then** I see my account information (email, name if provided)
**And** I see my dedicated newsletter email address

**AC2: Display Name Update**
**Given** I am on the settings page
**When** I update my display name
**Then** the change is saved
**And** I see a confirmation message

**AC3: Dedicated Email Instructions**
**Given** I am on the settings page
**When** I view my dedicated email section
**Then** I see instructions on how to use the dedicated address
**And** I can copy the address to clipboard

## Tasks / Subtasks

- [x] Task 1: Add updateProfile mutation to Convex (AC: 2)
  - [x] Create `convex/users.ts` with `updateProfile` mutation
  - [x] Accept `name` field for update
  - [x] Validate authenticated user owns the profile
  - [x] Return updated user data

- [x] Task 2: Add profile update form to settings page (AC: 2)
  - [x] Add TanStack Form + Zod for name field editing
  - [x] Include inline edit functionality (edit button to toggle form)
  - [x] Show success toast/message on save
  - [x] Show error state if save fails

- [x] Task 3: Add navigation link to Settings (AC: 1)
  - [x] Add Settings link to authenticated header/nav
  - [x] Ensure proper active state styling

- [x] Task 4: Enhance settings page layout (AC: 1, 3)
  - [x] Verify dedicated email instructions are clear
  - [x] Add any missing sections from AC requirements

### Review Follow-ups (AI-Review - FIXED)

- [x] [AI-Review][HIGH] Fixed: Error handling uses ConvexError instead of plain Error [packages/backend/convex/users.ts:17,27]
- [x] [AI-Review][HIGH] Fixed: Tests rewritten to be meaningful contract tests [packages/backend/convex/users.test.ts]
- [x] [AI-Review][MEDIUM] Fixed: Type casting uses explicit type annotation with comment explaining limitation [apps/web/src/routes/_authed/settings/index.tsx]
- [x] [AI-Review][MEDIUM] Fixed: Form error handling uses TanStack Form's built-in error state pattern [apps/web/src/routes/_authed/settings/index.tsx]
- [x] [AI-Review][MEDIUM] Fixed: setTimeout memory leak prevented with useRef + useEffect cleanup [apps/web/src/routes/_authed/settings/index.tsx]
- [x] [AI-Review][MEDIUM] Fixed: Type annotation added to newsletters page [apps/web/src/routes/_authed/newsletters/index.tsx]

## Dev Notes

### CRITICAL IMPLEMENTATION GUARDRAILS

**This story enhances the Account Settings page created in Story 1.4 - the core is already functional!**

Story 1.4 created:
- Settings page at `apps/web/src/routes/_authed/settings/index.tsx`
- DedicatedEmailDisplay component with copy-to-clipboard
- getCurrentUser query returning user data + dedicated email
- Basic account information display

**This story ADDS:**
- Profile update functionality (editable name)
- Navigation link to settings from header

### Previous Story Intelligence (from Story 1.4)

**Key Learnings:**
1. Settings page already exists at `apps/web/src/routes/_authed/settings/index.tsx`
2. Uses `convexQuery` from `@convex-dev/react-query` for data fetching
3. `getCurrentUser` query returns `{ id, email, name, dedicatedEmail }`
4. DedicatedEmailDisplay component already handles copy-to-clipboard
5. Schema has `users` table with `name: v.optional(v.string())`

**Files Created in Story 1.4 (DO NOT RECREATE):**
- `apps/web/src/routes/_authed/settings/index.tsx` - Settings page (EXISTS - MODIFY)
- `apps/web/src/components/DedicatedEmailDisplay.tsx` - Email display (EXISTS - DO NOT TOUCH)
- `packages/backend/convex/auth.ts` - getCurrentUser query (EXISTS - DO NOT TOUCH)
- `packages/backend/convex/schema.ts` - Users table (EXISTS - DO NOT TOUCH)

**Files from Earlier Stories (Reference):**
- `apps/web/src/routes/_authed.tsx` - Auth layout with header (MODIFY for nav link)
- `apps/web/src/lib/auth-client.ts` - Auth client exports

### Technology Stack References

| Technology | Version | Notes |
|------------|---------|-------|
| **TanStack Form** | Latest | MANDATORY for all forms - use `@tanstack/react-form` |
| **Zod** | 3.24.0+ | Schema validation with TanStack Form |
| **Convex** | 1.25.0+ | Mutations for profile update |
| **shadcn/ui** | Latest | Button, Card, Input components |
| **Lucide React** | Latest | Settings, Edit icons |

### updateProfile Mutation Pattern

```typescript
// packages/backend/convex/users.ts - NEW FILE
import { mutation } from "./_generated/server"
import { v } from "convex/values"
import { authComponent } from "./auth"

export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get authenticated user
    const authUser = await authComponent.getAuthUser(ctx)
    if (!authUser) {
      throw new Error("Not authenticated")
    }

    // Find app user record
    const user = await ctx.db
      .query("users")
      .withIndex("by_authId", (q) => q.eq("authId", authUser._id))
      .first()

    if (!user) {
      throw new Error("User not found")
    }

    // Update the user
    await ctx.db.patch(user._id, {
      name: args.name,
    })

    return { success: true }
  },
})
```

### Form Implementation with TanStack Form + Zod

```typescript
// In settings/index.tsx - ADD profile edit form
import { useForm } from "@tanstack/react-form"
import { useMutation } from "@tanstack/react-query"
import { useConvexMutation } from "@convex-dev/react-query"
import { z } from "zod"
import { api } from "@newsletter-manager/backend"

const profileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
})

function ProfileEditForm({ currentName, onSuccess }: { currentName: string | null; onSuccess: () => void }) {
  const updateProfile = useConvexMutation(api.users.updateProfile)

  const form = useForm({
    defaultValues: { name: currentName ?? "" },
    validators: { onChange: profileSchema },
    onSubmit: async ({ value }) => {
      await updateProfile.mutateAsync({ name: value.name })
      onSuccess()
    },
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>
      <form.Field name="name" children={(field) => (
        <>
          <Input
            value={field.state.value}
            onChange={(e) => field.handleChange(e.target.value)}
            placeholder="Your display name"
          />
          {field.state.meta.errors.map((e, i) => (
            <p key={i} className="text-sm text-destructive">{e}</p>
          ))}
        </>
      )} />

      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting]}
        children={([canSubmit, isSubmitting]) => (
          <Button type="submit" disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? "Saving..." : "Save"}
          </Button>
        )}
      />
    </form>
  )
}
```

### Navigation Link Pattern

```typescript
// In _authed.tsx header section - ADD settings link
import { Link } from "@tanstack/react-router"
import { Settings } from "lucide-react"

// Add to navigation items
<Link
  to="/settings"
  className="text-muted-foreground hover:text-foreground"
  activeProps={{ className: "text-foreground" }}
>
  <Settings className="h-5 w-5" />
</Link>
```

### Anti-Patterns to Avoid

```typescript
// ❌ Don't use useState for form fields
const [name, setName] = useState("")

// ❌ Don't use manual loading states
const [isLoading, setIsLoading] = useState(false)

// ❌ Don't call mutation directly without error handling
await updateProfile({ name })

// ✅ Use TanStack Form for all form fields
// ✅ Use form.state.isSubmitting or mutation.isPending for loading
// ✅ Use try/catch or errorMap for error handling
```

### Project Structure Notes

**Alignment with Architecture:**
- New file: `packages/backend/convex/users.ts` - Domain-based organization [Source: architecture.md#Structure Patterns]
- Modify: `apps/web/src/routes/_authed/settings/index.tsx` - Add edit form
- Modify: `apps/web/src/routes/_authed.tsx` - Add settings nav link

**Files to Create:**
- `packages/backend/convex/users.ts` - User mutations (updateProfile)

**Files to Modify:**
- `apps/web/src/routes/_authed/settings/index.tsx` - Add profile edit functionality
- `apps/web/src/routes/_authed.tsx` - Add Settings navigation link

### Dependencies on Previous Stories

**From Story 1.4:**
- Settings page structure and layout
- getCurrentUser query
- DedicatedEmailDisplay component
- Users table with name field

**From Story 1.1-1.3:**
- TanStack Start routing
- Better Auth integration
- shadcn/ui components
- Authenticated layout structure

### Git Commit Pattern

From recent commits:
```
feat: Complete Story 1.4 - Dedicated Email Address Generation
fix: Code review fixes for Story 1.3 User Login & Logout
```

**Use for this story:**
```
feat: Add profile update to Account Settings (Story 1.5)
```

### Testing This Story

**Manual Testing Checklist:**
```bash
# 1. Verify settings page access
- Log in to the app
- Navigate to settings (via nav link)
- Confirm page loads with user info

# 2. Verify name editing
- Click edit on name field
- Enter a new name
- Save changes
- Confirm success message appears
- Refresh page - confirm name persists

# 3. Verify validation
- Try to save empty name (if required)
- Try to save very long name
- Confirm validation errors appear

# 4. Verify navigation
- Confirm Settings link in header
- Confirm proper active state when on settings page
- Confirm link works from any authenticated page

# 5. Verify dedicated email (regression)
- Confirm dedicated email still displays
- Confirm copy button still works
```

### References

- [Source: architecture.md#Implementation Patterns] - TanStack Form + Zod patterns
- [Source: architecture.md#Structure Patterns] - Domain-based Convex file organization
- [Source: project-context.md#Form Handling (MANDATORY)] - Form patterns
- [Source: project-context.md#Anti-Patterns to Avoid] - What NOT to do
- [Source: epics.md#Story 1.5] - Original acceptance criteria
- [Source: Story 1.4 Dev Notes] - Settings page implementation details
- [Source: packages/backend/convex/schema.ts] - Current schema with users table

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A - Clean implementation with no blocking issues.

### Completion Notes List

- Created `packages/backend/convex/users.ts` with `updateProfile` mutation following Convex patterns
- Implemented TanStack Form + Zod validation for profile name editing
- Added inline edit functionality with edit/save/cancel buttons
- Added success message display (3-second auto-dismiss) and error handling
- Added Settings navigation link with gear icon to authenticated header
- Fixed TypeScript type issues with convexQuery return types
- All tests pass (20 tests in backend package)
- Lint passes with only pre-existing warnings

### File List

**Created:**
- `packages/backend/convex/users.ts` - User mutations (updateProfile)
- `packages/backend/convex/users.test.ts` - Tests for updateProfile mutation

**Modified:**
- `apps/web/src/routes/_authed/settings/index.tsx` - Added profile edit form with TanStack Form + Zod
- `apps/web/src/routes/_authed.tsx` - Added Settings nav link with gear icon
- `apps/web/src/routes/_authed/newsletters/index.tsx` - Fixed TypeScript type annotation
- `packages/backend/package.json` - Added vitest and convex-test dev dependencies, test script

## Change Log

- 2026-01-23: Code Review Fixes Applied
  - Fixed ConvexError usage in users.ts (was using plain Error)
  - Rewrote users.test.ts with meaningful contract tests
  - Fixed memory leak in settings page (setTimeout without cleanup)
  - Improved form error handling to use TanStack Form built-in patterns
  - Added explicit type annotations for convexQuery results
  - All 24 tests pass, TypeScript compiles, lint passes

- 2026-01-23: Implemented Story 1.5 - Account Settings profile update functionality
  - Added updateProfile Convex mutation for name editing
  - Added inline edit form with TanStack Form + Zod validation
  - Added Settings navigation link to header
  - All ACs verified complete

