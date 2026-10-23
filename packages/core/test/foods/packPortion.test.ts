import { describe, expect, it } from "vitest";

import {
  boxOfChocolateBars,
  chocolateBar,
  canOfCola,
  colaWithUnknownPackaging,
  loafOfSlicedBread,
  marsBarInABag,
  multipackOfApplesauce,
  tinOfBeans,
  twixInABag,
  yogurtPot,
} from "./offPackFixtures";
import { inferBasis } from "../../src/foods/offRules";
import { packPortion } from "../../src/foods/packPortion";
import { parseServingLabel } from "../../src/nutrition/labelDensity";

import type { NutrientBasis } from "../../src/schemas/food";

type PackFields = {
  quantity?: string | undefined;
  packaging_tags?: string[] | undefined;
  categories_tags?: string[] | undefined;
};

function packFor(
  product: PackFields,
  basis: NutrientBasis = inferBasis({ quantity: product.quantity, servingSize: undefined }),
) {
  return packPortion({
    quantity: product.quantity,
    basis,
    packagingTags: product.packaging_tags,
    categoriesTags: product.categories_tags,
  });
}

describe("packPortion", () => {
  describe("the whole pack", () => {
    it("should offer one can of 415 g for a tin of beans", () => {
      expect(packFor(tinOfBeans)).toEqual({
        label: "1 can",
        grams: 415,
        ml: null,
        isDefault: false,
      });
    });

    it("should offer the pack in millilitres on a per 100 ml food", () => {
      expect(packFor(canOfCola)).toEqual({
        label: "1 can",
        grams: null,
        ml: 330,
        isDefault: false,
      });
    });

    it("should offer one 140 g pot for a yogurt", () => {
      expect(packFor(yogurtPot)).toEqual({
        label: "1 pot",
        grams: 140,
        ml: null,
        isDefault: false,
      });
    });

    it("should offer one 500 g loaf for sliced bread", () => {
      expect(packFor(loafOfSlicedBread)).toEqual({
        label: "1 loaf",
        grams: 500,
        ml: null,
        isDefault: false,
      });
    });
  });

  describe("a multipack", () => {
    it("should offer one item of a multipack, never the whole multipack", () => {
      expect(packFor(multipackOfApplesauce)).toEqual({
        label: "1 item",
        grams: null,
        ml: 100,
        isDefault: false,
      });
    });

    it("should offer one item of a 6 x 25 g multipack", () => {
      expect(packFor({ quantity: "6 x 25 g" })).toEqual({
        label: "1 item",
        grams: 25,
        ml: null,
        isDefault: false,
      });
    });

    it("should not name an item from the outer box of a multipack", () => {
      expect(packFor({ quantity: "6 x 25 g", packaging_tags: ["en:box"] })?.label).toBe("1 item");
    });

    it.each(["en:bag", "en:tray", "en:box"])("should ignore %s on a multipack", (tag) => {
      expect(packFor({ quantity: "4 x 125 g", packaging_tags: [tag] })?.label).toBe("1 item");
    });

    it("should name the item when the outer box is tagged beside it", () => {
      expect(
        packFor({ quantity: "24 x 330 ml", packaging_tags: ["en:can", "en:box"] })?.label,
      ).toBe("1 can");
    });

    it.each([
      ["en:can", "can"],
      ["en:bottle", "bottle"],
      ["en:jar", "jar"],
      ["en:pot", "pot"],
      ["en:tube", "tube"],
    ])("should name an item of a multipack from %s as a %s", (tag, noun) => {
      expect(packFor({ quantity: "6 x 25 g", packaging_tags: [tag] })?.label).toBe(`1 ${noun}`);
    });

    it("should still name a single pack from its box", () => {
      expect(packFor({ quantity: "400 g", packaging_tags: ["en:box"] })?.label).toBe("1 box");
    });

    it("should name a bar of a multipack from its categories", () => {
      expect(
        packFor({ quantity: "6 x 25 g", packaging_tags: ["en:box"], categories_tags: ["en:bars"] })
          ?.label,
      ).toBe("1 bar");
    });

    it("should offer nothing for a quantity it does not read as a multipack", () => {
      expect(packFor(boxOfChocolateBars)).toBeNull();
    });
  });

  describe("sizes that are not offered", () => {
    it.each([
      { quantity: "400 g (240 g drained)", basis: "per_100g", reason: "a drained weight" },
      { quantity: "5 kg", basis: "per_100g", reason: "more than 2 kg" },
      { quantity: "2.5 l", basis: "per_100ml", reason: "more than 2 l" },
      { quantity: "3 g", basis: "per_100g", reason: "less than 5 g" },
      { quantity: "1 box", basis: "per_100g", reason: "no weight or volume" },
    ] as const)("should offer nothing for $quantity ($reason)", ({ quantity, basis }) => {
      expect(packFor({ quantity }, basis)).toBeNull();
    });

    it("should offer nothing when there is no quantity", () => {
      expect(packFor({})).toBeNull();
    });

    it("should offer nothing when the unit does not match the basis", () => {
      expect(packFor({ quantity: "330 ml" }, "per_100g")).toBeNull();
    });

    it("should offer exactly 2 kg", () => {
      expect(packFor({ quantity: "2 kg" })).toMatchObject({ grams: 2000 });
    });
  });

  describe("the noun from the packaging tags", () => {
    // Each tag is in the OFF packaging taxonomy, https://static.openfoodfacts.org/data/taxonomies/packaging.json
    // (also the packaging shapes taxonomy, packaging_shapes.json), checked on 2026-10-23.
    it.each([
      ["en:can", "can"],
      ["en:food-can", "can"],
      ["en:drink-can", "can"],
      ["en:bottle", "bottle"],
      ["en:jar", "jar"],
      ["en:pot", "pot"],
      ["en:tray", "tray"],
      ["en:tube", "tube"],
      ["en:box", "box"],
      ["en:bag", "bag"],
    ])("should name the pack from %s as a %s", (tag, noun) => {
      expect(packFor({ quantity: "400 g", packaging_tags: [tag] })?.label).toBe(`1 ${noun}`);
    });

    it("should use the noun when other tags name materials or free text", () => {
      expect(packFor(tinOfBeans)?.label).toBe("1 can");
      expect(packFor(yogurtPot)?.label).toBe("1 pot");
    });

    it("should count several tags for one noun as one noun", () => {
      expect(
        packFor({ quantity: "330 ml", packaging_tags: ["en:can", "en:drink-can"] })?.label,
      ).toBe("1 can");
    });

    it("should skip the packaging when it names two different nouns", () => {
      expect(packFor({ quantity: "400 g", packaging_tags: ["en:bottle", "en:can"] })?.label).toBe(
        "1 pack",
      );
    });

    it("should fall to the categories when the packaging names two different nouns", () => {
      expect(
        packFor({
          quantity: "400 g",
          packaging_tags: ["en:bottle", "en:can"],
          categories_tags: ["en:canned-foods"],
        })?.label,
      ).toBe("1 can");
    });

    it("should read a tag that is not a noun in the table as no noun", () => {
      expect(
        packFor({ quantity: "400 g", packaging_tags: ["en:plastic", "en:wrapper"] })?.label,
      ).toBe("1 pack");
    });

    it("should not read an inherited object property as a noun", () => {
      expect(
        packFor({ quantity: "400 g", packaging_tags: ["constructor", "toString"] })?.label,
      ).toBe("1 pack");
    });
  });

  describe("the noun from the categories", () => {
    // Each tag is in the OFF categories taxonomy, https://static.openfoodfacts.org/data/taxonomies/categories.json,
    // checked on 2026-10-23. OFF stores every ancestor of a category, so a row also matches its
    // descendants, which is why the rows are the narrow ones listed in packPortion.ts.
    it.each([
      ["en:bars", "bar"],
      ["en:chocolate-bars", "bar"],
      ["en:sliced-breads", "loaf"],
      ["en:yogurts", "pot"],
      ["en:canned-foods", "can"],
    ])("should name the pack from the category %s as a %s", (tag, noun) => {
      expect(packFor({ quantity: "400 g", categories_tags: [tag] })?.label).toBe(`1 ${noun}`);
    });

    it.each([
      ["Mars", marsBarInABag, 51],
      ["Twix", twixInABag, 50],
    ])("should name %s a bar although its packaging says bag", (_name, product, grams) => {
      expect(packFor(product)).toEqual({ label: "1 bar", grams, ml: null, isDefault: false });
    });

    it("should name a food shape before the packaging", () => {
      expect(
        packFor({ quantity: "400 g", packaging_tags: ["en:jar"], categories_tags: ["en:bars"] })
          ?.label,
      ).toBe("1 bar");
    });

    it("should name a chocolate bar from its categories", () => {
      expect(packFor(chocolateBar)).toEqual({
        label: "1 bar",
        grams: 50,
        ml: null,
        isDefault: false,
      });
    });

    it("should name a tin of beans from its categories when it has no packaging", () => {
      expect(packFor({ ...tinOfBeans, packaging_tags: undefined })?.label).toBe("1 can");
    });

    it("should name the same noun from two categories as that noun", () => {
      expect(
        packFor({ quantity: "50 g", categories_tags: ["en:bars", "en:chocolate-bars"] })?.label,
      ).toBe("1 bar");
    });

    it.each([
      ["food shapes", ["en:bars", "en:sliced-breads"]],
      ["pack categories", ["en:yogurts", "en:canned-foods"]],
    ])("should skip the categories when the %s name two different nouns", (_group, categories) => {
      expect(packFor({ quantity: "400 g", categories_tags: categories })?.label).toBe("1 pack");
    });

    it("should prefer the packaging over the categories", () => {
      expect(
        packFor({
          quantity: "400 g",
          packaging_tags: ["en:jar"],
          categories_tags: ["en:canned-foods"],
        })?.label,
      ).toBe("1 jar");
    });

    it("should never name a drink from its categories", () => {
      expect(packFor(colaWithUnknownPackaging)?.label).toBe("1 pack");
      expect(
        packFor({
          ...canOfCola,
          packaging_tags: undefined,
          categories_tags: ["en:beverages", "en:canned-foods"],
        })?.label,
      ).toBe("1 pack");
    });

    // en:yogurt-drinks is under en:yogurts, and its ancestors include en:beverages.
    it("should not call a drinking yogurt a pot", () => {
      expect(
        packFor({
          quantity: "250 ml",
          categories_tags: [
            ...yogurtPot.categories_tags,
            "en:yogurt-drinks",
            "en:dairy-drinks",
            "en:beverages",
          ],
        })?.label,
      ).toBe("1 pack");
    });

    // These are under en:canned-foods (en:pickles through en:legume-pickles) but come in tubes, cartons,
    // jars and tins.
    it.each(["en:tomato-pastes", "en:strained-tomatoes", "en:semi-preserved-foods", "en:pickles"])(
      "should not call a product in %s a can",
      (tag) => {
        expect(
          packFor({ quantity: "200 g", categories_tags: ["en:canned-foods", tag] })?.label,
        ).toBe("1 pack");
      },
    );

    it("should still name from the packaging for a drink", () => {
      expect(packFor(canOfCola)?.label).toBe("1 can");
    });
  });

  describe("no data", () => {
    it("should name a generic pack when the product has no packaging or categories", () => {
      expect(packFor({ quantity: "400 g" })).toEqual({
        label: "1 pack",
        grams: 400,
        ml: null,
        isDefault: false,
      });
    });
  });

  describe("the label", () => {
    const everyNoun = [
      "can",
      "bottle",
      "jar",
      "pot",
      "tray",
      "tube",
      "box",
      "bag",
      "bar",
      "loaf",
      "pack",
      "item",
    ] as const;
    const nounTags: Record<(typeof everyNoun)[number], PackFields> = {
      can: { packaging_tags: ["en:can"] },
      bottle: { packaging_tags: ["en:bottle"] },
      jar: { packaging_tags: ["en:jar"] },
      pot: { packaging_tags: ["en:pot"] },
      tray: { packaging_tags: ["en:tray"] },
      tube: { packaging_tags: ["en:tube"] },
      box: { packaging_tags: ["en:box"] },
      bag: { packaging_tags: ["en:bag"] },
      bar: { categories_tags: ["en:bars"] },
      loaf: { categories_tags: ["en:sliced-breads"] },
      pack: {},
      item: { quantity: "6 x 25 g" },
    };

    it.each(everyNoun)(
      "should be the words only for a %s, with no digit but the leading 1",
      (noun) => {
        const label = packFor({ quantity: "400 g", ...nounTags[noun] })?.label;
        expect(label).toBe(`1 ${noun}`);
        expect(label).toMatch(/^1 [a-z]+$/);
      },
    );

    it.each(everyNoun)(
      "should never be read as a density by parseServingLabel for a %s",
      (noun) => {
        expect(parseServingLabel(`1 ${noun}`)).toBeNull();
      },
    );
  });
});
