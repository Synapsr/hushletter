/**
 * Tooltip Component - Base UI Implementation
 * Story 6.2: Tooltip for privacy lock icon
 */

import { Tooltip as BaseTooltip } from "@base-ui-components/react/tooltip";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface TooltipProps {
  children: ReactNode;
  content: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  className?: string;
}

function Tooltip({ children, content, side = "top", sideOffset = 8, className }: TooltipProps) {
  return (
    <BaseTooltip.Provider>
      <BaseTooltip.Root>
        <BaseTooltip.Trigger className="inline-flex">{children}</BaseTooltip.Trigger>
        <BaseTooltip.Portal>
          <BaseTooltip.Positioner side={side} sideOffset={sideOffset}>
            <BaseTooltip.Popup
              className={cn(
                "z-50 rounded-md bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md",
                "animate-in fade-in-0 zoom-in-95",
                "data-[ending-style]:animate-out data-[ending-style]:fade-out-0 data-[ending-style]:zoom-out-95",
                className,
              )}
            >
              {content}
            </BaseTooltip.Popup>
          </BaseTooltip.Positioner>
        </BaseTooltip.Portal>
      </BaseTooltip.Root>
    </BaseTooltip.Provider>
  );
}

export { Tooltip };
