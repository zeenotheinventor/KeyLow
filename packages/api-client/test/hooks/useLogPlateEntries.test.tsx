import { plateItemOfHit, plateItemOfRecipe } from "@keylow/core/plate";
import { onlineManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  PlateFoodGoneError,
  PlateFoodNeedsReviewError,
  useLogPlateEntries,
} from "../../src/hooks/useLogPlateEntries";
import { installDiaryFake } from "../support/diaryFake";
import { REST_URL, foodRow, portionRow, postgrestError, postgrestRows } from "../support/postgrest";
import { loggableRecipe } from "../support/recipeEntries";
import { createWrapper } from "../support/wrapper";

import type { PlateHit } from "@keylow/core/plate";
import type { Food, FoodPortion } from "@keylow/core/schemas";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
  onlineManager.setOnline(true);
});
afterAll(() => {
  server.close();
});

const DAY = "2026-10-15";
const FLAPJACK = foodRow();
const FLAPJACK_BAR = portionRow();
const YOGHURT = foodRow({
  id: "66666666-6666-4666-8666-666666666666",
  name: "Greek yoghurt 0% fat",
  kcal: 57,
});
const when = { loggedAt: `${DAY}T18:20:30.000Z`, localDate: DAY };

const hitOf = (food: Food, portion?: FoodPortion): PlateHit => ({
  id: food.id,
  name: food.name,
  basis: food.basis,
  kcal: food.kcal,
  protein_g: food.protein_g,
  carbs_g: food.carbs_g,
  fat_g: food.fat_g,
  default_portion_id: portion?.id ?? null,
  default_portion_label: portion?.label ?? null,
  default_portion_grams: portion?.grams ?? null,
  default_portion_ml: portion?.ml ?? null,
});
const flapjackBar = plateItemOfHit("a", hitOf(FLAPJACK, FLAPJACK_BAR));
const flapjackInGrams = plateItemOfHit("b", hitOf(FLAPJACK));
const yoghurtInGrams = plateItemOfHit("c", hitOf(YOGHURT));
const stewServing = plateItemOfRecipe({ key: "d", recipe: loggableRecipe });

/** The foods table and the portions table behind MSW, counting what each food had read. */
function installFoodReads(options: { foods?: Food[]; portions?: FoodPortion[] } = {}) {
  const { foods = [FLAPJACK, YOGHURT], portions = [FLAPJACK_BAR] } = options;
  const reads = { foods: [] as string[], portions: [] as string[] };
  server.use(
    http.get(`${REST_URL}/foods`, ({ request }) => {
      const id = new URL(request.url).searchParams.get("id")?.replace("eq.", "") ?? "";
      reads.foods.push(id);
      return postgrestRows(
        request,
        foods.filter((food) => food.id === id),
      );
    }),
    http.get(`${REST_URL}/food_portions`, ({ request }) => {
      const foodId = new URL(request.url).searchParams.get("food_id")?.replace("eq.", "") ?? "";
      reads.portions.push(foodId);
      return postgrestRows(
        request,
        portions.filter((portion) => portion.food_id === foodId),
      );
    }),
  );
  return reads;
}

function renderLogPlate() {
  const { wrapper } = createWrapper();
  return renderHook(() => useLogPlateEntries(), { wrapper });
}

