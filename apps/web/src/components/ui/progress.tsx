/**
 * Progress Component
 * Story 4.2: Task 4.3 - Progress indicator for Gmail scanning
 *
 * A simple progress bar component following shadcn/ui patterns.
 */

import { cn } from "~/lib/utils"

interface ProgressProps {
  /** Progress value from 0 to 100 */
  value?: number
  /** Additional CSS classes */
  className?: string
  /** Indeterminate mode - shows animated loading bar */
  indeterminate?: boolean
}

export function Progress({ value = 0, className, indeterminate }: ProgressProps) {
  // Clamp value between 0 and 100
  const clampedValue = Math.max(0, Math.min(100, value))

  return (
    <div
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800",
        className
      )}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : clampedValue}
    >
      <div
        className={cn(
          "h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300 ease-in-out",
          indeterminate && "animate-progress-indeterminate"
        )}
        style={indeterminate ? undefined : { width: `${clampedValue}%` }}
      />
    </div>
  )
}
