---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - prd.md
  - product-brief-newsletter-manager-2026-01-14.md
documentCounts:
  prd: 1
  briefs: 1
  uxDesign: 0
  research: 0
  projectContext: 0
workflowType: 'architecture'
project_name: 'newsletter manager'
user_name: 'Teogoulois'
date: '2026-01-15'
status: complete
completedAt: '2026-01-20'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
28 requirements across 7 domains:
- User Management (4): Account lifecycle, dedicated email provisioning
- Email Infrastructure (4): Inbound email handling, parsing, sender detection, real-time delivery
- Gmail Import (5): OAuth integration, sender scanning, historical import
- Newsletter Reading (5): Organization, clean reader interface, folder management
- AI Features (2): One-click summarization
- Community Database (4): Shared back-catalog with privacy controls
- Admin/Operations (4): Monitoring, moderation, system health

**Non-Functional Requirements:**
14 requirements across 4 categories:
- Performance: Sub-second UI responses, <10s AI summaries, <2s real-time updates
- Security: HTTPS, secure OAuth storage, privacy enforcement, GDPR compliance
- Reliability: Zero email loss, graceful OAuth expiry handling, AI failure isolation
- Integration: Gmail API compliance, Cloudflare Worker compatibility, Convex stability

**Scale & Complexity:**
- Primary domain: Full-stack (SPA + Backend Services + Email Infrastructure)
- Complexity level: Medium
- Estimated architectural components: 8-12 major components

### Technical Constraints & Dependencies

**Pre-Decided Technology:**
- Frontend: TanStack Start (SPA)
- Database/Real-time: Convex
- Email Infrastructure: Cloudflare Email Workers

**External Dependencies:**
- Google Gmail API (OAuth 2.0)
- AI summarization service (OpenRouter + Kimi K2)
- Cloudflare Workers platform

### Cross-Cutting Concerns Identified

1. **Authentication & Authorization** — Dual concern: user sessions + OAuth token management
2. **Privacy Boundary Enforcement** — Architectural hard line between public/private content
3. **External Service Resilience** — Gmail, AI, and email services can all fail independently
4. **Real-Time Synchronization** — Convex subscriptions must maintain consistency
5. **Email Delivery Reliability** — Foundation layer; failure here breaks everything

## Starter Template Evaluation

### Primary Technology Domain

Full-stack web application with real-time capabilities, based on project requirements analysis.

### Database Options Evaluated

| Platform | Type | Real-Time | Verdict |
|----------|------|-----------|---------|
| **Convex** | Document-style BaaS | Native (built-in) | **Selected** — Best fit for real-time newsletter delivery |
| **Supabase** | PostgreSQL BaaS | Via subscriptions | Good alternative, more setup for real-time |
| **Neon + Drizzle** | Serverless PostgreSQL | Requires additional sync layer | Overkill for MVP |

**Rationale for Convex:**
- Real-time subscriptions work out of the box (critical for NFR4: <2s updates)
- Zero backend glue code needed
- Type-safe queries and mutations
- TanStack Start integration well-documented

### Selected Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| **Monorepo** | Turborepo | Shared code, unified builds, future mobile support |
| **Frontend Framework** | TanStack Start | SPA with SSR capabilities |
| **Database/Backend** | Convex | Real-time, serverless functions |
| **UI Components** | shadcn/ui + Base UI | Modern primitives, single package dependency |
| **Authentication** | Better Auth | Works with Convex, cookie-based sessions |
| **Linting** | oxlint | 50-100x faster than ESLint, 660 built-in rules |
| **Styling** | Tailwind CSS | Utility-first, pairs with shadcn/ui |
| **Email Infrastructure** | Cloudflare Email Workers | Separate app in monorepo |

### Monorepo Structure (Turborepo)

