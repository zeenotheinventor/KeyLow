import { PROGRAM_CHART, describeExpenditureChartSummary } from "../copy";
import { formatCalories } from "../format";

import type { ExpenditureChartWeek } from "./chartWeeks";

/** What the chart is given: one point and one band for each week, oldest first, and the sentence that names it. */
export type ExpenditureChartView = {
  label: string;
  unit: string;
  /** One point for each week. A null value is a week with no estimate, which breaks the line. */
  points: readonly { week: string; value: number | null }[];
  /** The likely range of each week, a null for a week with no estimate. */
  band: readonly ({ low: number; high: number } | null)[];
  legend: { line: string; band: string };
  /** "Estimated expenditure over 5 weeks: ...", which is the chart's accessible name and is written under it. */
  summary: string;
  /** Writes an axis value to the nearest 10 with a thousands separator: "2,980". */
  formatValue: (kcal: number) => string;
};

const AXIS_STEP_KCAL = 10;

const formatAxisKcal = (kcal: number): string =>
  formatCalories(Math.round(kcal / AXIS_STEP_KCAL) * AXIS_STEP_KCAL);

/**
 * The chart's points, bands and sentence from the weeks `expenditureChartWeeks` gives. A week with no estimate
 * has no value and no band, which breaks the line and the band. The sentence reads from the first estimate to
 * the newest, and is the starting-estimate wording while the newest is a start snapshot. Null when no week has
 * an estimate.
 */
export function buildExpenditureChartView(
  weeks: readonly ExpenditureChartWeek[],
): ExpenditureChartView | null {
  const first = weeks.find((week) => week.band !== null);
  const latest = weeks.filter((week) => week.band !== null).at(-1);
  if (first?.band == null || latest?.band == null) {
    return null;
  }

  return {
    label: PROGRAM_CHART.label,
    unit: PROGRAM_CHART.unit,
    points: weeks.map((week) => ({ week: week.week, value: week.band?.muKcal ?? null })),
    band: weeks.map((week) =>
      week.band === null ? null : { low: week.band.lowKcal, high: week.band.highKcal },
    ),
    legend: { line: PROGRAM_CHART.legend.estimate, band: PROGRAM_CHART.legend.band },
    summary: describeExpenditureChartSummary({
      weekCount: weeks.length,
      firstWeekStart: first.week,
      firstMuKcal: first.band.muKcal,
      latest: latest.band,
      isSettling: latest.kind === "start",
    }),
    formatValue: formatAxisKcal,
  };
}
