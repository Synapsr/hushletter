import { createAuthClient } from "better-auth/react"
import { emailOTPClient } from "better-auth/client/plugins"
import { convexClient } from "@convex-dev/better-auth/client/plugins"

// Initialize Better Auth client with Convex plugin
// The convexClient plugin handles authentication state management
export const authClient = createAuthClient({
  plugins: [convexClient(), emailOTPClient()],
})

// Re-export commonly used auth functions for convenience
export const { signUp, signIn, signOut, useSession } = authClient
export const { emailOtp } = authClient
