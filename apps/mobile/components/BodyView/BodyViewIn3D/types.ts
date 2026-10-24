import type { Body3DProps } from "../../ui";
import type { BodyViewProps } from "../types";
import type { ComponentType } from "react";

export type Phase = "loading" | "drawn" | "failed";

export type BodyViewIn3DProps = BodyViewProps & {
  /** Called once if the 3D body will not draw, so the caller can stay on 2D. */
  onFail: () => void;
  /** The 3D body to draw. Defaults to `Body3D`, and is a stand-in in the stories that show loading and failing. */
  Body3DComponent?: ComponentType<Body3DProps>;
};
