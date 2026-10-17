import { FOOD_NUTRIENT_LABELS, NOT_GIVEN } from "@keylow/core/copy";
import { formatCalories, formatGrams } from "@keylow/core/format";

import { GroupedList, ListRow } from "../../ui";

import type { PerHundredListProps } from "./types";

/**
 * The values under the hero, per 100 g or per 100 ml, or per 100 g of a recipe's cooked dish: energy,
 * protein, carbohydrate and fat, as the portion boards draw them. A value the source does not give reads
 * "not given", never 0.
 */
export function PerHundredList({ heading, values }: PerHundredListProps) {
  const grams = (label: string, value: number | null) =>
    value === null ? (
      <ListRow title={label} value={NOT_GIVEN} />
    ) : (
      <ListRow title={label} unit="g" value={formatGrams(value)} />
    );

  return (
    <GroupedList title={heading}>
      {values.kcal === null ? (
        <ListRow title={FOOD_NUTRIENT_LABELS.energy} value={NOT_GIVEN} />
      ) : (
        <ListRow
          title={FOOD_NUTRIENT_LABELS.energy}
          unit="kcal"
          value={formatCalories(values.kcal)}
        />
      )}
      {grams(FOOD_NUTRIENT_LABELS.protein, values.protein_g)}
      {grams(FOOD_NUTRIENT_LABELS.carbohydrate, values.carbs_g)}
      {grams(FOOD_NUTRIENT_LABELS.fat, values.fat_g)}
    </GroupedList>
  );
}
