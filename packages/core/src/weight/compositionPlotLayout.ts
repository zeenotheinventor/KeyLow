import type { BodyCompositionChartAxis } from "./compositionChartTypes";

/** The column right of a plot that holds its y values, in points on the phone and pixels on the web. */
export const COMPOSITION_VALUE_COLUMN_WIDTH = 40;

/**
 * Room inside a plot for its caption, a point and its marker. The top padding keeps the highest gridline
 * under the caption. The canvas spans the whole plot, so the marker at the last day is not clipped by the
 * canvas's edge, and its right padding is the value column and 4 beside it, as in the weight chart.
 */
export const COMPOSITION_PLOT_PADDING = {
  left: 12,
  right: COMPOSITION_VALUE_COLUMN_WIDTH + 4,
  top: 16,
  bottom: 8,
};

/** The height of a plot's drawing: what is left of the plot once the top and bottom padding are taken off. */
const drawHeightOf = (plotHeight: number): number =>
  plotHeight - COMPOSITION_PLOT_PADDING.top - COMPOSITION_PLOT_PADDING.bottom;

/** How far below the top of its plot a value is drawn, so the highest tick is at the top padding. */
export function compositionPlotOffsetOf(
  value: number,
  { min, max }: Pick<BodyCompositionChartAxis, "min" | "max">,
  plotHeight: number,
): number {
  return COMPOSITION_PLOT_PADDING.top + ((max - value) / (max - min)) * drawHeightOf(plotHeight);
}

/** Where a plot with no points draws its grid, as fractions of the plot from the top: top, middle and bottom. */
const EMPTY_GRID_FRACTIONS = [0, 0.5, 1];

export const compositionEmptyGridOffsets = (plotHeight: number): number[] =>
  EMPTY_GRID_FRACTIONS.map(
    (fraction) => COMPOSITION_PLOT_PADDING.top + fraction * drawHeightOf(plotHeight),
  );
