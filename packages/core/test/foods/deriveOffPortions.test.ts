import fc from "fast-check";
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
import { isEstimatedPortion } from "../../src/foods/estimatedPortion";
import { inferBasis } from "../../src/foods/offRules";

import type { NutrientBasis } from "../../src/schemas/food";

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

  it("should open on an estimate, with the pack as a chip, when the energy is unknown", () => {
    expect(portionsFor(withoutServing(tinOfBeans))).toEqual([
      { label: "1 typical serving", grams: 120, ml: null, isDefault: true },
      { label: "1 can", grams: 415, ml: null, isDefault: false },
    ]);
  });

  it("should leave out a serving of exactly 100 g and open on the bar of a Mars bar", () => {
    expect(portionsFor(marsBarInABag, 450)).toEqual([
      { label: "1 bar", grams: 51, ml: null, isDefault: true },
    ]);
  });

  it("should return only the serving when the serving has the same words as the pack", () => {
    expect(portionsFor({ ...tinOfBeans, serving_size: "1 Can", serving_quantity: 200 })).toEqual([
      { label: "1 Can", grams: 200, ml: null, isDefault: true },
    ]);
  });

  it("should read a serving that is the whole bar as one bar", () => {
    expect(portionsFor(chocolateBar)).toEqual([
      { label: "1 bar", grams: 50, ml: null, isDefault: true },
    ]);
  });

  it("should return only the serving when the serving is the whole pot", () => {
    expect(portionsFor(yogurtPot)).toEqual([
      { label: "1 portion (140 g)", grams: 140, ml: null, isDefault: true },
    ]);
  });

  it("should read a serving that is the whole can in ml as one can", () => {
    expect(portionsFor(canOfCola)).toEqual([
      { label: "1 can", grams: null, ml: 330, isDefault: true },
    ]);
  });

  it("should leave out a serving of exactly 100 ml and open on one item of the multipack", () => {
    expect(portionsFor(multipackOfApplesauce, 45)).toEqual([
      { label: "1 item", grams: null, ml: 100, isDefault: true },
    ]);
  });

  it("should offer one item of a multipack after a different serving", () => {
    expect(
      portionsFor({ ...multipackOfApplesauce, serving_size: "50 ml", serving_quantity: 50 }),
    ).toEqual([
      { label: "1 serving", grams: null, ml: 50, isDefault: true },
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

    it.each([99, 101])("should skip the pack when the serving is %s g of 100 g", (grams) => {
      expect(portionsFor(bar(grams)).map((portion) => portion.label)).toEqual(["1 bar"]);
    });

    it("should leave out a serving of exactly 100 g and keep the pack", () => {
      expect(portionsFor(bar(100)).map((portion) => portion.label)).toEqual([
        "1 typical serving",
        "1 bar",
      ]);
    });

    it.each([98.9, 101.1])("should keep the pack when the serving is %s g of 100 g", (grams) => {
      expect(portionsFor(bar(grams)).map((portion) => portion.label)).toEqual([
        "1 serving",
        "1 bar",
      ]);
    });
  });

  describe("nothing to offer", () => {
    it("should open on an estimate without a serving or a pack size", () => {
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
      ).toEqual([{ label: "1 typical serving", grams: 100, ml: null, isDefault: true }]);
    });

    it("should return only the serving for a pack it does not read", () => {
      expect(portionsFor({ ...tinOfBeans, quantity: "400 g (240 g drained)" })).toEqual([
        { label: "0.5 can (207 g)", grams: 207, ml: null, isDefault: true },
      ]);
    });
  });

  it("should return exactly one default", () => {
    for (const product of [tinOfBeans, chocolateBar, loafOfSlicedBread, yogurtPot, canOfCola]) {
      expect(portionsFor(product).filter((portion) => portion.isDefault)).toHaveLength(1);
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
    ])(
      "should borrow nothing for %s, so it opens on an estimate",
      (_name, { categoriesTags, kcal }) => {
        const portions = deriveOffPortions({
          servingSize: undefined,
          servingQuantity: undefined,
          quantity: undefined,
          basis: "per_100g",
          packagingTags: undefined,
          categoriesTags,
          kcal,
        });

        expect(portions.map((portion) => portion.label)).toEqual(["1 typical serving"]);
      },
    );

    it("should borrow nothing when the energy is unknown, so it opens on an estimate", () => {
      expect(portionsFor(boxOfEggs, null)).toEqual([
        { label: "1 typical serving", grams: 100, ml: null, isDefault: true },
      ]);
    });

    it("should borrow nothing for a per 100 ml product, so it opens on an estimate in ml", () => {
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
      ).toEqual([{ label: "1 typical serving", grams: null, ml: 30, isDefault: true }]);
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
        { label: "1 serving", grams: 50, ml: null, isDefault: true },
        { label: "1 bar", grams: 25, ml: null, isDefault: false },
      ]);
    });

    it("should offer a loaf of sliced bread of 800 g as a chip behind an estimate, with no slice", () => {
      expect(portionsFor({ ...withoutServing(loafOfSlicedBread), quantity: "800 g" }, 250)).toEqual(
        [
          { label: "1 typical serving", grams: 50, ml: null, isDefault: true },
          { label: "1 loaf", grams: 800, ml: null, isDefault: false },
        ],
      );
    });

    it("should open a tin of 400 g beans on one can, and on an estimate when only the drained weight is known", () => {
      expect(portionsFor(withoutServing({ ...tinOfBeans, quantity: "400 g" }), 80)).toEqual([
        { label: "1 can", grams: 400, ml: null, isDefault: true },
      ]);
      expect(
        portionsFor(withoutServing({ ...tinOfBeans, quantity: "400 g (240 g drained)" }), 80),
      ).toEqual([{ label: "1 typical serving", grams: 120, ml: null, isDefault: true }]);
    });
  });
});

