import type { LucideIcon } from "lucide-react";

interface SidebarEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  iconClassName?: string;
}

/**
 * Visual empty state for sidebar sections (archive, bin, starred, etc.).
 * Consistent icon + title + description layout.
 */
export function SidebarEmptyState({
  icon: Icon,
  title,
  description,
  iconClassName = "text-muted-foreground/50",
}: SidebarEmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center py-10 px-4">
      <div className="mb-3 flex items-center justify-center size-10 rounded-xl bg-muted/60">
        <Icon className={`size-5 ${iconClassName}`} />
      </div>
      <p className="text-sm font-medium text-foreground/80">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1 max-w-[200px] leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
}
