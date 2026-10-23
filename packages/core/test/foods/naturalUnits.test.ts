import { describe, expect, it } from "vitest";

import { henEggTags, realProducts } from "./naturalUnitFixtures";
import {
  NATURAL_UNIT_PROCESSED_TAGS,
  NATURAL_UNIT_TYPES,
  naturalUnitsFor,
} from "../../src/foods/naturalUnits";

const per100g = "per_100g" as const;

describe("naturalUnitsFor", () => {
  describe("a fresh product of an allowlisted type", () => {
    it("should give a box of eggs the four sizes without shell, large the default", () => {
      expect(naturalUnitsFor({ categoriesTags: henEggTags, basis: per100g, kcal: 140 })).toEqual([
        { label: "1 small", grams: 38, isDefault: false },
        { label: "1 medium", grams: 44, isDefault: false },
        { label: "1 large", grams: 50, isDefault: true },
        { label: "1 extra large", grams: 56, isDefault: false },
      ]);
    });

    it("should give a real bag of bananas small, medium and large, medium the default", () => {
      const { categoriesTags, kcal } = realProducts.bagOfBananas;

      expect(naturalUnitsFor({ categoriesTags, basis: per100g, kcal })).toEqual([
        { label: "1 small", grams: 101, isDefault: false },
        { label: "1 medium", grams: 118, isDefault: true },
        { label: "1 large", grams: 136, isDefault: false },
      ]);
    });

    it("should give a bag of apples small, medium and large, medium the default", () => {
      expect(naturalUnitsFor({ categoriesTags: ["en:apples"], basis: per100g, kcal: 52 })).toEqual([
        { label: "1 small", grams: 149, isDefault: false },
        { label: "1 medium", grams: 182, isDefault: true },
        { label: "1 large", grams: 223, isDefault: false },
      ]);
    });

    it("should give a real fresh kiwi its cited kiwi", () => {
      const { categoriesTags, kcal } = realProducts.freshKiwi;

      expect(naturalUnitsFor({ categoriesTags, basis: per100g, kcal })).toEqual([
        { label: "1 kiwi", grams: 69, isDefault: true },
      ]);
    });

    it("should give fresh garlic a clove of 3 g when its energy is in the band", () => {
      const { categoriesTags } = realProducts.garlicBulbs;

      expect(naturalUnitsFor({ categoriesTags, basis: per100g, kcal: 110 })).toEqual([
        { label: "1 clove", grams: 3, isDefault: true },
      ]);
    });

    it("should match on a tag anywhere in the full category list, not only the first", () => {
      const categoriesTags = ["en:plant-based-foods", "en:fruits", "en:bananas"];

      expect(naturalUnitsFor({ categoriesTags, basis: per100g, kcal: 89 })).toHaveLength(3);
    });

    it("should match a child of an allowlisted tag, because OFF lists every ancestor too", () => {
      const categoriesTags = ["en:fruits", "en:bananas", "en:cavendish-bananas"];

      expect(naturalUnitsFor({ categoriesTags, basis: per100g, kcal: 89 })).toHaveLength(3);
    });
  });

  describe("guard 1: an allowlisted tag or a descendant of it", () => {
    it("should not match on a taxonomy parent such as fruits", () => {
      const categoriesTags = ["en:plant-based-foods", "en:fruits"];

      expect(naturalUnitsFor({ categoriesTags, basis: per100g, kcal: 89 })).toEqual([]);
    });

    it("should not match a tag that only contains an allowlisted one", () => {
      const categoriesTags = ["en:egg-noodles", "en:banana-breads"];

      expect(naturalUnitsFor({ categoriesTags, basis: per100g, kcal: 143 })).toEqual([]);
    });

    it("should not match with no categories at all", () => {
      expect(naturalUnitsFor({ categoriesTags: undefined, basis: per100g, kcal: 89 })).toEqual([]);
      expect(naturalUnitsFor({ categoriesTags: [], basis: per100g, kcal: 89 })).toEqual([]);
    });
  });

  describe("guard 2: no processed signal", () => {
    it.each(NATURAL_UNIT_PROCESSED_TAGS)(
      "should not match when the product also carries %s",
      (processedTag) => {
        const categoriesTags = ["en:apples", processedTag];

        expect(naturalUnitsFor({ categoriesTags, basis: per100g, kcal: 52 })).toEqual([]);
      },
    );

    it.each(NATURAL_UNIT_TYPES)(
      "should not match $type when any of its own exclusion tags is present",
      (entry) => {
        for (const excludeTag of entry.excludeTags) {
          const categoriesTags = [...entry.includeTags, excludeTag];
          const kcal = entry.referenceKcalPer100g;

          expect(naturalUnitsFor({ categoriesTags, basis: per100g, kcal })).toEqual([]);
        }
      },
    );
  });

  describe("guard 3: the energy check", () => {
    it("should not match banana chips at about 500 kcal even if no other tag gives them away", () => {
      expect(
        naturalUnitsFor({ categoriesTags: ["en:bananas"], basis: per100g, kcal: 519 }),
      ).toEqual([]);
    });

    it("should not match garlic powder at about 330 kcal even if no other tag gives it away", () => {
      expect(
        naturalUnitsFor({ categoriesTags: ["en:garlics"], basis: per100g, kcal: 331 }),
      ).toEqual([]);
    });

    it("should not match real garlic bulbs, because OFF holds their energy as 0", () => {
      const { categoriesTags, kcal } = realProducts.garlicBulbs;

      expect(naturalUnitsFor({ categoriesTags, basis: per100g, kcal })).toEqual([]);
    });

    it("should not match when the energy is unknown", () => {
      expect(naturalUnitsFor({ categoriesTags: henEggTags, basis: per100g, kcal: null })).toEqual(
        [],
      );
    });

    it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])(
      "should not match when the energy is %s",
      (kcal) => {
        expect(naturalUnitsFor({ categoriesTags: henEggTags, basis: per100g, kcal })).toEqual([]);
      },
    );

    // The CoFID reference for hen eggs is 131 kcal, so 20 percent is 26.2 either side (104.8 to 157.2).
    it.each([
      [105, true],
      [104, false],
      [157, true],
      [158, false],
    ])("should treat %s kcal against a 131 kcal reference as match: %s", (kcal, matches) => {
      const portions = naturalUnitsFor({ categoriesTags: henEggTags, basis: per100g, kcal });

      expect(portions.length > 0).toBe(matches);
    });
  });

  describe("guard 4: basis and uniqueness", () => {
    it("should not match a per 100 ml product", () => {
      expect(
        naturalUnitsFor({ categoriesTags: henEggTags, basis: "per_100ml", kcal: 143 }),
      ).toEqual([]);
    });

    it("should match nothing when the tags name two types", () => {
      const categoriesTags = ["en:oranges", "en:lemons"];

      expect(naturalUnitsFor({ categoriesTags, basis: per100g, kcal: 36 })).toEqual([]);
    });

    it("should match nothing when two types are named even if only one passes the energy check", () => {
      const categoriesTags = ["en:apples", "en:pears"];

      expect(naturalUnitsFor({ categoriesTags, basis: per100g, kcal: 52 })).toEqual([]);
    });
  });

  describe("real products that must not borrow", () => {
    it.each([
      ["apple sauce", realProducts.appleSauce],
      ["banana chips", realProducts.bananaChips],
      ["orange soda", realProducts.orangeSoda],
      ["a quail egg", realProducts.quailEgg],
      ["a scotch egg", realProducts.scotchEgg],
      ["a hard-boiled egg", realProducts.hardBoiledEgg],
      ["frozen chopped garlic", realProducts.frozenChoppedGarlic],
    ])("should not match %s", (_name, { categoriesTags, kcal }) => {
      expect(naturalUnitsFor({ categoriesTags, basis: per100g, kcal })).toEqual([]);
    });

    // These real products carry an allowlisted tag, so the tags alone must keep them out even when
    // their energy sits right on the reference of the type they resemble.
    it.each([
      ["apple sauce", realProducts.appleSauce, 51],
      ["orange soda", realProducts.orangeSoda, 36],
      ["a quail egg", realProducts.quailEgg, 131],
      ["a scotch egg", realProducts.scotchEgg, 131],
      ["a hard-boiled egg", realProducts.hardBoiledEgg, 131],
      ["frozen chopped garlic", realProducts.frozenChoppedGarlic, 98],
    ])("should not match %s even at the reference energy", (_name, { categoriesTags }, kcal) => {
      expect(naturalUnitsFor({ categoriesTags, basis: per100g, kcal })).toEqual([]);
    });
  });

  describe("products that are never borrowed from", () => {
    // Each list is the product's leaf tag with its ancestors in the OFF taxonomy. A product OFF has
    // also tagged with the allowlisted tag (`alsoTagged`) must still be kept out by guard 2.
    it.each([
      ["chocolate eggs", ["en:chocolate-eggs", "en:cocoa-and-its-products"], "en:eggs", 530],
      [
        "egg noodles",
        ["en:egg-noodles", "en:egg-pastas", "en:pastas", "en:noodles"],
        "en:eggs",
        384,
      ],
      ["egg mayonnaise", ["en:mayonnaises", "en:sauces", "en:condiments"], "en:eggs", 131],
      [
        "apple juice",
        ["en:apple-juices", "en:fruit-juices", "en:beverages", "en:juices-and-nectars"],
        "en:apples",
        46,
      ],
      [
        "dried apple",
        ["en:dried-apples", "en:dried-fruits", "en:dried-plant-based-foods", "en:dried-products"],
        "en:apples",
        52,
      ],
      [
        "garlic powder",
        ["en:garlic-powders", "en:garlics-and-their-products", "en:dried-products"],
        "en:garlics",
        331,
      ],
      ["garlic bread", ["en:garlic-breads", "en:appetizers", "en:snacks"], "en:garlics", 110],
      ["lemon curd", ["en:lemon-curds", "en:fruit-curds", "en:spreads"], "en:lemons", 14],
      [
        "lemon juice",
        ["en:lemon-juice", "en:fruit-juices", "en:beverages", "en:juices-and-nectars"],
        "en:lemons",
        14,
      ],
      ["bottled orange drink", ["en:beverages"], "en:oranges", 36],
      [
        "banana bread",
        ["en:banana-breads", "en:cakes", "en:biscuits-and-cakes", "en:snacks"],
        "en:bananas",
        326,
      ],
    ])("should not match %s", (_name, categoriesTags, alsoTagged, kcal) => {
      expect(naturalUnitsFor({ categoriesTags, basis: per100g, kcal })).toEqual([]);
      expect(
        naturalUnitsFor({ categoriesTags: [...categoriesTags, alsoTagged], basis: per100g, kcal }),
      ).toEqual([]);
    });

    it.each([
      ["bread slices", ["en:sliced-breads", "en:breads", "en:cereals-and-their-products"], 250],
      ["chicken breast", ["en:chicken-breasts", "en:chickens", "en:meats"], 120],
      ["cod fillet", ["en:cod-fillets", "en:cods", "en:fishes", "en:fish-fillets"], 82],
    ])("should not match %s", (_name, categoriesTags, kcal) => {
      expect(naturalUnitsFor({ categoriesTags, basis: per100g, kcal })).toEqual([]);
    });
  });
});

