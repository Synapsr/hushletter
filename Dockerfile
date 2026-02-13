# syntax=docker/dockerfile:1
FROM oven/bun:1 AS base

WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json bun.lock turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/email-worker/package.json ./apps/email-worker/
COPY packages/backend/package.json ./packages/backend/
COPY packages/config/package.json ./packages/config/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/

RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Build args needed by web build
ARG VITE_CONVEX_URL
ARG VITE_CONVEX_SITE_URL
ARG VITE_SITE_URL

# Build web app only
RUN VITE_CONVEX_URL="$VITE_CONVEX_URL" \
    VITE_CONVEX_SITE_URL="$VITE_CONVEX_SITE_URL" \
    VITE_SITE_URL="$VITE_SITE_URL" \
    bun run --filter @hushletter/web build

# Production stage
FROM oven/bun:1 AS runner

WORKDIR /app

COPY --from=base /app ./

EXPOSE 3000

CMD ["bun", "run", "--filter", "@hushletter/web", "start"]
