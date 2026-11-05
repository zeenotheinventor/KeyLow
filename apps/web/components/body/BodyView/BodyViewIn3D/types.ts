import type { BodyViewProps } from "../types";

export type BodyViewIn3DProps = BodyViewProps & {
  /** Called once if the 3D body will not draw, so the caller can stay on 2D. */
  onFail: () => void;
};
