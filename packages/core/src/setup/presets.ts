import type { DietStyle, ProteinPreset, SetupGoal } from "./types";

/*
 * The preset values of Zee's ruling 7 and the Build Plan. The defaults are the planner's, and the
 * boards may change them. The rates are magnitudes in percent of body weight a week.
 */
export const RATE_PRESETS_PCT_PER_WEEK: Readonly<Record<SetupGoal, readonly number[]>> = {
  lose: [0.25, 0.5, 0.75, 1.0],
  maintain: [0],
  gain: [0.1, 0.25, 0.5],
};

export const DEFAULT_RATE_PCT_PER_WEEK: Readonly<Record<SetupGoal, number>> = {
  lose: 0.5,
  maintain: 0,
  gain: 0.25,
};

export const PROTEIN_G_PER_KG: Readonly<Record<ProteinPreset, number>> = {
  moderate: 1.6,
  high: 2.0,
  very_high: 2.2,
};

export const DEFAULT_PROTEIN_PRESET: ProteinPreset = "moderate";

/** The fat fraction of the calories left after protein. The keys are the engine's, so nothing maps them. */
export const DIET_FAT_FRACTION_OF_REMAINDER: Readonly<Record<DietStyle, number>> = {
  balanced: 0.4,
  low_fat: 0.28,
  low_carb: 0.6,
};

export const DEFAULT_DIET_STYLE: DietStyle = "balanced";

/** The kilograms a week that a rate is worth at this weight, for the "about 0.4 kg a week" line. Not rounded. */
export function ratePerWeekKg(ratePctPerWeek: number, weightKg: number): number {
  return (weightKg * ratePctPerWeek) / 100;
}
