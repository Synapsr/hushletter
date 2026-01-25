import { Badge } from "~/components/ui/badge"
import { CheckCircle, Clock, Download, AlertCircle } from "lucide-react"
import { cn } from "~/lib/utils"

/**
 * Valid delivery status values
 * Story 7.2: Task 4.4
 */
type DeliveryStatus = "received" | "processing" | "stored" | "failed"

/**
 * Props for the DeliveryStatusBadge component
 */
interface DeliveryStatusBadgeProps {
  /** The delivery status to display */
  status: DeliveryStatus
}

/** Configuration for each status type */
const statusConfig: Record<
  DeliveryStatus,
  {
    label: string
    variant: "default" | "secondary" | "destructive" | "outline"
    icon: typeof CheckCircle
    className?: string
  }
> = {
  received: {
    label: "Received",
    variant: "outline",
    icon: Download,
  },
  processing: {
    label: "Processing",
    variant: "secondary",
    icon: Clock,
    className: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-800",
  },
  stored: {
    label: "Stored",
    variant: "default",
    icon: CheckCircle,
    className: "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600",
  },
  failed: {
    label: "Failed",
    variant: "destructive",
    icon: AlertCircle,
  },
}

/**
 * DeliveryStatusBadge displays a colored badge with icon for delivery status
 * Story 7.2: Task 4.4 - Status indicator component
 *
 * @example
 * <DeliveryStatusBadge status="stored" />
 * <DeliveryStatusBadge status="failed" />
 */
export function DeliveryStatusBadge({ status }: DeliveryStatusBadgeProps) {
  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <Badge
      variant={config.variant}
      className={cn("flex items-center gap-1", config.className)}
      aria-label={`Status: ${config.label}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {config.label}
    </Badge>
  )
}
