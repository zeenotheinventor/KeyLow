import type { BodyFigureValues } from "../ui";
import type { BodyMapScale } from "@keylow/core/copy";
import type { BodyMapView } from "@keylow/core/training";

export type BodyMapFiguresProps = {
  /** The scale the figures are coloured by, which their labels name. */
  scale: BodyMapScale;
  /** The view shown. When it changes the figures of the view that was shown fade out as the new ones fade in. */
  view: BodyMapView;
  /** The value of each muscle in Actual, in the encoding of `scale`. A muscle left out is at rest. */
  actualValues: BodyFigureValues;
  /** The value of each muscle in Projected, in the encoding of `scale`. A muscle left out is at rest. */
  projectedValues: BodyFigureValues;
  /** The width of each figure in points. */
  figureWidth: number;
  /** Called for a tap anywhere on the figures: a touch that lifts within the slop of where it went down. Left out, a tap does nothing. */
  onTap?: (() => void) | undefined;
};
