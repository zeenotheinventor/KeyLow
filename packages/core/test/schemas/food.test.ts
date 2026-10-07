import { describe, expect, it } from "vitest";

import {
  customFoodInputSchema,
  foodPortionSchema,
  foodQualitySchema,
  foodRowSchema,
  foodSourceSchema,
  nutrientBasisSchema,
} from "../../src/schemas/food";

function without(record: Record<string, unknown>, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([entryKey]) => entryKey !== key));
}

const goldenFoodRow = {
  id: "0b1b6f0e-6c1c-4f3e-9d3b-2c1d5a8f7e10",
  source: "off",
  source_ref: "5000159407236",
  owner_id: null,
  name: "Milk Chocolate Bar",
  brand: "Cadbury",
  barcode: "5000159407236",
  basis: "per_100g",
  density_g_per_ml: null,
  kcal: 534,
  protein_g: 7.3,
  fat_g: 30,
  sat_fat_g: 18,
  carbs_g: 56,
  sugars_g: 55,
  fibre_g: 1.9,
  salt_g: 0.24,
  micros: {},
  quality: { kcal_derived: false },
  food_group: null,
  fetched_at: "2026-10-07T12:30:45.123456+00:00",
  deleted_at: null,
  created_at: "2026-10-07T12:30:45.123456+00:00",
};

const goldenPortion = {
  id: "7d2a1c52-0f3b-4a5e-8f64-5b3a9c1e2d40",
  food_id: goldenFoodRow.id,
  owner_id: null,
  label: "1 bar",
  grams: 45,
  ml: null,
  is_default: true,
  position: 0,
  created_at: "2026-10-07T12:30:45.123456+00:00",
};

const goldenCustomFood = {
  name: "Overnight oats",
  brand: "Home",
  barcode: "4006381333931",
  basis: "per_100g",
  density_g_per_ml: 1.05,
  kcal: 150,
  protein_g: 6,
  fat_g: 4,
  carbs_g: 22,
  fibre_g: 3,
  portions: [
    { label: "1 bowl", grams: 250, isDefault: true },
    { label: "1 cup", ml: 240, isDefault: false },
  ],
};

describe("foodSourceSchema", () => {
  it.each(["off", "cofid", "user"])("should accept %s", (source) => {
    expect(foodSourceSchema.parse(source)).toBe(source);
  });

  it("should reject an unknown source", () => {
    expect(foodSourceSchema.safeParse("usda").success).toBe(false);
  });
});

describe("nutrientBasisSchema", () => {
  it.each(["per_100g", "per_100ml"])("should accept %s", (basis) => {
    expect(nutrientBasisSchema.parse(basis)).toBe(basis);
  });

  it("should reject an unknown basis", () => {
    expect(nutrientBasisSchema.safeParse("per_serving").success).toBe(false);
  });
});

describe("foodQualitySchema", () => {
  it("should parse an empty object, the neutral value", () => {
    expect(foodQualitySchema.parse({})).toEqual({});
  });

  it("should parse every key of the amended key set", () => {
    const full = {
      kcal_derived: true,
      suspect: true,
      fields_missing: ["fibre_g"],
      fibre_method: "englyst",
      trace_fields: ["fat_g"],
      per_serving_converted: true,
      carbs_convention: "us_total",
    };
    expect(foodQualitySchema.parse(full)).toEqual(full);
  });

  it("should leave absent keys absent rather than defaulting them", () => {
    expect(foodQualitySchema.parse({ suspect: true })).toEqual({ suspect: true });
  });

  it.each(["aoac", "englyst"])("should accept fibre_method %s", (fibreMethod) => {
    expect(foodQualitySchema.parse({ fibre_method: fibreMethod }).fibre_method).toBe(fibreMethod);
  });

  it("should reject an unknown fibre_method", () => {
    expect(foodQualitySchema.safeParse({ fibre_method: "other" }).success).toBe(false);
  });

  it.each(["eu", "us_total"])("should accept carbs_convention %s", (carbsConvention) => {
    expect(foodQualitySchema.parse({ carbs_convention: carbsConvention }).carbs_convention).toBe(
      carbsConvention,
    );
  });

  it("should reject an unknown carbs_convention", () => {
    expect(foodQualitySchema.safeParse({ carbs_convention: "uk" }).success).toBe(false);
  });

  it("should reject a non-boolean flag", () => {
    expect(foodQualitySchema.safeParse({ suspect: "yes" }).success).toBe(false);
  });

  it("should reject an array of non-strings", () => {
    expect(foodQualitySchema.safeParse({ fields_missing: [1] }).success).toBe(false);
  });
});

