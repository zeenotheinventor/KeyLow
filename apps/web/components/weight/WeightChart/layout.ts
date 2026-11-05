import type { ChartSize } from "./types";
import type { WeightChartAxis } from "@keylow/core/weight";

// The room the board leaves inside the drawing, in pixels. The plot is what is left once it is taken
// off the box, whatever size the column gives the drawing, so a dot is the same size at 1280 and at 375.
export const PLOT_INSET = { left: 12, right: 44, top: 8, bottom: 12 } as const;

/** The column on the right that holds the y values, where the grid lines stop. */
const VALUE_COLUMN_WIDTH = 40;

/** Where a label of the y axis sits against the figure: the figure's top padding, less half the label's 14 px line. */
const LABEL_TOP_OFFSET = 12 - 7;

// A range with no point draws its grid at the top, the middle and the bottom of the plot.
const EMPTY_GRID_FRACTIONS = [0, 0.5, 1];

const plotWidthOf = ({ width }: ChartSize): number => width - PLOT_INSET.left - PLOT_INSET.right;
const plotHeightOf = ({ height }: ChartSize): number => height - PLOT_INSET.top - PLOT_INSET.bottom;

/** How far from the left of the drawing a day is, the first day of the range at the left inset and the last at the right. */
export function xOfDay(dayIndex: number, rangeDays: number, size: ChartSize): number {
  return PLOT_INSET.left + (dayIndex / (rangeDays - 1)) * plotWidthOf(size);
}

/** How far from the top of the drawing a weight is, the top of the axis at the top inset. */
export function yOfWeight(
  weightKg: number,
  { min, max }: Pick<WeightChartAxis, "min" | "max">,
  size: ChartSize,
): number {
  return PLOT_INSET.top + ((max - weightKg) / (max - min)) * plotHeightOf(size);
}

/** Where the grid ends on the right, which is where the y values begin. */
export const gridEndOf = ({ width }: ChartSize): number => width - VALUE_COLUMN_WIDTH;

/** How far from the top of the figure the top of a y label is, for a line drawn at `y`. */
export const labelTopOf = (y: number): number => y + LABEL_TOP_OFFSET;

/** The grid lines of a range with no point, from the top of the plot to the bottom. */
export const emptyGridYs = (size: ChartSize): number[] =>
  EMPTY_GRID_FRACTIONS.map((fraction) => PLOT_INSET.top + fraction * plotHeightOf(size));
