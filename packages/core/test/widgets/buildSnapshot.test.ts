import { describe, expect, it } from "vitest";

import {
  EXERCISE_ID,
  NEW_ROW_ID,
  NOW,
  OATS_ENTRY_ID,
  SAMPLE_NONCE,
  SESSION_ID,
} from "./sampleSnapshot";
import { buildWidgetSnapshot, widgetNextSet, widgetSnapshotSchema } from "../../src/widgets";

import type { FoodSnapshot } from "../../src/diary";
import type { WidgetSnapshotInput } from "../../src/widgets";

const MUSCLE_VALUES = {
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

const OATS: FoodSnapshot = {
  v: 1,
  kind: "food",
  ref: "00000000-0000-4000-8000-0000000000f1",
  name: "Overnight oats",
  basis: "per_100g",
  per100: {
    kcal: 200,
    protein_g: 10,
    fat_g: 5,
    carbs_g: 30,
    fibre_g: null,
    sat_fat_g: null,
    sugars_g: null,
    salt_g: null,
  },
  density: null,
  quantity: 150,
  unit: "g",
  portion: null,
  resolvedGrams: 150,
  engineVersion: 1,
};

const WEEK = [
  "2026-11-02",
  "2026-11-03",
  "2026-11-04",
  "2026-11-05",
  "2026-11-06",
  "2026-11-07",
  "2026-11-08",
].map((localDate) => ({ localDate, dayLog: null, totals: null }));

const input = (overrides: Partial<WidgetSnapshotInput> = {}): WidgetSnapshotInput => ({
  nonce: SAMPLE_NONCE,
  now: NOW,
  timeZone: "Europe/London",
  weightUnit: "kg",
  today: "2026-11-03",
  targets: { kcal: 2200, protein_g: 160, carbs_g: 240, fat_g: 70 },
  week: WEEK,
  plan: null,
  session: null,
  bodyMap: { scale: "heat", figure: "male", volumeValues: MUSCLE_VALUES, heatSets: [] },
  recentFoods: [],
  lastWeighIn: null,
  ...overrides,
});

describe("buildWidgetSnapshot", () => {
  it("should build a snapshot the contract's schema accepts", () => {
    const snapshot = buildWidgetSnapshot(input());

    expect(widgetSnapshotSchema.safeParse(snapshot).success).toBe(true);
    expect(snapshot).toMatchObject({
      version: 1,
      nonce: SAMPLE_NONCE,
      builtAt: "2026-11-03T12:00:00.000Z",
      today: "2026-11-03",
      weightUnit: "kg",
    });
  });

  it("should hold no target when the calorie target is not set", () => {
    const snapshot = buildWidgetSnapshot(
      input({ targets: { kcal: null, protein_g: 160, carbs_g: null, fat_g: null } }),
    );

    expect(snapshot?.targets).toBeNull();
  });

  it("should carry the week's calories, the weekday figures and the macro targets", () => {
    const snapshot = buildWidgetSnapshot(
      input({
        targets: {
          kcal: 2200,
          protein_g: 160,
          carbs_g: null,
          fat_g: 70,
          dowCaloriesKcal: [2200, 2200, 2200, 2200, 2200, 2400, 2400],
        },
      }),
    );

    expect(snapshot?.targets).toEqual({
      caloriesKcal: 2200,
      weekdayCaloriesKcal: [2200, 2200, 2200, 2200, 2200, 2400, 2400],
      proteinG: 160,
      carbsG: null,
      fatG: 70,
    });
  });

  it("should read a week's completeness and totals, with a missing nutrient as zero", () => {
    const week = WEEK.map((day, position) =>
      position === 0
        ? {
            ...day,
            dayLog: { is_complete: true },
            totals: { kcal: 2050, protein_g: 150, carbs_g: null, fat_g: 60 },
          }
        : day,
    );

    const snapshot = buildWidgetSnapshot(input({ week }));

    expect(snapshot?.week[0]).toEqual({
      localDate: "2026-11-02",
      isComplete: true,
      totals: { kcal: 2050, proteinG: 150, carbsG: 0, fatG: 60 },
    });
    expect(snapshot?.week[1]).toEqual({ localDate: "2026-11-03", isComplete: false, totals: null });
  });

  it("should cap the planned day's exercise names", () => {
    const snapshot = buildWidgetSnapshot(
      input({
        plan: {
          dayName: "Pull day",
          exerciseCount: 5,
          setCount: 16,
          exerciseNames: ["Rows", "Pull-ups", "Curls", "Shrugs", "Face pulls"],
        },
      }),
    );

    expect(snapshot?.training.plan).toEqual({
      dayName: "Pull day",
      exerciseCount: 5,
      setCount: 16,
      exerciseNames: ["Rows", "Pull-ups", "Curls"],
    });
  });

  it("should hold no plan for a day that plans no sets", () => {
    const snapshot = buildWidgetSnapshot(
      input({ plan: { dayName: "Empty", exerciseCount: 0, setCount: 0, exerciseNames: [] } }),
    );

    expect(snapshot?.training.plan).toBeNull();
  });

  it("should carry the running session and its next set", () => {
    const next = {
      exerciseId: EXERCISE_ID,
      exerciseName: "Barbell row",
      exerciseNumber: 2,
      exerciseCount: 5,
      setNumber: 3,
      setCount: 4,
      loadKg: 70,
      reps: 8,
      lastTime: null,
    };

    const snapshot = buildWidgetSnapshot(
      input({
        session: {
          id: SESSION_ID,
          startedAt: "2026-11-03T11:28:00Z",
          dayName: "Pull day",
          next,
        },
      }),
    );

    expect(snapshot?.training.session).toEqual({
      id: SESSION_ID,
      startedAt: "2026-11-03T11:28:00Z",
      dayName: "Pull day",
      next,
    });
  });

  it("should minimise the heat sets to what the heat model reads and drop deleted ones", () => {
    const live = {
      performed_at: "2026-11-03T10:30:00Z",
      set_type: "working" as const,
      rir: 2,
      rpe: null,
      deleted_at: null,
      snapshot: { muscles: [{ muscle_id: "chest_upper" as const, weight: 1 }] },
    };
    const snapshot = buildWidgetSnapshot(
      input({
        bodyMap: {
          scale: "heat",
          figure: "female",
          volumeValues: MUSCLE_VALUES,
          heatSets: [live, { ...live, deleted_at: "2026-11-03T11:00:00Z" }],
        },
      }),
    );

    expect(snapshot?.bodyMap.figure).toBe("female");
    expect(snapshot?.bodyMap.heatSets).toEqual([
      {
        performedAt: "2026-11-03T10:30:00Z",
        setType: "working",
        rir: 2,
        rpe: null,
        muscles: [{ muscleId: "chest_upper", weight: 1 }],
      },
    ]);
  });

  it("should list the recent foods with the energy of the amount they repeat", () => {
    const snapshot = buildWidgetSnapshot(
      input({ recentFoods: [{ entryId: OATS_ENTRY_ID, snapshot: OATS }] }),
    );

    expect(snapshot?.recentFoods).toEqual([
      {
        entryId: OATS_ENTRY_ID,
        name: "Overnight oats",
        kcal: 300,
        amount: { quantity: 150, unit: "g" },
      },
    ]);
  });

  it("should keep only the most recent foods the widget lists", () => {
    const recentFoods = ["a", "b", "c", "d"].map((_, position) => ({
      entryId: `0000000${position}-0000-4000-8000-000000000000`,
      snapshot: OATS,
    }));

    const snapshot = buildWidgetSnapshot(input({ recentFoods }));

    expect(snapshot?.recentFoods).toHaveLength(3);
  });

  it("should carry the last weigh-in", () => {
    const snapshot = buildWidgetSnapshot(
      input({ lastWeighIn: { weightKg: 78.4, localDate: "2026-11-02" } }),
    );

    expect(snapshot?.lastWeighIn).toEqual({ weightKg: 78.4, localDate: "2026-11-02" });
  });

  it("should build nothing when the nonce is too short to trust", () => {
    expect(buildWidgetSnapshot(input({ nonce: "short" }))).toBeNull();
  });

  it("should build nothing when the week does not hold today", () => {
    expect(buildWidgetSnapshot(input({ today: "2026-11-20" }))).toBeNull();
  });
});

describe("widgetNextSet", () => {
  const exercises = [
    { exerciseId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Bench press", plannedSets: 3 },
    { exerciseId: EXERCISE_ID, name: "Barbell row", plannedSets: 4 },
  ];
  const sessionSet = (position: number, loadKg: number, reps: number) => ({
    id: `${position}0000000-0000-4000-8000-000000000000`,
    exercise_id: EXERCISE_ID,
    position,
    performed_at: `2026-11-03T11:0${position}:00Z`,
    deleted_at: null,
    set_type: "working" as const,
    load_kg: loadKg,
    reps,
    rir: null,
    rpe: null,
  });

  it("should be null when the plan has no set left", () => {
    expect(
      widgetNextSet({ nextSet: null, exercises, sessionSets: [], lastPerformanceSets: [] }),
    ).toBeNull();
  });

  it("should place the exercise and the set in the session", () => {
    const next = widgetNextSet({
      nextSet: { exerciseId: EXERCISE_ID, setNumber: 3 },
      exercises,
      sessionSets: [sessionSet(0, 70, 8), sessionSet(1, 72.5, 7)],
      lastPerformanceSets: [],
    });

    expect(next).toEqual({
      exerciseId: EXERCISE_ID,
      exerciseName: "Barbell row",
      exerciseNumber: 2,
      exerciseCount: 2,
      setNumber: 3,
      setCount: 4,
      loadKg: 72.5,
      reps: 7,
      lastTime: null,
    });
  });

  it("should prefill from last time and say what last time was", () => {
    const lastTimeSet = { ...sessionSet(0, 65, 10), id: NEW_ROW_ID };
    const next = widgetNextSet({
      nextSet: { exerciseId: EXERCISE_ID, setNumber: 1 },
      exercises,
      sessionSets: [],
      lastPerformanceSets: [lastTimeSet],
    });

    expect(next).toMatchObject({ loadKg: 65, reps: 10, lastTime: { loadKg: 65, reps: 10 } });
  });

  it("should leave the load and reps blank when there is nothing to fill them from", () => {
    const next = widgetNextSet({
      nextSet: { exerciseId: EXERCISE_ID, setNumber: 1 },
      exercises,
      sessionSets: [],
      lastPerformanceSets: [],
    });

    expect(next).toMatchObject({ loadKg: null, reps: null, lastTime: null });
  });

  it("should be null for an exercise the session does not list", () => {
    expect(
      widgetNextSet({
        nextSet: { exerciseId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", setNumber: 1 },
        exercises,
        sessionSets: [],
        lastPerformanceSets: [],
      }),
    ).toBeNull();
  });
});
