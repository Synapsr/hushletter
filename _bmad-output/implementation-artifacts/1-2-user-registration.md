# Story 1.2: User Registration

Status: ready-for-dev

## Story

As a **new user**,
I want **to create an account with my email and password**,
so that **I can start using the newsletter manager**.

## Acceptance Criteria

**AC1: Successful Registration**
**Given** I am on the signup page
**When** I enter a valid email and password (min 8 characters)
**Then** my account is created
**And** I am redirected to the authenticated area

**AC2: Duplicate Email Handling**
**Given** I am on the signup page
**When** I enter an email that already exists
**Then** I see an error message "An account with this email already exists"
**And** I am not registered

**AC3: Email Validation**
**Given** I am on the signup page
**When** I enter an invalid email format
**Then** I see a validation error
**And** the form is not submitted

**AC4: Password Validation**
**Given** I am on the signup page
**When** I enter a password shorter than 8 characters
**Then** I see a validation error indicating password requirements

## Tasks / Subtasks

- [ ] Install form dependencies (AC: 1, 3, 4)
  - [ ] Run `pnpm add @tanstack/react-form zod` in apps/web
  - [ ] Verify TanStack Form integrates with existing TanStack Router

- [ ] Configure Better Auth email/password provider (AC: 1, 2)
  - [ ] Update `packages/backend/auth.ts` with email/password config
  - [ ] Update `packages/backend/convex.config.ts` if needed
  - [ ] Run `npx convex dev` to sync auth schema
  - [ ] Test auth configuration works

- [ ] Create signup page route (AC: 1, 3, 4)
  - [ ] Create `apps/web/src/routes/signup.tsx`
  - [ ] Build signup form with email and password fields
  - [ ] Use shadcn/ui Input and Button components
  - [ ] Add client-side validation (email format, password length)

- [ ] Implement signup form submission (AC: 1, 2)
  - [ ] Connect form to Better Auth signUp function
  - [ ] Handle successful registration → redirect to /newsletters
  - [ ] Handle duplicate email error with user-friendly message
  - [ ] Display loading state during submission

- [ ] Create authenticated layout and guard (AC: 1)
  - [ ] Create `apps/web/src/routes/_authed.tsx` layout route
  - [ ] Implement auth check using Better Auth session
  - [ ] Redirect unauthenticated users to /login
  - [ ] Create placeholder `/newsletters` route for redirect target

- [ ] Update landing page CTAs (AC: 1)
  - [ ] Update "Get Started" links to navigate to `/signup`
  - [ ] Update "Sign In" links to navigate to `/login`

- [ ] Add form validation UI feedback (AC: 3, 4)
  - [ ] Show inline validation errors for email format
  - [ ] Show inline validation errors for password length
  - [ ] Disable submit button when form invalid
  - [ ] Use shadcn/ui styling for error states

## Dev Notes

### 🔥 CRITICAL IMPLEMENTATION GUARDRAILS 🔥

**This story implements the FIRST authentication flow - security is paramount!**

### Better Auth Configuration

**Current State (from Story 1.1):**
- `@convex-dev/better-auth@^0.10.10` installed
- `better-auth@1.4.9` installed (PINNED VERSION)
- Placeholder config at `packages/backend/auth.ts`

**Required Configuration:**
```typescript
// packages/backend/auth.ts
import { betterAuth } from "better-auth"
import { convexAdapter } from "@convex-dev/better-auth/convex"

export const auth = betterAuth({
  database: convexAdapter(),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // MVP - add verification later
    minPasswordLength: 8,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
})
```

**Client Setup:**
```typescript
// apps/web/src/lib/auth-client.ts
import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_CONVEX_URL,
})

export const { signUp, signIn, signOut, useSession } = authClient
```

### File Structure for Auth Routes

```
apps/web/src/routes/
├── index.tsx           # Landing page (update CTAs)
├── signup.tsx          # NEW: Registration form
├── login.tsx           # NEW: Login form (stub for Story 1.3)
├── __root.tsx          # Root layout
└── _authed.tsx         # NEW: Auth guard layout
    └── newsletters/
        └── index.tsx   # NEW: Placeholder authenticated page
```

### Form Implementation Pattern

**Use TanStack Form + Zod (NOT useState for form fields):**

```bash
# Install TanStack Form and Zod
pnpm add @tanstack/react-form zod
```

```tsx
// apps/web/src/routes/signup.tsx
import { useForm } from "@tanstack/react-form"
import { z } from "zod"
import { useNavigate } from "@tanstack/react-router"
import { Button } from "~/components/ui/button"
import { Input } from "~/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card"
import { signUp } from "~/lib/auth-client"

// Zod schema for validation
const signupSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

function SignupForm() {
  const navigate = useNavigate()

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    validators: {
      onChange: signupSchema,
    },
    onSubmit: async ({ value }) => {
      try {
        await signUp.email({
          email: value.email,
          password: value.password,
        })
        navigate({ to: "/newsletters" })
      } catch (err: any) {
        // Return form-level error for display
        if (err.code === "USER_ALREADY_EXISTS") {
          return "An account with this email already exists"
        }
        return "Registration failed. Please try again."
      }
    },
  })

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Create Account</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            form.handleSubmit()
          }}
          className="space-y-4"
        >
          {/* Email Field */}
          <form.Field
            name="email"
            children={(field) => (
              <div className="space-y-2">
                <label htmlFor={field.name} className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id={field.name}
                  type="email"
                  placeholder="you@example.com"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className={field.state.meta.errors.length > 0 ? "border-destructive" : ""}
                />
                {field.state.meta.errors.map((error, i) => (
                  <p key={i} className="text-sm text-destructive">{error}</p>
                ))}
              </div>
            )}
          />

          {/* Password Field */}
          <form.Field
            name="password"
            children={(field) => (
              <div className="space-y-2">
                <label htmlFor={field.name} className="text-sm font-medium">
                  Password
                </label>
                <Input
                  id={field.name}
                  type="password"
                  placeholder="Min 8 characters"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  onBlur={field.handleBlur}
                  className={field.state.meta.errors.length > 0 ? "border-destructive" : ""}
                />
                {field.state.meta.errors.map((error, i) => (
                  <p key={i} className="text-sm text-destructive">{error}</p>
                ))}
              </div>
            )}
          />

          {/* Form-level errors */}
          <form.Subscribe
            selector={(state) => state.errors}
            children={(errors) =>
              errors.length > 0 ? (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                  {errors.join(", ")}
                </div>
              ) : null
            }
          />

          {/* Submit button with built-in loading state */}
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
            children={([canSubmit, isSubmitting]) => (
              <Button
                type="submit"
                className="w-full"
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting ? "Creating account..." : "Sign Up"}
              </Button>
            )}
          />
        </form>
      </CardContent>
    </Card>
  )
}
```

