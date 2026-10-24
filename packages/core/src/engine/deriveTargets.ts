import { DEFAULT_ENGINE_PARAMS } from "./params";
import { PROFILE_MAX_KCAL, PROFILE_MIN_KCAL } from "../setup/profileRange";

import type { EngineParams } from "./params";
import type { CalorieGoal, Clamp, DayOfWeekKcal } from "./types";

export type CalorieTargetInput = Readonly<{
  goal: CalorieGoal;
  /** The wanted rate in percent of body weight a week. It is ignored for `maintain`. */
  ratePctPerWeek: number;
  /** Daily energy expenditure, in kilocalories. */
  tdee: number;
  /** The trend weight, in kilograms. */
  trendWeight: number;
  /** Basal metabolic rate, in kilocalories a day. */
  bmr: number;
}>;

export type CalorieTarget = Readonly<{
  /** A multiple of `roundToKcal`, inside every guardrail. */
  caloriesKcal: number;
  /** The guardrails that changed the unrounded target, in the order they were applied. */
  clamps: readonly Clamp[];
  /**
   * The rate the final calories imply, in percent of body weight a week. True and signed: positive
   * means movement in the goal's direction, so it is negative when the floor lifts a lose target above tdee.
   */
  effectiveRatePctPerWeek: number;
}>;

const DAYS_PER_WEEK = 7;

/** The daily kilocalories that one percent of the trend weight a week is worth. */
function dailyKcalPerPercentPerWeekAt(trendWeight: number, params: EngineParams): number {
  return (trendWeight * params.expenditure.energyDensityKcalPerKg) / DAYS_PER_WEEK / 100;
}

/** The lowest a lose target can be, in kilocalories a day: the larger of the absolute floor and the BMR share. */
export function calorieFloorKcal(bmr: number, params: EngineParams): number {
  const { targets } = params;
  return Math.max(targets.floorAbsKcal, targets.floorBmrFactor * bmr);
}

export type EffectiveRateInput = Readonly<{
  goal: CalorieGoal;
  /** The calories the target ends up at, in kilocalories a day. */
  caloriesKcal: number;
  /** Daily energy expenditure, in kilocalories. */
  tdee: number;
  /** The trend weight, in kilograms. */
  trendWeight: number;
}>;

/**
 * The rate that `caloriesKcal` implies, in percent of body weight a week. True and signed: positive
 * means movement in the goal's direction, and `maintain` is always 0. A caller that changes the calories
 * after `deriveCalorieTarget` (the setup layer's 6000 cap) uses this to restate the rate.
 */
export function effectiveRatePctPerWeek(
  { goal, caloriesKcal, tdee, trendWeight }: EffectiveRateInput,
  params: EngineParams = DEFAULT_ENGINE_PARAMS,
): number {
  if (goal === "maintain") return 0;
  const movedKcal = goal === "lose" ? tdee - caloriesKcal : caloriesKcal - tdee;
  return movedKcal / dailyKcalPerPercentPerWeekAt(trendWeight, params);
}

/**
 * The calorie half of `deriveTargets`, as the Build Plan's Targets section and ADR 0002, Amendment 1
 * specify it. The 6000 profile maximum is the setup layer's.
 */
export function deriveCalorieTarget(
  { goal, ratePctPerWeek, tdee, trendWeight, bmr }: CalorieTargetInput,
  params: EngineParams = DEFAULT_ENGINE_PARAMS,
): CalorieTarget {
  const { targets } = params;
  const clamps: Clamp[] = [];
  const dailyKcalPerPercentPerWeek = dailyKcalPerPercentPerWeekAt(trendWeight, params);

  const lowestKcal = tdee * (1 - targets.maxDeficitFrac);
  const floorKcal = calorieFloorKcal(bmr, params);
  const highestKcal = tdee * (1 + targets.maxSurplusFrac);

  let rawKcal = tdee;
  if (goal === "lose") {
    if (ratePctPerWeek > targets.maxLossPct) clamps.push("max_rate");
    rawKcal = tdee - Math.min(ratePctPerWeek, targets.maxLossPct) * dailyKcalPerPercentPerWeek;
    if (rawKcal < lowestKcal) {
      rawKcal = lowestKcal;
      clamps.push("max_deficit");
    }
    if (rawKcal < floorKcal) {
      rawKcal = floorKcal;
      clamps.push("floor");
    }
  } else if (goal === "gain") {
    if (ratePctPerWeek > targets.maxGainPct) clamps.push("max_rate");
    rawKcal = tdee + Math.min(ratePctPerWeek, targets.maxGainPct) * dailyKcalPerPercentPerWeek;
    if (rawKcal > highestKcal) {
      rawKcal = highestKcal;
      clamps.push("max_surplus");
    }
  }

  // Rounding to the nearest step can cross a bound that is not a multiple of the step, so step back inside it.
  const step = targets.roundToKcal;
  let caloriesKcal = Math.round(rawKcal / step) * step;
  if (goal === "lose") {
    caloriesKcal = Math.max(caloriesKcal, Math.ceil(Math.max(lowestKcal, floorKcal) / step) * step);
  } else if (goal === "gain") {
    caloriesKcal = Math.min(caloriesKcal, Math.floor(highestKcal / step) * step);
  }

  return {
    caloriesKcal,
    clamps,
    effectiveRatePctPerWeek: effectiveRatePctPerWeek(
      { goal, caloriesKcal, tdee, trendWeight },
      params,
    ),
  };
}

