import { describe, expect, it } from "vitest";

import {
  buildQuality,
  collectMicros,
  deriveKcal,
  inferBasis,
  isUsLabelled,
  KILOJOULES_PER_KILOCALORIE,
  listMissingMacros,
  NON_NUTRIENT_BASE_PREFIXES,
  pickBrand,
  pickFoodGroup,
  pickName,
  resolveCarbs,
  resolveEnergy,
  resolvePer100Amounts,
  resolveSalt,
  servingPortion,
  toNonNegativeNumber,
} from "../../src/foods/offRules";

const noMacros = { protein: null, fat: null, carbs: null, fibre: null };

describe("toNonNegativeNumber", () => {
  it.each([
    [5, 5],
    [0, 0],
    [12.5, 12.5],
    ["5", 5],
    [" 5.5 ", 5.5],
    ["0", 0],
    [".5", 0.5],
    ["1e-3", 0.001],
  ])("should read %j as %j", (input, expected) => {
    expect(toNonNegativeNumber(input)).toBe(expected);
  });

  it.each([
    ["an empty string", ""],
    ["a blank string", "   "],
    ["a word", "abc"],
    ["a hexadecimal string", "0x10"],
    ["a comma decimal", "1,5"],
    ["a negative number", -1],
    ["a negative numeric string", "-2"],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["null", null],
    ["undefined", undefined],
    ["a boolean", true],
    ["an object", {}],
  ])("should treat %s as missing", (_description, input) => {
    expect(toNonNegativeNumber(input)).toBeUndefined();
  });
});

describe("resolvePer100Amounts", () => {
  const noServing = { nutritionDataPer: "100g", servingQuantity: undefined };

  it("should read every _100g key under its base name, coercing numeric strings", () => {
    const result = resolvePer100Amounts(
      { proteins_100g: 8.5, fat_100g: "3", "vitamin-c_100g": 0 },
      noServing,
    );
    expect(result).toEqual({
      amounts: { proteins: 8.5, fat: 3, "vitamin-c": 0 },
      perServingConverted: false,
    });
  });

  it("should ignore unit keys, value keys and values that are not numbers", () => {
    const result = resolvePer100Amounts(
      {
        proteins_unit: "g",
        "energy-kcal_value": 250,
        fat_100g: "lots",
        carbohydrates_100g: -4,
        sugars_100g: "",
      },
      noServing,
    );
    expect(result).toEqual({ amounts: {}, perServingConverted: false });
  });

  it("should convert _serving keys to per 100 when the data is per serving and the serving size is known", () => {
    const result = resolvePer100Amounts(
      { proteins_serving: 6, fat_serving: "3" },
      { nutritionDataPer: "serving", servingQuantity: 30 },
    );
    expect(result).toEqual({ amounts: { proteins: 20, fat: 10 }, perServingConverted: true });
  });

  it("should round a converted value to 6 decimal places", () => {
    const result = resolvePer100Amounts(
      { proteins_serving: 1 },
      { nutritionDataPer: "serving", servingQuantity: 3 },
    );
    expect(result.amounts).toEqual({ proteins: 33.333333 });
  });

  it("should prefer a _100g value over a _serving value for the same nutrient", () => {
    const result = resolvePer100Amounts(
      { proteins_100g: 7, proteins_serving: 6 },
      { nutritionDataPer: "serving", servingQuantity: 30 },
    );
    expect(result).toEqual({ amounts: { proteins: 7 }, perServingConverted: false });
  });

  it("should flag the conversion only when a converted value is actually used", () => {
    const result = resolvePer100Amounts(
      { proteins_100g: 7, fat_serving: 3 },
      { nutritionDataPer: "serving", servingQuantity: 30 },
    );
    expect(result).toEqual({ amounts: { proteins: 7, fat: 10 }, perServingConverted: true });
  });

  it.each([
    ["missing", undefined],
    ["zero", 0],
    ["negative", -30],
  ])("should not convert when the serving quantity is %s", (_description, servingQuantity) => {
    const result = resolvePer100Amounts(
      { proteins_serving: 6 },
      { nutritionDataPer: "serving", servingQuantity },
    );
    expect(result).toEqual({ amounts: {}, perServingConverted: false });
  });

  it.each([
    ["100g", "100g"],
    ["absent", undefined],
  ])(
    "should not convert _serving keys when the data is per %s",
    (_description, nutritionDataPer) => {
      const result = resolvePer100Amounts(
        { proteins_serving: 6 },
        { nutritionDataPer, servingQuantity: 30 },
      );
      expect(result).toEqual({ amounts: {}, perServingConverted: false });
    },
  );
});

