import { SPOON_PORTIONS } from "@keylow/core/nutrition";
import { buildRecipeIngredient, computeRecipe, moveStep, removeStep } from "@keylow/core/recipes";
import { customFoodInputSchema } from "@keylow/core/schemas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { createFood, updateFood } from "../../src/repos/foods";
import { getRecipe, listRecipes } from "../../src/repos/recipes";
import {
  createRecipe,
  duplicateRecipe,
  setRecipeArchived,
  updateRecipe,
} from "../../src/repos/recipeWrites";

import type { TestUser } from "./support/users";
import type { RecipeSave } from "../../src/repos/recipeWrites";
import type { RecipeIngredient } from "@keylow/core/recipes";
import type { Food, FoodPortion } from "@keylow/core/schemas";

const RUN_ID = crypto.randomUUID();

// Every row this suite writes is named with this prefix, and every assertion looks at those rows only,
// so recipes another session left on the shared stack cannot change a result.
const NAME_PREFIX = `key289-${RUN_ID}`;

const nameOf = (name: string) => `${NAME_PREFIX}-${name}`;

type CustomFood = { food: Food; portions: FoodPortion[] };

const customFoodInput = (
  name: string,
  extra: { kcal?: number; density_g_per_ml?: number; portions?: unknown[] } = {},
) =>
  customFoodInputSchema.parse({
    name: `${NAME_PREFIX}-food-${name}`,
    basis: "per_100g",
    kcal: extra.kcal ?? 300,
    protein_g: 10,
    fat_g: 10,
    carbs_g: 40,
    density_g_per_ml: extra.density_g_per_ml,
    portions: extra.portions ?? [],
  });

const tablespoon = SPOON_PORTIONS.find((portion) => portion.label === "1 tbsp");
if (tablespoon === undefined) {
  throw new Error("The spoon portions must include a tablespoon");
}

/** The only portion of a food that was made with one, so a test need not guess that it exists. */
const onlyPortionOf = ({ portions }: CustomFood): FoodPortion => {
  const [portion] = portions;
  if (portion === undefined) {
    throw new Error("The food was made with a portion");
  }
  return portion;
};

const recipesOf = async (owner: TestUser) =>
  (await listRecipes(owner.client, { archived: true })).filter((recipe) =>
    recipe.name.startsWith(NAME_PREFIX),
  );

