import { describe, expect, it } from "vitest";

import { henEggTags } from "./naturalUnitFixtures";
import { fixtures, normalisableFixtures, normaliseOk } from "./offFixtures";
import {
  normaliseOffCandidate,
  normaliseOffProduct,
  offProductPayloadSchema,
} from "../../src/foods/off";
import { foodPortionSchema, foodRowSchema } from "../../src/schemas/food";
import { offCandidateSchema } from "../../src/schemas/off";

const noNutrients = {
  kcal: null,
  protein_g: null,
  fat_g: null,
  sat_fat_g: null,
  carbs_g: null,
  sugars_g: null,
  fibre_g: null,
  salt_g: null,
};

const allFourMacrosMissing = {
  suspect: true,
  fields_missing: ["kcal", "protein_g", "fat_g", "carbs_g"],
};

const goldens = [
  {
    name: "kcal present, with kJ, sodium and extra keys that must not leak into micros",
    raw: fixtures.kcalPresent,
    expected: {
      ok: true,
      food: {
        ...noNutrients,
        barcode: "5000000010011",
        name: "Test Oat Crunch",
        brand: "Northfield Mills",
        basis: "per_100g",
        density_g_per_ml: null,
        kcal: 380,
        protein_g: 9.5,
        fat_g: 7.5,
        sat_fat_g: 1.5,
        carbs_g: 62,
        sugars_g: 0,
        fibre_g: 8,
        salt_g: 0.25,
        micros: { "vitamin-c": 0.0012, calcium: 0.06 },
        quality: {},
        food_group: "breakfast-cereals",
      },
      portions: [
        { label: "40 g", grams: 40, ml: null, isDefault: true },
        { label: "1 pack", grams: 500, ml: null, isDefault: false },
      ],
    },
  },
  {
    name: "kJ only",
    raw: fixtures.kjOnly,
    expected: {
      ok: true,
      food: {
        ...noNutrients,
        barcode: "5000000010028",
        name: "Kilojoule Bar",
        brand: "Northfield Mills",
        basis: "per_100g",
        density_g_per_ml: null,
        kcal: 250,
        protein_g: 10,
        fat_g: 5,
        carbs_g: 20,
        fibre_g: 3,
        micros: {},
        quality: {},
        food_group: null,
      },
      portions: [{ label: "1 pack", grams: 200, ml: null, isDefault: false }],
    },
  },
  {
    name: "nothing but the four macros and fibre, so kcal is derived",
    raw: fixtures.macrosOnly,
    expected: {
      ok: true,
      food: {
        ...noNutrients,
        barcode: "5000000010035",
        name: "Macros Only Mix",
        brand: null,
        basis: "per_100g",
        density_g_per_ml: null,
        kcal: 171,
        protein_g: 10,
        fat_g: 5,
        carbs_g: 20,
        fibre_g: 3,
        micros: {},
        quality: { kcal_derived: true },
        food_group: null,
      },
      portions: [{ label: "1 pack", grams: 250, ml: null, isDefault: false }],
    },
  },
  {
    name: "per serving only, with a serving quantity",
    raw: fixtures.perServingOnly,
    expected: {
      ok: true,
      food: {
        barcode: "5000000010042",
        name: "Serving Only Snack",
        brand: "Northfield Mills",
        basis: "per_100g",
        density_g_per_ml: null,
        kcal: 400,
        protein_g: 10,
        fat_g: 20,
        sat_fat_g: 10,
        carbs_g: 50,
        sugars_g: 20,
        fibre_g: 5,
        salt_g: 1,
        micros: { calcium: 0.1 },
        quality: { per_serving_converted: true },
        food_group: null,
      },
      portions: [
        { label: "30 g", grams: 30, ml: null, isDefault: true },
        { label: "1 pack", grams: 150, ml: null, isDefault: false },
      ],
    },
  },
  {
    name: "per serving only, without a serving quantity",
    raw: fixtures.perServingNoQuantity,
    expected: {
      ok: true,
      food: {
        ...noNutrients,
        barcode: "5000000010059",
        name: "Unsized Serving Snack",
        brand: null,
        basis: "per_100g",
        density_g_per_ml: null,
        micros: {},
        quality: allFourMacrosMissing,
        food_group: null,
      },
      portions: [],
    },
  },
  {
    name: "missing protein",
    raw: fixtures.missingProtein,
    expected: {
      ok: true,
      food: {
        ...noNutrients,
        barcode: "5000000010066",
        name: "Mystery Spread",
        brand: "Northfield Mills",
        basis: "per_100g",
        density_g_per_ml: null,
        kcal: 200,
        fat_g: 10,
        carbs_g: 20,
        fibre_g: 2,
        micros: {},
        quality: { suspect: true, fields_missing: ["protein_g"] },
        food_group: null,
      },
      portions: [{ label: "1 pack", grams: 300, ml: null, isDefault: false }],
    },
  },
  {
    name: "liquid in ml",
    raw: fixtures.liquidMl,
    expected: {
      ok: true,
      food: {
        ...noNutrients,
        barcode: "5000000010073",
        name: "Sparkling Apple Drink",
        brand: "Orchard Lane",
        basis: "per_100ml",
        density_g_per_ml: null,
        kcal: 42,
        protein_g: 0.5,
        fat_g: 0.1,
        carbs_g: 10,
        sugars_g: 9.5,
        fibre_g: 0.2,
        salt_g: 0.01,
        micros: {},
        quality: {},
        food_group: "beverages",
      },
      portions: [
        { label: "250 ml", grams: null, ml: 250, isDefault: true },
        { label: "1 pack", grams: null, ml: 1000, isDefault: false },
      ],
    },
  },
  {
    name: "US-labelled carbs with fibre, converted to EU style",
    raw: fixtures.usCarbsWithFibre,
    expected: {
      ok: true,
      food: {
        ...noNutrients,
        barcode: "5000000010080",
        name: "Trail Bar",
        brand: "Prairie Foods",
        basis: "per_100g",
        density_g_per_ml: null,
        kcal: 400,
        protein_g: 10,
        fat_g: 15,
        carbs_g: 50,
        fibre_g: 10,
        micros: {},
        quality: { carbs_convention: "eu" },
        food_group: null,
      },
      portions: [{ label: "1 bar (40 g)", grams: 40, ml: null, isDefault: true }],
    },
  },
  {
    name: "US-labelled carbs without fibre, left as labelled and flagged",
    raw: fixtures.usCarbsNoFibre,
    expected: {
      ok: true,
      food: {
        ...noNutrients,
        barcode: "5000000010097",
        name: "Plain Cracker",
        brand: "Prairie Foods",
        basis: "per_100g",
        density_g_per_ml: null,
        kcal: 400,
        protein_g: 10,
        fat_g: 15,
        carbs_g: 60,
        micros: {},
        quality: {
          suspect: true,
          fields_missing: ["fibre_g"],
          carbs_convention: "us_total",
        },
        food_group: null,
      },
      portions: [{ label: "1 pack", grams: 200, ml: null, isDefault: false }],
    },
  },
  {
    name: "sodium without salt",
    raw: fixtures.sodiumNoSalt,
    expected: {
      ok: true,
      food: {
        ...noNutrients,
        barcode: "5000000010103",
        name: "Savoury Stock Cube",
        brand: null,
        basis: "per_100g",
        density_g_per_ml: null,
        kcal: 250,
        protein_g: 8,
        fat_g: 12,
        carbs_g: 25,
        fibre_g: 1,
        salt_g: 1,
        micros: {},
        quality: {},
        food_group: null,
      },
      portions: [{ label: "1 pack", grams: 100, ml: null, isDefault: false }],
    },
  },
  {
    name: "empty nutriments",
    raw: fixtures.emptyNutriments,
    expected: {
      ok: true,
      food: {
        ...noNutrients,
        barcode: "5000000010110",
        name: "Unlabelled Loaf",
        brand: "Northfield Mills",
        basis: "per_100g",
        density_g_per_ml: null,
        micros: {},
        quality: allFourMacrosMissing,
        food_group: null,
      },
      portions: [{ label: "1 pack", grams: 800, ml: null, isDefault: false }],
    },
  },
  {
    name: "numeric strings instead of numbers",
    raw: fixtures.numericStrings,
    expected: {
      ok: true,
      food: {
        barcode: "5000000010127",
        name: "String Typed Granola",
        brand: "Northfield Mills",
        basis: "per_100g",
        density_g_per_ml: null,
        kcal: 250,
        protein_g: 12.5,
        fat_g: 10,
        sat_fat_g: 2,
        carbs_g: 30,
        sugars_g: 5,
        fibre_g: 4,
        salt_g: 1.25,
        micros: { iron: 0.002 },
        quality: {},
        food_group: null,
      },
      portions: [
        { label: "50 g", grams: 50, ml: null, isDefault: true },
        { label: "1 pack", grams: 400, ml: null, isDefault: false },
      ],
    },
  },
  {
    name: "a bad code",
    raw: fixtures.badCode,
    expected: { ok: false, reason: "no_code" },
  },
  {
    name: "no name",
    raw: fixtures.noName,
    expected: { ok: false, reason: "no_name" },
  },
];

