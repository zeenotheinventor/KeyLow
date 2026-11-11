// What the recipe write tools share: the shape of an ingredient and the one build from it, the checks
// core makes of a recipe before it is saved, and the numbers a recipe card is worded from. An ingredient
// is built from the food as the database holds it, and never from a number the model sent.
import { z } from "zod";

import { buildRecipeIngredient, canMeasureByVolume, validateRecipeDraft } from "../../core.ts";
import { getFood, getRecipe, listFoodPortions, setRecipeArchived } from "../../repos.ts";
import { invalidInput } from "./entryWrite.ts";

import type { RecipeDraftProblem, RecipeIngredient } from "../../core.ts";
import type { RecipeDetail } from "../../repos.ts";
import type { ActionRecord } from "../store.ts";
import type { InverseOutcome, ToolContext, WriteRunOutput } from "../tool.ts";

export const maxIngredients = 40;
const maxPortionCount = 100;
const maxGramsOrMillilitres = 10000;
export const maxSteps = 50;
export const maxStepLength = 1000;

// One flat shape and not a union of three, because a strict tool schema holds no union. `unit` says which
// amount it is, and `portion_id` goes with the portion unit only.
const ingredientInput = z
  .strictObject({
    food_id: z.guid().describe("The food's id from search_foods or get_food."),
    unit: z
      .enum(["portion", "g", "ml"])
      .describe(
        "portion: a count of one of the food's own portions, such as 2 tbsp. g: grams the user said. ml: millilitres the user said.",
      ),
    amount: z
      .number()
      .positive()
      .max(maxGramsOrMillilitres)
      .describe(
        `How many portions for portion (at most ${maxPortionCount}), otherwise how many grams or millilitres.`,
      ),
    portion_id: z
      .guid()
      .nullable()
      .describe("The id of one of that food's portions. For portion, otherwise null."),
  })
  .superRefine((ingredient, context) => {
    if ((ingredient.unit === "portion") !== (ingredient.portion_id !== null)) {
      context.addIssue({
        code: "custom",
        path: ["portion_id"],
        message: "Wrong field for this unit",
      });
    }
    if (ingredient.unit === "portion" && ingredient.amount > maxPortionCount) {
      context.addIssue({ code: "custom", path: ["amount"], message: "Too many portions" });
    }
  });

export type IngredientInput = z.infer<typeof ingredientInput>;

export const recipeName = z.string().trim().min(1).max(200);
export const recipeServings = z.number().positive().max(1000);
export const recipeIngredients = z.array(ingredientInput).min(1).max(maxIngredients);
export const recipeSteps = z.array(z.string().trim().min(1).max(maxStepLength)).max(maxSteps);

const fieldOfProblem: Record<RecipeDraftProblem, string> = {
  name_required: "name",
  name_too_long: "name",
  servings_invalid: "servings",
  servings_too_many: "servings",
  cooked_weight_invalid: "recipe",
  cooked_weight_too_large: "recipe",
  cooked_weight_with_food_per_portion: "recipe",
  ingredients_none: "ingredients",
  ingredients_too_many: "ingredients",
  ingredient_invalid: "ingredients",
  steps_too_many: "steps",
  step_too_long: "steps",
};

type Built = { ingredients: RecipeIngredient[] } | { refused: WriteRunOutput };

// A resent line is the stored line when it names the same food, unit, amount and portion. It keeps its stored
// row and the snapshot it was frozen with (ADR 0003, Amendment 8), and each stored line is used once.
function keptLines(
  inputs: readonly IngredientInput[],
  stored: readonly RecipeIngredient[],
): (RecipeIngredient | null)[] {
  const unused = [...stored];
  return inputs.map((input) => {
    const at = unused.findIndex(
      (line) =>
        line.food_id === input.food_id &&
        line.unit === input.unit &&
        line.quantity === input.amount &&
        line.portion_id === input.portion_id,
    );
    return at === -1 ? null : (unused.splice(at, 1)[0] ?? null);
  });
}

