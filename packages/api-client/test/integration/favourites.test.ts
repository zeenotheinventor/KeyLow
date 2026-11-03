import { customFoodInputSchema } from "@keylow/core/schemas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { FavouriteRuleError } from "../../src/errors";
import {
  addFavouriteFood,
  listFavouriteFoods,
  removeFavouriteFood,
} from "../../src/repos/favourites";
import { createFood, softDeleteFood } from "../../src/repos/foods";

import type { TestUser } from "./support/users";
import type { Food } from "@keylow/core/schemas";

// A word nothing else contains, so the test asserts on its own foods only. The shared database is
// never reseeded and no whole-table count is taken.
const nameToken = `key774${crypto.randomUUID().replaceAll("-", "")}`;

const customFood = (name: string) =>
  customFoodInputSchema.parse({
    name: `${nameToken} ${name}`,
    basis: "per_100g",
    kcal: 300,
    protein_g: 10,
    fat_g: 10,
    carbs_g: 40,
    portions: [{ label: "1 slice", grams: 40, isDefault: true }],
  });

const ownFavourites = async (user: TestUser) =>
  (await listFavouriteFoods(user.client)).filter((favourite) =>
    favourite.food.name.startsWith(nameToken),
  );

describe("favourite foods against the local stack with real user JWTs", () => {
  let userA: TestUser;
  let userB: TestUser;
  let foodA: Food;
  let foodB: Food;

  const makeFood = async (user: TestUser, name: string) =>
    (await createFood(user.client, user.id, customFood(name))).food;

  beforeAll(async () => {
    [userA, userB] = await Promise.all([createTestUser("key774"), createTestUser("key774")]);
    foodA = await makeFood(userA, "a-food");
    foodB = await makeFood(userB, "b-food");
  });

  afterAll(async () => {
    await deleteCreatedTestUsers();
  });

  it("should leave one favourite when a food is favourited twice, with no error", async () => {
    await addFavouriteFood(userA.client, foodA.id);
    await addFavouriteFood(userA.client, foodA.id);

    const favourites = await ownFavourites(userA);

    expect(favourites.map((favourite) => favourite.foodId)).toEqual([foodA.id]);
    expect(favourites[0]?.food.name).toBe(foodA.name);
  });

  it("should not let user A favourite user B's private food", async () => {
    await expect(addFavouriteFood(userA.client, foodB.id)).rejects.toHaveProperty("cause", {
      code: "42501",
    });

    expect((await ownFavourites(userA)).map((favourite) => favourite.foodId)).not.toContain(
      foodB.id,
    );
  });

  it("should not show user B's favourites to user A, nor let A remove them", async () => {
    await addFavouriteFood(userB.client, foodB.id);

    expect((await ownFavourites(userA)).map((favourite) => favourite.foodId)).not.toContain(
      foodB.id,
    );

    await removeFavouriteFood(userA.client, foodB.id);

    expect((await ownFavourites(userB)).map((favourite) => favourite.foodId)).toContain(foodB.id);
  });

  it("should remove a favourite, and removing it again is not an error", async () => {
    await removeFavouriteFood(userB.client, foodB.id);
    await removeFavouriteFood(userB.client, foodB.id);

    expect(await ownFavourites(userB)).toEqual([]);
  });

  it("should drop a soft deleted food from the list and bring it back when restored", async () => {
    const food = await makeFood(userA, "deleted-then-restored");
    await addFavouriteFood(userA.client, food.id);

    await softDeleteFood(userA.client, food.id);
    expect((await ownFavourites(userA)).map((favourite) => favourite.foodId)).not.toContain(
      food.id,
    );

    const { error } = await userA.client
      .from("foods")
      .update({ deleted_at: null })
      .eq("id", food.id);
    expect(error).toBeNull();
    expect((await ownFavourites(userA)).map((favourite) => favourite.foodId)).toContain(food.id);
  });

  it("should refuse the 31st favourite with the typed cap error, and allow it after one is removed", async () => {
    const user = await createTestUser("key774");
    const foods = await Promise.all(
      Array.from({ length: 31 }, (_, index) => makeFood(user, `cap-${index}`)),
    );
    const [thirtyFirst, ...firstThirty] = foods.reverse();
    if (thirtyFirst === undefined) {
      throw new Error("The fixture foods were not created");
    }
    for (const food of firstThirty) {
      await addFavouriteFood(user.client, food.id);
    }

    const refused = await addFavouriteFood(user.client, thirtyFirst.id).catch(
      (error: unknown) => error,
    );

    expect(refused).toBeInstanceOf(FavouriteRuleError);
    expect(refused).toHaveProperty("rule", "favourite_limit");
    expect(await ownFavourites(user)).toHaveLength(30);

    // Favouriting one already held at the cap is still a quiet no-op.
    const [held] = firstThirty;
    if (held === undefined) {
      throw new Error("The fixture foods were not created");
    }
    await addFavouriteFood(user.client, held.id);

    await removeFavouriteFood(user.client, held.id);
    await addFavouriteFood(user.client, thirtyFirst.id);
    expect(await ownFavourites(user)).toHaveLength(30);
  });

  it("should list the newest favourite first", async () => {
    const user = await createTestUser("key774");
    const older = await makeFood(user, "older");
    const newer = await makeFood(user, "newer");
    await addFavouriteFood(user.client, older.id);
    await addFavouriteFood(user.client, newer.id);

    expect((await ownFavourites(user)).map((favourite) => favourite.foodId)).toEqual([
      newer.id,
      older.id,
    ]);
  });
});
