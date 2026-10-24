import { dayTarget } from "@keylow/core/engine";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { getMyTargets } from "../repos/targets";

import type { DiaryReadOptions } from "./DiaryReadOptions";
import type { Targets } from "../repos/targets";

export type UseTargetsOptions = DiaryReadOptions & {
  /**
   * The day to read `kcal` for, `YYYY-MM-DD`. The calories are then core's `dayTarget` for that day, so a
   * program with day by day figures gives that weekday's, and manual targets give the same figure every
   * day. Without it `kcal` is the week's figure, which is the same on every day while no offset is set.
   * The day is not part of the query key: one cached read serves every day.
   */
  localDate?: string;
};

/**
 * Loads the signed in user's calorie and macro targets: the current `targets` row while a program is
 * active (`source` `engine`), otherwise the manual targets on the profile (`source` `manual`), see
 * `getMyTargets`. Each is null when not set, so a null `kcal` is the diary's no-target state. They are
 * health data. Key `keys.profiles.targets`, which the mobile app persists for the offline diary.
 */
export function useTargets({ enabled = true, localDate }: UseTargetsOptions = {}) {
  const client = useSupabase();
  const selectDay = useCallback(
    (targets: Targets): Targets => {
      const { kcal } = targets;
      if (localDate === undefined || kcal === null) {
        return targets;
      }

      const week =
        targets.source === "engine"
          ? { caloriesKcal: kcal, dowCaloriesKcal: targets.dowCaloriesKcal }
          : { caloriesKcal: kcal };
      return { ...targets, kcal: dayTarget(week, localDate) };
    },
    [localDate],
  );

  return useQuery({
    queryKey: keys.profiles.targets,
    queryFn: () => getMyTargets(client),
    select: selectDay,
    enabled,
  });
}
