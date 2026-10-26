import type { LoggableRecipe } from "../../src/diary";
import type { PlateHit } from "../../src/plate";

// The made-up sample of the plate boards (canvas "Ki-Lo plate", LogSearchScreen renderVals): eaten today is the
// M3 sample day, and the plate is the evening food. Values are per 100 g or 100 ml, so the plate maths has to
// scale them to the serving the row shows.

/** The M3 sample day the strip starts from: 1,039 kcal. */
export const EATEN_TODAY_KCAL = 187 + 92 + 95 + 222 + 216 + 130 + 97;

const noHit = {
  default_portion_id: null,
  default_portion_label: null,
  default_portion_grams: null,
  default_portion_ml: null,
} as const;

/** The M4 recipe: 4 servings of 275 g, 374.2 kcal a serving. */
export const chickenAndRice: LoggableRecipe = {
  id: "00000000-0000-4000-8000-0000000000a1",
  name: "Chicken and rice",
  servings: 4,
  yield_grams: null,
  computed: {
    effectiveGrams: 1100,
    total: { kcal: 1496.8, protein_g: 126.5, carbs_g: 170.2, fat_g: 32.5, fibre_g: null },
  },
};

/** 1 pot (170 g) is 97 kcal, 17.3 g protein, 6.5 g carbs and 0.3 g fat. */
export const greekYoghurt: PlateHit = {
  id: "00000000-0000-4000-8000-0000000000b1",
  name: "Greek yoghurt 0% fat",
  basis: "per_100g",
  kcal: 97 / 1.7,
  protein_g: 17.3 / 1.7,
  carbs_g: 6.5 / 1.7,
  fat_g: 0.3 / 1.7,
  default_portion_id: "00000000-0000-4000-8000-0000000000b2",
  default_portion_label: "1 pot",
  default_portion_grams: 170,
  default_portion_ml: null,
};

/** 1 medium (100 g) is 95 kcal, 1.2 g protein, 20.3 g carbs and 0.1 g fat. */
export const banana: PlateHit = {
  id: "00000000-0000-4000-8000-0000000000c1",
  name: "Banana",
  basis: "per_100g",
  kcal: 95,
  protein_g: 1.2,
  carbs_g: 20.3,
  fat_g: 0.1,
  default_portion_id: "00000000-0000-4000-8000-0000000000c2",
  default_portion_label: "1 medium",
  default_portion_grams: 100,
  default_portion_ml: null,
};

/** A drink per 100 ml with no portion: the row shows 100 ml, and 200 ml is 92 kcal, 7 g protein, 9.6 g carbs, 3.4 g fat. */
export const semiSkimmedMilk: PlateHit = {
  id: "00000000-0000-4000-8000-0000000000d1",
  name: "Semi-skimmed milk",
  basis: "per_100ml",
  kcal: 46,
  protein_g: 3.5,
  carbs_g: 4.8,
  fat_g: 1.7,
  ...noHit,
};

/** The over plate's ready meal: 1 pack (450 g) is 612 kcal. */
export const readyMeal: PlateHit = {
  id: "00000000-0000-4000-8000-0000000000e1",
  name: "Chicken tikka masala with pilau rice, ready meal, Taste the Difference",
  basis: "per_100g",
  kcal: 612 / 4.5,
  protein_g: 38 / 4.5,
  carbs_g: 74 / 4.5,
  fat_g: 18 / 4.5,
  default_portion_id: "00000000-0000-4000-8000-0000000000e2",
  default_portion_label: "1 pack",
  default_portion_grams: 450,
  default_portion_ml: null,
};

/** 1 naan (160 g) is 437 kcal. */
export const naan: PlateHit = {
  id: "00000000-0000-4000-8000-0000000000f1",
  name: "Naan bread, plain",
  basis: "per_100g",
  kcal: 437 / 1.6,
  protein_g: 12.6 / 1.6,
  carbs_g: 80 / 1.6,
  fat_g: 7.4 / 1.6,
  default_portion_id: "00000000-0000-4000-8000-0000000000f2",
  default_portion_label: "1 naan",
  default_portion_grams: 160,
  default_portion_ml: null,
};
