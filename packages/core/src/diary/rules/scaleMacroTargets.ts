import type { ValidTargets } from "./validateTargets";

/** The most a macro target can be, in grams: the limit the assistant's `update_targets` accepts. */
export const MACRO_TARGET_MAXIMUM_G = 1000;

export type ScaledMacros = Pick<ValidTargets, "protein_g" | "carbs_g" | "fat_g">;

/** The person's targets right now: each is null when not set. */
export type CurrentMacroTargets = ScaledMacros & { kcal: number | null };

export type ScaleMacroTargetsResult =
  | {
      outcome: "scaled";
      macros: ScaledMacros;
      /** False when no macro was set, so there is nothing to tell the person about. */
      anyMacroSet: boolean;
    }
  /** There is no calorie target to take a proportion from. */
  | { outcome: "no_current_kcal" }
  /** A scaled macro came out above 1,000 g. */
  | { outcome: "over_limit" };

const scaleMacro = (grams: number | null, newKcal: number, currentKcal: number): number | null =>
  // Multiplied before dividing, so a value that lands on exactly .5 is not pushed under it by a fraction.
  grams === null ? null : Math.round((grams * newKcal) / currentKcal);

/**
 * Protein, carbs and fat for a new calorie target, each multiplied by the new calories over the current
 * calories and rounded to whole grams (a .5 rounds up). A macro that is null stays null.
 */
export function scaleMacroTargets(
  current: CurrentMacroTargets,
  newKcal: number,
): ScaleMacroTargetsResult {
  const { kcal: currentKcal } = current;
  if (currentKcal === null || !(currentKcal > 0)) {
    return { outcome: "no_current_kcal" };
  }
  const macros: ScaledMacros = {
    protein_g: scaleMacro(current.protein_g, newKcal, currentKcal),
    carbs_g: scaleMacro(current.carbs_g, newKcal, currentKcal),
    fat_g: scaleMacro(current.fat_g, newKcal, currentKcal),
  };
  const grams = Object.values(macros).filter((value) => value !== null);
  if (grams.some((value) => value > MACRO_TARGET_MAXIMUM_G)) {
    return { outcome: "over_limit" };
  }
  return { outcome: "scaled", macros, anyMacroSet: grams.length > 0 };
}