describe("foodRowSchema", () => {
  it("should parse a golden OFF row", () => {
    expect(foodRowSchema.parse(goldenFoodRow)).toEqual(goldenFoodRow);
  });

  it("should parse a user-owned row with null provenance fields", () => {
    const userRow = {
      ...goldenFoodRow,
      source: "user",
      source_ref: null,
      owner_id: "1c9a2f64-8b4e-4c70-a1d5-3e6f7a8b9c0d",
      barcode: null,
      brand: null,
      fetched_at: null,
      quality: {},
    };
    expect(foodRowSchema.parse(userRow)).toEqual(userRow);
  });

  it("should parse a row whose nutrient columns are all null", () => {
    const nulls = {
      ...goldenFoodRow,
      kcal: null,
      protein_g: null,
      fat_g: null,
      sat_fat_g: null,
      carbs_g: null,
      sugars_g: null,
      fibre_g: null,
      salt_g: null,
    };
    expect(foodRowSchema.parse(nulls)).toEqual(nulls);
  });

  it("should accept the fixed-seed ids that are not RFC 4122 variants", () => {
    const seeded = { ...goldenFoodRow, id: "00000000-0000-0000-0000-000000000001" };
    expect(foodRowSchema.safeParse(seeded).success).toBe(true);
  });

  it("should accept micros as an arbitrary object", () => {
    const withMicros = { ...goldenFoodRow, micros: { sodium_mg: 120, vitamin_c_mg: 4.5 } };
    expect(foodRowSchema.parse(withMicros).micros).toEqual({ sodium_mg: 120, vitamin_c_mg: 4.5 });
  });

  it("should accept nested JSON values in micros", () => {
    const micros = { a: 1, b: "text", c: null, d: true, e: [1, { f: 2 }], g: { h: { i: [] } } };
    expect(foodRowSchema.parse({ ...goldenFoodRow, micros }).micros).toEqual(micros);
  });

  it("should reject a function value in micros", () => {
    expect(foodRowSchema.safeParse({ ...goldenFoodRow, micros: { a: () => 1 } }).success).toBe(
      false,
    );
  });

  it("should reject an undefined value in micros", () => {
    expect(foodRowSchema.safeParse({ ...goldenFoodRow, micros: { a: undefined } }).success).toBe(
      false,
    );
  });

  it("should drop the DB-only search column", () => {
    const parsed = foodRowSchema.parse({ ...goldenFoodRow, search: "'milk':1A" });
    expect(parsed).not.toHaveProperty("search");
  });

  it.each(["kcal", "protein_g", "fat_g", "sat_fat_g", "carbs_g", "sugars_g", "fibre_g", "salt_g"])(
    "should reject a negative %s",
    (column) => {
      expect(foodRowSchema.safeParse({ ...goldenFoodRow, [column]: -1 }).success).toBe(false);
    },
  );

  it("should reject a density of zero", () => {
    expect(foodRowSchema.safeParse({ ...goldenFoodRow, density_g_per_ml: 0 }).success).toBe(false);
  });

  it("should reject a missing micros object, because the row always carries it", () => {
    expect(foodRowSchema.safeParse(without(goldenFoodRow, "micros")).success).toBe(false);
  });

  it("should reject a missing quality object, because the row always carries it", () => {
    expect(foodRowSchema.safeParse(without(goldenFoodRow, "quality")).success).toBe(false);
  });

  it("should reject a null name", () => {
    expect(foodRowSchema.safeParse({ ...goldenFoodRow, name: null }).success).toBe(false);
  });

  it("should reject a null basis", () => {
    expect(foodRowSchema.safeParse({ ...goldenFoodRow, basis: null }).success).toBe(false);
  });

  it("should reject an unknown source", () => {
    expect(foodRowSchema.safeParse({ ...goldenFoodRow, source: "usda" }).success).toBe(false);
  });

  it("should reject an id that is not a uuid", () => {
    expect(foodRowSchema.safeParse({ ...goldenFoodRow, id: "not-a-uuid" }).success).toBe(false);
  });
});

