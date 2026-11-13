import { buildPalateProfile, summaryLines } from "@keylow/core";
import { buildLogEntry } from "@keylow/core/diary";
import { customFoodInputSchema } from "@keylow/core/schemas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createFood } from "../../../../api-client/src/repos/foods";
import {
  addPalatePreference,
  getPalateLoggedDays,
  listPalateFoods,
  listPalatePreferences,
  listPalateStats,
} from "../../../../api-client/src/repos/palatePreferences";
import { listRecipes } from "../../../../api-client/src/repos/recipes";
import { createTestUser, deleteCreatedTestUsers } from "../support/users";

import type { TestUser } from "../support/users";
import type { Food } from "@keylow/core/schemas";

/*
 * The reads behind `get_palate_profile` against the real tables, with two users (KEY-1029). HTTP-free, like the
 * other tools' files: each read runs with the user's own signed-in client, which is the client the `mcp`
 * function hands a tool as its caller, so row level security scopes it. It proves that a profile built from one
 * user's reads holds that user's foods and statements and none of the other's, and that a food id of one user
 * reads as nothing for the other. The tool's own tests run under Deno with a stub client and assert the shape
 * the model reads. Every name carries a run marker, so a read of another user's rows would show, and nothing
 * here resets the stack.
 */

const marker = `key1029${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;
const LOGGED_DAYS = 5;
const DAY_MILLISECONDS = 86_400_000;

const dayOffset = (daysAgo: number): string =>
  new Date(Date.now() - daysAgo * DAY_MILLISECONDS).toISOString().slice(0, 10);

async function userWithADiary(user: TestUser, label: string): Promise<Food> {
  const { food } = await createFood(
    user.client,
    user.id,
    customFoodInputSchema.parse({
      name: `${marker} ${label} oats`,
      basis: "per_100g",
      kcal: 380,
      protein_g: 13,
      fat_g: 7,
      carbs_g: 60,
      portions: [],
    }),
  );
  const entries = Array.from({ length: LOGGED_DAYS }, (_, daysAgo) =>
    buildLogEntry({
      food,
      quantity: 60,
      unit: "g",
      localDate: dayOffset(daysAgo),
      loggedAt: `${dayOffset(daysAgo)}T07:30:00.000Z`,
    }),
  );
  const { error } = await user.client.from("food_log_entries").insert(entries);
  expect(error).toBeNull();
  return food;
}

// The reads of the tool, in its order, and core's profile over them.
async function profileOf(user: TestUser) {
  const [stats, loggedDays, preferences, recipes] = await Promise.all([
    listPalateStats(user.client),
    getPalateLoggedDays(user.client),
    listPalatePreferences(user.client),
    listRecipes(user.client, { archived: true }),
  ]);
  const foodIds = stats.flatMap(({ foodId }) => (foodId === null ? [] : [foodId]));
  const foods = await listPalateFoods(user.client, foodIds);
  const profile = buildPalateProfile(stats, preferences, {
    today: dayOffset(0),
    loggedDays,
    foods,
    recipes: recipes.map(({ id, name, servings, yield_grams }) => ({
      id,
      name,
      servingGrams: yield_grams === null || servings <= 0 ? null : yield_grams / servings,
    })),
  });
  return { stats, profile };
}

describe("the reads behind get_palate_profile, with two users", () => {
  let alice: TestUser;
  let bob: TestUser;
  let aliceFood: Food;
  let bobFood: Food;

  beforeAll(async () => {
    [alice, bob] = await Promise.all([
      createTestUser("key1029-alice"),
      createTestUser("key1029-bob"),
    ]);
    [aliceFood, bobFood] = await Promise.all([
      userWithADiary(alice, "alice"),
      userWithADiary(bob, "bob"),
    ]);
    await addPalatePreference(alice.client, { kind: "dislike", label: `${marker} alice dislike` });
    await addPalatePreference(bob.client, { kind: "allergy", label: `${marker} bob allergy` });
  }, 60_000);

  afterAll(async () => {
    await deleteCreatedTestUsers();
  });

  it("gives each user a profile of their own usual foods", async () => {
    const { profile } = await profileOf(alice);

    expect(profile.hasEnoughToGoOn).toBe(true);
    expect(profile.usualFoods.map(({ name }) => name)).toEqual([aliceFood.name]);
    expect(profile.usualFoods[0]?.frequency).toBe("most days");
    expect(profile.byTimeOfDay.morning.map(({ name }) => name)).toEqual([aliceFood.name]);
  });

  it("never shows one user's foods or statements in the other's profile", async () => {
    const { profile: aliceProfile } = await profileOf(alice);
    const { profile: bobProfile } = await profileOf(bob);

    const aliceText = JSON.stringify([aliceProfile, summaryLines(aliceProfile)]);
    const bobText = JSON.stringify([bobProfile, summaryLines(bobProfile)]);
    expect(aliceText).toContain("alice");
    expect(aliceText).not.toContain("bob");
    expect(bobText).toContain("bob");
    expect(bobText).not.toContain("alice");
    expect(aliceProfile.avoid.map(({ label }) => label)).toEqual([`${marker} alice dislike`]);
    expect(bobProfile.avoid.map(({ label }) => label)).toEqual([`${marker} bob allergy`]);
  });

  it("reads another user's stats and food id as nothing", async () => {
    const { stats } = await profileOf(alice);

    expect(stats.some(({ foodId }) => foodId === bobFood.id)).toBe(false);
    await expect(listPalateFoods(alice.client, [bobFood.id])).resolves.toEqual([]);
    await expect(listPalateFoods(bob.client, [aliceFood.id])).resolves.toEqual([]);
  });
});
