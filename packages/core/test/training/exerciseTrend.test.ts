import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { TREND_RANGES, TREND_RANGE_WEEKS, exerciseWeeklyTrend } from "../../src/training";

import type { TrendEntry, TrendSet } from "../../src/training";

// 2026-10-20 is a Tuesday. Its week starts on Monday 19 Oct; the weeks before it start on 12 Oct, 5 Oct,
// 28 Sep and 21 Sep.
const NOW = "2026-10-20T12:00:00Z";
const options = { range: "4w", now: NOW, timeZone: "UTC" } as const;

const aSet = (localDate: string, overrides: Partial<TrendSet> = {}): TrendSet => ({
  set_type: "working",
  reps: 8,
  load_kg: 60,
  deleted_at: null,
  local_date: localDate,
  session_deleted_at: null,
  ...overrides,
});

const weekOf = (sets: TrendSet[], weekStart: string, extra: { timeZone?: string } = {}) =>
  exerciseWeeklyTrend(sets, { ...options, ...extra }).weeks.find(
    (entry) => entry.weekStart === weekStart,
  );

describe("the ranges", () => {
  it("should name the three ranges and their lengths in weeks, the current week included", () => {
    expect(TREND_RANGES).toEqual(["4w", "3m", "1y"]);
    expect(TREND_RANGE_WEEKS).toEqual({ "4w": 4, "3m": 13, "1y": 52 });
  });

  it("should give one entry per week, oldest first, the week of now last", () => {
    for (const range of TREND_RANGES) {
      const { weeks } = exerciseWeeklyTrend([], { ...options, range });

      expect(weeks).toHaveLength(TREND_RANGE_WEEKS[range]);
      expect(weeks.at(-1)?.weekStart).toBe("2026-10-19");
    }
    expect(exerciseWeeklyTrend([], options).weeks.map((entry) => entry.weekStart)).toEqual([
      "2026-09-28",
      "2026-10-05",
      "2026-10-12",
      "2026-10-19",
    ]);
  });

  it("should start the year on the Monday 51 weeks before this week's Monday", () => {
    const { weeks } = exerciseWeeklyTrend([], { ...options, range: "1y" });

    expect(weeks[0]?.weekStart).toBe("2025-10-27");
  });

  it("should end the week on Sunday, so Sunday night is still the same week", () => {
    expect(
      exerciseWeeklyTrend([], { ...options, now: "2026-10-25T23:00:00Z" }).weeks.at(-1)?.weekStart,
    ).toBe("2026-10-19");
    expect(
      exerciseWeeklyTrend([], { ...options, now: "2026-10-26T00:00:00Z" }).weeks.at(-1)?.weekStart,
    ).toBe("2026-10-26");
  });

  it("should read now as a day in the profile zone, so just after midnight ahead of UTC is a new week", () => {
    // 23:30 UTC on Sunday 18 Oct is 12:30 on Monday 19 Oct in Auckland.
    const now = "2026-10-18T23:30:00Z";

    expect(exerciseWeeklyTrend([], { ...options, now }).weeks.at(-1)?.weekStart).toBe("2026-10-12");
    expect(
      exerciseWeeklyTrend([], { ...options, now, timeZone: "Pacific/Auckland" }).weeks.at(-1)
        ?.weekStart,
    ).toBe("2026-10-19");
  });
});

describe("the golden exercise", () => {
  // Week 1 to 5 of the ticket, on the last five weeks of a 13 week range. Week 4 is skipped.
  const golden = [
    aSet("2026-09-22", { load_kg: 60, reps: 8 }),
    aSet("2026-09-29", { load_kg: 60, reps: 10 }),
    aSet("2026-10-06", { load_kg: 62.5, reps: 6 }),
    aSet("2026-10-20", { load_kg: 60, reps: 8 }),
  ];
  const trend = exerciseWeeklyTrend(golden, { ...options, range: "3m" });
  const lastFive = trend.weeks.slice(-5);

  it("should give each week its heaviest set and a gap for the skipped week", () => {
    expect(lastFive.map((entry) => entry.value)).toEqual([
      { loadKg: 60, reps: 8 },
      { loadKg: 60, reps: 10 },
      { loadKg: 62.5, reps: 6 },
      null,
      { loadKg: 60, reps: 8 },
    ]);
  });

  it("should give the first week no change, then +2 reps, +2.5 kg, a gap, then -2.5 kg against week 3", () => {
    expect(lastFive.map((entry) => entry.change)).toEqual([
      { kind: "first" },
      { kind: "reps", repsChange: 2 },
      { kind: "load", previousLoadKg: 60, latestLoadKg: 62.5, repsChange: -4 },
      null,
      { kind: "load", previousLoadKg: 62.5, latestLoadKg: 60, repsChange: 2 },
    ]);
  });

  it("should give weeks before the first set a gap, with no value and no change", () => {
    expect(trend.weeks.slice(0, 8).map(({ value, change }) => [value, change])).toEqual(
      Array.from({ length: 8 }, () => [null, null]),
    );
  });

  it("should name the latest trained week", () => {
    expect(trend.latest?.weekStart).toBe("2026-10-19");
  });
});

