import type { LineChartBand, LineChartLegend, LineChartPoint } from "../../ui";

/** What the chart is given: one point and one band for each week, oldest first, and the sentence that names it. */
export type ExpenditureChartView = {
  label: string;
  unit: string;
  points: readonly LineChartPoint[];
  /** The likely range of each week, a null for a week with no estimate. */
  band: readonly LineChartBand[];
  legend: LineChartLegend;
  /** "Estimated expenditure over 5 weeks: ...", which is the chart's accessible name and is written under it. */
  summary: string;
  /** Writes an axis value to the nearest 10 with a thousands separator: "2,980". */
  formatValue: (kcal: number) => string;
};

/** The card's four states. It draws nothing while the history is being read. */
export type ExpenditureChartState =
  | { status: "pending" }
  | { status: "error"; retry: () => void }
  | { status: "empty" }
  | { status: "chart"; view: ExpenditureChartView };
