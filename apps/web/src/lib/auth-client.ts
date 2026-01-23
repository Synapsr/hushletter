import { createAuthClient } from "better-auth/react"
import { convexClient } from "@convex-dev/better-auth/client/plugins"

// Initialize Better Auth client with Convex plugin
// The convexClient plugin handles authentication state management
export const authClient = createAuthClient({
  plugins: [convexClient()],
})

// Re-export commonly used auth functions for convenience
export const { signUp, signIn, signOut, useSession } = authClient
