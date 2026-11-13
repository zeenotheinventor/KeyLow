import type { AssistantCardLink } from "@keylow/core";

import { diaryHref } from "@/lib/diary";
import { editRecipeAddIngredientPath, editRecipePath } from "@/lib/recipeRoutes";
import { trainRoutineEditPath, trainSessionDetailPath } from "@/lib/trainRoutes";

/**
 * The address a card's link opens: the recipe editor, the editor's add-ingredient search, one of your foods, a day of
 * the diary, a routine in its editor or a logged session. The meal plan has no page on the web, so its link has no
 * address (null) and the web draws no link for it.
 */
export function assistantCardHref(target: AssistantCardLink["target"]): string | null {
  switch (target.screen) {
    case "recipe_editor":
      return editRecipePath(target.recipeId);
    case "recipe_add_ingredient":
      return editRecipeAddIngredientPath(target.recipeId, target.query);
    case "own_food":
      return `/foods/${target.foodId}`;
    case "diary_day":
      return diaryHref({ date: target.localDate });
    case "routine_editor":
      return trainRoutineEditPath(target.routineId);
    case "session_detail":
      return trainSessionDetailPath(target.sessionId);
    case "meal_plan":
      return null;
  }
}
