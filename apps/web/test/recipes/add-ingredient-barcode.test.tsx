import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { noPlateHooks } from "../diary/noPlateHooks";
import { noFavouriteHooks } from "../favourites/noFavouriteHooks";
import { makeFood, makePortion } from "../foods/support";

import type { UseFoodByBarcodeOptions, UseFoodByBarcodeReturn } from "@keylow/api-client";
import type { RecipeIngredient } from "@keylow/core/recipes";

import { AddIngredientDialog } from "@/components/recipes/AddIngredientDialog";
import { FoodLogActionsProvider } from "@/lib/foodLogActions";

const OAT_CAKES_ID = "11111111-1111-4111-8111-111111111111";
const oatCakes = makeFood({ id: OAT_CAKES_ID, name: "Oat cakes", kcal: 430 });
const handful = makePortion({
  id: "22222222-2222-4222-8222-111111111111",
  food_id: OAT_CAKES_ID,
  label: "1 handful",
  grams: 30,
  is_default: true,
});

const VALID_EAN_13 = "5000159484695";
const BAD_CHECK_DIGIT = "5000159484696";

const idle: UseFoodByBarcodeReturn = { result: undefined, isLoading: false, error: null };

const { useFoodByBarcode, foods } = vi.hoisted(() => ({
  useFoodByBarcode:
    vi.fn<(code: string, options?: UseFoodByBarcodeOptions) => UseFoodByBarcodeReturn>(),
  foods: new Map<string, unknown>(),
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  ...noFavouriteHooks,
  ...noPlateHooks,
  useRefreshOutdatedOffFood: () => undefined,
  useProfileTimeZone: () => ({ data: "UTC" }),
  useRecentFoods: () => ({ data: [], isError: false, fetchStatus: "idle" }),
  useFoodSearch: () => ({
    local: [],
    off: [],
    isLoadingLocal: false,
    isLoadingOff: false,
    isDebouncing: false,
    offError: null,
    localError: null,
  }),
  useRecipeSearch: () => ({ recipes: [], isLoading: false, isDebouncing: false, error: null }),
  useFoodByBarcode,
  useFoodWithPortions: (id: string) => {
    const found = foods.get(id);
    return found === undefined ? { status: "notFound" } : { status: "ready", ...found };
  },
  useLogFood: () => ({ mutateAsync: vi.fn() }),
  useDeleteEntry: () => ({ mutateAsync: vi.fn() }),
  useLogRecipeServing: () => ({ mutateAsync: vi.fn() }),
  useSupabase: () => ({}),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/recipes/new",
}));

function renderDialog() {
  const onAdd = vi.fn<(ingredient: RecipeIngredient) => void>();
  render(
    <FoodLogActionsProvider>
      <AddIngredientDialog opener={null} onClose={vi.fn()} onAdd={onAdd} />
    </FoodLogActionsProvider>,
  );
  return { onAdd };
}

const barcodeButton = () => screen.getByRole("button", { name: "Look up a barcode" });

function openPanel() {
  fireEvent.click(barcodeButton());
}

function lookUp(digits: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Barcode number" }), {
    target: { value: digits },
  });
  fireEvent.click(screen.getByRole("button", { name: "Look up" }));
}