describe("resolveEnergy", () => {
  it("should use energy-kcal when present", () => {
    expect(resolveEnergy({ "energy-kcal": 250, "energy-kj": 999 }, noMacros)).toEqual({
      kcal: 250,
      kcalDerived: false,
    });
  });

  it("should keep a kcal the payload recorded as 0", () => {
    expect(resolveEnergy({ "energy-kcal": 0 }, noMacros)).toEqual({ kcal: 0, kcalDerived: false });
  });

  it("should divide energy-kj by 4.184 when kcal is absent", () => {
    const { kcal, kcalDerived } = resolveEnergy({ "energy-kj": 1046 }, noMacros);
    expect(kcal).toBeCloseTo(1046 / 4.184, 9);
    expect(kcalDerived).toBe(false);
  });

  it("should round kcal converted from kilojoules to 6 decimal places", () => {
    expect(resolveEnergy({ "energy-kj": 1000 }, noMacros).kcal).toBe(239.005736);
  });

  it("should read the legacy energy key as kilojoules when energy-kj is absent", () => {
    const { kcal } = resolveEnergy({ energy: 1046 }, noMacros);
    expect(kcal).toBeCloseTo(250, 9);
  });

  it("should prefer energy-kj over the legacy energy key", () => {
    const { kcal } = resolveEnergy({ "energy-kj": 418.4, energy: 4184 }, noMacros);
    expect(kcal).toBeCloseTo(100, 9);
  });

  it("should derive 4P + 9F + 4C + 2 fibre when every macro is present and no energy is recorded", () => {
    expect(resolveEnergy({}, { protein: 10, fat: 5, carbs: 20, fibre: 3 })).toEqual({
      kcal: 171,
      kcalDerived: true,
    });
  });

  it.each(["protein", "fat", "carbs", "fibre"] as const)(
    "should leave kcal null when %s is missing, rather than derive from a partial set",
    (missing) => {
      const macros = { protein: 10, fat: 5, carbs: 20, fibre: 3, [missing]: null };
      expect(resolveEnergy({}, macros)).toEqual({ kcal: null, kcalDerived: false });
    },
  );

  it("should not derive when a recorded energy value exists", () => {
    expect(
      resolveEnergy({ "energy-kcal": 100 }, { protein: 10, fat: 5, carbs: 20, fibre: 3 }),
    ).toEqual({ kcal: 100, kcalDerived: false });
  });
});

describe("deriveKcal", () => {
  it("should be exactly zero for a food whose recorded macros are all zero", () => {
    expect(deriveKcal({ protein: 0, fat: 0, carbs: 0, fibre: 0 })).toBe(0);
  });
});

describe("KILOJOULES_PER_KILOCALORIE", () => {
  it("should be 4.184", () => {
    expect(KILOJOULES_PER_KILOCALORIE).toBe(4.184);
  });
});

describe("inferBasis", () => {
  it.each([
    "1 L",
    "1l",
    "330 ml",
    "330ML",
    "33 cl",
    "75cl",
    "5 dl",
    "1.5 litres",
    "2 liters",
    "12 fl oz",
    "6 x 250 ml",
  ])("should read a quantity of %j as per_100ml", (quantity) => {
    expect(inferBasis({ quantity, servingSize: undefined })).toBe("per_100ml");
  });

  it.each(["500 g", "1 kg", "100 g (3.5 oz)", "2 large eggs", "12 pack", ""])(
    "should read a quantity of %j as per_100g",
    (quantity) => {
      expect(inferBasis({ quantity, servingSize: undefined })).toBe("per_100g");
    },
  );

  it("should default to per_100g when neither quantity nor serving size is known", () => {
    expect(inferBasis({ quantity: undefined, servingSize: undefined })).toBe("per_100g");
  });

  it("should read a millilitre serving size as per_100ml when the quantity is silent", () => {
    expect(inferBasis({ quantity: undefined, servingSize: "250 ml" })).toBe("per_100ml");
  });

  it("should let a weight quantity win over a millilitre serving size", () => {
    expect(inferBasis({ quantity: "500 g", servingSize: "30 ml" })).toBe("per_100g");
  });

  it("should let a volume quantity win over a gram serving size", () => {
    expect(inferBasis({ quantity: "1 L", servingSize: "30 g" })).toBe("per_100ml");
  });

  it.each(["1 box", "12 pack", "", "2 large eggs"])(
    "should fall back to the serving size when the quantity %j has no recognised unit",
    (quantity) => {
      expect(inferBasis({ quantity, servingSize: "250 ml" })).toBe("per_100ml");
    },
  );

  it("should stay per_100g when neither field gives a recognised unit", () => {
    expect(inferBasis({ quantity: "1 box", servingSize: "1 bar" })).toBe("per_100g");
  });
});

