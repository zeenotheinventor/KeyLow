import { fillsOf } from "@keylow/body-3d/looksOf";
import { readMuscleValue } from "@keylow/core/training";

import type { BodyFigureScale } from "./types";
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
