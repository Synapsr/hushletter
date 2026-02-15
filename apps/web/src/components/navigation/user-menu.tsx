"use client";

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import { signOut, useSession } from "@/lib/auth-client";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuShortcut,
  MenuTrigger,
} from "@hushletter/ui/components";
import {
  Check,
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  Copy,
  Download,
  ExternalLink,
  LogOut,
  Settings,
  Shield,
} from "lucide-react";
import { importDialogHandle } from "../import";

export const UserMenu = () => {
  const { data: session } = useSession();
  const { data: currentUser } = useQuery(
    convexQuery(api.auth.getCurrentUser, {}),
  );
  const { data: adminCheck } = useQuery(
    convexQuery(api.admin.checkIsAdmin, {}),
  );
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const isAdmin = adminCheck?.isAdmin ?? false;
  const userEmail = session?.user?.email ?? "";
  const userName = session?.user?.name ?? userEmail;
  const userImage = session?.user?.image;
  const dedicatedEmail = currentUser?.dedicatedEmail;

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleCopyDedicatedEmail = async () => {
    if (!dedicatedEmail) return;
    try {
      await navigator.clipboard.writeText(dedicatedEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Silently fail — clipboard may not be available
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch {
      // Even if signOut fails, redirect to home
    }
    window.location.href = "/";
  };

  return (
    <Menu>
      <MenuTrigger className="rounded-lg py-2 justify-between flex items-center cursor-pointer hover:bg-accent/50 px-2">
        <div className="flex items-center gap-2">
          <Avatar className="size-8">
            {userImage && <AvatarImage src={userImage} alt={userName} />}
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col text-left">
            <p className="text-sm font-medium leading-none">{userName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{userEmail}</p>
          </div>
        </div>
        <ChevronsUpDownIcon className="h-4 w-4 text-muted-foreground" />
      </MenuTrigger>
      <MenuPopup align="end" sideOffset={4}>
        {/* Account info section */}
        <MenuGroup>
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium leading-none">{userName}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{userEmail}</p>
          </div>
        </MenuGroup>

        {/* Dedicated email section */}
        {dedicatedEmail && (
          <>
            <MenuSeparator />
            <MenuGroup>
              <MenuGroupLabel>Hushletter email</MenuGroupLabel>
              <MenuItem onClick={handleCopyDedicatedEmail}>
                {copied ? (
                  <Check className="mr-2 h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                <span className="truncate font-mono text-xs">
                  {dedicatedEmail}
                </span>
              </MenuItem>
            </MenuGroup>
          </>
        )}

        <MenuSeparator />

        {/* Actions */}
        <MenuItem onClick={() => importDialogHandle.open(null)}>
          <Download className="mr-2 h-4 w-4" />
          Import newsletters
          <MenuShortcut>⌘I</MenuShortcut>
        </MenuItem>

        <MenuItem
          onClick={() => {
            document
              .querySelector<HTMLButtonElement>(
                '[data-settings-trigger="true"]',
              )
              ?.click();
          }}
        >
          <Settings className="mr-2 h-4 w-4" />
          Settings
          <MenuShortcut>⌘,</MenuShortcut>
        </MenuItem>

        {isAdmin && (
          <>
            <MenuSeparator />
            <MenuItem onClick={() => window.open("/admin", "_blank")}>
              <Shield className="mr-2 h-4 w-4" />
              Admin dashboard
              <ExternalLink className="ml-auto h-3 w-3 text-muted-foreground" />
            </MenuItem>
          </>
        )}

        <MenuSeparator />

        <MenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
};