describe("normaliseOffProduct", () => {
  describe("fixture goldens", () => {
    it.each(goldens)("should normalise $name", ({ raw, expected }) => {
      expect(normaliseOffProduct(raw)).toEqual(expected);
    });
  });

  describe("acceptance criteria", () => {
    it("should give kcal as kJ divided by 4.184 when only kJ is recorded", () => {
      const { food } = normaliseOk(fixtures.kjOnly);
      expect(food.kcal).toBeCloseTo(fixtures.kjOnly.nutriments["energy-kj_100g"] / 4.184, 9);
    });

    it("should mark a product with no protein suspect and keep protein null", () => {
      const { food } = normaliseOk(fixtures.missingProtein);
      expect(food.protein_g).toBeNull();
      expect(food.quality.suspect).toBe(true);
      expect(food.quality.fields_missing).toEqual(["protein_g"]);
    });

    it("should keep a nutrient the payload recorded as 0", () => {
      expect(normaliseOk(fixtures.kcalPresent).food.sugars_g).toBe(0);
    });

    it("should never turn missing nutriments into 0", () => {
      const { food } = normaliseOk(fixtures.emptyNutriments);
      expect(food).toMatchObject(noNutrients);
    });
  });

  describe("portions", () => {
    it("should offer the serving then the pack named from the packaging", () => {
      const { portions } = normaliseOk({
        ...fixtures.kcalPresent,
        quantity: "415g",
        packaging_tags: ["en:metal", "en:can", "en:canned", "en:food-can"],
      });
      expect(portions).toEqual([
        { label: "40 g", grams: 40, ml: null, isDefault: true },
        { label: "1 can", grams: 415, ml: null, isDefault: false },
      ]);
    });

    it("should offer the pack alone, not as the default, without a serving", () => {
      const { portions } = normaliseOk(fixtures.macrosOnly);
      expect(portions).toEqual([{ label: "1 pack", grams: 250, ml: null, isDefault: false }]);
    });
  });

  describe("borrowed natural units", () => {
    // 3282070015314, a real box of ten free-range hen eggs, with the energy OFF holds for it.
    const boxOfEggs = {
      ...fixtures.kcalPresent,
      code: "3282070015314",
      quantity: "10",
      packaging_tags: ["en:cardboard", "en:box"],
      categories_tags: henEggTags,
      serving_size: undefined,
      serving_quantity: undefined,
      nutriments: { "energy-kcal_100g": 140 },
    };

    it("should offer the four egg sizes, large the default, from the resolved energy", () => {
      const { portions } = normaliseOk(boxOfEggs);
      expect(portions.map(({ label, isDefault }) => [label, isDefault])).toEqual([
        ["1 small", false],
        ["1 medium", false],
        ["1 large", true],
        ["1 extra large", false],
      ]);
    });

    it("should read the energy from kJ when kcal is missing", () => {
      const { portions } = normaliseOk({
        ...boxOfEggs,
        nutriments: { "energy-kj_100g": 586 },
      });
      expect(portions).toHaveLength(4);
    });

    it("should borrow on energy converted from a per-serving figure", () => {
      // 84 kcal in a 60 g serving is 140 kcal per 100 g.
      const { food, portions } = normaliseOk({
        ...boxOfEggs,
        nutrition_data_per: "serving",
        serving_size: "1 egg (60 g)",
        serving_quantity: 60,
        nutriments: { "energy-kcal_serving": 84 },
      });
      expect(food.kcal).toBe(140);
      expect(portions.map(({ label, isDefault }) => [label, isDefault])).toEqual([
        ["1 egg (60 g)", true],
        ["1 small", false],
        ["1 medium", false],
        ["1 large", false],
        ["1 extra large", false],
      ]);
    });

    it("should borrow nothing when the energy is not that of an egg", () => {
      const { portions } = normaliseOk({ ...boxOfEggs, nutriments: { "energy-kcal_100g": 0 } });
      expect(portions).toEqual([]);
    });

    it("should keep the serving as the default of a box of eggs", () => {
      const { portions } = normaliseOk({
        ...boxOfEggs,
        serving_size: "1 egg (60 g)",
        serving_quantity: 60,
      });
      expect(portions.map(({ label, isDefault }) => [label, isDefault])).toEqual([
        ["1 egg (60 g)", true],
        ["1 small", false],
        ["1 medium", false],
        ["1 large", false],
        ["1 extra large", false],
      ]);
    });
  });

  describe("rejected payloads", () => {
    it.each([
      ["null", null],
      ["a string", "5000000010011"],
      ["a number", 5000000010011],
      ["an array", []],
      ["undefined", undefined],
    ])("should reject %s as an invalid payload", (_description, raw) => {
      expect(normaliseOffProduct(raw)).toEqual({ ok: false, reason: "invalid_payload" });
    });

    it.each([
      ["no code", { product_name: "Oat Crunch" }],
      ["a numeric code", { code: 5000000010011, product_name: "Oat Crunch" }],
      ["a code that is not digits", { code: "abc", product_name: "Oat Crunch" }],
      ["a code with a bad check digit", { code: "5000000010012", product_name: "Oat Crunch" }],
    ])("should reject %s", (_description, raw) => {
      expect(normaliseOffProduct(raw)).toEqual({ ok: false, reason: "no_code" });
    });

    it("should check the code before the name", () => {
      expect(normaliseOffProduct({ code: "123" })).toEqual({ ok: false, reason: "no_code" });
    });
  });

  describe("barcode and name", () => {
    it("should store the canonical barcode, padding a UPC-A to 13 digits", () => {
      const { food } = normaliseOk({ code: "036000291452", product_name: "Cola" });
      expect(food.barcode).toBe("0036000291452");
    });

    it("should prefer the English product name", () => {
      const { food } = normaliseOk({
        code: "5000000010011",
        product_name: "Barre",
        product_name_en: " Bar ",
      });
      expect(food.name).toBe("Bar");
    });
  });

  describe("tolerance", () => {
    it("should treat a field of the wrong type as missing instead of failing", () => {
      const { food } = normaliseOk({
        code: "5000000010011",
        product_name: "Oat Crunch",
        brands: 42,
        categories_tags: "en:cereals",
        nutriments: { "energy-kcal_100g": 100, proteins_100g: null, fat_100g: true },
      });
      expect(food).toMatchObject({
        brand: null,
        food_group: null,
        kcal: 100,
        protein_g: null,
        fat_g: null,
      });
    });

    it("should offer just the serving when the packaging tags are the wrong type", () => {
      const { portions } = normaliseOk({
        ...fixtures.kcalPresent,
        packaging_tags: "en:can",
      });
      expect(portions.map((portion) => portion.label)).toEqual(["40 g", "1 pack"]);
    });

    it("should treat nutriments that is not an object as empty", () => {
      const { food } = normaliseOk({
        code: "5000000010011",
        product_name: "X",
        nutriments: "none",
      });
      expect(food.quality).toEqual(allFourMacrosMissing);
    });
  });
});

