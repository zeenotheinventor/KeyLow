import { bodyMapRendererFor } from "@keylow/core/training";

import type { BodyArtworkFigure, BodyMapRenderer } from "@keylow/core/training";

import { DEFAULT_BODY_FIGURE } from "@/lib/bodyFigure";

type BodyViewRendererInput = {
  /** What the person chose in More. */
  preference: BodyMapRenderer;
  /** The figure the body is drawn as, which is male when the caller gives none, as `BodyFigure` has it. */
  body: BodyArtworkFigure | undefined;
  /** Whether 3D can be tried: the browser can start a WebGL 2 context and 3D has not failed. */
  canTry3d: boolean;
};

/** The renderer a body draws with. It is the one place that says which figure a body with none given is. */
export function bodyViewRendererFor({ preference, body, canTry3d }: BodyViewRendererInput) {
  return bodyMapRendererFor({ preference, figure: body ?? DEFAULT_BODY_FIGURE, canTry3d });
}
