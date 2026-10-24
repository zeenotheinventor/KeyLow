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
