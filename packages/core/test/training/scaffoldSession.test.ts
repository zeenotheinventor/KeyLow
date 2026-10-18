import { describe, expect, it } from "vitest";

import { goldenLegsDay, goldenPushDay } from "./routines";
import { scaffoldSession } from "../../src/training";

import type { StoredRoutineDay, StoredRoutineExercise } from "./routines";

const requireFirstExercise = (day: StoredRoutineDay): StoredRoutineExercise => {
  const [first] = day.exercises;
  if (first === undefined) {
    throw new Error("The golden day has no exercises");
  }
  return first;
};

describe("scaffoldSession", () => {
  it("should carry the routine day's id, the link a session started from the day keeps", () => {
    expect(scaffoldSession(goldenLegsDay).routine_day_id).toBe(
      "00000003-0000-4000-8000-000000000003",
    );
  });

  it("should list the 5 exercises of Legs in position order with 3, 3, 3, 3 and 4 slots", () => {
    const { exercises } = scaffoldSession(goldenLegsDay);

    expect(exercises.map((exercise) => exercise.exercise_id)).toStrictEqual([
      "00000001-0000-4000-8000-000000000011",
      "00000001-0000-4000-8000-000000000012",
      "00000001-0000-4000-8000-000000000013",
      "00000001-0000-4000-8000-000000000014",
      "00000001-0000-4000-8000-000000000015",
    ]);
    expect(exercises.map((exercise) => exercise.slots)).toStrictEqual([3, 3, 3, 3, 4]);
  });

  it("should give each exercise its rep range and target RIR", () => {
    expect(scaffoldSession(goldenLegsDay).exercises).toStrictEqual([
      {
        exercise_id: "00000001-0000-4000-8000-000000000011",
        slots: 3,
        rep_min: 5,
        rep_max: 8,
        target_rir: 2,
      },
      {
        exercise_id: "00000001-0000-4000-8000-000000000012",
        slots: 3,
        rep_min: 8,
        rep_max: 10,
        target_rir: 2,
      },
      {
        exercise_id: "00000001-0000-4000-8000-000000000013",
        slots: 3,
        rep_min: 10,
        rep_max: 12,
        target_rir: 1,
      },
      {
        exercise_id: "00000001-0000-4000-8000-000000000014",
        slots: 3,
        rep_min: 10,
        rep_max: 12,
        target_rir: 1,
      },
      {
        exercise_id: "00000001-0000-4000-8000-000000000015",
        slots: 4,
        rep_min: 10,
        rep_max: 15,
        target_rir: 1,
      },
    ]);
  });

  it("should order the exercises by position and not by the order they arrive in", () => {
    const shuffled = {
      ...goldenLegsDay,
      exercises: [...goldenLegsDay.exercises].reverse(),
    };

    expect(scaffoldSession(shuffled)).toStrictEqual(scaffoldSession(goldenLegsDay));
  });

  it("should keep a null target RIR as null", () => {
    const day = {
      id: goldenPushDay.id,
      exercises: [{ ...requireFirstExercise(goldenPushDay), target_rir: null }],
    };

    expect(scaffoldSession(day).exercises[0]?.target_rir).toBeNull();
  });

  it("should keep an exercise that the day plans twice as two entries", () => {
    const first = requireFirstExercise(goldenLegsDay);
    const day = {
      id: goldenLegsDay.id,
      exercises: [first, { ...first, position: 1 }],
    };

    expect(scaffoldSession(day).exercises.map((exercise) => exercise.exercise_id)).toStrictEqual([
      first.exercise_id,
      first.exercise_id,
    ]);
  });

  it("should give a day with no exercises an empty plan", () => {
    expect(scaffoldSession({ id: goldenLegsDay.id, exercises: [] })).toStrictEqual({
      routine_day_id: goldenLegsDay.id,
      exercises: [],
    });
  });

  it("should not change the day it is given", () => {
    const day = { ...goldenLegsDay, exercises: [...goldenLegsDay.exercises].reverse() };
    const before = day.exercises.map((exercise) => exercise.id);

    scaffoldSession(day);

    expect(day.exercises.map((exercise) => exercise.id)).toStrictEqual(before);
  });
});
