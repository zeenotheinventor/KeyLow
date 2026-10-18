import { describe, expect, it } from "vitest";

import {
  arms,
  bench,
  benchMuscles,
  curl,
  curlMuscles,
  LONDON,
  legs,
  planExercise,
  pull,
  push,
  routine,
  squat,
  WEEK,
} from "./plans";
import {
  buildSetSnapshot,
  COMPARE_PARAMS_V1,
  expandPlan,
  muscleState,
  TRAINING_PARAMS_V1,
  TRAINING_PARAMS_VERSION,
  weeklyVolume,
} from "../../src/training";

import type { CompareParams, PlanRoutineDay } from "../../src/training";

const params = COMPARE_PARAMS_V1;

describe("COMPARE_PARAMS_V1", () => {
  // Every v1 value, written out. Changing one is a new params version, never an edit of this one.
  it("should hold exactly the v1 values, with the v1 training params", () => {
    expect(COMPARE_PARAMS_V1).toStrictEqual({
      version: "keylow-training-v1",
      training: TRAINING_PARAMS_V1,
      plannedTime: { hour: 18, minute: 0 },
      onPlanToleranceSets: 1,
    } satisfies CompareParams);
    expect(COMPARE_PARAMS_V1.version).toBe(TRAINING_PARAMS_VERSION);
    expect(COMPARE_PARAMS_V1.training).toBe(TRAINING_PARAMS_V1);
  });
});

