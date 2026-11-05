import { MUSCLE_IDS, readMuscleValue } from "@keylow/core/training";

import type { Look } from "./Look";
import type { BodyFigureScale, BodyFigureTone, MuscleId } from "@keylow/core/training";
import type { BodyMapPalette } from "@keylow/tokens";

/** The value of each muscle, as the body map values of core encode it. A muscle left out is at rest. */
export type LookValues = Partial<Record<MuscleId, number>>;

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

/** The palette's colour for each colour token that core's reading names. The 2D figure on mobile uses this table too. */
export function fillsOf(palette: BodyMapPalette): Record<BodyFigureTone, string> {
  return {
    "heat-0": palette.heat[0],
    "heat-1": palette.heat[1],
    "heat-2": palette.heat[2],
    "heat-3": palette.heat[3],
    "heat-4": palette.heat[4],
    "heat-5": palette.heat[5],
    "volume-not-trained": palette.volume.notTrained,
    "volume-maintaining": palette.volume.maintaining,
    "volume-growing": palette.volume.growing,
    "volume-productive": palette.volume.productive,
    "volume-high": palette.volume.high,
    "gap-behind": palette.gap.behind,
    "gap-on-plan": palette.gap.onPlan,
    "gap-ahead": palette.gap.ahead,
    "role-primary": palette.role.primary,
    "role-secondary": palette.role.secondary,
    "role-assist": palette.role.assist,
  };
}

/**
 * How warm a fill reads, for the head's neck colour to follow the warmer of the neck and the upper trapezius. On heat
 * it is the step. The volume, gap and role scales have no warmer or cooler, so a muscle in play reads 1 and one that is
 * not trained, not in the plan or not worked reads 0.
 */
function warmthOf(scale: BodyFigureScale, fill: string, palette: BodyMapPalette): number {
  if (scale === "heat") {
    return Math.max(0, palette.heat.indexOf(fill));
  }
  const restingFills = {
    volume: palette.volume.notTrained,
    gap: palette.gap.notInPlan,
    role: palette.heat[0],
  };
  return fill === restingFills[scale] ? 0 : 1;
}

/**
 * The look of each of the 22 muscles, from the same reading of core and the same palette as the 2D figure, so the
 * same value is the same colour in both. Only the peak heat step glows, by the palette's glow colour and alpha. A
 * muscle with no value, or one the scale does not have, is read as core reads it.
 */
export function looksOf(
  scale: BodyFigureScale,
  values: LookValues,
  palette: BodyMapPalette,
): Record<MuscleId, Look> {
  const { color: glowColor, alpha } = parseRgba(palette.heatGlow);
  const peakGlow = alpha * GLOW_INTENSITY_AT_FULL_ALPHA;
  const fills = fillsOf(palette);
  // Object.fromEntries types its keys as strings. The list is the 22 ids, so every key of the record is there.
  return Object.fromEntries(
    MUSCLE_IDS.map((id) => {
      const { tone, isPeak } = readMuscleValue(scale, values[id]);
      const fill = fills[tone];
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
