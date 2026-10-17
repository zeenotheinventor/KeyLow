import { buildRecipeLogEntry } from "@keylow/core/diary";
import { buildRecipeIngredient, computeRecipe } from "@keylow/core/recipes";
import { customFoodInputSchema } from "@keylow/core/schemas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { createFood, listFoodPortions, softDeleteFood, updateFood } from "../../src/repos/foods";
import { getRecipe, previewRecipeRefresh } from "../../src/repos/recipes";
import { applyRecipeRefresh, createRecipe } from "../../src/repos/recipeWrites";

import type { TestUser } from "./support/users";
import type { RecipeDetail } from "../../src/repos/recipes";
import type { Food, FoodPortion } from "@keylow/core/schemas";

const RUN_ID = crypto.randomUUID();

// Every row this suite writes is named with this prefix, and every assertion looks at those rows only,
// so recipes and foods another session left on the shared stack cannot change a result.
const NAME_PREFIX = `key290-${RUN_ID}`;

const SERVINGS = 4;

type CustomFood = { food: Food; portions: FoodPortion[] };

type FoodValues = { kcal: number; portions?: { label: string; grams: number }[] };

const customFoodInput = (name: string, { kcal, portions = [] }: FoodValues) =>
  customFoodInputSchema.parse({
    name: `${NAME_PREFIX}-food-${name}`,
    basis: "per_100g",
    kcal,
    protein_g: 10,
    fat_g: 10,
    carbs_g: 40,
    portions: portions.map((portion, index) => ({ ...portion, isDefault: index === 0 })),
  });

const onlyPortionOf = ({ portions }: CustomFood): FoodPortion => {
  const [portion] = portions;
  if (portion === undefined) {
    throw new Error("The food was made with a portion");
  }
  return portion;
};

const recipeOrFail = async (owner: TestUser, id: string): Promise<RecipeDetail> => {
  const recipe = await getRecipe(owner.client, id);
  if (recipe === null) {
    throw new Error("The recipe should exist");
  }
  return recipe;
};