type Product = {
  servingSize?: string | undefined;
  servingQuantity?: number | undefined;
  quantity?: string | undefined;
  basis?: NutrientBasis;
  packagingTags?: string[] | undefined;
  categoriesTags?: string[] | undefined;
  kcal: number | null;
};

function derive(product: Product) {
  return deriveOffPortions({
    servingSize: product.servingSize,
    servingQuantity: product.servingQuantity,
    quantity: product.quantity,
    basis: product.basis ?? "per_100g",
    packagingTags: product.packagingTags,
    categoriesTags: product.categoriesTags,
    kcal: product.kcal,
  });
}

function theDefault(portions: ReturnType<typeof derive>) {
  const defaults = portions.filter((portion) => portion.isDefault);
  expect(defaults).toHaveLength(1);
  return defaults[0];
}

// Shaped as Open Food Facts holds them. The tags are the ones the rule reads.
const bigMacTags = ["en:meals", "en:sandwiches", "en:hamburgers", "en:fast-food"];

describe("the default portion of an Open Food Facts product", () => {
  it("should open a Big Mac with a serving of 240 g and a quantity of 240 g on 1 burger", () => {
    expect(
      derive({
        servingSize: "240 g",
        servingQuantity: 240,
        quantity: "240 g",
        categoriesTags: bigMacTags,
        kcal: 250,
      }),
    ).toEqual([{ label: "1 burger", grams: 240, ml: null, isDefault: true }]);
  });

  it("should open a Big Mac with no serving and a quantity of 232 g on 1 burger", () => {
    expect(derive({ quantity: "232 g", categoriesTags: bigMacTags, kcal: 250 })).toEqual([
      { label: "1 burger", grams: 232, ml: null, isDefault: true },
    ]);
  });

  it("should open a bar of 45 g on 1 bar", () => {
    expect(
      derive({
        servingSize: "45 g",
        servingQuantity: 45,
        quantity: "45 g",
        categoriesTags: ["en:snacks", "en:bars"],
        kcal: 480,
      }),
    ).toEqual([{ label: "1 bar", grams: 45, ml: null, isDefault: true }]);
  });

  it("should open 330 ml in a can on 1 can", () => {
    expect(
      derive({ quantity: "330 ml", basis: "per_100ml", packagingTags: ["en:can"], kcal: 42 }),
    ).toEqual([{ label: "1 can", grams: null, ml: 330, isDefault: true }]);
  });

  it("should open 330 ml with no packaging tag on 1 serving", () => {
    expect(derive({ quantity: "330 ml", basis: "per_100ml", kcal: 42 })).toEqual([
      { label: "1 serving", grams: null, ml: 330, isDefault: true },
    ]);
  });

  it("should open 400 g of soup on 1 can when the tags say so, else on 1 serving", () => {
    const soup = { quantity: "400 g", categoriesTags: ["en:soups"], kcal: 45 };

    expect(derive({ ...soup, packagingTags: ["en:can"] })).toEqual([
      { label: "1 can", grams: 400, ml: null, isDefault: true },
    ]);
    expect(derive(soup)).toEqual([{ label: "1 serving", grams: 400, ml: null, isDefault: true }]);
  });

  it("should open 6 x 25 g bars on 1 bar and crisps with no shape word on 1 item", () => {
    expect(
      derive({ quantity: "6 x 25 g", categoriesTags: ["en:snacks", "en:bars"], kcal: 450 }),
    ).toEqual([{ label: "1 bar", grams: 25, ml: null, isDefault: true }]);
    expect(derive({ quantity: "6 x 25 g", categoriesTags: ["en:crisps"], kcal: 520 })).toEqual([
      { label: "1 item", grams: 25, ml: null, isDefault: true },
    ]);
  });

  it("should open 2 kg of rice on a typical serving of about 75 g and keep the bag as a chip", () => {
    expect(
      derive({
        quantity: "2 kg",
        packagingTags: ["en:bag"],
        categoriesTags: ["en:cereals-and-potatoes", "en:rices"],
        kcal: 360,
      }),
    ).toEqual([
      { label: "1 typical serving", grams: 75, ml: null, isDefault: true },
      { label: "1 bag", grams: 2000, ml: null, isDefault: false },
    ]);
  });

  it("should open 500 g of pasta on a typical serving of about 75 g and keep the pack as a chip", () => {
    expect(derive({ quantity: "500 g", categoriesTags: ["en:pastas"], kcal: 350 })).toEqual([
      { label: "1 typical serving", grams: 75, ml: null, isDefault: true },
      { label: "1 pack", grams: 500, ml: null, isDefault: false },
    ]);
  });

  it("should open jam with a serving of 100 g on a typical serving of about 15 g", () => {
    expect(
      derive({
        servingSize: "1 serving (100 g)",
        servingQuantity: 100,
        quantity: "370 g",
        packagingTags: ["en:jar"],
        categoriesTags: ["en:spreads", "en:jams"],
        kcal: 250,
      }),
    ).toEqual([
      { label: "1 typical serving", grams: 15, ml: null, isDefault: true },
      { label: "1 jar", grams: 370, ml: null, isDefault: false },
    ]);
  });

  it("should open a product with no quantity, no serving and no tags on an estimate by energy", () => {
    expect(derive({ kcal: 200 })).toEqual([
      { label: "1 typical serving", grams: 100, ml: null, isDefault: true },
    ]);
  });

  it("should open a product with nothing at all on 1 typical serving of 100 g, or 100 ml for a drink", () => {
    expect(derive({ kcal: null })).toEqual([
      { label: "1 typical serving", grams: 100, ml: null, isDefault: true },
    ]);
    expect(derive({ kcal: null, basis: "per_100ml" })).toEqual([
      { label: "1 typical serving", grams: null, ml: 100, isDefault: true },
    ]);
  });
});

