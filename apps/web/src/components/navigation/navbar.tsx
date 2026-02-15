"use client";

import { Link } from "@tanstack/react-router";
import { SharedLogo } from "../shared/shared-logo";
import { GlobalSearch } from "./global-search";
import { UserMenu } from "./user-menu";

type Props = {};

export const Navbar = ({}: Props) => {
  return (
    <header className="border-b shrink-0 sticky top-0 z-50 bg-background">
      <div className="px-4 py-3 flex justify-between items-center">
        <Link to="/newsletters">
          <SharedLogo />
        </Link>

        <div className="flex items-center gap-2">
          <GlobalSearch />
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
  );
};
