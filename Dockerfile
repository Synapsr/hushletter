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
ARG CONVEX_DEPLOYMENT
ARG CONVEX_DEPLOY_KEY
ARG VITE_CONVEX_URL
ARG VITE_CONVEX_SITE_URL
ARG VITE_SITE_URL
ARG RUN_CONVEX_DEPLOY=true

# One-step deploy from EasyPanel:
# - with RUN_CONVEX_DEPLOY=true and CONVEX_DEPLOY_KEY set: deploy Convex + build web
# - otherwise: build web only
RUN if [ "$RUN_CONVEX_DEPLOY" = "true" ] && [ -n "$CONVEX_DEPLOY_KEY" ]; then \
      CONVEX_DEPLOYMENT="$CONVEX_DEPLOYMENT" \
      CONVEX_DEPLOY_KEY="$CONVEX_DEPLOY_KEY" \
      VITE_CONVEX_URL="$VITE_CONVEX_URL" \
      VITE_CONVEX_SITE_URL="$VITE_CONVEX_SITE_URL" \
      VITE_SITE_URL="$VITE_SITE_URL" \
      bun run deploy:convex:web; \
    else \
      VITE_CONVEX_URL="$VITE_CONVEX_URL" \
      VITE_CONVEX_SITE_URL="$VITE_CONVEX_SITE_URL" \
      VITE_SITE_URL="$VITE_SITE_URL" \
      bun run --filter @hushletter/web build; \
    fi

# Production stage
FROM oven/bun:1 AS runner

WORKDIR /app

COPY --from=base /app ./

EXPOSE 3000

CMD ["bun", "run", "--filter", "@hushletter/web", "start"]
