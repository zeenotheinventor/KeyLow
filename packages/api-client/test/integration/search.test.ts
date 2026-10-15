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

// The ids of every food a user owns, read with the service role so row level security hides nothing.
async function idsOwnedBy(ownerId: string): Promise<string[]> {
  const owned = await adminClient().from("foods").select("id").eq("owner_id", ownerId);

  expect(owned.error).toBeNull();
  return (owned.data ?? []).map((food) => food.id);
}

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

    expect(hits[0]).toMatchObject({ id: foodOfA.id, source: "user" });
    const idsOfB = await idsOwnedBy(userB.id);

    expect(idsOfB).toContain(foodOfB.id);
    expect(hits.filter((hit) => idsOfB.includes(hit.id))).toEqual([]);
  });

  it("should return user B's own food first and never user A's", async () => {
    const hits = await searchFoods(userB.client, nameToken);

    expect(hits[0]).toMatchObject({ id: foodOfB.id, source: "user" });
    const idsOfA = await idsOwnedBy(userA.id);

    expect(idsOfA).toContain(foodOfA.id);
    expect(hits.filter((hit) => idsOfA.includes(hit.id))).toEqual([]);
  });

  it("should match a half typed word and give the hit a positive score", async () => {
    const hits = await searchFoods(userA.client, nameToken.slice(0, -4));

    expect(hits[0]).toMatchObject({ id: foodOfA.id });
    expect(hits[0]?.score).toBeGreaterThan(0);
  });

  it("should return a food's default portion, and nulls for a food that has none", async () => {
    const { food: foodWithPortion } = await createFood(
      userA.client,
      userA.id,
      customFoodInputSchema.parse({
        name: `${nameToken} portioned`,
        basis: "per_100g",
        kcal: 100,
        protein_g: 1,
        fat_g: 1,
        carbs_g: 1,
        portions: [{ label: "1 bar", grams: 60, isDefault: true }],
      }),
    );

    const hits = await searchFoods(userA.client, nameToken);

    expect(hits.find((hit) => hit.id === foodWithPortion.id)).toMatchObject({
      default_portion_label: "1 bar",
      default_portion_grams: 60,
      default_portion_ml: null,
    });
    expect(hits.find((hit) => hit.id === foodOfA.id)).toMatchObject({
      default_portion_id: null,
      default_portion_label: null,
      default_portion_grams: null,
      default_portion_ml: null,
    });
  });

  it("should return nothing for a query of one character", async () => {
    expect(await searchFoods(userA.client, "k")).toEqual([]);
  });
});