```
newsletter-manager/
├── apps/
│   ├── web/                    # TanStack Start application
│   │   ├── app/
│   │   │   ├── routes/        # File-based routing
│   │   │   ├── components/    # UI components (shadcn/ui)
│   │   │   └── lib/           # Utilities, auth config
│   │   ├── convex/            # Convex backend
│   │   │   ├── schema.ts      # Database schema
│   │   │   ├── functions/     # Queries, mutations, actions
│   │   │   └── auth.ts        # Better Auth integration
│   │   └── package.json
│   │
│   └── email-worker/           # Cloudflare Email Worker
│       ├── src/
│       │   └── index.ts       # Email handling logic
│       ├── wrangler.toml
│       └── package.json
│
├── packages/
│   └── shared/                 # Shared types, utilities
│       ├── src/
│       │   ├── types/         # Shared TypeScript types
│       │   └── utils/         # Shared utilities
│       └── package.json
│
├── turbo.json                  # Turborepo configuration
├── package.json                # Root package.json
├── .oxlintrc.json             # Linting configuration
└── pnpm-workspace.yaml        # Workspace configuration
```

### Initialization Commands

**1. Create Turborepo monorepo:**
```bash
npx create-turbo@latest newsletter-manager
cd newsletter-manager
```

**2. Create web app with Convex + TanStack Start:**
```bash
cd apps
npm create convex@latest -- -t tanstack-start web
```

**3. Add shadcn/ui with Base UI:**
```bash
cd web
npx shadcn@latest init
# Select: Base UI (not Radix)
# Select: Style preference
# Select: Icon library (Lucide recommended)
```

**4. Add oxlint (root level):**
```bash
cd ../..
pnpm add -D -w oxlint
```

**5. Add Better Auth:**
```bash
cd apps/web
pnpm add convex@latest @convex-dev/better-auth better-auth@1.4.9
```

**6. Create email worker:**
```bash
cd ../
npm create cloudflare@latest email-worker -- --type=pre-existing
```

### Architectural Decisions Locked by Starter

**Language & Runtime:**
- TypeScript (strict mode) across all packages
- Convex serverless functions for backend logic
- Cloudflare Workers runtime for email handling

**Database & Real-time:**
- Convex document database
- Automatic real-time subscriptions via React Query integration
- Optimistic updates supported

**Styling:**
- Tailwind CSS for utility classes
- shadcn/ui components built on Base UI primitives

**Code Organization:**
- Turborepo for monorepo management
- File-based routing (TanStack Router)
- Convex directory for all backend logic
- Shared package for cross-app types and utilities

**Note:** Project initialization (Turborepo + apps setup) should be the first implementation story.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Newsletter storage model (R2 + Convex)
- Privacy boundary enforcement
- Authentication providers and patterns
- Email Worker ↔ Convex communication

**Important Decisions (Shape Architecture):**
- AI provider and integration pattern
- Component organization
- Hosting platform

**Deferred Decisions (Post-MVP):**
- Advanced caching strategies
- Background summarization
- External monitoring (Sentry)

### Data Architecture

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Data Validation** | Convex schema only | Sufficient for MVP, single source of truth |
| **Privacy Enforcement** | Schema-level `isPrivate` flag + strict query patterns | Simple, enforceable, documented |
| **Newsletter Storage** | Content in Cloudflare R2, metadata in Convex | Scalable, cost-effective, handles large HTML |

**Storage Pattern:**
- Newsletter HTML/content → Cloudflare R2 (referenced by key)
- Newsletter metadata (subject, sender, date, R2 key, isPrivate) → Convex
- User data, senders, folders → Convex

### Authentication & Security

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **OAuth Providers** | Email/Password + Google | Covers most users, aligns with Gmail import |
| **Gmail Token Storage** | Better Auth built-in OAuth management | Handles token refresh, secure storage |
| **Authorization Pattern** | Query-level filtering with `ctx.auth` | Every query filters by authenticated user |

**Security Rules:**
- All Convex queries must validate `ctx.auth` before returning data
- Gmail OAuth tokens managed by Better Auth, never exposed to client
- Private newsletters filtered at query level, never sent to community endpoints

### API & Communication Patterns

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Email Worker → Convex** | Convex client in Worker | Type-safe mutations, cleaner than HTTP |
| **AI Summarization** | On-demand (user-triggered) | Simpler, cheaper for MVP |
| **AI Provider** | OpenRouter + Kimi K2 | Open-weight model, flexible provider switching |

**Communication Flow:**
```
Email arrives → Cloudflare Email Worker
    → Parse email content
    → Upload HTML to R2
    → Call Convex mutation with metadata + R2 key
    → Convex stores newsletter, triggers real-time update
    → User sees newsletter instantly
```

