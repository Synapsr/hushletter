# Hushletter

Your newsletters, organized and accessible. One dedicated email address. All your newsletters in one clean interface.

## Features

- Dedicated email address for newsletter subscriptions
- Clean reader interface with keyboard shortcuts
- Newsletter organization with folders and sender management
- AI-powered newsletter summaries (Pro)
- Gmail import with automatic sender scanning
- EML file drag-and-drop import
- Community newsletter discovery and sharing
- Public sharing via unique links
- Multi-language support (English, French)
- Stripe billing integration (free and Pro plans)

## Tech Stack

| Layer           | Technology                    |
| --------------- | ----------------------------- |
| Monorepo        | Turborepo + bun workspaces   |
| Frontend        | TanStack Start (React 19)    |
| Backend         | Convex (real-time database)   |
| Auth            | Better Auth + Convex          |
| UI              | shadcn/ui, Base UI, Tailwind CSS v4 |
| Forms           | TanStack Form + Zod           |
| Payments        | Stripe                        |
| Email Ingestion | Cloudflare Workers             |
| i18n            | Paraglide JS v2                |
| Linting         | oxlint                         |
| Formatting      | oxfmt                          |
| Testing         | Vitest                         |

## Project Structure

```
hushletter/
├── apps/
│   ├── web/                    # TanStack Start web app
│   │   ├── src/
│   │   │   ├── routes/         # File-based routing
│   │   │   ├── components/     # React components
│   │   │   ├── hooks/          # Custom hooks
│   │   │   └── lib/            # Utilities
│   │   └── package.json
│   └── email-worker/           # Cloudflare Worker for email ingestion
│
├── packages/
│   ├── backend/                # Convex backend (schema, functions, auth)
│   │   ├── convex/             # Convex functions
│   │   └── _generated/         # Auto-generated types
│   ├── ui/                     # Shared UI components (shadcn/ui)
│   ├── shared/                 # Shared types and utilities
│   └── config/                 # Shared TypeScript config
│
├── docs/                       # Documentation
└── scripts/                    # Utility scripts
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) 1.3+
- [Convex](https://convex.dev) account

### Installation

```bash
git clone https://github.com/teo-goulois/hushletter.git
cd hushletter
bun install
```

### Environment Setup

1. Create a new Convex project at [dashboard.convex.dev](https://dashboard.convex.dev)

2. Copy environment files:
   ```bash
   cp packages/backend/.env.example packages/backend/.env.local
   cp apps/web/.env.example apps/web/.env.local
   ```

3. Update `packages/backend/.env.local` with your Convex deployment name:
   ```
   CONVEX_DEPLOYMENT=dev:your-deployment-name
   ```

4. Update `apps/web/.env.local` with your Convex URL:
   ```
   VITE_CONVEX_URL=https://your-deployment-name.convex.cloud
   VITE_SITE_URL=http://localhost:3000
   ```

5. Initialize the Convex backend:
   ```bash
   cd packages/backend
   bunx convex dev
   ```

6. Set the Better Auth secret in Convex:
   ```bash
   bunx convex env set BETTER_AUTH_SECRET=$(openssl rand -base64 32)
   ```

### Optional Environment Variables

These are needed for specific features:

| Variable | Where to set | Feature |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Convex env | Gmail import |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Convex env | Billing |
| `RESEND_API_KEY` | Convex env | Transactional emails |
| `OPENROUTER_API_KEY` | Convex env | AI summaries |
| `R2_*` credentials | Convex env | Cloudflare R2 storage |

### Development

```bash
# Start all services (Convex backend + web app)
bun dev
```

This starts:
- Convex backend server (`packages/backend`)
- TanStack Start web app at http://localhost:3000 (`apps/web`)

### Running Individual Services

```bash
# Web only (requires Convex backend running)
bun --filter @hushletter/web dev:web

# Backend only
bun --filter @hushletter/web dev:convex
```

## Deployment

### Web App (Docker)

```bash
docker build \
  --build-arg VITE_CONVEX_URL=https://your-deployment.convex.cloud \
  --build-arg VITE_SITE_URL=https://your-domain.com \
  -t hushletter .

docker run -p 3000:3000 hushletter
```

### Convex Backend

```bash
cd packages/backend
bunx convex deploy
```

### Email Worker (Cloudflare Workers)

```bash
cd apps/email-worker
wrangler secret put CONVEX_URL
wrangler secret put INTERNAL_API_KEY
wrangler deploy
```

Configure email routing in your Cloudflare dashboard to route emails to the worker.

## Scripts

| Command | Description |
| ------- | ----------- |
| `bun dev` | Start all development servers |
| `bun run build` | Build all packages |
| `bun run lint` | Run type checking + oxlint |
| `bun run test` | Run all tests with Vitest |
| `bun run format` | Format code with oxfmt |

## Documentation

- [Form Handling](docs/FORM_HANDLING.md) — TanStack Form patterns and conventions

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

[MIT](LICENSE)
