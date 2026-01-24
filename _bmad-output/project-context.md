---
project_name: 'Newsletter Manager'
user_name: 'Teogoulois'
date: '2026-01-20'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'critical_rules']
source_document: 'planning-artifacts/architecture.md'
---

# Project Context for AI Agents

_Critical rules and patterns for implementing Newsletter Manager. Focus on unobvious details that agents might miss._

---

## Technology Stack & Versions

### Core Technologies

| Technology | Version | Notes |
|------------|---------|-------|
| **Turborepo** | Latest | Monorepo management |
| **TanStack Start** | Latest | React metaframework (RC stage) |
| **TanStack Form** | Latest | Form state management - REQUIRED for all forms |
| **Zod** | 3.24.0+ | Schema validation with TanStack Form |
| **Convex** | 1.25.0+ | Required for Better Auth component |
| **Better Auth** | 1.4.9 | Pinned version - do not upgrade without testing |
| **shadcn/ui** | Latest | Use Base UI primitives, NOT Radix |
| **Tailwind CSS** | Latest | Utility-first styling |
| **oxlint** | 1.0+ | Primary linter - NOT ESLint |
| **Cloudflare Workers** | Latest | Email handling |
| **Cloudflare R2** | Latest | Newsletter content storage |
| **OpenRouter** | Latest | AI provider for Kimi K2 |

### Version Constraints

- **Better Auth**: Must stay at 1.4.9 - pinned for Convex compatibility
- **Convex**: Minimum 1.25.0 for Better Auth component
- **Base UI**: Use instead of Radix (Radix is deprecated in this project)

---

## Critical Implementation Rules

### Convex Patterns

**Table & Field Naming:**
- Tables: plural lowercase (`newsletters`, `users`, `senders`)
- Fields: camelCase (`userId`, `createdAt`, `isPrivate`)
- Foreign refs: camelCase with Id suffix (`userId`, `senderId`)

**Function Naming:**
- Queries: `get*`, `list*`, `find*` (e.g., `getNewsletter`, `listNewsletters`)
- Mutations: `create*`, `update*`, `delete*`, `mark*` (e.g., `markAsRead`)
- Actions: `sync*`, `import*`, `generate*` (e.g., `generateSummary`)

