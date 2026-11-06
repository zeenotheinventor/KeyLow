import { progressBars } from "@keylow/core/diary";
import {
  plateItemOfHit,
  plateItemOfRecipe,
  plateTotals,
  setPlateQuantity,
} from "@keylow/core/plate";

import type { LoggableRecipe } from "@keylow/core/diary";
import type { PlateHit, PlateItem } from "@keylow/core/plate";

// The golden data of the plate boards (docs/design/web/proposals/plate.md), all made up: Thursday 15 October
// with 1,039 kcal eaten, and the evening's four foods. They are what the panel's stories and tests draw.

const chickenAndRice: LoggableRecipe = {
  id: "00000000-0000-4000-8000-0000000000a1",
  name: "Chicken and rice",
  servings: 4,
  yield_grams: null,
  computed: {
    effectiveGrams: 1100,
    total: { kcal: 1496.8, protein_g: 126.5, carbs_g: 170.2, fat_g: 32.5, fibre_g: null },
  },
};

/** 1 pot (170 g) is 97 kcal. */
const greekYoghurt: PlateHit = {
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

/** 1 medium (100 g) is 95 kcal. */
const banana: PlateHit = {
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

/** A drink per 100 ml with no portion: 200 ml is 92 kcal. */
const semiSkimmedMilk: PlateHit = {
  id: "00000000-0000-4000-8000-0000000000d1",
  name: "Semi-skimmed milk",
  basis: "per_100ml",
  kcal: 46,
  protein_g: 3.5,
  carbs_g: 4.8,
  fat_g: 1.7,
  default_portion_id: null,
  default_portion_label: null,
  default_portion_grams: null,
  default_portion_ml: null,
};

/** 1 naan (100 g here) is 430 kcal. */
const naan: PlateHit = {
  id: "00000000-0000-4000-8000-0000000000f1",
  name: "Naan bread",
  basis: "per_100g",
  kcal: 430,
  protein_g: 12,
  carbs_g: 72,
  fat_g: 8.5,
  default_portion_id: "00000000-0000-4000-8000-0000000000f2",
  default_portion_label: "1 naan",
  default_portion_grams: 100,
  default_portion_ml: null,
};

/** 1 bag (100 g here) is 130 kcal. */
const crisps: PlateHit = {
  id: "00000000-0000-4000-8000-0000000000e1",
  name: "Meal deal crisps",
  basis: "per_100g",
  kcal: 130,
  protein_g: 2,
  carbs_g: 15,
  fat_g: 7,
  default_portion_id: "00000000-0000-4000-8000-0000000000e2",
  default_portion_label: "1 bag",
  default_portion_grams: 100,
  default_portion_ml: null,
};

/** Chicken and rice, Greek yoghurt, Banana and 200 ml of milk: 658 kcal, 1,697 with the day. */
export const goldenPlate: readonly PlateItem[] = setPlateQuantity(
  [
    plateItemOfRecipe({ key: "chicken-and-rice", recipe: chickenAndRice }),
    plateItemOfHit("greek-yoghurt", greekYoghurt),
    plateItemOfHit("banana", banana),
    plateItemOfHit("milk", semiSkimmedMilk),
  ],
  "milk",
  "200",
);

/** The golden plate with Naan bread and the crisps on top: 2,257 kcal with the day, over on calories and carbs. */
export const overPlate: readonly PlateItem[] = [
  ...goldenPlate,
  plateItemOfHit("naan", naan),
  plateItemOfHit("crisps", crisps),
];

const eatenToday = { kcal: 1039, protein_g: 86, carbs_g: 129, fat_g: 19 };
const targets = { kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70 };

/** What the panel's totals card draws under its hairline for a plate: the day's four bars with the plate's share. */
export const dayBarsFor = (items: readonly PlateItem[]) => ({
  dayTitle: "Today",
  bars: progressBars(eatenToday, targets, plateTotals(items)),
});
