# hushletter - AI Agent Context

> Universal context file for AI coding assistants. See also: [CLAUDE.md](./CLAUDE.md) for Claude-specific context.

## Overview

**hushletter** is a

- **License**: MIT (open-source)
- **Monorepo**: Turborepo + bun workspaces
- **Language**: TypeScript (strict mode)
- **Framework**: Tanstack start with convex

## Architecture

## Tech Stack

| Layer         | Technology                          |
| ------------- | ----------------------------------- |
| Monorepo      | Turborepo + bun workspaces         |
| Runtime       | Node.js, React 19       |
| Language      | TypeScript 5                        |
| Database      | Convex               |
| Auth          | Convex + better-auth         |
| API           | Convex + TanStack query                |
| Data Fetching | TanStack Query                      |
| Validation    | Zod                                 |
| UI            | Tailwind CSS 4, shadcn/ui, Base ui |
| Forms         | Tanstack Form                     |
| Payments      | Polar                      |
| Email         | React Email, Resend             |
| PDF           | @react-pdf/renderer                 |

## Performance And Bandwidth Guidelines

### Convex + TanStack Query (`@convex-dev/react-query`)

- **Never rely on React Query `enabled:` to “turn off” Convex**. If a query must be conditional, pass Convex args as `"skip"`: `convexQuery(fn, condition ? args : "skip")`. Otherwise the query can still get cached and subscribed.
- Prefer **“reactive head + non-reactive tail” pagination** for long lists: subscribe to only the newest page via a query (head), and fetch older pages via actions (tail) for infinite scroll / “Load more”.
- Keep **list query payloads lightweight** (metadata only). Avoid returning large optional fields (e.g. full summaries or content) in list endpoints.
- Avoid **high-frequency writes to hot list documents**. If the UI needs continuous updates (ex: scroll progress), write to a separate table and only patch the main doc for coarse state transitions (ex: `isRead` at 100%).
- Prefer selective indexes and avoid “collect everything then filter in JS” for user lists. Keep dependency sets small so reactive queries don’t re-run unnecessarily.

### Measuring

- Use Convex logs + hour aggregation to find the top bandwidth consumers: `bunx convex logs --success --jsonl --history 20000 | node scripts/convex-bandwidth.mjs --utc`

## Monorepo Architecture

This project uses **Turborepo** with **bun workspaces** for monorepo management.

### Workspaces

| Workspace    | Package Prefix | Purpose                      |
| ------------ | -------------- | ---------------------------- |
| `apps/*`     | `@hushletter/`      | Deployable applications      |
| `packages/*` | `@hushletter/`      | Shared libraries and configs |


### Forms
- look at the details at docs/FORM_HANDLING.md
