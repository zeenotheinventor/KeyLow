import { bodyMapRendererFor } from "@keylow/core/training";
import { useState } from "react";

import { useBody3DSupport } from "./useBody3DSupport";
import { defaultBodyFigure } from "../../lib/bodyFigure";
import { useBodyMapRenderer } from "../../lib/bodyMapRenderer";

import type { BodyArtworkFigure } from "@keylow/core/training";

/**
 * Whether the body map is laid out for the 3D body: the person chose 3D in More, the figure has a 3D body, the
 * build has GL and 3D had not failed when the layout was first drawn. It is the decision `BodyView` makes,
 * except that a failure after that does not take the layout away, so the card around the figure does not jump
 * when `BodyView` falls back to the 2D figure inside it. The next time the layout is drawn it is 2D, for the
 * rest of the run, as `BodyView` is. A change of the setting in More changes it at once.
 */
export function useBody3DLayout(body: BodyArtworkFigure | undefined): boolean {
  const { renderer: preference } = useBodyMapRenderer();
  const { hasGlModule, hasFailed } = useBody3DSupport();
  const [hadFailedAtStart] = useState(hasFailed);

  return (
    bodyMapRendererFor({
      preference,
      figure: body ?? defaultBodyFigure,
      canTry3d: hasGlModule && !hadFailedAtStart,
    }) === "3d"
  );
}