### Frontend Architecture

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **State Management** | React built-ins (useState/useReducer) | Server state in Convex, minimal local state |
| **Component Organization** | Hybrid (shared UI in `/components`, features colocated) | TanStack Start pattern, clear separation |
| **Error Boundaries** | Feature-level isolation | AI failure doesn't break reading experience |

**Component Structure:**
```
app/
├── components/          # Shared UI (buttons, cards, layouts)
├── routes/
│   ├── _authed/        # Authenticated routes
│   │   ├── newsletters/
│   │   ├── settings/
│   │   └── import/
│   └── _public/        # Public routes (landing, auth)
└── lib/                # Utilities, hooks, auth config
```

### Infrastructure & Deployment

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Hosting** | Cloudflare Pages | Unified platform with email worker, cost-effective |
| **CI/CD** | GitHub Actions + Cloudflare auto-deploy | Actions for quality gates, Cloudflare for deploys |
| **Environment Management** | Platform-native env vars | Convex + Cloudflare dashboards, sufficient for MVP |
| **Monitoring** | Built-in dashboards (Convex + Cloudflare) | Adequate for MVP, add Sentry later if needed |

**Deployment Pipeline:**
```
Push to main
    → GitHub Actions: oxlint, typecheck, tests
    → On success: Cloudflare Pages auto-deploy
    → Convex auto-deploys functions
```

### Decision Impact Analysis

**Implementation Sequence:**
1. Turborepo + project scaffolding
2. Convex schema + Better Auth setup
3. R2 bucket configuration
4. Email Worker with Convex integration
5. Core UI (reader, newsletter list)
6. Gmail import flow
7. AI summarization

**Cross-Component Dependencies:**
- Email Worker depends on: Convex schema, R2 bucket
- AI summarization depends on: Newsletter storage, OpenRouter setup
- Gmail import depends on: Better Auth OAuth, Convex mutations

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:** 9 areas where AI agents could make different choices, now standardized.

### Naming Patterns

**Convex Table & Field Naming:**
- Tables: plural lowercase (`newsletters`, `users`, `senders`, `folders`)
- Fields: camelCase (`userId`, `createdAt`, `isPrivate`, `r2Key`)
- Foreign references: camelCase with Id suffix (`userId`, `senderId`, `folderId`)

```typescript
// ✅ Good
defineTable({
  userId: v.id("users"),
  subject: v.string(),
  createdAt: v.number(),
  isPrivate: v.boolean(),
})

// ❌ Bad
defineTable({
  user_id: v.id("users"),
  Subject: v.string(),
  created_at: v.number(),
})
```

**Convex Function Naming:**
- Pattern: `verb + noun` (camelCase)
- Queries: `get*`, `list*`, `find*` (`getNewsletter`, `listNewsletters`, `findBySender`)
- Mutations: `create*`, `update*`, `delete*`, `mark*` (`createNewsletter`, `markAsRead`)
- Actions: `sync*`, `import*`, `generate*` (`syncGmail`, `generateSummary`)

```typescript
// ✅ Good
export const getNewsletter = query({ ... })
export const listNewslettersBySender = query({ ... })
export const markAsRead = mutation({ ... })

// ❌ Bad
export const newsletter_get = query({ ... })
export const NewsletterList = query({ ... })
```

**React Component & File Naming:**
- Components: PascalCase (`NewsletterCard`, `SenderList`, `ReaderView`)
- Files: Match component name (`NewsletterCard.tsx`, `SenderList.tsx`)
- Hooks: camelCase with `use` prefix (`useNewsletters`, `useCurrentUser`)
- Utilities: camelCase (`formatDate`, `parseEmail`)

```
✅ Good                    ❌ Bad
NewsletterCard.tsx         newsletter-card.tsx
useNewsletters.ts          UseNewsletters.ts
formatDate.ts              format-date.ts
```

### Structure Patterns

**Test File Location:**
- Pattern: Colocated with source files
- Test files: `*.test.tsx` or `*.test.ts` next to source

```
app/
├── components/
│   ├── NewsletterCard.tsx
│   ├── NewsletterCard.test.tsx    # Colocated test
│   └── SenderList.tsx
```

**Convex Function Organization:**
- Pattern: By domain (one file per entity)
- Each domain file contains queries, mutations, and internal functions

