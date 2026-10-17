import {
  SEARCH_GROUP_HEADINGS,
  describeRecipeSearchRowName,
  describeRecipeServing,
} from "@keylow/core/copy";

import { recipeRowFields } from "../../RecipeLibraryView";
import { FoodRow, GroupedList } from "../../ui";

import type { RecipeLogGroupProps } from "./types";

/**
 * "Your recipes · Per serving": the recipes the search found, first in the log search. Each row is the
 * library's recipe row with the serving a plus logs, and a plus beside it. Pressing the row opens the amount
 * step, where the number of servings or the grams are chosen; the plus logs one serving at once and does not
 * press the row.
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
      {recipes.map((recipe) => (
        <FoodRow
          key={recipe.id}
          {...recipeRowFields(recipe, query)}
          addDisabled={addDisabled}
          caption={describeRecipeServing(recipe)}
          layout="recipe"
          openLabel={describeRecipeSearchRowName(recipe.name, recipe)}
          onAdd={() => {
            onAdd(recipe);
          }}
          onPress={() => {
            onOpen(recipe);
          }}
        />
      ))}
    </GroupedList>
  );
}