**Function Organization:**
- One file per domain: `newsletters.ts`, `users.ts`, `senders.ts`
- NOT by type (don't create `queries.ts`, `mutations.ts`)

**MANDATORY Privacy Pattern (Epic 2.5+ Shared Schema):**
```typescript
// For userNewsletters queries (per-user data):
// Filter by userId is sufficient - each user only sees their own records
const userNewsletters = await ctx.db
  .query("userNewsletters")
  .withIndex("by_userId", (q) => q.eq("userId", user._id))

// For newsletterContent queries (shared public content - Epic 6):
// Only query public content OR content the user has access to via userNewsletters
// This pattern applies when implementing community/discovery features
const publicContent = await ctx.db
  .query("newsletterContent")
  .withIndex("by_readerCount")  // Public content only - no private content here
```

**Privacy Architecture (Epic 2.5):**
- `userNewsletters`: Per-user records - filter by userId
- `newsletterContent`: Shared public content only (private content uses `privateR2Key` on userNewsletters)
- `userSenderSettings.isPrivate`: Determines if future newsletters from sender are private

**Error Handling:**
```typescript
// User-actionable errors
throw new ConvexError({ code: "NOT_FOUND", message: "Newsletter not found" })

// NOT this
throw new Error("not found")
```

**Date Storage:**
- Store as Unix timestamps (milliseconds): `createdAt: Date.now()`
- NOT ISO strings
- Format on client for display

### React/TanStack Patterns

**State Management:**
- Use Convex queries for server state (automatic real-time)
- Use `useState` only for truly local UI state (modals, toggles)
- NO manual refetching - Convex handles this
- NO useState for form fields - use TanStack Form

```typescript
// Correct - Server state
const newsletters = useQuery(api.newsletters.list)
if (newsletters === undefined) return <Skeleton />

// Wrong - don't do this
const [newsletters, setNewsletters] = useState([])
useEffect(() => { fetchData().then(setNewsletters) }, [])
```

### Form Handling (MANDATORY)

**Always use TanStack Form + Zod - NEVER useState for form fields:**

```bash
pnpm add @tanstack/react-form zod
```

```typescript
import { useForm } from "@tanstack/react-form"
import { z } from "zod"

// Define Zod schema for validation
const schema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Min 8 characters"),
})

function MyForm() {
  const form = useForm({
    defaultValues: { email: "", password: "" },
    validators: { onChange: schema },
    onSubmit: async ({ value }) => {
      // Handle submission
    },
  })

  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}>
      <form.Field name="email" children={(field) => (
        <>
          <input
            value={field.state.value}
            onChange={(e) => field.handleChange(e.target.value)}
          />
          {field.state.meta.errors.map((e, i) => <p key={i}>{e}</p>)}
        </>
      )} />

      {/* Use form.Subscribe for loading/submit states */}
      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting]}
        children={([canSubmit, isSubmitting]) => (
          <button disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? "Loading..." : "Submit"}
          </button>
        )}
      />
    </form>
  )
}
```

**Loading States - Use built-in hooks:**
```typescript
// Convex mutations
const mutation = useMutation(api.newsletters.create)
// Use: mutation.isPending for loading state

// React Query
const { data, isPending } = useQuery(...)
// Use: isPending for loading state

// TanStack Form
form.state.isSubmitting  // or via form.Subscribe

// ❌ NEVER do this
const [isLoading, setIsLoading] = useState(false)
```

**Component Naming:**
- Components: PascalCase (`NewsletterCard`)
- Files: Match component name (`NewsletterCard.tsx`)
- Hooks: camelCase with `use` prefix (`useNewsletters`)

**Error Boundaries:**
- Use feature-level error boundaries
- AI summary failure should NOT break the reader

### Testing Rules

**Test Location:**
- Colocate tests with source files
- `NewsletterCard.tsx` → `NewsletterCard.test.tsx` in same directory
- NOT in separate `__tests__` folder

**Test Naming:**
- Files: `*.test.tsx` or `*.test.ts`
- Describe blocks: Match component/function name

### Code Quality Rules

**Linting:**
- Use oxlint, NOT ESLint
- Config at root: `.oxlintrc.json`

**Imports:**
- Use absolute imports where configured
- Group: external → internal → relative

**No Manual State for Convex Data:**
```typescript
// NEVER do this for Convex data
const [data, setData] = useState()
useEffect(() => { fetchData().then(setData) }, [])
```

### Development Workflow Rules

**Monorepo Commands:**
```bash
pnpm dev                    # Start all apps
pnpm --filter web dev       # Start web only
pnpm --filter email-worker dev  # Start worker only
pnpm build                  # Build all
pnpm test                   # Test all
```

**Package Installation:**
```bash
pnpm add -w <package>              # Root workspace
pnpm --filter web add <package>    # Web app only
pnpm --filter shared add <package> # Shared package
```

---

## Critical Don't-Miss Rules

### Anti-Patterns to Avoid

```typescript
// ❌ snake_case in Convex
user_id: v.id("users")  // ✅ Use userId

// ❌ Missing privacy filter
const all = await ctx.db.query("newsletters").collect()

// ❌ ISO strings for dates
createdAt: "2026-01-15T10:00:00Z"  // ✅ Use Date.now()

// ❌ Manual state for Convex data
useEffect(() => { refetch() }, [])

// ❌ Unstructured errors
throw new Error("not found")  // ✅ Use ConvexError

// ❌ Radix components
import { Dialog } from "@radix-ui/react-dialog"  // ✅ Use Base UI

// ❌ useState for form fields
const [email, setEmail] = useState("")  // ✅ Use TanStack Form

// ❌ useState for loading states
const [isLoading, setIsLoading] = useState(false)  // ✅ Use isPending/isSubmitting

// ❌ Manual form validation
if (email.length < 3) setError("...")  // ✅ Use Zod with TanStack Form
```

### Email Sending Rules

**Production:** Use Convex Resend component
- Component: https://www.convex.dev/components/resend
- Package: `@convex-dev/resend`
- Requires Resend API key in Convex environment

**Development:** Log email content only (never send real emails)
```typescript
if (process.env.NODE_ENV === "development") {
  console.log("📧 Email would be sent:", { to, subject, body })
} else {
  await resend.emails.send({ to, subject, html: body })
}
```

### Security Rules

- Gmail OAuth tokens: Never expose to client, managed by Better Auth
- Privacy enforcement: MUST filter in EVERY newsletter query
- Internal API keys: Use for worker → Convex communication only

### Architecture Reference

Full architecture document: `_bmad-output/planning-artifacts/architecture.md`

When in doubt, consult the architecture document for:
- Complete project structure
- Integration patterns
- All architectural decisions with rationale
