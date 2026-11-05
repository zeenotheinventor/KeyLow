import { buildSetSnapshot, planProgress } from "@keylow/core/training";
import { describe, expect, it } from "vitest";

import { describeFinishDetails } from "../../src/hooks/describeFinishDetails";

import type { ScreenSet } from "../../src/hooks/sessionViewTypes";
import type { SessionScaffold } from "@keylow/core/training";

const SQUAT = "00000000-0000-4000-8000-0000000000a1";
const PRESS = "00000000-0000-4000-8000-0000000000a2";
const CURL = "00000000-0000-4000-8000-0000000000a3";
const SESSION_ID = "00000000-0000-4000-8000-000000000001";

const set = (
  id: string,
  exerciseId: string,
  position: number,
  setType: ScreenSet["set_type"] = "working",
): ScreenSet => ({
  id,
  session_id: SESSION_ID,
  exercise_id: exerciseId,
  position,
  set_type: setType,
  reps: 10,
  load_kg: 100,
  rir: 2,
  rpe: null,
  performed_at: `2026-10-15T18:${String(30 + position).padStart(2, "0")}:00Z`,
  deleted_at: null,
});

const scaffold: SessionScaffold = {
  routine_day_id: "00000000-0000-4000-8000-0000000000d1",
  exercises: [
    { exercise_id: SQUAT, slots: 3, rep_min: 5, rep_max: 8, target_rir: 2 },
    { exercise_id: PRESS, slots: 3, rep_min: 10, rep_max: 12, target_rir: 1 },
    { exercise_id: CURL, slots: 3, rep_min: 10, rep_max: 12, target_rir: 1 },
  ],
};

const plannedNames = [
  { exerciseId: SQUAT, name: "Barbell squat" },
  { exerciseId: PRESS, name: "Leg press" },
  { exerciseId: CURL, name: "Seated leg curl" },
];

const open = (sets: readonly ScreenSet[]) => ({
  id: SESSION_ID,
  started_at: "2026-10-15T17:30:00Z",
  sets,
});

describe("describeFinishDetails", () => {
  const sets = [
    set("a", SQUAT, 0, "warmup"),
    set("b", SQUAT, 1),
    set("c", SQUAT, 2),
    set("d", SQUAT, 3),
    set("e", PRESS, 4),
    set("f", PRESS, 5),
    set("g", CURL, 6, "warmup"),
  ];

  const details = describeFinishDetails(
    open(sets),
    "Legs",
    planProgress(scaffold, sets),
    plannedNames,
  );

  it("should count the working sets against the plan, and the warm-ups apart", () => {
    expect(details).toMatchObject({
      sessionId: SESSION_ID,
      dayName: "Legs",
      startedAt: "2026-10-15T17:30:00Z",
      workingSets: 5,
      plannedSets: 9,
      warmups: 2,
    });
  });

  it("should count the exercises with a working set against the exercises of the plan, not one with only a warm-up", () => {
    expect(details.exercisesLogged).toBe(2);
    expect(details.exercisesPlanned).toBe(3);
  });

  it("should name the planned sets left alone, with the exercise's name", () => {
    expect(details.notLoggedNote).toBe(
      "4 planned sets are not logged: leg press set 3 and seated leg curl. Only logged sets are saved.",
    );
  });

  it("should leave out the sets that have no snapshot, which the heat cannot read", () => {
    expect(details.sets).toEqual([]);
  });

  it("should keep the sets that have one", () => {
    const snapshot = buildSetSnapshot(
      { id: SQUAT, name: "Barbell squat", equipment: "barbell", mechanic: "compound" },
      [{ muscle_id: "quads", role: "primary", weight: 1 }],
    );
    const stored = [{ ...set("a", SQUAT, 0), snapshot }, set("b", SQUAT, 1)];

    expect(
      describeFinishDetails(open(stored), "Legs", planProgress(scaffold, stored), plannedNames)
        .sets,
    ).toEqual([{ ...set("a", SQUAT, 0), snapshot }]);
  });

  it("should keep the sets of a session that follows no plan, with no planned figure and no sentence", () => {
    const freeSets = [set("a", SQUAT, 0)];

    expect(
      describeFinishDetails(open(freeSets), null, planProgress(null, freeSets), null),
    ).toMatchObject({
      dayName: null,
      workingSets: 1,
      plannedSets: null,
      exercisesLogged: 1,
      exercisesPlanned: null,
      notLoggedNote: null,
    });
  });
});
