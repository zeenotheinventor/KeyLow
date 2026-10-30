import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
import { makeSearchHit } from "../foods/support";

import type { FoodSearchHit } from "@keylow/api-client";
import type { Food } from "@keylow/core/schemas";

import { AddFoodDialog } from "@/components/diary/AddFoodDialog";
import { ToastProvider } from "@/components/ui/Toast";

const search = vi.hoisted((): { hits: FoodSearchHit[] } => ({ hits: [] }));

// The search and the recipes are other tests' business. The food, its portions and the refresh are real.
vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useProfileTimeZone: () => ({ data: "UTC" }),
  useFoodSearch: () => ({
    local: search.hits,
    off: [],
    isLoadingLocal: false,
    isLoadingOff: false,
    isDebouncing: false,
    offError: null,
    localError: null,
  }),
  useRecipeSearch: () => ({ recipes: [], isLoading: false, isDebouncing: false, error: null }),
}));

/** Opens the portion step of the food, the way a person does: search, then press its row. */
function openFood(food: Food) {
  search.hits = [makeSearchHit({ id: food.id, name: food.name, source: food.source })];
  render(
    <OffRefreshProvider>
      <ToastProvider>
        <AddFoodDialog
          request={{ date: "2026-10-15" }}
          opener={null}
          onClose={vi.fn<() => void>()}
          onQuickAdd={vi.fn<() => void>()}
        />
      </ToastProvider>
    </OffRefreshProvider>,
  );
  fireEvent.change(screen.getByRole("searchbox", { name: "Search foods" }), {
    target: { value: "cola" },
  });
  fireEvent.click(
    within(screen.getByRole("group", { name: "Search results" })).getByRole("button", {
      name: /^Cola/,
    }),
  );
}

const chipNames = () => screen.getAllByRole("radio").map((chip) => chip.textContent);

beforeEach(() => {
  resetOffRefreshBackend();
});

afterEach(() => {
  cleanup();
});

describe("the add dialog's portion step for an old branded food", () => {
  it("should ask off-product once for the food's code and add the new chip with no message", async () => {
    const food = oldBrandedFood();
    storeOldBrandedFood(food);
    openFood(food);
    await screen.findByRole("radio", { name: "1 serving" });

    await screen.findByRole("radio", { name: "1 can" });

    expect(offRefreshBackend.refreshedCodes).toEqual([BRANDED_CODE]);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("should keep the old chips and show nothing when off-product is rate limited", async () => {
    const food = oldBrandedFood();
    storeOldBrandedFood(food);
    offRefreshBackend.refreshFails = "rateLimited";
    openFood(food);
    await screen.findByRole("radio", { name: "1 serving" });

    await waitFor(() => {
      expect(offRefreshBackend.refreshedCodes).toHaveLength(1);
    });
    await letRequestsArrive();

    expect(chipNames()).toEqual(["1 serving", "1 bottle", "g"]);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("should keep the chip picked and the amount typed before the refresh lands, and leave Add enabled", async () => {
    const food = oldBrandedFood();
    storeOldBrandedFood(food);
    const release = holdRefresh();
    openFood(food);
    await screen.findByRole("radio", { name: "1 bottle" });
    fireEvent.click(screen.getByRole("radio", { name: "1 bottle" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Amount (bottle)" }), {
      target: { value: "2" },
    });

    release();
    await screen.findByRole("radio", { name: "1 can" });

    expect(screen.getByRole("radio", { name: "1 bottle", checked: true })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Amount (bottle)" })).toHaveProperty("value", "2");
    expect(screen.getByRole("button", { name: "Add" })).toHaveProperty("disabled", false);
  });

  it("should keep the amount typed on the default chip, and the chip, when the refresh makes another chip the default", async () => {
    const food = oldBrandedFood();
    storeOldBrandedFood(food);
    const release = holdRefresh();
    openFood(food);
    await screen.findByRole("radio", { name: "1 serving" });
    fireEvent.change(screen.getByRole("textbox", { name: "Amount (serving)" }), {
      target: { value: "3" },
    });

    release();
    await screen.findByRole("radio", { name: "1 can" });

    expect(screen.getByRole("radio", { name: "1 serving", checked: true })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Amount (serving)" })).toHaveProperty("value", "3");
  });

  it("should stay on the chip the dialog opened on when the refresh makes another chip the default", async () => {
    const food = oldBrandedFood();
    storeOldBrandedFood(food);
    const release = holdRefresh();
    openFood(food);
    await screen.findByRole("radio", { name: "1 serving" });

    release();
    await screen.findByRole("radio", { name: "1 can" });

    expect(screen.getByRole("radio", { name: "1 serving", checked: true })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Amount (serving)" })).toHaveProperty("value", "1");
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
    openFood(food);
    await screen.findByRole("radio", { name: "1 serving" });

    await letRequestsArrive();

    expect(offRefreshBackend.refreshedCodes).toEqual([]);
    expect(screen.queryByRole("radio", { name: "1 can" })).toBeNull();
  });
});
