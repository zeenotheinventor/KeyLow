import { useFood } from "@keylow/api-client";
import {
  REFRESH,
  REFRESH_PER_100_LABELS,
  describePer100Heading,
  describePortionFellBack,
} from "@keylow/core/copy";

import type { ChangedIngredientCardProps } from "./types";

import { BeforeAfterRow, beforeAfterFigures } from "@/components/recipes/BeforeAfterRow";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

/**
 * An ingredient whose food has changed: its name with where the food comes from, its amount, what it comes
 * to in kilocalories before and after, and the values per 100 that differ, one to a row. A portion the food
 * no longer has is said in a line at the end. The figures are core's, written by `beforeAfterFigures`. The
 * change does not say where the food comes from, so the badge is read from the food and is left out until
 * it has been, and for a food that cannot be read.
 */
export function ChangedIngredientCard({ change, amountCaption }: ChangedIngredientCardProps) {
  const { data: food } = useFood(change.foodId);
  const name = change.name.after;

  return (
    <Card role="group" aria-label={name} padding="none" className="flex flex-col gap-2 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-[2px]">
        <div className="flex flex-col gap-[2px]">
          <span className="flex items-center gap-2">
            <span className="text-body-strong">{name}</span>
            {food !== null && food !== undefined && <Badge kind="source" source={food.source} />}
          </span>
          <span className="text-caption tabular-nums text-text-muted">{amountCaption}</span>
        </div>
        <BeforeAfterRow
          size="plain"
          figures={beforeAfterFigures(REFRESH.calories, change.kcal, "energy")}
        />
      </div>
      {change.per100Changes.length > 0 && (
        <div className="flex flex-col">
          <span className="py-1 text-caption text-text-muted">
            {describePer100Heading(change.basis.after)}
          </span>
          {change.per100Changes.map(({ nutrient, before, after }) => (
            <BeforeAfterRow
              key={nutrient}
              hasDivider
              size="compact"
              label={REFRESH_PER_100_LABELS[nutrient]}
              figures={beforeAfterFigures(
                REFRESH_PER_100_LABELS[nutrient],
                { before, after },
                nutrient === "kcal" ? "energy" : "grams",
              )}
            />
          ))}
        </div>
      )}
      {change.portionFellBack && (
        <p className="text-caption text-text-secondary">{describePortionFellBack(change.amount)}</p>
      )}
    </Card>
  );
}
