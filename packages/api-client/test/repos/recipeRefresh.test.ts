import { computeRecipe } from "@keylow/core/recipes";
import { buildChickenAndRiceRecipe } from "@keylow/core/testing";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { previewRecipeRefresh } from "../../src/repos/recipes";
import { applyRecipeRefresh } from "../../src/repos/recipeWrites";
import { createTestClient } from "../createTestClient";
import { REST_URL, portionRow, postgrestError, postgrestRows } from "../support/postgrest";
import { answerRefreshReads, chicken, oil, rice } from "../support/recipeRefresh";
import { RECIPE_ID } from "../support/recipes";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const unchangedFoods = [chicken, rice, oil];
const richerChicken = { ...chicken, kcal: 140 };

describe("previewRecipeRefresh", () => {
  it("should be null for a recipe the user cannot see, and read no food", async () => {
    const reads = answerRefreshReads(server, { foods: unchangedFoods });
    server.use(http.get(`${REST_URL}/recipes`, ({ request }) => postgrestRows(request, [])));

    const preview = await previewRecipeRefresh(createTestClient(), RECIPE_ID);

    expect(preview).toBeNull();
    expect(reads.foodIds).toEqual([]);
  });

  it("should report no change when every food is as the recipe froze it", async () => {
    answerRefreshReads(server, { foods: unchangedFoods });

    const preview = await previewRecipeRefresh(createTestClient(), RECIPE_ID);

    expect(preview?.hasChanges).toBe(false);
    expect(preview?.changes.map(({ changed, foodGone }) => [changed, foodGone])).toEqual([
      [false, false],
      [false, false],
      [false, false],
    ]);
  });

  it("should report a changed food's new calories and the recipe's new figures per serving", async () => {
    answerRefreshReads(server, { foods: [richerChicken, rice, oil] });
    const { servings, yieldGrams, ingredients } = buildChickenAndRiceRecipe();

    const preview = await previewRecipeRefresh(createTestClient(), RECIPE_ID);

    expect(preview?.hasChanges).toBe(true);
    expect(preview?.changes.map(({ changed }) => changed)).toEqual([true, false, false]);
    expect(preview?.before).toEqual(computeRecipe({ servings, yieldGrams, ingredients }));
    // 500 g of chicken gains 20 kcal per 100 g, shared between four servings.
    expect(
      (preview?.perServing.kcal.after ?? 0) - (preview?.perServing.kcal.before ?? 0),
    ).toBeCloseTo((500 * 0.2) / 4, 9);
  });

  it("should read each distinct food and its portions once, all in flight together", async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const reads = answerRefreshReads(server, { foods: unchangedFoods, holdFoodReads: held });

    const pending = previewRecipeRefresh(createTestClient(), RECIPE_ID);
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect([...reads.foodIds].sort()).toEqual([chicken.id, oil.id, rice.id].sort());
    release();
    await pending;
    expect([...reads.portionFoodIds].sort()).toEqual([chicken.id, oil.id, rice.id].sort());
  });

  it("should read a food used by two ingredients once", async () => {
    const reads = answerRefreshReads(server, { foods: unchangedFoods });
    const { ingredients } = buildChickenAndRiceRecipe();
    server.use(
      http.get(`${REST_URL}/recipes`, ({ request }) =>
        postgrestRows(request, [
          {
            id: RECIPE_ID,
            name: "Chicken twice",
            servings: 4,
            yield_grams: null,
            is_archived: false,
            computed: computeRecipe({ servings: 4, yieldGrams: null, ingredients }),
            instructions: [],
            recipe_ingredients: [...ingredients, ingredients[0]].map((row, position) => ({
              ...row,
              position,
            })),
          },
        ]),
      ),
    );

    await previewRecipeRefresh(createTestClient(), RECIPE_ID);

    expect(reads.foodIds.filter((id) => id === chicken.id)).toHaveLength(1);
  });

  it("should write nothing", async () => {
    // Any request that is not answered fails the test, so a write other than the save fails it too.
    const reads = answerRefreshReads(server, { foods: [richerChicken, rice, oil] });

    await previewRecipeRefresh(createTestClient(), RECIPE_ID);

    expect(reads.saves).toEqual([]);
  });

  it("should report a soft deleted food as gone and keep its ingredient", async () => {
    answerRefreshReads(server, {
      foods: [{ ...richerChicken, deleted_at: "2026-10-16T10:00:00+00:00" }, rice, oil],
    });

    const preview = await previewRecipeRefresh(createTestClient(), RECIPE_ID);

    expect(preview?.changes[0]).toMatchObject({ foodGone: true, changed: false });
    expect(preview?.hasChanges).toBe(false);
    expect(preview?.after).toEqual(preview?.before);
  });

  it("should read the foods without filtering on deleted_at, so a soft deleted food still resolves", async () => {
    const reads = answerRefreshReads(server, { foods: unchangedFoods });

    await previewRecipeRefresh(createTestClient(), RECIPE_ID);

    expect(reads.foodUrls).toHaveLength(3);
    expect(reads.foodUrls.map((url) => url.searchParams.has("deleted_at"))).toEqual([
      false,
      false,
      false,
    ]);
  });

  it("should report a food the user can no longer see as gone", async () => {
    answerRefreshReads(server, { foods: [rice, oil] });

    const preview = await previewRecipeRefresh(createTestClient(), RECIPE_ID);

    expect(preview?.changes.map(({ foodGone }) => foodGone)).toEqual([true, false, false]);
  });

  it("should not count a change to a portion alone as a change", async () => {
    answerRefreshReads(server, {
      foods: unchangedFoods,
      portions: [portionRow({ food_id: chicken.id, label: "1 breast", grams: 170 })],
    });

    const preview = await previewRecipeRefresh(createTestClient(), RECIPE_ID);

    expect(preview?.hasChanges).toBe(false);
  });

  describe("when a read fails", () => {
    it("should fail the whole preview when one food read fails, with the action and the code only", async () => {
      answerRefreshReads(server, { foods: unchangedFoods });
      server.use(
        http.get(`${REST_URL}/foods`, ({ request }) =>
          new URL(request.url).searchParams.get("id") === `eq.${rice.id}`
            ? postgrestError(500, "XX000", `rice ${rice.name} is secret`)
            : postgrestRows(request, [chicken]),
        ),
      );

      const failure = await previewRecipeRefresh(createTestClient(), RECIPE_ID).catch(
        (error: unknown) => error,
      );

      expect(failure).toEqual(new Error("Could not load the foods of the recipe (XX000)"));
      expect(JSON.stringify(failure)).not.toContain("secret");
    });

    it("should fail the whole preview when a portions read fails", async () => {
      answerRefreshReads(server, { foods: unchangedFoods });
      server.use(
        http.get(`${REST_URL}/food_portions`, () => postgrestError(500, "XX000", "portions down")),
      );

      await expect(previewRecipeRefresh(createTestClient(), RECIPE_ID)).rejects.toThrow(
        "Could not load the foods of the recipe (XX000)",
      );
    });

    it("should fail with the action and the code when the recipe read fails", async () => {
      answerRefreshReads(server, { foods: unchangedFoods });
      server.use(http.get(`${REST_URL}/recipes`, () => postgrestError(500, "XX000", "down")));

      await expect(previewRecipeRefresh(createTestClient(), RECIPE_ID)).rejects.toThrow(
        "Could not load the recipe (XX000)",
      );
    });
  });
});

