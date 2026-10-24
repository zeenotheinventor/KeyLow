import type { BodyArtworkFigure, BodyMapRenderer } from "./bodyArtwork";

// The figures that have a 3D body. Only the male does for now, so a person with the female figure who
// chooses 3D sees the 2D map. Adding the female is one more entry here.
const FIGURES_WITH_3D_BODY: readonly BodyArtworkFigure[] = ["male"];

/** Whether the figure has a 3D body, so a screen can say when it does not. */
export function figureHas3dBody(figure: BodyArtworkFigure): boolean {
  return FIGURES_WITH_3D_BODY.includes(figure);
}

export type BodyMapRendererInput = {
  /** What the person chose in More. */
  preference: BodyMapRenderer;
  /** The figure the body is drawn as. */
  figure: BodyArtworkFigure;
  /** Whether 3D can be tried: the build has the GL module and 3D has not failed this session. */
  canTry3d: boolean;
};

/** The renderer the body map draws with: 3D only when it is chosen, the figure has a 3D body and 3D can be tried. */
export function bodyMapRendererFor({
  preference,
  figure,
  canTry3d,
}: BodyMapRendererInput): BodyMapRenderer {
  return preference === "3d" && canTry3d && figureHas3dBody(figure) ? "3d" : "2d";
}
