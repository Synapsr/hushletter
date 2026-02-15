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
import { m } from "@/paraglide/messages.js";

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
export const Route = createFileRoute("/_authed/_navigation/admin/health")({
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
              {healthy === null ? m.adminHealth_unknown() : healthy ? m.adminHealth_healthy() : m.adminHealth_unhealthy()}
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
        <h2 className="text-2xl font-bold mb-6">{m.adminHealth_title()}</h2>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[140px]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold mb-6">{m.adminHealth_title()}</h2>

      {/* Convex Database Status */}
      <HealthCard
        title={m.adminHealth_convex()}
        description={m.adminHealth_convexDesc()}
        icon={<Database className="h-6 w-6" />}
        healthy={serviceStatus?.convex.healthy ?? null}
        message={serviceStatus?.convex.message ?? m.adminHealth_checkingStatus()}
        details={
          <div className="text-xs text-muted-foreground">
            <p>{m.adminHealth_convexOk()}</p>
          </div>
        }
      />

      {/* Email Worker Status */}
      <HealthCard
        title={m.adminHealth_emailWorker()}
        description={m.adminHealth_emailWorkerDesc()}
        icon={<Mail className="h-6 w-6" />}
        healthy={serviceStatus?.emailWorker.healthy ?? null}
        message={serviceStatus?.emailWorker.message ?? m.adminHealth_checkingStatus()}
        details={
          serviceStatus?.emailWorker.lastActivity && (
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                {m.adminHealth_lastEmailReceived({ date: new Date(serviceStatus.emailWorker.lastActivity).toLocaleString() })}
              </p>
              <p className="text-yellow-600 dark:text-yellow-400">
                {m.adminHealth_emailWorkerNote()}
              </p>
            </div>
          )
        }
      />

      {/* R2 Storage Status (Placeholder) */}
      <HealthCard
        title={m.adminHealth_r2Storage()}
        description={m.adminHealth_r2Desc()}
        icon={<HardDrive className="h-6 w-6" />}
        healthy={null}
        message={m.adminHealth_r2StatusNote()}
        details={
          <div className="text-xs text-muted-foreground space-y-1">
            <p>{m.adminHealth_r2Info()}</p>
            <p>{m.adminHealth_r2Future()}</p>
          </div>
        }
      />

      {/* AI Service Status (Placeholder) */}
      <HealthCard
        title={m.adminHealth_aiService()}
        description={m.adminHealth_aiDesc()}
        icon={<Sparkles className="h-6 w-6" />}
        healthy={null}
        message={m.adminHealth_r2StatusNote()}
        details={
          <div className="text-xs text-muted-foreground space-y-1">
            <p>{m.adminHealth_aiInfo()}</p>
            <p>{m.adminHealth_aiFuture()}</p>
          </div>
        }
      />

      {/* Health Check Legend */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <h3 className="font-medium mb-3">{m.adminHealth_legendTitle()}</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>
                <strong>{m.adminHealth_healthy()}:</strong> {m.adminHealth_healthyDesc()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <span>
                <strong>{m.adminHealth_unhealthy()}:</strong> {m.adminHealth_unhealthyDesc()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span>
                <strong>{m.adminHealth_unknown()}:</strong> {m.adminHealth_unknownDesc()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