describe("a pack that is not the default", () => {
  it.each([
    ["a 2 kg bag of rice", { quantity: "2 kg", categoriesTags: ["en:rices"], kcal: 360 }],
    ["a 500 g bag of pasta", { quantity: "500 g", categoriesTags: ["en:pastas"], kcal: 350 }],
    [
      "a 250 g pack of butter",
      { quantity: "250 g", categoriesTags: ["en:dairies", "en:butters"], kcal: 740 },
    ],
    [
      "a 200 g chocolate bar",
      { quantity: "200 g", categoriesTags: ["en:chocolates", "en:bars"], kcal: 540 },
    ],
    [
      "a 180 g jar of mustard",
      {
        quantity: "180 g",
        packagingTags: ["en:jar"],
        categoriesTags: ["en:condiments", "en:mustards"],
        kcal: 120,
      },
    ],
  ])("should not open %s on the whole pack", (_name, product) => {
    const portions = derive(product);

    expect(theDefault(portions)?.label).toMatch(/^1 typical /);
    expect(portions.filter((portion) => !portion.isDefault)).toHaveLength(1);
  });

  it("should not open a 400 g bag of apples on the bag", () => {
    const portions = derive({
      quantity: "400 g",
      packagingTags: ["en:bag"],
      categoriesTags: ["en:fruits", "en:apples", "en:fresh-apples"],
      kcal: 52,
    });

    expect(theDefault(portions)?.label).toBe("1 medium");
    expect(portions.map((portion) => portion.label)).toContain("1 bag");
  });

  it("should not open on a pack above 450 g or 500 ml", () => {
    expect(theDefault(derive({ quantity: "451 g", kcal: 100 }))?.label).toBe("1 typical serving");
    expect(theDefault(derive({ quantity: "501 ml", basis: "per_100ml", kcal: 40 }))?.label).toBe(
      "1 typical serving",
    );
    expect(theDefault(derive({ quantity: "450 g", kcal: 100 }))?.label).toBe("1 serving");
    expect(theDefault(derive({ quantity: "500 ml", basis: "per_100ml", kcal: 40 }))?.label).toBe(
      "1 serving",
    );
  });

  it("should not open on a pack above 700 kcal", () => {
    expect(theDefault(derive({ quantity: "400 g", kcal: 175.1 }))?.label).toBe("1 typical serving");
    expect(theDefault(derive({ quantity: "400 g", kcal: 175 }))?.label).toBe("1 serving");
  });

  it("should open on a pack of at most 100 g when the food is 400 kcal per 100 or more", () => {
    expect(theDefault(derive({ quantity: "100 g", kcal: 400 }))?.label).toBe("1 serving");
    expect(theDefault(derive({ quantity: "101 g", kcal: 400 }))?.label).toBe("1 typical serving");
    expect(theDefault(derive({ quantity: "101 g", kcal: 399 }))?.label).toBe("1 serving");
  });

  it("should not open on a pack when the energy is unknown", () => {
    expect(theDefault(derive({ quantity: "100 g", kcal: null }))?.label).toBe("1 typical serving");
  });

  it.each([
    "en:condiments",
    "en:sauces",
    "en:spreads",
    "en:jams",
    "en:honeys",
    "en:spices",
    "en:herbs",
    "en:condiment-pastes",
    "en:vinegars",
    "en:fats",
    "en:vegetable-oils",
    "en:teas",
    "en:coffees",
    "en:sugars",
    "en:sweeteners",
    "en:salts",
    "en:cooking-helpers",
    "en:flours",
  ])("should not open on the pack of a product tagged %s", (tag) => {
    const portions = derive({ quantity: "100 g", categoriesTags: [tag], kcal: 100 });

    expect(theDefault(portions)?.label).toMatch(/^1 typical /);
    expect(portions.map((portion) => portion.label)).toContain("1 pack");
  });
});

