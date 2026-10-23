import { describe, expect, it } from "vitest";

import { readPackSize } from "../../src/foods/packSize";

describe("readPackSize", () => {
  describe("reads a single pack", () => {
    it.each([
      ["400 g", "per_100g", { itemCount: 1, itemAmount: 400, unit: "g" }],
      ["400g", "per_100g", { itemCount: 1, itemAmount: 400, unit: "g" }],
      ["400 G", "per_100g", { itemCount: 1, itemAmount: 400, unit: "g" }],
      ["  400 g  ", "per_100g", { itemCount: 1, itemAmount: 400, unit: "g" }],
      ["1.5 kg", "per_100g", { itemCount: 1, itemAmount: 1500, unit: "g" }],
      ["1,5 kg", "per_100g", { itemCount: 1, itemAmount: 1500, unit: "g" }],
      ["0.75 kg", "per_100g", { itemCount: 1, itemAmount: 750, unit: "g" }],
      ["2 kg", "per_100g", { itemCount: 1, itemAmount: 2000, unit: "g" }],
      ["5 g", "per_100g", { itemCount: 1, itemAmount: 5, unit: "g" }],
      ["330 ml", "per_100ml", { itemCount: 1, itemAmount: 330, unit: "ml" }],
      ["330ml", "per_100ml", { itemCount: 1, itemAmount: 330, unit: "ml" }],
      ["75 cl", "per_100ml", { itemCount: 1, itemAmount: 750, unit: "ml" }],
      ["33 cl", "per_100ml", { itemCount: 1, itemAmount: 330, unit: "ml" }],
      ["1 l", "per_100ml", { itemCount: 1, itemAmount: 1000, unit: "ml" }],
      ["1 L", "per_100ml", { itemCount: 1, itemAmount: 1000, unit: "ml" }],
      ["0.33 l", "per_100ml", { itemCount: 1, itemAmount: 330, unit: "ml" }],
      ["1,5 l", "per_100ml", { itemCount: 1, itemAmount: 1500, unit: "ml" }],
      ["1.5kg", "per_100g", { itemCount: 1, itemAmount: 1500, unit: "g" }],
      ["1.500 kg", "per_100g", { itemCount: 1, itemAmount: 1500, unit: "g" }],
      ["0,330 l", "per_100ml", { itemCount: 1, itemAmount: 330, unit: "ml" }],
    ] as const)("should read %s on %s as %j", (quantity, basis, expected) => {
      expect(readPackSize(quantity, basis)).toEqual(expected);
    });
  });

  describe("reads a multipack as a count of equal items", () => {
    it.each([
      ["6 x 25 g", "per_100g", { itemCount: 6, itemAmount: 25, unit: "g" }],
      ["6x25g", "per_100g", { itemCount: 6, itemAmount: 25, unit: "g" }],
      ["6 × 25 g", "per_100g", { itemCount: 6, itemAmount: 25, unit: "g" }],
      ["6 X 25 G", "per_100g", { itemCount: 6, itemAmount: 25, unit: "g" }],
      ["4 x 0.5 kg", "per_100g", { itemCount: 4, itemAmount: 500, unit: "g" }],
      ["12 x 33 cl", "per_100ml", { itemCount: 12, itemAmount: 330, unit: "ml" }],
      ["6 x 1,5 l", "per_100ml", { itemCount: 6, itemAmount: 1500, unit: "ml" }],
      ["1 x 400 g", "per_100g", { itemCount: 1, itemAmount: 400, unit: "g" }],
      ["100 x 5 g", "per_100g", { itemCount: 100, itemAmount: 5, unit: "g" }],
    ] as const)("should read %s on %s as %j", (quantity, basis, expected) => {
      expect(readPackSize(quantity, basis)).toEqual(expected);
    });
  });

  describe("reads the spelled-out units", () => {
    it.each([
      ["400 grams", "per_100g", { itemCount: 1, itemAmount: 400, unit: "g" }],
      ["400 gram", "per_100g", { itemCount: 1, itemAmount: 400, unit: "g" }],
      ["1.5 kilograms", "per_100g", { itemCount: 1, itemAmount: 1500, unit: "g" }],
      ["1 kilogram", "per_100g", { itemCount: 1, itemAmount: 1000, unit: "g" }],
      ["330 millilitres", "per_100ml", { itemCount: 1, itemAmount: 330, unit: "ml" }],
      ["330 millilitre", "per_100ml", { itemCount: 1, itemAmount: 330, unit: "ml" }],
      ["1 litre", "per_100ml", { itemCount: 1, itemAmount: 1000, unit: "ml" }],
      ["1,5 litres", "per_100ml", { itemCount: 1, itemAmount: 1500, unit: "ml" }],
      ["1 liter", "per_100ml", { itemCount: 1, itemAmount: 1000, unit: "ml" }],
      ["1.5 liters", "per_100ml", { itemCount: 1, itemAmount: 1500, unit: "ml" }],
      ["6 x 250 grams", "per_100g", { itemCount: 6, itemAmount: 250, unit: "g" }],
    ] as const)("should read %s on %s as %j", (quantity, basis, expected) => {
      expect(readPackSize(quantity, basis)).toEqual(expected);
    });
  });

  describe("reads through unusual spacing", () => {
    it.each([
      ["400\u00a0g", "per_100g", { itemCount: 1, itemAmount: 400, unit: "g" }],
      ["400\u202fg", "per_100g", { itemCount: 1, itemAmount: 400, unit: "g" }],
      ["6\u00a0×\u00a025\u00a0g", "per_100g", { itemCount: 6, itemAmount: 25, unit: "g" }],
      ["6\u202f×\u202f25\u202fg", "per_100g", { itemCount: 6, itemAmount: 25, unit: "g" }],
      ["400   g", "per_100g", { itemCount: 1, itemAmount: 400, unit: "g" }],
      ["6x 25g", "per_100g", { itemCount: 6, itemAmount: 25, unit: "g" }],
    ] as const)("should read %j on %s as %j", (quantity, basis, expected) => {
      expect(readPackSize(quantity, basis)).toEqual(expected);
    });
  });

  describe("ignores the estimated sign and the net wording", () => {
    it.each([
      ["400 g e", "per_100g", { itemCount: 1, itemAmount: 400, unit: "g" }],
      ["400 g℮", "per_100g", { itemCount: 1, itemAmount: 400, unit: "g" }],
      ["400 g ℮", "per_100g", { itemCount: 1, itemAmount: 400, unit: "g" }],
      ["400ge", "per_100g", { itemCount: 1, itemAmount: 400, unit: "g" }],
      ["400 g net", "per_100g", { itemCount: 1, itemAmount: 400, unit: "g" }],
      ["400 g net weight", "per_100g", { itemCount: 1, itemAmount: 400, unit: "g" }],
      ["net 400 g", "per_100g", { itemCount: 1, itemAmount: 400, unit: "g" }],
      ["Net weight 400 g", "per_100g", { itemCount: 1, itemAmount: 400, unit: "g" }],
      ["Net weight: 400 g", "per_100g", { itemCount: 1, itemAmount: 400, unit: "g" }],
      ["330 ml e", "per_100ml", { itemCount: 1, itemAmount: 330, unit: "ml" }],
      ["6 x 25 g e", "per_100g", { itemCount: 6, itemAmount: 25, unit: "g" }],
    ] as const)("should read %s on %s as %j", (quantity, basis, expected) => {
      expect(readPackSize(quantity, basis)).toEqual(expected);
    });
  });

  describe("returns null when it cannot tell which weight the per-100 figures describe", () => {
    it.each([
      ["a drained weight", "400 g (240 g drained)", "per_100g"],
      ["a drained weight with only one measure", "240 g drained", "per_100g"],
      ["a solids weight", "400 g (solids 240 g)", "per_100g"],
      ["a drain word", "drain 240 g", "per_100g"],
      ["a French drained weight", "400 g (égoutté 240 g)", "per_100g"],
      ["a French drained weight without accents", "400 g (egoutte 240 g)", "per_100g"],
      ["two measures of the same pack", "1 kg (2 x 500 g)", "per_100g"],
      ["two different measures", "400 g (14 oz)", "per_100g"],
      ["a weight and a volume", "400 g / 350 ml", "per_100g"],
      ["two measures on a volume", "1 l (4 x 25 cl)", "per_100ml"],
      ["a range", "400-500 g", "per_100g"],
    ] as const)("should return null for %s", (_name, quantity, basis) => {
      expect(readPackSize(quantity, basis)).toBeNull();
    });
  });

  describe("returns null for the wrong unit kind", () => {
    it.each([
      ["330 ml", "per_100g"],
      ["75 cl", "per_100g"],
      ["1 l", "per_100g"],
      ["6 x 33 cl", "per_100g"],
      ["400 g", "per_100ml"],
      ["1 kg", "per_100ml"],
      ["6 x 25 g", "per_100ml"],
    ] as const)("should return null for %s on %s", (quantity, basis) => {
      expect(readPackSize(quantity, basis)).toBeNull();
    });
  });

  describe("returns null for units it does not read", () => {
    it.each([
      ["14 oz", "per_100g"],
      ["1 lb", "per_100g"],
      ["12 fl oz", "per_100ml"],
      ["6 eggs", "per_100g"],
      ["12 pieces", "per_100g"],
      ["6 x 2 pieces", "per_100g"],
      ["6", "per_100g"],
      ["400", "per_100g"],
      ["6 x 25", "per_100g"],
      ["g", "per_100g"],
      ["400 gr", "per_100g"],
      ["33 dl", "per_100ml"],
      ["400 g approx", "per_100g"],
      ["400 g.", "per_100g"],
    ] as const)("should return null for %s on %s", (quantity, basis) => {
      expect(readPackSize(quantity, basis)).toBeNull();
    });
  });

  describe("returns null for nonsense numbers", () => {
    it.each([
      ["0 g", "per_100g"],
      ["-400 g", "per_100g"],
      ["0 x 25 g", "per_100g"],
      ["-6 x 25 g", "per_100g"],
      ["6 x 0 g", "per_100g"],
      ["6 x -25 g", "per_100g"],
      ["2.5 x 100 g", "per_100g"],
      ["6,5 x 25 g", "per_100g"],
      ["101 x 5 g", "per_100g"],
      ["1000 x 25 g", "per_100g"],
      ["abc g", "per_100g"],
      ["1.2.3 kg", "per_100g"],
    ] as const)("should return null for %s on %s", (quantity, basis) => {
      expect(readPackSize(quantity, basis)).toBeNull();
    });
  });

  describe("returns null when a thousands separator could make the amount wrong", () => {
    it.each([
      ["5,000 g", "per_100g"],
      ["6.000 g", "per_100g"],
      ["12,500 g", "per_100g"],
      ["1,000 g", "per_100g"],
      ["5,000 ml", "per_100ml"],
      ["5.000 ml", "per_100ml"],
      ["5,000 cl", "per_100ml"],
      ["6 x 5,000 g", "per_100g"],
    ] as const)("should return null for %s on %s", (quantity, basis) => {
      expect(readPackSize(quantity, basis)).toBeNull();
    });
  });

  describe("returns null when an item is outside the retail range", () => {
    it.each([
      ["4 g", "per_100g"],
      ["4.9 g", "per_100g"],
      ["4 ml", "per_100ml"],
      ["0.4 cl", "per_100ml"],
      ["6 x 4 g", "per_100g"],
      ["5 kg", "per_100g"],
      ["2.1 kg", "per_100g"],
      ["2001 g", "per_100g"],
      ["5 l", "per_100ml"],
      ["2001 ml", "per_100ml"],
      ["2 x 5 kg", "per_100g"],
    ] as const)("should return null for %s on %s", (quantity, basis) => {
      expect(readPackSize(quantity, basis)).toBeNull();
    });
  });

  describe("returns null without a usable quantity", () => {
    it.each([[undefined], [""], ["   "], ["e"], ["net"]] as const)(
      "should return null for %j",
      (quantity) => {
        expect(readPackSize(quantity, "per_100g")).toBeNull();
      },
    );
  });

  it("should return null for a quantity longer than 64 characters", () => {
    expect(readPackSize(`400${" ".repeat(70)}g`, "per_100g")).toBeNull();
  });
});