describe("the value of a week", () => {
  it("should take the heaviest load of the week with the reps of that set", () => {
    const sets = [
      aSet("2026-10-12", { load_kg: 60, reps: 12 }),
      aSet("2026-10-13", { load_kg: 80, reps: 5 }),
      aSet("2026-10-14", { load_kg: 70, reps: 10 }),
    ];

    expect(weekOf(sets, "2026-10-12")?.value).toEqual({ loadKg: 80, reps: 5 });
  });

  it("should give a tie on load to the higher reps", () => {
    const sets = [
      aSet("2026-10-12", { load_kg: 80, reps: 5 }),
      aSet("2026-10-12", { load_kg: 80, reps: 7 }),
      aSet("2026-10-13", { load_kg: 80, reps: 6 }),
    ];

    expect(weekOf(sets, "2026-10-12")?.value).toEqual({ loadKg: 80, reps: 7 });
  });

  it("should never count a warm-up, and a heavier warm-up never wins", () => {
    const sets = [
      aSet("2026-10-12", { set_type: "warmup", load_kg: 100, reps: 3 }),
      aSet("2026-10-12", { load_kg: 60, reps: 8 }),
    ];

    expect(weekOf(sets, "2026-10-12")?.value).toEqual({ loadKg: 60, reps: 8 });
  });

  it("should leave a week of warm-ups only a gap, not a value", () => {
    const sets = [aSet("2026-10-12", { set_type: "warmup", load_kg: 40 })];

    expect(weekOf(sets, "2026-10-12")).toEqual({
      weekStart: "2026-10-12",
      value: null,
      change: null,
    });
  });

  it("should count drop and failure sets as working sets", () => {
    const sets = [
      aSet("2026-10-12", { set_type: "working", load_kg: 60 }),
      aSet("2026-10-12", { set_type: "failure", load_kg: 65, reps: 4 }),
      aSet("2026-10-19", { set_type: "drop", load_kg: 40, reps: 15 }),
    ];

    expect(weekOf(sets, "2026-10-12")?.value).toEqual({ loadKg: 65, reps: 4 });
    expect(weekOf(sets, "2026-10-19")?.value).toEqual({ loadKg: 40, reps: 15 });
  });

  it("should never count a deleted set or a set of a deleted session", () => {
    const sets = [
      aSet("2026-10-12", { load_kg: 100, deleted_at: "2026-10-13T09:00:00Z" }),
      aSet("2026-10-13", { load_kg: 110, session_deleted_at: "2026-10-14T09:00:00Z" }),
      aSet("2026-10-14", { load_kg: 60 }),
    ];

    expect(weekOf(sets, "2026-10-12")?.value?.loadKg).toBe(60);
  });

  it("should count the sets of sessions of any routine, a free session and an open session alike", () => {
    // The function knows nothing of routines or of whether a session ended: every set given counts.
    const sets = [aSet("2026-10-12", { load_kg: 70 }), aSet("2026-10-14", { load_kg: 75 })];

    expect(weekOf(sets, "2026-10-12")?.value?.loadKg).toBe(75);
  });

  it("should put a set in the week of its session's local date, whatever zone the clock is in", () => {
    // A session at 00:30 local on Monday 19 Oct in Auckland is still Sunday 18 Oct in UTC. Its local
    // date is the 19th, so it is in that Monday's week in both.
    const sets = [aSet("2026-10-19", { load_kg: 90 })];

    expect(weekOf(sets, "2026-10-19")?.value?.loadKg).toBe(90);
    expect(weekOf(sets, "2026-10-19", { timeZone: "Pacific/Auckland" })?.value?.loadKg).toBe(90);
    expect(weekOf(sets, "2026-10-12")?.value).toBeNull();
  });

  it("should leave out sets of weeks after the current one", () => {
    const sets = [aSet("2026-10-26")];

    expect(exerciseWeeklyTrend(sets, options).weeks.every((entry) => entry.value === null)).toBe(
      true,
    );
  });
});