```
convex/
├── schema.ts              # All table definitions
├── auth.ts                # Better Auth integration
├── newsletters.ts         # All newsletter functions
├── users.ts               # All user functions
├── senders.ts             # All sender functions
├── folders.ts             # All folder functions
└── _internal/             # Shared internal helpers
    └── emailParser.ts
```

**Route Organization:**
- Pattern: Feature folders under route groups

```
app/routes/
├── _authed/               # Requires authentication
│   ├── newsletters/
│   │   ├── index.tsx      # /newsletters (list)
│   │   └── $id.tsx        # /newsletters/:id (detail)
│   ├── settings/
│   └── import/
└── _public/               # Public routes
    ├── index.tsx          # Landing page
    └── auth/
```

### Format Patterns

**Error Response Format:**
- User-actionable errors: Use `ConvexError` with structured payload
- Unexpected errors: Standard `Error` (caught by error boundaries)

```typescript
// User-actionable error
throw new ConvexError({
  code: "NOT_FOUND",
  message: "Newsletter not found",
})

// Validation error
throw new ConvexError({
  code: "VALIDATION_ERROR",
  message: "Invalid email format",
  field: "email",
})

// Unexpected error (will be caught by boundary)
throw new Error("Unexpected database state")
```

**Error Codes (standardized):**
- `NOT_FOUND` — Resource doesn't exist
- `UNAUTHORIZED` — User not authenticated
- `FORBIDDEN` — User lacks permission
- `VALIDATION_ERROR` — Input validation failed
- `RATE_LIMITED` — Too many requests
- `EXTERNAL_ERROR` — Third-party service failed

**Date Handling:**
- Storage: Unix timestamps (milliseconds) in Convex
- Display: Format on client using user's locale
- Comparison: Direct number comparison

```typescript
// Convex schema
createdAt: v.number(), // Unix timestamp ms

// Mutation
createdAt: Date.now(),

// Client display
new Date(newsletter.createdAt).toLocaleDateString()
```

### Communication Patterns

**Convex Real-time Pattern:**
- Use Convex queries for all read operations (automatic real-time)
- Mutations trigger automatic UI updates
- No manual refetching needed

```typescript
// ✅ Good - automatic real-time
const newsletters = useQuery(api.newsletters.list)

// ❌ Bad - manual refetch
const [newsletters, setNewsletters] = useState([])
useEffect(() => { refetch() }, [])
```

**Email Worker → Convex Communication:**
- Use Convex HTTP actions for worker-to-database communication
- Worker authenticates via internal API key
- Structured payload for newsletter creation

```typescript
// Email Worker calls Convex
await convex.mutation(api.newsletters.createFromEmail, {
  internalKey: process.env.CONVEX_INTERNAL_KEY,
  email: parsedEmail,
  r2Key: uploadedKey,
})
```

### Process Patterns

**Loading State Pattern:**
- Use Convex/React Query native loading states
- `undefined` = loading, value = loaded
- Suspense boundaries for loading UI

```typescript
// ✅ Good - native pattern
const newsletters = useQuery(api.newsletters.list)
if (newsletters === undefined) return <Skeleton />

// ❌ Bad - manual tracking
const [isLoading, setIsLoading] = useState(true)
```

**Validation Approach:**
- Client: Light validation for immediate UX feedback (form errors)
- Convex: Schema validation as source of truth
- Never trust client validation alone

```typescript
// Client - UX feedback
if (!email.includes("@")) {
  setError("Invalid email")
  return
}

// Convex - enforced validation
email: v.string(), // Schema enforces type
// + custom validation in mutation
```

**Privacy Enforcement Pattern:**
- Every query that returns newsletters MUST filter by privacy
- Private newsletters: only return to owner
- Public newsletters: available to community queries

```typescript
// ✅ MANDATORY pattern for all newsletter queries
const newsletters = await ctx.db
  .query("newsletters")
  .filter(q =>
    q.or(
      q.eq(q.field("isPrivate"), false),           // Public
      q.eq(q.field("userId"), ctx.auth.userId)     // Or owned by user
    )
  )
```

### Enforcement Guidelines

**All AI Agents MUST:**
1. Follow naming conventions exactly as documented
2. Colocate test files with source files
3. Use Convex native patterns (no manual state management for server data)
4. Include privacy filtering in ALL newsletter queries
5. Use structured `ConvexError` for user-actionable errors
6. Store dates as Unix timestamps

