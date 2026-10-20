import { describe, expect, it } from "vitest";

import { samples } from "./samples/exerciseProgress";
import {
  EXERCISE_PROGRESS,
  ROUTINE_PROGRESS,
  describeProgressChartSummary,
  describeProgressRow,
  describeProgressWeek,
  describeTrendWeek,
} from "../../src/copy";
import { exerciseWeeklyTrend } from "../../src/training";

import type { TrendRange, TrendSet } from "../../src/training";

// Tuesday 20 October 2026. The weeks are Monday 28 Sep, 5, 12 and 19 Oct.
const NOW = "2026-10-20T12:00:00Z";

const aSet = (localDate: string, loadKg: number | null, reps: number): TrendSet => ({
  set_type: "working",
  reps,
  load_kg: loadKg,
  deleted_at: null,
  local_date: localDate,
  session_deleted_at: null,
});

const trendOf = (sets: TrendSet[], range: TrendRange = "4w") =>
  exerciseWeeklyTrend(sets, { range, now: NOW, timeZone: "UTC" });

describe("the words of the progress screens", () => {
  it("should hold the section heading and the gap line of the Routines page", () => {
    expect(ROUTINE_PROGRESS).toEqual({
      heading: "Progress",
      notTrainedThisWeek: "Not trained this week",
    });
  });

  it("should hold the words of the graph screen", () => {
    expect(EXERCISE_PROGRESS).toEqual({
      fallbackTitle: "Exercise progress",
      backLabel: "Back to Routines",
      loadingName: "Loading progress",
      rangeLabel: "Range",
      ranges: { "4w": "4 weeks", "3m": "3 months", "1y": "1 year" },
      weeksHeading: "Weeks",
      notTrained: "Not trained",
      secondWeekNeeded: "Train this exercise in a second week to see a change.",
      empty: {
        title: "No sets logged yet",
        body: "Log a working set of this exercise and its weekly progress shows here.",
      },
    });
  });
});

describe("describeTrendWeek", () => {
  it("should write a loaded week as the load for the reps", () => {
    expect(describeTrendWeek({ loadKg: 60, reps: 8 }, "kg")).toBe("60 kg for 8 reps");
    expect(describeTrendWeek({ loadKg: 62.5, reps: 1 }, "kg")).toBe("62.5 kg for 1 rep");
  });

  it("should write the load in pounds from the stored kilograms", () => {
    expect(describeTrendWeek({ loadKg: 100, reps: 5 }, "lb")).toBe("220.5 lb for 5 reps");
  });

  it("should write a week with no load as its reps alone", () => {
    expect(describeTrendWeek({ loadKg: null, reps: 12 }, "kg")).toBe("12 reps");
  });
});

