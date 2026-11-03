import type { WidgetSnapshot } from "../../src/widgets";

/*
 * A Tuesday, 3 November 2026, in London (GMT), with the board's numbers where a number is drawn:
 * 1,460 of 2,200 kcal, 112 / 160 g protein, 150 / 240 g carbs, 48 / 70 g fat, Overnight oats, Chicken
 * wrap and Protein shake, a Pull day of five exercises, and a session on set 3 of 4 of the Barbell row.
 */
export const SAMPLE_NONCE = "nonce-0123456789ab";
export const NOW = new Date("2026-11-03T12:00:00Z");
export const NOW_ISO = "2026-11-03T12:00:00.000Z";
export const SESSION_ID = "6c9f1c3e-4c7a-4f0e-9d52-0b7c1a2e8f01";
export const EXERCISE_ID = "0b0f6a52-8f3c-4a39-a8c8-5d2f6a1b9c10";
export const OATS_ENTRY_ID = "11111111-1111-4111-8111-111111111111";
export const WRAP_ENTRY_ID = "22222222-2222-4222-8222-222222222222";
export const SHAKE_ENTRY_ID = "33333333-3333-4333-8333-333333333333";
export const NEW_ROW_ID = "44444444-4444-4444-8444-444444444444";

const set = (
  performedAt: string,
  muscles: { muscleId: "chest_upper" | "delt_front" | "triceps"; weight: number }[],
) => ({ performedAt, setType: "working" as const, rir: null, rpe: null, muscles });

export const SAMPLE_TARGETS = {
  caloriesKcal: 2200,
  weekdayCaloriesKcal: [2200, 2200, 2200, 2200, 2200, 2400, 2400] as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
  ],
  proteinG: 160,
  carbsG: 240,
  fatG: 70,
};

export const sampleSnapshot = (): WidgetSnapshot => ({
  version: 1,
  nonce: SAMPLE_NONCE,
  builtAt: "2026-11-03T10:05:00+00:00",
  timeZone: "Europe/London",
  weightUnit: "kg",
  today: "2026-11-03",
  targets: SAMPLE_TARGETS,
  week: [
    {
      localDate: "2026-11-02",
      isComplete: true,
      totals: { kcal: 2050, proteinG: 150, carbsG: 230, fatG: 60 },
    },
    {
      localDate: "2026-11-03",
      isComplete: false,
      totals: { kcal: 1460, proteinG: 112, carbsG: 150, fatG: 48 },
    },
    { localDate: "2026-11-04", isComplete: false, totals: null },
    { localDate: "2026-11-05", isComplete: false, totals: null },
    { localDate: "2026-11-06", isComplete: false, totals: null },
    { localDate: "2026-11-07", isComplete: false, totals: null },
    { localDate: "2026-11-08", isComplete: false, totals: null },
  ],
  training: {
    plan: {
      dayName: "Pull day",
      exerciseCount: 5,
      setCount: 16,
      exerciseNames: ["Rows", "Pull-ups", "Curls"],
    },
    session: null,
  },
  bodyMap: {
    scale: "heat",
    figure: "male",
    volumeValues: {
      chest_upper: 3,
      chest_lower: 3,
      delt_front: 2,
      delt_side: 0,
      delt_rear: 0,
      lats: 1,
      traps_upper: 0,
      traps_mid: 0,
      lower_back: 0,
      biceps: 0,
      triceps: 2,
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
    },
    heatSets: [
      ...[0, 1, 2, 3, 4].map(() =>
        set("2026-11-03T10:30:00Z", [
          { muscleId: "chest_upper", weight: 1 },
          { muscleId: "delt_front", weight: 0.6 },
          { muscleId: "triceps", weight: 0.6 },
        ]),
      ),
    ],
  },
  recentFoods: [
    {
      entryId: OATS_ENTRY_ID,
      name: "Overnight oats",
      kcal: 410,
      amount: { quantity: 1, unit: "portion" },
    },
    {
      entryId: WRAP_ENTRY_ID,
      name: "Chicken wrap",
      kcal: 520,
      amount: { quantity: 1, unit: "portion" },
    },
    {
      entryId: SHAKE_ENTRY_ID,
      name: "Protein shake",
      kcal: 180,
      amount: { quantity: 300, unit: "ml" },
    },
  ],
  lastWeighIn: { weightKg: 78.4, localDate: "2026-11-02" },
});

export const SAMPLE_SESSION = {
  id: SESSION_ID,
  startedAt: "2026-11-03T11:28:00Z",
  dayName: "Pull day",
  next: {
    exerciseId: EXERCISE_ID,
    exerciseName: "Barbell row",
    exerciseNumber: 2,
    exerciseCount: 5,
    setNumber: 3,
    setCount: 4,
    loadKg: 70,
    reps: 8,
    lastTime: { loadKg: 67.5, reps: 8 },
  },
};

/** The sample with a session running on set 3 of 4 of the Barbell row, as board B draws it. */
export const sampleSnapshotInSession = (): WidgetSnapshot => {
  const snapshot = sampleSnapshot();
  return {
    ...snapshot,
    training: {
      ...snapshot.training,
      session: SAMPLE_SESSION,
    },
  };
};
