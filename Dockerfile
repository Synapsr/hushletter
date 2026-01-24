# syntax=docker/dockerfile:1
FROM node:23-slim AS base

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY apps/email-worker/package.json ./apps/email-worker/
COPY packages/backend/package.json ./packages/backend/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build args for Convex
ARG CONVEX_DEPLOY_KEY
ARG VITE_CONVEX_URL

# Deploy Convex and build web app
RUN cd packages/backend && npx convex deploy --cmd 'cd ../.. && pnpm --filter @newsletter-manager/web build'

# Production stage
FROM node:23-slim AS runner

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy built app and dependencies
COPY --from=base /app ./

EXPOSE 3000

CMD ["pnpm", "--filter", "@newsletter-manager/web", "start"]