describe("a serving", () => {
  it("should leave out a serving of exactly 100 g", () => {
    const portions = derive({ servingSize: "100 g", servingQuantity: 100, kcal: 200 });

    expect(portions).toEqual([
      { label: "1 typical serving", grams: 100, ml: null, isDefault: true },
    ]);
  });

  it("should leave out a serving of exactly 100 ml", () => {
    const portions = derive({
      servingSize: "100 ml",
      servingQuantity: 100,
      basis: "per_100ml",
      kcal: 40,
    });

    expect(portions).toEqual([
      { label: "1 typical serving", grams: null, ml: 200, isDefault: true },
    ]);
  });

  it("should keep a serving of 30 g with only its label changed", () => {
    expect(derive({ servingSize: "30g", servingQuantity: 30, kcal: 400 })).toEqual([
      { label: "1 serving", grams: 30, ml: null, isDefault: true },
    ]);
  });

  it.each([
    "30 gr",
    "30 grm",
    "30 grs",
    "30 gm",
    "30 gms",
    "30 grams",
    "30 gramme",
    "30 mls",
    "30 ltr",
    "30 g.",
  ])("should read a serving written %s as 1 serving", (servingSize) => {
    expect(derive({ servingSize, servingQuantity: 30, kcal: 400 })).toEqual([
      { label: "1 serving", grams: 30, ml: null, isDefault: true },
    ]);
  });

  it("should keep a label that has words in it", () => {
    expect(derive({ servingSize: "1 biscuit (15 g)", servingQuantity: 15, kcal: 480 })).toEqual([
      { label: "1 biscuit (15 g)", grams: 15, ml: null, isDefault: true },
    ]);
  });

  it("should name a serving after a pack of the same amount only when the pack has a real noun", () => {
    expect(
      derive({ servingSize: "30 g", servingQuantity: 30, quantity: "30 g", kcal: 400 }),
    ).toEqual([{ label: "1 serving", grams: 30, ml: null, isDefault: true }]);
  });
});