describe("describeProgressRow", () => {
  it("should name the value, the reps and the rise on the last trained week", () => {
    const trend = trendOf([aSet("2026-10-12", 60, 8), aSet("2026-10-19", 65, 8)]);

    expect(describeProgressRow({ name: "Bench press", trend, unit: "kg" })).toEqual({
      line: "65 kg for 8 reps",
      change: { text: "+5 kg", direction: "up" },
      accessibleName: "Bench press, 65 kg for 8 reps, up 5 kg on the last trained week",
    });
  });

  it("should write a fall with the true minus sign and name it as down", () => {
    const trend = trendOf([aSet("2026-10-12", 65, 8), aSet("2026-10-19", 60, 8)]);
    const row = describeProgressRow({ name: "Bench press", trend, unit: "kg" });

    expect(row.change).toEqual({ text: "−5 kg", direction: "down" });
    expect(row.accessibleName).toBe(
      "Bench press, 60 kg for 8 reps, down 5 kg on the last trained week",
    );
  });

  it("should name a reps change when the load is equal", () => {
    const trend = trendOf([aSet("2026-10-12", 60, 8), aSet("2026-10-19", 60, 10)]);
    const row = describeProgressRow({ name: "Bench press", trend, unit: "kg" });

    expect(row.change).toEqual({ text: "+2 reps", direction: "up" });
    expect(row.accessibleName).toBe(
      "Bench press, 60 kg for 10 reps, up 2 reps on the last trained week",
    );
  });

  it("should compare a week after a gap with the last trained week", () => {
    const trend = trendOf([aSet("2026-10-05", 60, 8), aSet("2026-10-19", 62.5, 8)]);

    expect(describeProgressRow({ name: "Bench press", trend, unit: "kg" }).change).toEqual({
      text: "+2.5 kg",
      direction: "up",
    });
  });

  it("should show no change for an unchanged week, and for a first week", () => {
    const same = trendOf([aSet("2026-10-12", 60, 8), aSet("2026-10-19", 60, 8)]);
    const first = trendOf([aSet("2026-10-19", 60, 8)]);

    expect(describeProgressRow({ name: "Row", trend: same, unit: "kg" })).toEqual({
      line: "60 kg for 8 reps",
      change: null,
      accessibleName: "Row, 60 kg for 8 reps",
    });
    expect(describeProgressRow({ name: "Row", trend: first, unit: "kg" }).change).toBeNull();
  });

  it("should say not trained this week, with the last value, when this week is a gap", () => {
    const trend = trendOf([aSet("2026-10-05", 60, 8), aSet("2026-10-12", 65, 6)]);

    expect(describeProgressRow({ name: "Bench press", trend, unit: "kg" })).toEqual({
      line: "Not trained this week, last 65 kg for 6 reps",
      change: null,
      accessibleName: "Bench press, not trained this week, last 65 kg for 6 reps",
    });
  });

  it("should say not trained yet for an exercise with no set in the range", () => {
    expect(describeProgressRow({ name: "Bench press", trend: trendOf([]), unit: "kg" })).toEqual({
      line: "Not trained yet",
      change: null,
      accessibleName: "Bench press, not trained yet",
    });
  });

  it("should show pounds, and the change as the difference of the values shown", () => {
    const trend = trendOf([aSet("2026-10-12", 50, 8), aSet("2026-10-19", 50.1, 8)]);
    const row = describeProgressRow({ name: "Row", trend, unit: "lb" });

    expect(row.line).toBe("110.5 lb for 8 reps");
    expect(row.change).toEqual({ text: "+0.3 lb", direction: "up" });
  });
});

describe("describeProgressWeek", () => {
  const trend = trendOf([aSet("2026-10-05", 60, 8), aSet("2026-10-19", 62.5, 6)]);
  const [, fiveOct, twelveOct, nineteenOct] = trend.weeks;

  it("should write the week start, the value and the change of a trained week", () => {
    expect(nineteenOct && describeProgressWeek(nineteenOct, "kg")).toEqual({
      weekLabel: "Mon 19 Oct",
      value: "62.5 kg for 6 reps",
      change: { text: "+2.5 kg", direction: "up" },
      accessibleName: "Mon 19 Oct, 62.5 kg for 6 reps, +2.5 kg",
    });
  });

  it("should write the first week as a change in words, with no direction", () => {
    expect(fiveOct && describeProgressWeek(fiveOct, "kg")).toEqual({
      weekLabel: "Mon 5 Oct",
      value: "60 kg for 8 reps",
      change: { text: "First week", direction: null },
      accessibleName: "Mon 5 Oct, 60 kg for 8 reps, First week",
    });
  });

  it("should write a skipped week as not trained", () => {
    expect(twelveOct && describeProgressWeek(twelveOct, "kg")).toEqual({
      weekLabel: "Mon 12 Oct",
      value: null,
      change: null,
      accessibleName: "Mon 12 Oct, Not trained",
    });
  });

  it("should write no change in words for an unchanged week", () => {
    const unchanged = trendOf([aSet("2026-10-12", 60, 8), aSet("2026-10-19", 60, 8)]).weeks.at(-1);

    expect(unchanged && describeProgressWeek(unchanged, "kg").change).toEqual({
      text: "No change",
      direction: null,
    });
  });
});

describe("describeProgressChartSummary", () => {
  it("should say the weeks and the first and last values trained", () => {
    const trend = trendOf([aSet("2026-10-05", 55, 8), aSet("2026-10-19", 62.5, 6)]);

    expect(describeProgressChartSummary({ name: "Bench press", trend, unit: "kg" })).toBe(
      "Bench press, 4 weeks, from 55 kg to 62.5 kg",
    );
  });

  it("should say the one value for a single trained week", () => {
    const trend = trendOf([aSet("2026-10-19", 55, 8)]);

    expect(describeProgressChartSummary({ name: "Bench press", trend, unit: "kg" })).toBe(
      "Bench press, 4 weeks, 55 kg in one week",
    );
  });
});

describe("the sweep samples", () => {
  it("should print a sentence for every sample", () => {
    for (const sentence of Object.values(samples).flatMap((call) => call())) {
      expect(sentence.trim()).not.toBe("");
    }
  });
});
