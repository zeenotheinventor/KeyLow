import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { RecipeLogProvider, resetRecipeLogBackend } from "./recipeLogBackend";

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
});
