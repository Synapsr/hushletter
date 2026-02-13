"use client";

import { useState } from "react";
import { Button, Separator, Switch, Label } from "@hushletter/ui/components";

type NotificationSettings = {
  newNewsletters: boolean;
  weeklyDigest: boolean;
  importComplete: boolean;
  productUpdates: boolean;
  tips: boolean;
};

export const SettingsNotifications = () => {
  const [settings, setSettings] = useState<NotificationSettings>({
    newNewsletters: true,
    weeklyDigest: true,
    importComplete: true,
    productUpdates: false,
    tips: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  const toggle = (key: keyof NotificationSettings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    // TODO: wire to backend
    await new Promise((r) => setTimeout(r, 500));
    setIsSaving(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Notifications</h2>
        <p className="text-sm text-muted-foreground">
          Choose what you want to be notified about.
        </p>
      </div>

      <Separator />

      {/* Email notifications */}
      <div className="space-y-1">
        <h3 className="text-sm font-medium">Email notifications</h3>
        <p className="text-xs text-muted-foreground">
          Manage the emails you receive from hushletter.
        </p>
      </div>

      <div className="space-y-4">
        <NotificationRow
          label="New newsletters"
          description="Get notified when new newsletters arrive in your inbox."
          checked={settings.newNewsletters}
          onToggle={() => toggle("newNewsletters")}
        />
        <NotificationRow
          label="Weekly digest"
          description="A weekly summary of your newsletter activity."
          checked={settings.weeklyDigest}
          onToggle={() => toggle("weeklyDigest")}
        />
        <NotificationRow
          label="Import complete"
          description="Get notified when an email import finishes processing."
          checked={settings.importComplete}
          onToggle={() => toggle("importComplete")}
        />
      </div>

      <Separator />

      <div className="space-y-1">
        <h3 className="text-sm font-medium">Marketing</h3>
        <p className="text-xs text-muted-foreground">
          Updates about hushletter features and tips.
        </p>
      </div>

      <div className="space-y-4">
        <NotificationRow
          label="Product updates"
          description="New features, improvements, and announcements."
          checked={settings.productUpdates}
          onToggle={() => toggle("productUpdates")}
        />
        <NotificationRow
          label="Tips & tutorials"
          description="Learn how to get the most out of hushletter."
          checked={settings.tips}
          onToggle={() => toggle("tips")}
        />
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save preferences"}
        </Button>
      </div>
    </div>
  );
};

function NotificationRow({
  label,
  description,
  checked,
  onToggle,
}: {
  label: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-0.5">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onToggle} />
    </div>
  );
}
