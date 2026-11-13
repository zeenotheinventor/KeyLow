import type { AssistantCardLink } from "@keylow/core";

import { diaryHref } from "@/lib/diary";
import { editRecipePath } from "@/lib/recipeRoutes";
import { trainRoutineEditPath, trainSessionDetailPath } from "@/lib/trainRoutes";

/** The query parameter that carries the word an imported line's food was searched for, as the phone's editor reads it. */
const ADD_INGREDIENT_QUERY_PARAMETER = "addIngredient";

/** The address a card's link opens: the recipe editor, the editor's add-ingredient search, one of your foods, a day of the diary, a routine in its editor or a logged session. */
export function assistantCardHref(target: AssistantCardLink["target"]): string {
  switch (target.screen) {
    case "recipe_editor":
      return editRecipePath(target.recipeId);
    case "recipe_add_ingredient":
      return `${editRecipePath(target.recipeId)}?${ADD_INGREDIENT_QUERY_PARAMETER}=${encodeURIComponent(target.query)}`;
    case "own_food":
      return `/foods/${target.foodId}`;
    case "diary_day":
      return diaryHref({ date: target.localDate });
    case "routine_editor":
      return trainRoutineEditPath(target.routineId);
    case "session_detail":
      return trainSessionDetailPath(target.sessionId);
  }
}
