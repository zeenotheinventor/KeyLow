import { describe, expect, it } from "vitest";

import { servingOfSearchHit } from "../../src/search";

const banana = {
  basis: "per_100g",
  kcal: 95,
  protein_g: 1.2,
  fat_g: 0.1,
  carbs_g: 20.3,
  default_portion_label: null,
  default_portion_grams: null,
  default_portion_ml: null,
} as const;

describe("servingOfSearchHit", () => {
  describe("with no default portion", () => {
    it("should be 100 g of a per 100 g food, with its values as they are", () => {
      const serving = servingOfSearchHit(banana);

      expect(serving.caption).toBe("100 g");
      expect(serving.kcal).toBeCloseTo(95);
      expect(serving.protein_g).toBeCloseTo(1.2);
      expect(serving.fat_g).toBeCloseTo(0.1);
      expect(serving.carbs_g).toBeCloseTo(20.3);
    });

    it("should be 100 ml of a per 100 ml food", () => {
      const serving = servingOfSearchHit({ ...banana, basis: "per_100ml", kcal: 46 });

      expect(serving.caption).toBe("100 ml");
      expect(serving.kcal).toBeCloseTo(46);
    });
  });

  describe("with a default portion", () => {
    it("should scale the values to the portion and name it with its size", () => {
      const serving = servingOfSearchHit({
        ...banana,
        default_portion_label: "1 medium",
        default_portion_grams: 150,
      });

      expect(serving.caption).toBe("1 medium (150 g)");
      expect(serving.kcal).toBeCloseTo(142.5);
      expect(serving.carbs_g).toBeCloseTo(30.45);
    });

    it("should scale a portion in millilitres of a per 100 ml food", () => {
      const serving = servingOfSearchHit({
        ...banana,
        basis: "per_100ml",
        kcal: 46,
        default_portion_label: "1 glass",
        default_portion_ml: 200,
      });

      expect(serving.caption).toBe("1 glass (200 ml)");
      expect(serving.kcal).toBeCloseTo(92);
    });

    it("should not write a size a label already gives", () => {
      expect(
        servingOfSearchHit({
          ...banana,
          default_portion_label: "30 g",
          default_portion_grams: 30,
        }).caption,
      ).toBe("30 g");
    });

    it("should fall back to 100 g for a portion that is not whole, rather than guess", () => {
      expect(servingOfSearchHit({ ...banana, default_portion_label: "1 medium" }).caption).toBe(
        "100 g",
      );
      expect(
        servingOfSearchHit({
          ...banana,
          default_portion_label: "1 medium",
          default_portion_grams: 100,
          default_portion_ml: 100,
        }).caption,
      ).toBe("100 g");
    });
  });

  it("should keep a nutrient the food does not give as not given, never 0", () => {
    const serving = servingOfSearchHit({ ...banana, carbs_g: null, kcal: null });

    expect(serving.carbs_g).toBeNull();
    expect(serving.kcal).toBeNull();
    expect(serving.protein_g).toBeCloseTo(1.2);
  });
});
