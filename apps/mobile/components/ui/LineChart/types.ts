/** One week of a trend. A `null` value is a skipped week: the line breaks there and the week has no point. */
export type LineChartPoint = {
  /** The Monday the week starts on, as `YYYY-MM-DD`. */
  week: string;
  value: number | null;
};

export type LineChartProps = {
  /** One point for each week, oldest first. */
  points: readonly LineChartPoint[];
  /** The unit, written once above the axis, such as "kg". */
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
  /** Makes each week with a reading tappable. A tap on its place on the chart selects it. */
  onSelectWeek?: (week: string) => void;
  /** The height of the drawing in points. Defaults to 160. */
  height?: number;
};
