import { useDiaryDay, useProfileTimeZone, useTargets } from "@keylow/api-client";
import { toLocalDate } from "@keylow/core/dates";
import { plateDayBars } from "@keylow/core/plate";

import { usePlate } from "./usePlate";

import type { PlateDayBars } from "@keylow/core/plate";

import { useNow } from "@/lib/useNow";

/**
 * `loading` while the day, its targets or the time zone are being read, which the strip holds its place for.
 * `unavailable` when a read failed, or is waiting for a connection with nothing cached, which collapses the
 * strip so the search works without it and the skeleton is never endless.
 */
export type PlateDayBarsState =
  { status: "loading" } | { status: "unavailable" } | ({ status: "ready" } & PlateDayBars);

type Read = { data: unknown; isError: boolean; fetchStatus: string };

const isUnreadable = (read: Read) =>
  read.data === undefined && (read.isError || read.fetchStatus === "paused");

/**
 * The day's four bars with the plate's share after what was eaten, for the strip and the plate's totals card.
 * `date` is the day the dialog was opened for. Without one it is today in the profile's zone, which waits for
 * the zone to be read.
 */
export function usePlateDayBars(date: string | undefined): PlateDayBarsState {
  const { totals } = usePlate();
  const now = useNow();
  const profileTimeZone = useProfileTimeZone();
  const day =
    date ??
    (profileTimeZone.data === undefined
      ? undefined
      : toLocalDate(now, profileTimeZone.data ?? "UTC"));
  const eaten = useDiaryDay(day ?? "", { enabled: day !== undefined });
  const targets = useTargets({
    enabled: day !== undefined,
    ...(day === undefined ? {} : { localDate: day }),
  });

  if (isUnreadable(eaten) || isUnreadable(targets) || isUnreadable(profileTimeZone)) {
    return { status: "unavailable" };
  }
  if (
    day === undefined ||
    eaten.data === undefined ||
    targets.data === undefined ||
    profileTimeZone.data === undefined
  ) {
    return { status: "loading" };
  }

  return {
    status: "ready",
    ...plateDayBars({
      entries: eaten.data.entries,
      targets: targets.data,
      totals,
      day,
      timeZone: profileTimeZone.data,
      now,
    }),
  };
}