describe("useLogPlateEntries", () => {
  it("should read each distinct food once and write the whole plate in one request, in plate order", async () => {
    const reads = installFoodReads();
    const fake = installDiaryFake(server);
    const { result } = renderLogPlate();

    const entries = await act(() =>
      result.current.mutateAsync({
        items: [flapjackBar, yoghurtInGrams, flapjackInGrams, stewServing],
        ...when,
      }),
    );

    // The flapjack is on the plate twice and is read once.
    expect(reads.foods).toHaveLength(2);
    expect(new Set(reads.foods)).toEqual(new Set([FLAPJACK.id, YOGHURT.id]));
    expect(reads.portions).toHaveLength(2);
    expect(new Set(reads.portions)).toEqual(new Set([FLAPJACK.id, YOGHURT.id]));
    expect(fake.requests.writes).toBe(1);
    expect(entries.map(({ item_type }) => item_type)).toEqual(["food", "food", "food", "recipe"]);
    expect(entries.map(({ food_id }) => food_id)).toEqual([
      FLAPJACK.id,
      YOGHURT.id,
      FLAPJACK.id,
      null,
    ]);
  });

  it("should keep the plate's order in the diary: each row a millisecond after the one before", async () => {
    installFoodReads();
    const fake = installDiaryFake(server);
    const { result } = renderLogPlate();

    await act(() =>
      result.current.mutateAsync({
        items: [flapjackBar, yoghurtInGrams, flapjackInGrams, stewServing],
        ...when,
      }),
    );

    expect(fake.rows.map(({ logged_at }) => logged_at)).toEqual([
      "2026-10-15T18:20:30.000Z",
      "2026-10-15T18:20:30.001Z",
      "2026-10-15T18:20:30.002Z",
      "2026-10-15T18:20:30.003Z",
    ]);
    expect(new Set(fake.rows.map(({ local_date }) => local_date))).toEqual(new Set([DAY]));
  });

  it("should log a portion row against the portion the food has now", async () => {
    installFoodReads();
    const fake = installDiaryFake(server);
    const { result } = renderLogPlate();

    await act(() => result.current.mutateAsync({ items: [flapjackBar], ...when }));

    expect(fake.rows).toMatchObject([
      { quantity: 1, unit: "portion", portion_id: FLAPJACK_BAR.id, resolved_grams: 60 },
    ]);
  });

  it("should keep the weight eaten when the food has lost the portion the row was counted in", async () => {
    installFoodReads({ portions: [] });
    const fake = installDiaryFake(server);
    const { result } = renderLogPlate();

    await act(() => result.current.mutateAsync({ items: [flapjackBar], ...when }));

    expect(fake.rows).toMatchObject([{ quantity: 60, unit: "g", portion_id: null }]);
  });

  it("should read no food for a plate of recipes", async () => {
    const reads = installFoodReads();
    installDiaryFake(server);
    const { result } = renderLogPlate();

    await act(() => result.current.mutateAsync({ items: [stewServing], ...when }));

    expect(reads.foods).toEqual([]);
    expect(reads.portions).toEqual([]);
  });

  describe("when a food cannot be read", () => {
    it("should write nothing when a food is no longer there", async () => {
      installFoodReads({ foods: [FLAPJACK] });
      const fake = installDiaryFake(server);
      const { result } = renderLogPlate();

      await expect(
        act(() =>
          result.current.mutateAsync({ items: [flapjackInGrams, yoghurtInGrams], ...when }),
        ),
      ).rejects.toThrow(/no longer there/);

      expect(fake.requests.writes).toBe(0);
      expect(fake.rows).toEqual([]);
    });

    it("should write nothing when a food on the plate has been deleted since it was added", async () => {
      installFoodReads({
        foods: [FLAPJACK, { ...YOGHURT, deleted_at: "2026-10-15T09:00:00+00:00" }],
      });
      const fake = installDiaryFake(server);
      const { result } = renderLogPlate();

      await expect(
        act(() =>
          result.current.mutateAsync({ items: [flapjackInGrams, yoghurtInGrams], ...when }),
        ),
      ).rejects.toBeInstanceOf(PlateFoodGoneError);

      expect(fake.requests.writes).toBe(0);
      expect(fake.rows).toEqual([]);
    });

    it("should write nothing when a food on the plate is flagged suspect now", async () => {
      installFoodReads({ foods: [FLAPJACK, { ...YOGHURT, quality: { suspect: true } }] });
      const fake = installDiaryFake(server);
      const { result } = renderLogPlate();

      await expect(
        act(() =>
          result.current.mutateAsync({ items: [flapjackInGrams, yoghurtInGrams], ...when }),
        ),
      ).rejects.toBeInstanceOf(PlateFoodNeedsReviewError);

      expect(fake.requests.writes).toBe(0);
    });

    it("should write nothing when a food on the plate has lost a macro since it was added", async () => {
      installFoodReads({ foods: [FLAPJACK, { ...YOGHURT, fat_g: null }] });
      const fake = installDiaryFake(server);
      const { result } = renderLogPlate();

      await expect(
        act(() =>
          result.current.mutateAsync({ items: [flapjackInGrams, yoghurtInGrams], ...when }),
        ),
      ).rejects.toBeInstanceOf(PlateFoodNeedsReviewError);

      expect(fake.requests.writes).toBe(0);
    });

    it("should name no food and no amount in what it throws", async () => {
      installFoodReads({ foods: [{ ...YOGHURT, deleted_at: "2026-10-15T09:00:00+00:00" }] });
      installDiaryFake(server);
      const { result } = renderLogPlate();

      const failure = await act(async () => {
        try {
          await result.current.mutateAsync({ items: [yoghurtInGrams], ...when });
        } catch (error) {
          return error;
        }
      });

      expect(String(failure)).not.toMatch(/yoghurt|100/i);
    });

    it("should write nothing when the food read fails", async () => {
      installFoodReads();
      server.use(http.get(`${REST_URL}/foods`, () => postgrestError(500, "XX000", "unavailable")));
      const fake = installDiaryFake(server);
      const { result } = renderLogPlate();

      await expect(
        act(() => result.current.mutateAsync({ items: [flapjackInGrams], ...when })),
      ).rejects.toThrow();

      expect(fake.requests.writes).toBe(0);
    });

    it("should write nothing when the portions of one food cannot be read", async () => {
      installFoodReads();
      server.use(
        http.get(`${REST_URL}/food_portions`, () => postgrestError(500, "XX000", "unavailable")),
      );
      const fake = installDiaryFake(server);
      const { result } = renderLogPlate();

      await expect(
        act(() =>
          result.current.mutateAsync({ items: [flapjackInGrams, yoghurtInGrams], ...when }),
        ),
      ).rejects.toThrow();

      expect(fake.requests.writes).toBe(0);
    });

    it("should name no food or amount in the error", async () => {
      installFoodReads({ foods: [] });
      installDiaryFake(server);
      const { result } = renderLogPlate();

      let failure: unknown;
      await act(async () => {
        try {
          await result.current.mutateAsync({ items: [flapjackInGrams], ...when });
        } catch (error) {
          failure = error;
        }
      });

      expect(failure).toBeInstanceOf(Error);
      expect(String(failure)).not.toContain(FLAPJACK.name);
      expect(String(failure)).not.toContain(FLAPJACK.id);
    });
  });

  it("should write nothing for a row whose amount is not valid", async () => {
    installFoodReads();
    const fake = installDiaryFake(server);
    const { result } = renderLogPlate();

    await expect(
      act(() =>
        result.current.mutateAsync({
          items: [flapjackInGrams, { ...yoghurtInGrams, quantity: 0, quantityText: "" }],
          ...when,
        }),
      ),
    ).rejects.toThrow();

    expect(fake.requests.writes).toBe(0);
  });

  it("should convert a millilitre row by the density of the food's own serving label", async () => {
    const labelled = portionRow({
      id: "77777777-7777-4777-8777-777777777777",
      label: "2 tsp (13 g)",
      grams: 13,
    });
    installFoodReads({ portions: [labelled] });
    const fake = installDiaryFake(server);
    const { result } = renderLogPlate();
    const sauceInMillilitres = {
      ...plateItemOfHit("e", hitOf(FLAPJACK)),
      unit: { kind: "ml" },
      quantity: 100,
      quantityText: "100",
    } as const;

    await act(() => result.current.mutateAsync({ items: [sauceInMillilitres], ...when }));

    // 2 tsp is 10 ml and the label says 13 g, so 100 ml is 130 g.
    expect(fake.rows).toMatchObject([{ quantity: 100, unit: "ml" }]);
    expect(fake.rows[0]?.resolved_grams).toBeCloseTo(130, 10);
  });

  it("should run rather than pause while offline, so the Log button never hangs", async () => {
    installFoodReads();
    const fake = installDiaryFake(server);
    const { result } = renderLogPlate();
    onlineManager.setOnline(false);

    act(() => {
      result.current.mutate({ items: [flapjackInGrams], ...when });
    });

    expect(result.current.isPaused).toBe(false);
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(fake.requests.writes).toBe(1);
  });

  it("should refuse an empty plate before any request", async () => {
    const reads = installFoodReads();
    const fake = installDiaryFake(server);
    const { result } = renderLogPlate();

    await expect(act(() => result.current.mutateAsync({ items: [], ...when }))).rejects.toThrow(
      RangeError,
    );

    expect(reads.foods).toEqual([]);
    expect(fake.requests.writes).toBe(0);
  });
});
