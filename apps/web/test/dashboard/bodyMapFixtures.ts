import { RESTING_HEAT } from "@keylow/api-client";

import type { DashboardBodyMap } from "@keylow/api-client";

/**
 * The body map card as the approved board draws it on Thursday 15 October at 17:55: the golden week, with
 * Legs planned and 16 sets in the day. The warmest three and the heat steps are the board's.
 */
export const goldenThursdayBodyMap: DashboardBodyMap = {
  values: {
    ...RESTING_HEAT,
    chest_upper: 1,
    chest_lower: 1,
    delt_rear: 1,
    lats: 2,
    traps_mid: 1,
    biceps: 1,
    triceps: 1,
  },
  warmest: [
    { muscle: "lats", percent: 25 },
    { muscle: "traps_mid", percent: 18 },
    { muscle: "biceps", percent: 15 },
  ],
  today: { kind: "planned", dayName: "Legs", setCount: 16 },
};

/** A fresh install: every muscle at rest, nothing warm, and no routine to say what today is. */
export const noHistoryBodyMap: DashboardBodyMap = {
  values: RESTING_HEAT,
  warmest: [],
  today: { kind: "none", dayName: null },
};
