import * as copy from "../../../src/copy";
import { collectStrings } from "../collectStrings";

// Every function `src/copy/weight.ts` exports, called with representative arguments. The voice test fails
// when a function has no row, so no sentence escapes the sweep.
const today = "2026-10-17";
const instant = new Date("2026-10-17T07:15:00Z");
const timeZone = "Europe/London";
const row = {
  localDate: today,
  today,
  measuredAt: instant,
  timeZone,
  source: "manual",
  weightKg: 81.6,
  rejected: false,
};
const trendLine = { lastKg: 81.6, lastLocalDate: today, today, weeklyRateKg: -0.34 };

export const samples: Record<string, () => string[]> = {
  describeChartName: () => [copy.describeChartName(7, 83.1), copy.describeChartName(365, 83.1)],
  describeRateBadge: () => [
    copy.describeRateBadge(-0.34),
    copy.describeRateBadge(0.4),
    copy.describeRateBadge(0.04),
  ],
  describeSettlingLine: () => [copy.describeSettlingLine(0), copy.describeSettlingLine(3)],
  describeChartDate: () => [copy.describeChartDate("2026-10-10")],
  describeTrendLine: () => [
    copy.describeTrendLine(trendLine),
    copy.describeTrendLine({ ...trendLine, weeklyRateKg: 0.4 }),
    copy.describeTrendLine({ ...trendLine, weeklyRateKg: 0.04 }),
    copy.describeTrendLine({ ...trendLine, weeklyRateKg: null }),
    copy.describeTrendLine({ ...trendLine, lastLocalDate: "2026-10-16" }),
    copy.describeTrendLine({ ...trendLine, lastLocalDate: "2026-10-10" }),
  ],
  describeWeighInRow: () => [
    ...collectStrings(copy.describeWeighInRow(row)),
    ...collectStrings(copy.describeWeighInRow({ ...row, source: "health_connect" })),
  ],
  describeLastImport: () =>
    [0, 2, 90, 1440, 3000].map((minutesAgo) => copy.describeLastImport(minutesAgo)),
  describeWeightProblem: () =>
    (["empty", "not-a-number", "too-many-decimals", "too-low", "too-high"] as const).flatMap(
      (reason) => collectStrings(copy.describeWeightProblem(reason)),
    ),
  describeSheetDate: () => [
    copy.describeSheetDate(instant, today, timeZone),
    copy.describeSheetDate(instant, today, timeZone, { imported: true }),
  ],
  describeSheetTime: () => [copy.describeSheetTime(instant, timeZone)],
  describeImportedCount: () => [copy.describeImportedCount(1), copy.describeImportedCount(64)],
  describeSettlingBanner: () => [copy.describeSettlingBanner(3)],
};
