import { buildLogEntry } from "@keylow/core/diary";
import { customFoodInputSchema } from "@keylow/core/schemas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { createFood } from "../../src/repos/foods";
import {
  addPalatePreference,
  getPalateLoggedDays,
  listPalatePreferences,
  listPalateStats,
  removePalatePreference,
  setNotUsual,
} from "../../src/repos/palatePreferences";
import { errorThrownBy } from "../support/quotedDatabaseError";

import type { TestUser } from "./support/users";

// Each user is made for this file and every assert reads only that user's rows. The shared database
// is never reseeded and no whole-table count is taken.

const RUN_ID = crypto.randomUUID();

const customFood = (label: string) =>
  customFoodInputSchema.parse({
    name: `key1023-${label}-${RUN_ID}`,
    basis: "per_100g",
    kcal: 250,
    protein_g: 10,
    fat_g: 8,
    carbs_g: 30,
    portions: [{ label: "1 portion", grams: 40, isDefault: true }],
  });

const today = new Date().toISOString().slice(0, 10);

describe("the palate repo against the local stack with real user JWTs", () => {
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => {
    [userA, userB] = await Promise.all([createTestUser("key1023"), createTestUser("key1023")]);
  });

  afterAll(async () => {
    await deleteCreatedTestUsers();
  });

  it("should add a dislike, list it and remove it again", async () => {
    const added = await addPalatePreference(userA.client, {
      kind: "dislike",
      label: "  key1023 word ",
    });

    expect(added).toMatchObject({
      kind: "dislike",
      label: "key1023 word",
      foodId: null,
      recipeId: null,
    });
    expect((await listPalatePreferences(userA.client)).map((row) => row.id)).toContain(added.id);

    await removePalatePreference(userA.client, added.id);

    expect((await listPalatePreferences(userA.client)).map((row) => row.id)).not.toContain(
      added.id,
    );
  });

  it("should store a correction once, however many times it is set", async () => {
    const { food } = await createFood(userA.client, userA.id, customFood("not-usual"));

    await setNotUsual(userA.client, { foodId: food.id });
    await setNotUsual(userA.client, { foodId: food.id });

    const corrections = (await listPalatePreferences(userA.client)).filter(
      (row) => row.foodId === food.id,
    );
    expect(corrections).toHaveLength(1);
    expect(corrections[0]?.kind).toBe("not_usual");
  });

  it("should refuse a food that belongs to another user, with the code only", async () => {
    const { food } = await createFood(userB.client, userB.id, customFood("b-private"));

    const failure = await errorThrownBy(() => setNotUsual(userA.client, { foodId: food.id }));

    expect(failure.message).toBe("Could not mark this as not usual (42501)");
  });

  it("should show each user only their own rows", async () => {
    await addPalatePreference(userA.client, { kind: "allergy", label: "key1023 a only" });
    await addPalatePreference(userB.client, { kind: "allergy", label: "key1023 b only" });

    const labelsOfA = (await listPalatePreferences(userA.client)).map((row) => row.label);
    const labelsOfB = (await listPalatePreferences(userB.client)).map((row) => row.label);

    expect(labelsOfA).toContain("key1023 a only");
    expect(labelsOfA).not.toContain("key1023 b only");
    expect(labelsOfB).toContain("key1023 b only");
    expect(labelsOfB).not.toContain("key1023 a only");
  });

  it("should count the diary into the stats of its owner only", async () => {
    const { food } = await createFood(userA.client, userA.id, customFood("stats"));
    const entries = [100, 200, 300].map((grams) =>
      buildLogEntry({
        food,
        quantity: grams,
        unit: "g",
        localDate: today,
        loggedAt: new Date().toISOString(),
      }),
    );
    const { error } = await userA.client.from("food_log_entries").insert(entries);
    expect(error).toBeNull();

    const statsOfA = await listPalateStats(userA.client);
    const statsOfB = await listPalateStats(userB.client);

    expect(statsOfA.find((row) => row.foodId === food.id)).toMatchObject({
      recipeId: null,
      entryCount: 3,
      medianResolvedGrams: 200,
    });
    expect(statsOfB.find((row) => row.foodId === food.id)).toBeUndefined();
    await expect(getPalateLoggedDays(userA.client)).resolves.toBe(1);
    await expect(getPalateLoggedDays(userB.client)).resolves.toBe(0);
  });
});
