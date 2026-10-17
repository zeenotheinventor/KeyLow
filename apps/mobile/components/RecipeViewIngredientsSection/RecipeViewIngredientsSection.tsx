import { RECIPE_EDITOR, describeCountSuffix } from "@keylow/core/copy";
import { View } from "react-native";

import { FoodRow, GroupedList, Text } from "../ui";

import type { RecipeViewIngredientsSectionProps } from "./types";

/**
 * The Ingredients section of the recipe view: the heading with its count and the servings the amounts are
 * for, then a card of read only rows. A row is the food's name and the amount, with no energy or macros
 * (a scaled figure beside a Per serving card that does not move would read as a contradiction), and
 * nothing to press. Each row is named as core wrote it.
 */
export function RecipeViewIngredientsSection({
  ingredients,
  servingsLine,
}: RecipeViewIngredientsSectionProps) {
  return (
    <View className="gap-2">
      <View className="flex-row items-baseline justify-between gap-3 px-1">
        <Text role="heading" variant="body-strong">
          {RECIPE_EDITOR.ingredients}
          <Text tone="muted" variant="caption">
            {describeCountSuffix(ingredients.length)}
          </Text>
        </Text>
        <Text tone="secondary" variant="caption">
          {servingsLine}
        </Text>
      </View>
      <GroupedList hidesTitle title={RECIPE_EDITOR.ingredients}>
        {ingredients.map((ingredient, position) => (
          <FoodRow
            // Two rows can hold the same food, so the place in the list is the identity.
            key={position}
            caption={ingredient.caption}
            layout="ingredient"
            nameSegments={[{ text: ingredient.name, matched: false }]}
            openLabel={ingredient.accessibleName}
          />
        ))}
      </GroupedList>
    </View>
  );
}
