import { FOOD_ROW, NOT_GIVEN, describeBeforeAfter } from "@keylow/core/copy";
import { formatCalories, formatGrams } from "@keylow/core/format";

import type { BeforeAfterFigures } from "./types";
import type { BeforeAndAfterQuantity } from "@keylow/core/copy";

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
