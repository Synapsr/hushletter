/**
 * Checkbox Component - Base UI Implementation
 * Story 4.3 Code Review Fix: Updated from Radix to Base UI per architecture requirements
 */

import { Checkbox as BaseCheckbox } from "@base-ui-components/react/checkbox"
import { CheckIcon } from "lucide-react"

import { cn } from "~/lib/utils"

interface CheckboxProps {
  checked?: boolean
  indeterminate?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
  "aria-label"?: string
}

function Checkbox({
  className,
  checked,
  indeterminate,
  onCheckedChange,
  disabled,
  "aria-label": ariaLabel,
  ...props
}: CheckboxProps) {
  return (
    <BaseCheckbox.Root
      data-slot="checkbox"
      checked={indeterminate ? "indeterminate" : checked}
      onCheckedChange={(checked) => onCheckedChange?.(checked === true)}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        "peer inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border shadow-xs transition-all outline-none",
        "border-input bg-background",
        "data-[checked]:bg-primary data-[checked]:text-primary-foreground data-[checked]:border-primary",
        "data-[indeterminate]:bg-primary/70 data-[indeterminate]:text-primary-foreground data-[indeterminate]:border-primary/70",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "hover:border-primary/50",
        className
      )}
      {...props}
    >
      <BaseCheckbox.Indicator className="flex items-center justify-center text-current">
        {indeterminate ? (
          <div className="size-2 bg-current rounded-sm" />
        ) : (
          <CheckIcon className="size-3" strokeWidth={3} />
        )}
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  )
}

export { Checkbox }
