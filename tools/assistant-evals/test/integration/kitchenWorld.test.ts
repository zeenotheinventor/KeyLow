import {
  getMyTargets,
  getPalateLoggedDays,
  listPalatePreferences,
  listPalateStats,
  listRecipes,
} from "@keylow/api-client";
import { buildPalateProfile } from "@keylow/core";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { KITCHEN_DAY_KCAL, KITCHEN_TARGETS } from "../../fixtures/kitchen.ts";
import { expectedPalateProfile } from "../../fixtures/palateProfile.ts";
import { createFixtureUser } from "../../src/fixtureUser.ts";
import { createKitchenWorld } from "../../src/kitchenWorld.ts";

import type { FixtureUser } from "../../src/fixtureUser.ts";
import type { Database } from "@keylow/api-client";
import type { PalateProfile } from "@keylow/core";
import type { SupabaseClient } from "@supabase/supabase-js";

// These need the local stack with its migrations, as the other integration tests do. The user is new for the run and
// carries the ticket's prefix, and afterAll removes it, with every row of it, by the cascade. The tests go in order.
const RUN_ID = crypto.randomUUID().slice(0, 8);
const WRITING_TIMEOUT_MS = 180_000;

let user: FixtureUser;
let serviceClient: SupabaseClient<Database>;

beforeAll(async () => {
  const stack = inject("stack");
  user = await createFixtureUser(stack, { namePrefix: `key1028-${RUN_ID}` });
  serviceClient = createClient<Database>(stack.apiUrl, stack.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}, WRITING_TIMEOUT_MS);

afterAll(async () => {
  await user.remove();
});

const countEntries = async (): Promise<number> => {
  const { count, error } = await user.client
    .from("food_log_entries")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null);
  if (error) {
    throw new Error(`Could not count the entries (${error.code})`);
  }
  return count ?? 0;
};

// The profile of the rows as the palate reads them from the database, the way the assistant's tool will.
async function profileFromDatabase(): Promise<PalateProfile> {
  const [stats, preferences, loggedDays, recipes] = await Promise.all([
    listPalateStats(user.client),
    listPalatePreferences(user.client),
    getPalateLoggedDays(user.client),
    listRecipes(user.client),
  ]);
  const foodIds = stats.flatMap(({ foodId }) => (foodId === null ? [] : [foodId]));
  const { data, error } = await user.client
    .from("foods")
    .select("id,name,source,food_group")
    .in("id", foodIds);
  if (error) {
    throw new Error(`Could not read the foods (${error.code})`);
  }
  return buildPalateProfile(stats, preferences, {
    today: user.anchorDate,
    loggedDays,
    foods: data,
    recipes: recipes.map(({ id, name, servings, yield_grams }) => ({
      id,
      name,
      servingGrams: yield_grams === null ? null : yield_grams / servings,
    })),
  });
}

// What a profile says without the ids, which differ between the database and the plan.
const shapeOf = (profile: PalateProfile) => ({
  loggedDays: profile.loggedDays,
  usualFoods: profile.usualFoods.map(({ name, group, days, frequency, typicalGrams, rank }) => ({
    name,
    group,
    days,
    frequency,
    typicalGrams,
    rank,
  })),
  usualRecipes: profile.usualRecipes.map(({ name, days, typicalServings, rank }) => ({
    name,
    days,
    typicalServings,
    rank,
  })),
  byTimeOfDay: Object.fromEntries(
    Object.entries(profile.byTimeOfDay).map(([band, foods]) => [
      band,
      foods.map(({ name }) => name),
    ]),
  ),
  rarelyOrNever: profile.rarelyOrNever,
  avoid: profile.avoid.map(({ label, kind }) => ({ label, kind })),
});

describe("before a kitchen set asks for the world", () => {
  it("should hold only the plain diary: two recipes, no stated taste and no programme", async () => {
    expect(await listRecipes(user.client)).toHaveLength(2);
    expect(await listPalatePreferences(user.client)).toEqual([]);
    expect((await getMyTargets(user.client)).source).toBe("manual");
  });
});

describe("the kitchen world", () => {
  let entriesBefore = 0;

  beforeAll(async () => {
    entriesBefore = await countEntries();
    await createKitchenWorld(user, serviceClient).ensureWorld();
  }, WRITING_TIMEOUT_MS);

  it("should make a palate whose rows give the profile core works out of the plan", async () => {
    expect(shapeOf(await profileFromDatabase())).toEqual(
      shapeOf(expectedPalateProfile(user.anchorDate)),
    );
  });

  it("should add 47 days of entries and six recipes", async () => {
    expect(await countEntries()).toBeGreaterThan(entriesBefore);
    expect(await listRecipes(user.client)).toHaveLength(8);
  });

  it("should give the user an engine targets row with a figure for each weekday", async () => {
    expect(await getMyTargets(user.client)).toMatchObject({
      source: "engine",
      kcal: KITCHEN_TARGETS.kcal,
      protein_g: KITCHEN_TARGETS.protein_g,
      carbs_g: KITCHEN_TARGETS.carbs_g,
      fat_g: KITCHEN_TARGETS.fat_g,
      dowCaloriesKcal: KITCHEN_DAY_KCAL,
    });
  });

  it("should add nothing when it is asked for again by another world of the same user", async () => {
    const entries = await countEntries();

    await createKitchenWorld(user, serviceClient).ensureWorld();

    expect(await countEntries()).toBe(entries);
    expect(await listRecipes(user.client)).toHaveLength(8);
    expect(await listPalatePreferences(user.client)).toHaveLength(3);
  });
});

describe("the kitchen world's helpers for the recipe and palate sets (KEY-1037)", () => {
  const world = () => createKitchenWorld(user, serviceClient);

  it("should find the id of a recipe by its name, and reject for a name the user has not got", async () => {
    const id = await world().recipeIdOf("Eval chicken and rice");

    expect((await listRecipes(user.client)).find((recipe) => recipe.id === id)?.name).toBe(
      "Eval chicken and rice",
    );
    await expect(world().recipeIdOf("Eval risotto")).rejects.toThrow("no recipe");
  });

  it("should give the same fingerprint twice, and another when a recipe changed", async () => {
    const before = await world().recipesFingerprint();
    expect(await world().recipesFingerprint()).toBe(before);
    const id = await world().recipeIdOf("Eval egg on toast");

    const renamed = await user.client
      .from("recipes")
      .update({ name: "key1037 renamed" })
      .eq("id", id);
    expect(renamed.error).toBeNull();
    const after = await world().recipesFingerprint();
    const restored = await user.client
      .from("recipes")
      .update({ name: "Eval egg on toast" })
      .eq("id", id);
    expect(restored.error).toBeNull();

    expect(after).not.toBe(before);
    expect(await world().recipesFingerprint()).toBe(before);
  });

  it("should press not true on apples so the next profile drops them, and take it back", async () => {
    await world().markNotUsual("apple");
    const corrected = await profileFromDatabase();
    await world().clearCorrections();
    const restored = await profileFromDatabase();

    expect(corrected.usualFoods.some(({ shortName }) => shortName === "apples")).toBe(false);
    expect(shapeOf(restored)).toEqual(shapeOf(expectedPalateProfile(user.anchorDate)));
    expect(await listPalatePreferences(user.client)).toHaveLength(3);
  });
});
