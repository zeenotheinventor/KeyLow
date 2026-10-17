import { describeLoggedAmount } from "./diary";
import { NOT_GIVEN } from "./nutrition";
import { spokenAmount } from "./spokenAmount";
import { formatCalories, formatGrams } from "../format/numbers";

import type { BeforeAndAfter, IngredientAmount } from "../recipes/refreshRecipeIngredients";

/**
 * The words of "Refresh ingredients" (brief 22). Its title and its action are `RECIPE_ACTIONS.refresh`, the
 * per serving heading is `RECIPE_EDITOR.perServingNoValue`, Cancel is `FOOD_FORM.cancel`, the failed save
 * banner is `SAVE_FAILED_BANNER`, and a failed load adds `DIARY_LOAD_FAILED.body` and `RETRY_LABEL`.
 */
export const REFRESH = {
  /** Over the diff, and where focus starts, so the change is read before the buttons. */
  intro: "These foods have changed since you added them. Apply to use their values now.",
  /** The label of the per serving energy row. Protein, Carbs and Fat are the tile labels. */
  calories: "Calories",
  /** Written after a value that did not change, in place of a before and after. */
  noChange: "no change",
  /** The three section headings. Their counts are added by `describeCountedHeading`. */
  changed: "Changed",
  unchanged: "Unchanged",
  kept: "Kept as it is",
  /** On a card for an ingredient whose food was deleted: the recipe's twin of `FOOD_DELETED_NOTICE`. */
  foodGone: "This food has been deleted. The ingredient keeps its saved values.",
  apply: "Apply",
  /** What a screen reader adds to Apply. */
  applyHint: "Replaces the saved values of the changed ingredients",
  nothingTitle: "Nothing to refresh",
  nothingBody: "Every ingredient matches its food today.",
  /** The nothing-to-refresh state's only button, which closes back to the recipe view. */
  done: "Done",
  /** The name of the region of skeletons. */
  loadingLabel: "Checking your foods",
  loadFailed: "Couldn't check your foods",
  /** The per serving card as a region. */
  perServingRegionName: "Per serving, before and after",
};

/** What a value counts: energy is written in whole kilocalories, the rest in grams as every gram is. */
export type BeforeAndAfterQuantity = "energy" | "grams";

const QUANTITIES: Readonly<
  Record<
    BeforeAndAfterQuantity,
    { format: (value: number) => string; singular: string; plural: string }
  >
> = {
  energy: { format: formatCalories, singular: "kilocalorie", plural: "kilocalories" },
  grams: { format: formatGrams, singular: "gram", plural: "grams" },
};

/**
 * A before and after value for a screen reader: "Calories, 374 before, 362 now", and for one that did not
 * change, with its unit, "Carbs, 43 grams, no change". Two values count as unchanged when they are written
 * the same, so 43.1 and 43.4 grams read as no change instead of "43 before, 43 now". A value the food does
 * not record reads "not given".
 */
export const describeBeforeAfter = (
  label: string,
  change: BeforeAndAfter<number | null>,
  quantity: BeforeAndAfterQuantity,
): string => {
  const { format, singular, plural } = QUANTITIES[quantity];
  const written = (value: number | null) => (value === null ? NOT_GIVEN : format(value));
  const before = written(change.before);
  const after = written(change.after);

  if (before === after) {
    const spoken = change.after === null ? after : spokenAmount(after, singular, plural);

    return `${label}, ${spoken}, ${REFRESH.noChange}`;
  }
  return `${label}, ${before} before, ${after} now`;
};

/**
 * The line on an ingredient card whose portion is no longer on its food: "1 medium is no longer on this
 * food, so the amount becomes 110 g." It reads the portion's label from the amount before and the plain
 * amount after, as the ingredient's caption writes it. Only an amount that was a portion can fall back.
 */
export const describePortionFellBack = (amount: BeforeAndAfter<IngredientAmount>): string => {
  const { portionLabel } = amount.before;
  if (portionLabel === null) {
    throw new RangeError("Only an amount that was a portion can fall back to a plain amount");
  }
  // The grams are only read for a portion, and the new amount is not one.
  const becomes = describeLoggedAmount({
    unit: amount.after.unit,
    quantity: amount.after.quantity,
    resolvedGrams: amount.after.quantity,
    portion: null,
  });

  return `${portionLabel} is no longer on this food, so the amount becomes ${becomes}.`;
};
