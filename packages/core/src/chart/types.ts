import type { BandEnds } from "./linePlot";

/** One week of a trend. A `null` value is a skipped week: the line breaks there and the week has no point. */
export type LineChartPoint = {
  /** The Monday the week starts on, as `YYYY-MM-DD`. */
  week: string;
  value: number | null;
};

/** The likely range of a week, from `low` to `high`. `null` is a week with no range: the band breaks there. */
export type LineChartBand = BandEnds | null;

/** The words of the legend under the chart, which the caller writes because they are copy. */
export type LineChartLegend = {
  /** What the line is, such as "Estimate". */
  line: string;
  /** What the shaded band is, such as "Likely range". */
  band: string;
};
