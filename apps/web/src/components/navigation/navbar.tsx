"use client";

import { Link } from "@tanstack/react-router";
import { SharedLogo } from "../shared/shared-logo";
import { UserMenu } from "./user-menu";

type Props = {};

export const Navbar = ({}: Props) => {
  return (
    <header className="border-b shrink-0 sticky top-0 z-50 bg-background">
      <div className="px-2 py-1.5 flex justify-between items-center container mx-auto">
        <Link to="/newsletters">
          <SharedLogo />
        </Link>

        <div className="flex items-center gap-2">
          <UserMenu />
        </div>
      </div>
    </header>
  );
};
