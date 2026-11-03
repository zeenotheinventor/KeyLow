import { MAX_FAVOURITES } from "@keylow/core/foods";
import { buildRecipeIngredient } from "@keylow/core/recipes";
import { customFoodInputSchema } from "@keylow/core/schemas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { FavouriteRuleError } from "../../src/errors";
import {
  addFavouriteFood,
  addFavouriteRecipe,
  listFavouriteRecipes,
  removeFavouriteRecipe,
} from "../../src/repos/favourites";
import { createFood } from "../../src/repos/foods";
import { createRecipe, setRecipeArchived } from "../../src/repos/recipeWrites";

import type { TestUser } from "./support/users";
import type { Food } from "@keylow/core/schemas";

// A word nothing else contains, so the test asserts on its own recipes only. The shared database is
// never reseeded and no whole-table count is taken.
const nameToken = `key797${crypto.randomUUID().replaceAll("-", "")}`;

const ownFavourites = async (user: TestUser) =>
  (await listFavouriteRecipes(user.client)).filter((favourite) =>
    favourite.recipe.name.startsWith(nameToken),
  );

const favouriteIds = async (user: TestUser) =>
  (await ownFavourites(user)).map((favourite) => favourite.recipeId);

describe("favourite recipes against the local stack with real user JWTs", () => {
  let userA: TestUser;
  let userB: TestUser;
  let recipeA: string;
  let recipeB: string;

  const makeFood = async (user: TestUser, name: string): Promise<Food> =>
    (
      await createFood(
        user.client,
        user.id,
        customFoodInputSchema.parse({
          name: `${nameToken} ${name}`,
          basis: "per_100g",
          kcal: 300,
          protein_g: 10,
          fat_g: 10,
          carbs_g: 40,
          portions: [],
        }),
      )
    ).food;

  const makeRecipe = async (user: TestUser, name: string, food: Food): Promise<string> =>
    (
      await createRecipe(user.client, {
        name: `${nameToken} ${name}`,
        servings: 2,
        yieldGrams: null,
        ingredients: [buildRecipeIngredient(food, { quantity: 100, unit: "g" })],
        steps: [],
      })
    ).id;

  beforeAll(async () => {
    [userA, userB] = await Promise.all([createTestUser("key797"), createTestUser("key797")]);
    recipeA = await makeRecipe(userA, "a-recipe", await makeFood(userA, "a-food"));
    recipeB = await makeRecipe(userB, "b-recipe", await makeFood(userB, "b-food"));
  });

  afterAll(async () => {
    await deleteCreatedTestUsers();
  });

  it("should leave one favourite when a recipe is favourited twice, with no error", async () => {
    await addFavouriteRecipe(userA.client, recipeA);
    await addFavouriteRecipe(userA.client, recipeA);

    const favourites = await ownFavourites(userA);

    expect(favourites.map((favourite) => favourite.recipeId)).toEqual([recipeA]);
    expect(favourites[0]?.recipe.name).toBe(`${nameToken} a-recipe`);
  });

  it("should not let user A favourite user B's recipe", async () => {
    await expect(addFavouriteRecipe(userA.client, recipeB)).rejects.toHaveProperty("cause", {
      code: "42501",
    });

    expect(await favouriteIds(userA)).not.toContain(recipeB);
  });

  it("should not show user B's favourites to user A, nor let A remove them", async () => {
    await addFavouriteRecipe(userB.client, recipeB);

    expect(await favouriteIds(userA)).not.toContain(recipeB);

    await removeFavouriteRecipe(userA.client, recipeB);

    expect(await favouriteIds(userB)).toContain(recipeB);
  });

  it("should remove a favourite, and removing it again is not an error", async () => {
    await removeFavouriteRecipe(userB.client, recipeB);
    await removeFavouriteRecipe(userB.client, recipeB);

    expect(await ownFavourites(userB)).toEqual([]);
  });

  it("should drop an archived recipe from the list, bring it back when restored, and refuse to favourite it while archived", async () => {
    const food = await makeFood(userA, "archive-food");
    const recipe = await makeRecipe(userA, "archived-then-restored", food);
    await addFavouriteRecipe(userA.client, recipe);

    await setRecipeArchived(userA.client, recipe, true);
    expect(await favouriteIds(userA)).not.toContain(recipe);
    await expect(addFavouriteRecipe(userA.client, recipe)).rejects.toHaveProperty("cause", {
      code: "42501",
    });

    await setRecipeArchived(userA.client, recipe, false);
    expect(await favouriteIds(userA)).toContain(recipe);
  });

  it("should list the newest favourite first", async () => {
    const user = await createTestUser("key797");
    const food = await makeFood(user, "order-food");
    const older = await makeRecipe(user, "older", food);
    const newer = await makeRecipe(user, "newer", food);
    await addFavouriteRecipe(user.client, older);
    await addFavouriteRecipe(user.client, newer);

    expect(await favouriteIds(user)).toEqual([newer, older]);
  });

  it("should share the cap between foods and recipes", async () => {
    const user = await createTestUser("key797");
    const foods = await Promise.all(
      Array.from({ length: MAX_FAVOURITES / 2 + 1 }, (_, index) => makeFood(user, `cap-${index}`)),
    );
    const [extraFood, ...heldFoods] = foods;
    if (extraFood === undefined) {
      throw new Error("The fixture foods were not created");
    }
    const recipes = await Promise.all(
      Array.from({ length: MAX_FAVOURITES / 2 + 1 }, (_, index) =>
        makeRecipe(user, `cap-${index}`, extraFood),
      ),
    );
    const [extraRecipe, ...heldRecipes] = recipes;
    const [held] = heldRecipes;
    if (extraRecipe === undefined || held === undefined) {
      throw new Error("The fixture recipes were not created");
    }
    for (const food of heldFoods) {
      await addFavouriteFood(user.client, food.id);
    }
    for (const recipe of heldRecipes) {
      await addFavouriteRecipe(user.client, recipe);
    }

    const refusedRecipe = await addFavouriteRecipe(user.client, extraRecipe).catch(
      (error: unknown) => error,
    );
    const refusedFood = await addFavouriteFood(user.client, extraFood.id).catch(
      (error: unknown) => error,
    );

    expect(refusedRecipe).toBeInstanceOf(FavouriteRuleError);
    expect(refusedRecipe).toHaveProperty("rule", "favourite_limit");
    expect(refusedFood).toBeInstanceOf(FavouriteRuleError);
    expect(await ownFavourites(user)).toHaveLength(MAX_FAVOURITES / 2);

    // Favouriting one already held at the cap is still a quiet no-op.
    await addFavouriteRecipe(user.client, held);

    // Archiving a favourite recipe frees a place, for a food or a recipe alike.
    await setRecipeArchived(user.client, held, true);
    await addFavouriteFood(user.client, extraFood.id);
    expect(
      await addFavouriteRecipe(user.client, extraRecipe).catch((error: unknown) => error),
    ).toBeInstanceOf(FavouriteRuleError);
  });
});
