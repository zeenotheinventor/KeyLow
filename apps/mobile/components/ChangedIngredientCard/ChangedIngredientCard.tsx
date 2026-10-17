import { useFood } from "@keylow/api-client";
import {
  REFRESH,
  REFRESH_PER_100_LABELS,
  describePer100Heading,
  describePortionFellBack,
} from "@keylow/core/copy";
import { View } from "react-native";

import { BeforeAfterRow, beforeAfterFigures } from "../BeforeAfterRow";
import { Badge, Card, Text } from "../ui";

import type { ChangedIngredientCardProps } from "./types";

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
    <Card aria-label={name} role="group">
      <View className="gap-2">
        <View className="gap-[2px]">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="shrink" variant="body-strong">
              {name}
            </Text>
            {food === null || food === undefined ? null : (
              <Badge kind="source" source={food.source} />
            )}
          </View>
          <Text tone="muted" variant="caption">
            {amountCaption}
          </Text>
        </View>
        <BeforeAfterRow
          figures={beforeAfterFigures(REFRESH.calories, change.kcal, "energy")}
          size="plain"
        />
        {change.per100Changes.length === 0 ? null : (
          <View>
            <View className="py-1">
              <Text tone="muted" variant="caption">
                {describePer100Heading(change.basis.after)}
              </Text>
            </View>
            {change.per100Changes.map(({ nutrient, before, after }) => (
              <BeforeAfterRow
                key={nutrient}
                hasDivider
                figures={beforeAfterFigures(
                  REFRESH_PER_100_LABELS[nutrient],
                  { before, after },
                  nutrient === "kcal" ? "energy" : "grams",
                )}
                label={REFRESH_PER_100_LABELS[nutrient]}
                size="compact"
              />
            ))}
          </View>
        )}
        {change.portionFellBack ? (
          <Text tone="secondary" variant="caption">
            {describePortionFellBack(change.amount)}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}
