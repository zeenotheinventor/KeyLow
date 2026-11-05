export type ViewLabelProps = {
  /** The view named, such as "Actual". */
  label: string;
  /** The line under the view: the moment shown, or why there is nothing to show. */
  subLine: string;
  /** Draws the dot as a dashed ring, the mark of Projected, instead of a solid dot. */
  isProjected: boolean;
  className?: string;
};

export type ViewNameProps = {
  /** The view named, such as "Actual". */
  label: string;
  /** Draws the dot as a dashed ring, the mark of Projected, instead of a solid dot. */
  isProjected: boolean;
  /** The type of the name. Defaults to the card label's. */
  textClassName?: string;
};