describe("normalised output against the stored shapes", () => {
  const writerId = "11111111-1111-4111-8111-111111111111";
  const timestamp = "2026-10-07T12:00:00.000Z";
  const fixturesToCheck = Object.entries(normalisableFixtures);

  it.each(fixturesToCheck)("should make a valid foods row from %s", (_name, raw) => {
    const { food } = normaliseOk(raw);
    const row = {
      ...food,
      id: writerId,
      source: "off",
      source_ref: food.barcode,
      owner_id: null,
      fetched_at: timestamp,
      deleted_at: null,
      created_at: timestamp,
    };
    expect(foodRowSchema.safeParse(row).success).toBe(true);
  });

  it.each(fixturesToCheck)("should make valid food_portions rows from %s", (_name, raw) => {
    const { portions } = normaliseOk(raw);
    for (const [position, portion] of portions.entries()) {
      const row = {
        id: writerId,
        food_id: writerId,
        owner_id: null,
        label: portion.label,
        grams: portion.grams,
        ml: portion.ml,
        is_default: portion.isDefault,
        position,
        created_at: timestamp,
      };
      expect(foodPortionSchema.safeParse(row).success).toBe(true);
    }
  });

  it.each(fixturesToCheck)("should make a valid off-search candidate from %s", (_name, raw) => {
    expect(offCandidateSchema.safeParse(normaliseOffCandidate(raw)).success).toBe(true);
  });
});

