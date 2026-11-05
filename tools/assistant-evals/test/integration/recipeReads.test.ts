import { createRecipe } from "@keylow/api-client";
import {
  buildRecipeIngredient,
  computeRecipe,
  recipeComputedSchema,
  storedRecipeIngredientSchema,
} from "@keylow/core/recipes";
import { foodPortionSchema, foodRowSchema } from "@keylow/core/schemas";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { createEvalDatabase } from "../../src/database.ts";
import { createFixtureUser } from "../../src/fixtureUser.ts";

import type { FixtureUser } from "../../src/fixtureUser.ts";
import type { EvalDatabase } from "../../src/types.ts";

// What the recipe import graders read as the eval user (KEY-701): the food rows, their portions, a recipe's
// stored numbers and its ingredients, each parsed by core's own schema as the graders parse them. It needs the
// local stack and is not part of the unit run. The user is new for this file and removed after it.
let user: FixtureUser;
let database: EvalDatabase;
const sourceUrl = `https://recipes.keylow.test/recipes/key701-${crypto.randomUUID().slice(0, 8)}.html`;

beforeAll(async () => {
  user = await createFixtureUser(inject("stack"), {
    namePrefix: `key701-${crypto.randomUUID().slice(0, 8)}`,
  });
  database = createEvalDatabase(user.client);
}, 120_000);

afterAll(async () => {
  await user.remove();
});

describe("readRows as the eval user", () => {
  it("should read a seeded food with every column, in the shape core's food schema takes", async () => {
    const rows = await database.readRows({
      table: "foods",
      where: { source: "cofid", source_ref: "12-596" },
    });

    expect(rows).toHaveLength(1);
    expect(foodRowSchema.safeParse(rows[0]).success).toBe(true);
  });

  it("should read every default portion of the seed in the shape core's portion schema takes", async () => {
    const rows = await database.readRows({ table: "food_portions", where: { is_default: true } });

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.filter((row) => !foodPortionSchema.safeParse(row).success)).toEqual([]);
  });

  it("should read no recipe for a link nobody imported", async () => {
    const rows = await database.readRows({
      table: "recipes",
      where: { source_url: "https://recipes.keylow.test/recipes/never-imported.html" },
    });

    expect(rows).toEqual([]);
  });

  it("should read a saved recipe by its link, with numbers and ingredients that parse and agree", async () => {
    const [foodRow] = await database.readRows({
      table: "foods",
      where: { source: "cofid", source_ref: "12-596" },
    });
    const food = foodRowSchema.parse(foodRow);
    await createRecipe(user.client, {
      name: "Key701 read check",
      servings: 2,
      yieldGrams: null,
      ingredients: [buildRecipeIngredient(food, { quantity: 200, unit: "g" })],
      steps: [],
      sourceUrl,
    });

    const [recipe] = await database.readRows({
      table: "recipes",
      where: { source_url: sourceUrl },
    });
    const computed = recipeComputedSchema.parse(recipe?.["computed"]);
    const ingredients = (
      await database.readRows({
        table: "recipe_ingredients",
        where: { recipe_id: String(recipe?.["id"]) },
      })
    ).map((row) => storedRecipeIngredientSchema.parse(row));

    expect(ingredients).toHaveLength(1);
    expect(ingredients[0]?.food_id).toBe(food.id);
    expect(
      computeRecipe({ servings: 2, yieldGrams: null, ingredients }).perServing.kcal,
    ).toBeCloseTo(computed.perServing.kcal ?? Number.NaN, 6);
  });
});
