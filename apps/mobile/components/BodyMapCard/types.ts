import type { BodyFigureValues } from "../ui";
import type { BodyMapView } from "@keylow/core/training";

export type BodyMapCardProps = {
  /** The view shown. */
  view: BodyMapView;
  /** The heat step of each muscle in Actual, as `useBodyMap` gives them. A muscle left out is at rest. */
  actualValues: BodyFigureValues;
  /** The heat step of each muscle in Projected. A muscle left out is at rest. */
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