describe("refreshing a recipe's ingredients against the local stack with real user JWTs", () => {
  let owner: TestUser;
  let stranger: TestUser;

  /**
   * Makes a recipe of 500 g of chicken, 200 g of rice and 3 eggs (a natural portion of 50 g), in four
   * servings, on foods of its own, so a test can change the foods without touching another's recipe.
   */
  const makeRecipe = async (label: string) => {
    const make = (name: string, values: FoodValues) =>
      createFood(owner.client, owner.id, customFoodInput(`${label}-${name}`, values));
    const [chicken, rice, eggs] = await Promise.all([
      make("chicken", { kcal: 120 }),
      make("rice", { kcal: 360 }),
      make("eggs", { kcal: 143, portions: [{ label: "1 egg", grams: 50 }] }),
    ]);
    const recipe = await createRecipe(owner.client, {
      name: `${NAME_PREFIX}-${label}`,
      servings: SERVINGS,
      yieldGrams: null,
      ingredients: [
        buildRecipeIngredient(chicken.food, { quantity: 500, unit: "g" }),
        buildRecipeIngredient(rice.food, { quantity: 200, unit: "g" }),
        buildRecipeIngredient(eggs.food, {
          quantity: 3,
          unit: "portion",
          portion: onlyPortionOf(eggs),
        }),
      ],
      steps: ["Cook the rice.", "Cook the chicken.", "Serve."],
    });
    return { chicken, rice, eggs, recipe };
  };

  /** Logs the recipe as one serving by inserting the entry directly, as the user, through row level security. */
  const logOneServing = async (recipe: RecipeDetail) => {
    const { data, error } = await owner.client
      .from("food_log_entries")
      .insert(
        buildRecipeLogEntry({
          recipe,
          quantity: 1,
          unit: "serving",
          loggedAt: "2026-10-16T12:00:00+00:00",
          localDate: "2026-10-16",
        }),
      )
      .select("*")
      .single();
    if (error) {
      throw new Error(`Could not log the recipe entry (${error.code})`);
    }
    return data;
  };

  const entryOf = async (id: string) => {
    const { data, error } = await owner.client
      .from("food_log_entries")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      throw new Error(`Could not read the entry (${error.code})`);
    }
    return data;
  };

  beforeAll(async () => {
    [owner, stranger] = await Promise.all([createTestUser("key290"), createTestUser("key290")]);
  });

  afterAll(async () => {
    // Deleting the users takes their foods, recipes, ingredients and entries with them. The service
    // role has no grant on the recipe tables, so what is left is checked from outside, in the runbook.
    await deleteCreatedTestUsers();
  });

  describe("a food whose calories changed after the ingredient was added", () => {
    let setUp: Awaited<ReturnType<typeof makeRecipe>>;
    let recipeBeforeAnyChange: RecipeDetail;
    let entryBeforeTheRefresh: Awaited<ReturnType<typeof logOneServing>>;

    beforeAll(async () => {
      setUp = await makeRecipe("refresh-flow");
      recipeBeforeAnyChange = await recipeOrFail(owner, setUp.recipe.id);
      entryBeforeTheRefresh = await logOneServing(recipeBeforeAnyChange);
      await updateFood(
        owner.client,
        setUp.chicken.food.id,
        customFoodInput("refresh-flow-chicken", { kcal: 150 }),
      );
    });

    it("should leave the ingredient snapshot and the totals as they were until a refresh", async () => {
      const stored = await recipeOrFail(owner, setUp.recipe.id);

      expect(stored).toEqual(recipeBeforeAnyChange);
      expect(stored.ingredients[0]?.snapshot.per100.kcal).toBe(120);
      expect(stored.computed.perServing.kcal).toBe(
        computeRecipe({
          servings: SERVINGS,
          yieldGrams: null,
          ingredients: recipeBeforeAnyChange.ingredients,
        }).perServing.kcal,
      );
    });

    it("should preview a per serving calorie difference equal to the changed ingredient's share, and write nothing", async () => {
      const before = await recipeOrFail(owner, setUp.recipe.id);

      const preview = await previewRecipeRefresh(owner.client, setUp.recipe.id);

      expect(preview?.hasChanges).toBe(true);
      expect(preview?.changes.map(({ changed, foodGone }) => [changed, foodGone])).toEqual([
        [true, false],
        [false, false],
        [false, false],
      ]);
      // 500 g of chicken gains 30 kcal per 100 g, shared between the four servings.
      const difference =
        (preview?.perServing.kcal.after ?? Number.NaN) -
        (preview?.perServing.kcal.before ?? Number.NaN);
      expect(difference).toBeCloseTo((500 * 0.3) / SERVINGS, 9);
      expect(preview?.before).toEqual(before.computed);
      expect(await recipeOrFail(owner, setUp.recipe.id)).toEqual(before);
    });

    it("should apply the new snapshots and a cache equal to core's computeRecipe of them", async () => {
      const applied = await applyRecipeRefresh(owner.client, setUp.recipe.id);

      expect(applied.hasChanges).toBe(true);
      const stored = await recipeOrFail(owner, setUp.recipe.id);
      expect(stored.ingredients[0]?.snapshot.per100.kcal).toBe(150);
      expect(stored.ingredients.slice(1)).toEqual(recipeBeforeAnyChange.ingredients.slice(1));
      expect(stored.computed).toEqual(
        computeRecipe({ servings: SERVINGS, yieldGrams: null, ingredients: stored.ingredients }),
      );
      expect(stored.computed).toEqual(applied.after);
      expect(stored.name).toBe(recipeBeforeAnyChange.name);
      expect(stored.instructions).toEqual(recipeBeforeAnyChange.instructions);
    });

    it("should show no changes in a second preview, and apply nothing the second time", async () => {
      const preview = await previewRecipeRefresh(owner.client, setUp.recipe.id);
      const stored = await recipeOrFail(owner, setUp.recipe.id);

      const appliedAgain = await applyRecipeRefresh(owner.client, setUp.recipe.id);

      expect(preview?.hasChanges).toBe(false);
      expect(appliedAgain.hasChanges).toBe(false);
      expect(await recipeOrFail(owner, setUp.recipe.id)).toEqual(stored);
    });

    it("should leave a diary entry logged from the recipe before the refresh unchanged", async () => {
      const entryAfterTheRefresh = await entryOf(entryBeforeTheRefresh.id);

      expect(entryAfterTheRefresh).toEqual(entryBeforeTheRefresh);
      expect(entryAfterTheRefresh.snapshot).toMatchObject({
        kind: "recipe",
        total: recipeBeforeAnyChange.computed.total,
      });
    });
  });

  describe("an ingredient measured in a portion of a food that changed", () => {
    it("should stay in that portion, now linked to the food's new portion row", async () => {
      const { eggs, recipe } = await makeRecipe("portion-follows");
      await updateFood(
        owner.client,
        eggs.food.id,
        customFoodInput("portion-follows-eggs", {
          kcal: 160,
          portions: [{ label: "1 egg", grams: 50 }],
        }),
      );
      const [newPortion] = await listFoodPortions(owner.client, eggs.food.id);

      const applied = await applyRecipeRefresh(owner.client, recipe.id);

      expect(applied.changes[2]).toMatchObject({ changed: true, portionFellBack: false });
      const stored = await recipeOrFail(owner, recipe.id);
      expect(newPortion?.id).not.toBe(onlyPortionOf(eggs).id);
      expect(stored.ingredients[2]).toMatchObject({
        unit: "portion",
        quantity: 3,
        portion_id: newPortion?.id,
        resolved_grams: 150,
      });
      expect(stored.ingredients[2]?.snapshot.per100.kcal).toBe(160);
      expect(stored.computed).toEqual(
        computeRecipe({ servings: SERVINGS, yieldGrams: null, ingredients: stored.ingredients }),
      );
    });
  });

  describe("a food that only changed in a portion", () => {
    it("should not count as a change, and a refresh leaves the recipe as it was", async () => {
      const { eggs, recipe } = await makeRecipe("portion-only");
      await updateFood(
        owner.client,
        eggs.food.id,
        customFoodInput("portion-only-eggs", {
          kcal: 143,
          portions: [{ label: "1 egg", grams: 60 }],
        }),
      );
      const before = await recipeOrFail(owner, recipe.id);

      const preview = await previewRecipeRefresh(owner.client, recipe.id);
      const applied = await applyRecipeRefresh(owner.client, recipe.id);

      expect(preview?.hasChanges).toBe(false);
      expect(applied.hasChanges).toBe(false);
      expect(await recipeOrFail(owner, recipe.id)).toEqual(before);
    });
  });

  describe("a food that was soft deleted since the ingredient was added", () => {
    it("should be reported as gone, and the ingredient kept as it was, while the other foods refresh", async () => {
      const { chicken, rice, recipe } = await makeRecipe("soft-deleted");
      const before = await recipeOrFail(owner, recipe.id);
      await updateFood(
        owner.client,
        chicken.food.id,
        customFoodInput("soft-deleted-chicken", { kcal: 150 }),
      );
      await softDeleteFood(owner.client, chicken.food.id);
      await updateFood(
        owner.client,
        rice.food.id,
        customFoodInput("soft-deleted-rice", { kcal: 400 }),
      );

      const preview = await previewRecipeRefresh(owner.client, recipe.id);

      expect(preview?.changes.map(({ changed, foodGone }) => [changed, foodGone])).toEqual([
        [false, true],
        [true, false],
        [false, false],
      ]);
      expect(preview?.hasChanges).toBe(true);

      await applyRecipeRefresh(owner.client, recipe.id);

      const stored = await recipeOrFail(owner, recipe.id);
      expect(stored.ingredients[0]).toEqual(before.ingredients[0]);
      expect(stored.ingredients[1]?.snapshot.per100.kcal).toBe(400);
      expect(stored.ingredients).toHaveLength(3);
    });

    it("should report the recipe as unchanged when the gone food is the only difference", async () => {
      const { chicken, recipe } = await makeRecipe("only-gone");
      await softDeleteFood(owner.client, chicken.food.id);

      const preview = await previewRecipeRefresh(owner.client, recipe.id);

      expect(preview?.hasChanges).toBe(false);
      expect(preview?.changes[0]).toMatchObject({ foodGone: true, changed: false });
    });
  });

  describe("another user's recipe", () => {
    it("should be not found to preview and refuse to apply, as a recipe that does not exist", async () => {
      const { recipe } = await makeRecipe("not-yours");

      expect(await previewRecipeRefresh(stranger.client, recipe.id)).toBeNull();
      await expect(applyRecipeRefresh(stranger.client, recipe.id)).rejects.toThrow(
        "Could not refresh the recipe's ingredients (P0002)",
      );
    });
  });
});
