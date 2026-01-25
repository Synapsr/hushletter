/**
 * Switch Component - Base UI Implementation
 * Story 6.2: Privacy toggle switch for sender settings
 */

import { Switch as BaseSwitch } from "@base-ui-components/react/switch"

import { cn } from "~/lib/utils"

interface SwitchProps {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
  "aria-label"?: string
}

function Switch({
  className,
  checked,
  onCheckedChange,
  disabled,
  "aria-label": ariaLabel,
  ...props
}: SwitchProps) {
  return (
    <BaseSwitch.Root
      data-slot="switch"
      checked={checked}
      onCheckedChange={(checked) => onCheckedChange?.(checked)}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "peer relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors",
        "bg-input",
        "data-[checked]:bg-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <BaseSwitch.Thumb
        className={cn(
          "pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform",
          "data-[checked]:translate-x-4",
          "data-[unchecked]:translate-x-0"
        )}
      />
    </BaseSwitch.Root>
  )
}

export { Switch }
