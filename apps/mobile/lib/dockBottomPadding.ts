// The boards leave 42 below the controls: the 34 of an iPhone's home indicator and 8. A taller navigation bar takes its own height.
const MINIMUM_BOTTOM_INSET = 34;
const BOTTOM_MARGIN = 8;

/** The padding under the controls of a form's dock, from the screen's bottom inset. */
export function dockBottomPadding(bottomInset: number): number {
  return Math.max(bottomInset, MINIMUM_BOTTOM_INSET) + BOTTOM_MARGIN;
}
