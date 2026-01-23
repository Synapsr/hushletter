import { getAuthConfigProvider } from "@convex-dev/better-auth/auth-config"
import type { AuthConfig } from "convex/server"

// Auth configuration for Convex - integrates Better Auth provider
export default {
  providers: [getAuthConfigProvider()],
} satisfies AuthConfig
