import { customFoodInputSchema } from "@keylow/core/schemas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { adminClient } from "./support/stack";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import {
  createFood,
  getFood,
  listFoodPortions,
  replaceFoodPortions,
  updateFood,
} from "../../src/repos/foods";

import type { TestUser } from "./support/users";
import type { Food, FoodPortion } from "@keylow/core/schemas";

const customFood = (overrides: Record<string, unknown> = {}) =>
  customFoodInputSchema.parse({
    name: "Protein flapjack",
    brand: "Home made",
    // Spaces and hyphens on purpose: the schema must store the canonical 13 digit form.
    barcode: "0 36000-29145 2",
    basis: "per_100g",
    density_g_per_ml: 1.1,
    kcal: 410,
    protein_g: 22,
    fat_g: 14,
    carbs_g: 45,
    fibre_g: 6,
    portions: [
      { label: "1 bar", grams: 60, isDefault: true },
      { label: "1 cup", ml: 250, isDefault: false },
    ],
    ...overrides,
  });

describe("custom foods against the local stack with real user JWTs", () => {
  let userA: TestUser;
  let userB: TestUser;
  let foodOfA: Food;
  let portionsOfA: FoodPortion[];

  beforeAll(async () => {
    [userA, userB] = await Promise.all([createTestUser("foods"), createTestUser("foods")]);
    ({ food: foodOfA, portions: portionsOfA } = await createFood(
      userA.client,
      userA.id,
      customFood(),
    ));
  });

  afterAll(async () => {
    // The users that exist are the ones the helper created, even if beforeAll failed part way.
    const owners = await deleteCreatedTestUsers();

    if (owners.length === 0) {
      return;
    }

    const admin = adminClient();

    const foods = await admin
      .from("foods")
      .select("id", { count: "exact", head: true })
      .in("owner_id", owners);
    const portions = await admin
      .from("food_portions")
      .select("id", { count: "exact", head: true })
      .in("owner_id", owners);
    const lookups = await Promise.all(owners.map((id) => admin.auth.admin.getUserById(id)));

    expect(foods.error).toBeNull();
    expect(foods.count).toBe(0);
    expect(portions.error).toBeNull();
    expect(portions.count).toBe(0);
    expect(lookups.map(({ data }) => data.user)).toEqual(owners.map(() => null));
  });

  describe("user A", () => {
    it("should read back the food it created as a user food with the canonical barcode", async () => {
      const food = await getFood(userA.client, foodOfA.id);

      expect(food).toMatchObject({
        id: foodOfA.id,
        source: "user",
        owner_id: userA.id,
        name: "Protein flapjack",
        brand: "Home made",
        barcode: "0036000291452",
        basis: "per_100g",
        density_g_per_ml: 1.1,
        kcal: 410,
        protein_g: 22,
        fat_g: 14,
        carbs_g: 45,
        fibre_g: 6,
        micros: {},
        quality: {},
        source_ref: null,
        fetched_at: null,
        deleted_at: null,
      });
    });

    it("should return the portions the database stored when it created the food", () => {
      expect(portionsOfA.map((portion) => portion.label)).toEqual(["1 bar", "1 cup"]);
    });

    it("should read back the two portions in order", async () => {
      const portions = await listFoodPortions(userA.client, foodOfA.id);

      expect(portions).toMatchObject([
        { label: "1 bar", grams: 60, ml: null, is_default: true, position: 0, owner_id: userA.id },
        {
          label: "1 cup",
          grams: null,
          ml: 250,
          is_default: false,
          position: 1,
          owner_id: userA.id,
        },
      ]);
    });

    it("should not be able to create a food owned by someone else", async () => {
      const failure = await createFood(userA.client, userB.id, customFood()).catch(
        (error: unknown) => error,
      );

      expect(failure).toHaveProperty("cause.code", "42501");
    });
  });

  describe("user B", () => {
    it("should not see user A's food", async () => {
      expect(await getFood(userB.client, foodOfA.id)).toBeNull();
    });

    it("should not see user A's portions", async () => {
      expect(await listFoodPortions(userB.client, foodOfA.id)).toEqual([]);
    });

    it("should not be able to update user A's food, which stays unchanged", async () => {
      const failure = await updateFood(
        userB.client,
        foodOfA.id,
        customFood({ name: "Hijacked", kcal: 1 }),
      ).catch((error: unknown) => error);

      expect(failure).toHaveProperty("message", expect.stringContaining(foodOfA.id));
      expect(await getFood(userA.client, foodOfA.id)).toMatchObject({
        name: "Protein flapjack",
        kcal: 410,
      });
      expect(await listFoodPortions(userA.client, foodOfA.id)).toHaveLength(2);
    });

    it("should not be able to add a portion to user A's food", async () => {
      const asItself = await userB.client
        .from("food_portions")
        .insert({ food_id: foodOfA.id, owner_id: userB.id, label: "Sneaky", grams: 1 });
      const asTheOwner = await userB.client
        .from("food_portions")
        .insert({ food_id: foodOfA.id, owner_id: userA.id, label: "Sneakier", grams: 1 });

      expect(asItself.error).toMatchObject({ code: "42501" });
      expect(asTheOwner.error).toMatchObject({ code: "42501" });
    });

    it("should not be able to replace user A's portions, which stay unchanged", async () => {
      const failure = await replaceFoodPortions(userB.client, foodOfA.id, userB.id, [
        { label: "Sneaky", grams: 1, isDefault: false },
      ]).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(Error);
      const portions = await listFoodPortions(userA.client, foodOfA.id);
      expect(portions.map((portion) => portion.label)).toEqual(["1 bar", "1 cup"]);
    });
  });

  describe("user A editing", () => {
    it("should replace the portions and update the food", async () => {
      const updated = await updateFood(
        userA.client,
        foodOfA.id,
        customFood({
          name: "Protein flapjack, large",
          portions: [
            { label: "1 small bar", grams: 40, isDefault: false },
            { label: "1 large bar", grams: 80, isDefault: true },
            { label: "1 slice", grams: 20, isDefault: false },
          ],
        }),
      );

      expect(updated.name).toBe("Protein flapjack, large");
      const portions = await listFoodPortions(userA.client, foodOfA.id);
      expect(portions.map((portion) => portion.label)).toEqual([
        "1 small bar",
        "1 large bar",
        "1 slice",
      ]);
      expect(
        portions.filter((portion) => portion.is_default).map((portion) => portion.label),
      ).toEqual(["1 large bar"]);
    });

    it("should clear optional values the edit leaves out", async () => {
      const updated = await updateFood(
        userA.client,
        foodOfA.id,
        customFoodInputSchema.parse({
          name: "Protein flapjack, plain",
          basis: "per_100g",
          kcal: 410,
          protein_g: 22,
          fat_g: 14,
          carbs_g: 45,
          portions: [],
        }),
      );

      expect(updated).toMatchObject({
        brand: null,
        barcode: null,
        density_g_per_ml: null,
        fibre_g: null,
      });
      expect(await listFoodPortions(userA.client, foodOfA.id)).toEqual([]);
    });
  });
});
