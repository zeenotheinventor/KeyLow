import type { BodyFigureValues } from "../ui";
import type { BodyMapView } from "@keylow/core/training";

export type BodyMapFiguresProps = {
  /** The view shown. When it changes the figures of the view that was shown fade out as the new ones fade in. */
  view: BodyMapView;
  /** The heat step of each muscle in Actual. A muscle left out is at rest. */
  actualValues: BodyFigureValues;
  /** The heat step of each muscle in Projected. A muscle left out is at rest. */
  projectedValues: BodyFigureValues;
  /** The width of each figure in points. */
  figureWidth: number;
  /** Called for a tap anywhere on the figures: a touch that lifts within the slop of where it went down. Left out, a tap does nothing. */
  onTap?: (() => void) | undefined;
};
