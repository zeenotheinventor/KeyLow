import {
  SEARCH_GROUP_HEADINGS,
  describeRecipeSearchRowName,
  describeRecipeServing,
} from "@keylow/core/copy";

import type { RecipeLogGroupProps } from "./types";

import { recipeRowFields } from "@/components/recipes/RecipeRows";
import { FoodRow } from "@/components/ui/FoodRow";
import { GroupedList } from "@/components/ui/GroupedList";

/**
 * "Your recipes · Per serving": the recipes the search found, first in the add dialog. Each row is the search
 * row of a recipe with the serving its plus logs. The row itself opens nothing until the amount step for a
 * recipe exists, so it is plain text with no chevron and its name does not say "choose amount".
 */
export function RecipeLogGroup({ recipes, query, addDisabled, onAdd }: RecipeLogGroupProps) {
  const { title, caption, label } = SEARCH_GROUP_HEADINGS.recipes;

  return (
    <GroupedList title={title} source={caption} label={label}>
      {recipes.map((recipe) => {
        const { nameSegments, energy, macros } = recipeRowFields(recipe, query);

        return (
          <FoodRow
            key={recipe.id}
            layout="search"
            nameSegments={nameSegments}
            caption={describeRecipeServing(recipe)}
            energy={energy}
            macros={macros}
            recipeRowName={describeRecipeSearchRowName(recipe.name, recipe, {
              choosesAmount: false,
            })}
            addDisabled={addDisabled}
            onAdd={() => {
              onAdd(recipe);
            }}
          />
        );
      })}
    </GroupedList>
  );
}
