import type { BodyFigureValues } from "@/components/ui/BodyFigure";
import type { BodyMapScale } from "@keylow/core/copy";
import type { BodyArtworkFigure, BodyMapView, MuscleId } from "@keylow/core/training";

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
   * or Space on it, calls this. A short click on a muscle is still a tap, so `onTap` takes it.
   */
  onLongPressMuscle?: ((muscle: MuscleId) => void) | undefined;
  /** The muscle whose details are open: it is outlined and the rest of the figures fade. */
  selected?: MuscleId | undefined;
};
