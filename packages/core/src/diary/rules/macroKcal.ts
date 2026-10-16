const KCAL_PER_GRAM_OF_PROTEIN = 4;
const KCAL_PER_GRAM_OF_FAT = 9;
const KCAL_PER_GRAM_OF_CARBOHYDRATE = 4;

// A macro that is blank, or is text that is not a number, adds nothing, so the total is never NaN.
const gramsOrZero = (grams: number | null): number =>
  grams !== null && Number.isFinite(grams) ? grams : 0;

/**
 * The energy the three macros add up to (4, 9 and 4 kcal per gram). A null, and a value that is not a
 * finite number, count as 0.
 */
export const macroKcal = (
  proteinGrams: number | null,
  fatGrams: number | null,
  carbohydrateGrams: number | null,
): number =>
  gramsOrZero(proteinGrams) * KCAL_PER_GRAM_OF_PROTEIN +
  gramsOrZero(fatGrams) * KCAL_PER_GRAM_OF_FAT +
  gramsOrZero(carbohydrateGrams) * KCAL_PER_GRAM_OF_CARBOHYDRATE;
