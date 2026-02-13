"use client";

import { useState } from "react";
import { Button, Input, Label, Separator } from "@hushletter/ui/components";
import { authClient } from "@/lib/auth-client";

export const SettingsPassword = () => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChangePassword = async () => {
    setError(null);
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setIsSaving(true);
    try {
      await authClient.changePassword({
        currentPassword,
        newPassword,
      });
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Failed to change password. Please check your current password.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Password</h2>
        <p className="text-sm text-muted-foreground">
          Change your password to keep your account secure.
        </p>
      </div>

      <Separator />

      <div className="max-w-sm space-y-4">
        <div className="space-y-2">
          <Label htmlFor="current-password">Current password</Label>
          <Input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter current password"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password"
          />
          <p className="text-xs text-muted-foreground">Minimum 8 characters.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
          />
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        {success && (
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            Password changed successfully.
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleChangePassword}
          disabled={isSaving || !currentPassword || !newPassword || !confirmPassword}
        >
          {isSaving ? "Changing..." : "Change password"}
        </Button>
      </div>
    </div>
  );
};
