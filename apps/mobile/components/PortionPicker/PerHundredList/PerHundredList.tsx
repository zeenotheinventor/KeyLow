import { FOOD_NUTRIENT_LABELS, NOT_GIVEN, describePer100Heading } from "@keylow/core/copy";
import { formatCalories, formatGrams } from "@keylow/core/format";

import { GroupedList, ListRow } from "../../ui";

import type { PerHundredListProps } from "./types";

/**
 * The food's own values under the hero, per 100 g or per 100 ml: energy, protein, carbohydrate and fat, as
 * the portion boards draw them. A value the source does not give reads "not given", never 0.
 */
export function PerHundredList({ food }: PerHundredListProps) {
  const grams = (label: string, value: number | null) =>
    value === null ? (
      <ListRow title={label} value={NOT_GIVEN} />
    ) : (
      <ListRow title={label} unit="g" value={formatGrams(value)} />
    );

  return (
    <GroupedList title={describePer100Heading(food.basis)}>
      {food.kcal === null ? (
        <ListRow title={FOOD_NUTRIENT_LABELS.energy} value={NOT_GIVEN} />
      ) : (
        <ListRow
          title={FOOD_NUTRIENT_LABELS.energy}
          unit="kcal"
          value={formatCalories(food.kcal)}
        />
      )}
      {grams(FOOD_NUTRIENT_LABELS.protein, food.protein_g)}
      {grams(FOOD_NUTRIENT_LABELS.carbohydrate, food.carbs_g)}
      {grams(FOOD_NUTRIENT_LABELS.fat, food.fat_g)}
    </GroupedList>
  );
}
