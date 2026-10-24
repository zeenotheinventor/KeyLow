import { effectiveRatePctPerWeek, splitMacros } from "./deriveTargets";
import { DEFAULT_ENGINE_PARAMS } from "./params";
import { capToProfileRange } from "../setup/profileRange";

import type { DerivedTargets, DeriveTargetsInput } from "./deriveTargets";
import type { EngineParams } from "./params";
import type { SetupClamp } from "../setup/profileRange";

export type CappedTargets = Readonly<{
  /** At most 6000. */
  caloriesKcal: number;
  /** Whole grams, for `caloriesKcal`. */
  proteinG: number;
  fatG: number;
  carbsG: number;
  /** The calorie clamps, then `profile_max` when the cap bit, then the macro clamps of the calories now stored. */
  clamps: readonly SetupClamp[];
  /** Restated for `caloriesKcal` when the cap bit. True and signed, as `deriveTargets` reports it. */
  effectiveRatePctPerWeek: number;
}>;

/**
 * Applies the setup layer's 6000 cap to what `deriveTargets` returned (ADR 0002, Amendment 1, "How the
 * wizard uses it", and Amendment 2, "Key sets and the 6000 cap"). Calories at or under 6000 come back as
 * `derived` has them. A cap that bites records `profile_max`, splits the macros again for the capped
 * calories and restates the effective rate, because the macros and the rate of the uncapped calories no
 * longer fit what is stored. A `macro_fit` recorded for the uncapped calories is dropped first, so the
 * list holds the one the capped split records. `input` is the same input `deriveTargets` was given.
 * The weekday calories need no change: they are already worked out from the week held within the range.
 */
export function applyProfileCap(
  derived: DerivedTargets,
  { config, tdee, trendWeight }: DeriveTargetsInput,
  params: EngineParams = DEFAULT_ENGINE_PARAMS,
): CappedTargets {
  const capped = capToProfileRange(
    derived.caloriesKcal,
    derived.clamps.filter((clamp) => clamp !== "macro_fit"),
  );
  if (capped.caloriesKcal === derived.caloriesKcal) {
    return {
      caloriesKcal: derived.caloriesKcal,
      proteinG: derived.proteinG,
      fatG: derived.fatG,
      carbsG: derived.carbsG,
      clamps: derived.clamps,
      effectiveRatePctPerWeek: derived.effectiveRatePctPerWeek,
    };
  }

  const macros = splitMacros(
    {
      caloriesKcal: capped.caloriesKcal,
      trendWeight,
      proteinGPerKg: config.proteinGPerKg,
      fatFraction: config.fatFraction,
    },
    params,
  );
  return {
    caloriesKcal: capped.caloriesKcal,
    proteinG: macros.proteinG,
    fatG: macros.fatG,
    carbsG: macros.carbsG,
    clamps: [...capped.clamps, ...macros.clamps],
    effectiveRatePctPerWeek: effectiveRatePctPerWeek(
      { goal: config.goal, caloriesKcal: capped.caloriesKcal, tdee, trendWeight },
      params,
    ),
  };
}
