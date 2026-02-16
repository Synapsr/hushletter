# @hushletter/web

TanStack Start web application for Hushletter.

## Stack

- **Framework**: TanStack Start (React 19 metaframework)
- **Routing**: TanStack Router (file-based)
- **UI**: shadcn/ui + Base UI + Tailwind CSS v4
- **Forms**: TanStack Form + Zod validation
- **i18n**: Paraglide JS v2 (English + French)
- **State**: TanStack Query + Convex real-time subscriptions

## Development

```bash
bun run dev        # Start web + Convex backend
bun run dev:web    # Start web only
bun run test       # Run tests
bun run lint       # Type check + oxlint
bun run build      # Production build
```

## Structure

- `src/routes/` — File-based routes (TanStack Router)
- `src/components/` — React components
- `src/hooks/` — Custom hooks
- `src/lib/` — Utilities, auth, validators
- `src/styles/` — Global CSS
- `messages/` — i18n translation files (en.json, fr.json)
