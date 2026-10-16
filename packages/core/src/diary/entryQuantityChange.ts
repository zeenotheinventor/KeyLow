import { SNAPSHOT_PORTION_ID } from "./snapshotAmount";
import { spoonPortionOf } from "../nutrition/volume";

import type { ChosenAmount } from "./previewAmount";
import type { EntryQuantityChange } from "./recomputeEntry";

/**
 * What to tell `recomputeEntry` for an amount chosen on the edit screens. Grams and millilitres are just
 * that. A portion is the entry's own when it is on the entry's own chip (the entry keeps it and its link).
 * A spoon is not a database row, so it is written by its label and millilitres with no link. Any other
 * portion is one of the food's: its label and size, and its id as the link.
 *
 * Throws a `RangeError` for a portion with neither grams nor millilitres.
 */
export function entryQuantityChange(amount: ChosenAmount): EntryQuantityChange {
  const { quantity, unit } = amount;
  if (amount.unit !== "portion" || amount.portion.id === SNAPSHOT_PORTION_ID) {
    return { quantity, unit };
  }
  const { portion } = amount;
  const spoon = spoonPortionOf(portion);
  if (spoon !== undefined) {
    return { quantity, unit, portion: { label: spoon.label, ml: spoon.ml } };
  }
  if (portion.grams !== null) {
    return {
      quantity,
      unit,
      portion: { label: portion.label, grams: portion.grams },
      portionId: portion.id,
    };
  }
  if (portion.ml !== null) {
    return {
      quantity,
      unit,
      portion: { label: portion.label, ml: portion.ml },
      portionId: portion.id,
    };
  }

  // The schema forbids this; the message names no value, since the amount is health data.
  throw new RangeError("A portion needs a size in grams or millilitres");
}
