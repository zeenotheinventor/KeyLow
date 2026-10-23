import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  RecipeLogProvider,
  holdInserts,
  recipeLogBackend,
  resetRecipeLogBackend,
} from "./recipeLogBackend";

import type { RecipeSummary } from "@keylow/api-client";

import { useRecipePortionDraft } from "@/components/diary/AddFoodDialog/useRecipePortionDraft";
import { sampleRecipes } from "@/components/recipes/sampleRecipes";

const [beefChilli, chickenAndRice] = sampleRecipes;
if (beefChilli === undefined || chickenAndRice === undefined) {
  throw new Error("The sample recipes are missing");
}

function renderDraft(initial: RecipeSummary | undefined) {
  return renderHook(({ recipe }) => useRecipePortionDraft(recipe), {
    initialProps: { recipe: initial },
    wrapper: RecipeLogProvider,
  });
}

beforeEach(() => {
  resetRecipeLogBackend();
});

afterEach(() => {
  cleanup();
});

describe("useRecipePortionDraft", () => {
  it("should be undefined while no recipe is chosen", () => {
    const { result } = renderDraft(undefined);

    expect(result.current).toBeUndefined();
  });

  it("should start on one serving", () => {
    const { result } = renderDraft(chickenAndRice);

    expect(result.current?.unit).toBe("serving");
    expect(result.current?.quantityText).toBe("1");
    expect(result.current?.typed?.amount).toEqual({ quantity: 1, unit: "serving" });
  });

  it("should start again on one serving for another recipe", () => {
    const { result, rerender } = renderDraft(chickenAndRice);
    act(() => {
      result.current?.setUnit("g");
    });
    act(() => {
      result.current?.setQuantityText("300");
    });

    rerender({ recipe: beefChilli });

    expect(result.current?.unit).toBe("serving");
    expect(result.current?.quantityText).toBe("1");
  });

  it("should start the amount at 100 when the unit becomes g, and give nothing for text that is not an amount", () => {
    const { result } = renderDraft(chickenAndRice);

    act(() => {
      result.current?.setUnit("g");
    });
    expect(result.current?.quantityText).toBe("100");

    act(() => {
      result.current?.setQuantityText("");
    });
    expect(result.current?.typed).toBeNull();
  });

  it("should log the typed amount at the instant it is given", async () => {
    const { result } = renderDraft(chickenAndRice);
    act(() => {
      result.current?.setUnit("g");
    });
    act(() => {
      result.current?.setQuantityText("300");
    });

    let wasSaved: boolean | undefined;
    await act(async () => {
      wasSaved = await result.current?.add({
        loggedAt: new Date("2026-10-15T19:00:00Z"),
        localDate: "2026-10-15",
      });
    });

    expect(wasSaved).toBe(true);
    expect(recipeLogBackend.inserts).toHaveLength(1);
    expect(recipeLogBackend.inserts[0]).toMatchObject({
      recipe_id: chickenAndRice.id,
      quantity: 300,
      unit: "g",
      logged_at: "2026-10-15T19:00:00.000Z",
      local_date: "2026-10-15",
    });
  });

  it("should send nothing, and say it was not saved, while the amount cannot be logged", async () => {
    const { result } = renderDraft(chickenAndRice);
    act(() => {
      result.current?.setQuantityText("0");
    });

    let wasSaved: boolean | undefined;
    await act(async () => {
      wasSaved = await result.current?.add({
        loggedAt: new Date("2026-10-15T19:00:00Z"),
        localDate: "2026-10-15",
      });
    });

    expect(wasSaved).toBe(false);
    expect(recipeLogBackend.inserts).toEqual([]);
  });

  it("should keep a failure as a flag and nothing else, and clear it on the next try", async () => {
    recipeLogBackend.failsInsert = true;
    const { result } = renderDraft(chickenAndRice);
    const when = { loggedAt: new Date("2026-10-15T19:00:00Z"), localDate: "2026-10-15" };

    await act(async () => {
      await result.current?.add(when);
    });
    expect(result.current?.hasSaveError).toBe(true);
    expect(JSON.stringify(result.current?.hasSaveError)).not.toMatch(/RAW/);

    recipeLogBackend.failsInsert = false;
    await act(async () => {
      await result.current?.add(when);
    });
    await waitFor(() => {
      expect(result.current?.hasSaveError).toBe(false);
    });
  });

  it("should not show one recipe's failed save on another recipe", async () => {
    recipeLogBackend.failsInsert = true;
    const { result, rerender } = renderDraft(chickenAndRice);

    await act(async () => {
      await result.current?.add({
        loggedAt: new Date("2026-10-15T19:00:00Z"),
        localDate: "2026-10-15",
      });
    });
    expect(result.current?.hasSaveError).toBe(true);

    rerender({ recipe: beefChilli });

    expect(result.current?.hasSaveError).toBe(false);
  });

  it("should log once when add is called twice before the first has finished", async () => {
    const release = holdInserts();
    const { result } = renderDraft(chickenAndRice);
    const when = { loggedAt: new Date("2026-10-15T19:00:00Z"), localDate: "2026-10-15" };

    let results: boolean[] = [];
    await act(async () => {
      const pending = Promise.all([result.current?.add(when), result.current?.add(when)]);
      await waitFor(() => {
        expect(recipeLogBackend.inserts).toHaveLength(1);
      });
      release();
      results = (await pending).map(Boolean);
    });

    expect(results).toEqual([true, false]);
    expect(recipeLogBackend.inserts).toHaveLength(1);
  });
});
