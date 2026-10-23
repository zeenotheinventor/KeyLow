export type ViewLabelProps = {
  /** The view named, such as "Actual". */
  label: string;
  /** The line under it: the moment shown, or why there is nothing to show. */
  subLine: string;
  /** Draws the dot as a dashed ring, as the board does for Projected, and not filled. Defaults to false. */
  isProjected?: boolean;
};

/** The name of a view with its dot: filled for Actual, a dashed ring for Projected. */
export type ViewNameProps = Pick<ViewLabelProps, "label" | "isProjected"> & {
  /** The type style of the name. The view label uses `body-strong`, a figure of the side by side view `label-small`. Defaults to `body-strong`. */
  textVariant?: "body-strong" | "label-small";
};
