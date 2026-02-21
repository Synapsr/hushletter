"use client";

import { GlobalSearch } from "../navigation/global-search";
import { UserMenu } from "../navigation/user-menu";

type Props = {
  enableSearchHotkey?: boolean;
};

export const SidebarFooter = ({ enableSearchHotkey = true }: Props) => {
  return (
    <div className="p-4 flex flex-col gap-2">
      <GlobalSearch enableHotkey={enableSearchHotkey} />
      <UserMenu />
    </div>
  );
};
