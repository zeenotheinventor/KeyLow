import { customFoodInputSchema } from "@keylow/core/schemas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { adminClient } from "./support/stack";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { createFood, listOwnFoods } from "../../src/repos/foods";

import type { TestUser } from "./support/users";
import type { Food } from "@keylow/core/schemas";

const RUN_ID = crypto.randomUUID();

// The leading 0 sorts these rows ahead of every seeded food, so a filter that went missing would
// show its rows inside the page of foods a list returns instead of hiding them behind the cut.
const NAME_PREFIX = "0-key85";

const customFood = (name: string) =>
  customFoodInputSchema.parse({
    name: `${NAME_PREFIX}-${name}-${RUN_ID}`,
    basis: "per_100g",
    kcal: 300,
    protein_g: 10,
    fat_g: 10,
    carbs_g: 40,
    portions: [],
  });

describe("listing the user's own foods against the local stack with real user JWTs", () => {
  let userA: TestUser;
  let userB: TestUser;
  let userWithNoFoods: TestUser;
  let bananaBreadOfA: Food;
  let oatCakesOfA: Food;
  let deletedFoodOfA: Food;
  let foodOfB: Food;
  const sharedFoodIds: string[] = [];

  beforeAll(async () => {
    [userA, userB, userWithNoFoods] = await Promise.all([
      createTestUser("key85-own"),
      createTestUser("key85-own"),
      createTestUser("key85-own"),
    ]);

    // Created out of alphabetical order, so the ordering by name is the database's doing.
    ({ food: oatCakesOfA } = await createFood(userA.client, userA.id, customFood("oat-cakes")));
    ({ food: deletedFoodOfA } = await createFood(userA.client, userA.id, customFood("deleted")));
    ({ food: bananaBreadOfA } = await createFood(
      userA.client,
      userA.id,
      customFood("banana-bread"),
    ));
    ({ food: foodOfB } = await createFood(userB.client, userB.id, customFood("of-user-b")));

    const softDelete = await userA.client
      .from("foods")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", deletedFoodOfA.id);
    expect(softDelete.error).toBeNull();

    // One shared Open Food Facts row and one shared CoFID row, which every user can see.
    const admin = adminClient();
    const shared = await admin
      .from("foods")
      .insert([
        {
          source: "off",
          source_ref: `key85-off-${RUN_ID}`,
          name: `${NAME_PREFIX}-shared-off-${RUN_ID}`,
          basis: "per_100g",
          kcal: 100,
          protein_g: 1,
          fat_g: 1,
          carbs_g: 1,
          fetched_at: new Date().toISOString(),
        },
        {
          source: "cofid",
          source_ref: `key85-cofid-${RUN_ID}`,
          name: `${NAME_PREFIX}-shared-cofid-${RUN_ID}`,
          basis: "per_100g",
          kcal: 100,
          protein_g: 1,
          fat_g: 1,
          carbs_g: 1,
        },
      ])
      .select("id");
    expect(shared.error).toBeNull();
    sharedFoodIds.push(...(shared.data ?? []).map((food) => food.id));
    expect(sharedFoodIds).toHaveLength(2);
  });

  afterAll(async () => {
    const admin = adminClient();
    const removedShared = await admin.from("foods").delete().in("id", sharedFoodIds);
    // The users that exist are the ones the helper created, even if beforeAll failed part way.
    const owners = await deleteCreatedTestUsers();

    expect(removedShared.error).toBeNull();

    const leftoverShared = await admin
      .from("foods")
      .select("id", { count: "exact", head: true })
      .in("id", sharedFoodIds);
    const leftoverOwned = await admin
      .from("foods")
      .select("id", { count: "exact", head: true })
      .in("owner_id", owners);

    expect(leftoverShared.count).toBe(0);
    expect(leftoverOwned.count).toBe(0);
  });

  it("should list user A's own live foods by name and nothing else", async () => {
    const foods = await listOwnFoods(userA.client);

    expect(foods.map((food) => food.id)).toEqual([bananaBreadOfA.id, oatCakesOfA.id]);
    expect(foods.every((food) => food.owner_id === userA.id && food.source === "user")).toBe(true);
  });

  it("should not list user B's food for user A, nor user A's foods for user B", async () => {
    const foodsOfA = await listOwnFoods(userA.client);
    const foodsOfB = await listOwnFoods(userB.client);

    expect(foodsOfA.map((food) => food.id)).not.toContain(foodOfB.id);
    expect(foodsOfB.map((food) => food.id)).toEqual([foodOfB.id]);
  });

  it("should leave out the shared foods that user A can see", async () => {
    const visible = await userA.client.from("foods").select("id").in("id", sharedFoodIds);
    expect(visible.error).toBeNull();
    expect(visible.data).toHaveLength(2);

    const foods = await listOwnFoods(userA.client);

    expect(foods.map((food) => food.id)).not.toEqual(expect.arrayContaining(sharedFoodIds));
    expect(foods.filter((food) => sharedFoodIds.includes(food.id))).toEqual([]);
  });

  it("should leave out a soft-deleted food", async () => {
    const foods = await listOwnFoods(userA.client);

    expect(foods.map((food) => food.id)).not.toContain(deletedFoodOfA.id);
  });

  it("should honour the limit", async () => {
    const foods = await listOwnFoods(userA.client, { limit: 1 });

    expect(foods.map((food) => food.id)).toEqual([bananaBreadOfA.id]);
  });

  it("should resolve to an empty list for a user with no foods", async () => {
    expect(await listOwnFoods(userWithNoFoods.client)).toEqual([]);
  });
});