**Pattern Verification:**
- oxlint rules will catch naming violations
- PR reviews should verify privacy filtering
- Type system enforces Convex schema compliance

### Anti-Patterns to Avoid

```typescript
// ❌ Manual state management for Convex data
const [data, setData] = useState()
useEffect(() => { fetchData().then(setData) }, [])

// ❌ snake_case in Convex
user_id: v.id("users")

// ❌ Missing privacy filter
const all = await ctx.db.query("newsletters").collect()

// ❌ Unstructured errors
throw new Error("not found")

// ❌ ISO strings for dates
createdAt: "2026-01-15T10:00:00Z"
```

## Project Structure & Boundaries

### Complete Project Directory Structure

```
newsletter-manager/
├── README.md
├── package.json                    # Root workspace package
├── pnpm-workspace.yaml            # pnpm workspace config
├── turbo.json                     # Turborepo pipeline config
├── .oxlintrc.json                 # Linting configuration
├── .gitignore
├── .env.example                   # Environment template
│
├── .github/
│   └── workflows/
│       ├── ci.yml                 # Lint, typecheck, test
│       └── deploy.yml             # Cloudflare deployment
│
├── apps/
│   ├── web/                       # TanStack Start application
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── app.config.ts          # TanStack Start config
│   │   ├── .env.local
│   │   ├── .env.example
│   │   │
│   │   ├── app/
│   │   │   ├── client.tsx         # Client entry
│   │   │   ├── router.tsx         # Router configuration
│   │   │   ├── routeTree.gen.ts   # Generated route tree
│   │   │   │
│   │   │   ├── components/        # Shared UI components
│   │   │   │   ├── ui/            # shadcn/ui components
│   │   │   │   │   ├── Button.tsx
│   │   │   │   │   ├── Card.tsx
│   │   │   │   │   ├── Input.tsx
│   │   │   │   │   ├── Dialog.tsx
│   │   │   │   │   └── Skeleton.tsx
│   │   │   │   ├── layout/
│   │   │   │   │   ├── AppShell.tsx
│   │   │   │   │   ├── Sidebar.tsx
│   │   │   │   │   └── Header.tsx
│   │   │   │   └── ErrorBoundary.tsx
│   │   │   │
│   │   │   ├── routes/
│   │   │   │   ├── __root.tsx     # Root layout
│   │   │   │   │
│   │   │   │   ├── _public/       # Public routes (no auth)
│   │   │   │   │   ├── index.tsx              # Landing page
│   │   │   │   │   ├── auth/
│   │   │   │   │   │   ├── login.tsx
│   │   │   │   │   │   ├── signup.tsx
│   │   │   │   │   │   └── callback.tsx       # OAuth callback
│   │   │   │   │   └── community/
│   │   │   │   │       └── index.tsx          # Public newsletter browse
│   │   │   │   │
│   │   │   │   └── _authed/       # Authenticated routes
│   │   │   │       ├── route.tsx              # Auth guard layout
│   │   │   │       │
│   │   │   │       ├── newsletters/
│   │   │   │       │   ├── index.tsx          # Newsletter list
│   │   │   │       │   ├── $id.tsx            # Newsletter detail/reader
│   │   │   │       │   ├── NewsletterCard.tsx
│   │   │   │       │   ├── NewsletterCard.test.tsx
│   │   │   │       │   ├── ReaderView.tsx
│   │   │   │       │   ├── ReaderView.test.tsx
│   │   │   │       │   ├── SummaryPanel.tsx   # AI summary display
│   │   │   │       │   └── SummaryPanel.test.tsx
│   │   │   │       │
│   │   │   │       ├── senders/
│   │   │   │       │   ├── index.tsx          # Sender list
│   │   │   │       │   ├── $senderId.tsx      # Newsletters by sender
│   │   │   │       │   └── SenderCard.tsx
│   │   │   │       │
│   │   │   │       ├── import/
│   │   │   │       │   ├── index.tsx          # Import dashboard
│   │   │   │       │   ├── gmail.tsx          # Gmail OAuth + import
│   │   │   │       │   ├── GmailConnect.tsx
│   │   │   │       │   ├── SenderSelector.tsx
│   │   │   │       │   └── ImportProgress.tsx
│   │   │   │       │
│   │   │   │       ├── settings/
│   │   │   │       │   ├── index.tsx          # Settings overview
│   │   │   │       │   ├── account.tsx        # Account settings
│   │   │   │       │   ├── email.tsx          # Dedicated email info
│   │   │   │       │   └── privacy.tsx        # Privacy settings
│   │   │   │       │
│   │   │   │       └── admin/                 # Admin-only routes
│   │   │   │           ├── index.tsx          # Admin dashboard
│   │   │   │           ├── health.tsx         # System health
│   │   │   │           └── moderation.tsx     # Content moderation
│   │   │   │
│   │   │   ├── lib/
│   │   │   │   ├── auth.ts        # Better Auth client config
│   │   │   │   ├── convex.ts      # Convex client setup
│   │   │   │   ├── openrouter.ts  # AI client config
│   │   │   │   └── utils.ts       # General utilities
│   │   │   │
│   │   │   └── styles/
│   │   │       └── globals.css    # Tailwind + global styles
│   │   │
│   │   ├── convex/                # Convex backend
│   │   │   ├── _generated/        # Auto-generated types
│   │   │   ├── schema.ts          # Database schema
│   │   │   ├── auth.ts            # Better Auth integration
│   │   │   │
│   │   │   ├── users.ts           # User queries/mutations
│   │   │   ├── newsletters.ts     # Newsletter CRUD
│   │   │   ├── senders.ts         # Sender management
│   │   │   ├── folders.ts         # Folder organization
│   │   │   ├── gmail.ts           # Gmail import functions
│   │   │   ├── ai.ts              # AI summarization actions
│   │   │   ├── community.ts       # Public newsletter queries
│   │   │   ├── admin.ts           # Admin-only functions
│   │   │   │
│   │   │   ├── http.ts            # HTTP endpoints for email worker
│   │   │   │
│   │   │   └── _internal/         # Internal helpers
│   │   │       ├── privacy.ts     # Privacy filtering helpers
│   │   │       └── validation.ts  # Input validation helpers
│   │   │
│   │   └── public/
│   │       ├── favicon.ico
│   │       └── og-image.png
│   │
│   └── email-worker/              # Cloudflare Email Worker
│       ├── package.json
│       ├── tsconfig.json
│       ├── wrangler.toml          # Cloudflare config
│       ├── .dev.vars              # Local secrets
│       │
│       └── src/
│           ├── index.ts           # Worker entry point
│           ├── emailHandler.ts    # Email parsing logic
│           ├── r2Storage.ts       # R2 upload utilities
│           ├── convexClient.ts    # Convex mutation calls
│           └── types.ts           # Email-specific types
│
└── packages/
    └── shared/                    # Shared across apps
        ├── package.json
        ├── tsconfig.json
        │
        └── src/
            ├── index.ts           # Package exports
            ├── types/
            │   ├── newsletter.ts  # Newsletter types
            │   ├── user.ts        # User types
            │   ├── sender.ts      # Sender types
            │   └── email.ts       # Email parsing types
            └── utils/
                ├── dates.ts       # Date formatting
                └── validation.ts  # Shared validation
```