describe("NATURAL_UNIT_TYPES", () => {
  it("should list the eleven first types", () => {
    expect(NATURAL_UNIT_TYPES.map((entry) => entry.cofidFoodCode)).toEqual([
      "12-937",
      "14-318",
      "14-319",
      "14-321",
      "14-327",
      "14-326",
      "14-371",
      "14-129",
      "14-131",
      "14-386",
      "13-244",
    ]);
  });

  it.each(NATURAL_UNIT_TYPES)("should give $type exactly one default portion", (entry) => {
    expect(entry.portions.filter((portion) => portion.isDefault)).toHaveLength(1);
  });

  it.each(NATURAL_UNIT_TYPES)("should cite the FDC id and CSV row for $type", (entry) => {
    expect(entry.source).toMatch(/FDC id \d+/);
    expect(entry.source).toContain(entry.cofidFoodCode);
  });

  it("should never share an include tag between two types", () => {
    const includeTags = NATURAL_UNIT_TYPES.flatMap((entry) => entry.includeTags);

    expect(new Set(includeTags).size).toBe(includeTags.length);
  });

  it("should never include a tag that an exclusion list excludes", () => {
    const includeTags = NATURAL_UNIT_TYPES.flatMap((entry) => entry.includeTags);
    const excludeTags = [
      ...NATURAL_UNIT_PROCESSED_TAGS,
      ...NATURAL_UNIT_TYPES.flatMap((entry) => entry.excludeTags),
    ];

    expect(includeTags.filter((tag) => excludeTags.includes(tag))).toEqual([]);
  });
});
