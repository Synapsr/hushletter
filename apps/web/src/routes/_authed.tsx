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
    if (
      location.pathname === "/onboarding" ||
      location.pathname === "/fr/onboarding"
    ) {
      return;
    }

    // Check if user has completed onboarding
    let user: { onboardingCompletedAt: number | null } | null = null;
    try {
      user = await ctx.queryClient.ensureQueryData(
        convexQuery(api.auth.getCurrentUser, {}),
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
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