const KCAL_PER_GRAM_OF_PROTEIN_OR_CARBS = 4;
const KCAL_PER_GRAM_OF_FAT = 9;

export type MacroSplitInput = Readonly<{
  /** The day's calories, in kilocalories. */
  caloriesKcal: number;
  /** The trend weight, in kilograms. */
  trendWeight: number;
  /** The wanted protein, in grams for each kilogram of trend weight. It is capped by the params. */
  proteinGPerKg: number;
  /** The share of the calories left after protein that goes to fat. */
  fatFraction: number;
}>;

export type MacroSplit = Readonly<{
  /** Whole grams. */
  proteinG: number;
  /** Whole grams. */
  fatG: number;
  /** Whole grams. */
  carbsG: number;
  /** `macro_fit` when protein had to give way to the fat floor, otherwise empty. */
  clamps: readonly Clamp[];
}>;

/**
 * Splits calories into grams of protein, fat and carbs, protein first. Fat takes its fraction of what
 * protein leaves, never less than the fat floor, and carbs fill the rest. When protein and the fat floor
 * together do not fit, the fat floor wins (ADR 0002, Amendment 1): protein is cut to what fits, carbs are
 * 0 and `macro_fit` is recorded. When the fat floor alone is over the calories, fat is the whole grams
 * that fit, protein and carbs are 0 and `macro_fit` is recorded.
 */
export function splitMacros(
  { caloriesKcal, trendWeight, proteinGPerKg, fatFraction }: MacroSplitInput,
  params: EngineParams = DEFAULT_ENGINE_PARAMS,
): MacroSplit {
  const { proteinMaxGPerKg, fatMinGPerKg } = params.targets;

  const wantedProteinG = Math.round(Math.min(proteinGPerKg, proteinMaxGPerKg) * trendWeight);
  const fatFloorG = Math.round(fatMinGPerKg * trendWeight);

  if (KCAL_PER_GRAM_OF_FAT * fatFloorG > caloriesKcal) {
    const fatG = Math.floor(caloriesKcal / KCAL_PER_GRAM_OF_FAT);
    return { proteinG: 0, fatG, carbsG: 0, clamps: ["macro_fit"] };
  }

  if (
    KCAL_PER_GRAM_OF_PROTEIN_OR_CARBS * wantedProteinG + KCAL_PER_GRAM_OF_FAT * fatFloorG >
    caloriesKcal
  ) {
    const proteinG = Math.floor(
      (caloriesKcal - KCAL_PER_GRAM_OF_FAT * fatFloorG) / KCAL_PER_GRAM_OF_PROTEIN_OR_CARBS,
    );
    return { proteinG, fatG: fatFloorG, carbsG: 0, clamps: ["macro_fit"] };
  }

  const afterProteinKcal = caloriesKcal - KCAL_PER_GRAM_OF_PROTEIN_OR_CARBS * wantedProteinG;
  const fatG = Math.max(
    Math.round((fatFraction * afterProteinKcal) / KCAL_PER_GRAM_OF_FAT),
    fatFloorG,
  );
  const carbsG = Math.round(
    (afterProteinKcal - KCAL_PER_GRAM_OF_FAT * fatG) / KCAL_PER_GRAM_OF_PROTEIN_OR_CARBS,
  );

  return { proteinG: wantedProteinG, fatG, carbsG, clamps: [] };
}

export type DeriveTargetsConfig = Readonly<{
  goal: CalorieGoal;
  /** The wanted rate in percent of body weight a week. It is ignored for `maintain`. */
  ratePctPerWeek: number;
  /** The wanted protein, in grams for each kilogram of trend weight. */
  proteinGPerKg: number;
  /** The share of the calories left after protein that goes to fat. */
  fatFraction: number;
  /**
   * Kilocalories to add to the week's calories on each weekday, Monday first. They hold whole numbers
   * and sum to 0. All zeros when missing.
   */
  dowOffsetsKcal?: DayOfWeekKcal;
}>;

export type DeriveTargetsInput = Readonly<{
  config: DeriveTargetsConfig;
  /** Daily energy expenditure, in kilocalories. */
  tdee: number;
  /** The trend weight, in kilograms. */
  trendWeight: number;
  /** Basal metabolic rate, in kilocalories a day. */
  bmr: number;
}>;

export type DerivedTargets = Readonly<{
  caloriesKcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  /** The calories for each weekday, Monday first. The macros stay those of the week. */
  dowCaloriesKcal: DayOfWeekKcal;
  /** The calorie clamps in the order they were applied, then `dow_floor` and `dow_range`, then `macro_fit`. */
  clamps: readonly Clamp[];
  effectiveRatePctPerWeek: number;
  engineVersion: EngineParams["version"];
}>;

const NO_OFFSETS_KCAL: DayOfWeekKcal = [0, 0, 0, 0, 0, 0, 0];

