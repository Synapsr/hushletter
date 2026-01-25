import { createFileRoute, Outlet, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { convexQuery } from "@convex-dev/react-query"
import { api } from "@newsletter-manager/backend"
import { Skeleton } from "~/components/ui/skeleton"
import { ShieldAlert } from "lucide-react"

/**
 * Admin route layout - guards all /admin/* routes
 * Story 7.1: Task 1.3 - Admin-only route guard layout
 *
 * This layout component:
 * 1. Checks if user has admin role via checkIsAdmin query
 * 2. Shows access denied for non-admins
 * 3. Provides admin header navigation for all admin pages
 */
export const Route = createFileRoute("/_authed/admin")({
  component: AdminLayout,
})

function AdminLayout() {
  const { data: adminCheck, isPending, isError, error } = useQuery(
    convexQuery(api.admin.checkIsAdmin, {})
  )

  // Show loading skeleton while checking admin status
  if (isPending) {
    return (
      <div className="flex flex-col h-full">
        <header className="border-b px-6 py-4">
          <Skeleton className="h-7 w-48" />
        </header>
        <div className="flex-1 p-6">
          <Skeleton className="h-8 w-64 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[120px]" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Handle query errors
  if (isError) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-[50vh] gap-4"
        role="alert"
        aria-live="polite"
      >
        <ShieldAlert className="h-12 w-12 text-destructive" aria-hidden="true" />
        <h1 className="text-2xl font-bold">Error</h1>
        <p className="text-muted-foreground">
          {error?.message ?? "An error occurred while checking permissions."}
        </p>
      </div>
    )
  }

  // Check if user has admin access
  if (!adminCheck?.isAdmin) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-[50vh] gap-4"
        role="alert"
        aria-live="polite"
      >
        <ShieldAlert className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
        <h1 className="text-2xl font-bold">Access Denied</h1>
        <p className="text-muted-foreground">
          You do not have permission to access this area.
        </p>
        <Link
          to="/newsletters"
          className="text-primary hover:underline mt-4"
        >
          Return to Newsletters
        </Link>
      </div>
    )
  }

  // Admin user - render admin layout with outlet
  return (
    <div className="flex flex-col h-full min-h-screen">
      <header className="border-b border-border bg-background px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Admin Dashboard</h1>
          <nav className="flex items-center gap-4" aria-label="Admin navigation">
            <Link
              to="/admin"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              activeProps={{ className: "text-foreground font-medium" }}
              activeOptions={{ exact: true }}
            >
              Overview
            </Link>
            <Link
              to="/admin/health"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              activeProps={{ className: "text-foreground font-medium" }}
            >
              Health Details
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  )
}
