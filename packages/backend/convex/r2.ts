import { R2 } from "@convex-dev/r2"
import { components } from "./_generated/api"

/**
 * R2 client instance for storing newsletter content
 * Used by actions to upload HTML/text content to Cloudflare R2
 *
 * BEFORE DEPLOYING: Set these environment variables in Convex dashboard:
 *
 * npx convex env set R2_BUCKET newsletter-content
 * npx convex env set R2_ENDPOINT https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com
 * npx convex env set R2_ACCESS_KEY_ID YOUR_ACCESS_KEY_ID
 * npx convex env set R2_SECRET_ACCESS_KEY YOUR_SECRET_ACCESS_KEY
 *
 * To get these values:
 * 1. Go to Cloudflare Dashboard > R2 > Overview
 * 2. Create a bucket named "newsletter-content"
 * 3. Go to "Manage R2 API Tokens" and create a token with Object Read & Write
 * 4. Copy the Access Key ID, Secret Access Key, and Endpoint URL
 */
export const r2 = new R2(components.r2)