describe("an estimated default", () => {
  it("should read 1 typical <noun> and take the food's own basis", () => {
    for (const basis of ["per_100g", "per_100ml"] as const) {
      const portions = derive({ basis, kcal: 60 });
      const estimate = theDefault(portions);

      expect(estimate !== undefined && isEstimatedPortion(estimate.label)).toBe(true);
      expect(basis === "per_100g" ? estimate?.ml : estimate?.grams).toBeNull();
    }
  });

  it("should call a hamburger a typical burger even when it is also a sandwich", () => {
    expect(derive({ categoriesTags: ["en:sandwiches", "en:hamburgers"], kcal: 250 })).toEqual([
      { label: "1 typical burger", grams: 200, ml: null, isDefault: true },
    ]);
  });
});

describe("any product", () => {
  const MEASURE_ONLY =
    /^\s*~?[\d.,]+\s*(?:kgs?|mgs?|g|gr|grm|grs|grms|gm|gms|grams?|grammes?|ml|mls|cl|dl|l|ltr|litres?|liters?|oz|fl\.?\s?oz)\.?\s*$/i;
  const categoryPool = [
    "en:hamburgers",
    "en:sandwiches",
    "en:eggs",
    "en:chicken-eggs",
    "en:bars",
    "en:sliced-breads",
    "en:rices",
    "en:jams",
    "en:condiments",
    "en:fats",
    "en:fruits",
    "en:bananas",
    "en:canned-foods",
    "en:beverages",
    "en:yogurts",
  ];
  const packagingPool = ["en:can", "en:bottle", "en:bag", "en:box", "en:jar", "en:tray"];

  const product = fc.record({
    servingSize: fc.option(
      fc.constantFrom(
        "30 g",
        "30g",
        "30 gr",
        "30 grm",
        "30 gms",
        "30 grams",
        "30 ltr",
        "100 g",
        "240 ml",
        "1 serving",
        "1 bar (45 g)",
        " ",
        "5 oz",
      ),
      { nil: undefined },
    ),
    servingQuantity: fc.option(
      fc.oneof(fc.constantFrom(0, 30, 45, 100, 240), fc.double({ min: 0, max: 600, noNaN: true })),
      { nil: undefined },
    ),
    quantity: fc.option(
      fc.constantFrom("45 g", "232 g", "330 ml", "400 g", "6 x 25 g", "2 kg", "500 g", "1 L", "10"),
      { nil: undefined },
    ),
    basis: fc.constantFrom("per_100g", "per_100ml"),
    packagingTags: fc.option(fc.subarray(packagingPool), { nil: undefined }),
    categoriesTags: fc.option(fc.subarray(categoryPool), { nil: undefined }),
    kcal: fc.option(fc.double({ min: 0, max: 900, noNaN: true }), { nil: null }),
  });

  it("should get exactly one default and no portion that is only a measure", () => {
    fc.assert(
      fc.property(product, (input) => {
        const portions = derive(input);

        expect(portions.filter((portion) => portion.isDefault)).toHaveLength(1);
        expect(portions.some((portion) => MEASURE_ONLY.test(portion.label))).toBe(false);
        expect(
          portions.every((portion) => (portion.grams === null) !== (portion.ml === null)),
        ).toBe(true);
      }),
    );
  });
});
