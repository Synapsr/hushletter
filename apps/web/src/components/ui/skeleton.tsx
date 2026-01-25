import { cn } from "~/lib/utils"

/**
 * Skeleton component for loading states
 * Story 7.1: Task 3.6 - Loading skeletons
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