/**
 * The day of week offsets are checked as `programs.dow_offsets_kcal` is (ADR 0003, Amendment 12): length 7,
 * no null element, elements sum to 0. A stored array can hold anything, so this checks what the type
 * promises. The messages state the rule and never a value.
 */
function assertValidDayOfWeekOffsets(offsetsKcal: readonly unknown[]): void {
  if (offsetsKcal.length !== DAYS_PER_WEEK || !offsetsKcal.every(Number.isInteger)) {
    throw new RangeError("The day of week offsets must hold 7 whole numbers, Monday first.");
  }
  if (offsetsKcal.reduce<number>((sum, offsetKcal) => sum + Number(offsetKcal), 0) !== 0) {
    throw new RangeError("The day of week offsets must sum to 0.");
  }
}

type DayCaloriesInput = Readonly<{
  goal: CalorieGoal;
  caloriesKcal: number;
  offsetsKcal: DayOfWeekKcal;
  bmr: number;
}>;

type DayCalories = Readonly<{
  dowCaloriesKcal: DayOfWeekKcal;
  /** `dow_floor` then `dow_range`, each at most once. */
  clamps: readonly Clamp[];
}>;

/**
 * The calories for each weekday (ADR 0002, Amendment 2, "Day-of-week offsets"). Each day starts from the
 * week's calories held within 800 to 6000, so a week the setup layer's 6000 cap will lower still gives the
 * days that cap leaves. The offset is added and the day rounded to the nearest step. For `lose` only, a day
 * below the floor is stepped up to it and `dow_floor` is recorded. For every goal, a day outside 800 to 6000
 * is stepped back inside it and `dow_range` is recorded.
 */
function deriveDayCalories(
  { goal, caloriesKcal, offsetsKcal, bmr }: DayCaloriesInput,
  params: EngineParams,
): DayCalories {
  const step = params.targets.roundToKcal;
  const floorKcal = calorieFloorKcal(bmr, params);
  const lowestKcal = Math.ceil(PROFILE_MIN_KCAL / step) * step;
  const highestKcal = Math.floor(PROFILE_MAX_KCAL / step) * step;
  const keepInRange = (kcal: number): number => Math.min(Math.max(kcal, lowestKcal), highestKcal);
  const weekKcal = keepInRange(caloriesKcal);
  const recorded = { floor: false, range: false };

  const dayCalories = (offsetKcal: number): number => {
    let dayKcal = Math.round((weekKcal + offsetKcal) / step) * step;
    if (goal === "lose" && dayKcal < floorKcal) {
      dayKcal = Math.ceil(floorKcal / step) * step;
      recorded.floor = true;
    }
    const inRangeKcal = keepInRange(dayKcal);
    if (inRangeKcal !== dayKcal) recorded.range = true;
    return inRangeKcal;
  };

  const [monday, tuesday, wednesday, thursday, friday, saturday, sunday] = offsetsKcal;
  const dowCaloriesKcal: DayOfWeekKcal = [
    dayCalories(monday),
    dayCalories(tuesday),
    dayCalories(wednesday),
    dayCalories(thursday),
    dayCalories(friday),
    dayCalories(saturday),
    dayCalories(sunday),
  ];
  const clamps: Clamp[] = [];
  if (recorded.floor) clamps.push("dow_floor");
  if (recorded.range) clamps.push("dow_range");

  return { dowCaloriesKcal, clamps };
}

/**
 * The daily targets: calories from `deriveCalorieTarget`, then the macros from `splitMacros`, then the
 * calories for each weekday from the day of week offsets. The offsets throw a `RangeError` when they are
 * not 7 whole numbers that sum to 0. The macros stay weekly.
 */
export function deriveTargets(
  { config, tdee, trendWeight, bmr }: DeriveTargetsInput,
  params: EngineParams = DEFAULT_ENGINE_PARAMS,
): DerivedTargets {
  const {
    goal,
    ratePctPerWeek,
    proteinGPerKg,
    fatFraction,
    dowOffsetsKcal = NO_OFFSETS_KCAL,
  } = config;
  assertValidDayOfWeekOffsets(dowOffsetsKcal);
  const calorieTarget = deriveCalorieTarget(
    { goal, ratePctPerWeek, tdee, trendWeight, bmr },
    params,
  );
  const macros = splitMacros(
    { caloriesKcal: calorieTarget.caloriesKcal, trendWeight, proteinGPerKg, fatFraction },
    params,
  );
  const days = deriveDayCalories(
    { goal, caloriesKcal: calorieTarget.caloriesKcal, offsetsKcal: dowOffsetsKcal, bmr },
    params,
  );

  return {
    caloriesKcal: calorieTarget.caloriesKcal,
    proteinG: macros.proteinG,
    fatG: macros.fatG,
    carbsG: macros.carbsG,
    dowCaloriesKcal: days.dowCaloriesKcal,
    clamps: [...calorieTarget.clamps, ...days.clamps, ...macros.clamps],
    effectiveRatePctPerWeek: calorieTarget.effectiveRatePctPerWeek,
    engineVersion: params.version,
  };
}
