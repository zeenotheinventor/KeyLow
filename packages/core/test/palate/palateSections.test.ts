import { describe, expect, it } from "vitest";

import { boardOptions, boardPreferences, boardStats } from "./boardData";
import { buildPalateProfile, palateSections } from "../../src/palate";

import type { PalatePreference } from "../../src/palate";

const notUsual = (
  id: string,
  reference: { foodId?: string; recipeId?: string; label?: string },
): PalatePreference => ({
  id,
  kind: "not_usual",
  foodId: reference.foodId ?? null,
  recipeId: reference.recipeId ?? null,
  label: reference.label ?? null,
});

const sectionsWith = (corrections: PalatePreference[]) =>
  palateSections(
    buildPalateProfile(boardStats, [...boardPreferences, ...corrections], boardOptions),
  );

describe("palateSections", () => {
  it("should list the usual foods of the board in order, with their days and typical grams", () => {
    const { foods } = sectionsWith([]);
    expect(foods.map(({ title, detail }) => [title, detail])).toEqual([
      ["Apples, eating, raw, flesh and skin", "28 days · usually 100 g"],
      ["Broccoli, green, boiled in unsalted water", "28 days · usually 80 g"],
      ["Eggs, chicken, whole, boiled", "28 days · usually 110 g"],
      ["Bread, brown, average", "28 days · usually 70 g"],
      ["Yogurt, Greek style, plain", "14 days · usually 150 g"],
      ["Porridge oats, unfortified", "14 days · usually 30 g"],
      ["Chicken, breast, grilled", expect.stringContaining("days")],
      ["Rice, white, boiled", expect.stringContaining("days")],
      ["Salmon, farmed, baked", expect.stringContaining("days")],
      ["Potatoes, old, boiled", expect.stringContaining("days")],
    ]);
  });

  it("should list the usual recipes with their servings", () => {
    const { recipes } = sectionsWith([]);
    expect(recipes.map(({ title, detail }) => [title, detail])).toEqual([
      ["Eval porridge bowl", "14 days · usually 1 serving"],
      ["Eval chicken and rice", "14 days · usually 1 serving"],
    ]);
  });

  it("should name each time of day with its foods, as the board does", () => {
    expect(sectionsWith([]).timesOfDay).toEqual([
      { key: "morning", title: "Morning", detail: "Yogurt, apples and porridge oats" },
      { key: "midday", title: "Midday", detail: "Chicken, rice and broccoli" },
      { key: "evening", title: "Evening", detail: "Chicken, rice and salmon" },
    ]);
  });

  it("should list the rare groups with what is said of their logs", () => {
    const { rare } = sectionsWith([]);
    expect(rare.map(({ title, detail }) => [title, detail])).toEqual([
      ["Legumes and nuts", "Not logged in the last 90 days"],
      ["Sweets and snacks", "Not logged in the last 90 days"],
      ["Drinks", "Not logged in the last 90 days"],
    ]);
  });

  it("should name what a Not true on each kind of row writes", () => {
    const { foods, recipes, rare } = sectionsWith([]);
    expect(foods[2]?.target).toEqual({ foodId: "eggs" });
    expect(recipes[0]?.target).toEqual({ recipeId: "porridge-bowl" });
    expect(rare[2]?.target).toEqual({ label: "drinks" });
  });

  it("should keep a corrected item in its place, with the words of the board and its correction", () => {
    const { foods, rare } = sectionsWith([
      notUsual("c-eggs", { foodId: "eggs" }),
      notUsual("c-drinks", { label: "drinks" }),
    ]);
    expect(foods[2]).toMatchObject({
      title: "Eggs, chicken, whole, boiled",
      detail: "You said this is not usual",
      correctionId: "c-eggs",
    });
    expect(foods[3]?.title).toBe("Bread, brown, average");
    expect(foods).toHaveLength(10);
    expect(rare[2]).toMatchObject({
      title: "Drinks",
      detail: "You said this is not usual",
      correctionId: "c-drinks",
    });
  });

  it("should have no correction id on an item that is still usual", () => {
    expect(sectionsWith([]).foods.every(({ correctionId }) => correctionId === null)).toBe(true);
  });

  it("should leave a time of day out when it has no foods", () => {
    const sections = palateSections(buildPalateProfile([], [], { ...boardOptions, loggedDays: 2 }));
    expect(sections.timesOfDay).toEqual([]);
    expect(sections.foods).toEqual([]);
  });
});
