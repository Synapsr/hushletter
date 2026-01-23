import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router"
import type { RouterContext } from "~/router"
import { signOut } from "~/lib/auth-client"
import { Button } from "~/components/ui/button"

export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ context }) => {
    // Type-safe check for authentication status from root context
    const ctx = context as RouterContext
    if (!ctx.isAuthenticated) {
      throw redirect({ to: "/login" })
    }
  },
  component: AuthedLayout,
})

function AuthedLayout() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await signOut()
      // Redirect to landing page after successful logout
      navigate({ to: "/" })
    } catch {
      // Even if signOut fails, redirect to home
      // The session may already be invalid
      navigate({ to: "/" })
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="text-xl font-bold text-gray-900 dark:text-white">
            Newsletter Manager
          </div>
          <Button variant="ghost" onClick={handleLogout}>
            Sign Out
          </Button>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
