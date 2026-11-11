// Changes a recipe: its name, its servings, its ingredients or its steps, and what is not named stays as it
// was. The repo saves the whole recipe, so the recipe is read and the changes laid over it, and the numbers
// are worked out again in core. There is no Undo for an edit in M8, because `assistant_actions` holds ids
// and no previous value to go back to (ADR 0006).
import { z } from "zod";

import { buildRecipeUpdatedCard } from "../../core.ts";
import { getRecipe, updateRecipe } from "../../repos.ts";
import { invalidInput, notFound } from "./entryWrite.ts";
import {
  buildIngredients,
  cardRecipeOf,
  checkDraft,
  maxIngredients,
  recipeIngredients,
  recipeName,
  recipeServings,
  recipeSteps,
  recipeView,
} from "./recipeWrite.ts";

import type { RecipeIngredient } from "../../core.ts";
import type { WriteToolDefinition } from "../tool.ts";

const updateRecipeInput = z
  .strictObject({
    id: z.guid().describe("The id of the recipe, from get_recipes."),
    name: recipeName.nullable().describe("The new name, or null to keep it."),
    servings: recipeServings.nullable().describe("The new number of servings, or null to keep it."),
    ingredients: recipeIngredients
      .nullable()
      .describe(
        `The full new list, 1 to ${maxIngredients}, replacing the old one. Null to keep it.`,
      ),
    steps: recipeSteps.nullable().describe("The full new list in order. Null to keep it."),
  })
  .refine(
    ({ name, servings, ingredients, steps }) =>
      name !== null || servings !== null || ingredients !== null || steps !== null,
    { path: ["name"] },
  );

type UpdateRecipeInput = z.infer<typeof updateRecipeInput>;

export const updateRecipeTool: WriteToolDefinition<UpdateRecipeInput> = {
  name: "update_recipe",
  description:
    "Changes one of the user's recipes: its name, servings, ingredients or steps. Take the id from " +
    "get_recipes. No tool shows a recipe's ingredients or steps, so send ingredients or steps only " +
    "when the whole current list is in this conversation, for example a recipe you just created. They " +
    "replace the old list, so send every line the recipe should have, built as " +
    "create_recipe does. A line you send unchanged keeps the values it was saved with. " +
    "Otherwise change the name or the servings only, set the rest to null, and tell the user to change " +
    "ingredients and steps in the recipe editor. This cannot be undone from the card, so tell the user " +
    "they can change it again in the recipe editor.",
  kind: "write",
  // Four nullable fields and a nullable list of ingredients would use five of the 16 union parameters a
  // request may hold across its strict tools, so this tool opts out. The executor checks every input with
  // the same schema.
  strict: false,
  input: updateRecipeInput,
  annotations: { readOnlyHint: false, destructiveHint: true },
  targetTable: "recipes",
  async run(ctx, { id, name, servings, ingredients, steps }) {
    const recipe = await getRecipe(ctx.caller, id);
    if (recipe === null) {
      return notFound;
    }
    let built: readonly RecipeIngredient[] = recipe.ingredients;
    if (ingredients !== null) {
      const rebuilt = await buildIngredients(ctx, ingredients, recipe.ingredients);
      if ("refused" in rebuilt) {
        return rebuilt.refused;
      }
      built = rebuilt.ingredients;
    }
    const checked = checkDraft({
      name: name ?? recipe.name,
      servings: servings ?? recipe.servings,
      yieldGrams: recipe.yield_grams,
      ingredients: built,
      steps: steps ?? recipe.instructions,
    });
    if (!checked.ok) {
      return checked.refused;
    }
    let saved;
    try {
      saved = await updateRecipe(ctx.caller, { id, ...checked.save });
    } catch (caught) {
      // A RangeError from the repo is a recipe it refuses before any request. It quotes no value.
      if (caught instanceof RangeError) {
        return invalidInput(["recipe"]);
      }
      throw caught;
    }
    return {
      data: { updated: recipeView(saved) },
      structured: { card: buildRecipeUpdatedCard(cardRecipeOf(saved)) },
      target: { targetId: id },
    };
  },
  // An edit keeps no previous value, so there is nothing to go back to.
  inverse: null,
};
