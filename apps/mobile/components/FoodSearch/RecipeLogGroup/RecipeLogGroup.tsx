import {
  SEARCH_GROUP_HEADINGS,
  describeAddToPlateName,
  describeRecipeSearchRowName,
  describeRecipeServing,
} from "@keylow/core/copy";

import { recipeRowFields } from "../../RecipeLibraryView";
import { FoodRow, GroupedList } from "../../ui";

import type { RecipeLogGroupProps } from "./types";

/**
 * "Your recipes · Per serving": the recipes the search found, first in the log search. Each row is the
 * library's recipe row with the serving a plus puts on the plate, and a plus beside it. Pressing the row opens
 * the amount step, where the number of servings or the grams are chosen; the plus puts one serving on the plate and
 * does not press the row.
 */
export function RecipeLogGroup({
  recipes,
  query,
  addDisabled,
  onAdd,
  onOpen,
}: RecipeLogGroupProps) {
  const { title, caption, label } = SEARCH_GROUP_HEADINGS.recipes;

  return (
    <GroupedList label={label} source={caption} title={title}>
      {recipes.map((recipe) => {
        const serving = describeRecipeServing(recipe);

        return (
          <FoodRow
            key={recipe.id}
            {...recipeRowFields(recipe, query)}
            addDisabled={addDisabled}
            addLabel={describeAddToPlateName(recipe.name, serving)}
            caption={serving}
            layout="recipe"
            openLabel={describeRecipeSearchRowName(recipe.name, recipe)}
            onAdd={() => {
              onAdd(recipe);
            }}
            onPress={() => {
              onOpen(recipe);
            }}
          />
        );
      })}
    </GroupedList>
  );
}
