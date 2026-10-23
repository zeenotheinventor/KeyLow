import type { BodyFigureValues } from "../ui";
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

export type BodyMapFiguresProps = {
  /** The scale the figures are coloured by, which their labels name. */
  scale: BodyMapScale;
  /** The view shown. When it changes the figures of the view that was shown fade out as the new ones fade in. */
  view: BodyMapView;
  /** The value of each muscle in Actual, in the encoding of `scale`. A muscle left out is at rest. */
  actualValues: BodyFigureValues;
  /** The value of each muscle in Projected, in the encoding of `scale`. A muscle left out is at rest. */
  projectedValues: BodyFigureValues;
  /** The figure drawn, from the figure setting. Defaults to male. */
  body?: BodyArtworkFigure | undefined;
  /** The width of each figure in points. */
  figureWidth: number;
  /** The muscle to outline, such as the one whose sheet is open. */
  selected?: MuscleId | undefined;
  /** The view whose figure `selected` is outlined on in the side by side layout. Alone, the figures are of the view shown. */
  selectedView?: BodyMapView | undefined;
  /** Called for a tap anywhere on the figures: a touch that lifts within the slop of where it went down. Left out, a tap does nothing. */
  onTap?: (() => void) | undefined;
  /**
   * Called when a muscle is pressed and held, with the view of the figure it was on. It makes each muscle a
   * button, and a short press on one still calls `onTap`. Left out, the figures are plain images.
   */
  onLongPressMuscle?: ((muscle: MuscleId, view: BodyMapView) => void) | undefined;
  /** Draws Actual and Projected together instead of the front and the back of the view shown. A tap does nothing there. */
  sideBySide?: BodyMapSideBySide | undefined;
};
