import { describe, expect, it } from "vitest";

import { PALATE_GROUPS, palateGroupOf } from "../../src/palate";

import type { PalateGroup } from "../../src/palate";

describe("PALATE_GROUPS", () => {
  it("should be the fixed list of coarse groups, in the order the palate lists them", () => {
    expect(PALATE_GROUPS).toEqual([
      "meat",
      "fish",
      "eggs",
      "dairy",
      "grains and bread",
      "potatoes",
      "vegetables",
      "fruit",
      "legumes and nuts",
      "fats and oils",
      "sweets and snacks",
      "drinks",
      "other",
    ]);
  });
});

describe("palateGroupOf for a CoFID food", () => {
  // One real code and name for each group the mapping can return, so a group nothing maps to fails here.
  const cases: ReadonlyArray<readonly [PalateGroup, string, string]> = [
    ["meat", "MCA", "Chicken, light meat, raw"],
    ["fish", "J", "Salmon, farmed, flesh only, raw"],
    ["eggs", "CA", "Eggs, chicken, whole, boiled"],
    ["dairy", "BNE", "Yogurt, whole milk, plain"],
    ["grains and bread", "AC", "Rice, white, basmati, boiled"],
    ["potatoes", "DAM", "Potatoes, old, boiled in unsalted water"],
    ["vegetables", "DG", "Broccoli, green, boiled in unsalted water"],
    ["fruit", "FA", "Apples, eating, raw, flesh and skin"],
    ["legumes and nuts", "GA", "Almonds, kernel only"],
    ["fats and oils", "OC", "Oil, olive"],
    ["sweets and snacks", "SEA", "Chocolate, milk"],
    ["drinks", "PCA", "Cola"],
    ["other", "WY", "Vinegar"],
  ];

  it.each(cases)("should map %s from the code %s", (group, code, name) => {
    expect(palateGroupOf("cofid", code, name)).toBe(group);
  });

  it("should cover every group on the list", () => {
    expect(new Set(cases.map(([group]) => group))).toEqual(new Set(PALATE_GROUPS));
  });

  it.each([
    ["A", "grains and bread"],
    ["AS", "sweets and snacks"],
    ["BAB", "dairy"],
    ["BL", "dairy"],
    ["BP", "sweets and snacks"],
    ["BTM", "fats and oils"],
    ["CDH", "sweets and snacks"],
    ["D", "vegetables"],
    ["DA", "potatoes"],
    ["DB", "legumes and nuts"],
    ["DF", "legumes and nuts"],
    ["DR", "vegetables"],
    ["FC", "fruit"],
    ["G", "legumes and nuts"],
    ["H", "other"],
    ["JA", "fish"],
    ["MR", "meat"],
    ["OA", "fats and oils"],
    ["Q", "drinks"],
    ["QA", "drinks"],
    ["SN", "sweets and snacks"],
    ["WC", "other"],
  ] as const)("should map the code %s to %s", (code, group) => {
    expect(palateGroupOf("cofid", code, "Anything at all")).toBe(group);
  });

  it("should read the code in any case and ignore spaces around it", () => {
    expect(palateGroupOf("cofid", " ad ", "Pasta, plain, fresh, boiled")).toBe("grains and bread");
  });

  it("should fall to the name when the code is missing or unknown", () => {
    expect(palateGroupOf("cofid", null, "Salmon, grilled")).toBe("fish");
    expect(palateGroupOf("cofid", "ZZ", "Salmon, grilled")).toBe("fish");
  });

  it("should be other when neither the code nor the name says", () => {
    expect(palateGroupOf("cofid", "ZZ", "Something unlisted")).toBe("other");
  });
});

describe("palateGroupOf for an Open Food Facts product", () => {
  it.each([
    ["breakfast-cereals", "grains and bread"],
    ["breads", "grains and bread"],
    ["meats", "meat"],
    ["fishes", "fish"],
    ["eggs", "eggs"],
    ["yogurts", "dairy"],
    ["fruits", "fruit"],
    ["vegetables", "vegetables"],
    ["legumes", "legumes and nuts"],
    ["olive-oils", "fats and oils"],
    ["biscuits-and-cakes", "sweets and snacks"],
    ["sodas", "drinks"],
    ["sauces", "other"],
  ] as const)("should map the category %s to %s", (category, group) => {
    expect(palateGroupOf("off", category, "Some product")).toBe(group);
  });

  it("should fall to the name for a category too broad to say", () => {
    expect(palateGroupOf("off", "plant-based-foods-and-beverages", "Oat porridge pot")).toBe(
      "grains and bread",
    );
  });
});

describe("palateGroupOf for a food the person made", () => {
  it("should read the name, because a user food has no group", () => {
    expect(palateGroupOf("user", null, "Mum's lentil soup")).toBe("legumes and nuts");
  });

  it("should not mistake a sweet potato for a sweet", () => {
    expect(palateGroupOf("user", null, "Sweet potato wedges")).toBe("potatoes");
  });

  it("should read the first part of the name before the rest", () => {
    expect(palateGroupOf("cofid", null, "Eggs, chicken, whole, boiled")).toBe("eggs");
  });

  it("should put a juice with the drinks and not the fruit", () => {
    expect(palateGroupOf("user", null, "Apple juice")).toBe("drinks");
  });

  it("should put peanut butter with the nuts and not the fats", () => {
    expect(palateGroupOf("user", null, "Peanut butter")).toBe("legumes and nuts");
  });

  it("should be other for a name it does not know", () => {
    expect(palateGroupOf("user", null, "Zorblax")).toBe("other");
  });
});

describe("palateGroupOf for the foods between two groups", () => {
  it.each([
    ["AM", "Biscuits, semi-sweet"],
    ["AP", "Muffins, English style, white"],
  ])("should put CoFID %s with the grains and bread", (code, name) => {
    expect(palateGroupOf("cofid", code, name)).toBe("grains and bread");
  });

  it("should still put cakes and pastry with the sweets and snacks", () => {
    expect(palateGroupOf("cofid", "AN", "Cake, chocolate fudge")).toBe("sweets and snacks");
    expect(palateGroupOf("cofid", "AO", "Pastry, shortcrust")).toBe("sweets and snacks");
  });

  it.each([
    ["cofid", "BC", "Milk, soya, sweetened"],
    ["cofid", "BC", "Soya milk, plain"],
    ["cofid", "BH", "Oat milk"],
    ["off", "plant-based-foods-and-beverages", "Almond milk, unsweetened"],
    ["user", null, "Coconut milk"],
    ["user", null, "Rice milk"],
    ["cofid", "BC", "Milk, non-dairy, whitener"],
  ] as const)("should put the milk alternative %s %s %s with the drinks", (source, code, name) => {
    expect(palateGroupOf(source, code, name)).toBe("drinks");
  });

  it("should keep cow's milk and a dish made with an alternative out of the drinks", () => {
    expect(palateGroupOf("cofid", "BAH", "Milk, semi-skimmed, pasteurised")).toBe("dairy");
    expect(palateGroupOf("user", null, "Porridge made with oat milk")).not.toBe("drinks");
  });
});
