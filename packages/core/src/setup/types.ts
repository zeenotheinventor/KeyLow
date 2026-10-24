import { CALORIE_GOALS } from "../engine";

import type { ActivityLevel, CalorieGoal, Sex } from "../engine";
import type { WeightDisplayUnit } from "../weight";
import type { SetupClamp } from "./profileRange";

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

/** The columns of `profiles` the wizard writes. The repo adds `onboarding_completed_at` and `targets_updated_at`. */
export type SetupProfileSave = Readonly<{
  sex: Sex;
  birth_date: string;
  height_cm: number;
  activity: ActivityLevel;
  onboarding_weight_kg: number;
  target_kcal: number;
  target_protein_g: number;
  target_carbs_g: number;
  target_fat_g: number;
  /** Present only when no unit is stored. A stored unit is never overwritten (ADR 0003, Amendment 12). */
  weight_unit?: WeightDisplayUnit;
}>;

/** The columns of `programs` the wizard writes. `started_on` is for the insert only. */
export type SetupProgramSave = Readonly<{
  goal: SetupGoal;
  /** A magnitude, 0 for the maintain goal. */
  rate_pct_per_week: number;
  protein_g_per_kg: number;
  fat_fraction_of_remaining: number;
  split_preset: DietStyle;
  started_on: string;
}>;

/** What the wizard records as the weigh-in of the weight entered. */
export type SetupWeighInSave = Readonly<{ weightKg: number; localDate: string }>;

/** What the estimate screen shows and what the api-client saves, from one set of answers. */
export type StartingPlan = Readonly<{
  estimate: Readonly<{
    bmrKcal: number;
    /** The unrounded estimate of daily energy use. The screen rounds it to whole kilocalories. */
    expenditureKcal: number;
  }>;
  targets: Readonly<{ caloriesKcal: number; proteinG: number; fatG: number; carbsG: number }>;
  /** The guardrails that changed the result: the engine's, then `profile_max` when the 6000 cap bit. */
  clamps: readonly SetupClamp[];
  /** Signed, as the engine gives it: negative when the floor lifts a lose target above expenditure. */
  effectiveRatePctPerWeek: number;
  save: Readonly<{
    profile: SetupProfileSave;
    program: SetupProgramSave;
    weighIn: SetupWeighInSave;
  }>;
}>;
