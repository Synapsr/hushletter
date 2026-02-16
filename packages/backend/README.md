# @hushletter/backend

Convex backend for Hushletter. Contains database schema, server functions, authentication, billing, and email ingestion logic.

## Structure

- `convex/` — Convex functions (queries, mutations, actions)
- `convex/schema.ts` — Database schema definition
- `convex/auth.ts` — Better Auth configuration
- `convex/_internal/` — Internal utilities (email generation, content detection)
- `convex/_generated/` — Auto-generated Convex types (do not edit)
- `convex/migrations/` — Database migrations

## Key Modules

| File | Purpose |
| --- | --- |
| `newsletters.ts` | Newsletter CRUD and reading |
| `emailIngestion.ts` | Incoming email processing |
| `gmail.ts` | Gmail OAuth import |
| `community.ts` | Community sharing features |
| `billing.ts` | Stripe subscription management |
| `ai.ts` | AI-powered summaries |
| `admin.ts` | Admin moderation functions |

## Testing

```bash
bun run test
```

Uses `convex-test` for unit and integration tests. Test files are co-located alongside source files.
