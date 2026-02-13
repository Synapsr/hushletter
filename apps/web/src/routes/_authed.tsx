import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import type { RouterContext } from "@/router";
import { signOut } from "@/lib/auth-client";
import { Button } from "@hushletter/ui";
import { Settings, Download, Globe, Shield } from "lucide-react";
import { m } from "@/paraglide/messages.js";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SharedLogo } from "@/components/shared/shared-logo";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { UserMenu } from "@/components/navigation/user-menu";
import { GlobalSearch } from "@/components/navigation/global-search";

export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ context }) => {
    // Type-safe check for authentication status from root context
    const ctx = context as RouterContext;
    if (!ctx.isAuthenticated) {
      throw redirect({ to: "/{-$locale}/login" });
    }
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  // Story 7.1 Task 1.4: Check if user is admin for conditional nav link
  const { data: adminCheck } = useQuery(
    convexQuery(api.admin.checkIsAdmin, {}),
  );
  const isAdmin = adminCheck?.isAdmin ?? false;

  const handleLogout = async () => {
    try {
      await signOut();
    } catch {
      // Even if signOut fails, redirect to home
      // The session may already be invalid
    }
    // Navigate to landing page — middleware will redirect to /fr/ if cookie is French
    window.location.href = "/";
  };

  return (
    <div className="h-screen w-screen flex flex-col">
      <header className="border-b shrink-0">
        <div className="px-4 py-3 flex justify-between items-center">
          <Link to="/newsletters">
            <SharedLogo />
          </Link>

          <div className="flex items-center gap-2">
            <GlobalSearch />
            <SettingsDialog />
            <UserMenu />
          </div>

          {/* <nav className="flex items-center gap-2">
            {isAdmin && (
              <Link
                to="/admin"
                className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
                activeProps={{
                  className: "text-foreground bg-gray-100 dark:bg-gray-800",
                }}
                aria-label={m.nav_adminDashboard()}
              >
                <Shield className="h-5 w-5" />
              </Link>
            )}
            <Link
              to="/community"
              className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
              activeProps={{
                className: "text-foreground bg-gray-100 dark:bg-gray-800",
              }}
              aria-label={m.nav_browseCommunity()}
            >
              <Globe className="h-5 w-5" />
            </Link>
            <Link
              to="/import"
              className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
              activeProps={{
                className: "text-foreground bg-gray-100 dark:bg-gray-800",
              }}
              aria-label={m.nav_importNewsletters()}
            >
              <Download className="h-5 w-5" />
            </Link>
            <Link
              to="/settings"
              className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
              activeProps={{
                className: "text-foreground bg-gray-100 dark:bg-gray-800",
              }}
              aria-label={m.nav_settings()}
            >
              <Settings className="h-5 w-5" />
            </Link>
            <LanguageSwitcher />
            <Button variant="ghost" onClick={handleLogout}>
              {m.common_signOut()}
            </Button>
          </nav> */}
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
