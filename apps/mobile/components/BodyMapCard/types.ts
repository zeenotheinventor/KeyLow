import type { BodyFigureValues } from "../ui";

export type BodyMapCardProps = {
  /** The heat step of each muscle, as `useBodyMap` gives them. A muscle left out is at rest. */
  values: BodyFigureValues;
  /** The view named, such as "Actual". */
  viewLabel: string;
  /** The line under the view: the moment shown, or why there is nothing to show. */
  subLine: string;
};
