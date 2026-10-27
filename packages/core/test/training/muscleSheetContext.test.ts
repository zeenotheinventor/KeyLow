import { describe, expect, it } from "vitest";

import {
  setsBarPositionsOf,
  TRAINING_PARAMS_V2,
  upcomingSessionsOf,
  weightingExampleOf,
} from "../../src/training";

import type { PlanRoutine, WeekDayStatus } from "../../src/training";

type Entry = {
  muscle_id: "delt_side" | "delt_front";
  role: "primary" | "secondary";
  weight: number;
};

function exercise(
  name: string,
  muscles: Entry[],
): PlanRoutine["days"][number]["exercises"][number] {
  return {
    id: `routine-${name}`,
    position: 0,
    exercise_id: `exercise-${name}`,
    target_sets: 3,
    target_rir: null,
    exercise: { id: `exercise-${name}`, name, equipment: "barbell", mechanic: "compound" },
    muscles,
  };
}

function routineOf(...exercises: PlanRoutine["days"][number]["exercises"]): PlanRoutine {
  return { days: [{ id: "day-1", position: 0, weekday: 0, exercises }] };
}

describe("weightingExampleOf", () => {
  it("should name the first exercise that works the muscle at less than a whole set, in lower case", () => {
    const routine = routineOf(
      exercise("Side lateral raise", [{ muscle_id: "delt_side", role: "primary", weight: 1 }]),
      exercise("Shoulder Press", [{ muscle_id: "delt_side", role: "secondary", weight: 0.5 }]),
    );

    expect(weightingExampleOf(routine, "delt_side")).toEqual({
      exerciseName: "shoulder press",
      weight: 0.5,
    });
  });

  it("should be null when every exercise that works the muscle counts a whole set", () => {
    const routine = routineOf(
      exercise("Side lateral raise", [{ muscle_id: "delt_side", role: "primary", weight: 1 }]),
    );

    expect(weightingExampleOf(routine, "delt_side")).toBeNull();
  });

  it("should ignore an exercise that does not work the muscle at all", () => {
    const routine = routineOf(
      exercise("Front raise", [{ muscle_id: "delt_front", role: "primary", weight: 0.5 }]),
    );

    expect(weightingExampleOf(routine, "delt_side")).toBeNull();
  });

  it("should leave out an exercise that counts for the muscle at weight 0", () => {
    const routine = routineOf(
      exercise("Shoulder press", [{ muscle_id: "delt_side", role: "secondary", weight: 0 }]),
    );

    expect(weightingExampleOf(routine, "delt_side")).toBeNull();
  });

  it("should leave out an exercise that counts for more than a whole set", () => {
    const routine = routineOf(
      exercise("Upright row", [{ muscle_id: "delt_side", role: "primary", weight: 1.5 }]),
    );

    expect(weightingExampleOf(routine, "delt_side")).toBeNull();
  });

  it("should be null with no routine", () => {
    expect(weightingExampleOf(null, "delt_side")).toBeNull();
  });
});

describe("upcomingSessionsOf", () => {
  const day = (date: string, status: WeekDayStatus, plannedDayName: string | null) => ({
    date,
    status,
    plannedDayName,
  });

  it("should keep the planned days and today before it is started, as sessions named by their routine day", () => {
    expect(
      upcomingSessionsOf([
        day("2026-10-12", "logged", "Push"),
        day("2026-10-15", "today", "Legs"),
        day("2026-10-16", "rest", null),
        day("2026-10-17", "planned", "Push"),
        day("2026-10-18", "rest", null),
      ]),
    ).toEqual([
      { localDate: "2026-10-15", routineDayName: "Legs" },
      { localDate: "2026-10-17", routineDayName: "Push" },
    ]);
  });

  it("should leave out a day that is in progress, missed or extra", () => {
    expect(
      upcomingSessionsOf([
        day("2026-10-13", "missed", "Pull"),
        day("2026-10-15", "in_progress", "Legs"),
        day("2026-10-16", "extra", null),
      ]),
    ).toEqual([]);
  });
});

describe("setsBarPositionsOf", () => {
  const bands = TRAINING_PARAMS_V2.sizeClasses.small.volume;

  it("should place the golden side delts on a track that runs to 24 sets", () => {
    const positions = setsBarPositionsOf({ actual: 5.5, planned: 11, bands });

    expect(positions.done).toBeCloseTo(5.5 / 24, 5);
    expect(positions.planned).toBeCloseTo(11 / 24, 5);
    expect(positions.growingFrom).toBeCloseTo(4 / 24, 5);
    expect(positions.productiveFrom).toBeCloseTo(10 / 24, 5);
    expect(positions.highAbove).toBeCloseTo(20 / 24, 5);
  });

  it("should hold a figure beyond the track at the end of it", () => {
    const positions = setsBarPositionsOf({ actual: 25, planned: 30, bands });

    expect(positions.done).toBe(1);
    expect(positions.planned).toBe(1);
  });

  it("should put nothing logged or planned at the start of the track", () => {
    const positions = setsBarPositionsOf({ actual: 0, planned: 0, bands });

    expect(positions.done).toBe(0);
    expect(positions.planned).toBe(0);
  });
});
