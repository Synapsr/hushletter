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

## Monorepo Architecture

This project uses **Turborepo** with **bun workspaces** for monorepo management.

### Workspaces

| Workspace    | Package Prefix | Purpose                      |
| ------------ | -------------- | ---------------------------- |
| `apps/*`     | `@hushletter/`      | Deployable applications      |
| `packages/*` | `@hushletter/`      | Shared libraries and configs |


### Forms
- look at the details at docs/FORM_HANDLING.md
