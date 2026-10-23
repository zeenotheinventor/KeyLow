import type { BodyFigureValues } from "../ui";
import type { BodyMapScale } from "@keylow/core/copy";
import type { BodyMapView } from "@keylow/core/training";

export type BodyMapCardProps = {
  /** The scale the figures are coloured by. */
  scale: BodyMapScale;
  /** The view shown. On Gap, which has no Actual or Projected, both views hold the same numbers and the label is not Projected. */
  view: BodyMapView;
  /** The value of each muscle in Actual, as `useBodyMap` gives them for the scale. A muscle left out is drawn at rest. */
  actualValues: BodyFigureValues;
  /** The value of each muscle in Projected. A muscle left out is drawn at rest. */
  projectedValues: BodyFigureValues;
  /** The view named, such as "Actual". */
  viewLabel: string;
  /** The line under the view: the moment shown, or why there is nothing to show. */
  subLine: string;
  /** The toggle button's label, naming the view it switches to: "Show projected" or "Show actual". Null draws no button. */
  toggleLabel: string | null;
  /** False when Projected cannot be shown, which disables the button and the tap on the figures. */
  isToggleEnabled: boolean;
  /** Called when the button or a tap on the figures asks for the other view. */
  onToggle: () => void;
  /** A line under the button, or null for none: why the two views match, or why Projected is off. */
  note: string | null;
};
