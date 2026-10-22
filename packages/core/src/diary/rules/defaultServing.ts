import { buildFoodSnapshot } from "../buildFoodSnapshot";
import { nutrientsOfSnapshot } from "../snapshotQuantity";

import type { Food, FoodPortion } from "../../schemas/food";
import type { NullableNutrients } from "../../schemas/nutrients";

const DEFAULT_AMOUNT_IN_GRAMS = 100;

export type Serving =
  | {
      quantity: 1;
      unit: "portion";
      portion: FoodPortion;
      resolvedGrams: number;
      nutrients: NullableNutrients;
    }
  | {
      quantity: 100;
      unit: "g";
      portion: null;
      resolvedGrams: number;
      nutrients: NullableNutrients;
    };

/**
 * The serving a food row shows and the one-tap plus logs: one of the food's default portion, or
 * 100 g when it has none. The nutrients are the food's, scaled to that serving the way a logged
 * entry's are (`scaleNutrients` through the snapshot), so the row and the entry agree.
 */
export function defaultServing(food: Food, portions: readonly FoodPortion[]): Serving {
  const portion = portions.find((candidate) => candidate.is_default);

  if (portion === undefined) {
    const snapshot = buildFoodSnapshot(food, {
      quantity: DEFAULT_AMOUNT_IN_GRAMS,
      unit: "g",
      foodPortions: portions,
    });
    return {
      quantity: DEFAULT_AMOUNT_IN_GRAMS,
      unit: "g",
      portion: null,
      resolvedGrams: snapshot.resolvedGrams,
      nutrients: nutrientsOfSnapshot(snapshot),
    };
  }

  const snapshot = buildFoodSnapshot(food, {
    quantity: 1,
    unit: "portion",
    portion,
    foodPortions: portions,
  });
  return {
    quantity: 1,
    unit: "portion",
    portion,
    resolvedGrams: snapshot.resolvedGrams,
    nutrients: nutrientsOfSnapshot(snapshot),
  };
}
