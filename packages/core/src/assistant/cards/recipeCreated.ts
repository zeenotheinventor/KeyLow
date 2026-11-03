import {
  OPEN_IN_RECIPE_EDITOR,
  describePerServing,
  describeRecipeCreatedTitle,
  describeRecipeCreatedUndone,
} from "../../copy/assistantRecipeCards";

import type { AssistantCardDraft } from "./entryCardEntry";
import type { NullableNutrients } from "../../schemas/nutrients";

export type RecipeCardRecipe = {
  id: string;
  name: string;
  servings: number;
  /** The recipe's own `computed.perServing`, as core worked it out when the recipe was saved. */
  perServing: Pick<NullableNutrients, "kcal" | "protein_g" | "carbs_g" | "fat_g">;
};

/** The link into the recipe editor, which a created and an updated recipe card share. */
export const recipeEditorLink = (recipeId: string): NonNullable<AssistantCardDraft["link"]> => ({
  label: OPEN_IN_RECIPE_EDITOR,
  target: { screen: "recipe_editor", recipeId },
});

/**
 * The card after a `create_recipe`: "Added recipe Chicken and rice, 4 servings", the numbers of one
 * serving and a link into the recipe editor. Undo archives the recipe.
 */
export function buildRecipeCreatedCard(recipe: RecipeCardRecipe): AssistantCardDraft {
  return {
    kind: "recipe_created",
    title: describeRecipeCreatedTitle(recipe.name, recipe.servings),
    sub: describePerServing(recipe.perServing),
    rows: [],
    totalText: null,
    note: null,
    link: recipeEditorLink(recipe.id),
    undo: "available",
    undoneSub: describeRecipeCreatedUndone(recipe.name),
  };
}
