import { nutrientsOfSnapshot } from "./snapshotQuantity";
import { isSpoonPortionId } from "../nutrition/volume";

import type { FoodLogEntryInsert, FoodSnapshot } from "./schemas";

/**
 * Every column of a food entry that depends on the snapshot, derived from it. Building, recomputing
 * and refreshing an entry all go through here, so the columns can never disagree with the snapshot.
 * A spoon is a portion made by a function, not a `food_portions` row, so it has no link: `portion_id` is a
 * uuid foreign key and the spoon's id is not one.
 */
export const foodEntryFields = (
  snapshot: FoodSnapshot,
  portionId: string | null,
): Pick<
  FoodLogEntryInsert,
  | "item_type"
  | "food_id"
  | "quantity"
  | "unit"
  | "portion_id"
  | "resolved_grams"
  | "snapshot"
  | "nutrients"
> => ({
  item_type: "food",
  food_id: snapshot.ref,
  quantity: snapshot.quantity,
  unit: snapshot.unit,
  portion_id:
    snapshot.unit === "portion" && portionId !== null && !isSpoonPortionId(portionId)
      ? portionId
      : null,
  resolved_grams: snapshot.resolvedGrams,
  snapshot,
  nutrients: nutrientsOfSnapshot(snapshot),
});
