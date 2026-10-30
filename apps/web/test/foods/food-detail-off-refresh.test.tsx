import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  BRANDED_CODE,
  FETCHED_AFTER_THE_RULES,
  OffRefreshProvider,
  letRequestsArrive,
  offRefreshBackend,
  oldBrandedFood,
  resetOffRefreshBackend,
  storeOldBrandedFood,
} from "./offRefreshBackend";

import type { Food } from "@keylow/core/schemas";

import { FoodDetail } from "@/components/foods/FoodDetail";

function openFood(food: Food) {
  render(
    <OffRefreshProvider>
      <FoodDetail id={food.id} />
    </OffRefreshProvider>,
  );
}

const portionNames = () => screen.queryAllByRole("listitem").map((item) => item.textContent);

beforeEach(() => {
  resetOffRefreshBackend();
});

afterEach(() => {
  cleanup();
});

describe("the food page for an old branded food", () => {
  it("should ask off-product once for the food's code and show the new portion with no message", async () => {
    const food = oldBrandedFood();
    storeOldBrandedFood(food);
    openFood(food);
    await screen.findByText("1 serving");

    await screen.findByText("1 can");

    expect(offRefreshBackend.refreshedCodes).toEqual([BRANDED_CODE]);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("should keep the old portions and show nothing when off-product is rate limited", async () => {
    const food = oldBrandedFood();
    storeOldBrandedFood(food);
    offRefreshBackend.refreshFails = "rateLimited";
    openFood(food);
    await screen.findByText("1 serving");

    await waitFor(() => {
      expect(offRefreshBackend.refreshedCodes).toHaveLength(1);
    });
    await letRequestsArrive();

    expect(screen.getByText("1 serving")).toBeTruthy();
    expect(screen.queryByText("1 can")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("should keep the old portions and show nothing when off-product fails", async () => {
    const food = oldBrandedFood();
    storeOldBrandedFood(food);
    offRefreshBackend.refreshFails = "serverError";
    openFood(food);
    await screen.findByText("1 serving");

    await waitFor(() => {
      expect(offRefreshBackend.refreshedCodes).toHaveLength(1);
    });
    await letRequestsArrive();

    expect(screen.getByText("1 serving")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("the food page for a food that needs no refresh", () => {
  it.each<[string, Partial<Food>]>([
    ["an Open Food Facts food fetched since the rules", { fetched_at: FETCHED_AFTER_THE_RULES }],
    ["a CoFID food", { source: "cofid", source_ref: "13-123", barcode: null }],
    ["a USDA food", { source: "usda", source_ref: "170000", barcode: null }],
    ["a food of the person's own", { source: "user", source_ref: null, fetched_at: null }],
    ["an Open Food Facts food with no source reference", { source_ref: null }],
  ])("should not ask off-product for %s", async (_name, overrides) => {
    const food = oldBrandedFood(overrides);
    storeOldBrandedFood(food);
    openFood(food);
    await screen.findByText("1 serving");

    await letRequestsArrive();

    expect(offRefreshBackend.refreshedCodes).toEqual([]);
    expect(portionNames().some((name) => name.includes("1 can"))).toBe(false);
  });

  it("should not ask off-product for a food that is not found", async () => {
    openFood(oldBrandedFood());

    await screen.findByText("Food not found");
    await letRequestsArrive();

    expect(offRefreshBackend.refreshedCodes).toEqual([]);
  });
});
