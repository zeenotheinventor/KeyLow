import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { noPlateHooks } from "./noPlateHooks";
import { noFavouriteHooks } from "../favourites/noFavouriteHooks";
import { makeFood, makePortion, makeSearchHit } from "../foods/support";

import type { FoodSearchResult, UseFoodByBarcodeReturn } from "@keylow/api-client";

import { AddFoodDialog } from "@/components/diary/AddFoodDialog";
import { ToastProvider } from "@/components/ui/Toast";
import { FoodLogActionsProvider } from "@/lib/foodLogActions";

const RICE_ID = "11111111-1111-4111-8111-222222222222";
const OAT_CAKES_ID = "11111111-1111-4111-8111-111111111111";
const VALID_EAN_13 = "5000159484695";

const rice = makeSearchHit({
  id: RICE_ID,
  name: "Basmati rice, boiled",
  source: "cofid",
  kcal: 120,
});
const oatCakes = makeFood({ id: OAT_CAKES_ID, name: "Oat cakes", kcal: 430 });
const handful = makePortion({
  id: "22222222-2222-4222-8222-111111111111",
  food_id: OAT_CAKES_ID,
  label: "1 handful",
  grams: 30,
  is_default: true,
});

type Api = { local: FoodSearchResult["local"]; barcode: UseFoodByBarcodeReturn };

const api = vi.hoisted((): Api => ({
  local: [],
  barcode: { result: undefined, isLoading: false, error: null },
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  ...noFavouriteHooks,
  ...noPlateHooks,
  useRefreshOutdatedOffFood: () => undefined,
  useProfileTimeZone: () => ({ data: "UTC" }),
  useRecentFoods: () => ({ data: [], isError: false, fetchStatus: "idle" }),
  useFoodSearch: (query: string): FoodSearchResult => ({
    local: query.trim().length >= 2 ? api.local : [],
    off: [],
    isLoadingLocal: false,
    isLoadingOff: false,
    isDebouncing: false,
    offError: null,
    localError: null,
  }),
  useRecipeSearch: () => ({ recipes: [], isLoading: false, isDebouncing: false, error: null }),
  useFoodByBarcode: () => api.barcode,
  useFoodWithPortions: (id: string) =>
    id === OAT_CAKES_ID
      ? { status: "ready", food: oatCakes, portions: [handful] }
      : { status: "notFound" },
  useSupabase: () => ({}),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/diary",
}));

function renderDialog() {
  render(
    <ToastProvider>
      <FoodLogActionsProvider>
        <AddFoodDialog
          request={{ date: "2026-10-15" }}
          opener={null}
          onClose={vi.fn<() => void>()}
        />
      </FoodLogActionsProvider>
    </ToastProvider>,
  );
}

function search(text: string) {
  fireEvent.change(screen.getByRole("searchbox", { name: "Search foods" }), {
    target: { value: text },
  });
}

function putRiceOnThePlate() {
  api.local = [rice];
  search("rice");
  fireEvent.click(screen.getByRole("button", { name: /^Add Basmati rice, boiled/ }));
  api.local = [];
}

const barcodeButton = () => screen.getByRole("button", { name: "Look up a barcode" });

function lookUp(digits: string) {
  fireEvent.click(barcodeButton());
  fireEvent.change(screen.getByRole("textbox", { name: "Barcode number" }), {
    target: { value: digits },
  });
  fireEvent.click(screen.getByRole("button", { name: "Look up" }));
}

beforeEach(() => {
  api.local = [];
  api.barcode = { result: undefined, isLoading: false, error: null };
  onlineManager.setOnline(true);
});

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
});

describe("Create a food, from the add food dialog's empty search", () => {
  it("should offer a link to the new food page that opens in a new tab", () => {
    renderDialog();

    search("zzzz");

    const link = screen.getByRole("link", { name: "Create a food (opens in a new tab)" });
    expect(link.getAttribute("href")).toBe("/foods/new");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noreferrer");
  });

  it("should leave the dialog and the plate as they were", () => {
    renderDialog();
    putRiceOnThePlate();
    search("zzzz");

    fireEvent.click(screen.getByRole("link", { name: "Create a food (opens in a new tab)" }));

    expect(screen.getByRole("dialog", { name: "Add food" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Your plate, 1 food" })).toBeTruthy();
  });

  it("should not offer it before anything is typed", () => {
    renderDialog();

    expect(screen.queryByRole("link", { name: /^Create a food/ })).toBeNull();
  });
});

describe("a barcode typed in the add food dialog", () => {
  it("should be offered beside the search, closed to begin with", () => {
    renderDialog();

    expect(barcodeButton().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("region", { name: "Barcode lookup" })).toBeNull();
  });

  describe("a food that is found", () => {
    beforeEach(() => {
      api.barcode = {
        result: { status: "found", food: oatCakes },
        isLoading: false,
        error: null,
      };
    });

    it("should open the amount step for that food, in this dialog", () => {
      renderDialog();

      lookUp(VALID_EAN_13);

      expect(screen.getAllByRole("dialog")).toHaveLength(1);
      expect(screen.getByRole("radio", { name: "1 handful", checked: true })).toBeTruthy();
      expect(screen.queryByRole("region", { name: "Barcode lookup" })).toBeNull();
    });

    it("should put it on the plate beside the food already there when Add to plate is pressed", () => {
      renderDialog();
      putRiceOnThePlate();
      lookUp(VALID_EAN_13);

      fireEvent.click(screen.getByRole("button", { name: "Add to plate" }));

      expect(screen.getByRole("button", { name: "Your plate, 2 foods" })).toBeTruthy();
      expect(screen.getByRole("searchbox", { name: "Search foods" })).toBeTruthy();
    });
  });

  describe("a code nobody has", () => {
    beforeEach(() => {
      api.barcode = {
        result: { status: "not_found", code: VALID_EAN_13 },
        isLoading: false,
        error: null,
      };
    });

    it("should offer to create the food in a new tab, and keep the plate", () => {
      renderDialog();
      putRiceOnThePlate();

      lookUp(VALID_EAN_13);

      const link = screen.getByRole("link", {
        name: "Create food with this barcode (opens in a new tab)",
      });
      expect(link.getAttribute("target")).toBe("_blank");
      expect(screen.getByRole("button", { name: "Your plate, 1 food" })).toBeTruthy();
      expect(screen.getByText(/Your plate stays as it is\./)).toBeTruthy();
      expect(screen.queryByText(/recipe/)).toBeNull();
    });
  });

  describe("offline", () => {
    it("should switch the button off and say why", () => {
      onlineManager.setOnline(false);
      renderDialog();

      expect(barcodeButton().getAttribute("aria-disabled")).toBe("true");
      expect(screen.getByText("Looking up a barcode needs a connection.")).toBeTruthy();

      fireEvent.click(barcodeButton());

      expect(screen.queryByRole("region", { name: "Barcode lookup" })).toBeNull();
    });

    it("should hide an open panel and keep its digits for when the connection returns", async () => {
      renderDialog();
      fireEvent.click(barcodeButton());
      fireEvent.change(screen.getByRole("textbox", { name: "Barcode number" }), {
        target: { value: VALID_EAN_13 },
      });

      act(() => {
        onlineManager.setOnline(false);
      });
      await vi.waitFor(() => {
        expect(screen.queryByRole("region", { name: "Barcode lookup" })).toBeNull();
      });
      act(() => {
        onlineManager.setOnline(true);
      });

      await vi.waitFor(() => {
        expect(
          screen.getByRole<HTMLInputElement>("textbox", { name: "Barcode number" }).value,
        ).toBe(VALID_EAN_13);
      });
    });
  });
});
