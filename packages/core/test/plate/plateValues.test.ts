import { describe, expect, it } from "vitest";

import {
  EATEN_TODAY_KCAL,
  banana,
  chickenAndRice,
  greekYoghurt,
  naan,
  readyMeal,
  semiSkimmedMilk,
} from "./sample";
import { formatCalories, formatGrams } from "../../src/format";
import {
  addToPlate,
  canLogPlate,
  isPlateItemValid,
  plateItemOfHit,
  plateItemOfRecipe,
  plateItemValues,
  plateTotals,
  setPlateQuantity,
} from "../../src/plate";

import type { PlateItem } from "../../src/plate";

// plate · open: Chicken and rice 1 serving, Greek yoghurt 1 pot, Banana 1 medium, Semi-skimmed milk 200 ml.
const openPlate = (): PlateItem[] =>
  setPlateQuantity(
    [
      plateItemOfRecipe({ key: "recipe", recipe: chickenAndRice }),
      plateItemOfHit("yoghurt", greekYoghurt),
      plateItemOfHit("banana", banana),
      plateItemOfHit("milk", semiSkimmedMilk),
    ],
    "milk",
    "200",
  );

describe("plateItemValues", () => {
  it("should be the amount times the values for one of the unit", () => {
    const [milk] = setPlateQuantity([plateItemOfHit("milk", semiSkimmedMilk)], "milk", "300");

    expect(milk).toBeDefined();
    if (milk !== undefined) {
      expect(plateItemValues(milk).kcal).toBeCloseTo(138, 6);
      expect(formatCalories(plateItemValues(milk).kcal)).toBe("138");
    }
  });

  it.each(["", "0", "-1", "abc"])("should be 0 for the amount %j", (text) => {
    const [milk] = setPlateQuantity([plateItemOfHit("milk", semiSkimmedMilk)], "milk", text);

    expect(milk).toBeDefined();
    if (milk !== undefined) {
      expect(plateItemValues(milk)).toEqual({ kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
      expect(isPlateItemValid(milk)).toBe(false);
    }
  });

  it("should be invalid when the amount reads as a number but its values do not", () => {
    const pot = plateItemOfHit("pot", greekYoghurt);
    const [huge] = setPlateQuantity([pot], "pot", `1${"0".repeat(307)}`);

    expect(huge).toBeDefined();
    if (huge !== undefined) {
      expect(Number.isFinite(huge.quantity) && huge.quantity > 0).toBe(true);
      expect(isPlateItemValid(huge)).toBe(false);
      expect(plateItemValues(huge)).toEqual({ kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
      expect(canLogPlate([huge])).toBe(false);
    }
  });

  it("should be 0 for an amount too large to work out", () => {
    const [milk] = setPlateQuantity(
      [plateItemOfHit("milk", semiSkimmedMilk)],
      "milk",
      "9".repeat(400),
    );

    expect(milk).toBeDefined();
    if (milk !== undefined) {
      expect(plateItemValues(milk).kcal).toBe(0);
      expect(isPlateItemValid(milk)).toBe(false);
    }
  });
});

describe("plateTotals", () => {
  it("should be 658 kcal, 57 g protein, 79 g carbs and 12 g fat for the plate · open sample", () => {
    const totals = plateTotals(openPlate());

    expect(formatCalories(totals.kcal)).toBe("658");
    expect(formatGrams(totals.protein_g)).toBe("57");
    expect(formatGrams(totals.carbs_g)).toBe("79");
    expect(formatGrams(totals.fat_g)).toBe("12");
    expect(totals.count).toBe(4);
  });

  it("should take the day to 1,697 kcal with the plate", () => {
    expect(formatCalories(EATEN_TODAY_KCAL)).toBe("1,039");
    expect(formatCalories(EATEN_TODAY_KCAL + plateTotals(openPlate()).kcal)).toBe("1,697");
  });

  it("should follow the milk to 300 ml: the row 138 kcal, the plate 704 kcal, the day 1,743", () => {
    const plate = setPlateQuantity(openPlate(), "milk", "300");
    const milk = plate.find((item) => item.key === "milk");

    expect(milk).toBeDefined();
    if (milk !== undefined) {
      expect(formatCalories(plateItemValues(milk).kcal)).toBe("138");
    }
    const totals = plateTotals(plate);
    expect(formatCalories(totals.kcal)).toBe("704");
    expect(formatCalories(EATEN_TODAY_KCAL + totals.kcal)).toBe("1,743");
  });

  it("should take the over plate to 2,280 kcal for the day", () => {
    const plate = [
      plateItemOfHit("meal", readyMeal),
      plateItemOfHit("naan", naan),
      plateItemOfHit("yoghurt", greekYoghurt),
      plateItemOfHit("banana", banana),
    ];

    expect(formatCalories(EATEN_TODAY_KCAL + plateTotals(plate).kcal)).toBe("2,280");
  });

  it("should leave an invalid row's share out, but still count the row", () => {
    const totals = plateTotals(setPlateQuantity(openPlate(), "milk", ""));

    expect(formatCalories(totals.kcal)).toBe("566");
    expect(totals.count).toBe(4);
  });

  it("should be 0 for an empty plate", () => {
    expect(plateTotals([])).toEqual({ count: 0, kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
  });

  it("should count a merged row once", () => {
    const plate = addToPlate(
      [plateItemOfHit("a", greekYoghurt)],
      plateItemOfHit("b", greekYoghurt),
    );

    expect(plateTotals(plate).count).toBe(1);
    expect(plateTotals(plate).kcal).toBeCloseTo(194, 6);
  });
});

describe("canLogPlate", () => {
  it("should be true for a plate of valid amounts", () => {
    expect(canLogPlate(openPlate())).toBe(true);
  });

  it("should be false for an empty plate", () => {
    expect(canLogPlate([])).toBe(false);
  });

  it("should be false while any row's amount is empty, 0, negative or not a number", () => {
    for (const text of ["", "0", "-3", "x"]) {
      expect(canLogPlate(setPlateQuantity(openPlate(), "banana", text))).toBe(false);
    }
  });

  it("should be true again once the amount is fixed", () => {
    const broken = setPlateQuantity(openPlate(), "banana", "");

    expect(canLogPlate(setPlateQuantity(broken, "banana", "2"))).toBe(true);
  });
});
