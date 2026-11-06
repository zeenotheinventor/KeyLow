import {
  COMPOSITION_PLOT_PADDING,
  COMPOSITION_VALUE_COLUMN_WIDTH,
  compositionEmptyGridOffsets,
  compositionPlotOffsetOf,
} from "@keylow/core/weight";

import type { BodyCompositionChartAxis } from "@keylow/core/weight";

// The figure's room, in points. The 196 point frame, its 12 point inset and the x labels at 172 are the weight
// chart's. The plot box between them holds two plots of equal height with a gap. The classes in the figure
// are written out so Tailwind sees them, and these are the numbers the drawing counts on.

/** Space above the first plot inside the figure. The class is `top-3`. */
export const FIGURE_TOP_INSET = 12;
/** The height of each of the two plots. The class is `h-[76px]`. */
export const PLOT_HEIGHT = 76;
/** The space between the plots. */
export const PLOT_GAP = 8;
/** Where the second plot starts below the top of the figure. The class is `top-[96px]`. */
export const SECOND_PLOT_TOP = FIGURE_TOP_INSET + PLOT_HEIGHT + PLOT_GAP;
/** Where the x labels start below the top of the figure: under the second plot. The class is `top-[172px]`. */
export const X_LABELS_TOP = SECOND_PLOT_TOP + PLOT_HEIGHT;
/** The column right of a plot that holds its y values. The class is `right-10`. */
export const VALUE_COLUMN_WIDTH = COMPOSITION_VALUE_COLUMN_WIDTH;
/** The line height of a plot's caption, which sits at the plot's top left. The class is `h-[14px]`. */
export const CAPTION_HEIGHT = 14;

/** Room inside a plot for its caption, a point and its marker, which core holds because the web draws the same plots. */
export const plotPadding = COMPOSITION_PLOT_PADDING;

/** How far below the top of its plot a value is drawn, so the highest tick is at the top padding. */
export function plotOffsetOf(
  value: number,
  axis: Pick<BodyCompositionChartAxis, "min" | "max">,
): number {
  return compositionPlotOffsetOf(value, axis, PLOT_HEIGHT);
}

/** Where a plot with no points draws its grid: the top, the middle and the bottom of the plot. */
export const emptyGridOffsets = compositionEmptyGridOffsets(PLOT_HEIGHT);
