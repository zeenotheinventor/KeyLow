import { MUSCLE_GROUPS, MUSCLE_IDS, MUSCLES } from "@keylow/core/training";

import type { MuscleId, MuscleListGroup } from "@keylow/core/training";

/*
 * The muscle list of the golden Thursday at 19:00 (KEY-353) for the Actual view, as `useMuscleList` gives
 * it: [heat percent, heat step, ready in hours] of each muscle above rest. The other ten are at rest.
 * Twelve are above rest and ten at rest, as `web-body, actual-heat` draws.
 */
const ABOVE_REST: Partial<Record<MuscleId, [number, number, number]>> = {
  chest_upper: [5, 1, 0],
  chest_lower: [5, 1, 0],
  delt_rear: [9, 1, 0],
  lats: [24, 1, 0],
  traps_mid: [17, 1, 0],
  lower_back: [21, 1, 0],
  biceps: [14, 1, 0],
  triceps: [5, 1, 0],
  glute_max: [40, 3, 19],
  quads: [50, 3, 27],
  hamstrings: [55, 3, 31],
  calves: [20, 1, 0],
};

/** The 22 muscles in 7 groups, in the order of the muscle list. */
export const goldenMuscleList = (): MuscleListGroup[] =>
  MUSCLE_GROUPS.map((group) => ({
    group,
    rows: MUSCLE_IDS.filter((muscle) => MUSCLES[muscle].group === group).map((muscle) => {
      const [heatPercent, heatStep, readyInHours] = ABOVE_REST[muscle] ?? [0, 0, 0];
      return { muscle, heatPercent, heatStep, readyInHours };
    }),
  }));
