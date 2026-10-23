import { CALORIE_GOALS } from "../engine";

import type { ActivityLevel, CalorieGoal, Sex } from "../engine";
import type { WeightDisplayUnit } from "../weight";

/** The engine's goal list. The engine is the source because it is pure and setup imports from it. */
export const GOALS = CALORIE_GOALS;
export type SetupGoal = CalorieGoal;

export const HEIGHT_UNITS = ["cm", "ft_in"] as const;
export type HeightUnit = (typeof HEIGHT_UNITS)[number];

export const PROTEIN_PRESETS = ["moderate", "high", "very_high"] as const;
export type ProteinPreset = (typeof PROTEIN_PRESETS)[number];

/** The same strings as `programs.split_preset` and the keys of the engine's fat fraction params. */
export const DIET_STYLES = ["balanced", "low_fat", "low_carb"] as const;
export type DietStyle = (typeof DIET_STYLES)[number];

/** What a complete run of the wizard holds. The weight is in kilograms and the height in centimetres. */
export type SetupAnswers = Readonly<{
  sex: Sex;
  /** `YYYY-MM-DD`. */
  birthDate: string;
  heightCm: number;
  weightKg: number;
  /** The unit the weight was entered in, which the screens show it in. */
  weightUnit: WeightDisplayUnit;
  /** The unit the height was entered in, which the screens show it in. */
  heightUnit: HeightUnit;
  activity: ActivityLevel;
  goal: SetupGoal;
  /** A magnitude in percent of body weight a week, 0 for the maintain goal. */
  ratePctPerWeek: number;
  proteinPreset: ProteinPreset;
  dietStyle: DietStyle;
}>;

/** The answers so far, while the wizard is still being walked through. */
export type SetupDraft = Partial<SetupAnswers>;
