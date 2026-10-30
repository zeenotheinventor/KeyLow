import { buildRecipeIngredient } from "@keylow/core/recipes";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BRANDED_CODE,
  FETCHED_AFTER_THE_RULES,
  OffRefreshProvider,
  holdRefresh,
  letRequestsArrive,
  offRefreshBackend,
  oldBrandedFood,
  resetOffRefreshBackend,
  storeOldBrandedFood,
} from "../foods/offRefreshBackend";

import type { RecipeIngredient } from "@keylow/core/recipes";
import type { Food } from "@keylow/core/schemas";

import { EditIngredientDialog } from "@/components/recipes/EditIngredientDialog";

function openIngredientOf(food: Food) {
  const ingredient = buildRecipeIngredient(food, { quantity: 200, unit: "g" });
  const onSave = vi.fn<(saved: RecipeIngredient) => void>();
  render(
    <OffRefreshProvider>
      <EditIngredientDialog
        ingredient={ingredient}
        opener={null}
        onClose={vi.fn()}
        onSave={onSave}
        onRemove={vi.fn()}
      />
    </OffRefreshProvider>,
  );

  return { ingredient, onSave };
}

const amount = () => screen.getByRole("textbox", { name: /^Amount/ });

beforeEach(() => {
  resetOffRefreshBackend();
});

afterEach(() => {
  cleanup();
});

describe("the edit ingredient dialog for an old branded food", () => {
  it("should ask off-product once for the food's code and add the new chip with no message", async () => {
    const food = oldBrandedFood();
    storeOldBrandedFood(food);
    openIngredientOf(food);
    await screen.findByRole("radio", { name: "1 serving" });

    await screen.findByRole("radio", { name: "1 can" });

    expect(offRefreshBackend.refreshedCodes).toEqual([BRANDED_CODE]);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("should keep the ingredient's own values and amount after the refresh lands", async () => {
    const food = oldBrandedFood();
    storeOldBrandedFood(food);
    const refreshed = offRefreshBackend.product;
    if (refreshed === undefined) {
      throw new Error("The backend has no refreshed product");
    }
    // The refreshed food has other numbers than the ingredient was added with.
    offRefreshBackend.product = { ...refreshed, food: { ...refreshed.food, kcal: 99 } };
    const { ingredient, onSave } = openIngredientOf(food);
    await screen.findByRole("radio", { name: "1 serving" });

    await screen.findByRole("radio", { name: "1 can" });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(amount()).toHaveProperty("value", "200");
    expect(screen.getByRole("radio", { name: "g", checked: true })).toBeTruthy();
    expect(onSave).toHaveBeenCalledWith(ingredient);
  });

  it("should keep the chip picked and the amount typed before the refresh lands, and leave Save enabled", async () => {
    const food = oldBrandedFood();
    storeOldBrandedFood(food);
    const release = holdRefresh();
    openIngredientOf(food);
    await screen.findByRole("radio", { name: "1 bottle" });
    fireEvent.click(screen.getByRole("radio", { name: "1 bottle" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Amount (bottle)" }), {
      target: { value: "2" },
    });

    release();
    await screen.findByRole("radio", { name: "1 can" });

    expect(screen.getByRole("radio", { name: "1 bottle", checked: true })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Amount (bottle)" })).toHaveProperty("value", "2");
    expect(screen.getByRole("button", { name: "Save" })).toHaveProperty("disabled", false);
  });

  it("should keep the amount typed before the refresh lands", async () => {
    const food = oldBrandedFood();
    storeOldBrandedFood(food);
    const release = holdRefresh();
    openIngredientOf(food);
    await screen.findByRole("radio", { name: "1 bottle" });
    fireEvent.change(amount(), { target: { value: "250" } });

    release();
    await screen.findByRole("radio", { name: "1 can" });

    expect(amount()).toHaveProperty("value", "250");
    expect(screen.getByRole("radio", { name: "g", checked: true })).toBeTruthy();
  });

  it("should keep the old chips and show nothing when off-product is rate limited", async () => {
    const food = oldBrandedFood();
    storeOldBrandedFood(food);
    offRefreshBackend.refreshFails = "rateLimited";
    openIngredientOf(food);
    await screen.findByRole("radio", { name: "1 serving" });

    await waitFor(() => {
      expect(offRefreshBackend.refreshedCodes).toHaveLength(1);
    });
    await letRequestsArrive();

    expect(screen.queryByRole("radio", { name: "1 can" })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("should not ask off-product when the food has been deleted", async () => {
    const food = oldBrandedFood({ deleted_at: "2026-10-16T09:00:00+00:00" });
    storeOldBrandedFood(food);
    openIngredientOf(food);

    await letRequestsArrive();

    expect(offRefreshBackend.refreshedCodes).toEqual([]);
  });

  it.each<[string, Partial<Food>]>([
    ["an Open Food Facts food fetched since the rules", { fetched_at: FETCHED_AFTER_THE_RULES }],
    ["a CoFID food", { source: "cofid", source_ref: "13-123", barcode: null }],
    ["a USDA food", { source: "usda", source_ref: "170000", barcode: null }],
    ["a food of the person's own", { source: "user", source_ref: null, fetched_at: null }],
    ["an Open Food Facts food with no source reference", { source_ref: null }],
  ])("should not ask off-product for %s", async (_name, overrides) => {
    const food = oldBrandedFood(overrides);
    storeOldBrandedFood(food);
    openIngredientOf(food);
    await screen.findByRole("radio", { name: "1 serving" });

    await letRequestsArrive();

    expect(offRefreshBackend.refreshedCodes).toEqual([]);
  });
});
