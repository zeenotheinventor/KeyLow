import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeFood, makePortion } from "./support";
import { noPlateHooks } from "../diary/noPlateHooks";
import { noFavouriteHooks } from "../favourites/noFavouriteHooks";

import type { FoodWithPortionsState } from "@keylow/api-client";
import type { Food } from "@keylow/core/schemas";

import { FoodDetail } from "@/components/foods/FoodDetail";
import { ToastProvider } from "@/components/ui/Toast";

const { useFoodWithPortions, useRefreshOutdatedOffFood } = vi.hoisted(() => ({
  useFoodWithPortions: vi.fn<(id: string) => FoodWithPortionsState>(),
  useRefreshOutdatedOffFood: vi.fn<(food: Food | undefined) => void>(),
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  ...noFavouriteHooks,
  ...noPlateHooks,
  useFoodWithPortions,
  useRefreshOutdatedOffFood,
}));

const bucket = makeFood({
  owner_id: null,
  source: "restaurant",
  name: "Bargain bucket",
  basis: "per_portion",
  kcal: 500,
  protein_g: 40,
  fat_g: 30,
  carbs_g: 20,
});
const bucketPortion = makePortion({ label: "1 bucket", grams: null, ml: null, is_default: true });

function showFood(food: Food) {
  useFoodWithPortions.mockReturnValue({ status: "ready", food, portions: [bucketPortion] });
  render(
    <ToastProvider>
      <FoodDetail id={food.id} />
    </ToastProvider>,
  );
}

describe("the food detail of a food with no published weight", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("should say per bucket in the hero and the nutrition heading, never per 100 g", () => {
    showFood(bucket);

    expect(
      within(screen.getByRole("region", { name: "Energy and macros" })).getByText("per bucket"),
    ).toBeTruthy();
    expect(screen.getByText("Nutrition per bucket")).toBeTruthy();
    expect(screen.queryByText(/100 g/)).toBeNull();
  });

  it("should list its portion with no size", () => {
    showFood(bucket);

    expect(screen.getByText("1 bucket")).toBeTruthy();
    expect(screen.queryByText(/\b0 g\b/)).toBeNull();
  });

  it("should offer no Copy to your foods when it is missing a value", () => {
    showFood({
      ...bucket,
      protein_g: null,
      quality: { suspect: true, fields_missing: ["protein_g"] },
    });

    expect(screen.getByText("Needs review")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Copy to your foods" })).toBeNull();
  });
});
