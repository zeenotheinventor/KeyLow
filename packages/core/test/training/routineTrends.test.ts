import { describe, expect, it } from "vitest";

import { routineTrendsByDay } from "../../src/training";

import type { TrendSet } from "../../src/training";

const options = { range: "4w", now: "2026-10-20T12:00:00Z", timeZone: "UTC" } as const;

type RoutineSet = TrendSet & { exercise_id: string };

const squat = { exercise_id: "squat", position: 0, name: "Squat" };
const press = { exercise_id: "press", position: 1, name: "Press" };
const row = { exercise_id: "row", position: 0, name: "Row" };

const aSet = (exerciseId: string, localDate: string, loadKg: number | null): RoutineSet => ({
  exercise_id: exerciseId,
  set_type: "working",
  reps: 8,
  load_kg: loadKg,
  deleted_at: null,
  local_date: localDate,
  session_deleted_at: null,
});

describe("routineTrendsByDay", () => {
  it("should group the exercises by routine day, days and exercises in position order", () => {
    const days = [
      { id: "pull", name: "Pull", position: 1, exercises: [row] },
      { id: "push", name: "Push", position: 0, exercises: [press, squat] },
    ];

    const grouped = routineTrendsByDay(days, { sets: [] }, options);

    expect(grouped.map((day) => day.id)).toEqual(["push", "pull"]);
    expect(grouped[0]?.exercises.map((entry) => entry.exercise.name)).toEqual(["Squat", "Press"]);
  });

  it("should give each exercise its own trend from its own sets", () => {
    const days = [{ id: "push", name: "Push", position: 0, exercises: [squat, press] }];
    const sets = [
      aSet("squat", "2026-10-06", 100),
      aSet("squat", "2026-10-13", 105),
      aSet("press", "2026-10-13", 40),
      aSet("other", "2026-10-13", 999),
    ];

    const [push] = routineTrendsByDay(days, { sets }, options);

    expect(push?.exercises[0]?.trend.latest?.value).toEqual({ loadKg: 105, reps: 8 });
    expect(push?.exercises[0]?.trend.latest?.change).toMatchObject({
      kind: "load",
      previousLoadKg: 100,
    });
    expect(push?.exercises[1]?.trend.latest?.value).toEqual({ loadKg: 40, reps: 8 });
    expect(push?.exercises[1]?.trend.latest?.change).toEqual({ kind: "first" });
  });

  it("should give each exercise its own earlier week", () => {
    const days = [{ id: "push", name: "Push", position: 0, exercises: [squat, press] }];
    const sets = [aSet("squat", "2026-09-29", 105), aSet("press", "2026-09-29", 40)];
    const earlier = [aSet("squat", "2026-07-07", 100)];

    const [push] = routineTrendsByDay(days, { sets, earlier }, options);

    expect(push?.exercises[0]?.trend.weeks[0]?.change).toMatchObject({ previousLoadKg: 100 });
    expect(push?.exercises[1]?.trend.weeks[0]?.change).toEqual({ kind: "first" });
  });

  it("should count sets from every session, whichever routine day or free session they came from", () => {
    const days = [
      { id: "push", name: "Push", position: 0, exercises: [squat] },
      { id: "legs", name: "Legs", position: 1, exercises: [squat] },
    ];
    const sets = [aSet("squat", "2026-10-06", 100)];

    const grouped = routineTrendsByDay(days, { sets }, options);

    expect(grouped.map((day) => day.exercises[0]?.trend.latest?.value.loadKg)).toEqual([100, 100]);
  });

  it("should give an exercise with no sets a trend with no latest week", () => {
    const days = [{ id: "push", name: "Push", position: 0, exercises: [squat] }];

    const [push] = routineTrendsByDay(days, { sets: [] }, options);

    expect(push?.exercises[0]?.trend.latest).toBeNull();
  });

  it("should list an exercise a day plans twice once, at its first place", () => {
    const days = [
      {
        id: "push",
        name: "Push",
        position: 0,
        exercises: [squat, press, { ...squat, position: 2 }],
      },
    ];

    const [push] = routineTrendsByDay(days, { sets: [] }, options);

    expect(push?.exercises.map((entry) => entry.exercise.exercise_id)).toEqual(["squat", "press"]);
  });

  it("should give no days for a routine with none", () => {
    expect(routineTrendsByDay([], { sets: [] }, options)).toEqual([]);
  });
});
