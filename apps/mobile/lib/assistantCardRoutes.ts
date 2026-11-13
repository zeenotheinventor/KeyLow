import { sessionDetailPath } from "./historyRoutes";
import { diaryHref } from "./navigation";
import { planPath } from "./planRoutes";
import { editRecipeAddIngredientPath, editRecipePath } from "./recipeRoutes";
import { editRoutinePath } from "./routineRoutes";

import type { AssistantCardLink } from "@keylow/core";

/** The address a card's link opens: the recipe editor, the editor's add-ingredient search, one of your foods, a day of the diary, a routine in its editor, a logged session or the Plan screen on the week of a day. */
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
    case "routine_editor":
      return editRoutinePath(target.routineId);
    case "session_detail":
      return sessionDetailPath(target.sessionId);
    case "meal_plan":
      return planPath(target.localDate);
  }
}
