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
 * library's recipe row with the serving a plus logs, and a plus beside it. The row opens nothing until the
 * amount step exists, so it is plain text, and only the plus acts.
 */
export function RecipeLogGroup({ recipes, query, addDisabled, onAdd }: RecipeLogGroupProps) {
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
          openLabel={describeRecipeSearchRowName(recipe.name, recipe, { choosesAmount: false })}
          onAdd={() => {
            onAdd(recipe);
          }}
        />
      ))}
    </GroupedList>
  );
}
