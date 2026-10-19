export type ViewLabelProps = {
  /** The view named, such as "Actual". */
  label: string;
  /** The line under it: the moment shown, or why there is nothing to show. */
  subLine: string;
  /** Draws the dot as a dashed ring, as the board does for Projected, and not filled. Defaults to false. */
  isProjected?: boolean;
};
