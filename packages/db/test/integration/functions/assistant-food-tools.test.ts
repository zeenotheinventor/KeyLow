import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getFood, listFoodPortions, searchFoods } from "../../../../api-client/src/repos/foods";
import { listRecipes, searchRecipes } from "../../../../api-client/src/repos/recipes";
import { createTestUser, deleteCreatedTestUsers } from "../support/users";

import type { TestUser } from "../support/users";

/*
 * The reads behind the assistant's food tools (`search_foods`, `get_food`, `get_recipes`) against the
 * real tables, with two users. HTTP-free: each read runs with the user's own signed-in client, which is
 * the client the `mcp` function (not built yet) will hand a tool as its caller, so row level security
 * scopes it. It proves that what one user owns, a food or a recipe, never reaches the tools of the
 * other (ADR 0006).
 *
 * The tools themselves import Deno-style `.ts` paths that this package's typecheck cannot follow, so
 * their own tests run under Deno with a stub client, and assert that each tool calls exactly the repo
 * function used here, on `ctx.caller`. This file proves what those calls return from a real database.
 *
 * Both users own a food and a recipe with the same distinctive word in the name, so a search for it
 * would find the other's too if row level security did not hide it. The word is random per run.
 */

type Owned = { user: TestUser; foodId: string; recipeId: string; archivedRecipeId: string };

// Letters only, because the word is searched as text.
const word = `quill${crypto
  .randomUUID()
  .replaceAll("-", "")
  .replace(/[0-9]/g, (digit) => "ghijklmnop"[Number(digit)] ?? "g")}`;

const nutrients = { kcal: 100, protein_g: 5, fat_g: 2, carbs_g: 15, fibre_g: 1 };
const computed = {
  total: nutrients,
  perServing: nutrients,
  per100g: nutrients,
  totalGrams: 100,
  effectiveGrams: 100,
  engineVersion: 1,
};

async function createOwned(label: string): Promise<Owned> {
  const user = await createTestUser(`key671-${label}`);

  const { data: food, error: foodError } = await user.client
    .from("foods")
    .insert({
      source: "user",
      owner_id: user.id,
      name: `${word} ${label} food`,
      basis: "per_100g",
      kcal: 200,
      protein_g: 10,
      fat_g: 5,
      carbs_g: 20,
      fibre_g: 3,
      micros: {},
    })
    .select("id")
    .single();
  if (foodError) {
    throw new Error("Could not create a food", { cause: foodError });
  }

  const { error: portionError } = await user.client.from("food_portions").insert({
    owner_id: user.id,
    food_id: food.id,
    label: `1 ${label} scoop`,
    grams: 30,
    is_default: true,
    position: 0,
  });
  if (portionError) {
    throw new Error("Could not create a portion", { cause: portionError });
  }

  const recipes = await user.client
    .from("recipes")
    .insert(
      [`${word} ${label} stew`, `${word} ${label} archived stew`].map((name) => ({
        owner_id: user.id,
        name,
        servings: 2,
        instructions: [],
        computed,
      })),
    )
    .select("id,name")
    .order("name");
  if (recipes.error) {
    throw new Error("Could not create the recipes", { cause: recipes.error });
  }
  const [archived, live] = recipes.data;
  if (archived === undefined || live === undefined) {
    throw new Error("Expected two recipes");
  }
  const { error: archiveError } = await user.client
    .from("recipes")
    .update({ is_archived: true })
    .eq("id", archived.id);
  if (archiveError) {
    throw new Error("Could not archive a recipe", { cause: archiveError });
  }

  return { user, foodId: food.id, recipeId: live.id, archivedRecipeId: archived.id };
}

const idsOf = (rows: readonly { id: string }[]): string[] => rows.map((row) => row.id);

let alice: Owned;
let bob: Owned;

beforeAll(async () => {
  alice = await createOwned("alice");
  bob = await createOwned("bob");
});

afterAll(async () => {
  await deleteCreatedTestUsers();
});

describe("search_foods", () => {
  it("finds the caller's own food, with its portion, and never the other user's", async () => {
    const foundByAlice = await searchFoods(alice.user.client, word, 10);
    const foundByBob = await searchFoods(bob.user.client, word, 10);

    expect(idsOf(foundByAlice)).toEqual([alice.foodId]);
    expect(idsOf(foundByBob)).toEqual([bob.foodId]);
    expect(await listFoodPortions(alice.user.client, alice.foodId)).toMatchObject([
      { label: "1 alice scoop", grams: 30, ml: null },
    ]);
  });

  it("shows the caller no portion of a food that is not theirs", async () => {
    expect(await listFoodPortions(alice.user.client, bob.foodId)).toEqual([]);
  });
});

describe("get_food", () => {
  it("reads the caller's own food", async () => {
    expect(await getFood(alice.user.client, alice.foodId)).toMatchObject({ id: alice.foodId });
  });

  it("finds nothing for the id of the other user's food, which the tool answers as not_found", async () => {
    expect(await getFood(alice.user.client, bob.foodId)).toBeNull();
    expect(await getFood(bob.user.client, alice.foodId)).toBeNull();
  });

  it("finds nothing for an id nobody has", async () => {
    expect(await getFood(alice.user.client, crypto.randomUUID())).toBeNull();
  });
});

describe("get_recipes", () => {
  it("searches the caller's live recipes only, never the other user's or an archived one", async () => {
    const foundByAlice = await searchRecipes(alice.user.client, word, { limit: 10 });
    const foundByBob = await searchRecipes(bob.user.client, word, { limit: 10 });

    expect(idsOf(foundByAlice)).toEqual([alice.recipeId]);
    expect(idsOf(foundByBob)).toEqual([bob.recipeId]);
    expect(foundByAlice).toMatchObject([
      { servings: 2, computed: { perServing: { kcal: 100, protein_g: 5 } } },
    ]);
  });

  it("lists the caller's live recipes with no text, and none of the other user's", async () => {
    expect(idsOf(await listRecipes(alice.user.client))).toEqual([alice.recipeId]);
  });
});
