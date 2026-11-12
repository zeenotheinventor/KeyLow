import type { LineChartBand, LineChartLegend, LineChartPoint } from "@keylow/core/chart";

export type { LineChartBand, LineChartLegend, LineChartPoint };

export type LineChartProps = {
  /** One point for each week, oldest first. */
  points: readonly LineChartPoint[];
  /** The unit, written once beside the label, such as "kg". */
  unit: string;
  /** What the chart shows, written above it, such as "Barbell row". */
  label: string;
  /**
   * What a screen reader says for the whole chart. The chart is one image named by this, and it is also
   * written under the chart. The caller writes it, because the words are copy and the numbers are the screen's.
   */
  summary: string;
  /** How a value is written on the axis. Defaults to the number to one decimal, without a trailing `.0`. */
  formatValue?: (value: number) => string;
  /** The week start to emphasise instead of the latest week. A week without a reading emphasises nothing. */
  selectedWeek?: string;
  /**
   * Makes each week with a reading a button named by its week. A press on its column selects it. Without it
   * the chart is one image and has no buttons. A column is the chart's width over the weeks, so at a phone's
   * width with 13 weeks it is about 21 pixels wide, as on the phone: the list of rows is the primary way to
   * choose a week and these are the shortcut.
   */
  onSelectWeek?: (week: string) => void;
  /**
   * A shaded band behind the line, one entry for each of `points` in the same order, such as the range an
   * estimate is likely to be in. The axis is widened to hold the ends of every band, a week with no value has
   * no band, and a `null` breaks the band as a skipped week breaks the line. A week alone gets a bar 12 wide.
   * Without it the chart is the plain line.
   */
  band?: readonly LineChartBand[];
  /** The legend under the week labels, drawn only with a `band`. */
  legend?: LineChartLegend;
};
