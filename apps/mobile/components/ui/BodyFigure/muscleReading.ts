import { readMuscleValue } from "@keylow/core/training";

import type { BodyFigureScale } from "./types";
import type { BodyFigureTone } from "@keylow/core/training";
import type { BodyMapPalette } from "@keylow/tokens";

/*
 * What a value means on each scale is core's `readMuscleValue`: the colour token a muscle is filled with and
 * the word the screen reader says. Mobile only turns the token into the palette's colour string, because
 * `react-native-svg` fills cannot read a CSS variable.
 */

export type MuscleReading = {
  fill: string;
  /** The value in words, such as "Hot". */
  valueName: string;
  /** Whether the muscle glows, which only the peak heat step does. */
  isPeak: boolean;
};

function fillsOf(palette: BodyMapPalette): Record<BodyFigureTone, string> {
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
 * The fill and the spoken value of one muscle on one scale. A muscle with no value, or a value the scale
 * does not have, is drawn at rest on heat, not trained on volume, not in the plan on gap and not worked on role.
 */
export function readMuscle(
  scale: BodyFigureScale,
  value: number | undefined,
  palette: BodyMapPalette,
): MuscleReading {
  const { tone, valueName, isPeak } = readMuscleValue(scale, value);
  return { fill: fillsOf(palette)[tone], valueName, isPeak };
}
