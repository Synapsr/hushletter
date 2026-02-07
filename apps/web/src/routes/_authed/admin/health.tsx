import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@hushletter/backend";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from "@hushletter/ui";
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Database,
  Mail,
  HardDrive,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Admin Health Details Page
 * Story 7.1: Task 5.1 - Detailed health page
 *
 * Displays detailed health information for all system components:
 * - Convex database status
 * - Email worker status with last activity
 * - R2 storage status (placeholder - requires action)
 * - AI service status (placeholder - requires action)
 */
export const Route = createFileRoute("/_authed/admin/health")({
  component: AdminHealthPage,
});

/**
 * Health status card for a single service
 */
interface HealthCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  healthy: boolean | null; // null = unknown/loading
  message: string;
  details?: React.ReactNode;
}

function HealthCard({ title, description, icon, healthy, message, details }: HealthCardProps) {
  const StatusIcon = healthy === null ? AlertTriangle : healthy ? CheckCircle : XCircle;

  const statusColor =
    healthy === null ? "text-yellow-500" : healthy ? "text-green-500" : "text-red-500";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-muted-foreground" aria-hidden="true">
              {icon}
            </div>
            <div>
              <CardTitle className="text-lg">{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusIcon className={cn("h-5 w-5", statusColor)} aria-hidden="true" />
            <Badge
              variant={healthy === null ? "secondary" : healthy ? "default" : "destructive"}
              className={cn(healthy === true && "bg-green-600 hover:bg-green-700 text-white")}
            >
              {healthy === null ? "Unknown" : healthy ? "Healthy" : "Unhealthy"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{message}</p>
        {details && <div className="mt-4">{details}</div>}
      </CardContent>
    </Card>
  );
}

function AdminHealthPage() {
  // Fetch service status from Convex
  const { data: serviceStatus, isPending: statusLoading } = useQuery(
    convexQuery(api.admin.getServiceStatus, {}),
  );

  if (statusLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold mb-6">System Health</h2>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[140px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold mb-6">System Health</h2>

      {/* Convex Database Status */}
      <HealthCard
        title="Convex Database"
        description="Real-time database and backend"
        icon={<Database className="h-6 w-6" />}
        healthy={serviceStatus?.convex.healthy ?? null}
        message={serviceStatus?.convex.message ?? "Checking status..."}
        details={
          <div className="text-xs text-muted-foreground">
            <p>If this page loads, Convex is functioning correctly.</p>
          </div>
        }
      />

      {/* Email Worker Status */}
      <HealthCard
        title="Email Worker"
        description="Cloudflare Worker for newsletter reception"
        icon={<Mail className="h-6 w-6" />}
        healthy={serviceStatus?.emailWorker.healthy ?? null}
        message={serviceStatus?.emailWorker.message ?? "Checking status..."}
        details={
          serviceStatus?.emailWorker.lastActivity && (
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                Last email received:{" "}
                {new Date(serviceStatus.emailWorker.lastActivity).toLocaleString()}
              </p>
              <p className="text-yellow-600 dark:text-yellow-400">
                Note: Considered healthy if email received within 24 hours, or if no emails have
                been received yet (new system).
              </p>
            </div>
          )
        }
      />

      {/* R2 Storage Status (Placeholder) */}
      <HealthCard
        title="R2 Storage"
        description="Cloudflare R2 for newsletter content storage"
        icon={<HardDrive className="h-6 w-6" />}
        healthy={null}
        message="Status check not yet implemented"
        details={
          <div className="text-xs text-muted-foreground space-y-1">
            <p>R2 storage status requires an action (external API call) to check.</p>
            <p>Future enhancement: Display quota usage and remaining capacity.</p>
          </div>
        }
      />

      {/* AI Service Status (Placeholder) */}
      <HealthCard
        title="AI Summary Service"
        description="OpenRouter with Kimi K2 for newsletter summaries"
        icon={<Sparkles className="h-6 w-6" />}
        healthy={null}
        message="Status check not yet implemented"
        details={
          <div className="text-xs text-muted-foreground space-y-1">
            <p>AI service status requires an action (external API call) to verify availability.</p>
            <p>Future enhancement: Display API quota usage and model availability.</p>
          </div>
        }
      />

      {/* Health Check Legend */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <h3 className="font-medium mb-3">Health Status Legend</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>
                <strong>Healthy:</strong> Service is operating normally
              </span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <span>
                <strong>Unhealthy:</strong> Service has issues
              </span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span>
                <strong>Unknown:</strong> Status cannot be determined
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
