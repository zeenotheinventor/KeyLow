import {
  COMPOSITION_PLOT_PADDING,
  COMPOSITION_VALUE_COLUMN_WIDTH,
  compositionEmptyGridOffsets,
  compositionPlotOffsetOf,
} from "@keylow/core/weight";

import type { ElementSize } from "@/lib/useElementSize";
import type { BodyCompositionChartAxis } from "@keylow/core/weight";

// The room the board leaves inside the drawing, in pixels. The drawing holds two plots of equal height with a
// gap, so each is 106 high in the 220 of the large breakpoint and 76 in the 160 under it.

/** The space between the two plots. */
export const PLOT_GAP = 8;

/** The figure's top padding, which the labels are placed against. The class is `pt-3`. */
const FIGURE_TOP_INSET = 12;

/** Where the grid ends on the right, which is where the y values begin. */
export const gridEndOf = ({ width }: ElementSize): number => width - COMPOSITION_VALUE_COLUMN_WIDTH;

/** The height of each of the two plots in a drawing this high. */
export const plotHeightOf = ({ height }: ElementSize): number => (height - PLOT_GAP) / 2;

/** How far from the top of the drawing a plot starts: 0 for the top plot and a plot and a gap down for the bottom. */
export const plotTopOf = (plot: "first" | "second", size: ElementSize): number =>
  plot === "first" ? 0 : plotHeightOf(size) + PLOT_GAP;

/** How far from the left of the drawing a day is, the first day of the range at the left padding and the last at the right. */
export function xOfDay(dayIndex: number, rangeDays: number, { width }: ElementSize): number {
  const { left, right } = COMPOSITION_PLOT_PADDING;

  return left + (dayIndex / (rangeDays - 1)) * (width - left - right);
}

/** How far from the top of the drawing a value is, in the plot it belongs to. */
export function yOfValue(
  value: number,
  axis: Pick<BodyCompositionChartAxis, "min" | "max">,
  plot: "first" | "second",
  size: ElementSize,
): number {
  return plotTopOf(plot, size) + compositionPlotOffsetOf(value, axis, plotHeightOf(size));
}

/** The grid lines of a plot with no point: the top, the middle and the bottom of the plot. */
export const emptyGridYs = (plot: "first" | "second", size: ElementSize): number[] =>
  compositionEmptyGridOffsets(plotHeightOf(size)).map((offset) => plotTopOf(plot, size) + offset);

/** How far from the top of the figure the top of a y label is, for a line drawn at `y`: against the 14 px line's middle. */
export const labelTopOf = (y: number): number => y + FIGURE_TOP_INSET - 7;
