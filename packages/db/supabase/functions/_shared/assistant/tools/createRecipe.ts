// Saves a recipe from typed ingredients: "Make a recipe called Chicken and rice: 500 g chicken breast...".
// The ingredients are built from the foods as the database holds them and the numbers are worked out in
// core, so the stored cache never comes from anything the model sent. Undo archives the recipe, as the
// recipe list does, and takes it out of the list without losing it.
import { z } from "zod";

import { buildRecipeCreatedCard } from "../../core.ts";
import { createRecipe } from "../../repos.ts";
import { invalidInput } from "./entryWrite.ts";
import {
  archiveMadeRecipe,
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

import type { WriteToolDefinition } from "../tool.ts";

const createRecipeInput = z.strictObject({
  name: recipeName.describe("The recipe's name, as the user said it."),
  servings: recipeServings.describe("How many servings the recipe makes."),
  ingredients: recipeIngredients.describe(
    `The ingredients, 1 to ${maxIngredients}, each a food from search_foods or get_food and an amount.`,
  ),
  steps: recipeSteps.describe("The method, one string for each step in order, or an empty list."),
  source_url: z
    .url({ protocol: /^https?$/ })
    .regex(/^https?:\/\//)
    .max(2000)
    .nullable()
    .describe("The web page the recipe came from, only when the user gave one. Otherwise null."),
});

type CreateRecipeInput = z.infer<typeof createRecipeInput>;

export const createRecipeTool: WriteToolDefinition<CreateRecipeInput> = {
  name: "create_recipe",
  description:
    "Saves a new recipe to the user's recipes and shows them a card with Undo and a link into the recipe " +
    "editor. Find every ingredient's food with search_foods first, never an id you have not seen. For each " +
    "ingredient use unit portion with one of that food's own portion ids and a count, such as 2 of a tbsp " +
    "portion, or unit g or ml only for an amount the user said, such as 500 g of chicken. If the user gave " +
    "no amount and no portion fits, ask them with ask_user instead of guessing. Do not describe an amount " +
    "in hand measures. Pass the steps in order, or an empty list when the user gave none, and the servings " +
    "the recipe makes. Leave source_url null unless the user gave a web page. The numbers on the card come " +
    "from the saved recipe, not from anything you send.",
  kind: "write",
  input: createRecipeInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  targetTable: "recipes",
  async run(ctx, { name, servings, ingredients, steps, source_url }) {
    const built = await buildIngredients(ctx, ingredients);
    if ("refused" in built) {
      return built.refused;
    }
    const checked = checkDraft({
      name,
      servings,
      yieldGrams: null,
      ingredients: built.ingredients,
      steps,
    });
    if (!checked.ok) {
      return checked.refused;
    }
    let recipe;
    try {
      recipe = await createRecipe(ctx.caller, {
        ...checked.save,
        ...(source_url === null ? {} : { sourceUrl: source_url }),
      });
    } catch (caught) {
      // A RangeError from the repo is a recipe it refuses before any request. It quotes no value.
      if (caught instanceof RangeError) {
        return invalidInput(["recipe"]);
      }
      throw caught;
    }

    // The write has landed, and it carried the link, so nothing below can leave the recipe without it.
    return {
      data: { created: recipeView(recipe) },
      structured: { card: buildRecipeCreatedCard(cardRecipeOf(recipe)) },
      target: { targetId: recipe.id },
    };
  },
  inverse: archiveMadeRecipe,
};
