import { customFoodInputSchema } from "@keylow/core/schemas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { adminClient } from "./support/stack";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import {
  createFood,
  getFood,
  listOwnFoods,
  searchFoods,
  softDeleteFood,
} from "../../src/repos/foods";

import type { TestUser } from "./support/users";
import type { Food } from "@keylow/core/schemas";

// One word nothing else in the database contains, so only the foods of this file can match it.
const nameToken = `key156${crypto.randomUUID().replaceAll("-", "")}`;

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

describe("soft deleting a custom food against the local stack with real user JWTs", () => {
  let userA: TestUser;
  let userB: TestUser;
  let deletedFood: Food;
  let keptFood: Food;
  let foodGuardedFromB: Food;
  let deleted: Food;

  beforeAll(async () => {
    [userA, userB] = await Promise.all([createTestUser("key156"), createTestUser("key156")]);
    ({ food: deletedFood } = await createFood(
      userA.client,
      userA.id,
      customFood("key156-deleted"),
    ));
    ({ food: keptFood } = await createFood(userA.client, userA.id, customFood("key156-kept")));
    ({ food: foodGuardedFromB } = await createFood(
      userA.client,
      userA.id,
      customFood("key156-guarded"),
    ));

    deleted = await softDeleteFood(userA.client, deletedFood.id);
  });

  afterAll(async () => {
    // The shared database must not keep a shared fixture row, even if a test failed part way.
    const strayShared = await adminClient()
      .from("foods")
      .select("id", { count: "exact", head: true })
      .like("source_ref", "key156-cofid-%");

    // The users that exist are the ones the helper created, even if beforeAll failed part way.
    const owners = await deleteCreatedTestUsers();

    expect(strayShared.error).toBeNull();
    expect(strayShared.count).toBe(0);

    if (owners.length === 0) {
      return;
    }

    const foods = await adminClient()
      .from("foods")
      .select("id", { count: "exact", head: true })
      .in("owner_id", owners);

    expect(foods.error).toBeNull();
    expect(foods.count).toBe(0);
  });

  it("should return the food with deleted_at set", () => {
    expect(deleted.id).toBe(deletedFood.id);
    expect(deleted.deleted_at).not.toBeNull();
  });

  it("should keep resolving the deleted food through getFood, with deleted_at set", async () => {
    const food = await getFood(userA.client, deletedFood.id);

    expect(food).toMatchObject({ id: deletedFood.id, deleted_at: deleted.deleted_at });
  });

  it("should leave the deleted food out of the owner's own foods and keep the others", async () => {
    const foods = await listOwnFoods(userA.client);

    expect(foods.map((food) => food.id)).not.toContain(deletedFood.id);
    expect(foods.map((food) => food.id)).toEqual(
      expect.arrayContaining([keptFood.id, foodGuardedFromB.id]),
    );
  });

  it("should leave the deleted food out of the search and keep the others", async () => {
    const hits = await searchFoods(userA.client, nameToken);

    expect(hits.map((hit) => hit.id)).not.toContain(deletedFood.id);
    expect(hits.map((hit) => hit.id)).toEqual(
      expect.arrayContaining([keptFood.id, foodGuardedFromB.id]),
    );
  });

  it("should keep the food's portions", async () => {
    const portions = await userA.client
      .from("food_portions")
      .select("id")
      .eq("food_id", deletedFood.id);

    expect(portions.error).toBeNull();
    expect(portions.data).toHaveLength(1);
  });

  it("should succeed again on a food that is already deleted", async () => {
    const again = await softDeleteFood(userA.client, deletedFood.id);

    expect(again.deleted_at).not.toBeNull();
  });

  it("should refuse to delete another user's food and leave it live", async () => {
    await expect(softDeleteFood(userB.client, foodGuardedFromB.id)).rejects.toThrow(
      /not found or cannot be deleted/,
    );

    const food = await getFood(userA.client, foodGuardedFromB.id);
    expect(food?.deleted_at).toBeNull();
  });

  it("should refuse to delete a shared food", async () => {
    const admin = adminClient();
    const shared = await admin
      .from("foods")
      .insert({
        source: "cofid",
        source_ref: `key156-cofid-${crypto.randomUUID()}`,
        name: `${nameToken} shared`,
        basis: "per_100g",
        kcal: 100,
        protein_g: 1,
        fat_g: 1,
        carbs_g: 1,
      })
      .select("id")
      .single();
    expect(shared.error).toBeNull();
    const sharedId = shared.data?.id ?? "";

    try {
      await expect(softDeleteFood(userA.client, sharedId)).rejects.toThrow(
        /not found or cannot be deleted/,
      );
    } finally {
      const removed = await admin.from("foods").delete().eq("id", sharedId);
      expect(removed.error).toBeNull();
    }
  });
});
