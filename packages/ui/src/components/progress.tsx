"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { cn } from "@hushletter/ui/lib/utils";

interface ProgressProps {
  value?: number;
  className?: string;
  indeterminate?: boolean;
}

function Progress({ value = 0, className, indeterminate }: ProgressProps) {
  const clampedValue = Math.max(0, Math.min(100, value));

  return (
    <ProgressPrimitive.Root
      value={indeterminate ? null : clampedValue}
      data-slot="progress"
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
        className,
      )}
    >
      <ProgressPrimitive.Track className="h-full w-full">
        <ProgressPrimitive.Indicator
          className={cn(
            "h-full bg-primary transition-all duration-300 ease-in-out",
            indeterminate && "animate-progress-indeterminate w-1/3",
          )}
        />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  );
}

export { Progress, type ProgressProps };
