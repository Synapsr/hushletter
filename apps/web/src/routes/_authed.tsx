import {
  createFileRoute,
  Link,
  Outlet,
  redirect,
} from "@tanstack/react-router";
import type { RouterContext } from "@/router";
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
