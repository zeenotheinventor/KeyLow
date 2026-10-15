import { buildFoodSnapshot } from "./buildFoodSnapshot";

import type { FoodSnapshot } from "./schemas";
import type { Food } from "../schemas/food";
import type { NullableNutrients } from "../schemas/nutrients";

const nutrientKeys = [
  "kcal",
  "protein_g",
  "fat_g",
  "carbs_g",
  "fibre_g",
  "sat_fat_g",
  "sugars_g",
  "salt_g",
] as const;

const sameNutrients = (first: NullableNutrients, second: NullableNutrients): boolean =>
  nutrientKeys.every((key) => (first[key] ?? null) === (second[key] ?? null));

/**
 * A snapshot with no density was logged before the food had one to freeze, so only a density the food
 * has of its own counts as a change: a density estimated from its group would otherwise flag every old
 * entry. A snapshot with a density compares it with what a log would freeze now, own or estimated.
 */
const densityChanged = (food: Food, current: FoodSnapshot, snapshot: FoodSnapshot): boolean =>
  snapshot.density === null ? food.density_g_per_ml !== null : current.density !== snapshot.density;

/**
 * Whether the live food differs from what an entry's snapshot froze: its name, basis, density or any
 * nutrient the snapshot keeps. What a snapshot never keeps (brand, barcode, quality flags, micronutrients,
 * portions) does not count, since changing it cannot change the entry. It decides whether the entry
 * offers "Update to current food data".
 *
 * The live food is frozen the way a log freezes it, so what is compared is exactly what an update would
 * write.
 */
export const foodChangedSinceLogged = (food: Food, snapshot: FoodSnapshot): boolean => {
  const current = buildFoodSnapshot(food, {
    quantity: 1,
    unit: food.basis === "per_100ml" ? "ml" : "g",
  });

  return (
    current.name !== snapshot.name ||
    current.basis !== snapshot.basis ||
    densityChanged(food, current, snapshot) ||
    !sameNutrients(current.per100, snapshot.per100)
  );
};
