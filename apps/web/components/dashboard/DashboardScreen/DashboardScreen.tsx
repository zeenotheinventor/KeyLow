"use client";

import { useProfileTimeZone } from "@keylow/api-client";
import { DASHBOARD_LOAD_FAILED } from "@keylow/core/copy";

import { DashboardFrame } from "../DashboardFrame";
import { DashboardLoading } from "../DashboardLoading";
import { DashboardToday } from "../DashboardToday";

import { ErrorState } from "@/components/ui/ErrorState";
import { useIsOnline } from "@/lib/useIsOnline";

/**
 * The dashboard page: today's nutrition. The dashboard layout has already sent anyone who has not accepted
 * the current Terms to the accept page, so every read here is behind the terms gate. The profile's time
 * zone is read first, because it says which day today is.
 */
export function DashboardScreen() {
  const isOnline = useIsOnline();
  const timeZone = useProfileTimeZone();

  // A refetch that fails keeps the zone it already has: only a read that never produced one is a failure.
  if (timeZone.isError && timeZone.data === undefined) {
    return (
      <DashboardFrame>
        <ErrorState
          title={DASHBOARD_LOAD_FAILED.title}
          body={DASHBOARD_LOAD_FAILED.body}
          retryLabel={DASHBOARD_LOAD_FAILED.action}
          onRetry={() => {
            void timeZone.refetch();
          }}
          className="min-h-[440px] justify-center border-0 bg-transparent py-0 sm:min-h-[320px]"
        />
      </DashboardFrame>
    );
  }

  if (timeZone.data === undefined) {
    return (
      <DashboardFrame>
        <DashboardLoading isOnline={isOnline} />
      </DashboardFrame>
    );
  }

  // A signed in user always has a profile row, which the database creates. If it is missing the day is UTC.
  return <DashboardToday timeZone={timeZone.data ?? "UTC"} />;
}
