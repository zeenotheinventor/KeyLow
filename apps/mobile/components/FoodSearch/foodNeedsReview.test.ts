import { foodNeedsReview } from "./foodNeedsReview";

const complete = {
  kcal: 95,
  protein_g: 1.2,
  fat_g: 0.1,
  carbs_g: 20.3,
  quality: {},
};

describe("foodNeedsReview", () => {
  it("should be false for a food with all its values", () => {
    expect(foodNeedsReview(complete)).toBe(false);
  });

  it("should be true for a food flagged suspect, whatever its values", () => {
    expect(foodNeedsReview({ ...complete, quality: { suspect: true } })).toBe(true);
  });

  it.each(["kcal", "protein_g", "fat_g", "carbs_g"] as const)(
    "should be true for a food missing %s",
    (field) => {
      expect(foodNeedsReview({ ...complete, [field]: null })).toBe(true);
    },
  );

  it("should be false for a food that is only missing fibre, which a log does not need", () => {
    expect(foodNeedsReview({ ...complete, quality: { fields_missing: ["fibre_g"] } })).toBe(false);
  });

  it("should count a nutrient of 0 as given", () => {
    expect(foodNeedsReview({ ...complete, carbs_g: 0 })).toBe(false);
  });
});