describe("writing recipes against the local stack with real user JWTs", () => {
  let userA: TestUser;
  let userB: TestUser;
  let lentils: CustomFood;
  let rice: CustomFood;
  let flour: CustomFood;
  let eggs: CustomFood;
  let oil: CustomFood;
  let spinach: CustomFood;
  let foodOfB: CustomFood;

  /** The six ingredients: three foods in grams, one in a natural portion, one in a spoon, one more in grams. */
  const sixIngredients = (): RecipeIngredient[] => [
    buildRecipeIngredient(lentils.food, { quantity: 250, unit: "g" }),
    buildRecipeIngredient(rice.food, { quantity: 125.5, unit: "g" }),
    buildRecipeIngredient(flour.food, { quantity: 80, unit: "g" }),
    buildRecipeIngredient(eggs.food, {
      quantity: 3,
      unit: "portion",
      portion: onlyPortionOf(eggs),
    }),
    buildRecipeIngredient(oil.food, { quantity: 1.5, unit: "portion", portion: tablespoon }),
    buildRecipeIngredient(spinach.food, { quantity: 60, unit: "g" }),
  ];

  /** An ingredient on a food id the database has never seen, so the insert of its row is refused. */
  const ingredientOfUnknownFood = (): RecipeIngredient =>
    buildRecipeIngredient(
      { ...lentils.food, id: crypto.randomUUID() },
      { quantity: 100, unit: "g" },
    );

  const stewSave = (overrides: Partial<RecipeSave> = {}): RecipeSave => ({
    name: nameOf("Lentil stew"),
    servings: 4,
    yieldGrams: 1100,
    ingredients: sixIngredients(),
    steps: ["Fry the onion.", "Add the lentils.", "Simmer for an hour.", "Serve."],
    ...overrides,
  });

  beforeAll(async () => {
    [userA, userB] = await Promise.all([createTestUser("key289"), createTestUser("key289")]);

    const make = (name: string, extra?: Parameters<typeof customFoodInput>[1]) =>
      createFood(userA.client, userA.id, customFoodInput(name, extra));
    lentils = await make("lentils", { kcal: 340 });
    rice = await make("rice", { kcal: 360 });
    flour = await make("flour", { kcal: 364 });
    eggs = await make("eggs", {
      kcal: 143,
      portions: [{ label: "1 egg", grams: 50, isDefault: true }],
    });
    oil = await make("oil", { kcal: 884, density_g_per_ml: 0.92 });
    spinach = await make("spinach", { kcal: 23 });
    foodOfB = await createFood(userB.client, userB.id, customFoodInput("food-of-b"));
  });

  afterAll(async () => {
    // Deleting the users takes their foods, recipes and ingredients with them. The service role has
    // no grant on the recipe tables, so what is left is checked from outside, in the runbook.
    await deleteCreatedTestUsers();
  });

  describe("creating a recipe with six ingredients", () => {
    it("should store the ingredients and the steps in order and read them back", async () => {
      const created = await createRecipe(userA.client, stewSave());

      const stored = await getRecipe(userA.client, created.id);
      expect(stored).toMatchObject({
        id: created.id,
        name: nameOf("Lentil stew"),
        servings: 4,
        yield_grams: 1100,
        is_archived: false,
        instructions: ["Fry the onion.", "Add the lentils.", "Simmer for an hour.", "Serve."],
      });
      expect(stored?.ingredients.map(({ position }) => position)).toEqual([0, 1, 2, 3, 4, 5]);
      expect(stored?.ingredients.map(({ food_id }) => food_id)).toEqual(
        [lentils, rice, flour, eggs, oil, spinach].map(({ food }) => food.id),
      );
      expect(stored?.ingredients.map(({ unit }) => unit)).toEqual([
        "g",
        "g",
        "g",
        "portion",
        "portion",
        "g",
      ]);
    });

    it("should link the natural portion and leave the spoon without a link", async () => {
      const created = await createRecipe(userA.client, stewSave());

      const [, , , egg, spoon] = created.ingredients;
      expect(egg).toMatchObject({ portion_id: onlyPortionOf(eggs).id, resolved_grams: 150 });
      expect(spoon?.portion_id).toBeNull();
      expect(spoon?.snapshot.portion).toEqual({ label: "1 tbsp", ml: 15 });
    });

    it("should store a computed cache equal to core's computeRecipe of the stored ingredients, exactly", async () => {
      const created = await createRecipe(userA.client, stewSave());

      const stored = await getRecipe(userA.client, created.id);
      expect(stored?.computed).toEqual(
        computeRecipe({
          servings: 4,
          yieldGrams: 1100,
          ingredients: stored?.ingredients ?? [],
        }),
      );
      expect(stored?.computed.totalGrams).toBeCloseTo(
        250 + 125.5 + 80 + 150 + 1.5 * 15 * 0.92 + 60,
        9,
      );
      expect(stored?.computed.effectiveGrams).toBe(1100);
    });

    it("should store the cache core computes even when a caller slips another one into the input", async () => {
      const staleCache = computeRecipe({
        servings: 1,
        yieldGrams: null,
        ingredients: sixIngredients().slice(0, 1),
      });

      const created = await createRecipe(
        userA.client,
        Object.assign(stewSave(), { computed: staleCache }),
      );

      const stored = await getRecipe(userA.client, created.id);
      expect(stored?.computed).not.toEqual(staleCache);
      expect(stored?.computed).toEqual(
        computeRecipe({ servings: 4, yieldGrams: 1100, ingredients: stored?.ingredients ?? [] }),
      );
    });

    it("should use the total weight as the effective weight when there is no yield", async () => {
      const created = await createRecipe(userA.client, stewSave({ yieldGrams: null }));

      expect(created.computed.effectiveGrams).toBe(created.computed.totalGrams);
      expect(created.computed).toEqual(
        computeRecipe({ servings: 4, yieldGrams: null, ingredients: created.ingredients }),
      );
    });

    it("should leave no recipe behind when one ingredient is bad", async () => {
      const before = await recipesOf(userA);

      const failure = createRecipe(
        userA.client,
        stewSave({
          name: nameOf("Never stored"),
          ingredients: [...sixIngredients(), ingredientOfUnknownFood()],
        }),
      );

      await expect(failure).rejects.toThrow(/^Could not save the recipe \(\w+\)$/);
      expect(await recipesOf(userA)).toEqual(before);
    });

    it("should refuse an ingredient made from another user's private food, and store nothing", async () => {
      const before = await recipesOf(userA);

      const failure = createRecipe(
        userA.client,
        stewSave({
          name: nameOf("Built on a food that is not mine"),
          ingredients: [buildRecipeIngredient(foodOfB.food, { quantity: 100, unit: "g" })],
        }),
      );

      await expect(failure).rejects.toThrow(/^Could not save the recipe \(\w+\)$/);
      expect(await recipesOf(userA)).toEqual(before);
    });
  });

  describe("editing a recipe", () => {
    it("should update the cache to match when an ingredient quantity changes", async () => {
      const created = await createRecipe(userA.client, stewSave());
      const changed = sixIngredients();
      changed[0] = buildRecipeIngredient(lentils.food, { quantity: 400, unit: "g" });

      const updated = await updateRecipe(userA.client, {
        ...stewSave({ ingredients: changed }),
        id: created.id,
      });

      expect(updated.id).toBe(created.id);
      expect(updated.ingredients[0]).toMatchObject({ quantity: 400, resolved_grams: 400 });
      expect(updated.computed.totalGrams).toBe(created.computed.totalGrams + 150);
      expect(updated.computed.total.kcal).not.toBe(created.computed.total.kcal);
      const stored = await getRecipe(userA.client, created.id);
      expect(stored?.computed).toEqual(
        computeRecipe({ servings: 4, yieldGrams: 1100, ingredients: stored?.ingredients ?? [] }),
      );
    });

    it("should replace the ingredients rather than add to them", async () => {
      const created = await createRecipe(userA.client, stewSave());

      const updated = await updateRecipe(userA.client, {
        ...stewSave({ ingredients: sixIngredients().slice(0, 2) }),
        id: created.id,
      });

      expect(updated.ingredients.map(({ position }) => position)).toEqual([0, 1]);
      expect(updated.computed.totalGrams).toBe(250 + 125.5);
    });

    it("should store reordered steps in the new order", async () => {
      const created = await createRecipe(userA.client, stewSave());

      const updated = await updateRecipe(userA.client, {
        ...stewSave({ steps: moveStep(created.instructions, 3, 0) }),
        id: created.id,
      });

      expect(updated.instructions).toEqual([
        "Serve.",
        "Fry the onion.",
        "Add the lentils.",
        "Simmer for an hour.",
      ]);
    });

    it("should remove a step that is removed", async () => {
      const created = await createRecipe(userA.client, stewSave());

      const updated = await updateRecipe(userA.client, {
        ...stewSave({ steps: removeStep(created.instructions, 1) }),
        id: created.id,
      });

      expect(updated.instructions).toEqual(["Fry the onion.", "Simmer for an hour.", "Serve."]);
    });

    it("should leave the name, servings, steps, ingredients and cache exactly as they were when one ingredient is bad", async () => {
      const created = await createRecipe(userA.client, stewSave());
      const before = await getRecipe(userA.client, created.id);

      const failure = updateRecipe(userA.client, {
        ...stewSave({
          name: nameOf("Changed before the failure"),
          servings: 9,
          yieldGrams: null,
          steps: ["A different step."],
          ingredients: [...sixIngredients().slice(0, 2), ingredientOfUnknownFood()],
        }),
        id: created.id,
      });

      await expect(failure).rejects.toThrow(/^Could not save the recipe \(\w+\)$/);
      expect(await getRecipe(userA.client, created.id)).toEqual(before);
    });
  });

  describe("archiving and restoring", () => {
    it("should hide an archived recipe from the default library and bring it back on restore", async () => {
      const created = await createRecipe(userA.client, stewSave({ name: nameOf("To archive") }));
      const ingredientsBefore = (await getRecipe(userA.client, created.id))?.ingredients;

      const archived = await setRecipeArchived(userA.client, created.id, true);

      expect(archived).toMatchObject({ id: created.id, is_archived: true });
      const live = await listRecipes(userA.client);
      expect(live.map(({ id }) => id)).not.toContain(created.id);
      const everything = await listRecipes(userA.client, { archived: true });
      expect(everything.find(({ id }) => id === created.id)?.is_archived).toBe(true);
      expect((await getRecipe(userA.client, created.id))?.ingredients).toEqual(ingredientsBefore);

      const restored = await setRecipeArchived(userA.client, created.id, false);

      expect(restored).toMatchObject({ id: created.id, is_archived: false });
      expect((await listRecipes(userA.client)).map(({ id }) => id)).toContain(created.id);
      expect((await getRecipe(userA.client, created.id))?.ingredients).toEqual(ingredientsBefore);
    });

    it("should not change the archived flag when a recipe is saved", async () => {
      const created = await createRecipe(
        userA.client,
        stewSave({ name: nameOf("Archived, then saved") }),
      );
      await setRecipeArchived(userA.client, created.id, true);

      const updated = await updateRecipe(userA.client, {
        ...stewSave({ name: nameOf("Archived, then saved") }),
        id: created.id,
      });

      expect(updated.is_archived).toBe(true);
    });
  });

  describe("duplicating", () => {
    it("should save a copy under the chosen name with the same snapshots, steps and cache", async () => {
      const original = await createRecipe(userA.client, stewSave());
      const originalBefore = await getRecipe(userA.client, original.id);

      const copy = await duplicateRecipe(userA.client, {
        recipeId: original.id,
        name: nameOf("Lentil stew, again"),
      });

      expect(copy.id).not.toBe(original.id);
      expect(copy.name).toBe(nameOf("Lentil stew, again"));
      expect(copy.is_archived).toBe(false);
      expect(copy.servings).toBe(original.servings);
      expect(copy.yield_grams).toBe(original.yield_grams);
      expect(copy.instructions).toEqual(original.instructions);
      expect(copy.ingredients).toEqual(original.ingredients);
      expect(copy.ingredients.map(({ snapshot }) => snapshot)).toEqual(
        original.ingredients.map(({ snapshot }) => snapshot),
      );
      expect(copy.computed).toEqual(original.computed);
      expect(await getRecipe(userA.client, original.id)).toEqual(originalBefore);
    });

    it("should start a copy of an archived recipe live", async () => {
      const original = await createRecipe(
        userA.client,
        stewSave({ name: nameOf("Archived original") }),
      );
      await setRecipeArchived(userA.client, original.id, true);

      const copy = await duplicateRecipe(userA.client, {
        recipeId: original.id,
        name: nameOf("Copy of the archived one"),
      });

      expect(copy.is_archived).toBe(false);
      expect((await getRecipe(userA.client, original.id))?.is_archived).toBe(true);
    });
  });

  describe("another user", () => {
    it("should be refused when updating, archiving or duplicating, with a code and no data", async () => {
      const created = await createRecipe(userA.client, stewSave({ name: nameOf("Private to A") }));
      const before = await getRecipe(userA.client, created.id);

      await expect(
        updateRecipe(userB.client, {
          ...stewSave({ name: nameOf("Taken over by B"), ingredients: [] }),
          id: created.id,
        }),
      ).rejects.toThrow(new Error("Could not save the recipe (P0002)"));
      await expect(setRecipeArchived(userB.client, created.id, true)).rejects.toThrow(
        new Error("Could not archive the recipe (PGRST116)"),
      );
      await expect(
        duplicateRecipe(userB.client, { recipeId: created.id, name: nameOf("Copy by B") }),
      ).rejects.toThrow(new Error("Could not duplicate the recipe (P0002)"));
      expect(await getRecipe(userA.client, created.id)).toEqual(before);
      expect(await recipesOf(userB)).toEqual([]);
    });

    it("should not see the recipe at all", async () => {
      const created = await createRecipe(
        userA.client,
        stewSave({ name: nameOf("Invisible to B") }),
      );

      expect(await getRecipe(userB.client, created.id)).toBeNull();
    });
  });

  describe("a custom food that is edited after it was added", () => {
    it("should not change the stored ingredient or the cache of the recipe", async () => {
      const dough = await createFood(
        userA.client,
        userA.id,
        customFoodInput("dough", {
          kcal: 250,
          portions: [{ label: "1 ball", grams: 100, isDefault: true }],
        }),
      );
      const created = await createRecipe(
        userA.client,
        stewSave({
          name: nameOf("Frozen with its food"),
          ingredients: [
            buildRecipeIngredient(dough.food, { quantity: 200, unit: "g" }),
            buildRecipeIngredient(dough.food, {
              quantity: 2,
              unit: "portion",
              portion: onlyPortionOf(dough),
            }),
          ],
        }),
      );
      const before = await getRecipe(userA.client, created.id);

      await updateFood(
        userA.client,
        dough.food.id,
        customFoodInput("dough-renamed", {
          kcal: 900,
          portions: [{ label: "1 ball", grams: 500, isDefault: true }],
        }),
      );

      const after = await getRecipe(userA.client, created.id);
      expect(after?.computed).toEqual(before?.computed);
      // Editing a food replaces its portions with new ids, so the portion link is cleared by the
      // database. The snapshot, the amounts and the grams are what the freeze is about.
      expect(
        after?.ingredients.map(({ snapshot, quantity, unit, resolved_grams }) => ({
          snapshot,
          quantity,
          unit,
          resolved_grams,
        })),
      ).toEqual(
        before?.ingredients.map(({ snapshot, quantity, unit, resolved_grams }) => ({
          snapshot,
          quantity,
          unit,
          resolved_grams,
        })),
      );
    });
  });
});