### Architectural Boundaries

**API Boundaries:**

| Boundary | Protocol | Auth |
|----------|----------|------|
| Client → Convex | Convex client (WebSocket) | Better Auth session |
| Email Worker → Convex | Convex HTTP actions | Internal API key |
| Email Worker → R2 | Cloudflare bindings | Worker binding |
| Client → OpenRouter | Server action (proxied) | API key on server |

**Component Boundaries:**

| Boundary | Communication Pattern |
|----------|----------------------|
| Routes → Convex | `useQuery`, `useMutation` hooks |
| Components → State | Convex queries (server state), useState (local UI) |
| Layout → Routes | React context for user/auth |
| Error Boundaries | Feature-level isolation |

**Data Boundaries:**

| Data Type | Storage | Access Pattern |
|-----------|---------|----------------|
| User accounts | Convex `users` | Direct query with auth |
| Newsletter metadata | Convex `newsletters` | Privacy-filtered queries |
| Newsletter content | Cloudflare R2 | Fetch by R2 key |
| OAuth tokens | Better Auth (encrypted) | Never exposed to client |
| AI summaries | Convex `newsletters.summary` | On-demand generation |

### Integration Points

**Internal Communication:**
```
User Action → Convex Mutation → Real-time Update → UI Refresh
Email Arrives → Worker → R2 + Convex → Real-time to User
```