describe("expandPlan", () => {
  it("should place each day on its weekday at 18:00 local, in weekday order", () => {
    const planned = expandPlan(routine, WEEK, LONDON, params);

    // London is on BST (UTC+1) this week until Sunday, so 18:00 local is 17:00 UTC.
    expect(
      [...new Set(planned.map((set) => `${set.local_date} ${set.performed_at}`))].sort(),
    ).toEqual([
      "2026-10-19 2026-10-19T17:00:00.000Z",
      "2026-10-21 2026-10-21T17:00:00.000Z",
      "2026-10-23 2026-10-23T17:00:00.000Z",
    ]);
    expect(planned.map((set) => set.routine_day_id)).toEqual([
      ...Array<string>(3).fill(push.id),
      ...Array<string>(4).fill(legs.id),
      ...Array<string>(3).fill(pull.id),
    ]);
  });

  it("should expand each routine exercise into target_sets working sets at target_rir", () => {
    const planned = expandPlan({ days: [push] }, WEEK, LONDON, params);

    expect(planned).toHaveLength(3);
    for (const [position, set] of planned.entries()) {
      expect(set).toStrictEqual({
        planned: true,
        set_type: "working",
        rir: 2,
        rpe: null,
        performed_at: "2026-10-19T17:00:00.000Z",
        deleted_at: null,
        exercise_id: bench.id,
        routine_day_id: push.id,
        routine_exercise_id: push.exercises[0]?.id,
        local_date: "2026-10-19",
        position,
        snapshot: buildSetSnapshot(bench, benchMuscles),
      });
    }
  });

  it("should number a day's sets through its exercises in position order", () => {
    const day: PlanRoutineDay = {
      ...push,
      exercises: [
        planExercise(curl, curlMuscles, 2, null, 5),
        planExercise(bench, benchMuscles, 1, 0, 1),
      ],
    };
    const planned = expandPlan({ days: [day] }, WEEK, LONDON, params);

    expect(planned.map((set) => [set.exercise_id, set.position, set.rir])).toEqual([
      [bench.id, 0, 0],
      [curl.id, 1, null],
      [curl.id, 2, null],
    ]);
  });

  it("should not place a day whose weekday is null", () => {
    expect(expandPlan({ days: [arms] }, WEEK, LONDON, params)).toEqual([]);
    expect(
      expandPlan(routine, WEEK, LONDON, params).some((set) => set.routine_day_id === arms.id),
    ).toBe(false);
  });

  it("should give nothing for a routine with no days", () => {
    expect(expandPlan({ days: [] }, WEEK, LONDON, params)).toEqual([]);
  });

  it("should take the snapshot from the exercise's current map", () => {
    const edited = [{ muscle_id: "quads", role: "primary", weight: 0.8 }] as const;
    const day: PlanRoutineDay = {
      ...legs,
      exercises: [planExercise(squat, edited, 1, 2, 0)],
    };
    const [set] = expandPlan({ days: [day] }, WEEK, LONDON, params);

    expect(set?.snapshot.muscles).toEqual(edited);
  });

  it("should place a Sunday day after the clocks go back at 18:00 GMT", () => {
    // The clocks go back in London on Sunday 25 October 2026, so 18:00 local is 18:00 UTC that day.
    const sunday: PlanRoutineDay = { ...push, weekday: 6 };
    const [set] = expandPlan({ days: [sunday] }, WEEK, LONDON, params);

    expect(set?.local_date).toBe("2026-10-25");
    expect(set?.performed_at).toBe("2026-10-25T18:00:00.000Z");
  });

  it("should keep a day on its local date when 18:00 local is the next day in UTC", () => {
    // 18:00 on Sunday in Los Angeles (PDT, UTC−7) is 01:00 UTC on Monday.
    const sunday: PlanRoutineDay = { ...push, weekday: 6 };
    const [set] = expandPlan({ days: [sunday] }, WEEK, "America/Los_Angeles", params);

    expect(set?.local_date).toBe("2026-10-25");
    expect(set?.performed_at).toBe("2026-10-26T01:00:00.000Z");
  });

  it("should use the params' planned time", () => {
    const morning: CompareParams = { ...params, plannedTime: { hour: 7, minute: 30 } };
    const [set] = expandPlan({ days: [push] }, WEEK, LONDON, morning);

    expect(set?.performed_at).toBe("2026-10-19T06:30:00.000Z");
  });

  it("should give sets that muscleState and weeklyVolume read unchanged", () => {
    const planned = expandPlan(routine, WEEK, LONDON, params);
    const endOfWeek = "2026-10-25T23:00:00.000Z";

    // Three bench sets at RIR 2 count in full: chest_lower 3, chest_upper 3 × 0.6, triceps 3 × 0.5.
    const volume = weeklyVolume(planned, endOfWeek, params.training);
    expect(volume.chest_lower.weeklySets).toBe(3);
    expect(volume.chest_upper.weeklySets).toBe(1.8);
    expect(volume.quads.weeklySets).toBe(4);
    expect(volume.biceps.weeklySets).toBe(1.5);
    expect(muscleState(planned, "2026-10-23T17:00:00.000Z", params.training).lats.heat).toBe(
      3 / 10,
    );
  });

  it("should refuse a week that does not start on a Monday", () => {
    expect(() => expandPlan(routine, "2026-10-20", LONDON, params)).toThrow(
      new RangeError("A week must start on a Monday, written YYYY-MM-DD"),
    );
    expect(() => expandPlan(routine, "2026-02-30", LONDON, params)).toThrow(RangeError);
    expect(() => expandPlan(routine, "19/10/2026", LONDON, params)).toThrow(RangeError);
  });

  it("should refuse a zone that is not an IANA name", () => {
    expect(() => expandPlan(routine, WEEK, "+01:00", params)).toThrow(
      new RangeError("A week's time zone must be an IANA zone name"),
    );
  });

  it("should refuse two days on one weekday", () => {
    expect(() =>
      expandPlan({ days: [push, { ...legs, weekday: 0 }] }, WEEK, LONDON, params),
    ).toThrow(new RangeError("A routine has at most one day per weekday"));
  });

  it("should refuse a weekday out of range", () => {
    expect(() => expandPlan({ days: [{ ...push, weekday: 7 }] }, WEEK, LONDON, params)).toThrow(
      new RangeError("A routine day's weekday must be 0 (Monday) to 6 (Sunday) or null"),
    );
  });

  it("should refuse target sets out of range", () => {
    for (const targetSets of [0, 21, 1.5]) {
      const day: PlanRoutineDay = {
        ...push,
        exercises: [planExercise(bench, benchMuscles, targetSets, 2, 0)],
      };
      expect(() => expandPlan({ days: [day] }, WEEK, LONDON, params)).toThrow(
        new RangeError("A routine exercise's target sets must be a whole number from 1 to 20"),
      );
    }
  });

  it("should refuse a muscle map taken from another exercise", () => {
    const day: PlanRoutineDay = {
      ...push,
      exercises: [{ ...planExercise(bench, benchMuscles, 3, 2, 0), exercise_id: squat.id }],
    };
    expect(() => expandPlan({ days: [day] }, WEEK, LONDON, params)).toThrow(
      new RangeError("A routine exercise's muscle map must be taken from its own exercise"),
    );
  });

  it("should refuse a muscle map with no primary muscle, as buildSetSnapshot does", () => {
    const day: PlanRoutineDay = {
      ...push,
      exercises: [
        planExercise(bench, [{ muscle_id: "triceps", role: "secondary", weight: 0.5 }], 3, 2, 0),
      ],
    };
    expect(() => expandPlan({ days: [day] }, WEEK, LONDON, params)).toThrow(
      new RangeError("An exercise needs at least one primary muscle"),
    );
  });
});
