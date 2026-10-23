import { describe, expect, it } from "vitest";

import {
  setsBarPositionsOf,
  TRAINING_PARAMS_V1,
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
  const sideDeltsTarget = { mev: 6, mav: { low: 10, high: 16 }, mrv: 22 };

  it("should place the golden side delts on a track that runs to the maximum", () => {
    const positions = setsBarPositionsOf({ actual: 5.5, planned: 11, target: sideDeltsTarget });

    expect(positions.done).toBeCloseTo(0.25, 5);
    expect(positions.planned).toBeCloseTo(0.5, 5);
    expect(positions.minimum).toBeCloseTo(6 / 22, 5);
    expect(positions.bandStart).toBeCloseTo(10 / 22, 5);
    expect(positions.bandEnd).toBeCloseTo(16 / 22, 5);
  });

  it("should hold a figure beyond the maximum at the end of the track", () => {
    const positions = setsBarPositionsOf({ actual: 25, planned: 30, target: sideDeltsTarget });

    expect(positions.done).toBe(1);
    expect(positions.planned).toBe(1);
  });

  it("should put nothing logged or planned at the start of the track", () => {
    const positions = setsBarPositionsOf({ actual: 0, planned: 0, target: sideDeltsTarget });

    expect(positions.done).toBe(0);
    expect(positions.planned).toBe(0);
  });
});

describe("the labels of the sets bar", () => {
  const sideDeltsTarget = { mev: 6, mav: { low: 10, high: 16 }, mrv: 22 };
  const positionsFor = (planned: number) =>
    setsBarPositionsOf({ actual: 5.5, planned, target: sideDeltsTarget });

  it("should centre the minimum and the planned figure when they are well apart and clear of the edges", () => {
    const positions = positionsFor(11);

    expect(positions.plannedLabel).toBe("centre");
    expect(positions.isPlannedLabelBelow).toBe(false);
  });

  it("should align a planned figure of 0 to the start and move it under the bar, clear of the 0", () => {
    const positions = positionsFor(0);

    expect(positions.plannedLabel).toBe("start");
    expect(positions.isPlannedLabelBelow).toBe(true);
  });

  it("should move a planned figure of 7 under the bar, because the minimum of 6 is beside it", () => {
    const positions = positionsFor(7);

    expect(positions.plannedLabel).toBe("centre");
    expect(positions.isPlannedLabelBelow).toBe(true);
  });

  it("should keep a planned figure of 10 on the bar, because it is well apart from the minimum of 6", () => {
    expect(positionsFor(10).isPlannedLabelBelow).toBe(false);
  });

  it("should align a planned figure at the maximum to the end and move it under the bar, clear of the maximum", () => {
    const positions = positionsFor(22);

    expect(positions.plannedLabel).toBe("end");
    expect(positions.isPlannedLabelBelow).toBe(true);
  });

  it.each([18, 19])(
    "should move a planned figure of %s on a maximum of 22 under the bar, because it would meet the Max label",
    (planned) => {
      const positions = positionsFor(planned);

      expect(positions.plannedLabel).toBe("centre");
      expect(positions.isPlannedLabelBelow).toBe(true);
    },
  );

  it("should keep a planned figure of 17 on a maximum of 22 on the bar, clear of the Max label", () => {
    expect(positionsFor(17).isPlannedLabelBelow).toBe(false);
  });

  it("should keep the Min label clear of the 0 and the Max label for every size class of the training params", () => {
    for (const { mev, mav, mrv } of Object.values(TRAINING_PARAMS_V1.sizeClasses)) {
      const { minimum } = setsBarPositionsOf({ actual: 0, planned: 0, target: { mev, mav, mrv } });

      expect(minimum).toBeGreaterThan(0.2);
      expect(minimum).toBeLessThan(0.5);
    }
  });

  it("should leave a minimum near the start at its share of the track, which the Min label is centred on", () => {
    const positions = setsBarPositionsOf({
      actual: 0,
      planned: 10,
      target: { mev: 1, mav: { low: 4, high: 8 }, mrv: 20 },
    });

    expect(positions.minimum).toBeCloseTo(0.05, 5);
    expect(positions).not.toHaveProperty("minimumLabel");
  });

  it("should put every mark at the start of a track with no maximum", () => {
    const positions = setsBarPositionsOf({
      actual: 4,
      planned: 8,
      target: { mev: 6, mav: { low: 10, high: 16 }, mrv: 0 },
    });

    expect(positions.done).toBe(0);
    expect(positions.planned).toBe(0);
    expect(positions.bandEnd).toBe(0);
  });
});
