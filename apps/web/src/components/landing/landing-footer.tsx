import { m } from "@/paraglide/messages.js";
import { Link } from "@tanstack/react-router";
import { SharedLogo } from "../shared/shared-logo";

export function LandingFooter() {
  return (
    <footer className="py-12 bg-white border-t border-gray-100">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col items-center gap-6">
          <SharedLogo />

          <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
            <a
              href="#features"
              onClick={(e) => {
                e.preventDefault();
                document.querySelector("#features")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="hover:text-gray-900"
            >
              {m.landing_footerFeatures()}
            </a>
            <a
              href="#pricing"
              onClick={(e) => {
                e.preventDefault();
                document.querySelector("#pricing")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="hover:text-gray-900"
            >
              {m.landing_footerPricing()}
            </a>
            <Link to="/{-$locale}/privacy" className="hover:text-gray-900">
              Privacy
            </Link>
            <Link to="/{-$locale}/terms" className="hover:text-gray-900">
              Terms
            </Link>
          </nav>

          <p className="text-sm text-gray-400">{`© ${new Date().getFullYear()} Hushletter`}</p>
        </div>
      </div>
    </footer>
  );
}
