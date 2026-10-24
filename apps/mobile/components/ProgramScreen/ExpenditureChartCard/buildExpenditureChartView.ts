import { PROGRAM_CHART, describeExpenditureChartSummary } from "@keylow/core/copy";
import { formatCalories } from "@keylow/core/format";

import type { ExpenditureChartView } from "./types";
import type { ExpenditureChartWeek } from "@keylow/core/program";

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
  const latest = weeks.findLast((week) => week.band !== null);
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
