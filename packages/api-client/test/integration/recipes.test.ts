import { buildRecipeIngredient, computeRecipe } from "@keylow/core/recipes";
import { customFoodInputSchema } from "@keylow/core/schemas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { anonClient } from "./support/stack";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { createFood } from "../../src/repos/foods";
import { getRecipe, listRecipes, searchRecipes } from "../../src/repos/recipes";

import type { TestUser } from "./support/users";
import type { RecipeSummary } from "../../src/repos/recipes";
import type { Food } from "@keylow/core/schemas";

const RUN_ID = crypto.randomUUID();

// Every row this suite writes is named with this prefix, and every assertion looks at those rows only,
// so recipes another session left on the shared stack cannot change a result.
const NAME_PREFIX = `key288-${RUN_ID}`;

const nameOf = (name: string) => `${NAME_PREFIX}-${name}`;

const onlyThisSuite = (recipes: readonly RecipeSummary[]) =>
  recipes.filter((recipe) => recipe.name.startsWith(NAME_PREFIX));

const namesOf = (recipes: readonly RecipeSummary[]) =>
  onlyThisSuite(recipes).map((recipe) => recipe.name);

const customFood = (name: string) =>
  customFoodInputSchema.parse({
    name: `${NAME_PREFIX}-food-${name}`,
    basis: "per_100g",
    kcal: 300,
    protein_g: 10,
    fat_g: 10,
    carbs_g: 40,
    portions: [],
  });

type RecipeToWrite = {
  name: string;
  instructions?: string[];
  isArchived?: boolean;
  /** Written in this order, so the order they are listed in comes from `position` and not from this. */
  ingredientsInWriteOrder?: { food: Food; position: number }[];
};

/**
 * Writes a recipe the way the tables allow a client to: the row, the ingredients with the positions
 * given, and the archive flag as the plain update it is. Returns the recipe's id.
 */
async function writeRecipe(owner: TestUser, recipe: RecipeToWrite): Promise<string> {
  const ingredients = (recipe.ingredientsInWriteOrder ?? []).map(({ food, position }) => ({
    position,
    ...buildRecipeIngredient(food, { quantity: 100 + position, unit: "g" }),
  }));
  const computed = computeRecipe({ servings: 2, yieldGrams: null, ingredients });

  const inserted = await owner.client
    .from("recipes")
    .insert({
      owner_id: owner.id,
      name: recipe.name,
      servings: 2,
      instructions: recipe.instructions ?? [],
      computed,
    })
    .select("id")
    .single();
  expect(inserted.error).toBeNull();
  const id = inserted.data?.id ?? "";

  if (ingredients.length > 0) {
    const written = await owner.client
      .from("recipe_ingredients")
      .insert(
        ingredients.map((ingredient) => ({ ...ingredient, recipe_id: id, owner_id: owner.id })),
      );
    expect(written.error).toBeNull();
  }

  if (recipe.isArchived) {
    const archived = await owner.client.from("recipes").update({ is_archived: true }).eq("id", id);
    expect(archived.error).toBeNull();
  }

  return id;
}