### Validation Requirements

**Client-Side (UX feedback):**
- Email: Must match email regex pattern
- Password: Minimum 8 characters

**Server-Side (enforced by Better Auth):**
- Email uniqueness check
- Password minimum length
- Email format validation

**Error Display Pattern:**
```tsx
{error && (
  <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
    {error}
  </div>
)}
```

### Auth Guard Implementation

**Route Layout Pattern (TanStack Router):**
```tsx
// apps/web/src/routes/_authed.tsx
import { createFileRoute, redirect, Outlet } from "@tanstack/react-router"
import { useSession } from "~/lib/auth-client"

export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ context }) => {
    // Check session before rendering
    const session = await context.auth.getSession()
    if (!session) {
      throw redirect({ to: "/login" })
    }
  },
  component: AuthedLayout,
})

function AuthedLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Add authenticated navigation later */}
      <Outlet />
    </div>
  )
}
```

### Landing Page CTA Updates

**Update these links in `apps/web/src/routes/index.tsx`:**
```tsx
// Change from:
<Link to="/">
  <Button>Get Started</Button>
</Link>

// To:
<Link to="/signup">
  <Button>Get Started</Button>
</Link>

<Link to="/login">
  <Button variant="ghost">Sign In</Button>
</Link>
```

### Anti-Patterns to Avoid

```typescript
// ❌ NEVER do these
- Using useState for form fields (use TanStack Form)
- Using useState for loading states (use form.isSubmitting or mutation.isPending)
- Manual form validation (use Zod schemas with TanStack Form validators)
- Storing passwords in plain text (Better Auth handles hashing)
- Creating custom session management (use Better Auth)
- Skipping server-side validation
- Exposing detailed error messages (e.g., "Invalid password" vs "Invalid credentials")
- Using alert() for errors (use inline UI)
- Manual redirects without TanStack Router

// ✅ ALWAYS use these patterns
- TanStack Form useForm() for all forms
- Zod schemas for validation (validators.onChange)
- form.Subscribe for derived state (canSubmit, isSubmitting, errors)
- form.Field for individual field rendering
- Convex useMutation().isPending for mutation loading states
- React Query useQuery().isPending for query loading states
```

### Testing This Story

```bash
# Manual testing checklist:
1. Navigate to /signup
2. Submit empty form → validation errors appear
3. Submit invalid email → email error appears
4. Submit short password → password error appears
5. Submit valid form → account created, redirect to /newsletters
6. Try signup with same email → duplicate error appears
7. Landing page CTAs → navigate to correct routes
8. Direct access to /newsletters → redirect to /login (unauthenticated)
```

### Project Structure Notes

**Alignment with Architecture:**
- Better Auth email/password provider [Source: architecture.md#Authentication & Security]
- Route structure follows TanStack Router conventions [Source: architecture.md#Frontend Architecture]
- Form components use shadcn/ui [Source: architecture.md#Selected Stack]

**Files to Create:**
- `apps/web/src/routes/signup.tsx` - Registration form
- `apps/web/src/routes/login.tsx` - Stub for Story 1.3
- `apps/web/src/routes/_authed.tsx` - Auth layout/guard
- `apps/web/src/routes/_authed/newsletters/index.tsx` - Placeholder

**Files to Modify:**
- `packages/backend/auth.ts` - Configure email/password
- `apps/web/src/lib/auth-client.ts` - Initialize Better Auth client
- `apps/web/src/routes/index.tsx` - Update CTA links
- `apps/web/src/router.tsx` - Ensure auth context available

### Dependencies on Story 1.1

- ✅ Better Auth packages installed
- ✅ shadcn/ui components (Button, Input, Card)
- ✅ Convex integration working
- ✅ Landing page with CTAs
- ✅ Basic route structure

### References

- [Source: architecture.md#Authentication & Security] - OAuth providers, token storage, authorization patterns
- [Source: architecture.md#Selected Stack] - Better Auth with Convex, cookie-based sessions
- [Source: architecture.md#Frontend Architecture] - Component organization, error boundaries
- [Source: project-context.md#Critical Implementation Rules] - Convex patterns, error handling
- [Source: epics.md#Story 1.2] - Original acceptance criteria
- [Source: Story 1.1 Review] - Deferred items: CTAs, route groups, Better Auth config

## Dev Agent Record

### Agent Model Used

<!-- To be filled by dev agent -->

### Debug Log References

<!-- To be filled during implementation -->

### Completion Notes List

<!-- To be filled during implementation -->

### File List

<!-- To be filled during implementation -->
