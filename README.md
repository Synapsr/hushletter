# Hushletter

Your newsletters, organized and accessible. One dedicated email address. All your newsletters in one clean interface.

## Tech Stack

- **Monorepo**: Turborepo with Bun workspaces
- **Frontend**: TanStack Start (React metaframework)
- **Backend**: Convex (real-time database)
- **Authentication**: Better Auth with Convex integration
- **UI**: shadcn/ui with Base UI primitives
- **Styling**: Tailwind CSS v4
- **Linting**: oxlint

## Project Structure

```
hushletter/
├── apps/
│   ├── web/                    # TanStack Start web app
│   │   ├── src/
│   │   │   ├── routes/         # File-based routing
│   │   │   ├── components/     # React components
│   │   │   └── lib/            # Utilities
│   │   └── package.json
│   └── native/                 # (Future) Expo React Native app
│
├── packages/
│   ├── backend/                # Convex backend (shared)
│   │   ├── schema.ts           # Database schema
│   │   ├── auth.ts             # Better Auth config
│   │   ├── convex.config.ts    # Convex component config
│   │   └── _generated/         # Auto-generated types
│   └── shared/                 # Shared types/utilities
│       └── src/
│           ├── types/
│           └── utils/
│
└── turbo.json                  # Turborepo config
```

## Getting Started

### Prerequisites

- Bun 1.x+
- Convex account ([sign up](https://convex.dev))

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd hushletter

# Install dependencies
bun install
```

### Convex Setup

1. Create a new Convex project at [dashboard.convex.dev](https://dashboard.convex.dev)

2. Initialize Convex in the backend package:
   ```bash
   cd packages/backend
   bunx convex dev
   ```
   Follow the prompts to connect to your Convex project.

3. Copy environment files:
   ```bash
   # Backend
   cp packages/backend/.env.example packages/backend/.env.local

   # Web app
   cp apps/web/.env.example apps/web/.env.local
   ```

4. Update `apps/web/.env.local` with your Convex URL:
   ```
   VITE_CONVEX_URL=https://your-deployment-name.convex.cloud
   ```

5. Set the Better Auth secret in Convex:
   ```bash
   cd packages/backend
   bunx convex env set BETTER_AUTH_SECRET=$(openssl rand -base64 32)
   ```

### Development

```bash
# Start all services (backend + web)
bun dev
```

This will start:
- Convex backend server (packages/backend)
- TanStack Start web app at http://localhost:3000 (apps/web)

### Running Individual Apps

```bash
# Backend only
bun --filter @hushletter/backend dev

# Web only (requires backend running)
bun --filter @hushletter/web dev
```

## Adding a Mobile App (Expo)

This monorepo is structured to easily add an Expo React Native app:

1. Create the native app:
   ```bash
   cd apps
   bunx create-expo-app native
   ```

2. Add the backend dependency:
   ```bash
   cd native
   bun add @hushletter/backend convex
   ```

3. Configure Expo to use the shared Convex backend.

## Deployment

### Convex Production

```bash
cd packages/backend
bunx convex deploy
```

### Web App (Cloudflare Pages)

1. Connect your repository to Cloudflare Pages
2. Configure build settings:
   - Build command: `bun --filter @hushletter/web build`
   - Build output: `apps/web/.vinxi/build/output/public`
3. Set environment variables:
   - `VITE_CONVEX_URL`: Your Convex production URL
   - `VITE_SITE_URL`: Your production URL

## Scripts

| Command | Description |
|---------|-------------|
| `bun dev` | Start all development servers |
| `bun run build` | Build all packages |
| `bun run lint` | Run oxlint on all packages |
| `bun run format` | Format code with Prettier |

## License

MIT
