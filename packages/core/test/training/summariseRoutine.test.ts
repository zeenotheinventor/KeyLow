import { describe, expect, it } from "vitest";

import { goldenRoutineDays, goldenRoutineDraft } from "./routines";
import {
  estimateSessionMinutes,
  SESSION_TIME_PARAMS_V1,
  summariseRoutine,
} from "../../src/training";

describe("summariseRoutine", () => {
  it("should count 4 days and 63 sets a week for the golden Push Pull Legs", () => {
    const summary = summariseRoutine({ days: goldenRoutineDays });

    expect(summary.dayCount).toBe(4);
    expect(summary.setsPerWeek).toBe(63);
  });

  it("should give the weekday, exercises and sets of each day, in the order the days are given", () => {
    expect(summariseRoutine({ days: goldenRoutineDays }).days).toStrictEqual([
      { weekday: 0, exerciseCount: 5, setCount: 16 },
      { weekday: 1, exerciseCount: 5, setCount: 15 },
      { weekday: 3, exerciseCount: 5, setCount: 16 },
      { weekday: 5, exerciseCount: 5, setCount: 16 },
    ]);
  });

  it("should read an editor's draft as well as stored days", () => {
    expect(summariseRoutine(goldenRoutineDraft)).toStrictEqual(
      summariseRoutine({ days: goldenRoutineDays }),
    );
  });

  it("should count a day with no weekday once in the week", () => {
    const summary = summariseRoutine({
      days: [
        { weekday: 2, exercises: [{ target_sets: 4 }, { target_sets: 3 }] },
        { weekday: null, exercises: [{ target_sets: 5 }] },
      ],
    });

    expect(summary).toStrictEqual({
      dayCount: 2,
      days: [
        { weekday: 2, exerciseCount: 2, setCount: 7 },
        { weekday: null, exerciseCount: 1, setCount: 5 },
      ],
      setsPerWeek: 12,
    });
  });

  it("should summarise a routine with no days, and a day with no exercises", () => {
    expect(summariseRoutine({ days: [] })).toStrictEqual({ dayCount: 0, days: [], setsPerWeek: 0 });
    expect(summariseRoutine({ days: [{ weekday: 0, exercises: [] }] }).days).toStrictEqual([
      { weekday: 0, exerciseCount: 0, setCount: 0 },
    ]);
  });

  it("should feed the length estimate: Push, Pull and Legs each come to about 50 minutes", () => {
    const [push, pull, legs] = summariseRoutine({ days: goldenRoutineDays }).days;

    const minutes = [push, pull, legs].map((day) =>
      estimateSessionMinutes(
        { exercises: day?.exerciseCount ?? 0, sets: day?.setCount ?? 0 },
        SESSION_TIME_PARAMS_V1,
      ),
    );

    // Push is 5 and 16 (50), Pull is 5 and 15 (47.5, rounded half up), Legs is 5 and 16 (50).
    expect(minutes).toStrictEqual([50, 50, 50]);
  });
});
