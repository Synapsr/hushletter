import { AlertTriangle, XCircle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"

/**
 * Anomaly type from getDeliveryAnomalies query
 * Story 7.2: Task 6.3
 */
interface Anomaly {
  type: "high_failure_rate" | "no_deliveries" | "volume_spike"
  severity: "warning" | "critical"
  message: string
  details: Record<string, unknown>
}

/**
 * Props for the AnomalyAlertBanner component
 */
interface AnomalyAlertBannerProps {
  /** Array of anomalies to display */
  anomalies: Anomaly[]
}

/**
 * AnomalyAlertBanner displays alert banners for delivery anomalies
 * Story 7.2: Task 6.3 - Warning banner for dashboard
 *
 * Shows critical alerts in red/destructive style and warnings in yellow.
 * Critical anomalies are displayed first.
 *
 * @example
 * <AnomalyAlertBanner anomalies={[
 *   { type: "high_failure_rate", severity: "critical", message: "50% failure rate", details: {} }
 * ]} />
 */
export function AnomalyAlertBanner({ anomalies }: AnomalyAlertBannerProps) {
  const criticalAnomalies = anomalies.filter((a) => a.severity === "critical")
  const warningAnomalies = anomalies.filter((a) => a.severity === "warning")

  return (
    <div className="space-y-2" role="region" aria-label="System alerts">
      {criticalAnomalies.map((anomaly) => (
        <Alert key={`critical-${anomaly.type}-${anomaly.message}`} variant="destructive">
          <XCircle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Critical Alert</AlertTitle>
          <AlertDescription>{anomaly.message}</AlertDescription>
        </Alert>
      ))}

      {warningAnomalies.map((anomaly) => (
        <Alert
          key={`warning-${anomaly.type}-${anomaly.message}`}
          className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20"
        >
          <AlertTriangle className="h-4 w-4 text-yellow-600" aria-hidden="true" />
          <AlertTitle className="text-yellow-800 dark:text-yellow-200">
            Warning
          </AlertTitle>
          <AlertDescription className="text-yellow-700 dark:text-yellow-300">
            {anomaly.message}
          </AlertDescription>
        </Alert>
      ))}
    </div>
  )
}
