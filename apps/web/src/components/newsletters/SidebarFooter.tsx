"use client";

import { GlobalSearch } from "../navigation/global-search";
import { UserMenu } from "../navigation/user-menu";
import { SettingsDialog } from "../settings/settings-dialog";

type Props = {};

export const SidebarFooter = ({}: Props) => {
  return (
    <div className="p-4 flex flex-col gap-4">
      <GlobalSearch />
      <UserMenu />
    </div>
  );
};