describe("a barcode typed in the Add ingredient dialog", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    onlineManager.setOnline(true);
    useFoodByBarcode.mockReturnValue(idle);
    foods.clear();
    foods.set(OAT_CAKES_ID, { food: oatCakes, portions: [handful] });
  });

  afterEach(() => {
    cleanup();
    onlineManager.setOnline(true);
  });

  describe("the button", () => {
    it("should end the ingredient search field, closed to begin with", () => {
      renderDialog();

      expect(barcodeButton().getAttribute("aria-expanded")).toBe("false");
      expect(screen.queryByRole("region", { name: "Barcode lookup" })).toBeNull();
    });

    it("should open the panel under the field with the cursor in the digits", () => {
      renderDialog();

      openPanel();

      expect(barcodeButton().getAttribute("aria-expanded")).toBe("true");
      expect(screen.getByRole("region", { name: "Barcode lookup" })).toBeTruthy();
      expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Barcode number" }));
    });

    it("should close the panel again and put the cursor back in the search", () => {
      renderDialog();
      openPanel();

      fireEvent.click(screen.getByRole("button", { name: "Close barcode lookup" }));

      expect(screen.queryByRole("region", { name: "Barcode lookup" })).toBeNull();
      expect(document.activeElement).toBe(screen.getByRole("searchbox", { name: "Search foods" }));
    });
  });

  describe("a code that is not a barcode", () => {
    it("should explain itself beside the field and look nothing up", () => {
      renderDialog();
      openPanel();

      lookUp(BAD_CHECK_DIGIT);

      expect(screen.getByRole("alert").textContent).toBe(
        "The check digit is wrong, so check the digits and try again",
      );
      expect(useFoodByBarcode).toHaveBeenLastCalledWith("", { enabled: false });
      expect(screen.queryByRole("textbox", { name: /^Amount/ })).toBeNull();
    });
  });

  describe("a food that is found", () => {
    beforeEach(() => {
      useFoodByBarcode.mockReturnValue({
        result: { status: "found", food: oatCakes },
        isLoading: false,
        error: null,
      });
    });

    it("should open the amount step for that food, not the diary's Add food dialog", () => {
      renderDialog();
      openPanel();

      lookUp(VALID_EAN_13);

      expect(screen.getAllByRole("dialog")).toHaveLength(1);
      expect(screen.getByRole("dialog", { name: "Add ingredient" })).toBeTruthy();
      expect(screen.getByRole("radio", { name: "1 handful", checked: true })).toBeTruthy();
      expect(screen.queryByText("Now")).toBeNull();
      expect(screen.queryByRole("region", { name: "Barcode lookup" })).toBeNull();
    });

    it("should add the food to the recipe at the amount chosen", () => {
      const { onAdd } = renderDialog();
      openPanel();
      lookUp(VALID_EAN_13);

      fireEvent.change(screen.getByRole("textbox", { name: /^Amount/ }), {
        target: { value: "3" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Add to recipe" }));

      expect(onAdd).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ food_id: OAT_CAKES_ID, quantity: 3, unit: "portion" }),
      );
    });

    it("should open the amount step once when Look up is pressed twice", () => {
      renderDialog();
      openPanel();
      fireEvent.change(screen.getByRole("textbox", { name: "Barcode number" }), {
        target: { value: VALID_EAN_13 },
      });
      const lookUpButton = screen.getByRole("button", { name: "Look up" });

      fireEvent.click(lookUpButton);
      fireEvent.click(lookUpButton);

      expect(screen.getAllByRole("textbox", { name: /^Amount/ })).toHaveLength(1);
    });

    it("should put the cursor in the amount", () => {
      renderDialog();
      openPanel();

      lookUp(VALID_EAN_13);

      expect(document.activeElement).toBe(screen.getByRole("textbox", { name: /^Amount/ }));
    });

    it("should go back to the search with the panel closed", () => {
      renderDialog();
      openPanel();
      lookUp(VALID_EAN_13);

      fireEvent.click(screen.getByRole("button", { name: "Results" }));

      expect(screen.getByRole("searchbox", { name: "Search foods" })).toBeTruthy();
      expect(barcodeButton().getAttribute("aria-expanded")).toBe("false");
    });

    it("should hold the Add button back for a food that needs review, as a search pick does", () => {
      foods.set(OAT_CAKES_ID, { food: { ...oatCakes, fat_g: null }, portions: [handful] });
      renderDialog();
      openPanel();

      lookUp(VALID_EAN_13);

      expect(screen.getByRole("button", { name: "Add to recipe" }).hasAttribute("disabled")).toBe(
        true,
      );
      expect(
        screen.getByRole("link", { name: "Copy to your foods (opens in a new tab)" }),
      ).toBeTruthy();
    });
  });

  describe("a code nobody has", () => {
    beforeEach(() => {
      useFoodByBarcode.mockReturnValue({
        result: { status: "not_found", code: VALID_EAN_13 },
        isLoading: false,
        error: null,
      });
    });

    it("should say so and keep the recipe: the way on opens in a new tab", () => {
      renderDialog();
      openPanel();

      lookUp(VALID_EAN_13);

      expect(screen.getByText("Not in Ki-Lo or Open Food Facts")).toBeTruthy();
      const link = screen.getByRole("link", {
        name: "Create food with this barcode (opens in a new tab)",
      });
      expect(link.getAttribute("href")).toBe(`/foods/new?barcode=${VALID_EAN_13}&for=recipe`);
      expect(link.getAttribute("target")).toBe("_blank");
      expect(
        screen.getByText(
          "Create the food with this barcode in a new tab, then search for it here. Your recipe stays as it is.",
        ),
      ).toBeTruthy();
    });
  });

  describe("offline", () => {
    it("should switch the button off and say why", () => {
      onlineManager.setOnline(false);
      renderDialog();

      expect(barcodeButton().getAttribute("aria-disabled")).toBe("true");
      expect(screen.getByText("Looking up a barcode needs a connection.")).toBeTruthy();

      openPanel();

      expect(screen.queryByRole("region", { name: "Barcode lookup" })).toBeNull();
    });

    it("should say the button's panel is closed once the panel is hidden", async () => {
      renderDialog();
      openPanel();
      expect(barcodeButton().getAttribute("aria-expanded")).toBe("true");

      act(() => {
        onlineManager.setOnline(false);
      });

      await vi.waitFor(() => {
        expect(barcodeButton().getAttribute("aria-expanded")).toBe("false");
      });
    });

    it("should move the cursor to the search when the panel it was in goes away", async () => {
      renderDialog();
      openPanel();
      expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Barcode number" }));

      act(() => {
        onlineManager.setOnline(false);
      });

      await vi.waitFor(() => {
        expect(document.activeElement).toBe(
          screen.getByRole("searchbox", { name: "Search foods" }),
        );
      });
    });

    it("should hide an open panel and keep the digits typed in it for when the connection returns", () => {
      renderDialog();
      openPanel();
      fireEvent.change(screen.getByRole("textbox", { name: "Barcode number" }), {
        target: { value: VALID_EAN_13 },
      });

      onlineManager.setOnline(false);
      // The store tells the screen on the next tick.
      return vi
        .waitFor(() => {
          expect(screen.queryByRole("region", { name: "Barcode lookup" })).toBeNull();
          expect(screen.getByText("Looking up a barcode needs a connection.")).toBeTruthy();

          onlineManager.setOnline(true);
        })
        .then(() =>
          vi.waitFor(() => {
            expect(
              screen.getByRole<HTMLInputElement>("textbox", { name: "Barcode number" }).value,
            ).toBe(VALID_EAN_13);
            expect(screen.queryByText("Looking up a barcode needs a connection.")).toBeNull();
          }),
        );
    });
  });
});
