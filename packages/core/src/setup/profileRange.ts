import type { Clamp } from "../engine";

/**
 * The top of `profiles_target_kcal_range` (ADR 0003, Amendment 4), the most calories a stored target
 * can hold. This file reaches the engine with a type import only, so the engine can import it without a
 * cycle.
 */
export const PROFILE_MAX_KCAL = 6000;

/** The bottom of the profile and targets range, the fewest calories a stored target or a day can hold. */
export const PROFILE_MIN_KCAL = 800;

/** The engine's clamps plus `profile_max`, which belongs to the setup layer and not to the engine. */
export type SetupClamp = Clamp | "profile_max";

/**
 * Cuts calories above `PROFILE_MAX_KCAL` back to it and records `profile_max` after the clamps already
 * recorded (ADR 0002, Amendment 1, "How the wizard uses it"). Calories at or below it, and the clamps
 * with them, come back unchanged. Pass the calorie clamps only: a `macro_fit` clamp recorded for the
 * calories before the cap is no longer true after it, so the caller drops it and records the new one.
 * The macros and the effective rate are not touched here: a caller whose calories were
 * lowered splits the macros again and restates the rate for the new calories, as `startingPlan` does.
 */
export function capToProfileRange(
  caloriesKcal: number,
  clamps: readonly SetupClamp[],
): Readonly<{ caloriesKcal: number; clamps: readonly SetupClamp[] }> {
  if (caloriesKcal <= PROFILE_MAX_KCAL) {
    return { caloriesKcal, clamps: [...clamps] };
  }
  return { caloriesKcal: PROFILE_MAX_KCAL, clamps: [...clamps, "profile_max"] };
}
