import { ringNumbers } from "../diary/ringMaths";
import { formatCalories, formatGrams } from "../format/numbers";

/** The words on the calorie ring. They are the design's and are shared by both apps. */
export const CALORIE_RING = {
  remaining: "remaining",
  overTarget: "over target",
  /** The caption under the numeral when there is no target and the numeral is the calories eaten. */
  eaten: "eaten",
} as const;

/** The three macros as the diary labels them. */
export const MACRO_NAMES = {
  protein: "Protein",
  carbs: "Carbs",
  fat: "Fat",
} as const;

/** The ring's first line under the numeral, such as "1,039 eaten". */
export const describeEatenLine = (eatenCalories: number): string =>
  `${formatCalories(eatenCalories)} eaten`;

/** The ring's second line, such as "2,200 target". A target that is an estimate says so. */
export const describeTargetLine = (targetCalories: number, isEstimate: boolean): string =>
  `${formatCalories(targetCalories)} target${isEstimate ? " (est.)" : ""}`;

/**
 * What a screen reader says for the whole ring, as the dashboard board words it: "1,161 calories
 * remaining of 2,200", "212 calories over target of 2,200", or "1,039 calories eaten, no target set"
 * when the target is zero. It works from whole calories, as the ring does, so a day within half a
 * calorie of the target is not over it.
 */
export const describeCalorieRing = (eatenCalories: number, targetCalories: number): string => {
  const { remainingCalories, isOver, hasTarget } = ringNumbers(eatenCalories, targetCalories);
  if (!hasTarget) {
    return `${formatCalories(remainingCalories)} calories ${CALORIE_RING.eaten}, no target set`;
  }
  const target = formatCalories(Math.round(targetCalories));

  return isOver
    ? `${formatCalories(remainingCalories)} calories ${CALORIE_RING.overTarget} of ${target}`
    : `${formatCalories(remainingCalories)} calories ${CALORIE_RING.remaining} of ${target}`;
};

/**
 * What a screen reader says for one macro row, such as "Fat: 81 of 70 grams, 11 over". With no target
 * (zero) there is nothing to be of or over, so it reads only the grams eaten.
 */
export const describeMacroBar = (name: string, eatenGrams: number, targetGrams: number): string => {
  if (targetGrams <= 0) {
    return `${name}: ${formatGrams(eatenGrams)} grams`;
  }
  const over = eatenGrams > targetGrams ? `, ${formatGrams(eatenGrams - targetGrams)} over` : "";

  return `${name}: ${formatGrams(eatenGrams)} of ${formatGrams(targetGrams)} grams${over}`;
};

/** What follows the grams eaten on a macro row: "/ 160 g", or just "g" when there is no target. */
export const describeMacroTarget = (targetGrams: number): string =>
  targetGrams > 0 ? `/ ${formatGrams(targetGrams)} g` : "g";
