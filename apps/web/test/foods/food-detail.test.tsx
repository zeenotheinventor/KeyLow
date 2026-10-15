import { DATA_SOURCE_ATTRIBUTION } from "@keylow/core/foods";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeFood, makePortion } from "./support";

import type { FoodWithPortionsState } from "@keylow/api-client";

import { FoodDetail } from "@/components/foods/FoodDetail";

const { useFoodWithPortions } = vi.hoisted(() => ({
  useFoodWithPortions: vi.fn<(id: string) => FoodWithPortionsState>(),
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useFoodWithPortions,
}));

const RAW_FAILURE = "Could not load the food: JWT expired for role authenticated";

function showFood(food = makeFood(), portions = [makePortion()]) {
  useFoodWithPortions.mockReturnValue({ status: "ready", food, portions });
  render(<FoodDetail id={food.id} />);
}

function showState(state: FoodWithPortionsState) {
  useFoodWithPortions.mockReturnValue(state);
  render(<FoodDetail id="food-1" />);
}

const hero = () => screen.getByRole("region", { name: "Energy and macros" });

describe("FoodDetail", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  describe("loading", () => {
    it("should load the food and its portions by the id it is given", () => {
      showState({ status: "loading" });

      expect(useFoodWithPortions).toHaveBeenCalledWith("food-1");
    });

    it("should announce that the food is loading and show no heading", () => {
      showState({ status: "loading" });

      expect(screen.getByRole("status", { name: "Loading food" })).toBeTruthy();
      expect(screen.queryByRole("heading")).toBeNull();
    });

    it("should write Loading food under the placeholders once they show", () => {
      vi.useFakeTimers();
      showState({ status: "loading" });

      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.getByRole("status", { name: "Loading food" }).textContent).toBe("Loading food");
    });

    it("should keep the way back to the foods page", () => {
      showState({ status: "loading" });

      expect(screen.getByRole("link", { name: "Back to foods" }).getAttribute("href")).toBe(
        "/foods",
      );
    });
  });

  describe("not found", () => {
    it("should say the food was not found when it is not visible to the user", () => {
      showState({ status: "notFound" });

      expect(screen.getByRole("heading", { level: 1, name: "Food not found" })).toBeTruthy();
      expect(screen.getByText("This food does not exist, or you cannot see it.")).toBeTruthy();
    });

    it("should keep the way back to the foods page", () => {
      showState({ status: "notFound" });

      expect(screen.getByRole("link", { name: "Back to foods" })).toBeTruthy();
    });
  });

  describe("a failure to load", () => {
    it("should say the food was not loaded in an alert", () => {
      showState({ status: "error", debugMessage: RAW_FAILURE });

      const alert = screen.getByRole("alert");
      expect(
        within(alert).getByRole("heading", { level: 1, name: "Food not loaded" }),
      ).toBeTruthy();
      expect(
        within(alert).getByText("The food could not be loaded. Try again later."),
      ).toBeTruthy();
    });

    it("should never show the raw text of the failure", () => {
      showState({ status: "error", debugMessage: RAW_FAILURE });

      expect(screen.queryByText(/JWT/)).toBeNull();
      expect(screen.queryByText(/Could not load the food:/)).toBeNull();
    });

    it("should offer no retry, because the design draws none", () => {
      showState({ status: "error", debugMessage: RAW_FAILURE });

      expect(screen.queryByRole("button")).toBeNull();
    });

    it("should keep the way back to the foods page", () => {
      showState({ status: "error", debugMessage: RAW_FAILURE });

      expect(screen.getByRole("link", { name: "Back to foods" })).toBeTruthy();
    });
  });

  describe("going back", () => {
    it("should link back to the foods page above the heading", () => {
      showFood();

      const back = screen.getByRole("link", { name: "Back to foods" });
      expect(back.getAttribute("href")).toBe("/foods");
      const heading = screen.getByRole("heading", { level: 1 });
      expect(back.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  });

  describe("what the food is", () => {
    it("should show the name as the page heading with the brand beside the source", () => {
      showFood(makeFood({ name: "Chicken breast", brand: "Tesco", source: "off" }));

      expect(screen.getByRole("heading", { level: 1, name: "Chicken breast" })).toBeTruthy();
      expect(screen.getByText("Tesco")).toBeTruthy();
      expect(screen.getByText("Open Food Facts")).toBeTruthy();
    });

    it("should show no brand for a food without one", () => {
      showFood(makeFood({ name: "Oat cakes", brand: null }));

      expect(screen.getByRole("heading", { level: 1 }).parentElement?.textContent).toBe(
        "Oat cakesYours",
      );
    });

    it("should name each kind of source in plain words", () => {
      showFood(makeFood({ source: "cofid" }));
      expect(screen.getByText("UK CoFID")).toBeTruthy();
      cleanup();

      showFood(makeFood({ source: "user" }));
      expect(screen.getByText("Yours")).toBeTruthy();
    });
  });

  describe("the energy and macros card", () => {
    it("should lead with the energy as a large number, then the basis", () => {
      showFood(makeFood({ kcal: 148 }));

      expect(within(hero()).getByText("148")).toBeTruthy();
      expect(within(hero()).getByText("kcal")).toBeTruthy();
      expect(within(hero()).getByText("per 100 g")).toBeTruthy();
    });

    it("should group a thousand calories with a comma", () => {
      showFood(makeFood({ kcal: 2480 }));

      expect(within(hero()).getByText("2,480")).toBeTruthy();
    });

    it("should give a drink's basis per 100 ml", () => {
      showFood(makeFood({ basis: "per_100ml" }));

      expect(within(hero()).getByText("per 100 ml")).toBeTruthy();
    });

    it("should show Protein, Carbs and Fat tiles in that order", () => {
      showFood(makeFood());

      expect(
        within(hero())
          .getAllByRole("term")
          .map((term) => term.textContent),
      ).toEqual(["Protein", "Carbs", "Fat"]);
    });

    it("should show each macro in grams with its share of the energy", () => {
      showFood(
        makeFood({
          kcal: 148,
          protein_g: 32,
          carbs_g: 0,
          fat_g: 2.2,
          quality: {},
          source: "cofid",
        }),
      );

      expect(
        within(hero())
          .getAllByRole("definition")
          .map((definition) => definition.textContent),
      ).toEqual(["32 g", "86 % of energy", "0 g", "0 % of energy", "2.2 g", "13 % of energy"]);
    });

    it("should say not given for a macro the source does not state, with no share", () => {
      showFood(makeFood({ kcal: 200, protein_g: null, carbs_g: 20, fat_g: 10 }));

      expect(
        within(hero())
          .getAllByRole("definition")
          .map((definition) => definition.textContent),
      ).toEqual(["not given", "20 g", "40 % of energy", "10 g", "45 % of energy"]);
    });

    it("should say the energy is not given, without a unit, and show no shares", () => {
      showFood(makeFood({ kcal: null, protein_g: 14, carbs_g: null, fat_g: 17 }));

      expect(within(hero()).getByText("Energy not given")).toBeTruthy();
      expect(within(hero()).queryByText("kcal")).toBeNull();
      expect(
        within(hero())
          .getAllByRole("definition")
          .map((definition) => definition.textContent),
      ).toEqual(["14 g", "not given", "17 g"]);
    });
  });

  describe("the nutrition table", () => {
    it("should list energy, protein, carbohydrate, fat and fibre in that order", () => {
      showFood(makeFood());

      const table = screen.getByRole("table", { name: "Nutrition per 100 g" });
      expect(
        within(table)
          .getAllByRole("rowheader")
          .map((header) => header.textContent),
      ).toEqual(["Energy", "Protein", "Carbohydrate", "Fat", "Fibre"]);
    });

    it("should write each value with its unit through the shared number format", () => {
      showFood(makeFood({ kcal: 2480, protein_g: 9.5, carbs_g: 62, fat_g: 18.25, fibre_g: 8 }));

      const table = screen.getByRole("table", { name: "Nutrition per 100 g" });
      const expected = {
        Energy: "2,480 kcal",
        Protein: "9.5 g",
        Carbohydrate: "62 g",
        Fat: "18 g",
        Fibre: "8 g",
      };
      for (const [nutrient, amount] of Object.entries(expected)) {
        const row = within(table).getByRole("row", { name: new RegExp(nutrient) });
        expect(within(row).getByRole("cell").textContent).toBe(amount);
      }
    });

    it("should say a nutrient is not given, never zero, when it is null", () => {
      showFood(makeFood({ fibre_g: null, protein_g: null, kcal: null }));

      for (const nutrient of ["Energy", "Fibre", "Protein"]) {
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

      expect(screen.getByRole("table", { name: "Nutrition per 100 ml" })).toBeTruthy();
    });

    it("should note that carbohydrate includes fibre when it could not be converted", () => {
      showFood(makeFood({ quality: { carbs_convention: "us_total" } }));

      expect(
        screen.getByText("Carbohydrate includes fibre (US labelling convention)."),
      ).toBeTruthy();
    });

    it("should add no US note otherwise", () => {
      showFood(makeFood({ quality: { carbs_convention: "eu" } }));

      expect(screen.queryByText(/US labelling convention/)).toBeNull();
    });
  });

  describe("portions", () => {
    it("should list each portion with its amount and mark the default", () => {
      showFood(makeFood(), [
        makePortion({ id: "p1", label: "1 breast", grams: 150, is_default: true }),
        makePortion({ id: "p2", label: "Half breast", grams: 75, is_default: false }),
      ]);

      expect(screen.getByRole("heading", { level: 2, name: "Portions" })).toBeTruthy();
      const [breast, half] = screen.getAllByRole("listitem");
      expect(breast?.textContent).toBe("1 breastDefault150 g");
      expect(half?.textContent).toBe("Half breast75 g");
    });

    it("should give the amount in ml for a drink's portion", () => {
      showFood(makeFood({ basis: "per_100ml" }), [
        makePortion({ label: "Glass", grams: null, ml: 250 }),
      ]);

      expect(screen.getByRole("listitem").textContent).toBe("Glass250 ml");
    });

    it("should show no portions section when the food has none", () => {
      showFood(makeFood(), []);

      expect(screen.queryByRole("heading", { name: "Portions" })).toBeNull();
      expect(screen.queryByRole("list")).toBeNull();
    });
  });

  describe("attribution", () => {
    it.each([
      ["off", "Open Food Facts"],
      ["cofid", "UK CoFID"],
    ] as const)("should name a %s food's source in the badge", (source, badge) => {
      showFood(makeFood({ source }));

      expect(screen.getByText(badge)).toBeTruthy();
    });

    it.each(["off", "cofid"] as const)(
      "should carry no credit block under a %s food, since About holds it",
      (source) => {
        showFood(makeFood({ source }));

        expect(screen.queryByText(DATA_SOURCE_ATTRIBUTION[source].text)).toBeNull();
        expect(
          screen.queryByRole("link", { name: DATA_SOURCE_ATTRIBUTION[source].url }),
        ).toBeNull();
        expect(screen.queryByRole("contentinfo")).toBeNull();
      },
    );
  });

  describe("editing", () => {
    it("should offer to edit the user's own food", () => {
      showFood(makeFood({ id: "own-food", source: "user" }));

      expect(screen.getByRole("link", { name: "Edit" }).getAttribute("href")).toBe(
        "/foods/own-food/edit",
      );
    });

    it("should put Edit beside the title, not at the bottom", () => {
      showFood(makeFood({ source: "user" }));

      const heading = screen.getByRole("heading", { level: 1 });
      const edit = screen.getByRole("link", { name: "Edit" });
      const header = heading.parentElement?.parentElement;
      expect(header?.contains(edit)).toBe(true);
      expect(edit.compareDocumentPosition(hero()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("should not offer to edit a shared food", () => {
      showFood(makeFood({ source: "off" }));

      expect(screen.queryByRole("link", { name: "Edit" })).toBeNull();
    });
  });

  describe("the review block", () => {
    const suspect = { suspect: true, fields_missing: ["protein_g"] };

    it("should be a note titled Needs review that names the missing nutrient", () => {
      showFood(makeFood({ source: "off", protein_g: null, quality: suspect }));

      const note = screen.getByRole("note");
      expect(within(note).getByText("Needs review")).toBeTruthy();
      expect(
        within(note).getByText(
          "Protein is not given. Fill it in to save your own copy of this food.",
        ),
      ).toBeTruthy();
    });

    it("should be drawn in the warning tone, never the danger tone, as the boards draw it", () => {
      showFood(makeFood({ source: "off", quality: suspect }));

      const classes = screen.getByRole("note").className.split(" ");
      expect(classes).toContain("border-warning");
      expect(classes).toContain("bg-warning-muted");
      expect(classes.filter((name) => /danger|destructive/.test(name))).toEqual([]);
    });

    it("should offer one action, to copy the food to the user's own foods", () => {
      showFood(makeFood({ id: "suspect-food", source: "off", quality: suspect }));

      const note = screen.getByRole("note");
      const action = within(note).getByRole("link", { name: "Copy to your foods" });
      expect(action.getAttribute("href")).toBe("/foods/new?from=suspect-food");
      expect(within(note).getAllByRole("link")).toHaveLength(1);
      expect(within(note).queryByRole("button")).toBeNull();
    });

    it("should sit between the title and the energy card", () => {
      showFood(makeFood({ source: "off", quality: suspect }));

      const note = screen.getByRole("note");
      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading.compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(note.compareDocumentPosition(hero()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("should say that carbohydrate still includes fibre when a US label has no fibre", () => {
      showFood(
        makeFood({
          source: "off",
          fibre_g: null,
          quality: { suspect: true, fields_missing: ["fibre_g"], carbs_convention: "us_total" },
        }),
      );

      expect(
        within(screen.getByRole("note")).getByText(
          "Fibre is not given, so carbohydrate still includes it. Fill it in to save your own copy of this food.",
        ),
      ).toBeTruthy();
    });

    it("should show no review block for a food that is not suspect", () => {
      showFood(makeFood({ source: "off", quality: { suspect: false } }));

      expect(screen.queryByRole("note")).toBeNull();
      expect(screen.queryByRole("link", { name: "Copy to your foods" })).toBeNull();
    });

    it("should leave only the way back as a link for a food that is not suspect", () => {
      showFood(makeFood({ source: "off", quality: {} }));

      expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
        "Back to foods",
      ]);
      expect(screen.queryByRole("button")).toBeNull();
    });
  });
});
