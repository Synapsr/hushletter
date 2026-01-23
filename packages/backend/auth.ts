// Better Auth configuration for Convex
// Full setup will be completed when Convex is initialized with `npx convex dev`
// Story 1.2 will configure the authentication providers

// Note: The createClient function requires the generated components.betterAuth
// from convex/_generated/api which is created after running `npx convex dev`

// Placeholder auth configuration - to be expanded in Story 1.2
export const authConfig = {
  emailAndPassword: {
    enabled: false, // Enable in Story 1.2
    requireEmailVerification: false,
  },
}

// After running `npx convex dev`, uncomment and configure:
// import { createClient } from "@convex-dev/better-auth"
// import { components } from "./_generated/api"
// export const authComponent = createClient(components.betterAuth)
