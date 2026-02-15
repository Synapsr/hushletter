import { SharedLogo } from "@/components/shared/shared-logo";
import { useSession } from "@/lib/auth-client";
import { m } from "@/paraglide/messages.js";
import { Link } from "@tanstack/react-router";
import { LandingButton } from "./landing-button";

export function LandingHeader() {
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <SharedLogo />

        <nav className="hidden md:flex items-center gap-8">
          <a
            href="#features"
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            {m.landing_navFeatures()}
          </a>
          <a
            href="#integrations"
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            {m.landing_navIntegrations()}
          </a>
          <a
            href="#pricing"
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            {m.landing_navPricing()}
          </a>
          <a
            href="#blog"
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            {m.landing_navBlog()}
          </a>
        </nav>

        <div className="flex items-center gap-4">
          {isLoggedIn ? (
            <LandingButton size="sm" render={<Link to="/newsletters" />} className="group">
              {m.landing_navDashboard()}
              <span className="inline-block transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </LandingButton>
          ) : (
            <>
              <LandingButton variant="ghost" size="sm" render={<a href="#login" />}>
                {m.landing_navLogin()}
              </LandingButton>
              <LandingButton size="sm" render={<a href="#start" />} className="group">
                {m.landing_navStartFree()}
                <span className="inline-block transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </LandingButton>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
