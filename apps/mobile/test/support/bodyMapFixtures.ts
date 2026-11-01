import { RESTING_HEAT } from "../../components/DashboardScreen/DashboardBodyMapCard";

import type { DashboardHeatBodyMap, DashboardVolumeBodyMap } from "@keylow/api-client";

/**
 * The body map card as the approved board draws it on Thursday 15 October at 17:55: the golden week, with
 * Legs planned and 16 sets in the day. The warmest three and the heat steps are the board's.
 */
export const goldenThursdayBodyMap: DashboardHeatBodyMap = {
  scale: "heat",
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
export const noHistoryBodyMap: DashboardHeatBodyMap = {
  scale: "heat",
  values: RESTING_HEAT,
  warmest: [],
  today: { kind: "none", dayName: null },
};

/**
 * The same Thursday under the Weekly volume chart: the actual sets of the calendar week so far, with lats
 * the most trained. The values are indexes in `VOLUME_STATUSES`, so lats and side delts are Productive.
 */
export const goldenThursdayVolumeBodyMap: DashboardVolumeBodyMap = {
  scale: "volume",
  values: {
    ...RESTING_HEAT,
    lats: 3,
    delt_side: 3,
    quads: 2,
    biceps: 1,
  },
  mostTrained: [
    { muscle: "lats", weeklySets: 8 },
    { muscle: "delt_side", weeklySets: 6.5 },
    { muscle: "quads", weeklySets: 6 },
  ],
  today: { kind: "planned", dayName: "Legs", setCount: 16 },
};

/** The Weekly volume chart on a Monday morning, before a set is logged this week. */
export const noSetsThisWeekVolumeBodyMap: DashboardVolumeBodyMap = {
  scale: "volume",
  values: RESTING_HEAT,
  mostTrained: [],
  today: { kind: "none", dayName: null },
};
