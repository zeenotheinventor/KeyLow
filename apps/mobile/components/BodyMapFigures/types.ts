import type { BodyFigureValues } from "../ui";
import type { BodyMapScale } from "@keylow/core/copy";
import type { BodyArtworkFigure, BodyMapView, MuscleId } from "@keylow/core/training";

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
  /** Called for a tap anywhere on the figures: a touch that lifts within the slop of where it went down. Left out, a tap does nothing. */
  onTap?: (() => void) | undefined;
  /**
   * Called when a muscle is pressed and held. It makes each muscle a button, and a short press on one still
   * calls `onTap`. Left out, the figures are plain images.
   */
  onLongPressMuscle?: ((muscle: MuscleId) => void) | undefined;
};
