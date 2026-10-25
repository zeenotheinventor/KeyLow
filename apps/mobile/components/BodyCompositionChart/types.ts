import type { WeightRange } from "@keylow/core/weight";

/** One day of the composition trend. This is core's `BodySplitPoint`, so the view passes core's output as it is. */
export type CompositionInputPoint = {
  /** The calendar day, `YYYY-MM-DD`. */
  date: string;
  /** The run of readings the day belongs to. The line does not join two runs. */
  segment: number;
  /** The body fat trend of the day. */
  fat: number;
  /** The lean mass trend of the day. */
  lean: number;
};

/** One day of one plot's line. */
export type BodyCompositionChartPoint = {
  date: string;
  /** Days after the first day of the window, from 0. */
  dayIndex: number;
  value: number;
  segment: number;
};

/** The whole numbers a plot's y axis labels, from the lowest to the highest. */
export type BodyCompositionChartAxis = {
  /** The bottom of the plot, the first tick. */
  min: number;
  /** The top of the plot, the last tick. */
  max: number;
  ticks: number[];
};

/** One of the two stacked plots. */
export type BodyCompositionChartPlot = {
  /** The line, a point for each day the range has. */
  points: BodyCompositionChartPoint[];
  /** The last point of the line, which carries the marker. Null when the range has no point. */
  latest: BodyCompositionChartPoint | null;
  /** Null when the range has nothing to place. */
  yAxis: BodyCompositionChartAxis | null;
};

/** Everything the figure draws for one range, worked out from the composition trend. */
export type BodyCompositionChartData = {
  range: WeightRange;
  /** The first and last day of the range, both included. The last is today. */
  window: { from: string; to: string };
  /** The top plot. */
  bodyFat: BodyCompositionChartPlot;
  /** The bottom plot. */
  leanMass: BodyCompositionChartPlot;
  /** The labels under the plots: the first day, the middle day and today. */
  xLabels: [string, string, string];
};

export type BodyCompositionChartProps = {
  data: BodyCompositionChartData;
  /** Draws both lines dashed while the trend has too few readings to trust. */
  isSettling: boolean;
  /** What a screen reader says for the whole figure, which is one image. The caller writes it, because the words are copy. */
  name: string;
};
