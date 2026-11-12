import {
  SEARCH_GROUP_HEADINGS,
  describeAddToPlateName,
  describeRecipeSearchRowName,
  describeRecipeServing,
} from "@keylow/core/copy";

import type { RecipeLogGroupProps } from "./types";

import { recipeRowFields } from "@/components/recipes/RecipeRows";
import { FoodRow } from "@/components/ui/FoodRow";
import { GroupedList } from "@/components/ui/GroupedList";

/**
 * "Your recipes · Per serving": the recipes the search found, first in the add dialog. Each row is the search
 * row of a recipe with the serving its plus logs. A press on the row opens the amount step for the recipe,
 * which its name says ("choose amount"), and a press on the plus puts one serving on the plate.
 */
export function RecipeLogGroup({
  recipes,
  query,
  addDisabled,
  onOpen,
  onAdd,
}: RecipeLogGroupProps) {
  const { title, caption, label } = SEARCH_GROUP_HEADINGS.recipes;

  return (
    <GroupedList title={title} source={caption} label={label}>
      {recipes.map((recipe) => {
        const { nameSegments, energy, macros } = recipeRowFields(recipe, query);
        const serving = describeRecipeServing(recipe);

        return (
          <FoodRow
            key={recipe.id}
            layout="search"
            nameSegments={nameSegments}
            caption={serving}
            addLabel={describeAddToPlateName(recipe.name, serving)}
            energy={energy}
            macros={macros}
            recipeRowName={describeRecipeSearchRowName(recipe.name, recipe)}
            onClick={() => {
              onOpen(recipe);
            }}
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
