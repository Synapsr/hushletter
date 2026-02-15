import { createFileRoute } from "@tanstack/react-router";
import { convexQuery } from "@convex-dev/react-query";
import { useQuery } from "@tanstack/react-query";
import { api } from "@hushletter/backend";
import { useState } from "react";
import { PrivacyStatsCard } from "@/components/admin/PrivacyStatsCard";
import { PrivacyAuditPanel } from "@/components/admin/PrivacyAuditPanel";
import { PrivacySenderTable } from "@/components/admin/PrivacySenderTable";
import { NewsletterSearchPanel } from "@/components/admin/NewsletterSearchPanel";
import { Alert, AlertDescription, AlertTitle, Card, CardContent, CardHeader, CardTitle, Skeleton, Tabs, TabsContent, TabsList, TabsTrigger } from "@hushletter/ui";
import { AlertCircle } from "lucide-react";
import { m } from "@/paraglide/messages.js";

/**
 * Privacy Review Page - Admin dashboard for privacy compliance
 * Story 7.3: Task 4.1 - Privacy review page
 *
 * Displays:
 * 1. Privacy audit status banner (PASS/WARNING/FAIL)
 * 2. Privacy statistics (public/private counts)
 * 3. Private senders list with aggregate counts
 * 4. Newsletter investigation search
 */
export const Route = createFileRoute("/_authed/_navigation/admin/privacy")({
  component: PrivacyReview,
});

function PrivacyReview() {
  const [activeTab, setActiveTab] = useState("overview");

  const {
    data: stats,
    isPending: statsLoading,
    isError: statsError,
  } = useQuery(convexQuery(api.admin.getPrivacyStats, {}));

  const {
    data: audit,
    isPending: auditLoading,
    isError: auditError,
  } = useQuery(convexQuery(api.admin.runPrivacyAudit, {}));

  const {
    data: privateSenders,
    isPending: sendersLoading,
    isError: sendersError,
  } = useQuery(convexQuery(api.admin.listPrivateSenders, { limit: 20 }));

  // Show error alert if any query failed
  const hasError = statsError || auditError || sendersError;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{m.adminPrivacy_title()}</h2>
      </div>

      {/* Error Alert */}
      {hasError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>{m.common_error()}</AlertTitle>
          <AlertDescription>{m.adminPrivacy_errorOccurred()}</AlertDescription>
        </Alert>
      )}

      {/* Audit Status Banner */}
      <section aria-label="Privacy Audit Status">
        {auditLoading ? (
          <Skeleton className="h-[100px]" />
        ) : audit ? (
          <PrivacyAuditPanel audit={audit} />
        ) : null}
      </section>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">{m.adminPrivacy_overview()}</TabsTrigger>
          <TabsTrigger value="senders">{m.adminPrivacy_privateSenders()}</TabsTrigger>
          <TabsTrigger value="investigate">{m.adminPrivacy_investigate()}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Privacy Statistics */}
          <section aria-label="Privacy Statistics">
            {statsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={`stat-skeleton-${i}`} className="h-[100px]" />
                ))}
              </div>
            ) : stats ? (
              <PrivacyStatsCard stats={stats} />
            ) : null}
          </section>

          {/* Audit Details */}
          {!auditLoading && audit && (
            <Card>
              <CardHeader>
                <CardTitle>{m.adminPrivacy_auditChecks()}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2" role="list" aria-label="Audit check results">
                  {audit.checks.map((check) => (
                    <li key={check.name} className="flex items-center gap-2">
                      <span
                        className={check.passed ? "text-green-600" : "text-red-600"}
                        aria-hidden="true"
                      >
                        {check.passed ? "✓" : "✗"}
                      </span>
                      <span>
                        {check.name}
                        <span className="sr-only">{check.passed ? m.adminPrivacy_passed() : m.adminPrivacy_failedCheck()}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="senders">
          <section aria-label="Private Senders">
            {sendersLoading ? (
              <Skeleton className="h-[400px]" />
            ) : privateSenders ? (
              <PrivacySenderTable senders={privateSenders} />
            ) : null}
          </section>
        </TabsContent>

        <TabsContent value="investigate">
          <section aria-label="Newsletter Investigation">
            <NewsletterSearchPanel />
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
