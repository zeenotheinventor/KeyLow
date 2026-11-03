import { diaryHref } from "./navigation";
import { editRecipeAddIngredientPath, editRecipePath } from "./recipeRoutes";

import type { AssistantCardLink } from "@keylow/core";

/** The address a card's link opens: the recipe editor, the editor's add-ingredient search, one of your foods or a day of the diary. */
export function assistantCardHref(target: AssistantCardLink["target"]): string {
  switch (target.screen) {
    case "recipe_editor":
      return editRecipePath(target.recipeId);
    case "recipe_add_ingredient":
      return editRecipeAddIngredientPath(target.recipeId, target.query);
    case "own_food":
      return `/foods/${target.foodId}`;
    case "diary_day":
      return diaryHref(target.localDate);
  }
}
