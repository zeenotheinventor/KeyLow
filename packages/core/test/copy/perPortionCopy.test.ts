import { describe, expect, it } from "vitest";

import {
  describeAmountBasis,
  describeBasis,
  describeLoggedAmount,
  describeNutritionHeading,
  describePer100Heading,
  describeSpokenBasis,
} from "../../src/copy";
import { describeFoodRow } from "../../src/search/describeFoodRow";
import { servingOfSearchHit } from "../../src/search/servingOfSearchHit";

// Every sentence a per portion food can be given. None may say a weight or "100", because the food has neither.
const bucketHit = {
  basis: "per_portion",
  kcal: 500,
  protein_g: 40,
  fat_g: 30,
  carbs_g: 20,
  default_portion_id: "00000000-0000-4000-8000-0000000000f2",
  default_portion_label: "1 bucket",
  default_portion_grams: null,
  default_portion_ml: null,
} as const;

describe("the wording of a food per portion", () => {
  describe("its basis", () => {
    it("should be 'per bucket' for a portion called '1 bucket'", () => {
      expect(describeBasis("per_portion", "1 bucket")).toBe("per bucket");
    });

    it("should keep the count when it is not 1", () => {
      expect(describeBasis("per_portion", "6 nuggets")).toBe("per 6 nuggets");
    });

    it("should keep a noun that counts nothing, in lower case", () => {
      expect(describeBasis("per_portion", "Box of 6")).toBe("per box of 6");
    });

    it("should be 'per portion' with no portion label to name", () => {
      expect(describeBasis("per_portion")).toBe("per portion");
    });

    it("should be read aloud the same way", () => {
      expect(describeSpokenBasis("per_portion", "1 bucket")).toBe("per bucket");
      expect(describeSpokenBasis("per_portion")).toBe("per portion");
    });

    it("should head the nutrition table with it", () => {
      expect(describeNutritionHeading("per_portion", "1 bucket")).toBe("Nutrition per bucket");
    });

    it("should head the list of values with it, capitalised", () => {
      expect(describePer100Heading("per_portion", "1 bucket")).toBe("Per bucket");
    });

    it("should leave the other bases as they were", () => {
      expect(describeBasis("per_100g", "1 bucket")).toBe("per 100 g");
      expect(describePer100Heading("per_100ml", "1 bucket")).toBe("Per 100 ml");
    });
  });

  describe("a search row", () => {
    it("should name the basis as 'per bucket'", () => {
      const row = describeFoodRow({ name: "Bucket", brand: null, ...bucketHit }, "buck");

      expect(row.basis).toBe("per bucket");
    });

    it("should caption its serving as '1 bucket'", () => {
      expect(servingOfSearchHit(bucketHit).caption).toBe("1 bucket");
    });

    it("should caption a serving with no label as '1 portion'", () => {
      const caption = servingOfSearchHit({ ...bucketHit, default_portion_label: null }).caption;

      expect(caption).toBe("1 portion");
    });
  });

  describe("a diary row", () => {
    const snapshotPortion = { label: "1 bucket" };

    it("should say '1 bucket' with no size in brackets", () => {
      expect(
        describeLoggedAmount({
          unit: "portion",
          quantity: 1,
          resolvedGrams: 0,
          portion: snapshotPortion,
        }),
      ).toBe("1 bucket");
    });

    it("should say the count for several", () => {
      expect(
        describeLoggedAmount({
          unit: "portion",
          quantity: 2,
          resolvedGrams: 0,
          portion: snapshotPortion,
        }),
      ).toBe("2 × 1 bucket");
    });
  });

  it("should never put a weight or 100 in any of its sentences", () => {
    const sentences = [
      describeBasis("per_portion", "1 bucket"),
      describeSpokenBasis("per_portion", "1 bucket"),
      describeNutritionHeading("per_portion", "1 bucket"),
      describePer100Heading("per_portion", "1 bucket"),
      describeBasis("per_portion"),
      describeAmountBasis({ unit: "portion", quantity: 1, portionLabel: "1 bucket" }),
      describeAmountBasis({ unit: "portion", quantity: 2, portionLabel: "1 bucket" }),
      servingOfSearchHit(bucketHit).caption,
      describeFoodRow({ name: "Bucket", brand: null, ...bucketHit }, "").basis ?? "",
    ];

    for (const sentence of sentences) {
      expect(sentence).not.toMatch(/ g\)|100|\(/);
    }
  });
});
