export { checkBirthDate, MAX_AGE_YEARS, MIN_AGE_YEARS } from "./birthDate";
export type { BirthDateReason, BirthDateResult } from "./birthDate";
export { defaultGoalForAge, goalsAllowed, isRateGoal, resetGoalForAge, withGoal } from "./goals";
export {
  centimetresToFeetAndInches,
  checkHeightCm,
  HEIGHT_MAX_CM,
  HEIGHT_MIN_CM,
  parseHeightInput,
} from "./height";
export type {
  HeightCheck,
  HeightInput,
  HeightInputReason,
  HeightInputResult,
  HeightReason,
} from "./height";
export {
  DEFAULT_DIET_STYLE,
  DEFAULT_PROTEIN_PRESET,
  DEFAULT_RATE_PCT_PER_WEEK,
  DIET_FAT_FRACTION_OF_REMAINDER,
  nearestRatePreset,
  PROTEIN_G_PER_KG,
  RATE_PRESETS_PCT_PER_WEEK,
  ratePerWeekKg,
} from "./presets";
export { capToProfileRange, PROFILE_MAX_KCAL } from "./profileRange";
export type { SetupClamp } from "./profileRange";
export { setupAnswersSchemaFor } from "./schema";
export {
  nextStep,
  previousStep,
  progressFraction,
  SETUP_STEPS,
  stepCount,
  stepNumber,
} from "./steps";
export type { SetupStep } from "./steps";
export { startingPlan } from "./startingPlan";
export { DIET_STYLES, GOALS, HEIGHT_UNITS, PROTEIN_PRESETS } from "./types";
export type {
  DietStyle,
  HeightUnit,
  ProteinPreset,
  RateGoal,
  SetupAnswers,
  SetupDraft,
  SetupGoal,
  SetupProfileSave,
  SetupProgramSave,
  SetupWeighInSave,
  StartingPlan,
} from "./types";
export { defaultUnitsForRegion, entryWeightUnit, heightUnitFor, weightUnitToSave } from "./units";
export type { DefaultUnits } from "./units";
export { bindingCalorieClamp } from "./bindingClamp";
export type { CalorieClampCode } from "./bindingClamp";
