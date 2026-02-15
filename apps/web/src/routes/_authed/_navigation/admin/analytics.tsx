import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getAnalyticsDashboard } from "@/lib/analytics/analytics-server";
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";
import type {
  DateRange,
  FunctionTypeFilter,
} from "@/lib/analytics/analytics-types";

export const Route = createFileRoute("/_authed/_navigation/admin/analytics")({
  component: AdminAnalyticsPage,
});

function AdminAnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>(7);
  const [functionType, setFunctionType] =
    useState<FunctionTypeFilter>("all");

  const { data, isPending } = useQuery({
    queryKey: ["analytics", dateRange, functionType],
    queryFn: () => getAnalyticsDashboard({ data: { dateRange, functionType } }),
    refetchInterval: 60_000,
  });

  return (
    <AnalyticsDashboard
      data={data}
      isPending={isPending}
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
      functionType={functionType}
      onFunctionTypeChange={setFunctionType}
    />
  );
}
