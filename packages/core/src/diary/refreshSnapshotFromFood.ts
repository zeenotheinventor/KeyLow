import { buildFoodSnapshot } from "./buildFoodSnapshot";
import { matchPortionOnFood } from "./matchPortionOnFood";

import type { FoodSnapshotInput } from "./buildFoodSnapshot";
import type { FoodSnapshot } from "./schemas";
import type { Food, FoodPortion } from "../schemas/food";

export type RefreshedSnapshot = {
  snapshot: FoodSnapshot;
  /** The id of the portion the snapshot lands on, null for a direct amount. A spoon has an id here, and `foodEntryFields` drops it. */
  portionId: string | null;
  /** True when the snapshot was logged with a portion that the live food no longer has, so it became a direct amount. */
  portionFellBack: boolean;
};

/**
 * Rebuilds a snapshot from the live food, keeping its quantity and unit. A snapshot logged with a
 * portion looks that portion up on the live food's `portions` with `matchPortionOnFood` and may land on
 * a direct amount in grams or millilitres. A diary entry and a recipe ingredient are both refreshed
 * through here, so the two can never disagree.
 *
 * `portionId` is the link the snapshot was stored with. Throws a `RangeError` when `food` is not the
 * food the snapshot was frozen from.
 */
export const refreshSnapshotFromFood = (
  snapshot: FoodSnapshot,
  portionId: string | null,
  food: Food,
  portions: readonly FoodPortion[],
): RefreshedSnapshot => {
  if (food.id !== snapshot.ref) {
    throw new RangeError("The food is not the one this entry was logged from");
  }
  const matched =
    snapshot.unit === "portion" && snapshot.portion !== null
      ? matchPortionOnFood(
          { quantity: snapshot.quantity, portionId, portion: snapshot.portion },
          portions,
        )
      : undefined;
  const input: FoodSnapshotInput =
    matched === undefined
      ? { quantity: snapshot.quantity, unit: snapshot.unit }
      : matched.unit === "portion"
        ? { quantity: matched.quantity, unit: matched.unit, portion: matched.portion }
        : { quantity: matched.quantity, unit: matched.unit };
  return {
    snapshot: buildFoodSnapshot(food, input),
    portionId: matched?.portion?.id ?? null,
    portionFellBack: matched !== undefined && matched.unit !== "portion",
  };
};