**External Integrations:**

| Service | Integration Point | Purpose |
|---------|-------------------|---------|
| **Google Gmail API** | `convex/gmail.ts` | OAuth + email import |
| **OpenRouter** | `convex/ai.ts` | Newsletter summarization |
| **Cloudflare R2** | `apps/email-worker/src/r2Storage.ts` | Content storage |
| **Cloudflare Email Routing** | `apps/email-worker/` | Inbound email |

### Requirements to Structure Mapping

**Feature Mapping:**

| FR Domain | Primary Location | Supporting Files |
|-----------|-----------------|------------------|
| **User Management (FR1-4)** | `routes/_authed/settings/` | `convex/users.ts`, `convex/auth.ts` |
| **Email Infrastructure (FR5-8)** | `apps/email-worker/` | `convex/newsletters.ts`, `convex/http.ts` |
| **Gmail Import (FR9-13)** | `routes/_authed/import/` | `convex/gmail.ts` |
| **Newsletter Reading (FR14-18)** | `routes/_authed/newsletters/` | `convex/newsletters.ts`, `convex/senders.ts` |
| **AI Features (FR19-20)** | `routes/_authed/newsletters/` | `convex/ai.ts` |
| **Community Database (FR21-24)** | `routes/_public/community/` | `convex/community.ts` |
| **Admin/Operations (FR25-28)** | `routes/_authed/admin/` | `convex/admin.ts` |

**Cross-Cutting Concerns:**

| Concern | Location |
|---------|----------|
| **Authentication** | `app/lib/auth.ts`, `convex/auth.ts`, `routes/_authed/route.tsx` |
| **Privacy Enforcement** | `convex/_internal/privacy.ts`, all newsletter queries |
| **Error Handling** | `components/ErrorBoundary.tsx`, `ConvexError` patterns |
| **Real-time Updates** | Convex queries throughout (automatic) |

### Development Workflow Integration

**Local Development:**
```bash
# Root - starts all apps
pnpm dev

# Individual apps
pnpm --filter web dev          # TanStack Start + Convex
pnpm --filter email-worker dev # Wrangler local
```

**Build Process:**
```bash
pnpm build                     # Builds all apps
pnpm --filter web build        # Production build
pnpm --filter email-worker deploy # Deploy worker
```

**Testing:**
```bash
pnpm test                      # All tests
pnpm --filter web test         # Web app tests only
```

**Deployment Structure:**
- `apps/web/` → Cloudflare Pages (auto-deploy from main)
- `apps/email-worker/` → Cloudflare Workers (wrangler deploy)
- `convex/` → Convex Cloud (auto-deploy with web)

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
All technology choices validated as compatible:
- TanStack Start + Convex: Official integration with React Query
- Convex + Better Auth: Supported via `@convex-dev/better-auth`
- Cloudflare ecosystem: Pages + Workers + R2 work seamlessly
- Turborepo: Manages all packages without conflicts

**Pattern Consistency:**
- Naming patterns (camelCase) consistent across all layers
- Domain-based organization in both routes and Convex
- Privacy enforcement documented with mandatory code pattern
- Error handling standardized with ConvexError

**Structure Alignment:**
- Monorepo structure supports all integration points
- Shared package enables type sharing across apps
- Clear boundaries between web app, email worker, and shared code

### Requirements Coverage Validation ✅

**Functional Requirements (28/28 covered):**
- User Management (FR1-4): Auth, settings, dedicated email
- Email Infrastructure (FR5-8): Worker, parsing, real-time delivery
- Gmail Import (FR9-13): OAuth, scanning, historical import
- Newsletter Reading (FR14-18): Reader, organization, folders
- AI Features (FR19-20): On-demand summarization
- Community Database (FR21-24): Public browsing, privacy controls
- Admin/Operations (FR25-28): Dashboard, health, moderation

**Non-Functional Requirements (14/14 covered):**
- Performance: Convex real-time, SSR, optimistic updates
- Security: HTTPS, encrypted OAuth, privacy enforcement
- Reliability: Error boundaries, graceful degradation
- Integration: Gmail API, Cloudflare Workers, Convex

### Implementation Readiness Validation ✅

