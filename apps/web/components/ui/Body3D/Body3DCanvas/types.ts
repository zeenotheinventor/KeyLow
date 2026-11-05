import type { BodyFigureScale, BodyFigureValues } from "../../BodyFigure";
import type { BodyPose } from "../bodyPose";
import type { MusclePicker, Body3DProps } from "../types";

/** What the GL canvas takes. `Body3D` fills it from its own props and the user's motion setting. */
export type Body3DCanvasProps = Pick<Body3DProps, "selected" | "onFirstFrame" | "onError"> & {
  scale: BodyFigureScale;
  values: BodyFigureValues;
  dim: number;
  unselectedOpacity: number;
  /** Where the body faces and how it is zoomed and moved, which the pointer writes and the render loop draws. */
  pose: BodyPose;
  /** How long the muscles ease to a new look, in milliseconds. 0 does it at once. */
  motionMilliseconds: number;
  /** The width over height that the body is framed for, which is the 200 by 440 drawing of `BodyFigure`. */
  frameAspect: number;
  /**
   * Called with the function that picks a muscle at a point of the canvas, in pixels from its top left, once the
   * camera and the body are in the scene, and with null when they go. The canvas is as wide and as high as the touch
   * area, so a point of the touch area is a point of it. The function reads the camera and the body as drawn.
   */
  onPickerChange?: ((pick: MusclePicker | null) => void) | undefined;
};
