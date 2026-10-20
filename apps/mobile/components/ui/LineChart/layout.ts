// The chart's room is set once here. The classes are written out so Tailwind sees them, and the numbers are
// what Victory's padding and the plot are given, so a test compiles each class and checks it is its number.

/** The column of axis values left of the plot. Wide enough for "102.5" with room beside it. */
export const GUTTER_WIDTH = 48;
export const gutterClassName = "w-12";

/** Room at the plot's left and right for a point, and the same beside the week labels so they line up. */
export const PLOT_INSET_X = 4;
export const plotInsetXClassName = "px-1";

/** Room above and below the plot for half an axis label (the caption's line height is 16), so a label sits level with its grid line. */
export const PLOT_INSET_Y = 8;
export const plotInsetYClassName = "py-2";

export const plotPadding = {
  left: PLOT_INSET_X,
  right: PLOT_INSET_X,
  top: PLOT_INSET_Y,
  bottom: PLOT_INSET_Y,
};
