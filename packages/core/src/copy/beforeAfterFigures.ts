import { FOOD_ROW } from "./foodRow";
import { NOT_GIVEN } from "./nutrition";
import { describeBeforeAfter } from "./recipeRefresh";
import { formatCalories, formatGrams } from "../format/numbers";

import type { BeforeAndAfterQuantity } from "./recipeRefresh";

/** One figure before and after a refresh, already written: the texts, whether they say the same, and the words a screen reader hears. */
export type BeforeAfterFigures = {
  /** The old value, without its unit. */
  before: string;
  /** The new value with its unit, or the one value of a figure that did not change. */
  after: string;
  /** True when the two are written the same, so the row says "no change" in place of an arrow. */
  isUnchanged: boolean;
  /** "Calories, 374 before, 362 now", or "Carbs, 43 grams, no change". */
  accessibleName: string;
};

const QUANTITIES: Readonly<
  Record<BeforeAndAfterQuantity, { format: (value: number) => string; unit: string }>
> = {
  energy: { format: formatCalories, unit: FOOD_ROW.energyUnit },
  grams: { format: formatGrams, unit: FOOD_ROW.gramUnit },
};

/**
 * The texts of one figure before and after, written as the rest of the app writes them, with the unit once,
 * after the new value. Two values are the same when they are written the same, as `describeBeforeAfter`
 * counts them, so the row and the words a screen reader hears always agree. A value the food does not
 * record reads "not given", with no unit.
 */
export function beforeAfterFigures(
  label: string,
  change: { before: number | null; after: number | null },
  quantity: BeforeAndAfterQuantity,
): BeforeAfterFigures {
  const { format, unit } = QUANTITIES[quantity];
  const written = (value: number | null) => (value === null ? NOT_GIVEN : format(value));
  const before = written(change.before);
  const after = written(change.after);

  return {
    before,
    after: change.after === null ? after : `${after} ${unit}`,
    isUnchanged: before === after,
    accessibleName: describeBeforeAfter(label, change, quantity),
  };
}
