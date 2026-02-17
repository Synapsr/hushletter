import { useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@hushletter/ui";
import { cn } from "@/lib/utils";

function getIdentityFromInput(input: string): {
  email: string | undefined;
  domain: string | undefined;
} {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return { email: undefined, domain: undefined };

  const match = trimmed.match(/([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i);
  const email = match?.[1] ?? trimmed;
  const atIndex = email.lastIndexOf("@");

  if (atIndex <= 0 || atIndex >= email.length - 1) {
    return { email: undefined, domain: undefined };
  }

  const domain = email.slice(atIndex + 1);
  if (!domain.includes(".")) return { email: undefined, domain: undefined };

  return { email, domain };
}

function getImageCandidates({
  senderEmail,
  senderImageUrl,
}: Pick<SenderAvatarProps, "senderEmail" | "senderImageUrl">): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();
  const add = (value?: string) => {
    const src = value?.trim();
    if (!src || seen.has(src)) return;
    seen.add(src);
    candidates.push(src);
  };

  const { email, domain } = getIdentityFromInput(senderEmail);

  add(senderImageUrl);
  if (email) {
    // Service that can resolve some real sender avatars from email identity.
    add(`https://unavatar.io/${encodeURIComponent(email)}?fallback=false`);
  }
  if (domain) {
    // Domain logo fallback. We intentionally avoid additional providers to
    // reduce generic placeholder icons in the UI.
    add(`https://logo.clearbit.com/${encodeURIComponent(domain)}`);
    //add(`https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`);
  }

  return candidates;
}

const sizeClasses = {
  sm: "size-7 text-xs",
  md: "size-9 text-sm",
  lg: "size-11 text-base",
} as const;

interface SenderAvatarProps {
  senderName?: string;
  senderEmail: string;
  senderImageUrl?: string;
  size?: keyof typeof sizeClasses;
  className?: string;
}

interface SenderAvatarGroupItem {
  senderName?: string;
  senderEmail: string;
  senderImageUrl?: string;
}

interface SenderAvatarGroupProps {
  senders: SenderAvatarGroupItem[];
  size?: keyof typeof sizeClasses;
  className?: string;
}

/**
 * Sender avatar with image-first rendering and initials fallback.
 */
export function SenderAvatar({
  senderName,
  senderEmail,
  senderImageUrl,
  size = "md",
  className,
}: SenderAvatarProps) {
  const display = senderName || senderEmail;
  const initials = display
    .split(/[\s@]+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const fallbackLetter = initials[0] || "?";

  const imageCandidates = useMemo(
    () => getImageCandidates({ senderEmail, senderImageUrl }),
    [senderEmail, senderImageUrl],
  );
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    setImageIndex(0);
  }, [senderEmail, senderImageUrl]);

  const imageUrl = imageCandidates[imageIndex];

  return (
    <Avatar className={cn(sizeClasses[size], "size-8", className)}>
      {imageUrl && (
        <AvatarImage
          src={imageUrl}
          alt={display}
          onError={() => {
            setImageIndex((prev) => {
              const next = Math.min(prev + 1, imageCandidates.length);

              return next;
            });
          }}
        />
      )}
      <AvatarFallback className="flex items-center text-sm justify-center font-semibold bg-background">
        {fallbackLetter}
      </AvatarFallback>
    </Avatar>
  );
}

/**
 * Small overlapping group of sender avatars (max 3).
 */
export function SenderAvatarGroup({
  senders,
  size = "lg",
  className,
}: SenderAvatarGroupProps) {
  const visibleSenders = senders
    .filter((sender) => Boolean(sender.senderEmail))
    .slice(0, 3);

  if (visibleSenders.length === 0) return null;

  const avatarSizeClass =
    size === "sm" ? "size-6" : size === "md" ? "size-7" : "size-8";

  return (
    <div className={cn("flex items-center -space-x-3.5", className)}>
      {visibleSenders.map((sender, index) => (
        <SenderAvatar
          key={`${sender.senderEmail}-${index}`}
          senderName={sender.senderName}
          senderEmail={sender.senderEmail}
          senderImageUrl={sender.senderImageUrl}
          size={size}
          className={cn(
            avatarSizeClass,
            "ring ring-background bg-background",
            index === 0 ? "z-30" : index === 1 ? "z-20" : "z-10",
          )}
        />
      ))}
    </div>
  );
}
