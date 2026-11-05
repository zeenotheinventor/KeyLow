import type { BodyFigureScale, BodyFigureValues } from "../../BodyFigure";
import type { Body3DProps } from "../types";
import type { BodySide } from "@keylow/body-3d/rotation";

/** What the GL canvas takes. `Body3D` fills it from its own props and the user's motion setting. */
export type Body3DCanvasProps = Pick<Body3DProps, "selected" | "onFirstFrame" | "onError"> & {
  scale: BodyFigureScale;
  values: BodyFigureValues;
  dim: number;
  unselectedOpacity: number;
  side: BodySide;
  /** How long the muscles ease to a new look and the body turns to a new side, in milliseconds. 0 does both at once. */
  motionMilliseconds: number;
  /** The width over height that the body is framed for, which is the 200 by 440 drawing of `BodyFigure`. */
  frameAspect: number;
};
