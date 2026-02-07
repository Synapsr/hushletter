import { Alert, AlertDescription, AlertTitle, Badge } from "@hushletter/ui";
import { CheckCircle, AlertTriangle, XCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

/**
 * Privacy violation from runPrivacyAudit query
 */
interface Violation {
  type: string;
  severity: "warning" | "critical";
  message: string;
  details: Record<string, unknown>;
}

/** Valid audit status values */
type AuditStatus = "PASS" | "WARNING" | "FAIL";

/**
 * Audit result from runPrivacyAudit query
 */
interface AuditResult {
  status: string; // Convex returns string, we validate below
  auditedAt: number;
  totalPrivateNewsletters: number;
  totalPublicNewsletters: number;
  violations: Violation[];
  checks: Array<{ name: string; passed: boolean }>;
}

/** Type guard to validate audit status */
function isValidAuditStatus(status: string): status is AuditStatus {
  return status === "PASS" || status === "WARNING" || status === "FAIL";
}

interface PrivacyAuditPanelProps {
  audit: AuditResult;
}

/**
 * Privacy Audit Panel
 * Story 7.3: Task 5.1 - Display audit results
 *
 * Shows compliance status badge (PASS=green, WARNING=yellow, FAIL=red)
 * with violations list if any exist.
 */
export function PrivacyAuditPanel({ audit }: PrivacyAuditPanelProps) {
  const statusConfig = {
    PASS: {
      variant: "default" as const,
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950/20",
      borderColor: "border-green-500",
      title: "Privacy Compliance: PASS",
    },
    WARNING: {
      variant: "default" as const,
      icon: AlertTriangle,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50 dark:bg-yellow-950/20",
      borderColor: "border-yellow-500",
      title: "Privacy Compliance: WARNING",
    },
    FAIL: {
      variant: "destructive" as const,
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-red-50 dark:bg-red-950/20",
      borderColor: "border-red-500",
      title: "Privacy Compliance: FAIL",
    },
  };

  // Validate and get status, defaulting to FAIL for unknown values
  const status: AuditStatus = isValidAuditStatus(audit.status) ? audit.status : "FAIL";
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Alert className={`${config.bgColor} ${config.borderColor}`}>
      <Icon className={`h-4 w-4 ${config.color}`} aria-hidden="true" />
      <AlertTitle className={config.color}>{config.title}</AlertTitle>
      <AlertDescription>
        <div className="flex items-center gap-4 mt-2">
          <Badge variant={config.variant}>{status}</Badge>
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" aria-hidden="true" />
            <span>Audited {formatDistanceToNow(audit.auditedAt, { addSuffix: true })}</span>
          </span>
        </div>

        {audit.violations.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="font-medium">Violations Found:</p>
            <ul className="list-disc list-inside space-y-1" role="list">
              {audit.violations.map((violation, index) => (
                <li
                  key={`${violation.type}-${violation.severity}-${index}`}
                  className={violation.severity === "critical" ? "text-red-600" : "text-yellow-600"}
                >
                  {violation.message}
                  <span className="sr-only"> - severity: {violation.severity}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {status === "PASS" && (
          <p className="mt-2 text-green-700 dark:text-green-300">
            All privacy checks passed. Private content is properly isolated from community database.
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
