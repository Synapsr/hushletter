# syntax=docker/dockerfile:1
FROM oven/bun:1 AS base

WORKDIR /app

# Copy package files
COPY package.json bun.lock turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/email-worker/package.json ./apps/email-worker/
COPY packages/backend/package.json ./packages/backend/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build args for Convex
ARG CONVEX_DEPLOY_KEY
ARG VITE_CONVEX_URL

# Deploy Convex and build web app
RUN cd packages/backend && bunx convex deploy --cmd 'cd ../.. && bun run --filter @hushletter/web build'

# Production stage
FROM oven/bun:1 AS runner

WORKDIR /app

# Copy built app and dependencies
COPY --from=base /app ./

EXPOSE 3000

CMD ["bun", "run", "--filter", "@hushletter/web", "start"]
