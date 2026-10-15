import { FOOD_ROW, describeEntryCaption, describeLoggedAmount } from "@keylow/core/copy";
import { formatClockTime } from "@keylow/core/dates";
import { formatCalories } from "@keylow/core/format";
import { describeMacros } from "@keylow/core/search";

import type { LogEntry } from "@keylow/api-client";

/**
 * What a diary row is told about a logged entry, every text written by core: the food's name (a quick
 * add's label, or "Quick add"), the caption of the time and amount, the energy and the macros. A value
 * the entry does not have is null (or undefined for the energy), and the rows say so in their own way.
 */
export function entryRowFields(entry: LogEntry, timeZone: string) {
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
  const hasAllMacros = protein !== null && carbs !== null && fat !== null;

  return {
    name,
    nameSegments: [{ text: name, matched: false }],
    caption: describeEntryCaption(formatClockTime(new Date(entry.logged_at), timeZone), amount),
    energy: kcal === null ? undefined : formatCalories(kcal),
    // The table writes a dash for a macro that is not given, one at a time.
    cells: { protein, carbs, fat },
    // The stacked row writes "Needs review" in place of all three when any is missing.
    macros: hasAllMacros ? { protein, carbs, fat, description: accessibleDescription } : undefined,
  };
}
