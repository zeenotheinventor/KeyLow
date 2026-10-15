const KCAL_PER_GRAM_OF_PROTEIN = 4;
const KCAL_PER_GRAM_OF_FAT = 9;
const KCAL_PER_GRAM_OF_CARBOHYDRATE = 4;

/** The energy the three macros add up to (4, 9 and 4 kcal per gram). A null counts as 0. */
export const macroKcal = (
  proteinGrams: number | null,
  fatGrams: number | null,
  carbohydrateGrams: number | null,
): number =>
  (proteinGrams ?? 0) * KCAL_PER_GRAM_OF_PROTEIN +
  (fatGrams ?? 0) * KCAL_PER_GRAM_OF_FAT +
  (carbohydrateGrams ?? 0) * KCAL_PER_GRAM_OF_CARBOHYDRATE;
