import { Badge, Tooltip, TooltipTrigger, TooltipContent } from "@hushletter/ui";
import { CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Service status data structure
 */
interface ServiceStatus {
  /** Whether the service is healthy */
  healthy: boolean;
  /** Status message to show in tooltip */
  message: string;
  /** Optional timestamp of last activity */
  lastActivity?: number | null;
}

/**
 * Props for the ServiceStatusBadge component
 * Story 7.1: Task 3.3 - Health status indicator
 */
interface ServiceStatusBadgeProps {
  /** Display name of the service */
  service: string;
  /** Status data for the service */
  status: ServiceStatus;
}

/**
 * ServiceStatusBadge displays service health with visual indicators
 * Story 7.1: Task 3.3
 *
 * Shows a badge with:
 * - Green checkmark for healthy services
 * - Red X for unhealthy services
 * - Tooltip with status message on hover
 *
 * @example
 * <ServiceStatusBadge
 *   service="Convex Database"
 *   status={{ healthy: true, message: "Connected" }}
 * />
 */
export function ServiceStatusBadge({ service, status }: ServiceStatusBadgeProps) {
  const Icon = status.healthy ? CheckCircle : XCircle;

  return (
    <Tooltip>
      <TooltipTrigger className="inline-flex">
        <Badge
          variant={status.healthy ? "default" : "destructive"}
          className={cn(
            "flex items-center gap-1.5 cursor-default",
            status.healthy && "bg-green-600 hover:bg-green-700 text-white",
          )}
          role="status"
          aria-label={`${service}: ${status.healthy ? "Healthy" : "Unhealthy"}`}
        >
          <Icon className="h-3 w-3" aria-hidden="true" />
          {service}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{status.message}</TooltipContent>
    </Tooltip>
  );
}
