import {
  FOOD_ROW,
  describeEntryCaption,
  describeLoggedAmount,
  describeRecipeLoggedAmount,
} from "@keylow/core/copy";
import { formatClockTime } from "@keylow/core/dates";
import { formatCalories } from "@keylow/core/format";
import { describeMacros } from "@keylow/core/search";

import type { LogEntry } from "@keylow/api-client";

function nameAndAmount(entry: LogEntry): { name: string; amount: string } {
  switch (entry.item_type) {
    case "food":
      return {
        name: entry.snapshot.name,
        amount: describeLoggedAmount({
          unit: entry.unit,
          quantity: entry.quantity,
          resolvedGrams: entry.resolved_grams,
          portion: entry.snapshot.portion,
        }),
      };
    case "recipe":
      // The recipe's name as it was when logged, and the amount as "1 serving (275 g)".
      return { name: entry.snapshot.name, amount: describeRecipeLoggedAmount(entry.snapshot) };
    case "quick":
      return {
        name: entry.snapshot.label ?? FOOD_ROW.quickAdd,
        amount: describeLoggedAmount(null),
      };
  }
}

/**
 * What a diary `FoodRow` is told about a logged entry, every text written by core: the food's or recipe's
 * name (a quick add's label, or "Quick add"), the caption of the time and amount, the energy and the macros. An entry
 * with a macro it does not know says "Needs review" in the macros' place, as a food missing one does.
 */
export function entryRowProps(entry: LogEntry, timeZone: string) {
  const clockTime = formatClockTime(new Date(entry.logged_at), timeZone);
  const { name, amount } = nameAndAmount(entry);
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
