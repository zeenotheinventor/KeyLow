import { buildWidgetSnapshot } from "@keylow/core/widgets";

import type { WidgetSnapshotSource } from "../../lib/widgets/snapshotWriter";
import type { WidgetSnapshotInput } from "@keylow/core/widgets";

export const NOW = new Date("2026-11-03T12:00:00.000Z");
export const NONCE = "nonce-0123456789abcdef";
export const SESSION_ID = "6c9f1c3e-4c7a-4f0e-9d52-0b7c1a2e8f01";
export const EXERCISE_ID = "0b0f6a52-8f3c-4a39-a8c8-5d2f6a1b9c10";
export const ENTRY_ID = "11111111-1111-4111-8111-111111111111";
export const NEW_ROW_ID = "44444444-4444-4444-8444-444444444444";

const NO_VOLUME = {
  chest_upper: 0,
  chest_lower: 0,
  delt_front: 0,
  delt_side: 0,
  delt_rear: 0,
  lats: 0,
  traps_upper: 0,
  traps_mid: 0,
  lower_back: 0,
  biceps: 0,
  triceps: 0,
  forearms: 0,
  abs: 0,
  obliques: 0,
  glute_max: 0,
  glute_med: 0,
  quads: 0,
  hamstrings: 0,
  adductors: 0,
  calves: 0,
  tibialis: 0,
  neck: 0,
};

const WEEK_DAYS = [
  "2026-11-02",
  "2026-11-03",
  "2026-11-04",
  "2026-11-05",
  "2026-11-06",
  "2026-11-07",
  "2026-11-08",
];

/** What the screens hold on a Tuesday in London with nothing logged, which a test overrides in the part it cares about. */
export const snapshotSource = (
  overrides: Partial<WidgetSnapshotSource> = {},
): WidgetSnapshotSource => ({
  timeZone: "Europe/London",
  weightUnit: "kg",
  today: "2026-11-03",
  targets: { kcal: 2200, protein_g: 160, carbs_g: 240, fat_g: 70 },
  week: WEEK_DAYS.map((localDate) => ({ localDate, dayLog: null, totals: null })),
  plan: null,
  session: null,
  bodyMap: {
    scale: "heat",
    figure: "male",
    volumeValues: NO_VOLUME,
    heatSets: [],
  },
  recentFoods: [],
  lastWeighIn: null,
  ...overrides,
});

export const snapshotInput = (
  overrides: Partial<WidgetSnapshotInput> = {},
): WidgetSnapshotInput => ({
  nonce: NONCE,
  now: NOW,
  ...snapshotSource(),
  ...overrides,
});

export const testSnapshot = (overrides: Partial<WidgetSnapshotInput> = {}) => {
  const snapshot = buildWidgetSnapshot(snapshotInput(overrides));
  if (snapshot === null) {
    throw new Error("The test snapshot input must build a snapshot");
  }
  return snapshot;
};
