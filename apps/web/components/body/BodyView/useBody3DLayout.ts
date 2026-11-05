import { useState } from "react";

import { bodyViewRendererFor } from "./bodyViewRendererFor";
import { useBody3DSupport } from "./useBody3DSupport";

import type { BodyArtworkFigure } from "@keylow/core/training";

import { useBodyMapRenderer } from "@/lib/bodyMapRenderer";

/**
 * Whether the body map is laid out for the 3D body: the person chose 3D in More, the figure has a 3D body, the
 * browser has WebGL and 3D had not failed when the layout was first drawn. It is the decision `BodyView` makes,
 * except that a failure after that does not take the layout away, so the card around the figure does not jump
 * when `BodyView` falls back to the 2D figure inside it. The next time the layout is drawn it is 2D, for the
 * rest of the visit, as `BodyView` is. A change of the setting in More changes it at once.
 */
export function useBody3DLayout(body: BodyArtworkFigure | undefined): boolean {
  const { renderer: preference } = useBodyMapRenderer();
  const { hasWebGL, hasFailed } = useBody3DSupport();
  const [hadFailedAtStart] = useState(hasFailed);

  return (
    bodyViewRendererFor({ preference, body, canTry3d: hasWebGL && !hadFailedAtStart }) === "3d"
  );
}
