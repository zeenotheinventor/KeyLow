import { useProfileTimeZone } from "@keylow/api-client";
import { DASHBOARD_LOAD_FAILED } from "@keylow/core/copy";

import { useIsOnline } from "../../lib/connectivity";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { ErrorState } from "../ui";
import { DashboardFrame } from "./DashboardFrame";
import { DashboardLoading } from "./DashboardLoading";
import { DashboardToday } from "./DashboardToday";

/**
 * The dashboard tab: today's nutrition. It stays mounted under the terms gate's cover, so every read waits
 * until the signed in account has accepted the current Terms (the acceptance is the gate's own query,
 * shared through the cache, and a read that is not known yet counts as not accepted). The profile's time
 * zone is read first, because it says which day today is.
 */
export function DashboardScreen() {
  const isReadEnabled = useReadsEnabled();
  const isOnline = useIsOnline();
  const timeZone = useProfileTimeZone({ enabled: isReadEnabled });

  if (timeZone.isError) {
    return (
      <DashboardFrame>
        <ErrorState
          body={DASHBOARD_LOAD_FAILED.body}
          retry={{
            label: DASHBOARD_LOAD_FAILED.action,
            onPress: () => {
              void timeZone.refetch();
            },
          }}
          title={DASHBOARD_LOAD_FAILED.title}
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
  return <DashboardToday isReadEnabled={isReadEnabled} timeZone={timeZone.data ?? "UTC"} />;
}
