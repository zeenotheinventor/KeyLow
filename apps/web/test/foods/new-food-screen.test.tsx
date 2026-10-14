import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeFood, makePortion } from "./support";

import type { CreatedFood, FoodWithPortionsState } from "@keylow/api-client";

import { NewFoodScreen } from "@/app/(dashboard)/foods/new/NewFoodScreen";

const { searchParameters, useFoodWithPortions, createFood, updateFood, replace } = vi.hoisted(
  () => ({
    searchParameters: { current: new URLSearchParams() },
    useFoodWithPortions: vi.fn<(id: string) => FoodWithPortionsState>(),
    createFood: vi.fn<(input: unknown) => Promise<CreatedFood>>(),
    updateFood: vi.fn(),
    replace: vi.fn<(href: string) => void>(),
  }),
);

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useFoodWithPortions,
  useCreateFood: () => ({ mutateAsync: createFood }),
  useUpdateFood: () => ({ mutateAsync: updateFood }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  useSearchParams: () => searchParameters.current,
}));

const SOURCE_FOOD_ID = "55555555-5555-4555-8555-555555555555";

const energy = /^Energy\s*\(kcal\)$/;
const protein = /^Protein\s*\(g\)$/;
const carbohydrate = /^Carbohydrate\s*\(g\)$/;
const fat = /^Fat\s*\(g\)$/;
const fibre = /^Fibre \(optional\)\s*\(g\)$/;
const portionAmount = (position: number) =>
  new RegExp(`^Amount for portion ${String(position)}\\s*\\(g\\)$`);
const CREATED_FOOD_ID = "66666666-6666-4666-8666-666666666666";

