import { describe, expect, it } from "vitest";

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

function portionsFor(product: CapturedProduct) {
  return deriveOffPortions({
    servingSize: product.serving_size,
    servingQuantity: product.serving_quantity,
    quantity: product.quantity,
    basis: inferBasis({ quantity: product.quantity, servingSize: product.serving_size }),
    packagingTags: product.packaging_tags,
    categoriesTags: product.categories_tags,
  });
}

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
});
