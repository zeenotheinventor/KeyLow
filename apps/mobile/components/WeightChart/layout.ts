import type { WeightChartAxis } from "./types";

// The figure's room, as the board draws it, in points. The classes in the figure are written out so Tailwind
// sees them, and these are the numbers the drawing counts on.

/** Space above the plot inside the figure. The class is `pt-3`, `top-3` for the plot. */
export const FIGURE_TOP_INSET = 12;
/** The plot's box: the drawing and the grid, the height of the board's drawing. The class is `h-[160px]`. */
export const PLOT_BOX_HEIGHT = 160;
/** The column right of the plot that holds the y values. The class is `right-10`. */
export const VALUE_COLUMN_WIDTH = 40;
/** Where the x labels start below the top of the figure: the inset and the plot's box. The class is `top-[172px]`. */
export const X_LABELS_TOP = FIGURE_TOP_INSET + PLOT_BOX_HEIGHT;

/**
 * Room inside the plot's box for a point and its marker, and the board's space below the lowest value. The
 * canvas spans the whole figure, so the marker at the last day is not clipped by the canvas's edge, and its
 * right padding is the value column and the board's 4 points beside it. The x labels' right padding is the
 * same 44 points.
 */
export const plotPadding = { left: 12, right: VALUE_COLUMN_WIDTH + 4, top: 8, bottom: 12 };

const plotDrawHeight = PLOT_BOX_HEIGHT - plotPadding.top - plotPadding.bottom;

/** How far below the top of the plot's box a value is drawn, so the highest value is at the top padding. */
export function plotOffsetOf(
  value: number,
  { min, max }: Pick<WeightChartAxis, "min" | "max">,
): number {
  return plotPadding.top + ((max - value) / (max - min)) * plotDrawHeight;
}

/** Where a range with no points draws its grid, as fractions of the plot from the top: top, middle and bottom. */
const EMPTY_GRID_FRACTIONS = [0, 0.5, 1];
export const emptyGridOffsets = EMPTY_GRID_FRACTIONS.map(
  (fraction) => plotPadding.top + fraction * plotDrawHeight,
);
