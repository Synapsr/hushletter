import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import type { RouterContext } from "@/router";
import { signOut } from "@/lib/auth-client";
import { Button } from "@hushletter/ui";
import { Settings, Download, Globe, Shield } from "lucide-react";

export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ context }) => {
    // Type-safe check for authentication status from root context
    const ctx = context as RouterContext;
    if (!ctx.isAuthenticated) {
      throw redirect({ to: "/login" });
    }
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const navigate = useNavigate();

  // Story 7.1 Task 1.4: Check if user is admin for conditional nav link
  const { data: adminCheck } = useQuery(convexQuery(api.admin.checkIsAdmin, {}));
  const isAdmin = adminCheck?.isAdmin ?? false;

  const handleLogout = async () => {
    try {
      await signOut();
      // Redirect to landing page after successful logout
      navigate({ to: "/" });
    } catch {
      // Even if signOut fails, redirect to home
      // The session may already be invalid
      navigate({ to: "/" });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="text-xl font-bold text-gray-900 dark:text-white">Newsletter Manager</div>
          <nav className="flex items-center gap-2">
            {/* Story 7.1 Task 1.4: Admin navigation link (only visible to admins) */}
            {isAdmin && (
              <Link
                to="/admin"
                className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                activeProps={{ className: "text-foreground bg-gray-100 dark:bg-gray-800" }}
                aria-label="Admin Dashboard"
              >
                <Shield className="h-5 w-5" />
              </Link>
            )}
            {/* Story 6.1 Task 6: Community navigation link */}
            <Link
              to="/community"
              className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
              activeProps={{ className: "text-foreground bg-gray-100 dark:bg-gray-800" }}
              aria-label="Browse Community"
            >
              <Globe className="h-5 w-5" />
            </Link>
            <Link
              to="/import"
              className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
              activeProps={{ className: "text-foreground bg-gray-100 dark:bg-gray-800" }}
              aria-label="Import Newsletters"
            >
              <Download className="h-5 w-5" />
            </Link>
            <Link
              to="/settings"
              className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
              activeProps={{ className: "text-foreground bg-gray-100 dark:bg-gray-800" }}
              aria-label="Settings"
            >
              <Settings className="h-5 w-5" />
            </Link>
            <Button variant="ghost" onClick={handleLogout}>
              Sign Out
            </Button>
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
