import { describe, expect, it } from "vitest";

import { describeMacros } from "../../src/search";

describe("describeMacros", () => {
  it("should format each value with formatGrams", () => {
    expect(describeMacros({ protein_g: 32, fat_g: 2.2, carbs_g: 0 })).toMatchObject({
      protein: "32",
      fat: "2.2",
      carbs: "0",
    });
    expect(describeMacros({ protein_g: 29.8, fat_g: 12.34, carbs_g: 9.96 })).toMatchObject({
      protein: "30",
      fat: "12",
      carbs: "10",
    });
  });

  it("should spell the words out in the accessible description", () => {
    expect(describeMacros({ protein_g: 32, fat_g: 2.2, carbs_g: 0 }).accessibleDescription).toBe(
      "protein 32 grams, fat 2.2 grams, carbohydrate 0 grams",
    );
  });

  it("should say gram for exactly one", () => {
    expect(describeMacros({ protein_g: 1, fat_g: 1.04, carbs_g: 2 }).accessibleDescription).toBe(
      "protein 1 gram, fat 1 gram, carbohydrate 2 grams",
    );
  });

  it("should read a missing value as not given and give no display value, never 0", () => {
    const macros = describeMacros({ protein_g: null, fat_g: 2.2, carbs_g: null });

    expect(macros.protein).toBeNull();
    expect(macros.carbs).toBeNull();
    expect(macros.fat).toBe("2.2");
    expect(macros.accessibleDescription).toBe(
      "protein not given, fat 2.2 grams, carbohydrate not given",
    );
  });

  it("should read every missing value as not given", () => {
    expect(
      describeMacros({ protein_g: null, fat_g: null, carbs_g: null }).accessibleDescription,
    ).toBe("protein not given, fat not given, carbohydrate not given");
  });
});
