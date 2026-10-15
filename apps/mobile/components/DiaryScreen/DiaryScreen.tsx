import { useProfileTimeZone, useTermsAcceptance } from "@keylow/api-client";
import { DIARY_LOAD_FAILED, DIARY_MORE_LABEL, TERMS_VERSION } from "@keylow/core/copy";
import { needsTermsAcceptance } from "@keylow/core/terms";
import { useEffect } from "react";

import { DiaryDay } from "./DiaryDay";
import { DiaryFrame } from "./DiaryFrame";
import { setViewedDay } from "../../lib/viewedDay";
import { ErrorState, Skeleton } from "../ui";

/**
 * The diary tab: the hour-by-hour food log for a day. It stays mounted under the terms gate's cover, so
 * every read waits until the signed in account has accepted the current Terms (the acceptance is the
 * gate's own query, shared through the cache, and a read that is not known yet counts as not accepted).
 * The profile's time zone is read first, because every day and hour of the diary is read in it.
 */
export function DiaryScreen() {
  const acceptance = useTermsAcceptance();
  const isReadEnabled = !needsTermsAcceptance(acceptance.data ?? null, TERMS_VERSION);
  const timeZone = useProfileTimeZone({ enabled: isReadEnabled });

  // The tab bar's plus reads the day on view, so it is cleared when the diary goes.
  useEffect(
    () => () => {
      setViewedDay(null);
    },
    [],
  );

  if (timeZone.isError) {
    return (
      <DiaryFrame moreLabel={DIARY_MORE_LABEL}>
        <ErrorState
          body={DIARY_LOAD_FAILED.body}
          retry={{
            label: DIARY_LOAD_FAILED.action,
            onPress: () => {
              void timeZone.refetch();
            },
          }}
          title={DIARY_LOAD_FAILED.title}
        />
      </DiaryFrame>
    );
  }

  if (timeZone.data === undefined) {
    return (
      <DiaryFrame moreLabel={DIARY_MORE_LABEL}>
        <Skeleton variant="diary" />
      </DiaryFrame>
    );
  }

  // A signed in user always has a profile row, which the database creates. If it is missing the day is UTC.
  return <DiaryDay isReadEnabled={isReadEnabled} timeZone={timeZone.data ?? "UTC"} />;
}
