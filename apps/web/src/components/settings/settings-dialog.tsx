"use client";

import { useState } from "react";
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  DialogPopup,
  DialogTrigger,
  Button,
  Separator,
} from "@hushletter/ui/components";
import {
  SettingsIcon,
  User,
  Lock,
  Bell,
  Palette,
  Trash2,
  CreditCard,
  FolderX,
} from "lucide-react";
import { SettingsProfile } from "./settings-profile";
import { SettingsPassword } from "./settings-password";
import { SettingsNotifications } from "./settings-notifications";
import { SettingsAppearance } from "./settings-appearance";
import { SettingsBilling } from "./settings-billing";
import { HiddenFoldersSection } from "../HiddenFoldersSection";

const tabs = [
  { id: "profile", label: "Edit profile", icon: User },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "password", label: "Password", icon: Lock },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "hidden-folders", label: "Hidden folders", icon: FolderX },
] as const;

type TabId = (typeof tabs)[number]["id"];

export const SettingsDialog = () => {
  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        className="hidden"
        data-settings-trigger="true"
        render={<Button variant="outline" size="icon" className="rounded-lg" />}
      >
        <SettingsIcon className="size-4" />
      </DialogTrigger>
      <DialogPopup
        className="max-w-[720px] "
        showCloseButton={true}
        bottomStickOnMobile={false}
      >
        <div className="flex min-h-[480px]">
          {/* Sidebar */}
          <nav className="flex w-[200px] shrink-0 flex-col border-r p-3">
            <DialogTitle className="px-3 pb-3 text-base font-semibold">
              Settings
            </DialogTitle>
            <div className="flex flex-1 flex-col gap-0.5">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? "bg-accent text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-4 shrink-0" />
                    {tab.label}
                  </button>
                );
              })}
            </div>
            <Separator className="my-2" />
            <button className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10">
              <Trash2 className="size-4 shrink-0" />
              Delete account
            </button>
          </nav>

          {/* Content */}
          <DialogPanel className="flex-1 p-6!" scrollFade={true}>
            {activeTab === "profile" && <SettingsProfile />}
            {activeTab === "billing" && <SettingsBilling />}
            {activeTab === "password" && <SettingsPassword />}
            {activeTab === "notifications" && <SettingsNotifications />}
            {activeTab === "appearance" && <SettingsAppearance />}
            {activeTab === "hidden-folders" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold">Hidden folders</h2>
                  <p className="text-sm text-muted-foreground">
                    Folders you've hidden from the sidebar. Unhide them to
                    restore visibility.
                  </p>
                </div>
                <Separator />
                <HiddenFoldersSection />
              </div>
            )}
          </DialogPanel>
        </div>
      </DialogPopup>
    </Dialog>
  );
};