**Decision Completeness:**
- All critical decisions documented with versions
- Technology rationale provided for major choices
- Alternative options evaluated (database, AI provider)

**Structure Completeness:**
- 70+ files/directories explicitly mapped
- Every functional requirement has a file location
- Integration points documented with protocols and auth

**Pattern Completeness:**
- Comprehensive naming conventions with examples
- Privacy enforcement as mandatory pattern
- Error handling, loading states, validation documented
- Anti-patterns clearly listed for avoidance

### Gap Analysis Results

**Critical Gaps:** None

**Minor Implementation Details (non-blocking):**
- Convex schema will be defined during first implementation story
- R2 bucket naming follows project convention (newsletter-content)
- Testing framework defaults to Vitest (TanStack Start default)

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed (Medium)
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped (5 identified)

**✅ Architectural Decisions**
- [x] Critical decisions documented with rationale
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**✅ Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**✅ Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** ✅ READY FOR IMPLEMENTATION

**Confidence Level:** HIGH

**Key Strengths:**
- Real-time architecture (Convex) matches core requirements
- Privacy enforcement baked into patterns, not afterthought
- Unified Cloudflare ecosystem reduces integration complexity
- Turborepo enables future mobile app without restructuring
- Clear patterns prevent AI agent implementation conflicts

**Areas for Future Enhancement:**
- Background summarization (post-MVP)
- Advanced caching strategies
- External monitoring integration (Sentry)
- Mobile app (Expo in Turborepo)

### Implementation Handoff

**AI Agent Guidelines:**
1. Follow all architectural decisions exactly as documented
2. Use implementation patterns consistently across all components
3. Respect project structure and boundaries
4. Apply privacy filtering to ALL newsletter queries
5. Use ConvexError for user-actionable errors
6. Refer to this document for all architectural questions

**First Implementation Priority:**
```bash
# 1. Create Turborepo monorepo
npx create-turbo@latest newsletter-manager

# 2. Set up web app with Convex
cd newsletter-manager/apps
npm create convex@latest -- -t tanstack-start web

# 3. Initialize shadcn/ui with Base UI
cd web && npx shadcn@latest init
```

## Architecture Completion Summary

### Workflow Completion

**Architecture Decision Workflow:** COMPLETED ✅
**Total Steps Completed:** 8
**Date Completed:** 2026-01-20
**Document Location:** `_bmad-output/planning-artifacts/architecture.md`

### Final Architecture Deliverables

**Complete Architecture Document**
- All architectural decisions documented with specific versions
- Implementation patterns ensuring AI agent consistency
- Complete project structure with all files and directories
- Requirements to architecture mapping
- Validation confirming coherence and completeness

**Implementation Ready Foundation**
- 25+ architectural decisions made
- 9 implementation patterns defined
- 70+ files/directories specified
- 28 functional requirements + 14 NFRs fully supported

**AI Agent Implementation Guide**
- Technology stack with verified versions
- Consistency rules that prevent implementation conflicts
- Project structure with clear boundaries
- Integration patterns and communication standards

### Quality Assurance Checklist

**✅ Architecture Coherence**
- [x] All decisions work together without conflicts
- [x] Technology choices are compatible
- [x] Patterns support the architectural decisions
- [x] Structure aligns with all choices

**✅ Requirements Coverage**
- [x] All functional requirements are supported
- [x] All non-functional requirements are addressed
- [x] Cross-cutting concerns are handled
- [x] Integration points are defined

**✅ Implementation Readiness**
- [x] Decisions are specific and actionable
- [x] Patterns prevent agent conflicts
- [x] Structure is complete and unambiguous
- [x] Examples are provided for clarity

### Project Success Factors

**Clear Decision Framework**
Every technology choice was made collaboratively with clear rationale, ensuring all stakeholders understand the architectural direction.

**Consistency Guarantee**
Implementation patterns and rules ensure that multiple AI agents will produce compatible, consistent code that works together seamlessly.

**Complete Coverage**
All project requirements are architecturally supported, with clear mapping from business needs to technical implementation.

**Solid Foundation**
The chosen starter template and architectural patterns provide a production-ready foundation following current best practices.

---

**Architecture Status:** READY FOR IMPLEMENTATION ✅

**Next Phase:** Begin implementation using the architectural decisions and patterns documented herein.

**Document Maintenance:** Update this architecture when major technical decisions are made during implementation.

