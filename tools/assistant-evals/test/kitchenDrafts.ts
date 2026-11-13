// Drafts made by hand for the kitchen graders, with core's own builders over the fixture foods, so a right play is what the
// tools would show and a wrong play is that draft with one thing changed. No model, no database, no stack.
import {
  buildAdjustmentDraft,
  buildRecipeIngredient,
  buildSuggestionDraft,
  adjustmentTarget,
} from "@keylow/core";

import { FIXTURE_FOODS, fixtureRecipes } from "../fixtures/diary.ts";
import { seededFoods } from "../fixtures/diaryTotals.ts";
import { allKitchenRecipes, perServingOf } from "../fixtures/kitchenFacts.ts";
import { FIXTURE_FOOD_GROUP_CODES } from "../fixtures/palate.ts";
import { palatePreferences } from "../fixtures/palateProfile.ts";

import type { FixtureFood } from "../fixtures/diary.ts";
import type { AssistantRecipeDraft } from "@keylow/core";

export const foods = seededFoods();

/** The fixture foods as the rows of the `foods` table the graders read, with the CoFID group code the seed gives each. */
export const foodRows = FIXTURE_FOODS.map((key) => ({
  ...present(foods.get(key)),
  food_group: FIXTURE_FOOD_GROUP_CODES[key],
}));

function present<Value>(value: Value | undefined): Value {
  if (value === undefined) {
    throw new Error("the fixture has no such food");
  }
  return value;
}

const food = (key: FixtureFood) => present(foods.get(key));

/** A suggestion draft of chicken, rice, broccoli and oil fitted to 650 kcal and 45 g protein, as `suggest_recipe` makes it. */
export function suggestionDraft(
  overrides: { target?: { kcal: number; protein_g: number }; extraLines?: { name: string }[] } = {},
): Extract<AssistantRecipeDraft, { variant: "suggestion" }> {
  const lines = [
    { name: "chicken breast", grams: 120, food: food("chicken"), portions: [] },
    { name: "boiled rice", grams: 250, food: food("rice"), portions: [] },
    { name: "broccoli", grams: 100, food: food("broccoli"), portions: [] },
    { name: "olive oil", grams: 12, food: food("oil"), portions: [] },
    ...(overrides.extraLines ?? []).map(({ name }) => ({
      name,
      grams: 20,
      food: null,
      portions: [],
    })),
  ];
  const outcome = buildSuggestionDraft({
    name: "Chicken and rice plate",
    servings: 1,
    steps: ["Grill the chicken.", "Boil the rice.", "Steam the broccoli."],
    lines,
    target: overrides.target ?? { kcal: 650, protein_g: 45 },
    preferences: palatePreferences(),
  });
  if (outcome.status !== "drafted") {
    throw new Error("the fixture did not draft");
  }
  return outcome.draft;
}

/** An adjustment draft of a kitchen recipe, as `adjust_recipe` makes it by scaling, with no Opus call. */
export function adjustmentDraft(
  recipeName: string,
  change: {
    nutrient: "protein_g" | "carbs_g" | "kcal";
    mode: "add" | "multiply" | "set";
    value: number;
  },
): Extract<AssistantRecipeDraft, { variant: "adjustment" }> {
  const recipe = allKitchenRecipes.find(({ name }) => name === recipeName);
  if (recipe === undefined) {
    throw new Error("no such fixture recipe");
  }
  const outcome = buildAdjustmentDraft({
    recipe: {
      id: `recipe-id-of-${recipeName}`,
      name: recipe.name,
      servings: recipe.servings,
      steps: recipe.steps,
      ingredients: recipe.ingredients.map(({ food: key, grams }) =>
        buildRecipeIngredient(food(key), { quantity: grams, unit: "g" }),
      ),
    },
    target: adjustmentTarget(perServingOf(recipeName), change),
    additions: [],
    preferences: palatePreferences(),
  });
  if (outcome.status !== "drafted") {
    throw new Error("the fixture did not draft");
  }
  return outcome.draft;
}

export const recipeIdOf = (name: string): string => `recipe-id-of-${name}`;

export const fixtureRecipeNames = fixtureRecipes.map(({ name }) => name);
