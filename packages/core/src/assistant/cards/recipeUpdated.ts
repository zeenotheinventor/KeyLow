import { recipeEditorLink } from "./recipeCreated";
import {
  RECIPE_UPDATED_NOTE,
  describePerServing,
  describeRecipeUpdatedTitle,
} from "../../copy/assistantRecipeCards";

import type { AssistantCardDraft } from "./entryCardEntry";
import type { RecipeCardRecipe } from "./recipeCreated";

/** The card after an `update_recipe`, which has no Undo in M8 (ADR 0006): the new figures and a note. */
export function buildRecipeUpdatedCard(recipe: RecipeCardRecipe): AssistantCardDraft {
  return {
    kind: "recipe_updated",
    title: describeRecipeUpdatedTitle(recipe.name),
    sub: describePerServing(recipe.perServing),
    rows: [],
    totalText: null,
    note: RECIPE_UPDATED_NOTE,
    link: recipeEditorLink(recipe.id),
    undo: "unavailable",
    undoneSub: null,
  };
}
