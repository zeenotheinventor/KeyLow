import { describe, expect, it } from "vitest";

import { henEggTags, realProducts } from "./naturalUnitFixtures";
import {
  canOfCola,
  chocolateBar,
  loafOfSlicedBread,
  marsBarInABag,
  multipackOfApplesauce,
  tinOfBeans,
  withoutServing,
  yogurtPot,
  type CapturedProduct,
} from "./offPackFixtures";
import { deriveOffPortions } from "../../src/foods/deriveOffPortions";
import { inferBasis } from "../../src/foods/offRules";

function portionsFor(product: CapturedProduct, kcal: number | null = null) {
  return deriveOffPortions({
    servingSize: product.serving_size,
    servingQuantity: product.serving_quantity,
    quantity: product.quantity,
    basis: inferBasis({ quantity: product.quantity, servingSize: product.serving_size }),
    packagingTags: product.packaging_tags,
    categoriesTags: product.categories_tags,
    kcal,
  });
}

// 3282070015314, a real box of ten free-range hen eggs. The tags and the energy are as OFF holds them. The
// quantity is the bare count the ticket describes: it has no unit, so there is no pack to read.
const boxOfEggs: CapturedProduct = {
  code: "3282070015314",
  product_name: "10 oeufs plein air Label Rouge",
  quantity: "10",
  packaging_tags: ["en:cardboard", "en:box"],
  categories_tags: henEggTags,
};
const boxOfEggsKcal = 140;

const eggSizes = [
  { label: "1 small", grams: 38, ml: null, isDefault: false },
  { label: "1 medium", grams: 44, ml: null, isDefault: false },
  { label: "1 large", grams: 50, ml: null, isDefault: true },
  { label: "1 extra large", grams: 56, ml: null, isDefault: false },
];

