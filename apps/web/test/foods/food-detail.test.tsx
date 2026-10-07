import { DATA_SOURCE_ATTRIBUTION } from "@keylow/core/foods";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeFood, makePortion } from "./support";

import { FoodDetail } from "@/components/foods/FoodDetail";

const { useFood, useFoodPortions } = vi.hoisted(() => ({
  useFood: vi.fn(),
  useFoodPortions: vi.fn(),
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useFood,
  useFoodPortions,
}));

const loaded = <Data,>(data: Data) => ({ data, isPending: false, isError: false, error: null });
const pending = { data: undefined, isPending: true, isError: false, error: null };

function showFood(food = makeFood(), portions = [makePortion()]) {
  useFood.mockReturnValue(loaded(food));
  useFoodPortions.mockReturnValue(loaded(portions));
  render(<FoodDetail id={food.id} />);
}

describe("FoodDetail", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("loading", () => {
    it("should load the food and its portions by the id it is given", () => {
      useFood.mockReturnValue(pending);
      useFoodPortions.mockReturnValue(pending);

      render(<FoodDetail id="food-1" />);

      expect(useFood).toHaveBeenCalledWith("food-1");
      expect(useFoodPortions).toHaveBeenCalledWith("food-1");
    });

    it("should say it is loading while either query is pending", () => {
      useFood.mockReturnValue(loaded(makeFood()));
      useFoodPortions.mockReturnValue(pending);

      render(<FoodDetail id="food-1" />);

      expect(screen.getByRole("status").textContent).toBe("Loading food");
      expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
    });

    it("should say the food was not found when it is not visible to the user", () => {
      useFood.mockReturnValue(loaded(null));
      useFoodPortions.mockReturnValue(loaded([]));

      render(<FoodDetail id="food-1" />);

      expect(screen.getByRole("heading", { name: "Food not found" })).toBeTruthy();
    });

    it("should show a failure to load the food in an alert", () => {
      useFood.mockReturnValue({
        data: undefined,
        isPending: false,
        isError: true,
        error: new Error("Could not load the food: offline"),
      });
      useFoodPortions.mockReturnValue(loaded([]));

      render(<FoodDetail id="food-1" />);

      expect(screen.getByRole("alert").textContent).toContain("Could not load the food: offline");
    });

    it("should show a failure to load the portions in an alert", () => {
      useFood.mockReturnValue(loaded(makeFood()));
      useFoodPortions.mockReturnValue({
        data: undefined,
        isPending: false,
        isError: true,
        error: new Error("Could not load the portions: offline"),
      });

      render(<FoodDetail id="food-1" />);

      expect(screen.getByRole("alert").textContent).toContain(
        "Could not load the portions: offline",
      );
    });

    it("should keep showing the food when a background refresh fails", () => {
      useFood.mockReturnValue({
        data: makeFood({ name: "Oat cakes" }),
        isPending: false,
        isError: true,
        error: new Error("Could not load the food: offline"),
      });
      useFoodPortions.mockReturnValue(loaded([]));

      render(<FoodDetail id="food-1" />);

      expect(screen.getByRole("heading", { name: "Oat cakes" })).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("going back", () => {
    it("should link back to the food search above the heading", () => {
      showFood();

      const back = screen.getByRole("link", { name: "Back to foods" });
      expect(back.getAttribute("href")).toBe("/foods");
      const heading = screen.getByRole("heading", { level: 1 });
      expect(back.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  describe("what the food is", () => {
    it("should show the name as the page heading with the brand, source and basis", () => {
      showFood(makeFood({ name: "Chicken breast", brand: "Tesco", source: "off" }));

      expect(screen.getByRole("heading", { level: 1, name: "Chicken breast" })).toBeTruthy();
      expect(screen.getByText("Tesco")).toBeTruthy();
      expect(screen.getByText("Open Food Facts")).toBeTruthy();
      expect(screen.getByText("Per 100 g")).toBeTruthy();
    });

    it("should name each kind of source in plain words", () => {
      showFood(makeFood({ source: "cofid" }));
      expect(screen.getByText("CoFID")).toBeTruthy();
      cleanup();

      showFood(makeFood({ source: "user" }));
      expect(screen.getByText("Own food")).toBeTruthy();
    });

    it("should give a drink's basis per 100 ml", () => {
      showFood(makeFood({ basis: "per_100ml" }));

      expect(screen.getByText("Per 100 ml")).toBeTruthy();
    });
  });

  describe("the nutrient table", () => {
    it("should show energy, protein, fat, carbohydrate and fibre with their units", () => {
      showFood(makeFood({ kcal: 430, protein_g: 10, fat_g: 18.25, carbs_g: 56, fibre_g: 7.5 }));

      const table = screen.getByRole("table", { name: "Nutrients per 100 g" });
      const expected = {
        Energy: "430 kcal",
        Protein: "10 g",
        Fat: "18.3 g",
        Carbohydrate: "56 g",
        Fibre: "7.5 g",
      };
      for (const [nutrient, amount] of Object.entries(expected)) {
        const row = within(table).getByRole("row", { name: new RegExp(nutrient) });
        expect(within(row).getByRole("cell").textContent).toBe(amount);
      }
    });

    it("should say a nutrient is not given, never zero, when it is null", () => {
      showFood(makeFood({ fibre_g: null, protein_g: null }));

      for (const nutrient of ["Fibre", "Protein"]) {
        const row = screen.getByRole("row", { name: new RegExp(nutrient) });
        expect(within(row).getByRole("cell").textContent).toBe("not given");
      }
    });

    it("should show a real zero as zero", () => {
      showFood(makeFood({ fat_g: 0 }));

      const row = screen.getByRole("row", { name: /Fat/ });
      expect(within(row).getByRole("cell").textContent).toBe("0 g");
    });

    it("should head the table per 100 ml for a drink", () => {
      showFood(makeFood({ basis: "per_100ml" }));

      expect(screen.getByRole("table", { name: "Nutrients per 100 ml" })).toBeTruthy();
    });

    it("should note that carbohydrate is the US total when it could not be converted", () => {
      showFood(makeFood({ quality: { carbs_convention: "us_total" } }));

      expect(screen.getByText(/US total/)).toBeTruthy();
    });

    it("should add no US note otherwise", () => {
      showFood(makeFood({ quality: { carbs_convention: "eu" } }));

      expect(screen.queryByText(/US total/)).toBeNull();
    });
  });

  describe("portions", () => {
    it("should list each portion with its amount and mark the default", () => {
      showFood(makeFood(), [
        makePortion({ id: "p1", label: "Slice", grams: 30, is_default: true }),
        makePortion({ id: "p2", label: "Handful", grams: 12.5, is_default: false }),
      ]);

      expect(screen.getByRole("heading", { name: "Portions" })).toBeTruthy();
      const [slice, handful] = screen.getAllByRole("listitem");
      expect(slice?.textContent).toContain("Slice");
      expect(slice?.textContent).toContain("30 g");
      expect(slice?.textContent).toContain("Default");
      expect(handful?.textContent).toContain("12.5 g");
      expect(handful?.textContent).not.toContain("Default");
    });

    it("should give the amount in ml for a drink's portion", () => {
      showFood(makeFood({ basis: "per_100ml" }), [
        makePortion({ label: "Glass", grams: null, ml: 250 }),
      ]);

      expect(screen.getByRole("listitem").textContent).toContain("250 ml");
    });

    it("should show no portions section when the food has none", () => {
      showFood(makeFood(), []);

      expect(screen.queryByRole("heading", { name: "Portions" })).toBeNull();
    });
  });

  describe("attribution", () => {
    it("should credit Open Food Facts under its licence for one of its products", () => {
      showFood(makeFood({ source: "off" }));

      expect(
        screen.getByText("Data from Open Food Facts, available under the Open Database Licence."),
      ).toBeTruthy();
    });

    it("should credit the CoFID dataset under the Open Government Licence", () => {
      showFood(makeFood({ source: "cofid" }));

      expect(screen.getByText(/Open Government Licence v3.0/)).toBeTruthy();
    });

    it("should link to Open Food Facts under the credit", () => {
      showFood(makeFood({ source: "off" }));

      const link = screen.getByRole("link", { name: "https://world.openfoodfacts.org" });
      expect(link.getAttribute("href")).toBe("https://world.openfoodfacts.org");
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noreferrer");
    });

    it("should link to the CoFID dataset under the credit", () => {
      showFood(makeFood({ source: "cofid" }));

      expect(
        screen.getByRole("link", { name: DATA_SOURCE_ATTRIBUTION.cofid.url }).getAttribute("href"),
      ).toBe(DATA_SOURCE_ATTRIBUTION.cofid.url);
    });

    it("should link to no source for a food the user made", () => {
      showFood(makeFood({ source: "user" }));

      expect(screen.queryByRole("link", { name: /^https?:/ })).toBeNull();
    });

    it("should credit nobody for a food the user made", () => {
      showFood(makeFood({ source: "user" }));

      expect(screen.queryByText(/licen[cs]ed|Licence/)).toBeNull();
    });
  });

  describe("editing", () => {
    it("should offer to edit the user's own food", () => {
      showFood(makeFood({ id: "own-food", source: "user" }));

      expect(screen.getByRole("link", { name: "Edit" }).getAttribute("href")).toBe(
        "/foods/own-food/edit",
      );
    });

    it("should not offer to edit a shared food", () => {
      showFood(makeFood({ source: "off" }));

      expect(screen.queryByRole("link", { name: "Edit" })).toBeNull();
    });
  });

  describe("the suspect gate", () => {
    const suspect = { suspect: true, fields_missing: ["protein_g", "fibre_g"] };

    it("should list the missing values in plain words under a heading", () => {
      showFood(makeFood({ source: "off", protein_g: null, fibre_g: null, quality: suspect }));

      expect(screen.getByRole("heading", { name: "Some values are missing" })).toBeTruthy();
      expect(screen.getByText("Not given by the source: protein and fibre.")).toBeTruthy();
    });

    it("should name every kind of value in words", () => {
      showFood(
        makeFood({
          source: "off",
          quality: {
            suspect: true,
            fields_missing: ["kcal", "protein_g", "fat_g", "carbs_g", "fibre_g"],
          },
        }),
      );

      expect(
        screen.getByText("Not given by the source: energy, protein, fat, carbohydrate and fibre."),
      ).toBeTruthy();
    });

    it("should offer one action, to review and save it as the user's own food", () => {
      showFood(makeFood({ id: "suspect-food", source: "off", quality: suspect }));

      const review = screen.getByRole("link", { name: "Review and save as my food" });
      expect(review.getAttribute("href")).toBe("/foods/new?from=suspect-food");
      expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
        "Back to foods",
        "Review and save as my food",
        "https://world.openfoodfacts.org",
      ]);
      expect(screen.queryByRole("button")).toBeNull();
    });

    it("should show no review block for a food that is not suspect", () => {
      showFood(makeFood({ source: "off", quality: { suspect: false } }));

      expect(screen.queryByRole("heading", { name: "Some values are missing" })).toBeNull();
      expect(screen.queryByRole("link", { name: "Review and save as my food" })).toBeNull();
      expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
        "Back to foods",
        "https://world.openfoodfacts.org",
      ]);
      expect(screen.queryByRole("button")).toBeNull();
    });
  });
});
