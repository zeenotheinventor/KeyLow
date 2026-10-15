import { buildFood, buildFoodPortion } from "@keylow/core/testing";

import { previewAmount } from "./previewAmount";

const noAmount = { caption: "For this amount", values: null };

const chicken = buildFood({
  name: "Chicken breast, grilled",
  kcal: 148,
  protein_g: 32,
  carbs_g: 0,
  fat_g: 2.2,
});
const medium = buildFoodPortion({ id: "portion-medium", label: "1 medium", grams: 100 });
const glass = buildFoodPortion({ id: "portion-glass", label: "1 glass", grams: null, ml: 200 });

describe("previewAmount", () => {
  describe("in grams", () => {
    it("should scale the food's values to the amount and caption it", () => {
      const { amount, hero } = previewAmount(chicken, [], "g", "150");

      expect(amount).toEqual({ unit: "g", quantity: 150 });
      expect(hero.caption).toBe("For 150 g");
      expect(hero.values?.kcal).toBeCloseTo(222);
      expect(hero.values?.protein_g).toBeCloseTo(48);
      expect(hero.values?.carbs_g).toBe(0);
      expect(hero.values?.fat_g).toBeCloseTo(3.3);
    });

    it("should read a decimal comma, as the food forms do", () => {
      const { amount } = previewAmount(chicken, [], "g", "12,5");

      expect(amount).toEqual({ unit: "g", quantity: 12.5 });
    });
  });

  describe("in portions", () => {
    it("should resolve one portion to its size and caption it with its name", () => {
      const { amount, hero } = previewAmount(chicken, [medium], "portion-medium", "1");

      expect(amount).toEqual({ unit: "portion", quantity: 1, portion: medium });
      expect(hero.caption).toBe("For 1 medium (100 g)");
      expect(hero.values?.kcal).toBeCloseTo(148);
    });

    it("should multiply the size by the count", () => {
      const { hero } = previewAmount(chicken, [medium], "portion-medium", "2");

      expect(hero.caption).toBe("For 2 × 1 medium (200 g)");
      expect(hero.values?.kcal).toBeCloseTo(296);
    });

    it("should caption a portion measured in millilitres in millilitres", () => {
      const drink = buildFood({ basis: "per_100ml", kcal: 40 });
      const { hero } = previewAmount(drink, [glass], "portion-glass", "1");

      expect(hero.caption).toBe("For 1 glass (200 ml)");
      expect(hero.values?.kcal).toBeCloseTo(80);
    });
  });

  describe("in millilitres", () => {
    it("should scale a per 100 ml food by the amount", () => {
      const drink = buildFood({ basis: "per_100ml", kcal: 40 });
      const { amount, hero } = previewAmount(drink, [], "ml", "250");

      expect(amount).toEqual({ unit: "ml", quantity: 250 });
      expect(hero.caption).toBe("For 250 ml");
      expect(hero.values?.kcal).toBeCloseTo(100);
    });

    it("should cross between mass and volume with the food's density", () => {
      const syrup = buildFood({ basis: "per_100ml", kcal: 300, density_g_per_ml: 1.5 });
      const { hero } = previewAmount(syrup, [], "g", "150");

      expect(hero.values?.kcal).toBeCloseTo(300);
    });
  });

  describe("a macro the food does not give", () => {
    it("should stay not given, never 0", () => {
      const { hero } = previewAmount(buildFood({ carbs_g: null }), [], "g", "100");

      expect(hero.values?.carbs_g).toBeNull();
      expect(hero.values?.protein_g).toBe(10);
    });
  });

  describe("with no valid amount", () => {
    it.each(["", "  ", "0", "0.0", "-5", "abc", "1e3", "1,000", "Infinity", "9".repeat(400)])(
      "should give no amount and dashes for %j",
      (text) => {
        const { amount, hero } = previewAmount(chicken, [], "g", text);

        expect(amount).toBeNull();
        expect(hero).toEqual(noAmount);
      },
    );

    it("should give no amount for a unit the food does not have", () => {
      const { amount, hero } = previewAmount(chicken, [medium], "portion-gone", "1");

      expect(amount).toBeNull();
      expect(hero).toEqual(noAmount);
    });

    it("should give no amount when the size overflows, rather than throw", () => {
      const huge = buildFoodPortion({ id: "portion-huge", grams: 1e300 });

      expect(() => previewAmount(chicken, [huge], "portion-huge", "1e300")).not.toThrow();
      expect(previewAmount(chicken, [huge], "portion-huge", "9".repeat(300)).amount).toBeNull();
    });
  });
});