describe("foodPortionSchema", () => {
  it("should parse a golden gram portion", () => {
    expect(foodPortionSchema.parse(goldenPortion)).toEqual(goldenPortion);
  });

  it("should parse a millilitre portion on a user food", () => {
    const millilitrePortion = {
      ...goldenPortion,
      owner_id: "1c9a2f64-8b4e-4c70-a1d5-3e6f7a8b9c0d",
      grams: null,
      ml: 250,
      is_default: false,
      position: 2,
    };
    expect(foodPortionSchema.parse(millilitrePortion)).toEqual(millilitrePortion);
  });

  it("should reject a portion with both grams and ml", () => {
    expect(foodPortionSchema.safeParse({ ...goldenPortion, ml: 100 }).success).toBe(false);
  });

  it("should reject a portion with neither grams nor ml", () => {
    expect(foodPortionSchema.safeParse({ ...goldenPortion, grams: null }).success).toBe(false);
  });

  it("should reject zero grams", () => {
    expect(foodPortionSchema.safeParse({ ...goldenPortion, grams: 0 }).success).toBe(false);
  });

  it("should reject negative ml", () => {
    expect(foodPortionSchema.safeParse({ ...goldenPortion, grams: null, ml: -5 }).success).toBe(
      false,
    );
  });

  it("should reject a non-integer position", () => {
    expect(foodPortionSchema.safeParse({ ...goldenPortion, position: 1.5 }).success).toBe(false);
  });
});

