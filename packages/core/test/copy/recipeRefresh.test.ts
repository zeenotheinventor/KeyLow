import { describe, expect, it } from "vitest";

import { collectStrings } from "./collectStrings";
import {
  RECIPE_ACTIONS,
  RECIPE_TOASTS,
  REFRESH,
  describeBeforeAfter,
  describeCountedHeading,
  describePortionFellBack,
} from "../../src/copy";

import type { IngredientAmount } from "../../src/recipes";

describe("the refresh strings", () => {
  it("should pin the strings of brief 22", () => {
    expect(REFRESH).toEqual({
      intro: "These foods have changed since you added them. Apply to use their values now.",
      calories: "Calories",
      noChange: "no change",
      changed: "Changed",
      unchanged: "Unchanged",
      kept: "Kept as it is",
      foodGone: "This food has been deleted. The ingredient keeps its saved values.",
      apply: "Apply",
      applyHint: "Replaces the saved values of the changed ingredients",
      nothingTitle: "Nothing to refresh",
      nothingBody: "Every ingredient matches its food today.",
      done: "Done",
      loadingLabel: "Checking your foods",
      loadFailed: "Couldn't check your foods",
      perServingRegionName: "Per serving, before and after",
    });
  });

  it("should add the refresh action and the toasts to the recipe's own", () => {
    expect(RECIPE_ACTIONS).toMatchObject({
      refresh: "Refresh ingredients",
      refreshCaption: "Check your foods for changes",
    });
    expect(RECIPE_TOASTS).toMatchObject({ refreshed: "Ingredients refreshed" });
  });

  it("should drop the save-first variant, because the view never has unsaved changes", () => {
    expect(RECIPE_ACTIONS).not.toHaveProperty("saveFirst");
  });

  it("should end no button, heading, title or toast with a full stop", () => {
    const labels = [
      REFRESH.calories,
      REFRESH.noChange,
      REFRESH.changed,
      REFRESH.unchanged,
      REFRESH.kept,
      REFRESH.apply,
      REFRESH.nothingTitle,
      REFRESH.done,
      REFRESH.loadingLabel,
      REFRESH.loadFailed,
      RECIPE_ACTIONS.refresh,
      RECIPE_ACTIONS.refreshCaption,
      RECIPE_TOASTS.refreshed,
    ];

    for (const label of labels) {
      expect(label).not.toMatch(/\.$/);
    }
  });

  it("should hold only non-empty text without an em dash", () => {
    for (const text of collectStrings(REFRESH)) {
      expect(text.trim()).not.toBe("");
      expect(text).not.toContain("\u2014");
    }
  });
});

describe("the section headings", () => {
  it.each([
    [REFRESH.changed, 1, "Changed · 1"],
    [REFRESH.unchanged, 2, "Unchanged · 2"],
    [REFRESH.kept, 1, "Kept as it is · 1"],
  ])("should write %s with a count of %s as %s", (heading, count, expected) => {
    expect(describeCountedHeading(heading, count)).toBe(expected);
  });
});

describe("describeBeforeAfter", () => {
  it("should read a change in calories, 374 before and 362 now", () => {
    expect(describeBeforeAfter(REFRESH.calories, { before: 374.2, after: 361.7 }, "energy")).toBe(
      "Calories, 374 before, 362 now",
    );
  });

  it("should read a value that did not change with its unit, then no change", () => {
    expect(describeBeforeAfter("Carbs", { before: 42.55, after: 42.55 }, "grams")).toBe(
      "Carbs, 43 grams, no change",
    );
    expect(describeBeforeAfter(REFRESH.calories, { before: 374.2, after: 374.2 }, "energy")).toBe(
      "Calories, 374 kilocalories, no change",
    );
  });

  it.each([
    ["Protein", 31.625, 34.75, "Protein, 32 before, 35 now"],
    ["Fat", 8.125, 6.75, "Fat, 8.1 before, 6.8 now"],
    ["Energy", 120, 110, "Energy, 120 before, 110 now"],
    ["Protein", 22.5, 25, "Protein, 23 before, 25 now"],
    ["Fat", 2.1, 1.0, "Fat, 2.1 before, 1 now"],
  ] as const)(
    "should read the %s of the refresh sample as the board does",
    (label, before, after, expected) => {
      expect(
        describeBeforeAfter(label, { before, after }, label === "Energy" ? "energy" : "grams"),
      ).toBe(expected);
    },
  );

  it("should call two values no change when they are written the same", () => {
    expect(describeBeforeAfter("Carbs", { before: 43.1, after: 43.4 }, "grams")).toBe(
      "Carbs, 43 grams, no change",
    );
    expect(describeBeforeAfter(REFRESH.calories, { before: 373.6, after: 374.4 }, "energy")).toBe(
      "Calories, 374 kilocalories, no change",
    );
  });

  it("should say 1 kilocalorie and 1 gram in the singular", () => {
    expect(describeBeforeAfter(REFRESH.calories, { before: 1, after: 1 }, "energy")).toBe(
      "Calories, 1 kilocalorie, no change",
    );
    expect(describeBeforeAfter("Fat", { before: 1, after: 1 }, "grams")).toBe(
      "Fat, 1 gram, no change",
    );
  });

  it("should say not given for a value the food does not record", () => {
    expect(describeBeforeAfter("Fibre", { before: 2, after: null }, "grams")).toBe(
      "Fibre, 2 before, not given now",
    );
    expect(describeBeforeAfter("Fibre", { before: null, after: null }, "grams")).toBe(
      "Fibre, not given, no change",
    );
  });

  it("should group the thousands of calories", () => {
    expect(describeBeforeAfter(REFRESH.calories, { before: 1496.8, after: 1446.8 }, "energy")).toBe(
      "Calories, 1,497 before, 1,447 now",
    );
  });
});

describe("describePortionFellBack", () => {
  const amount = (before: Partial<IngredientAmount>, after: Partial<IngredientAmount>) => ({
    before: { quantity: 1, unit: "portion" as const, portionLabel: "1 medium", ...before },
    after: { quantity: 110, unit: "g" as const, portionLabel: null, ...after },
  });

  it("should say the portion is gone and what the amount becomes, as brief 22 writes it", () => {
    expect(describePortionFellBack(amount({}, {}))).toBe(
      "1 medium is no longer on this food, so the amount becomes 110 g.",
    );
  });

  it("should name the label of the portion whatever the count was", () => {
    expect(
      describePortionFellBack(amount({ quantity: 6, portionLabel: "1 large" }, { quantity: 300 })),
    ).toBe("1 large is no longer on this food, so the amount becomes 300 g.");
  });

  it("should write an amount in millilitres as the ingredient row does", () => {
    expect(describePortionFellBack(amount({}, { quantity: 15, unit: "ml" }))).toBe(
      "1 medium is no longer on this food, so the amount becomes 15 ml.",
    );
  });

  it("should refuse an amount that was never a portion", () => {
    expect(() => describePortionFellBack(amount({ unit: "g", portionLabel: null }, {}))).toThrow(
      RangeError,
    );
  });
});
