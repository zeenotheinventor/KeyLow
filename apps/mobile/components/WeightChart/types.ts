import type { WeightRange } from "@keylow/core/weight";

/** One reading on the chart: the day it was taken and how heavy it was. */
export type WeightChartReading = {
  /** The calendar day, `YYYY-MM-DD`. */
  date: string;
  /** Days after the first day of the window, from 0. */
  dayIndex: number;
  weightKg: number;
};

/** One day of the trend line. */
export type WeightChartTrendPoint = {
  date: string;
  dayIndex: number;
  trendKg: number;
  /** The run of readings the day belongs to. The line does not join two runs. */
  segment: number;
};

/** The whole kilograms the y axis labels, from the lowest to the highest. */
export type WeightChartAxis = {
  /** The bottom of the plot. */
  min: number;
  /** The top of the plot. */
  max: number;
  ticks: number[];
};

/** Everything the chart draws for one range, worked out from the trend and the weigh-ins. */
export type WeightChartData = {
  range: WeightRange;
  /** The first and last day of the range, both included. The last is today. */
  window: { from: string; to: string };
  /** The readings of the range, one dot each, without the ones the trend left out. */
  readings: WeightChartReading[];
  /** The days the trend left out, drawn as rings: the day's reading as the trend saw it. */
  leftOut: WeightChartReading[];
  /** The trend line, a point for each day from the first reading day. */
  trend: WeightChartTrendPoint[];
  /** The days with no reading that the trend filled in, which get a small dot on the line. */
  filledDays: WeightChartTrendPoint[];
  /** The last point of the trend line, which carries the marker. Null when the range has no point. */
  latest: WeightChartTrendPoint | null;
  /** Null when the range has nothing to place. */
  yAxis: WeightChartAxis | null;
  /** The labels under the plot: the first day, the middle day and today. */
  xLabels: [string, string, string];
};

export type WeightChartProps = {
  data: WeightChartData;
  /** Draws the trend line dashed while the trend has too few readings to trust. */
  isSettling: boolean;
  /** What a screen reader says for the whole figure, which is one image. The caller writes it, because the words are copy. */
  name: string;
};
