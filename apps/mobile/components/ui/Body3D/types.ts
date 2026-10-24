import type { BodyFigureProps } from "../BodyFigure";
import type { BodyColours, BodyLightingScheme, Look, LookEmphasis } from "@keylow/body-3d";
import type { MuscleId } from "@keylow/core/training";

/**
 * The value props of `BodyFigure`, with the same meaning and defaults, so a caller swaps one figure for the other
 * with no other change. `scale` is heat and `values` is empty by default, which is every muscle at rest.
 */
export type Body3DProps = Partial<
  Pick<BodyFigureProps, "scale" | "values" | "selected" | "dim" | "unselectedOpacity">
> & {
  /** The figure's accessible name, from core copy. */
  label: string;
  /** The width in points. The height follows from the 200 by 440 drawing of `BodyFigure`. */
  w: number;
  /** Called once, when the first frame of the body has been drawn. Never called if nothing is drawn. */
  onFirstFrame?: (() => void) | undefined;
  /** Called once if the body cannot be drawn: GL is missing, the model cannot be read, or the draw throws. */
  onError?: (() => void) | undefined;
};

/** What the GL canvas takes. `Body3D` fills it from the theme and its own callbacks. */
export type Body3DCanvasProps = {
  /** The colours of everything but the muscles, and the one the muscles start at. */
  colours: BodyColours;
  scheme: BodyLightingScheme;
  /** The look of each muscle. The muscles ease to a new one. */
  looks: Record<MuscleId, Look>;
  emphasis: LookEmphasis;
  /** How long the muscles take to ease to a new look, in milliseconds. 0 changes them at once. */
  fadeMilliseconds: number;
  /** Called once, when the first frame has been asked for. */
  onFirstFrame?: (() => void) | undefined;
  /** Called when a shader cannot be linked, which three.js otherwise only logs while it draws nothing. */
  onError?: (() => void) | undefined;
};
