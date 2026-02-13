"use client";

import { useState } from "react";
import { useSession } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Input,
  Label,
  Separator,
} from "@hushletter/ui/components";
import { Camera, Check, Copy } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export const SettingsProfile = () => {
  const { data: session } = useSession();
  const user = session?.user;

  const { data: userData } = useQuery(
    convexQuery(api.auth.getCurrentUser, {}),
  );
  const dedicatedEmail = (userData as { dedicatedEmail?: string } | null)
    ?.dedicatedEmail ?? null;

  const [name, setName] = useState(user?.name ?? "");
  const [image, setImage] = useState(user?.image ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyEmail = async () => {
    if (!dedicatedEmail) return;
    await navigator.clipboard.writeText(dedicatedEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const initials = (user?.name ?? "U")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await authClient.updateUser({
        name,
        image: image || undefined,
      });
    } catch {
      // Handle error silently for now
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Edit profile</h2>
        <p className="text-sm text-muted-foreground">
          Update your personal information and profile picture.
        </p>
      </div>

      <Separator />

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar className="size-16">
            <AvatarImage src={user?.image ?? undefined} alt={user?.name ?? "User"} />
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          <button className="absolute -bottom-1 -right-1 flex size-6 items-center justify-center rounded-full border bg-background shadow-sm transition-colors hover:bg-accent">
            <Camera className="size-3 text-muted-foreground" />
          </button>
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium">{user?.name ?? "Your name"}</p>
          <p className="text-xs text-muted-foreground">{user?.email ?? "your@email.com"}</p>
        </div>
      </div>

      <Separator />

      {/* Form */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="settings-name">Name</Label>
          <Input
            id="settings-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="settings-email">Email</Label>
          <Input
            id="settings-email"
            type="email"
            value={user?.email ?? ""}
            disabled
            placeholder="your@email.com"
          />
          <p className="text-xs text-muted-foreground">
            Contact support to change your email address.
          </p>
        </div>

        {dedicatedEmail && (
          <div className="space-y-2">
            <Label>Newsletter email</Label>
            <div className="flex items-center gap-2">
              <Input
                value={dedicatedEmail}
                disabled
                className="font-mono text-xs!"
              />
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={handleCopyEmail}
              >
                {copied ? (
                  <Check className="size-4 text-emerald-500" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Share this address with newsletters to receive them in hushletter.
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="settings-avatar-url">Avatar URL</Label>
          <Input
            id="settings-avatar-url"
            value={image}
            onChange={(e) => setImage(e.target.value)}
            placeholder="https://example.com/avatar.jpg"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </div>
  );
};