describe("deriveOffPortions", () => {
  it("should return the serving then the pack for a tin of beans", () => {
    expect(portionsFor(tinOfBeans)).toEqual([
      { label: "0.5 can (207 g)", grams: 207, ml: null, isDefault: true },
      { label: "1 can", grams: 415, ml: null, isDefault: false },
    ]);
  });

  it("should return the serving then the pack for a loaf of sliced bread", () => {
    expect(portionsFor(loafOfSlicedBread)).toEqual([
      { label: "25 g (1 tranche)", grams: 25, ml: null, isDefault: true },
      { label: "1 loaf", grams: 500, ml: null, isDefault: false },
    ]);
  });

  it("should return only the pack, not as the default, when there is no serving", () => {
    expect(portionsFor(withoutServing(tinOfBeans))).toEqual([
      { label: "1 can", grams: 415, ml: null, isDefault: false },
    ]);
  });

  it("should offer the bar after a 100 g serving of a Mars bar", () => {
    expect(portionsFor(marsBarInABag)).toEqual([
      { label: "100 g", grams: 100, ml: null, isDefault: true },
      { label: "1 bar", grams: 51, ml: null, isDefault: false },
    ]);
  });

  it("should return only the serving when the serving has the same words as the pack", () => {
    expect(portionsFor({ ...tinOfBeans, serving_size: "1 Can", serving_quantity: 200 })).toEqual([
      { label: "1 Can", grams: 200, ml: null, isDefault: true },
    ]);
  });

  it("should return only the serving when the serving is the whole bar", () => {
    expect(portionsFor(chocolateBar)).toEqual([
      { label: "50 g", grams: 50, ml: null, isDefault: true },
    ]);
  });

  it("should return only the serving when the serving is the whole pot", () => {
    expect(portionsFor(yogurtPot)).toEqual([
      { label: "1 portion (140 g)", grams: 140, ml: null, isDefault: true },
    ]);
  });

  it("should return only the serving when the serving is the whole can in ml", () => {
    expect(portionsFor(canOfCola)).toEqual([
      { label: "330 g", grams: null, ml: 330, isDefault: true },
    ]);
  });

  it("should return only the serving when it is one item of a multipack", () => {
    expect(portionsFor(multipackOfApplesauce)).toEqual([
      { label: "1 container (100 mL)", grams: null, ml: 100, isDefault: true },
    ]);
  });

  it("should offer one item of a multipack after a different serving", () => {
    expect(
      portionsFor({ ...multipackOfApplesauce, serving_size: "50 ml", serving_quantity: 50 }),
    ).toEqual([
      { label: "50 ml", grams: null, ml: 50, isDefault: true },
      { label: "1 item", grams: null, ml: 100, isDefault: false },
    ]);
  });

  describe("a serving close to the pack", () => {
    const bar = (servingQuantity: number): CapturedProduct => ({
      ...chocolateBar,
      quantity: "100 g",
      serving_size: `${servingQuantity} g`,
      serving_quantity: servingQuantity,
    });

    it.each([99, 100, 101])("should skip the pack when the serving is %s g of 100 g", (grams) => {
      expect(portionsFor(bar(grams)).map((portion) => portion.label)).toEqual([`${grams} g`]);
    });

    it.each([98.9, 101.1])("should keep the pack when the serving is %s g of 100 g", (grams) => {
      expect(portionsFor(bar(grams)).map((portion) => portion.label)).toEqual([
        `${grams} g`,
        "1 bar",
      ]);
    });
  });

  describe("nothing to offer", () => {
    it("should return no portions without a serving or a pack size", () => {
      expect(
        deriveOffPortions({
          servingSize: undefined,
          servingQuantity: undefined,
          quantity: "5 kg",
          basis: "per_100g",
          packagingTags: undefined,
          categoriesTags: undefined,
          kcal: null,
        }),
      ).toEqual([]);
    });

    it("should return only the serving for a pack it does not read", () => {
      expect(portionsFor({ ...tinOfBeans, quantity: "400 g (240 g drained)" })).toEqual([
        { label: "0.5 can (207 g)", grams: 207, ml: null, isDefault: true },
      ]);
    });
  });

  it("should never return more than one default", () => {
    for (const product of [tinOfBeans, chocolateBar, loafOfSlicedBread, yogurtPot, canOfCola]) {
      expect(
        portionsFor(product).filter((portion) => portion.isDefault).length,
      ).toBeLessThanOrEqual(1);
    }
  });

  describe("borrowed natural units", () => {
    const servingOfEgg = { serving_size: "1 egg (60 g)", serving_quantity: 60 };

    it("should open a box of eggs with no serving on the four sizes, large the default", () => {
      expect(portionsFor(boxOfEggs, boxOfEggsKcal)).toEqual(eggSizes);
    });

    it("should keep the serving as the only default of a box of eggs", () => {
      expect(portionsFor({ ...boxOfEggs, ...servingOfEgg }, boxOfEggsKcal)).toEqual([
        { label: "1 egg (60 g)", grams: 60, ml: null, isDefault: true },
        ...eggSizes.map((size) => ({ ...size, isDefault: false })),
      ]);
    });

    it("should skip a borrowed size that has the same label as the serving, ignoring case", () => {
      expect(
        portionsFor({ ...boxOfEggs, serving_size: "1 LARGE", serving_quantity: 52 }, boxOfEggsKcal),
      ).toEqual([
        { label: "1 LARGE", grams: 52, ml: null, isDefault: true },
        { label: "1 small", grams: 38, ml: null, isDefault: false },
        { label: "1 medium", grams: 44, ml: null, isDefault: false },
        { label: "1 extra large", grams: 56, ml: null, isDefault: false },
      ]);
    });

    it("should list the serving, then the pack, then the borrowed sizes, the pack never the default", () => {
      const { categoriesTags, kcal } = realProducts.bagOfBananas;

      expect(
        portionsFor(
          {
            code: "01768558",
            product_name: "5 Fairtrade Bananas",
            quantity: "700 g",
            packaging_tags: ["en:plastic", "en:bag"],
            categories_tags: categoriesTags,
            serving_size: "1 banana (120 g)",
            serving_quantity: 120,
          },
          kcal,
        ),
      ).toEqual([
        { label: "1 banana (120 g)", grams: 120, ml: null, isDefault: true },
        { label: "1 bag", grams: 700, ml: null, isDefault: false },
        { label: "1 small", grams: 101, ml: null, isDefault: false },
        { label: "1 medium", grams: 118, ml: null, isDefault: false },
        { label: "1 large", grams: 136, ml: null, isDefault: false },
      ]);
    });

    it("should make the borrowed default the only default when there is a pack but no serving", () => {
      const { categoriesTags, kcal } = realProducts.bagOfBananas;

      expect(
        portionsFor(
          {
            code: "01768558",
            product_name: "5 Fairtrade Bananas",
            quantity: "700 g",
            packaging_tags: ["en:plastic", "en:bag"],
            categories_tags: categoriesTags,
          },
          kcal,
        ),
      ).toEqual([
        { label: "1 bag", grams: 700, ml: null, isDefault: false },
        { label: "1 small", grams: 101, ml: null, isDefault: false },
        { label: "1 medium", grams: 118, ml: null, isDefault: true },
        { label: "1 large", grams: 136, ml: null, isDefault: false },
      ]);
    });

    it("should give fresh garlic a clove when its energy is in the band", () => {
      const { categoriesTags } = realProducts.garlicBulbs;

      expect(
        deriveOffPortions({
          servingSize: undefined,
          servingQuantity: undefined,
          quantity: undefined,
          basis: "per_100g",
          packagingTags: undefined,
          categoriesTags,
          kcal: 110,
        }),
      ).toEqual([{ label: "1 clove", grams: 3, ml: null, isDefault: true }]);
    });

    it.each([
      ["garlic bulbs with the energy OFF holds for them", realProducts.garlicBulbs],
      ["banana chips", realProducts.bananaChips],
      ["frozen chopped garlic", realProducts.frozenChoppedGarlic],
      // In-band energy, so only the tags can rule it out.
      [
        "garlic powder",
        {
          categoriesTags: [
            "en:garlic-powders",
            "en:garlics-and-their-products",
            "en:dried-products",
            "en:garlics",
          ],
          kcal: 110,
        },
      ],
    ])("should borrow nothing for %s", (_name, { categoriesTags, kcal }) => {
      expect(
        deriveOffPortions({
          servingSize: undefined,
          servingQuantity: undefined,
          quantity: undefined,
          basis: "per_100g",
          packagingTags: undefined,
          categoriesTags,
          kcal,
        }),
      ).toEqual([]);
    });

    it("should borrow nothing when the energy is unknown", () => {
      expect(portionsFor(boxOfEggs, null)).toEqual([]);
    });

    it("should borrow nothing for a per 100 ml product", () => {
      expect(
        deriveOffPortions({
          servingSize: undefined,
          servingQuantity: undefined,
          quantity: undefined,
          basis: "per_100ml",
          packagingTags: undefined,
          categoriesTags: henEggTags,
          kcal: boxOfEggsKcal,
        }),
      ).toEqual([]);
    });

    it("should never return more than one default for any borrowed case", () => {
      const { categoriesTags, kcal } = realProducts.bagOfBananas;
      for (const portions of [
        portionsFor(boxOfEggs, boxOfEggsKcal),
        portionsFor({ ...boxOfEggs, ...servingOfEgg }, boxOfEggsKcal),
        portionsFor({ ...tinOfBeans, categories_tags: categoriesTags }, kcal),
      ]) {
        expect(portions.filter((portion) => portion.isDefault)).toHaveLength(
          portions.length === 0 ? 0 : 1,
        );
      }
    });
  });

  describe("the pack alone for products that never borrow", () => {
    it("should offer one bar of a multipack of chocolate bars after the serving", () => {
      expect(portionsFor({ ...chocolateBar, quantity: "6 x 25 g" }, 520)).toEqual([
        { label: "50 g", grams: 50, ml: null, isDefault: true },
        { label: "1 bar", grams: 25, ml: null, isDefault: false },
      ]);
    });

    it("should offer a loaf of sliced bread of 800 g as the loaf only, with no slice", () => {
      expect(portionsFor({ ...withoutServing(loafOfSlicedBread), quantity: "800 g" }, 250)).toEqual(
        [{ label: "1 loaf", grams: 800, ml: null, isDefault: false }],
      );
    });

    it("should offer a tin of 400 g beans as one can, and no can when only the drained weight is known", () => {
      expect(portionsFor(withoutServing({ ...tinOfBeans, quantity: "400 g" }), 80)).toEqual([
        { label: "1 can", grams: 400, ml: null, isDefault: false },
      ]);
      expect(
        portionsFor(withoutServing({ ...tinOfBeans, quantity: "400 g (240 g drained)" }), 80),
      ).toEqual([]);
    });
  });
});
