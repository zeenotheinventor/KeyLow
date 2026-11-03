// What the model is told about the diary: entries, totals and targets. The numbers are rounded as the
// Diary prints them (core `roundCalories` and `roundGrams`), a null stays null because it means
// unknown, and the projection here is the one place that lists which fields of an entry leave a tool.
import {
  dayTarget,
  describeLoggedAmount,
  describeRecipeLoggedAmount,
  formatClockTime,
  isValidTimeZone,
  roundCalories,
  roundGrams,
} from "../../core.ts";

import type { LogEntry, Targets } from "../../repos.ts";
import type { ToolRunOutput } from "../tool.ts";
import type { JsonValue } from "../untrusted.ts";

export type NutrientValues = {
  kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
  fibre_g: number | null;
};

const calories = (kcal: number | null) => (kcal === null ? null : roundCalories(kcal));
const grams = (value: number | null) => (value === null ? null : roundGrams(value));

export const nutrientsView = (nutrients: NutrientValues) => ({
  kcal: calories(nutrients.kcal),
  protein_g: grams(nutrients.protein_g),
  fat_g: grams(nutrients.fat_g),
  carbs_g: grams(nutrients.carbs_g),
  fibre_g: grams(nutrients.fibre_g),
});

export const noNutrientsEaten: NutrientValues = {
  kcal: 0,
  protein_g: 0,
  fat_g: 0,
  carbs_g: 0,
  fibre_g: 0,
};

// The zone the profile says, and UTC for a profile with none, as the check-in reads a missing one.
export const zoneOrUtc = (timeZone: string | null): string =>
  timeZone !== null && isValidTimeZone(timeZone) ? timeZone : "UTC";

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
      return { name: entry.snapshot.name, amount: describeRecipeLoggedAmount(entry.snapshot) };
    case "quick": {
      const amount = describeLoggedAmount(null);
      return { name: entry.snapshot.label ?? amount, amount };
    }
  }
}

// The time is the clock time in the user's zone, "08:10", and the amount is written as the Diary
// writes it: the portion's label first, with the grams in brackets.
export const entryView = (entry: LogEntry, timeZone: string) => ({
  id: entry.id,
  ...nameAndAmount(entry),
  time: formatClockTime(new Date(entry.logged_at), timeZone),
  ...nutrientsView(entry.nutrients),
});

export type DayTargets = {
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

const positiveOrNull = (value: number | null) => (value !== null && value > 0 ? value : null);

// The calories of one day are core's `dayTarget` for it, as the Diary reads them, so a programme with
// day by day figures gives that weekday's. A target of zero is not set.
export function targetsOfDay(targets: Targets, localDate: string): DayTargets {
  const week = positiveOrNull(targets.kcal);
  const kcal =
    week === null
      ? null
      : dayTarget(
          targets.source === "engine"
            ? { caloriesKcal: week, dowCaloriesKcal: targets.dowCaloriesKcal }
            : { caloriesKcal: week },
          localDate,
        );
  return {
    kcal,
    protein_g: positiveOrNull(targets.protein_g),
    carbs_g: positiveOrNull(targets.carbs_g),
    fat_g: positiveOrNull(targets.fat_g),
  };
}

export const targetsView = (targets: DayTargets) => ({
  kcal: calories(targets.kcal),
  protein_g: grams(targets.protein_g),
  carbs_g: grams(targets.carbs_g),
  fat_g: grams(targets.fat_g),
});

const leftOf = (target: number | null, eaten: number | null, round: (value: number) => number) =>
  target === null ? null : round(target - (eaten ?? 0));

// What is left of each target, negative when over. A total no entry gave a value for reads as 0, as it
// does on the Diary's bars.
export const leftView = (targets: DayTargets, eaten: NutrientValues) => ({
  kcal: leftOf(targets.kcal, eaten.kcal, roundCalories),
  protein_g: leftOf(targets.protein_g, eaten.protein_g, roundGrams),
  carbs_g: leftOf(targets.carbs_g, eaten.carbs_g, roundGrams),
  fat_g: leftOf(targets.fat_g, eaten.fat_g, roundGrams),
});

// A tool result that rests on the person's data: the citation line goes to the model with the sums, and
// to the turn loop for the `answer_meta` event, which prints it under the answer. The estimate label is
// there only when the answer rests on the trend weight.
export function citedResult(
  data: { [key: string]: JsonValue },
  citation: string,
  estimate: string | null = null,
): ToolRunOutput {
  return {
    data: estimate === null ? { ...data, citation } : { ...data, citation, estimate },
    structured: { citation, estimate },
  };
}
