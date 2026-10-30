import type { BodyFigureValues } from "@/components/ui/BodyFigure";
import type { BodyArtworkFigure, BodyMapView } from "@keylow/core/training";

export type BodyMapCardProps = {
  /** The view shown. */
  view: BodyMapView;
  /** The view named, such as "Actual". */
  viewLabel: string;
  /** The line under the view: the moment shown, or why there is nothing to show. */
  subLine: string;
  /** The heat of each muscle in Actual. A muscle left out is drawn at rest. */
  actualValues: BodyFigureValues;
  /** The heat of each muscle in Projected. */
  projectedValues: BodyFigureValues;
  /** The figure drawn. Defaults to male. */
  body?: BodyArtworkFigure | undefined;
  /** The toggle button's label, naming the view it switches to: "Show projected" or "Show actual". */
  toggleLabel: string;
  /** False when Projected cannot be shown, which disables the button and the click on the figures. */
  isToggleEnabled: boolean;
  /** Called when the button or a click on the figures asks for the other view. */
  onToggle: () => void;
  /** A line under the figures, or null for none: why the two views match, or why Projected is off. */
  note: string | null;
};
