export { computeTrend } from "./computeTrend";
export { dayTarget } from "./dayTarget";
export type { DayAdjustments, DayTargetInput } from "./dayTarget";
export { bmrMifflinStJeor, initialExpenditure } from "./initialExpenditure";
export type { BmrInput, InitialExpenditure, InitialExpenditureInput } from "./initialExpenditure";
export {
  deriveCalorieTarget,
  deriveTargets,
  effectiveRatePctPerWeek,
  splitMacros,
} from "./deriveTargets";
export type {
  CalorieTarget,
  CalorieTargetInput,
  MacroSplit,
  MacroSplitInput,
  DerivedTargets,
  DeriveTargetsConfig,
  DeriveTargetsInput,
  EffectiveRateInput,
} from "./deriveTargets";
export { DEFAULT_ENGINE_PARAMS, ENGINE_VERSION } from "./params";
export type { EngineParams, ExpenditureParams, TargetsParams, TrendParams } from "./params";
export { ACTIVITY_LEVELS, CALORIE_GOALS, CLAMPS, SEXES, toDayOfWeekKcal } from "./types";
export type {
  ActivityLevel,
  CalorieGoal,
  Clamp,
  DayOfWeekKcal,
  Sex,
  TrendInput,
  TrendPoint,
} from "./types";
