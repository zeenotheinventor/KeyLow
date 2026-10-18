import type { SetSnapshotMuscle } from "../../src/schemas";
import type { HeatSet } from "../../src/training";

export const HOUR = 3_600_000;
export const DAY = 24 * HOUR;

/** 08:00 UTC on 18 October 2026, the moment most tests log their first set. */
export const MORNING = Date.UTC(2026, 9, 18, 8);

export const at = (milliseconds: number): string => new Date(milliseconds).toISOString();

export const lateralRaise: SetSnapshotMuscle[] = [
  { muscle_id: "delt_side", role: "primary", weight: 1 },
  { muscle_id: "traps_upper", role: "secondary", weight: 0.3 },
];

export const benchPress: SetSnapshotMuscle[] = [
  { muscle_id: "chest_upper", role: "secondary", weight: 0.6 },
  { muscle_id: "chest_lower", role: "primary", weight: 1 },
  { muscle_id: "delt_front", role: "secondary", weight: 0.5 },
  { muscle_id: "triceps", role: "secondary", weight: 0.5 },
];

/** A live working set with no effort measure, performed at `MORNING`, unless `overrides` say otherwise. */
export const heatSet = (
  muscles: readonly SetSnapshotMuscle[],
  overrides: Partial<Omit<HeatSet, "snapshot">> = {},
): HeatSet => ({
  set_type: "working",
  rir: null,
  rpe: null,
  performed_at: at(MORNING),
  deleted_at: null,
  ...overrides,
  snapshot: { muscles: [...muscles] },
});

/** `count` copies of the same set. */
export const repeat = (count: number, set: HeatSet): HeatSet[] =>
  Array.from({ length: count }, () => set);
