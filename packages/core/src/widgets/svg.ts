import { BODY_ARTWORK } from "../training/bodyArtwork";
import { MUSCLE_IDS } from "../training/muscles";

import type { FigureView, RingView, WidgetPalette } from "./types";
import type { BodyArtworkSide } from "../training/bodyArtwork";
import type { MuscleId } from "../training/muscles";

/*
 * SVG strings for the two things a widget cannot draw with plain views (ADR 0007, "The library"). Colour
 * comes only from the palette argument, so these hold no colour and the artwork is the app's own.
 */

const escapeText = (text: string): string =>
  text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

// The viewBox the boards crop the figure to: the artwork's 200 by 440 box without its empty margins.
const FIGURE_VIEW_BOX = { x: 28, y: 4, width: 144, height: 432 };

export type BodyFigureSvgInput = Readonly<{
  figure: FigureView;
  side: BodyArtworkSide;
  palette: WidgetPalette;
  /** The drawn height. The width follows the figure's proportions. */
  height: number;
}>;

/** One side of the body, its head and outline in the silhouette colour and each muscle in its tone's colour. */
export const buildBodyFigureSvg = ({
  figure,
  side,
  palette,
  height,
}: BodyFigureSvgInput): string => {
  const artwork = BODY_ARTWORK[figure.figure][side];
  const width = Math.round((height * FIGURE_VIEW_BOX.width) / FIGURE_VIEW_BOX.height);
  // Each side of the artwork holds only its own muscles, so a Partial record reads either.
  const paths: Readonly<Partial<Record<MuscleId, string>>> = artwork.muscles;
  const muscles = MUSCLE_IDS.flatMap((muscle) => {
    const path = paths[muscle];
    return path === undefined
      ? []
      : [`<path d="${path}" fill="${palette[figure.tones[muscle]]}"/>`];
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${FIGURE_VIEW_BOX.x} ${FIGURE_VIEW_BOX.y} ${FIGURE_VIEW_BOX.width} ${FIGURE_VIEW_BOX.height}">`,
    `<path d="${artwork.head}" fill="${palette.silhouette}"/>`,
    `<path d="${artwork.outline}" fill="${palette.silhouette}"/>`,
    ...muscles,
    "</svg>",
  ].join("");
};

/** The sizes of the two rings the boards draw, from the small and the medium widgets. */
const RING_SIZES = {
  compact: { size: 92, radius: 38, stroke: 9, valueFont: 19, captionFont: 10, captionOffset: 16 },
  regular: { size: 112, radius: 46, stroke: 11, valueFont: 24, captionFont: 11, captionOffset: 18 },
} as const;

export type CalorieRingSvgInput = Readonly<{
  ring: RingView;
  size: keyof typeof RING_SIZES;
  palette: WidgetPalette;
}>;

/** The calorie ring: a track, the filled arc from the top and the number and caption in the middle. */
export const buildCalorieRingSvg = ({ ring, size, palette }: CalorieRingSvgInput): string => {
  const { size: box, radius, stroke, valueFont, captionFont, captionOffset } = RING_SIZES[size];
  const centre = box / 2;
  const circumference = 2 * Math.PI * radius;
  const circle = (colour: string, dash: string): string =>
    `<circle cx="${centre}" cy="${centre}" r="${radius}" fill="none" stroke="${colour}" stroke-width="${stroke}" stroke-linecap="round"${dash}/>`;
  const arc =
    ring.fraction > 0
      ? circle(
          palette[ring.fillRole],
          ` stroke-dasharray="${(ring.fraction * circumference).toFixed(1)} ${circumference.toFixed(1)}" transform="rotate(-90 ${centre} ${centre})"`,
        )
      : "";
  const text = (y: number, fontSize: number, weight: string, colour: string, content: string) =>
    `<text x="${centre}" y="${y}" text-anchor="middle" font-family="sans-serif" font-size="${fontSize}" font-weight="${weight}" fill="${colour}">${escapeText(content)}</text>`;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${box}" height="${box}" viewBox="0 0 ${box} ${box}" role="img" aria-label="${escapeText(ring.accessibleName)}">`,
    circle(palette[ring.trackRole], ""),
    arc,
    text(centre, valueFont, "700", palette.text, ring.value),
    text(centre + captionOffset, captionFont, "400", palette.textMuted, ring.caption),
    "</svg>",
  ].join("");
};