// Each new ingredient's food and portions are read once, however many lines use the food. A line that
// matches one of `stored` is not built again, so a food that was deleted or has changed since cannot
// move or refuse a line nobody changed.
export async function buildIngredients(
  ctx: ToolContext,
  inputs: readonly IngredientInput[],
  stored: readonly RecipeIngredient[] = [],
): Promise<Built> {
  const kept = keptLines(inputs, stored);
  const foodIds = [
    ...new Set(inputs.flatMap(({ food_id }, index) => (kept[index] === null ? [food_id] : []))),
  ];
  const read = new Map(
    await Promise.all(
      foodIds.map(async (id) => {
        const [food, portions] = await Promise.all([
          getFood(ctx.caller, id),
          listFoodPortions(ctx.caller, id),
        ]);
        return [id, { food, portions }] as const;
      }),
    ),
  );
  const ingredients: RecipeIngredient[] = [];
  for (const [index, input] of inputs.entries()) {
    const keptLine = kept[index];
    if (keptLine !== null && keptLine !== undefined) {
      ingredients.push(keptLine);
      continue;
    }
    const found = read.get(input.food_id);
    const food = found?.food ?? null;
    // The repo returns a deleted food, because an old entry must keep resolving it. A deleted food is not
    // something to put in a recipe, whether or not the model looked it up first.
    if (found === undefined || food === null || food.deleted_at !== null) {
      return {
        refused: {
          data: { error: "not_found", fields: [`ingredients.${index}.food_id`] },
          target: null,
        },
      };
    }
    const portion = found.portions.find(({ id }) => id === input.portion_id);
    if (input.unit === "portion" && portion === undefined) {
      return { refused: invalidInput([`ingredients.${index}.portion_id`]) };
    }
    // Without a density of its own or an estimate, a millilitre would be saved as a gram.
    if (input.unit === "ml" && !canMeasureByVolume(food, found.portions)) {
      return { refused: invalidInput([`ingredients.${index}.amount`]) };
    }
    try {
      ingredients.push(
        buildRecipeIngredient(food, {
          quantity: input.amount,
          unit: input.unit,
          ...(portion === undefined ? {} : { portion }),
          foodPortions: found.portions,
        }),
      );
    } catch (caught) {
      // A RangeError from the builder is an amount the food cannot be worked out from. It quotes no value.
      if (caught instanceof RangeError) {
        return { refused: invalidInput([`ingredients.${index}.amount`]) };
      }
      throw caught;
    }
  }
  return { ingredients };
}

type Draft = {
  name: string;
  servings: number;
  yieldGrams: number | null;
  ingredients: readonly RecipeIngredient[];
  steps: readonly string[];
};

// The recipe core would save, or the fields it refuses, named and never quoted.
export function checkDraft(draft: Draft) {
  const checked = validateRecipeDraft({
    name: draft.name,
    servings: String(draft.servings),
    cookedWeight: draft.yieldGrams === null ? "" : String(draft.yieldGrams),
    ingredients: draft.ingredients,
    steps: draft.steps,
  });
  return checked.ok
    ? { ok: true as const, save: { ...checked.value, ingredients: draft.ingredients } }
    : {
        ok: false as const,
        refused: invalidInput([
          ...new Set(checked.problems.map((problem) => fieldOfProblem[problem])),
        ]),
      };
}

// The numbers of one serving, as the model reads them and as the card words them.
export const perServingOf = ({ computed: { perServing } }: RecipeDetail) => ({
  kcal: perServing.kcal,
  protein_g: perServing.protein_g,
  carbs_g: perServing.carbs_g,
  fat_g: perServing.fat_g,
});

export const recipeView = (recipe: RecipeDetail) => ({
  id: recipe.id,
  name: recipe.name,
  servings: recipe.servings,
  per_serving: perServingOf(recipe),
});

export const cardRecipeOf = (recipe: RecipeDetail) => ({
  id: recipe.id,
  name: recipe.name,
  servings: recipe.servings,
  perServing: perServingOf(recipe),
});

// Undo of a recipe a tool made: archives it, as the recipe list does, unless the person has archived or
// deleted it already. `recipes` has no change time to compare, so an edit made since is not noticed, and
// archiving loses nothing.
export async function archiveMadeRecipe(
  ctx: ToolContext,
  { targetId }: ActionRecord,
): Promise<InverseOutcome> {
  const recipe = targetId === null ? null : await getRecipe(ctx.caller, targetId);
  if (targetId === null || recipe === null || recipe.is_archived) {
    return "unavailable";
  }
  await setRecipeArchived(ctx.caller, targetId, true);
  return "undone";
}
