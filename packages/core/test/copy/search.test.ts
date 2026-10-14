import { describe, expect, it } from "vitest";

import {
  ADD_PRODUCT_FAILED,
  ADD_PRODUCT_NOT_FOUND,
  OPEN_FOOD_FACTS_BUSY,
  OPEN_FOOD_FACTS_SEARCH_FAILED,
  SEARCH_EMPTY,
  SEARCH_FAILED_MOBILE,
  SEARCH_FAILED_WEB,
  SEARCH_GROUP_HEADINGS,
  SEARCH_IDLE,
  SEARCH_STATUS,
  YOUR_FOODS_EMPTY,
  describeSeeMore,
} from "../../src/copy";

describe("search group headings", () => {
  it("should pin the headings and captions the boards draw", () => {
    expect(SEARCH_GROUP_HEADINGS).toEqual({
      yours: { title: "Your foods", caption: "Yours", label: "Your foods" },
      common: { title: "Common foods", caption: "UK CoFID", label: "Common foods from UK CoFID" },
      branded: {
        title: "Branded foods",
        caption: "Open Food Facts",
        label: "Branded foods from Open Food Facts",
      },
      live: {
        title: "From Open Food Facts",
        caption: "Live results",
        label: "Open Food Facts results",
      },
    });
  });
});

describe("describeSeeMore", () => {
  it.each([
    [1, "See 1 more"],
    [2, "See 2 more"],
    [18, "See 18 more"],
  ])("should write %s hidden rows as %s", (hiddenCount, expected) => {
    expect(describeSeeMore(hiddenCount)).toBe(expected);
  });
});

describe("search sheet sentences", () => {
  it("should pin the idle state", () => {
    expect(SEARCH_IDLE).toEqual({
      title: "Search for a food",
      body: "Type at least 2 characters to search your foods, UK CoFID and Open Food Facts.",
      hint: "Type at least 2 characters to search",
    });
  });

  it("should pin the status lines", () => {
    expect(SEARCH_STATUS).toEqual({
      searchingYourFoods: "Searching your foods",
      searchingOpenFoodFacts: "Searching Open Food Facts",
      addingProduct: "Adding to your foods",
    });
  });

  it("should pin the empty states", () => {
    expect(SEARCH_EMPTY).toEqual({
      title: "No foods found",
      body: "Try other words, or create the food yourself.",
      action: "Create a food",
    });
    expect(YOUR_FOODS_EMPTY).toEqual({
      title: "No foods yet",
      body: "Foods you create or copy appear here.",
      action: "Create a food",
    });
  });

  it("should pin the search failure on web", () => {
    expect(SEARCH_FAILED_WEB).toEqual({
      title: "Search failed",
      body: "Your foods could not be searched. Check your connection and try again.",
    });
  });

  it("should pin the search failure on mobile", () => {
    expect(SEARCH_FAILED_MOBILE).toEqual({
      title: "Your foods could not be searched",
      body: "Check your connection and try again.",
    });
  });

  it("should pin the Open Food Facts notices", () => {
    expect(OPEN_FOOD_FACTS_BUSY).toBe("Open Food Facts is busy");
    expect(OPEN_FOOD_FACTS_SEARCH_FAILED).toEqual({
      title: "Open Food Facts could not be searched right now",
      body: "Your own results still work. Change your search to try again.",
    });
  });

  it("should pin the add product failure", () => {
    expect(ADD_PRODUCT_FAILED).toEqual({
      title: "This product could not be added",
      body: "Check your connection and try again.",
    });
  });
});

describe("add product not found", () => {
  it("should pin the title the add-product-error board draws when the product is gone", () => {
    expect(ADD_PRODUCT_NOT_FOUND).toBe("Open Food Facts no longer has this product.");
  });
});
