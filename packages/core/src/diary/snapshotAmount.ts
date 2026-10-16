import { choicesFor } from "./pickerChoices";
import { GRAMS_PER_OUNCE, ML_PER_FLUID_OUNCE } from "../nutrition/units";
import { spoonPortionOf } from "../nutrition/volume";

import type { PickerChoices } from "./pickerChoices";
import type { AmountFood, AmountPortion } from "./previewAmount";
import type { FoodSnapshot } from "./schemas";

/** The id of the one portion an entry's snapshot has, which is the value of its unit chip. */
export const SNAPSHOT_PORTION_ID = "snapshot-portion";

/**
 * A logged entry's own food values, in the shape an amount is worked out from, so the edit dialog's hero
 * and its chips come from what the entry was logged with and never from the live food.
 */
export function snapshotAsFood(snapshot: FoodSnapshot): AmountFood {
  return {
    basis: snapshot.basis,
    density_g_per_ml: snapshot.density,
    kcal: snapshot.per100.kcal,
    protein_g: snapshot.per100.protein_g,
    fat_g: snapshot.per100.fat_g,
    carbs_g: snapshot.per100.carbs_g,
    fibre_g: snapshot.per100.fibre_g,
  };
}

/** The portion an entry was logged with, if it was logged with one. It is the only portion the edit dialog offers. */
export function snapshotPortions(snapshot: FoodSnapshot): AmountPortion[] {
  const { portion } = snapshot;
  if (portion === null) {
    return [];
  }

  return [
    {
      id: SNAPSHOT_PORTION_ID,
      label: portion.label,
      grams: "grams" in portion ? portion.grams : null,
      ml: "ml" in portion ? portion.ml : null,
    },
  ];
}

/**
 * The spoon an entry was logged in, if it was (see `spoonPortionOf`).
 */
const spoonOfSnapshot = (snapshot: FoodSnapshot) =>
  snapshot.portion === null ? undefined : spoonPortionOf(snapshot.portion);

/**
 * The chips of the dialog or screen that edits a logged entry, and the portions its hero works from, built from
 * the entry's own snapshot and never from the live food. They follow the picker's order, with the logged
 * portion in the food's place: the portion, g, then ml, 1 tsp and 1 tbsp. A snapshot has no food group, so the
 * volume chips are offered when it holds a density or is measured per 100 ml (or was logged in spoons). An
 * entry logged in spoons shows its spoon chip once, in the spoon's place; a gram portion with a spoon's label
 * stays its own chip. An entry that has no density gets the chips it always did.
 */
export function entryPickerChoices(snapshot: FoodSnapshot): PickerChoices {
  const spoon = spoonOfSnapshot(snapshot);
  const isMeasuredByVolume =
    snapshot.density !== null || snapshot.basis === "per_100ml" || spoon !== undefined;

  return choicesFor(spoon === undefined ? snapshotPortions(snapshot) : [], isMeasuredByVolume);
}

const roundToTenth = (value: number): number => Math.round(value * 10) / 10;

/**
 * Where the edit dialog's amount field and chips start: the logged amount, on the chip of its unit (a spoon
 * entry's, on the spoon chip of `entryPickerChoices`). The dialog
 * offers portions, grams and millilitres, so an amount logged in ounces is shown as grams, and one in fluid
 * ounces as millilitres, to a tenth.
 */
export function snapshotAmountStart(snapshot: FoodSnapshot): {
  quantity: string;
  unitValue: string;
} {
  switch (snapshot.unit) {
    case "oz":
      return {
        quantity: String(roundToTenth(snapshot.quantity * GRAMS_PER_OUNCE)),
        unitValue: "g",
      };
    case "fl_oz":
      return {
        quantity: String(roundToTenth(snapshot.quantity * ML_PER_FLUID_OUNCE)),
        unitValue: "ml",
      };
    case "portion":
      return {
        quantity: String(snapshot.quantity),
        unitValue: spoonOfSnapshot(snapshot)?.id ?? SNAPSHOT_PORTION_ID,
      };
    default:
      return { quantity: String(snapshot.quantity), unitValue: snapshot.unit };
  }
}
