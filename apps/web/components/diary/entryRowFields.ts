import {
  FOOD_ROW,
  describeEntryCaption,
  describeLoggedAmount,
  describeRecipeLoggedAmount,
  describeRecipeLoggedRowName,
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
 * What a diary row is told about a logged entry, every text written by core: the food's or recipe's name
 * (a quick add's label, or "Quick add"), the caption of the time and amount, a recipe's row name, the energy and the macros. A value
 * the entry does not have is null (or undefined for the energy), and the rows say so in their own way.
 */
export function entryRowFields(entry: LogEntry, timeZone: string) {
  const { name, amount } = nameAndAmount(entry);
  const { protein, carbs, fat, accessibleDescription } = describeMacros(entry.nutrients);
  const kcal = entry.nutrients.kcal;
  const hasAllMacros = protein !== null && carbs !== null && fat !== null;
  const clockTime = formatClockTime(new Date(entry.logged_at), timeZone);

  return {
    name,
    nameSegments: [{ text: name, matched: false }],
    caption: describeEntryCaption(clockTime, amount),
    // Only a recipe entry has one: the rows of a food are named by what they hold.
    recipeRowName:
      entry.item_type === "recipe"
        ? describeRecipeLoggedRowName(clockTime, entry.snapshot)
        : undefined,
    energy: kcal === null ? undefined : formatCalories(kcal),
    // The table writes a dash for a macro that is not given, one at a time.
    cells: { protein, carbs, fat },
    // The stacked row writes "Needs review" in place of all three when any is missing.
    macros: hasAllMacros ? { protein, carbs, fat, description: accessibleDescription } : undefined,
  };
}
