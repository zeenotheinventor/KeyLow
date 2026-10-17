import {
  RECIPE_EDITOR,
  RECIPE_PROBLEMS,
  describeCountSuffix,
  describeIngredientRowName,
  describeRemoveIngredient,
} from "@keylow/core/copy";
import { MAX_RECIPE_INGREDIENTS } from "@keylow/core/recipes";
import { View } from "react-native";

import { FieldError, FoodRow, GroupedList, IconButton, ListRow, Text } from "../ui";
import { ingredientRowFields } from "./ingredientRowFields";

import type { RecipeIngredientsSectionProps } from "./types";

/**
 * The Ingredients section of the recipe editor: the heading with its count, the line under it (the empty
 * line, or what is wrong with the ingredients after a failed Save), and a card of rows, each with the amount
 * and what it comes to. A row opens the ingredient's amount step, and the X beside it removes it at once. The
 * card ends with the Add ingredient row, which is off, with a line saying why, at the most a recipe holds.
 */
export function RecipeIngredientsSection({
  ingredients,
  problems,
  onOpen,
  onRemove,
  isLocked,
  onAdd,
  addRowRef,
  limitRef,
  sectionRef,
  headingRef,
}: RecipeIngredientsSectionProps) {
  const rows = ingredients.map(ingredientRowFields);
  const isFull = rows.length >= MAX_RECIPE_INGREDIENTS;

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
            openLabel={describeIngredientRowName(row.name, row.amount)}
            trailing={
              <IconButton
                className="mr-1"
                icon="X"
                label={describeRemoveIngredient(row.name)}
                tone="secondary"
                variant="ghost"
                onPress={() => {
                  onRemove(position);
                }}
              />
            }
            onPress={() => {
              onOpen(position);
            }}
          />
        ))}
        <ListRow
          key="add"
          disabled={isLocked || isFull}
          icon="Plus"
          ref={addRowRef}
          title={RECIPE_EDITOR.addIngredient}
          variant="footer"
          onPress={onAdd}
        />
      </GroupedList>
      {isFull ? (
        // Adding the last ingredient turns the row above off, so this line is where a screen reader's focus
        // goes, and it says why.
        <View
          ref={limitRef}
          accessible
          aria-label={RECIPE_PROBLEMS.ingredientLimit}
          className="px-1"
        >
          <Text tone="muted" variant="caption">
            {RECIPE_PROBLEMS.ingredientLimit}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