describe("weeks with no load", () => {
  it("should read a load of null or 0 as no load and keep the best reps, as a reps-only week", () => {
    const sets = [
      aSet("2026-10-12", { load_kg: null, reps: 10 }),
      aSet("2026-10-13", { load_kg: 0, reps: 14 }),
      aSet("2026-10-14", { load_kg: null, reps: 12 }),
    ];

    expect(weekOf(sets, "2026-10-12")?.value).toEqual({ loadKg: null, reps: 14 });
  });

  it("should let a loaded set win over bodyweight sets of the same week (a mixed week)", () => {
    const sets = [
      aSet("2026-10-12", { load_kg: null, reps: 15 }),
      aSet("2026-10-13", { load_kg: 10, reps: 5 }),
    ];

    expect(weekOf(sets, "2026-10-12")?.value).toEqual({ loadKg: 10, reps: 5 });
  });

  it("should compare reps only between reps-only weeks", () => {
    const sets = [
      aSet("2026-10-06", { load_kg: null, reps: 12 }),
      aSet("2026-10-13", { load_kg: 0, reps: 10 }),
    ];

    expect(weekOf(sets, "2026-10-12")?.change).toEqual({ kind: "reps", repsChange: -2 });
  });

  it("should call a move from a reps-only week to a loaded week a load change from no load", () => {
    const sets = [
      aSet("2026-10-06", { load_kg: null, reps: 12 }),
      aSet("2026-10-13", { load_kg: 10, reps: 8 }),
    ];

    expect(weekOf(sets, "2026-10-12")?.change).toEqual({
      kind: "load",
      previousLoadKg: null,
      latestLoadKg: 10,
      repsChange: -4,
    });
  });
});

describe("the change", () => {
  it("should compare with the last week trained, not the week before, when weeks were skipped", () => {
    const sets = [aSet("2026-09-29", { load_kg: 60 }), aSet("2026-10-20", { load_kg: 67.5 })];

    expect(weekOf(sets, "2026-10-19")?.change).toMatchObject({
      kind: "load",
      previousLoadKg: 60,
      latestLoadKg: 67.5,
    });
  });

  it("should show the load change first, with the reps change beside it", () => {
    const sets = [
      aSet("2026-10-06", { load_kg: 80, reps: 8 }),
      aSet("2026-10-13", { load_kg: 75, reps: 10 }),
    ];

    expect(weekOf(sets, "2026-10-12")?.change).toEqual({
      kind: "load",
      previousLoadKg: 80,
      latestLoadKg: 75,
      repsChange: 2,
    });
  });

  it("should show the reps change when the load is equal", () => {
    const sets = [
      aSet("2026-10-06", { load_kg: 80, reps: 6 }),
      aSet("2026-10-13", { load_kg: 80, reps: 8 }),
    ];

    expect(weekOf(sets, "2026-10-12")?.change).toEqual({ kind: "reps", repsChange: 2 });
  });

  it("should say the same, not a change of 0, when the load and the reps are equal", () => {
    const sets = [aSet("2026-10-06"), aSet("2026-10-13")];

    expect(weekOf(sets, "2026-10-12")?.change).toEqual({ kind: "same" });
  });

  it("should not let a warm-up make a week count as trained for the comparison", () => {
    const sets = [
      aSet("2026-10-06", { load_kg: 60 }),
      aSet("2026-10-13", { set_type: "warmup", load_kg: 100 }),
      aSet("2026-10-20", { load_kg: 62.5 }),
    ];

    expect(weekOf(sets, "2026-10-19")?.change).toMatchObject({ kind: "load", previousLoadKg: 60 });
  });

  it("should say first for the only trained week when the earlier training was all deleted", () => {
    const sets = [aSet("2026-09-29", { deleted_at: "2026-10-01T09:00:00Z" }), aSet("2026-10-13")];

    expect(weekOf(sets, "2026-10-12")?.change).toEqual({ kind: "first" });
  });

  it("should read the first week's change against the earlier week, which is not in the series", () => {
    const earlier = [aSet("2026-08-04", { load_kg: 50 })];
    const sets = [aSet("2026-09-29", { load_kg: 55 })];

    const trend = exerciseWeeklyTrend(sets, { ...options, earlier });

    expect(trend.weeks).toHaveLength(4);
    expect(trend.weeks[0]?.change).toMatchObject({
      kind: "load",
      previousLoadKg: 50,
      latestLoadKg: 55,
    });
  });

  it("should say first for the first week when no earlier sets are given", () => {
    expect(weekOf([aSet("2026-09-29")], "2026-09-28")?.change).toEqual({ kind: "first" });
  });

  it("should use the best earlier week and not an earlier warm-up or deleted set", () => {
    const earlier = [
      aSet("2026-08-04", { set_type: "warmup", load_kg: 120 }),
      aSet("2026-08-05", { load_kg: 130, session_deleted_at: "2026-08-06T09:00:00Z" }),
      aSet("2026-07-07", { load_kg: 45 }),
    ];

    expect(
      exerciseWeeklyTrend([aSet("2026-09-29", { load_kg: 55 })], { ...options, earlier }).weeks[0]
        ?.change,
    ).toMatchObject({ previousLoadKg: 45 });
  });
});

