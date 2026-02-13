# syntax=docker/dockerfile:1
FROM oven/bun:1 AS base

WORKDIR /app

# Copy package files
COPY package.json bun.lock turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/email-worker/package.json ./apps/email-worker/
COPY packages/backend/package.json ./packages/backend/
COPY packages/config/package.json ./packages/config/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build args for Convex
ARG CONVEX_DEPLOYMENT
ARG CONVEX_DEPLOY_KEY
ARG VITE_CONVEX_URL
ARG VITE_CONVEX_SITE_URL
ARG VITE_SITE_URL
ARG RUN_CONVEX_DEPLOY=true

# Deploy Convex by default (same behavior as your previous working pipeline),
# with an opt-out switch for environments that need it.
RUN if [ "$RUN_CONVEX_DEPLOY" = "true" ]; then \
      cd packages/backend && \
      CONVEX_DEPLOYMENT="$CONVEX_DEPLOYMENT" CONVEX_DEPLOY_KEY="$CONVEX_DEPLOY_KEY" \
      VITE_CONVEX_URL="$VITE_CONVEX_URL" VITE_CONVEX_SITE_URL="$VITE_CONVEX_SITE_URL" VITE_SITE_URL="$VITE_SITE_URL" \
      npx convex deploy --yes --cmd 'cd ../.. && bun run --filter @hushletter/web build'; \
    else \
      VITE_CONVEX_URL="$VITE_CONVEX_URL" VITE_CONVEX_SITE_URL="$VITE_CONVEX_SITE_URL" VITE_SITE_URL="$VITE_SITE_URL" \
      bun run --filter @hushletter/web build; \
    fi

# Production stage
FROM oven/bun:1 AS runner

WORKDIR /app

# Copy built app and dependencies
COPY --from=base /app ./

EXPOSE 3000

CMD ["bun", "run", "--filter", "@hushletter/web", "start"]
