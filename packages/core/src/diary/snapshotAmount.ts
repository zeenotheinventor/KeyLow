import { matchPortionOnFood } from "./matchPortionOnFood";
import { choicesFor } from "./pickerChoices";
import { GRAMS_PER_OUNCE, ML_PER_FLUID_OUNCE } from "../nutrition/units";
import { spoonPortionOf } from "../nutrition/volume";

import type { PickerChoices } from "./pickerChoices";
import type { AmountFood, AmountPortion } from "./previewAmount";
import type { FoodSnapshot } from "./schemas";
import type { FoodPortion } from "../schemas/food";

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

/**
 * The portion an entry was logged with, if it was logged with one. It is the only portion offered while the
 * food's own are not known.
 */
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

/** What the live food adds to an entry's chips: its portions now, and the portion the entry's link points to. */
export type LiveFoodPortions = {
  portions: readonly FoodPortion[];
  /** The id the entry was logged with (`portion_id`), or null for an entry with none. */
  loggedPortionId: string | null;
};

// The food's portions in `position` order, with the entry's own portion among them: in the place of the live
// portion it matches (so it is one chip, at the size the entry was logged with), or first when the food no
// longer has it.
function portionsWithTheEntrysOwn(
  snapshot: FoodSnapshot,
  live: LiveFoodPortions,
): readonly AmountPortion[] {
  const inOrder = [...live.portions].sort((first, second) => first.position - second.position);
  const [own] = snapshotPortions(snapshot);
  if (own === undefined || snapshot.portion === null || spoonOfSnapshot(snapshot) !== undefined) {
    return inOrder;
  }
  const matched = matchPortionOnFood(
    { quantity: snapshot.quantity, portionId: live.loggedPortionId, portion: snapshot.portion },
    live.portions,
  );
  const matchedId = matched.unit === "portion" ? matched.portion.id : undefined;
  const isStillOnTheFood = inOrder.some((portion) => portion.id === matchedId);

  return isStillOnTheFood
    ? inOrder.map((portion) => (portion.id === matchedId ? own : portion))
    : [own, ...inOrder];
}

/**
 * The chips of the dialog or screen that edits a logged entry, and the portions its hero works from. They
 * follow the picker's order: portions, g, then ml, 1 tsp and 1 tbsp. The values always come from the entry's
 * own snapshot and never from the live food, so a food edited since only changes which portions are offered.
 *
 * Without `live` (the food is deleted, unreadable or still loading) the portions are the one the entry was
 * logged with, if any. With it they are the food's own portions by `position`, so an entry logged in grams
 * can be switched to a portion and one in a portion to another; the portion the entry was logged with is
 * one chip at the size it was logged with, and stays when the food has lost it.
 *
 * A snapshot has no food group, so the volume chips are offered when it holds a density or is measured per
 * 100 ml (or was logged in spoons); a volume amount is worked out from that density. An entry logged in
 * spoons shows its spoon chip once, in the spoon's place; a gram portion with a spoon's label stays its own chip.
 */
export function entryPickerChoices(snapshot: FoodSnapshot, live?: LiveFoodPortions): PickerChoices {
  const spoon = spoonOfSnapshot(snapshot);
  const isMeasuredByVolume =
    snapshot.density !== null || snapshot.basis === "per_100ml" || spoon !== undefined;
  const ownPortions =
    live === undefined
      ? spoon === undefined
        ? snapshotPortions(snapshot)
        : []
      : portionsWithTheEntrysOwn(snapshot, live);

  return choicesFor(ownPortions, isMeasuredByVolume);
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
