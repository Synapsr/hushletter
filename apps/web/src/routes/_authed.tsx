import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import type { RouterContext } from "@/router";
import { SharedLogo } from "@/components/shared/shared-logo";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { UserMenu } from "@/components/navigation/user-menu";
import { GlobalSearch } from "@/components/navigation/global-search";

export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ context, location }) => {
    // Type-safe check for authentication status from root context
    const ctx = context as RouterContext;
    if (!ctx.isAuthenticated) {
      throw redirect({ to: "/{-$locale}/login" });
    }

    // Skip onboarding check if already on the onboarding page
    if (location.pathname === "/onboarding" || location.pathname === "/fr/onboarding") {
      return;
    }

    // Check if user has completed onboarding
    let user: { onboardingCompletedAt: number | null } | null = null;
    try {
      user = await ctx.queryClient.ensureQueryData(
        convexQuery(api.auth.getCurrentUser, {})
      );
    } catch {
      // Silently ignore query errors — don't block navigation
    }

    if (user && !user.onboardingCompletedAt) {
      throw redirect({ to: "/onboarding" });
    }
  },
  component: AuthedLayout,
});

function AuthedLayout() {
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
