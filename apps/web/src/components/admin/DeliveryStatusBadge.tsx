import { Badge } from "@hushletter/ui";
import { CheckCircle, Clock, Download, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";

/**
 * Valid delivery status values
 * Story 7.2: Task 4.4
 */
type DeliveryStatus = "received" | "processing" | "stored" | "failed";

/**
 * Props for the DeliveryStatusBadge component
 */
interface DeliveryStatusBadgeProps {
  /** The delivery status to display */
  status: DeliveryStatus;
}

/** Configuration for each status type */
const getStatusConfig = (): Record<
  DeliveryStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: typeof CheckCircle;
    className?: string;
  }
> => ({
  received: {
    label: m.deliveryStatus_received(),
    variant: "outline",
    icon: Download,
  },
  processing: {
    label: m.deliveryStatus_processing(),
    variant: "secondary",
    icon: Clock,
    className:
      "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-200 dark:border-yellow-800",
  },
  stored: {
    label: m.deliveryStatus_stored(),
    variant: "default",
    icon: CheckCircle,
    className: "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600",
  },
  failed: {
    label: m.deliveryStatus_failed(),
    variant: "destructive",
    icon: AlertCircle,
  },
});

/**
 * DeliveryStatusBadge displays a colored badge with icon for delivery status
 * Story 7.2: Task 4.4 - Status indicator component
 *
 * @example
 * <DeliveryStatusBadge status="stored" />
 * <DeliveryStatusBadge status="failed" />
 */
export function DeliveryStatusBadge({ status }: DeliveryStatusBadgeProps) {
  const statusConfig = getStatusConfig();
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={cn("flex items-center gap-1", config.className)}
      aria-label={m.deliveryStatus_ariaLabel({ status: config.label })}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {config.label}
    </Badge>
  );
}
