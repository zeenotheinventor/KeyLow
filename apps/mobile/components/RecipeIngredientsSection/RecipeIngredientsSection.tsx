import { RECIPE_EDITOR, describeCountSuffix } from "@keylow/core/copy";
import { View } from "react-native";

import { FieldError, FoodRow, GroupedList, Text } from "../ui";
import { ingredientRowFields } from "./ingredientRowFields";

import type { RecipeIngredientsSectionProps } from "./types";

/**
 * The Ingredients section of the recipe editor, read only until ingredients can be added: the heading with
 * its count, the line under it (the empty line, or what is wrong with the ingredients after a failed Save),
 * and a card of rows, each with the amount and what it comes to.
 */
export function RecipeIngredientsSection({
  ingredients,
  problems,
  sectionRef,
  headingRef,
}: RecipeIngredientsSectionProps) {
  const rows = ingredients.map(ingredientRowFields);

  return (
    <View ref={sectionRef} className="gap-2">
      <View className="gap-1 px-1">
        {/* The view carries the heading role so a failed Save can move a screen reader's focus here, because the kit's Text takes no ref. */}
        <View ref={headingRef} accessible role="heading">
          <Text variant="body-strong">
            {RECIPE_EDITOR.ingredients}
            <Text tone="muted" variant="caption">
              {describeCountSuffix(rows.length)}
            </Text>
          </Text>
        </View>
        {rows.length === 0 && problems.length === 0 ? (
          <Text tone="secondary" variant="caption">
            {RECIPE_EDITOR.ingredientsEmpty}
          </Text>
        ) : null}
        {problems.map((problem) => (
          <FieldError key={problem}>{problem}</FieldError>
        ))}
      </View>
      {rows.length === 0 ? null : (
        <GroupedList hidesTitle title={RECIPE_EDITOR.ingredients}>
          {rows.map((row, position) => (
            <FoodRow
              // An ingredient has no id of its own until it is saved, and two rows can hold the same food.
              key={position}
              caption={row.amount}
              energy={row.energy}
              layout="ingredient"
              macros={row.macros}
              nameSegments={row.nameSegments}
              needsReview={row.macros === undefined}
            />
          ))}
        </GroupedList>
      )}
    </View>
  );
}
