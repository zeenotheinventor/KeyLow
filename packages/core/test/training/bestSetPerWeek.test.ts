import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { bestSetPerWeek, exerciseWeeklyTrend } from "../../src/training";

import type { TrendSet } from "../../src/training";

type ExerciseSet = TrendSet & { exercise_id: string };

const aSet = (localDate: string, overrides: Partial<ExerciseSet> = {}): ExerciseSet => ({
  exercise_id: "bench",
  set_type: "working",
  reps: 8,
  load_kg: 60,
  local_date: localDate,
  ...overrides,
});

describe("bestSetPerWeek", () => {
  it("should keep the heaviest set of each week and drop the rest", () => {
    const heaviest = aSet("2026-10-13", { load_kg: 80, reps: 5 });
    const sets = [
      aSet("2026-10-12", { load_kg: 60 }),
      heaviest,
      aSet("2026-10-14", { load_kg: 70 }),
    ];

    expect(bestSetPerWeek(sets)).toEqual([heaviest]);
  });

  it("should give a tie on load to the higher reps", () => {
    const best = aSet("2026-10-13", { load_kg: 80, reps: 7 });

    expect(bestSetPerWeek([aSet("2026-10-12", { load_kg: 80, reps: 5 }), best])).toEqual([best]);
  });

  it("should keep one set per exercise and week, oldest week first", () => {
    const sets = [
      aSet("2026-10-19", { exercise_id: "row" }),
      aSet("2026-10-12", { exercise_id: "bench" }),
      aSet("2026-10-13", { exercise_id: "row", load_kg: 50 }),
      aSet("2026-10-20", { exercise_id: "bench", load_kg: 65 }),
    ];

    expect(
      bestSetPerWeek(sets).map(({ exercise_id, local_date }) => [exercise_id, local_date]),
    ).toEqual([
      ["bench", "2026-10-12"],
      ["row", "2026-10-13"],
      ["row", "2026-10-19"],
      ["bench", "2026-10-20"],
    ]);
  });

  it("should read a load of null and 0 as no load, and keep the best reps then", () => {
    const best = aSet("2026-10-13", { load_kg: 0, reps: 14 });

    expect(bestSetPerWeek([aSet("2026-10-12", { load_kg: null, reps: 10 }), best])).toEqual([best]);
  });

  it("should leave out a warm-up, a deleted set and a set of a deleted session", () => {
    const sets = [
      aSet("2026-10-12", { set_type: "warmup", load_kg: 100 }),
      aSet("2026-10-12", { load_kg: 110, deleted_at: "2026-10-13T09:00:00Z" }),
      aSet("2026-10-12", { load_kg: 120, session_deleted_at: "2026-10-13T09:00:00Z" }),
      aSet("2026-10-12", { load_kg: 60 }),
    ];

    expect(bestSetPerWeek(sets)).toEqual([sets[3]]);
  });

  it("should give nothing for no sets", () => {
    expect(bestSetPerWeek([])).toEqual([]);
  });

  it("should throw a RangeError, with no value in it, for a local date that is not a day", () => {
    expect(() => bestSetPerWeek([aSet("2026-13-40", { load_kg: 123.5 })])).toThrow(
      new RangeError("A set's local date must be a calendar day written YYYY-MM-DD"),
    );
  });

  it("should leave the trend exactly as the whole list of sets gives it (property)", () => {
    const options = { range: "3m", now: "2026-10-20T12:00:00Z", timeZone: "UTC" } as const;
    const anySet = fc.record({
      dayOffset: fc.integer({ min: 0, max: 100 }),
      loadKg: fc.constantFrom(null, 0, 20, 40, 42.5, 60),
      reps: fc.integer({ min: 1, max: 15 }),
      setType: fc.constantFrom("working", "warmup", "drop", "failure"),
    });
    const toSet = (row: {
      dayOffset: number;
      loadKg: number | null;
      reps: number;
      setType: TrendSet["set_type"];
    }) =>
      aSet(new Date(Date.UTC(2026, 6, 13 + row.dayOffset)).toISOString().slice(0, 10), {
        load_kg: row.loadKg,
        reps: row.reps,
        set_type: row.setType,
      });

    fc.assert(
      fc.property(fc.array(anySet, { maxLength: 60 }), (rows) => {
        const sets = rows.map(toSet);
        expect(exerciseWeeklyTrend(bestSetPerWeek(sets), options)).toEqual(
          exerciseWeeklyTrend(sets, options),
        );
        expect(bestSetPerWeek(sets).length).toBeLessThanOrEqual(sets.length);
      }),
    );
  });
});
