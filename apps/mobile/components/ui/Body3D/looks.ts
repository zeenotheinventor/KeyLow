import { MUSCLE_IDS } from "@keylow/core/training";

import { readMuscle } from "../BodyFigure";

import type { BodyFigureScale, BodyFigureValues } from "../BodyFigure";
import type { Look } from "@keylow/body-3d";
import type { MuscleId } from "@keylow/core/training";
import type { BodyMapPalette } from "@keylow/tokens";

/**
 * The emissive intensity a glow of alpha 1 stands for. 2D blurs the peak muscle by the token's alpha (0.55 in dark,
 * 0.35 in light) and 3D has no cheap blur, so the muscle is lit from within by the same alpha times this. It was
 * set by eye on the male body in both themes: at 1.2 the peak red washed out to salmon in dark, at 0.6 it was hard to
 * tell from the plain red. It is 0.5 in dark and 0.3 in light as an emissive of the glow colour on top of the muscle's own. Change it here and nowhere else.
 */
export const GLOW_INTENSITY_AT_FULL_ALPHA = 0.9;

const RGBA_PATTERN = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?\)$/;

/** An `rgb` or `rgba` string split into its opaque colour, which three.js reads, and its alpha, 1 when there is none. */
export function parseRgba(text: string): { color: string; alpha: number } {
  const match = RGBA_PATTERN.exec(text);
  if (match === null) {
    throw new Error("The glow colour is not an rgb or rgba string.");
  }
  const [, red, green, blue, alpha] = match;
  return {
    color: `rgb(${red}, ${green}, ${blue})`,
    alpha: alpha === undefined ? 1 : Number(alpha),
  };
}

/**
 * How warm a fill reads, for the head's neck colour to follow the warmer of the neck and the upper trapezius. On heat
 * it is the step. The volume and gap scales have no warmer or cooler, so a muscle in play reads 1 and one that is not
 * targeted, or not in the plan, reads 0.
 */
function warmthOf(scale: BodyFigureScale, fill: string, palette: BodyMapPalette): number {
  if (scale === "heat") {
    return Math.max(0, palette.heat.indexOf(fill));
  }
  const restingFill = scale === "volume" ? palette.volume.notTargeted : palette.gap.notInPlan;
  return fill === restingFill ? 0 : 1;
}

/**
 * The look of each of the 22 muscles, from the same `readMuscle` and palette as the 2D figure, so the same value
 * is the same colour in both. Only the peak heat step glows, by the palette's glow colour and alpha. A muscle with
 * no value, or one the scale does not have, is read as `readMuscle` reads it.
 */
export function looksOf(
  scale: BodyFigureScale,
  values: BodyFigureValues,
  palette: BodyMapPalette,
): Record<MuscleId, Look> {
  const { color: glowColor, alpha } = parseRgba(palette.heatGlow);
  const peakGlow = alpha * GLOW_INTENSITY_AT_FULL_ALPHA;
  // Object.fromEntries types its keys as strings. The list is the 22 ids, so every key of the record is there.
  return Object.fromEntries(
    MUSCLE_IDS.map((id) => {
      const { fill, isPeak } = readMuscle(scale, values[id], palette);
      return [
        id,
        {
          color: fill,
          glowColor,
          glow: isPeak ? peakGlow : 0,
          warmth: warmthOf(scale, fill, palette),
        },
      ];
    }),
  ) as Record<MuscleId, Look>;
}
