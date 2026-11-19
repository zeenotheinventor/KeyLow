import { useProfileTimeZone } from "@keylow/api-client";
import { resolveBadgeDetail } from "@keylow/core";
import { useMemo } from "react";

import { useAchievementsState } from "./useAchievementsState";

import type { BadgeDetailRead } from "@keylow/core";

const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * What the detail sheet of one badge shows, from the same read as the screen under it. Core decides what can
 * be shown yet (`resolveBadgeDetail`), so an id the catalogue does not know or a failed read is `unavailable`
 * and the sheet closes instead of showing nothing. The day it was earned is in the person's time zone, or the
 * phone's until that is read.
 */
export function useBadgeDetail(id: string | undefined, enabled: boolean): BadgeDetailRead {
  const state = useAchievementsState({ enabled });
  const timeZone = useProfileTimeZone({ enabled });
  const { data } = state;
  const profileTimeZone = timeZone.data;
  const isFailed = state.isError;

  return useMemo(
    () =>
      resolveBadgeDetail({
        id,
        results: data?.run.perAchievementProgress,
        held: data?.held,
        isFailed,
        timeZone: profileTimeZone,
        deviceTimeZone: deviceTimeZone(),
      }),
    [id, data, isFailed, profileTimeZone],
  );
}
