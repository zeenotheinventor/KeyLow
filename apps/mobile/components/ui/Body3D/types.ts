import type { BodyColours, BodyLightingScheme } from "@keylow/body-3d";

export type Body3DProps = {
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
  colours: BodyColours;
  scheme: BodyLightingScheme;
  /** Called once, when the first frame has been asked for. */
  onFirstFrame?: (() => void) | undefined;
  /** Called when a shader cannot be linked, which three.js otherwise only logs while it draws nothing. */
  onError?: (() => void) | undefined;
};
