import * as copy from "../../../src/copy";
import { exerciseWeeklyTrend } from "../../../src/training";

import type { TrendSet } from "../../../src/training";

const aSet = (localDate: string, loadKg: number | null, reps: number): TrendSet => ({
  set_type: "working",
  reps,
  load_kg: loadKg,
  deleted_at: null,
  local_date: localDate,
  session_deleted_at: null,
});

const trendOf = (sets: TrendSet[]) =>
  exerciseWeeklyTrend(sets, { range: "4w", now: "2026-10-20T12:00:00Z", timeZone: "UTC" });

const rising = trendOf([aSet("2026-10-05", 60, 8), aSet("2026-10-19", 62.5, 6)]);
const gap = trendOf([aSet("2026-10-05", 60, 8), aSet("2026-10-12", 65, 6)]);

// The sentences each function of the exercise progress copy can print, for the voice test's sweep.
export const samples: Record<string, () => string[]> = {
  describeTrendWeek: () => [
    copy.describeTrendWeek({ loadKg: 62.5, reps: 6 }, "kg"),
    copy.describeTrendWeek({ loadKg: 62.5, reps: 6 }, "lb"),
    copy.describeTrendWeek({ loadKg: null, reps: 12 }, "kg"),
  ],
  describeProgressRow: () =>
    [rising, gap, trendOf([]), trendOf([aSet("2026-10-19", null, 12)])].flatMap((trend) => {
      const row = copy.describeProgressRow({ name: "Bench press", trend, unit: "kg" });
      return [row.line, row.accessibleName, ...(row.change === null ? [] : [row.change.text])];
    }),
  describeProgressWeek: () =>
    rising.weeks.flatMap((entry) => {
      const week = copy.describeProgressWeek(entry, "lb");
      return [
        week.weekLabel,
        week.accessibleName,
        ...(week.value === null ? [] : [week.value]),
        ...(week.change === null ? [] : [week.change.text]),
      ];
    }),
  describeProgressChartSummary: () => [
    copy.describeProgressChartSummary({ name: "Bench press", trend: rising, unit: "kg" }),
    copy.describeProgressChartSummary({
      name: "Bench press",
      trend: trendOf([aSet("2026-10-19", 60, 8)]),
      unit: "lb",
    }),
    copy.describeProgressChartSummary({ name: "Bench press", trend: trendOf([]), unit: "kg" }),
  ],
};