const savedIngredientsOf = (body: unknown) =>
  z
    .object({
      p_recipe_id: z.string(),
      p_recipe: z.object({ name: z.string(), servings: z.number(), computed: z.unknown() }),
      p_ingredients: z.array(z.object({ food_id: z.string(), snapshot: z.object({}).loose() })),
    })
    .parse(body);

describe("applyRecipeRefresh", () => {
  it("should save the rebuilt ingredients and the new totals in one request", async () => {
    const reads = answerRefreshReads(server, { foods: [richerChicken, rice, oil] });

    await applyRecipeRefresh(createTestClient(), RECIPE_ID);

    expect(reads.saves).toHaveLength(1);
    const saved = savedIngredientsOf(reads.saves[0]);
    expect(saved.p_recipe_id).toBe(RECIPE_ID);
    expect(saved.p_ingredients.map(({ food_id }) => food_id)).toEqual([
      chicken.id,
      rice.id,
      oil.id,
    ]);
    expect(saved.p_ingredients[0]?.snapshot).toMatchObject({ per100: { kcal: 140 } });
  });

  it("should resolve to the diff it applied", async () => {
    answerRefreshReads(server, { foods: [richerChicken, rice, oil] });

    const applied = await applyRecipeRefresh(createTestClient(), RECIPE_ID);

    expect(applied.hasChanges).toBe(true);
    expect(applied.perServing.kcal.after).toBeGreaterThan(applied.perServing.kcal.before ?? 0);
  });

  it("should write nothing when no food changed", async () => {
    const reads = answerRefreshReads(server, { foods: unchangedFoods });

    const applied = await applyRecipeRefresh(createTestClient(), RECIPE_ID);

    expect(applied.hasChanges).toBe(false);
    expect(reads.saves).toEqual([]);
  });

  it("should keep the ingredient of a food that is gone and save the others", async () => {
    const reads = answerRefreshReads(server, {
      foods: [{ ...chicken, deleted_at: "2026-10-16T10:00:00+00:00" }, { ...rice, kcal: 400 }, oil],
    });

    const applied = await applyRecipeRefresh(createTestClient(), RECIPE_ID);

    expect(applied.changes.map(({ foodGone, changed }) => [foodGone, changed])).toEqual([
      [true, false],
      [false, true],
      [false, false],
    ]);
    const saved = savedIngredientsOf(reads.saves[0]);
    expect(saved.p_ingredients[0]?.snapshot).toMatchObject({ per100: { kcal: 120 } });
    expect(saved.p_ingredients[1]?.snapshot).toMatchObject({ per100: { kcal: 400 } });
  });

  it("should fail with P0002 and read no food for a recipe the user cannot see", async () => {
    const reads = answerRefreshReads(server, { foods: unchangedFoods });
    server.use(http.get(`${REST_URL}/recipes`, ({ request }) => postgrestRows(request, [])));

    const failure = await applyRecipeRefresh(createTestClient(), RECIPE_ID).catch(
      (error: unknown) => error,
    );

    expect(failure).toEqual(new Error("Could not refresh the recipe's ingredients (P0002)"));
    expect(reads.foodIds).toEqual([]);
  });

  it("should save nothing when a food read fails", async () => {
    const reads = answerRefreshReads(server, { foods: [richerChicken, rice, oil] });
    server.use(http.get(`${REST_URL}/foods`, () => postgrestError(500, "XX000", "down")));

    await expect(applyRecipeRefresh(createTestClient(), RECIPE_ID)).rejects.toThrow(
      "Could not load the foods of the recipe (XX000)",
    );
    expect(reads.saves).toEqual([]);
  });

  it("should fail with the action and the code when the save fails", async () => {
    answerRefreshReads(server, { foods: [richerChicken, rice, oil] });
    server.use(
      http.post(`${REST_URL}/rpc/save_recipe`, () => postgrestError(500, "XX000", "secret name")),
    );

    await expect(applyRecipeRefresh(createTestClient(), RECIPE_ID)).rejects.toThrow(
      "Could not save the recipe (XX000)",
    );
  });
});
