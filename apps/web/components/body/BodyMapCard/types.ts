import type { BodyFigureValues } from "@/components/ui/BodyFigure";
import type { BodyMapScale } from "@keylow/core/copy";
import type { BodyArtworkFigure, BodyMapView, MuscleId } from "@keylow/core/training";

export type BodyMapCardProps = {
  /** The scale the values are on. Gap has no Actual or Projected, so its label has no dashed dot. */
  scale: BodyMapScale;
  /** The view shown. On Gap both views draw the same, and the label does not name it. */
  view: BodyMapView;
  /** The view named, such as "Actual", or "Done against plan" on Gap. */
  viewLabel: string;
  /** The line under the view: the moment shown, or why there is nothing to show. */
  subLine: string;
  /** The value of each muscle in Actual, for the scale. A muscle left out is drawn at the scale's first step. */
  actualValues: BodyFigureValues;
  /** The value of each muscle in Projected. */
  projectedValues: BodyFigureValues;
  /** The figure drawn. Defaults to male. */
  body?: BodyArtworkFigure | undefined;
  /** The toggle button's label, naming the view it switches to: "Show projected" or "Show actual". Null for none, as on Gap. */
  toggleLabel: string | null;
  /** False when the view cannot be switched, which disables the button and the click on the figures. */
  isToggleEnabled: boolean;
  /** Called when the button or a click on the figures asks for the other view. */
  onToggle: () => void;
  /** A line under the figures, or null for none: why the two views match, or why Projected is off. */
  note: string | null;
  /** Called by a hold or Enter on a muscle, to open its details. */
  onLongPressMuscle: (muscle: MuscleId) => void;
  /** The muscle whose details are open, marked on the figures. */
  selectedMuscle?: MuscleId | undefined;
};
