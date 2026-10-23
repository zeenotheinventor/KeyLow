import { bodyMapRendererFor } from "@keylow/core/training";

import { defaultBodyFigure } from "../../lib/bodyFigure";
import { useBodyMapRenderer } from "../../lib/bodyMapRenderer";
import { BodyFigure } from "../ui";
import { BodyViewIn3D } from "./BodyViewIn3D";
import { useBody3DSupport } from "./useBody3DSupport";

import type { BodyViewProps } from "./types";

/**
 * The body, in 2D or in 3D. It is the 2D `BodyFigure`, exactly, unless the person chose 3D in More, the
 * figure has a 3D body, the build has GL and 3D has not failed since the app started. Then the 2D
 * figure draws first and the 3D body fades in over it once it has drawn. If 3D cannot draw, the 2D figure
 * stays, the rest of the run stays on 2D, and nothing is said. The 3D code is read only when a `BodyView` first
 * draws the 3D body, so a person on 2D never loads it.
 */
export function BodyView(props: BodyViewProps) {
  const { renderer: preference } = useBodyMapRenderer();
  const { canTry3d, markFailed } = useBody3DSupport();
  const renderer = bodyMapRendererFor({
    preference,
    figure: props.body ?? defaultBodyFigure,
    canTry3d,
  });

  return renderer === "3d" ? (
    <BodyViewIn3D {...props} onFail={markFailed} />
  ) : (
    <BodyFigure {...props} />
  );
}
