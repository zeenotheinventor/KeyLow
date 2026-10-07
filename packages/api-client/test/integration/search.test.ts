import { customFoodInputSchema } from "@keylow/core/schemas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { adminClient } from "./support/stack";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { createFood, searchFoods } from "../../src/repos/foods";

import type { TestUser } from "./support/users";
import type { Food } from "@keylow/core/schemas";

// One word nothing else in the database contains, so only the foods of this file can match it.
const nameToken = `k47${crypto.randomUUID().replaceAll("-", "")}`;

const customFood = () =>
  customFoodInputSchema.parse({
    name: `${nameToken} flapjack`,
    basis: "per_100g",
    kcal: 410,
    protein_g: 22,
    fat_g: 14,
    carbs_g: 45,
    portions: [],
  });

describe("searchFoods against the local stack with real user JWTs", () => {
  let userA: TestUser;
  let userB: TestUser;
  let foodOfA: Food;
  let foodOfB: Food;

  beforeAll(async () => {
    [userA, userB] = await Promise.all([createTestUser("search"), createTestUser("search")]);
    [{ food: foodOfA }, { food: foodOfB }] = await Promise.all([
      createFood(userA.client, userA.id, customFood()),
      createFood(userB.client, userB.id, customFood()),
    ]);
  });

  afterAll(async () => {
    // The users that exist are the ones the helper created, even if beforeAll failed part way.
    const owners = await deleteCreatedTestUsers();

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

  it("should return user A's own food first and never user B's", async () => {
    const hits = await searchFoods(userA.client, nameToken);

    expect(hits[0]).toMatchObject({ id: foodOfA.id, owner_id: userA.id });
    expect(hits.map((hit) => hit.id)).not.toContain(foodOfB.id);
    expect(hits.every((hit) => hit.owner_id !== userB.id)).toBe(true);
  });

  it("should return user B's own food first and never user A's", async () => {
    const hits = await searchFoods(userB.client, nameToken);

    expect(hits[0]).toMatchObject({ id: foodOfB.id, owner_id: userB.id });
    expect(hits.map((hit) => hit.id)).not.toContain(foodOfA.id);
    expect(hits.every((hit) => hit.owner_id !== userA.id)).toBe(true);
  });

  it("should match a half typed word and give the hit a positive score", async () => {
    const hits = await searchFoods(userA.client, nameToken.slice(0, -4));

    expect(hits[0]).toMatchObject({ id: foodOfA.id });
    expect(hits[0]?.score).toBeGreaterThan(0);
  });

  it("should return nothing for a query of one character", async () => {
    expect(await searchFoods(userA.client, "k")).toEqual([]);
  });
});
