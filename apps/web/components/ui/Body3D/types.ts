import type { BodyFigureProps } from "../BodyFigure";
import type { BodySide } from "@keylow/body-3d/rotation";

/**
 * The value props of `BodyFigure`, with the same meaning and defaults, so a caller swaps one figure for the other.
 * `scale` is heat and `values` is empty by default, which is every muscle at rest.
 */
export type Body3DProps = Partial<
  Pick<BodyFigureProps, "scale" | "values" | "selected" | "dim" | "unselectedOpacity">
> & {
  /** The figure's accessible name, from core copy. */
  label: string;
  /** The width in pixels. The height follows from the 200 by 440 drawing of `BodyFigure`. */
  w: number;
  /** The side the body faces, front by default. When it changes the body turns there by the shorter arc. */
  side?: BodySide | undefined;
  /** Called once, when the first frame of the body has been drawn. Never called if nothing is drawn. */
  onFirstFrame?: (() => void) | undefined;
  /**
   * Called once if the body cannot be drawn: there is no WebGL, the context is lost, or the model cannot be read.
   * Nothing is written on screen, so the caller draws the 2D figure in its place.
   */
  onError?: (() => void) | undefined;
};