describe("isUsLabelled", () => {
  it.each([
    [["en:united-states"]],
    [["en:united-states", "en:canada"]],
    [["en:canada", "en:united-states", "en:mexico"]],
  ])("should be true for %j", (tags) => {
    expect(isUsLabelled(tags)).toBe(true);
  });

  it.each([
    "en:united-kingdom",
    "en:ireland",
    "en:france",
    "en:germany",
    "en:switzerland",
    "en:norway",
  ])("should be false when %s is also a country of sale", (europeanTag) => {
    expect(isUsLabelled(["en:united-states", europeanTag])).toBe(false);
  });

  it.each([[["en:france"]], [["en:canada"]], [[]], [undefined]])(
    "should be false when the United States is not a country of sale (%j)",
    (tags) => {
      expect(isUsLabelled(tags)).toBe(false);
    },
  );
});

describe("resolveCarbs", () => {
  it("should leave carbs untouched and the convention unset when the label is not US", () => {
    expect(resolveCarbs({ carbs: 30, fibre: 5, usLabelled: false })).toEqual({
      carbs: 30,
      convention: undefined,
    });
  });

  it("should subtract fibre from a US label and record the stored value as eu", () => {
    expect(resolveCarbs({ carbs: 30, fibre: 5, usLabelled: true })).toEqual({
      carbs: 25,
      convention: "eu",
    });
  });

  it("should round the converted carbs to 6 decimal places", () => {
    expect(resolveCarbs({ carbs: 0.3, fibre: 0.1, usLabelled: true }).carbs).toBe(0.2);
  });

  it("should clamp at 0 when fibre exceeds carbs on a US label", () => {
    expect(resolveCarbs({ carbs: 3, fibre: 5, usLabelled: true })).toEqual({
      carbs: 0,
      convention: "eu",
    });
  });

  it("should treat a recorded fibre of 0 as known and convert", () => {
    expect(resolveCarbs({ carbs: 30, fibre: 0, usLabelled: true })).toEqual({
      carbs: 30,
      convention: "eu",
    });
  });

  it("should keep the labelled carbs as us_total when fibre is missing", () => {
    expect(resolveCarbs({ carbs: 30, fibre: null, usLabelled: true })).toEqual({
      carbs: 30,
      convention: "us_total",
    });
  });

  it.each([true, false])(
    "should stay null with no convention when carbs is missing (US %s)",
    (usLabelled) => {
      expect(resolveCarbs({ carbs: null, fibre: 5, usLabelled })).toEqual({
        carbs: null,
        convention: undefined,
      });
    },
  );
});

describe("resolveSalt", () => {
  it("should use salt when present", () => {
    expect(resolveSalt({ salt: 1.5, sodium: 0.1 })).toBe(1.5);
  });

  it("should convert sodium to salt at 2.5 when salt is absent", () => {
    expect(resolveSalt({ sodium: 0.4 })).toBe(1);
  });

  it("should be null when neither is present", () => {
    expect(resolveSalt({})).toBeNull();
  });

  it("should keep a salt recorded as 0 rather than fall back to sodium", () => {
    expect(resolveSalt({ salt: 0, sodium: 1 })).toBe(0);
  });

  it("should keep a sodium recorded as 0 as a salt of 0", () => {
    expect(resolveSalt({ sodium: 0 })).toBe(0);
  });
});

describe("listMissingMacros", () => {
  it("should be empty when all four macros are present, including a recorded 0", () => {
    expect(listMissingMacros({ kcal: 0, protein_g: 1, fat_g: 2, carbs_g: 3 })).toEqual([]);
  });

  it("should list the missing macros in the fixed order kcal, protein_g, fat_g, carbs_g", () => {
    expect(listMissingMacros({ kcal: null, protein_g: null, fat_g: null, carbs_g: null })).toEqual([
      "kcal",
      "protein_g",
      "fat_g",
      "carbs_g",
    ]);
  });

  it("should list only the ones that are missing", () => {
    expect(listMissingMacros({ kcal: 100, protein_g: null, fat_g: 2, carbs_g: null })).toEqual([
      "protein_g",
      "carbs_g",
    ]);
  });
});

