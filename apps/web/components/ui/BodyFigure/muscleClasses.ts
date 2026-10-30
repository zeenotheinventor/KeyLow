import type { BodyFigureTone } from "@keylow/core/training";

/*
 * Every class the figure draws with is written out in full, so Tailwind finds each one in this file. A
 * class built from a token name would be missing from the stylesheet.
 */

/** The fill of a muscle, by the colour token that core's `readMuscleValue` gives it. */
export const toneFillClasses = {
  "heat-0": "fill-heat-0",
  "heat-1": "fill-heat-1",
  "heat-2": "fill-heat-2",
  "heat-3": "fill-heat-3",
  "heat-4": "fill-heat-4",
  "heat-5": "fill-heat-5",
  "volume-not-trained": "fill-volume-not-trained",
  "volume-maintaining": "fill-volume-maintaining",
  "volume-growing": "fill-volume-growing",
  "volume-productive": "fill-volume-productive",
  "volume-high": "fill-volume-high",
  "gap-behind": "fill-gap-behind",
  "gap-on-plan": "fill-gap-on-plan",
  "gap-ahead": "fill-gap-ahead",
  "role-primary": "fill-role-primary",
  "role-secondary": "fill-role-secondary",
  "role-assist": "fill-role-assist",
} as const satisfies Record<BodyFigureTone, string>;

/** The head and the body outline, drawn under the muscles. */
export const silhouetteClass = "fill-body-silhouette";

/** The line between two muscles. */
export const separatorClass = "stroke-body-separator";

/** The line round the selected muscle. */
export const selectedOutlineClass = "stroke-text-primary";

/** A muscle takes the keyboard focus ring in the focus token, a little thicker than its outline. */
export const focusRingClasses =
  "outline-none focus-visible:stroke-focus-ring focus-visible:[stroke-width:3]";

/** The width of the line between muscles and of the line round the selected one, in the drawing's units. */
export const SEPARATOR_WIDTH = 1.4;
export const SELECTED_OUTLINE_WIDTH = 2.6;