describe("customFoodInputSchema", () => {
  it("should parse a golden input", () => {
    expect(customFoodInputSchema.parse(goldenCustomFood)).toEqual(goldenCustomFood);
  });

  it("should parse the minimal input", () => {
    const minimal = {
      name: "Apple",
      basis: "per_100g",
      kcal: 52,
      protein_g: 0.3,
      fat_g: 0.2,
      carbs_g: 14,
      portions: [],
    };
    expect(customFoodInputSchema.parse(minimal)).toEqual(minimal);
  });

  it("should trim the name", () => {
    expect(customFoodInputSchema.parse({ ...goldenCustomFood, name: "  Oats  " }).name).toBe(
      "Oats",
    );
  });

  it("should trim the brand", () => {
    expect(customFoodInputSchema.parse({ ...goldenCustomFood, brand: "  Home  " }).brand).toBe(
      "Home",
    );
  });

  it.each(["", "   "])("should normalise the blank brand %j to undefined", (brand) => {
    expect(customFoodInputSchema.parse({ ...goldenCustomFood, brand }).brand).toBeUndefined();
  });

  it("should reject an empty name", () => {
    expect(customFoodInputSchema.safeParse({ ...goldenCustomFood, name: "" }).success).toBe(false);
  });

  it("should reject a name that is only whitespace", () => {
    expect(customFoodInputSchema.safeParse({ ...goldenCustomFood, name: "   " }).success).toBe(
      false,
    );
  });

  it("should accept a name of 200 characters", () => {
    expect(
      customFoodInputSchema.safeParse({ ...goldenCustomFood, name: "a".repeat(200) }).success,
    ).toBe(true);
  });

  it("should reject a name of 201 characters", () => {
    expect(
      customFoodInputSchema.safeParse({ ...goldenCustomFood, name: "a".repeat(201) }).success,
    ).toBe(false);
  });

  describe("barcode", () => {
    it("should store a UPC-A in canonical 13-digit form", () => {
      expect(
        customFoodInputSchema.parse({ ...goldenCustomFood, barcode: "036000291452" }).barcode,
      ).toBe("0036000291452");
    });

    it("should strip spaces and hyphens", () => {
      expect(
        customFoodInputSchema.parse({ ...goldenCustomFood, barcode: "4006-3813 33931" }).barcode,
      ).toBe("4006381333931");
    });

    it("should leave the barcode undefined when it is omitted", () => {
      expect(customFoodInputSchema.parse(without(goldenCustomFood, "barcode"))).not.toHaveProperty(
        "barcode",
      );
    });

    it("should reject a barcode with non-digit characters", () => {
      expect(
        customFoodInputSchema.safeParse({ ...goldenCustomFood, barcode: "40063813abc31" }).success,
      ).toBe(false);
    });

    it("should reject a barcode with a wrong check digit", () => {
      expect(
        customFoodInputSchema.safeParse({ ...goldenCustomFood, barcode: "4006381333932" }).success,
      ).toBe(false);
    });

    it("should report the invalid barcode on the barcode path", () => {
      const result = customFoodInputSchema.safeParse({ ...goldenCustomFood, barcode: "123" });
      expect(result.error?.issues[0]?.path).toEqual(["barcode"]);
    });
  });

  it.each(["kcal", "protein_g", "fat_g", "carbs_g", "fibre_g"])(
    "should reject a negative %s",
    (key) => {
      expect(customFoodInputSchema.safeParse({ ...goldenCustomFood, [key]: -1 }).success).toBe(
        false,
      );
    },
  );

  it.each(["kcal", "protein_g", "fat_g", "carbs_g"])(
    "should reject a missing %s, because the four macros are required",
    (key) => {
      expect(customFoodInputSchema.safeParse(without(goldenCustomFood, key)).success).toBe(false);
    },
  );

  it("should reject a null macro, because the form must supply a number", () => {
    expect(customFoodInputSchema.safeParse({ ...goldenCustomFood, kcal: null }).success).toBe(
      false,
    );
  });

  it("should reject a density of zero", () => {
    expect(
      customFoodInputSchema.safeParse({ ...goldenCustomFood, density_g_per_ml: 0 }).success,
    ).toBe(false);
  });

  it("should reject an unknown basis", () => {
    expect(customFoodInputSchema.safeParse({ ...goldenCustomFood, basis: "per_cup" }).success).toBe(
      false,
    );
  });

  describe("portions", () => {
    it("should reject two default portions", () => {
      const portions = [
        { label: "1 bowl", grams: 250, isDefault: true },
        { label: "1 cup", grams: 120, isDefault: true },
      ];
      expect(customFoodInputSchema.safeParse({ ...goldenCustomFood, portions }).success).toBe(
        false,
      );
    });

    it("should accept no default portion", () => {
      const portions = [
        { label: "1 bowl", grams: 250, isDefault: false },
        { label: "1 cup", grams: 120, isDefault: false },
      ];
      expect(customFoodInputSchema.safeParse({ ...goldenCustomFood, portions }).success).toBe(true);
    });

    it("should reject a portion with both grams and ml", () => {
      const portions = [{ label: "1 bowl", grams: 250, ml: 240, isDefault: false }];
      expect(customFoodInputSchema.safeParse({ ...goldenCustomFood, portions }).success).toBe(
        false,
      );
    });

    it("should reject a portion with neither grams nor ml", () => {
      const portions = [{ label: "1 bowl", isDefault: false }];
      expect(customFoodInputSchema.safeParse({ ...goldenCustomFood, portions }).success).toBe(
        false,
      );
    });

    it("should reject a portion with zero grams", () => {
      const portions = [{ label: "1 bowl", grams: 0, isDefault: false }];
      expect(customFoodInputSchema.safeParse({ ...goldenCustomFood, portions }).success).toBe(
        false,
      );
    });

    it("should reject a portion with an empty label", () => {
      const portions = [{ label: "", grams: 10, isDefault: false }];
      expect(customFoodInputSchema.safeParse({ ...goldenCustomFood, portions }).success).toBe(
        false,
      );
    });

    it("should require isDefault on every portion", () => {
      const portions = [{ label: "1 bowl", grams: 250 }];
      expect(customFoodInputSchema.safeParse({ ...goldenCustomFood, portions }).success).toBe(
        false,
      );
    });
  });
});