describe("buildQuality", () => {
  const neutral = {
    kcalDerived: false,
    perServingConverted: false,
    missingMacros: [],
    carbsConvention: undefined,
  } as const;

  it("should be the empty object when nothing is notable", () => {
    expect(buildQuality(neutral)).toEqual({});
  });

  it("should flag a derived kcal", () => {
    expect(buildQuality({ ...neutral, kcalDerived: true })).toEqual({ kcal_derived: true });
  });

  it("should flag a per-serving conversion", () => {
    expect(buildQuality({ ...neutral, perServingConverted: true })).toEqual({
      per_serving_converted: true,
    });
  });

  it("should mark the food suspect and list what is missing", () => {
    expect(buildQuality({ ...neutral, missingMacros: ["protein_g"] })).toEqual({
      suspect: true,
      fields_missing: ["protein_g"],
    });
  });

  it("should record eu after a conversion without making the food suspect", () => {
    expect(buildQuality({ ...neutral, carbsConvention: "eu" })).toEqual({ carbs_convention: "eu" });
  });

  it("should mark an unconverted US label suspect and add fibre_g after the missing macros", () => {
    expect(
      buildQuality({ ...neutral, missingMacros: ["kcal"], carbsConvention: "us_total" }),
    ).toEqual({
      suspect: true,
      fields_missing: ["kcal", "fibre_g"],
      carbs_convention: "us_total",
    });
  });
});

describe("pickBrand", () => {
  it.each([
    ["Acme", "Acme"],
    ["Acme, Other Brand", "Acme"],
    ["  Acme  ,Other", "Acme"],
  ])("should read %j as %j", (brands, expected) => {
    expect(pickBrand(brands)).toBe(expected);
  });

  it.each([[""], ["   "], [undefined]])("should be null for %j", (brands) => {
    expect(pickBrand(brands)).toBeNull();
  });
});

describe("pickName", () => {
  it("should prefer the English name, trimmed", () => {
    expect(pickName({ productNameEnglish: "  Oat Bar ", productName: "Barre" })).toBe("Oat Bar");
  });

  it("should fall back to the product name when the English name is absent or blank", () => {
    expect(pickName({ productNameEnglish: "  ", productName: " Barre " })).toBe("Barre");
    expect(pickName({ productNameEnglish: undefined, productName: "Barre" })).toBe("Barre");
  });

  it("should be undefined when neither name has text", () => {
    expect(pickName({ productNameEnglish: " ", productName: undefined })).toBeUndefined();
  });

  it("should cut a 250 character name at the last word that fits in 200", () => {
    const longName = Array.from({ length: 50 }, () => "word").join(" ");

    expect(longName).toHaveLength(249);
    expect(pickName({ productNameEnglish: longName, productName: undefined })).toBe(
      `${"word ".repeat(39)}word`,
    );
  });

  it("should keep a name of exactly 200 characters whole", () => {
    const name = `${"a".repeat(199)}b`;

    expect(pickName({ productNameEnglish: name, productName: undefined })).toBe(name);
  });

  it("should drop the comma and spaces left at the cut", () => {
    const name = `${"x".repeat(195)}, ${"yyyy".repeat(10)}`;

    expect(pickName({ productNameEnglish: name, productName: undefined })).toBe("x".repeat(195));
  });

  it("should cut a name with no space in its first 200 characters at 200", () => {
    const name = "z".repeat(250);

    expect(pickName({ productNameEnglish: name, productName: undefined })).toBe("z".repeat(200));
  });

  it("should not leave half of a surrogate pair at the cut", () => {
    const name = `${"a".repeat(199)}😀${"b".repeat(50)}`;
    const picked = pickName({ productNameEnglish: name, productName: undefined });

    expect(picked).toBe("a".repeat(199));
    expect(picked?.length).toBe(199);
  });

  it("should keep a surrogate pair that fits whole", () => {
    const name = `${"a".repeat(198)}😀${"b".repeat(50)}`;

    expect(pickName({ productNameEnglish: name, productName: undefined })).toBe(
      `${"a".repeat(198)}😀`,
    );
  });

  it("should pass over a name that is only commas after the cut and use the next name", () => {
    expect(pickName({ productNameEnglish: ",".repeat(250), productName: "Barre" })).toBe("Barre");
  });

  it("should be undefined when the only name is nothing but commas after the cut", () => {
    expect(
      pickName({ productNameEnglish: ",".repeat(250), productName: undefined }),
    ).toBeUndefined();
  });

  it("should cut a name whose 201st character is a space after 200 characters", () => {
    const name = `${"a".repeat(200)} ${"b".repeat(49)}`;

    expect(pickName({ productNameEnglish: name, productName: undefined })).toBe("a".repeat(200));
  });
});

