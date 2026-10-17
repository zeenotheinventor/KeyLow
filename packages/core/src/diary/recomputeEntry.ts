import { foodEntryFields } from "./foodEntryFields";
import { refreshSnapshotFromFood } from "./refreshSnapshotFromFood";
import { withQuantity } from "./snapshotQuantity";

import type { FoodLogEntryInsert, SnapshotPortion } from "./schemas";
import type { QuantityUnit } from "../nutrition/units";
import type { Food, FoodPortion } from "../schemas/food";

export type EntryQuantityChange = {
  quantity: number;
  unit: QuantityUnit;
  /**
   * The portion to use, in the snapshot's shape. Omit it to keep the entry's own portion. Ignored
   * unless the unit is `portion`.
   */
  portion?: SnapshotPortion;
  /** The id of `portion` when the caller knows it. Without it a changed portion has no link. */
  portionId?: string;
};

/**
 * Changes the quantity (and unit or portion) of an entry using only the entry's own snapshot. The
 * food is not an argument, so a live food that has been edited since cannot leak in: the frozen
 * `per100`, basis and density are reused as they were logged. Everything else on the entry (timing,
 * ids, extra columns) is kept.
 *
 * Throws a `RangeError` for a negative quantity or a `portion` unit with no portion to use.
 */
export const recomputeEntry = <Entry extends FoodLogEntryInsert>(
  entry: Entry,
  change: EntryQuantityChange,
): Entry => {
  const keepsPortion = change.portion === undefined;
  const snapshot = withQuantity(entry.snapshot, {
    quantity: change.quantity,
    unit: change.unit,
    portion: change.portion ?? entry.snapshot.portion,
  });
  const portionId = keepsPortion ? entry.portion_id : (change.portionId ?? null);
  return { ...entry, ...foodEntryFields(snapshot, portionId) };
};

/**
 * The "Update to current food data" action: rebuilds the snapshot from the live food, keeping the
 * entry's quantity and unit. An entry logged with a portion looks that portion up on the live
 * food's `portions` with `matchPortionOnFood` and may land on a direct amount in grams or
 * millilitres. Everything else on the entry is kept.
 *
 * Throws a `RangeError` when `food` is not the food the entry was logged from.
 */
export const refreshEntryFromFood = <Entry extends FoodLogEntryInsert>(
  entry: Entry,
  food: Food,
  portions: readonly FoodPortion[],
): Entry => {
  const refreshed = refreshSnapshotFromFood(entry.snapshot, entry.portion_id, food, portions);
  return { ...entry, ...foodEntryFields(refreshed.snapshot, refreshed.portionId) };
};
