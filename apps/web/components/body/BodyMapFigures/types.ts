import type { BodyFigureValues } from "@/components/ui/BodyFigure";
import type { BodyMapScale } from "@keylow/core/copy";
import type {
  BodyArtworkFigure,
  BodyArtworkSide,
  BodyMapView,
  MuscleId,
} from "@keylow/core/training";

/** The side by side layout: Actual and Projected together, one side of the body each. */
export type BodyMapSideBySide = {
  /** The side of the body drawn on both figures. */
  side: BodyArtworkSide;
  /** The line under the Actual figure: the moment it shows. */
  actualCaption: string;
  /** The line under the Projected figure: what it assumes, or the moment when it assumes nothing. */
  projectedCaption: string;
};

/** The 3D layout: one body on a stage, turned to `side`, in place of the front and the back together. */
export type BodyMapIn3D = {
  /** The side the body faces. */
  side: BodyArtworkSide;
  /** Called when the Front and Back control is pressed, and when a drag of the body settles on the other side. */
  onSideChange: (side: BodyArtworkSide) => void;
};

export type BodyMapFiguresProps = {
  /** The scale the values are on: heat steps, volume statuses or gap values. */
  scale: BodyMapScale;
  /** The view shown. The other view's figures stay in place, faded out, so a switch cross-fades. */
  view: BodyMapView;
  /** The value of each muscle in Actual, as `useBodyMap` gives it for the scale. A muscle left out is drawn at the scale's first step. */
  actualValues: BodyFigureValues;
  /** The value of each muscle in Projected. */
  projectedValues: BodyFigureValues;
  /** The figure drawn. Defaults to male. */
  body?: BodyArtworkFigure | undefined;
  /** Called by a click anywhere on the figures, and never by a drag. Left out, a click does nothing. */
  onTap?: (() => void) | undefined;
  /**
   * Gives each muscle of the shown view's figures a button, reached by Tab. A hold of 500 ms on one, or Enter
   * or Space on it, calls this with the view of the figure it was on. A short click on a muscle is still a
   * tap, so `onTap` takes it, except in the side by side layout, where it does nothing.
   */
  onLongPressMuscle?: ((muscle: MuscleId, view: BodyMapView) => void) | undefined;
  /** The muscle whose details are open: it is outlined and the rest of the figures fade. */
  selected?: MuscleId | undefined;
  /** The view whose figure `selected` is outlined on in the side by side layout. Alone, the figures are of the view shown. */
  selectedView?: BodyMapView | undefined;
  /** Draws Actual and Projected together instead of the front and the back of the view shown. A click does nothing there. */
  sideBySide?: BodyMapSideBySide | undefined;
  /**
   * Draws one body on a dark stage, in 3D when it can be and in 2D inside the stage when it cannot, with the Front
   * and Back control, the zoom buttons and a hint under it, instead of the front and the back together. A click on
   * it calls `onTap` and a drag turns it. Left out, or with `sideBySide`, the figures are 2D.
   */
  in3d?: BodyMapIn3D | undefined;
};
