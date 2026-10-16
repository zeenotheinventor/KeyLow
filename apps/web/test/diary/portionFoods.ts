import { makeFood, makePortion } from "../foods/support";

import type { Food, FoodPortion } from "@keylow/core/schemas";

/*
 * Foods shaped like the rows of packages/db/data/portions/cofid-portions.csv (the label, the grams, the
 * default and the position are the CSV's) and of the CoFID subset, so the chips are tested on what the
 * database really holds. A food with a density estimate by its CoFID group can be measured by volume
 * (olive oil, milk, yoghurt); one without (a banana, a chicken thigh) cannot.
 */

export type FoodWithPortions = { food: Food; portions: FoodPortion[] };

const idOf = (serial: number) => `11111111-1111-4111-8111-${String(serial).padStart(12, "0")}`;

const BANANA_ID = idOf(1);
const THIGH_ID = idOf(2);
const BREAST_ID = idOf(3);
const OIL_ID = idOf(4);
const MILK_ID = idOf(5);
const YOGHURT_ID = idOf(6);
const SYRUP_ID = idOf(7);

/** CSV rows 14-318: 1 small 101 g, 1 medium 118 g (default, position 1), 1 large 136 g. */
export const banana: FoodWithPortions = {
  food: makeFood({
    id: BANANA_ID,
    name: "Bananas, flesh only",
    source: "cofid",
    source_ref: "14-318",
    food_group: "FA",
    kcal: 81,
    protein_g: 1.2,
    fat_g: 0.1,
    carbs_g: 20.3,
  }),
  portions: [
    makePortion({ id: idOf(11), food_id: BANANA_ID, label: "1 small", grams: 101, position: 0 }),
    makePortion({
      id: idOf(12),
      food_id: BANANA_ID,
      label: "1 medium",
      grams: 118,
      is_default: true,
      position: 1,
    }),
    makePortion({ id: idOf(13), food_id: BANANA_ID, label: "1 large", grams: 136, position: 2 }),
  ],
};

/** CSV row 18-317: 1 thigh 68 g, the default. */
export const chickenThigh: FoodWithPortions = {
  food: makeFood({
    id: THIGH_ID,
    name: "Chicken thigh, stewed",
    source: "cofid",
    source_ref: "18-317",
    food_group: "JA",
    kcal: 206,
    protein_g: 22.5,
    fat_g: 12.6,
    carbs_g: 0,
  }),
  portions: [
    makePortion({
      id: idOf(21),
      food_id: THIGH_ID,
      label: "1 thigh",
      grams: 68,
      is_default: true,
      position: 0,
    }),
  ],
};

/** A food with no natural portion and no volume measure. */
export const chickenBreast: FoodWithPortions = {
  food: makeFood({
    id: BREAST_ID,
    name: "Chicken breast, grilled",
    source: "cofid",
    source_ref: "18-305",
    food_group: "JA",
    kcal: 148,
    protein_g: 32,
    fat_g: 2.2,
    carbs_g: 0,
  }),
  portions: [],
};

/** Olive oil (CoFID 17-038, group OC) is estimated at 0.92 g/ml, and has no natural portion. */
export const OLIVE_OIL_DENSITY = 0.92;
export const oliveOil: FoodWithPortions = {
  food: makeFood({
    id: OIL_ID,
    name: "Oil, olive",
    source: "cofid",
    source_ref: "17-038",
    food_group: "OC",
    kcal: 899,
    protein_g: 0,
    fat_g: 99.9,
    carbs_g: 0,
  }),
  portions: [],
};

/** Semi-skimmed milk (CoFID 12-313, group BAH) is estimated at 1.03 g/ml. */
export const MILK_DENSITY = 1.03;
export const milk: FoodWithPortions = {
  food: makeFood({
    id: MILK_ID,
    name: "Milk, semi-skimmed",
    source: "cofid",
    source_ref: "12-313",
    food_group: "BAH",
    kcal: 46,
    protein_g: 3.5,
    fat_g: 1.7,
    carbs_g: 4.7,
  }),
  portions: [],
};

/** A food that is measured by volume and also has a natural portion. */
export const yoghurt: FoodWithPortions = {
  food: makeFood({
    id: YOGHURT_ID,
    name: "Yoghurt, plain",
    source: "cofid",
    source_ref: "11-501",
    food_group: "BN",
    kcal: 54,
    protein_g: 4.8,
    fat_g: 0.2,
    carbs_g: 7.6,
  }),
  portions: [
    makePortion({
      id: idOf(61),
      food_id: YOGHURT_ID,
      label: "1 pot",
      grams: 170,
      is_default: true,
      position: 0,
    }),
  ],
};

/** A food whose own gram portion is called "1 tbsp", so two chips share that label. */
export const syrup: FoodWithPortions = {
  food: makeFood({
    id: SYRUP_ID,
    name: "Syrup, golden",
    density_g_per_ml: 1.4,
    kcal: 298,
    protein_g: 0.3,
    fat_g: 0,
    carbs_g: 79,
  }),
  portions: [
    makePortion({
      id: idOf(71),
      food_id: SYRUP_ID,
      label: "1 tbsp",
      grams: 21,
      is_default: true,
      position: 0,
    }),
  ],
};
