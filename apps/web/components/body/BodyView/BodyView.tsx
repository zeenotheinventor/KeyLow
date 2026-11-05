import { BodyViewIn3D } from "./BodyViewIn3D";
import { bodyViewRendererFor } from "./bodyViewRendererFor";
import { useBody3DSupport } from "./useBody3DSupport";

import type { BodyViewProps } from "./types";

import { BodyFigure } from "@/components/ui/BodyFigure";
import { useBodyMapRenderer } from "@/lib/bodyMapRenderer";

/**
 * The body, in 2D or in 3D. It is the 2D `BodyFigure`, exactly, unless the person chose 3D in More, the figure has
 * a 3D body, the browser can start a WebGL 2 context and 3D has not failed in this visit. Then the 2D figure draws
 * first and the 3D body fades in over it once it has drawn. If 3D cannot draw, the 2D figure stays, the rest of the
 * visit stays on 2D, and nothing is said. The 3D code and the model are read only when a `BodyView` first draws the
 * 3D body, so a person on 2D never loads them. The server and the first draw in the browser are 2D.
 */
export function BodyView(props: BodyViewProps) {
  const { renderer: preference } = useBodyMapRenderer();
  const { canTry3d, markFailed } = useBody3DSupport();
  const renderer = bodyViewRendererFor({ preference, body: props.body, canTry3d });

  if (renderer === "3d") {
    return <BodyViewIn3D {...props} onFail={markFailed} />;
  }
  // `BodyFigure` takes what it knows from the props, so the calls that only the 3D body makes are left behind.
  return <BodyFigure {...props} />;
}