describe("NewFoodScreen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    searchParameters.current = new URLSearchParams();
  });

  afterEach(() => {
    cleanup();
  });

  it("should show an empty create form under a heading", () => {
    render(<NewFoodScreen />);

    expect(screen.getByRole("heading", { level: 1, name: "New food" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Name" })).toHaveProperty("value", "");
    expect(screen.getByRole("textbox", { name: "Barcode" })).toHaveProperty("readOnly", false);
  });

  it("should offer a Back link to the foods page above the heading", () => {
    render(<NewFoodScreen />);

    const back = screen.getByRole("link", { name: "Back" });
    expect(back.getAttribute("href")).toBe("/foods");
    expect(
      back.compareDocumentPosition(screen.getByRole("heading", { level: 1 })) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("should offer Create food and Cancel", () => {
    render(<NewFoodScreen />);

    expect(screen.getByRole("button", { name: "Create food" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Cancel" }).getAttribute("href")).toBe("/foods");
  });

  it("should pre-fill the barcode from the barcode query parameter and lock it", () => {
    searchParameters.current = new URLSearchParams({ barcode: "5000159484695" });

    render(<NewFoodScreen />);

    const barcode = screen.getByRole("textbox", {
      name: "Barcode",
      description: "Filled in from the barcode you entered",
    });
    expect(barcode).toHaveProperty("value", "5000159484695");
    expect(barcode).toHaveProperty("readOnly", true);
  });

  it("should ignore a blank barcode query parameter", () => {
    searchParameters.current = new URLSearchParams({ barcode: "" });

    render(<NewFoodScreen />);

    expect(screen.getByRole("textbox", { name: "Barcode" })).toHaveProperty("readOnly", false);
  });

  describe("starting from an existing food", () => {
    const suspectFood = makeFood({
      id: SOURCE_FOOD_ID,
      source: "off",
      owner_id: null,
      name: "Chicken slices",
      brand: "Tesco",
      barcode: "5000159484695",
      basis: "per_100g",
      kcal: 105,
      protein_g: null,
      fat_g: 1.2,
      carbs_g: 0.5,
      fibre_g: 0.3,
      quality: { suspect: true, fields_missing: ["protein_g"] },
    });

    function copyFromSuspectFood(otherParameters: Record<string, string> = {}) {
      searchParameters.current = new URLSearchParams({ from: SOURCE_FOOD_ID, ...otherParameters });
      useFoodWithPortions.mockReturnValue({
        status: "ready",
        food: suspectFood,
        portions: [
          makePortion({ id: "p1", label: "Slice", grams: 30, is_default: true }),
          makePortion({ id: "p2", label: "Pack", grams: 200, is_default: false }),
        ],
      });
      createFood.mockResolvedValue({
        food: makeFood({ id: CREATED_FOOD_ID }),
        portions: [],
      });
      render(<NewFoodScreen />);
    }

    it("should load the food and its portions by the id in the from parameter", () => {
      searchParameters.current = new URLSearchParams({ from: SOURCE_FOOD_ID });
      useFoodWithPortions.mockReturnValue({ status: "loading" });

      render(<NewFoodScreen />);

      expect(useFoodWithPortions).toHaveBeenCalledWith(SOURCE_FOOD_ID);
    });

    it("should say it is loading and show no form while the food loads", () => {
      searchParameters.current = new URLSearchParams({ from: SOURCE_FOOD_ID });
      useFoodWithPortions.mockReturnValue({ status: "loading" });

      render(<NewFoodScreen />);

      expect(screen.getByRole("status", { name: "Loading food" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Back to foods" }).getAttribute("href")).toBe(
        "/foods",
      );
      expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
    });

    it("should say the food was not found and show no form", () => {
      searchParameters.current = new URLSearchParams({ from: SOURCE_FOOD_ID });
      useFoodWithPortions.mockReturnValue({ status: "notFound" });

      render(<NewFoodScreen />);

      expect(screen.getByRole("heading", { name: "Food not found" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Back to foods" })).toBeTruthy();
      expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
    });

    it("should show a failure to load the food in an alert, without the raw text of the failure", () => {
      searchParameters.current = new URLSearchParams({ from: SOURCE_FOOD_ID });
      useFoodWithPortions.mockReturnValue({
        status: "error",
        debugMessage: "Could not load the food: offline",
      });

      render(<NewFoodScreen />);

      expect(screen.getByRole("heading", { name: "Food not loaded" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Back to foods" })).toBeTruthy();
      expect(screen.queryByText(/offline/)).toBeNull();
      expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
    });

    it("should head the screen Copy to your foods and say what saving does", () => {
      copyFromSuspectFood();

      expect(screen.getByRole("heading", { level: 1, name: "Copy to your foods" })).toBeTruthy();
      expect(
        screen.getByText(
          "Check each value and fill in the ones that are blank. Saving adds a food of your own and leaves the original as it is.",
        ),
      ).toBeTruthy();
    });

    it("should offer a Back link to the foods page, Save to your foods and a Cancel link to the food", () => {
      copyFromSuspectFood();

      expect(screen.getByRole("link", { name: "Back" }).getAttribute("href")).toBe("/foods");
      expect(screen.getByRole("button", { name: "Save to your foods" })).toBeTruthy();
      expect(screen.getByRole("link", { name: "Cancel" }).getAttribute("href")).toBe(
        `/foods/${SOURCE_FOOD_ID}`,
      );
    });

    it("should pre-fill the details, every nutrient that is present and the portions", () => {
      copyFromSuspectFood();

      expect(screen.getByRole("textbox", { name: "Name" })).toHaveProperty(
        "value",
        "Chicken slices",
      );
      expect(screen.getByRole("textbox", { name: "Brand" })).toHaveProperty("value", "Tesco");
      expect(screen.getByRole("radio", { name: "Per 100 g" })).toHaveProperty("checked", true);
      expect(screen.getByRole("textbox", { name: energy })).toHaveProperty("value", "105");
      expect(screen.getByRole("textbox", { name: fat })).toHaveProperty("value", "1.2");
      expect(screen.getByRole("textbox", { name: carbohydrate })).toHaveProperty("value", "0.5");
      expect(screen.getByRole("textbox", { name: fibre })).toHaveProperty("value", "0.3");
      expect(screen.getByRole("textbox", { name: "Portion 1 label" })).toHaveProperty(
        "value",
        "Slice",
      );
      expect(screen.getByRole("textbox", { name: portionAmount(1) })).toHaveProperty("value", "30");
      expect(screen.getByRole("textbox", { name: "Portion 2 label" })).toHaveProperty(
        "value",
        "Pack",
      );
    });

    it("should mark every required field of the copy form with aria-required", () => {
      copyFromSuspectFood();

      for (const name of ["Name", energy, protein, carbohydrate, fat]) {
        expect(screen.getByRole("textbox", { name }).getAttribute("aria-required")).toBe("true");
      }
    });

    it("should keep the barcode and lock it because it is valid", () => {
      copyFromSuspectFood();

      const barcode = screen.getByRole("textbox", {
        name: "Barcode",
        description: "Kept from the product you are copying",
      });
      expect(barcode).toHaveProperty("value", "5000159484695");
      expect(barcode).toHaveProperty("readOnly", true);
    });

    it("should leave a missing nutrient blank, say it is not given and ask for it before saving", () => {
      copyFromSuspectFood();
      expect(
        screen.getByRole("textbox", { name: protein, description: "Not given by the source" }),
      ).toHaveProperty("value", "");

      fireEvent.click(screen.getByRole("button", { name: "Save to your foods" }));

      expect(createFood).not.toHaveBeenCalled();
      expect(
        screen.getByRole("textbox", { name: protein, description: "Protein is required" }),
      ).toBeTruthy();
      expect(screen.getByRole("textbox", { name: protein }).getAttribute("aria-invalid")).toBe(
        "true",
      );
    });

    it("should create a new food once with the kept barcode and open it, never updating the original", async () => {
      copyFromSuspectFood();
      fireEvent.change(screen.getByRole("textbox", { name: protein }), {
        target: { value: "23" },
      });

      fireEvent.click(screen.getByRole("button", { name: "Save to your foods" }));

      await waitFor(() => {
        expect(replace).toHaveBeenCalledWith(`/foods/${CREATED_FOOD_ID}`);
      });
      expect(createFood).toHaveBeenCalledTimes(1);
      expect(createFood).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Chicken slices",
          barcode: "5000159484695",
          protein_g: 23,
          portions: [
            { label: "Slice", grams: 30, isDefault: true },
            { label: "Pack", grams: 200, isDefault: false },
          ],
        }),
      );
      expect(updateFood).not.toHaveBeenCalled();
    });

    describe("when the carbohydrate of the food included fibre", () => {
      const usFood = makeFood({
        id: SOURCE_FOOD_ID,
        source: "off",
        owner_id: null,
        name: "American granola",
        kcal: 400,
        protein_g: 9,
        fat_g: 12,
        carbs_g: 62,
        fibre_g: 6,
        quality: { carbs_convention: "us_total" },
      });

      beforeEach(() => {
        searchParameters.current = new URLSearchParams({ from: SOURCE_FOOD_ID });
        useFoodWithPortions.mockReturnValue({ status: "ready", food: usFood, portions: [] });
        createFood.mockResolvedValue({ food: makeFood({ id: CREATED_FOOD_ID }), portions: [] });
        render(<NewFoodScreen />);
      });

      it("should leave the carbohydrate blank and keep the fibre", () => {
        expect(screen.getByRole("textbox", { name: carbohydrate })).toHaveProperty("value", "");
        expect(screen.getByRole("textbox", { name: fibre })).toHaveProperty("value", "6");
        expect(screen.getByRole("textbox", { name: energy })).toHaveProperty("value", "400");
      });

      it("should tell the user to enter the carbohydrate without fibre", () => {
        expect(
          screen.getByText(
            "This product's carbohydrate included fibre. Enter the carbohydrate without fibre.",
          ),
        ).toBeTruthy();
      });

      it("should require the carbohydrate before saving rather than converting it", () => {
        fireEvent.click(screen.getByRole("button", { name: "Save to your foods" }));

        expect(createFood).not.toHaveBeenCalled();
        expect(
          screen.getByRole("textbox", {
            name: carbohydrate,
            description: "Carbohydrate is required",
          }),
        ).toBeTruthy();
      });
    });

    it("should show no fibre note when the carbohydrate was not a US total", () => {
      copyFromSuspectFood();

      expect(screen.queryByText(/included fibre/)).toBeNull();
    });

    it("should use the food to copy and ignore a barcode parameter beside it", () => {
      copyFromSuspectFood({ barcode: "5000159484701" });

      expect(screen.getByRole("textbox", { name: "Barcode" })).toHaveProperty(
        "value",
        "5000159484695",
      );
    });

    it("should show the plain new food form when the from parameter is not a food id", () => {
      searchParameters.current = new URLSearchParams({ from: "not-a-food-id" });

      render(<NewFoodScreen />);

      expect(screen.getByRole("heading", { name: "New food" })).toBeTruthy();
      expect(useFoodWithPortions).not.toHaveBeenCalled();
    });

    it("should ignore a blank from parameter", () => {
      searchParameters.current = new URLSearchParams({ from: "" });

      render(<NewFoodScreen />);

      expect(screen.getByRole("heading", { name: "New food" })).toBeTruthy();
      expect(useFoodWithPortions).not.toHaveBeenCalled();
    });
  });
});