describe("pickFoodGroup", () => {
  it("should strip the language prefix from the first category", () => {
    expect(pickFoodGroup(["en:breakfast-cereals", "en:oat-flakes"])).toBe("breakfast-cereals");
  });

  it("should strip a prefix in another language", () => {
    expect(pickFoodGroup(["fr:boissons"])).toBe("boissons");
  });

  it("should keep a category that has no prefix", () => {
    expect(pickFoodGroup(["snacks"])).toBe("snacks");
  });

  it.each([[[]], [undefined], [[" "]], [["en:"]]])("should be null for %j", (tags) => {
    expect(pickFoodGroup(tags)).toBeNull();
  });
});

describe("collectMicros", () => {
  it("should keep nutrients that are not stored as a column, under their base name", () => {
    expect(collectMicros({ "vitamin-c": 0.012, calcium: 0.12, iron: 0 })).toEqual({
      "vitamin-c": 0.012,
      calcium: 0.12,
      iron: 0,
    });
  });

  it("should leave out every nutrient that feeds a column", () => {
    const columnBases = {
      "energy-kcal": 1,
      "energy-kj": 1,
      energy: 1,
      proteins: 1,
      fat: 1,
      "saturated-fat": 1,
      carbohydrates: 1,
      sugars: 1,
      fiber: 1,
      salt: 1,
      sodium: 1,
    };
    expect(collectMicros({ ...columnBases, calcium: 0.12 })).toEqual({ calcium: 0.12 });
  });

  it("should be an empty object when there is nothing else", () => {
    expect(collectMicros({})).toEqual({});
  });

  it("should leave out OFF scores and footprints that are not nutrients", () => {
    const amounts = {
      "nutrition-score-fr": 5,
      "nova-group": 4,
      "carbon-footprint-from-known-ingredients": 120,
      "energy-from-fat": 80,
      "fruits-vegetables-nuts-estimate-from-ingredients": 12,
      "fruits-vegetables-legumes-estimate-from-ingredients": 12,
      "vitamin-c": 0.012,
    };
    expect(collectMicros(amounts)).toEqual({ "vitamin-c": 0.012 });
  });

  it.each(NON_NUTRIENT_BASE_PREFIXES)("should leave out a nutriment starting with %s", (prefix) => {
    expect(collectMicros({ [`${prefix}-example`]: 1, calcium: 0.12 })).toEqual({ calcium: 0.12 });
  });
});

describe("servingPortion", () => {
  it("should label the portion with the serving size and use grams for a per_100g food", () => {
    expect(servingPortion({ servingSize: "30 g", servingQuantity: 30, basis: "per_100g" })).toEqual(
      {
        label: "30 g",
        grams: 30,
        ml: null,
        isDefault: true,
      },
    );
  });

  it("should use ml for a per_100ml food", () => {
    expect(
      servingPortion({ servingSize: "250 ml", servingQuantity: 250, basis: "per_100ml" }),
    ).toEqual({ label: "250 ml", grams: null, ml: 250, isDefault: true });
  });

  it("should be labelled 1 serving when the serving size has no text", () => {
    expect(
      servingPortion({ servingSize: " ", servingQuantity: 30, basis: "per_100g" })?.label,
    ).toBe("1 serving");
    expect(
      servingPortion({ servingSize: undefined, servingQuantity: 30, basis: "per_100g" })?.label,
    ).toBe("1 serving");
  });

  it.each([
    ["missing", undefined],
    ["zero", 0],
    ["negative", -5],
    ["not finite", Number.POSITIVE_INFINITY],
  ])("should be null when the serving quantity is %s", (_description, servingQuantity) => {
    expect(servingPortion({ servingSize: "30 g", servingQuantity, basis: "per_100g" })).toBeNull();
  });
});
