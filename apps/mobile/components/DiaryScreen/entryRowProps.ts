import { FOOD_ROW, describeEntryCaption, describeLoggedAmount } from "@keylow/core/copy";
import { formatClockTime } from "@keylow/core/dates";
import { formatCalories } from "@keylow/core/format";
import { describeMacros } from "@keylow/core/search";

import type { LogEntry } from "@keylow/api-client";

/**
 * What a diary `FoodRow` is told about a logged entry, every text written by core: the food's name (a quick
 * add's label, or "Quick add"), the caption of the time and amount, the energy and the macros. An entry
 * with a macro it does not know says "Needs review" in the macros' place, as a food missing one does.
 */
export function entryRowProps(entry: LogEntry, timeZone: string) {
  const clockTime = formatClockTime(new Date(entry.logged_at), timeZone);
  const isFood = entry.item_type === "food";
  const name = isFood ? entry.snapshot.name : (entry.snapshot.label ?? FOOD_ROW.quickAdd);
  const amount = isFood
    ? describeLoggedAmount({
        unit: entry.unit,
        quantity: entry.quantity,
        resolvedGrams: entry.resolved_grams,
        portion: entry.snapshot.portion,
      })
    : describeLoggedAmount(null);
  const { protein, carbs, fat, accessibleDescription } = describeMacros(entry.nutrients);
  const kcal = entry.nutrients.kcal;

  return {
    nameSegments: [{ text: name, matched: false }],
    caption: describeEntryCaption(clockTime, amount),
    energy: kcal === null ? undefined : formatCalories(kcal),
    macros:
      protein === null || carbs === null || fat === null
        ? undefined
        : { protein, carbs, fat, description: accessibleDescription },
    needsReview: protein === null || carbs === null || fat === null,
  };
}
