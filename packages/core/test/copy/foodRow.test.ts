import { describe, expect, it } from "vitest";

import {
  FOOD_ROW,
  describeAddFood,
  describeDeleteFood,
  describeEditFood,
  describeFoodRowStats,
} from "../../src/copy";

describe("the food row copy", () => {
  it("should name the review flag, the swipe action and the energy unit as the boards do", () => {
    expect(FOOD_ROW).toEqual({
      needsReview: "Needs review",
      deleteAction: "Delete",
      energyUnit: "kcal",
      actionsColumn: "Actions",
      foodColumn: "Food",
      gramUnit: "g",
      quickAdd: "Quick add",
    });
  });

  describe("describeEditFood and describeDeleteFood", () => {
    it("should name the food the table row's Edit and Delete buttons act on", () => {
      expect(describeEditFood("Porridge oats")).toBe("Edit Porridge oats");
      expect(describeDeleteFood("Porridge oats")).toBe("Delete Porridge oats");
    });
  });

  describe("describeAddFood", () => {
    it("should name the food and the serving the add button logs", () => {
      expect(describeAddFood("Banana", "1 medium (100 g)")).toBe("Add Banana, 1 medium (100 g)");
    });

    it("should name only the food when there is no serving, with no comma left behind", () => {
      expect(describeAddFood("Banana")).toBe("Add Banana");
    });
  });

  describe("describeFoodRowStats", () => {
    it("should read the energy, then protein, carbohydrate and fat in that order, spelled out", () => {
      expect(describeFoodRowStats({ energy: "222", protein: "48", carbs: "0", fat: "3.3" })).toBe(
        "222 kilocalories, protein 48 grams, carbohydrate 0 grams, fat 3.3 grams",
      );
    });

    it("should use the singular for exactly one", () => {
      expect(describeFoodRowStats({ energy: "1", protein: "1", carbs: "1", fat: "1" })).toBe(
        "1 kilocalorie, protein 1 gram, carbohydrate 1 gram, fat 1 gram",
      );
    });

    it("should write the review flag in place of the macros when a food needs review", () => {
      expect(describeFoodRowStats({ energy: "130" })).toBe("130 kilocalories, Needs review");
    });

    it("should write only the review flag when a food has no energy either", () => {
      expect(describeFoodRowStats({})).toBe("Needs review");
    });
  });
});
