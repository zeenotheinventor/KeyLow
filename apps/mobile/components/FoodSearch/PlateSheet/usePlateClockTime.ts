import { useProfileTimeZone } from "@keylow/api-client";
import { formatClockTime } from "@keylow/core/dates";

import { usePlate } from "../../../lib/plate";
import { useNow } from "../../../lib/useNow";
import { useReadsEnabled } from "../../../lib/useReadsEnabled";

/**
 * The time the Time row reads: the plate's own clock time, or while it is still Now the current minute, in
 * the profile's zone, moving with the clock. A profile with no zone is read in UTC, as logging does, and
 * until the zone is known the device's own is used, because logging waits for it.
 */
export function usePlateClockTime(): { time: string; isNow: boolean } {
  const { time } = usePlate();
  const now = useNow();
  const profileTimeZone = useProfileTimeZone({ enabled: useReadsEnabled() });

  if (!time.isNow) {
    return { time: time.time, isNow: false };
  }
  const zone =
    profileTimeZone.data === undefined
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : (profileTimeZone.data ?? "UTC");

  return { time: formatClockTime(now, zone), isNow: true };
}
