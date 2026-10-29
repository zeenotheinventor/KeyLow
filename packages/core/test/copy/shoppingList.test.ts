import { describe, expect, it } from "vitest";

import { collectStrings } from "./collectStrings";
import {
  SHOPPING_LIST,
  SHOPPING_LIST_CLEAR_DIALOG,
  SHOPPING_LIST_EMPTY,
  SHOPPING_LIST_NO_RECIPES,
  describeAddAnyway,
  describeLeftOutCount,
  describeRemoveItem,
  describeShoppingAmount,
  describeShoppingItemCaption,
  describeShoppingSources,
} from "../../src/copy";

describe("SHOPPING_LIST", () => {
  it("should pin the words of the list and its entry points", () => {
    expect(SHOPPING_LIST).toMatchObject({
      title: "Shopping list",
      addToList: "Add to shopping list",
      addToListCaption: "Puts its ingredients on your list",
      addRecipe: "Add a recipe",
      toBuy: "To buy",
      ticked: "Ticked",
      clearTicked: "Clear ticked items",
      addItemPlaceholder: "Add an item",
      leftOut: "Store cupboard items left out",
      addAnyway: "Add anyway",
      remove: "Remove",
      fromRecipes: "From",
      added: "Added to your shopping list",
    });
  });

  it("should end no button, label or heading with a full stop", () => {
    const sentences = [
      SHOPPING_LIST.onlyStaples,
      SHOPPING_LIST.addFailed,
      SHOPPING_LIST.changeFailed,
      SHOPPING_LIST.offlineBody,
    ];
    for (const [key, text] of Object.entries(SHOPPING_LIST)) {
      if (!sentences.includes(text)) {
        expect(text.endsWith("."), key).toBe(false);
      }
    }
  });

  it("should be non-empty strings with no em dash, in every group", () => {
    for (const text of [
      ...collectStrings(SHOPPING_LIST),
      ...collectStrings(SHOPPING_LIST_EMPTY),
      ...collectStrings(SHOPPING_LIST_NO_RECIPES),
      ...collectStrings(SHOPPING_LIST_CLEAR_DIALOG),
    ]) {
      expect(text.trim()).not.toBe("");
      expect(text).not.toContain("—");
    }
  });

  it("should ask before clearing, with the action as the confirm button", () => {
    expect(SHOPPING_LIST_CLEAR_DIALOG.title.endsWith("?")).toBe(true);
    expect(SHOPPING_LIST_CLEAR_DIALOG.confirmLabel).toBe(SHOPPING_LIST.clearTicked);
  });
});

describe("describeLeftOutCount", () => {
  it("should agree the noun with the count", () => {
    expect(describeLeftOutCount(1)).toBe("1 store cupboard item left out");
    expect(describeLeftOutCount(3)).toBe("3 store cupboard items left out");
    expect(describeLeftOutCount(0)).toBe("0 store cupboard items left out");
  });
});

describe("describeRemoveItem", () => {
  it("should name the item", () => {
    expect(describeRemoveItem("Onions")).toBe("Remove Onions");
  });
});

describe("describeShoppingSources", () => {
  it("should join the recipe names in British English, with no serial comma", () => {
    expect(describeShoppingSources(["Chilli"])).toBe("From Chilli");
    expect(describeShoppingSources(["Chilli", "Curry"])).toBe("From Chilli and Curry");
    expect(describeShoppingSources(["Chilli", "Curry", "Pie"])).toBe("From Chilli, Curry and Pie");
  });
});

describe("describeShoppingAmount", () => {
  it("should write grams alone with a thousands separator", () => {
    expect(describeShoppingAmount({ grams: 450, portion_label: null, portion_count: null })).toBe(
      "450 g",
    );
    expect(describeShoppingAmount({ grams: 1250, portion_label: null, portion_count: null })).toBe(
      "1,250 g",
    );
  });

  it("should write one portion by its label, and more as a count, before the grams", () => {
    expect(
      describeShoppingAmount({ grams: 150, portion_label: "1 medium", portion_count: 1 }),
    ).toBe("1 medium · 150 g");
    expect(
      describeShoppingAmount({ grams: 300, portion_label: "1 medium", portion_count: 2 }),
    ).toBe("2 × 1 medium · 300 g");
    expect(
      describeShoppingAmount({ grams: 375, portion_label: "1 medium", portion_count: 2.25 }),
    ).toBe("2.25 × 1 medium · 375 g");
  });

  it("should write the count alone when there are no grams", () => {
    expect(
      describeShoppingAmount({ grams: null, portion_label: "1 medium", portion_count: 2 }),
    ).toBe("2 × 1 medium");
  });

  it("should have no amount for an item typed by hand", () => {
    expect(
      describeShoppingAmount({ grams: null, portion_label: null, portion_count: null }),
    ).toBeNull();
  });
});

describe("describeAddAnyway", () => {
  it("should name the staple", () => {
    expect(describeAddAnyway("Salt")).toBe("Add anyway: Salt");
  });
});

describe("describeShoppingItemCaption", () => {
  it("should write the amount, then the recipes", () => {
    expect(
      describeShoppingItemCaption({
        grams: 300,
        portion_label: "1 medium",
        portion_count: 2,
        sources: [{ name: "Chilli" }, { name: "Curry" }],
      }),
    ).toBe("2 × 1 medium · 300 g · From Chilli and Curry");
  });

  it("should leave out a part the item does not have", () => {
    expect(
      describeShoppingItemCaption({
        grams: 450,
        portion_label: null,
        portion_count: null,
        sources: [],
      }),
    ).toBe("450 g");
    expect(
      describeShoppingItemCaption({
        grams: null,
        portion_label: null,
        portion_count: null,
        sources: [{ name: "Chilli" }],
      }),
    ).toBe("From Chilli");
  });

  it("should have no line for an item typed by hand", () => {
    expect(
      describeShoppingItemCaption({
        grams: null,
        portion_label: null,
        portion_count: null,
        sources: [],
      }),
    ).toBeNull();
  });
});
