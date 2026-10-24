export { computeTrend } from "./computeTrend";
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
export { ACTIVITY_LEVELS, CALORIE_GOALS, CLAMPS, SEXES } from "./types";
export type { ActivityLevel, CalorieGoal, Clamp, Sex, TrendInput, TrendPoint } from "./types";
