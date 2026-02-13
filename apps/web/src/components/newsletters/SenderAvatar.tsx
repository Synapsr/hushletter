import { Avatar, AvatarFallback } from "@hushletter/ui";
import { cn } from "@/lib/utils";

/**
 * Generate a deterministic hue from a string (0-360).
 */
function stringToHue(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

const sizeClasses = {
  sm: "size-7 text-xs",
  md: "size-9 text-sm",
  lg: "size-11 text-base",
} as const;

interface SenderAvatarProps {
  senderName?: string;
  senderEmail: string;
  size?: keyof typeof sizeClasses;
  className?: string;
}

/**
 * Colored circle with sender initials derived from name or email.
 */
export function SenderAvatar({
  senderName,
  senderEmail,
  size = "md",
  className,
}: SenderAvatarProps) {
  const display = senderName || senderEmail;
  const initials = display
    .split(/[\s@]+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  const hue = stringToHue(senderEmail);

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      <AvatarFallback
        className="flex items-center justify-center text-white font-semibold"
        style={{ backgroundColor: `oklch(0.65 0.15 ${hue})` }}
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