describe("offProductPayloadSchema", () => {
  it("should keep unknown keys", () => {
    const parsed = offProductPayloadSchema.parse({ code: "1", nutriscore_grade: "b" });
    expect(parsed).toMatchObject({ nutriscore_grade: "b" });
  });

  it("should coerce a numeric string serving quantity to a number", () => {
    expect(offProductPayloadSchema.parse({ serving_quantity: "30" }).serving_quantity).toBe(30);
  });

  it("should keep the packaging tags", () => {
    expect(offProductPayloadSchema.parse({ packaging_tags: ["en:can", "en:metal"] })).toEqual({
      packaging_tags: ["en:can", "en:metal"],
    });
  });

  it.each([
    ["a string", "en:can"],
    ["a number", 3],
    ["null", null],
    ["a list with a number in it", ["en:can", 3]],
  ])("should read packaging tags that are %s as missing", (_description, packagingTags) => {
    expect(offProductPayloadSchema.parse({ packaging_tags: packagingTags }).packaging_tags).toBe(
      undefined,
    );
  });

  it("should leave absent fields undefined rather than defaulting them", () => {
    expect(offProductPayloadSchema.parse({})).toEqual({});
  });

  it("should accept an empty object", () => {
    expect(offProductPayloadSchema.safeParse({}).success).toBe(true);
  });
});

describe("normaliseOffCandidate", () => {
  it("should give the search preview of a product", () => {
    expect(normaliseOffCandidate(fixtures.kcalPresent)).toEqual({
      code: "5000000010011",
      name: "Test Oat Crunch",
      brand: "Northfield Mills",
      basis: "per_100g",
      kcal: 380,
      protein_g: 9.5,
      fat_g: 7.5,
      carbs_g: 62,
      fibre_g: 8,
      quality: {},
    });
  });

  it("should produce something offCandidateSchema accepts", () => {
    expect(offCandidateSchema.safeParse(normaliseOffCandidate(fixtures.liquidMl)).success).toBe(
      true,
    );
  });

  it("should keep a suspect product, carrying its quality flags", () => {
    expect(normaliseOffCandidate(fixtures.missingProtein)).toMatchObject({
      protein_g: null,
      quality: { suspect: true, fields_missing: ["protein_g"] },
    });
  });

  it.each([
    ["a bad code", fixtures.badCode],
    ["no name", fixtures.noName],
    ["a payload that is not an object", "nope"],
  ])("should be null for %s", (_description, raw) => {
    expect(normaliseOffCandidate(raw)).toBeNull();
  });
});
