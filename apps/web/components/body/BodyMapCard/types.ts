import type { BodyMapSideBySide } from "@/components/body/BodyMapFigures";
import type { BodyFigureValues } from "@/components/ui/BodyFigure";
import type { BodyMapScale } from "@keylow/core/copy";
import type {
  BodyArtworkSide,
  BodyArtworkFigure,
  BodyMapView,
  MuscleId,
} from "@keylow/core/training";
import type { ReactNode } from "react";

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
  /** Called by a hold or Enter on a muscle, to open its details, with the view of the figure it was on. */
  onLongPressMuscle: (muscle: MuscleId, view: BodyMapView) => void;
  /** The muscle whose details are open, marked on the figures. */
  selectedMuscle?: MuscleId | undefined;
  /** The view whose figure `selectedMuscle` is marked on in the side by side layout. */
  selectedView?: BodyMapView | undefined;
  /**
   * Draws the side by side layout: Actual and Projected together, one side of the body each, with the small
   * Front and Back switch where the view label was. The toggle button is the screen's to leave out there,
   * with a null label, and a click on the figures does nothing.
   */
  sideBySide?: (BodyMapSideBySide & { onSideChange: (side: BodyArtworkSide) => void }) | undefined;
  /** Called by the Show side by side button. Left out, the card has no button, as on Volume and Gap. */
  onToggleSideBySide?: (() => void) | undefined;
  /** False disables the Show side by side button: with no routine there is no plan to show beside what is logged. Defaults to true. */
  isSideBySideEnabled?: boolean | undefined;
  /**
   * A strip laid over the figures, such as the first-open hint. It is left out on the 3D body, which has its
   * own hint line, and the screen leaves it out in the side by side view.
   */
  overlay?: ReactNode;
  /** The row under the card's content, such as the day scrubber. */
  footer?: ReactNode;
};