describe("reading and searching recipes against the local stack with real user JWTs", () => {
  let userA: TestUser;
  let userB: TestUser;
  let foods: Food[];
  let stewId: string;
  let archivedStewId: string;
  let recipeOfBId: string;

  beforeAll(async () => {
    [userA, userB] = await Promise.all([createTestUser("key288"), createTestUser("key288")]);

    foods = [];
    for (const name of ["a", "b", "c", "d", "e", "f"]) {
      foods.push((await createFood(userA.client, userA.id, customFood(name))).food);
    }

    // Written out of alphabetical order, and with the ingredients written in the reverse of their
    // positions, so the order they come back in is the database's doing and not the write order.
    stewId = await writeRecipe(userA, {
      name: nameOf("Lentil stew"),
      instructions: ["Fry the onion.", "Add the lentils.", "Simmer for an hour.", "Serve."],
      ingredientsInWriteOrder: [...foods.entries()]
        .map(([position, food]) => ({ food, position }))
        .reverse(),
    });
    archivedStewId = await writeRecipe(userA, {
      name: nameOf("Archived lentil stew"),
      isArchived: true,
    });
    await writeRecipe(userA, { name: nameOf("Apple crumble") });
    recipeOfBId = await writeRecipe(userB, { name: nameOf("Lentil stew of B") });
  });

  afterAll(async () => {
    // Deleting the users takes their foods, recipes and ingredients with them. The service role has
    // no grant on the recipe tables, so what is left is checked from outside, in the runbook.
    await deleteCreatedTestUsers();
  });

  describe("the library", () => {
    it("should list the live recipes of the caller by name", async () => {
      const recipes = await listRecipes(userA.client);

      expect(namesOf(recipes)).toEqual([nameOf("Apple crumble"), nameOf("Lentil stew")]);
    });

    it("should never list another user's recipes", async () => {
      const recipesOfA = await listRecipes(userA.client, { archived: true });
      const recipesOfB = await listRecipes(userB.client, { archived: true });

      expect(recipesOfA.map((recipe) => recipe.id)).not.toContain(recipeOfBId);
      expect(recipesOfB.map((recipe) => recipe.id)).toEqual([recipeOfBId]);
    });

    it("should leave an archived recipe out by default and return it when asked", async () => {
      const byDefault = await listRecipes(userA.client);
      const asked = await listRecipes(userA.client, { archived: true });

      expect(byDefault.map((recipe) => recipe.id)).not.toContain(archivedStewId);
      expect(namesOf(asked)).toEqual([
        nameOf("Apple crumble"),
        nameOf("Archived lentil stew"),
        nameOf("Lentil stew"),
      ]);
      expect(asked.find((recipe) => recipe.id === archivedStewId)?.is_archived).toBe(true);
    });

    it("should carry the computed cache the recipe was saved with", async () => {
      const recipes = await listRecipes(userA.client);

      const stew = recipes.find((recipe) => recipe.id === stewId);
      expect(stew?.computed.totalGrams).toBe(100 + 101 + 102 + 103 + 104 + 105);
      expect(stew?.computed.total.kcal).toBe(3 * (100 + 101 + 102 + 103 + 104 + 105));
    });

    it("should refuse a caller with no session, naming the code only", async () => {
      await expect(listRecipes(anonClient())).rejects.toThrow(
        new Error("Could not load your recipes (42501)"),
      );
    });
  });

  describe("one recipe", () => {
    it("should list the ingredients in position order and not in the order they were written", async () => {
      const recipe = await getRecipe(userA.client, stewId);

      expect(recipe?.ingredients.map((ingredient) => ingredient.position)).toEqual([
        0, 1, 2, 3, 4, 5,
      ]);
      expect(recipe?.ingredients.map((ingredient) => ingredient.food_id)).toEqual(
        foods.map((food) => food.id),
      );
    });

    it("should return the steps in their stored order", async () => {
      const recipe = await getRecipe(userA.client, stewId);

      expect(recipe?.instructions).toEqual([
        "Fry the onion.",
        "Add the lentils.",
        "Simmer for an hour.",
        "Serve.",
      ]);
    });

    it("should return the stored amounts and snapshots of the ingredients", async () => {
      const recipe = await getRecipe(userA.client, stewId);

      const [first, , , , , last] = recipe?.ingredients ?? [];
      expect(first).toMatchObject({ quantity: 100, unit: "g", resolved_grams: 100 });
      expect(first?.snapshot.name).toBe(customFood("a").name);
      expect(last).toMatchObject({ quantity: 105, unit: "g", resolved_grams: 105 });
    });

    it("should return an archived recipe like a live one", async () => {
      const recipe = await getRecipe(userA.client, archivedStewId);

      expect(recipe).toMatchObject({ id: archivedStewId, is_archived: true });
    });

    it("should return null for another user's recipe and for an id that does not exist", async () => {
      expect(await getRecipe(userA.client, recipeOfBId)).toBeNull();
      expect(await getRecipe(userA.client, crypto.randomUUID())).toBeNull();
    });
  });

  describe("searching by name", () => {
    it("should find a recipe by a word in its name, ignoring case", async () => {
      for (const query of ["lentil", "LENTIL", "lEnTiL", "  Lentil  "]) {
        const found = await searchRecipes(userA.client, query);

        expect(namesOf(found), query).toEqual([nameOf("Lentil stew")]);
      }
    });

    it("should find a recipe by a word that is not at the start of its name", async () => {
      const found = await searchRecipes(userA.client, "stew");

      expect(namesOf(found)).toEqual([nameOf("Lentil stew")]);
    });

    it("should find nothing for a word that is not in any name", async () => {
      expect(await searchRecipes(userA.client, "quinoa")).toEqual([]);
    });

    it("should never find another user's recipe", async () => {
      const foundByA = await searchRecipes(userA.client, "of B", { archived: true });
      const foundByB = await searchRecipes(userB.client, "lentil");

      expect(foundByA.map((recipe) => recipe.id)).not.toContain(recipeOfBId);
      expect(foundByB.map((recipe) => recipe.id)).toEqual([recipeOfBId]);
    });

    it("should leave an archived recipe out by default and find it when asked", async () => {
      const byDefault = await searchRecipes(userA.client, "archived lentil");
      const asked = await searchRecipes(userA.client, "archived lentil", { archived: true });

      expect(byDefault).toEqual([]);
      expect(asked.map((recipe) => recipe.id)).toEqual([archivedStewId]);
    });

    it("should order the matches by name and honour the limit", async () => {
      const found = await searchRecipes(userA.client, "lentil", { archived: true });
      const firstOnly = await searchRecipes(userA.client, "lentil", { archived: true, limit: 1 });

      expect(namesOf(found)).toEqual([nameOf("Archived lentil stew"), nameOf("Lentil stew")]);
      expect(firstOnly.map((recipe) => recipe.name)).toEqual([nameOf("Archived lentil stew")]);
    });

    it("should answer a query shorter than 2 characters with nothing", async () => {
      expect(await searchRecipes(userA.client, " a ")).toEqual([]);
    });

    it("should refuse a caller with no session, naming the code only", async () => {
      await expect(searchRecipes(anonClient(), "lentil")).rejects.toThrow(
        new Error("Could not search your recipes (42501)"),
      );
    });
  });

  describe("a query with characters the pattern language reads", () => {
    // Each pair has one name the query means and one it would also match if the character were read
    // as a pattern. Searching for the first must find that one alone.
    it.each([
      ["a percent sign", "100% beef", "100 beef", "100% b"],
      ["an underscore", "oat_cake", "oatXcake", "oat_cake"],
      ["a backslash", "a\\b", "ab", "a\\b"],
    ])("should match %s literally", async (_label, wanted, lookalike, query) => {
      await writeRecipe(userA, { name: nameOf(wanted) });
      await writeRecipe(userA, { name: nameOf(lookalike) });

      const found = await searchRecipes(userA.client, query);

      expect(namesOf(found)).toEqual([nameOf(wanted)]);
    });

    // PostgREST reads * as % in an ilike value and cannot escape it, so the client sends _ in its place.
    // The star then finds a name that has one, but never stands for a run of characters.
    it("should match an asterisk as one character and never as a run of them", async () => {
      await writeRecipe(userA, { name: nameOf("5*3") });
      await writeRecipe(userA, { name: nameOf("5-and-3") });

      const found = await searchRecipes(userA.client, "5*3");

      expect(namesOf(found)).toContain(nameOf("5*3"));
      expect(namesOf(found)).not.toContain(nameOf("5-and-3"));
    });

    it("should match a name with commas, brackets and quotes", async () => {
      const name = nameOf('Soup, hot (spicy) "special"');
      await writeRecipe(userA, { name });

      const found = await searchRecipes(userA.client, 'soup, hot (spicy) "special"');

      expect(namesOf(found)).toEqual([name]);
    });
  });
});