describe("the change of every entry (property)", () => {
  type WeekSetRow = {
    weekIndex: number;
    loadKg: number | null;
    reps: number;
    setType: TrendSet["set_type"];
  };

  const weekSet: fc.Arbitrary<WeekSetRow> = fc.record({
    weekIndex: fc.integer({ min: 0, max: 12 }),
    loadKg: fc.constantFrom(null, 0, 20, 40, 42.5, 60),
    reps: fc.integer({ min: 1, max: 15 }),
    setType: fc.constantFrom("working", "warmup", "drop", "failure"),
  });

  const sets = (rows: WeekSetRow[]): TrendSet[] =>
    rows.map(({ weekIndex, loadKg, reps, setType }) => {
      const monday = new Date(Date.UTC(2026, 6, 27 + weekIndex * 7));
      return aSet(monday.toISOString().slice(0, 10), {
        load_kg: loadKg,
        reps,
        set_type: setType,
      });
    });

  const trained = (weeks: readonly TrendEntry[]) =>
    weeks.filter((entry): entry is Extract<TrendEntry, { value: object }> => entry.value !== null);

  it("should make each change the difference of the value and the previous trained value", () => {
    fc.assert(
      fc.property(fc.array(weekSet, { maxLength: 40 }), (rows) => {
        const { weeks } = exerciseWeeklyTrend(sets(rows), { ...options, range: "3m" });
        const entries = trained(weeks);

        entries.forEach((entry, index) => {
          const previous = entries[index - 1];
          if (previous === undefined) {
            expect(entry.change).toEqual({ kind: "first" });
            return;
          }
          const repsChange = entry.value.reps - previous.value.reps;
          const loadChange = (entry.value.loadKg ?? 0) - (previous.value.loadKg ?? 0);
          if (loadChange !== 0) {
            expect(entry.change).toEqual({
              kind: "load",
              previousLoadKg: previous.value.loadKg,
              latestLoadKg: entry.value.loadKg,
              repsChange,
            });
          } else {
            expect(entry.change).toEqual(
              repsChange === 0 ? { kind: "same" } : { kind: "reps", repsChange },
            );
          }
        });
      }),
    );
  });

  it("should give a gap exactly where the week has no working set", () => {
    fc.assert(
      fc.property(fc.array(weekSet, { maxLength: 40 }), (rows) => {
        const { weeks } = exerciseWeeklyTrend(sets(rows), { ...options, range: "3m" });
        const workingWeeks = new Set(
          sets(rows)
            .filter((set) => set.set_type !== "warmup")
            .map((set) => set.local_date),
        );

        for (const entry of weeks) {
          expect(entry.value !== null).toBe(workingWeeks.has(entry.weekStart));
          expect(entry.change === null).toBe(entry.value === null);
        }
      }),
    );
  });
});

describe("the input rules", () => {
  it("should throw a RangeError naming the rule for a now with no zone", () => {
    expect(() => exerciseWeeklyTrend([], { ...options, now: "2026-10-20T12:00:00" })).toThrow(
      new RangeError("A trend's now must be an ISO timestamp with a zone"),
    );
  });

  it("should throw a RangeError for a time zone that is not an IANA zone", () => {
    expect(() => exerciseWeeklyTrend([], { ...options, timeZone: "Mars/Base" })).toThrow(
      new RangeError("A trend's time zone must be an IANA zone name"),
    );
  });

  it("should throw a RangeError that holds no value for a set date that is not a calendar day", () => {
    const sets = [aSet("2026-13-40", { load_kg: 123.5, reps: 11 })];

    expect(() => exerciseWeeklyTrend(sets, options)).toThrow(
      new RangeError("A set's local date must be a calendar day written YYYY-MM-DD"),
    );
    expect(() => exerciseWeeklyTrend([], { ...options, earlier: sets })).toThrow(RangeError);
  });
});
