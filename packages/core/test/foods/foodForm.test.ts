import { describe, expect, it } from "vitest";

import {
  REQUIRED_FOOD_NUTRIENTS,
  amountUnit,
  copyFormStart,
  customFoodInputFrom,
  foodToFormFields,
  parseFormNumber,
  portionAmountKey,
  portionToFormFields,
} from "../../src/foods/foodForm";
import { customFoodInputSchema } from "../../src/schemas/food";
import { buildFood, buildFoodPortion } from "../../src/testing";

import type { FoodFormFields } from "../../src/foods/foodForm";

const filledFields: FoodFormFields = {
  name: "Oat bar",
  brand: "",
  barcode: "",
  basis: "per_100g",
  kcal: "400",
  protein_g: "8",
  fat_g: "12",
  carbs_g: "60",
  fibre_g: "",
};

describe("parseFormNumber", () => {
  it.each([
    ["12", 12],
    ["12.5", 12.5],
    ["0", 0],
    ["007", 7],
    [".5", 0.5],
    ["5.", 5],
    ["-3", -3],
    ["-.5", -0.5],
  ])("should read %j as the plain number %d", (text, expected) => {
    expect(parseFormNumber(text)).toBe(expected);
  });

  it.each([
    ["12,5", 12.5],
    ["0,5", 0.5],
    ["12,50", 12.5],
    ["-12,5", -12.5],
  ])("should read %j as a decimal comma, %d", (text, expected) => {
    expect(parseFormNumber(text)).toBe(expected);
  });

  it.each([[""], ["   "], ["\t\n"]])("should read %j as absent", (text) => {
    expect(parseFormNumber(text)).toBeUndefined();
  });

  it.each([
    [" 12 ", 12],
    ["\t12,5\n", 12.5],
  ])("should ignore the whitespace around %j", (text, expected) => {
    expect(parseFormNumber(text)).toBe(expected);
  });

  it.each([
    ["abc"],
    ["12abc"],
    ["1e3"],
    ["1E3"],
    ["1e-7"],
    ["0x1A"],
    ["0b11"],
    ["Infinity"],
    ["-Infinity"],
    ["NaN"],
    ["+5"],
    ["1 000"],
    ["1,000"],
    ["12,345"],
    ["1,234,5"],
    ["12,"],
    [",5"],
    ["1.2.3"],
    ["1.5,5"],
    ["--5"],
    ["-"],
    ["."],
    [","],
  ])("should read %j as junk, NaN", (text) => {
    expect(parseFormNumber(text)).toBeNaN();
  });
});

describe("amountUnit and portionAmountKey", () => {
  it("should be grams under a per 100 g basis", () => {
    expect(amountUnit("per_100g")).toBe("g");
    expect(portionAmountKey("per_100g")).toBe("grams");
  });

  it("should be millilitres under a per 100 ml basis", () => {
    expect(amountUnit("per_100ml")).toBe("ml");
    expect(portionAmountKey("per_100ml")).toBe("ml");
  });
});

describe("REQUIRED_FOOD_NUTRIENTS", () => {
  it("should be the four nutrients the schema requires, in the order the forms draw them", () => {
    expect(REQUIRED_FOOD_NUTRIENTS).toEqual(["kcal", "protein_g", "carbs_g", "fat_g"]);
  });
});

describe("customFoodInputFrom", () => {
  it("should build the raw input of a filled form, with the numbers parsed", () => {
    const input = customFoodInputFrom(
      {
        ...filledFields,
        brand: "Acme",
        barcode: "4006381333931",
        fibre_g: "5,5",
        portions: [{ label: "1 bar", amount: "45", isDefault: true }],
      },
      null,
    );

    expect(input).toEqual({
      name: "Oat bar",
      brand: "Acme",
      barcode: "4006381333931",
      basis: "per_100g",
      kcal: 400,
      protein_g: 8,
      fat_g: 12,
      carbs_g: 60,
      fibre_g: 5.5,
      portions: [{ label: "1 bar", grams: 45, isDefault: true }],
    });
  });

  it("should leave out a blank optional field and a blank number, so each reads as absent", () => {
    const input = customFoodInputFrom({ ...filledFields, kcal: "  ", portions: [] }, null);

    expect(input).not.toHaveProperty("brand");
    expect(input).not.toHaveProperty("barcode");
    expect(input).not.toHaveProperty("fibre_g");
    expect(input).not.toHaveProperty("kcal");
    expect(input).not.toHaveProperty("density_g_per_ml");
  });

  it("should trim the brand and the barcode", () => {
    const input = customFoodInputFrom(
      { ...filledFields, brand: "  Acme ", barcode: " 4006381333931\n", portions: [] },
      null,
    );

    expect(input).toMatchObject({ brand: "Acme", barcode: "4006381333931" });
  });

  it("should leave the name as typed, for the schema to trim", () => {
    const input = customFoodInputFrom({ ...filledFields, name: "  Oat bar ", portions: [] }, null);

    expect(input).toMatchObject({ name: "  Oat bar " });
  });

  it("should pass the density through when there is one", () => {
    expect(customFoodInputFrom({ ...filledFields, portions: [] }, 1.03)).toMatchObject({
      density_g_per_ml: 1.03,
    });
  });

  it("should key a portion amount by millilitres under a per 100 ml basis", () => {
    const input = customFoodInputFrom(
      {
        ...filledFields,
        basis: "per_100ml",
        portions: [{ label: "1 glass", amount: "250", isDefault: false }],
      },
      null,
    );

    expect(input).toMatchObject({ portions: [{ label: "1 glass", ml: 250, isDefault: false }] });
  });

  it("should leave out a blank portion amount, and keep a junk one as NaN", () => {
    const input = customFoodInputFrom(
      {
        ...filledFields,
        portions: [
          { label: "blank", amount: "", isDefault: false },
          { label: "junk", amount: "1e3", isDefault: false },
        ],
      },
      null,
    );

    expect(input).toMatchObject({
      portions: [
        { label: "blank", isDefault: false },
        { label: "junk", grams: Number.NaN, isDefault: false },
      ],
    });
    expect(input).not.toHaveProperty("portions.0.grams");
  });

  describe("read by customFoodInputSchema", () => {
    it("should save a decimal comma as the decimal number", () => {
      const result = customFoodInputSchema.safeParse(
        customFoodInputFrom({ ...filledFields, protein_g: "12,5", portions: [] }, null),
      );

      expect(result.success && result.data.protein_g).toBe(12.5);
    });

    it("should report junk as a failed number on its own field", () => {
      const result = customFoodInputSchema.safeParse(
        customFoodInputFrom({ ...filledFields, kcal: "1e3", portions: [] }, null),
      );

      expect(!result.success && result.error.issues.map((issue) => issue.path)).toEqual([["kcal"]]);
    });

    it("should report a blank required number as missing", () => {
      const result = customFoodInputSchema.safeParse(
        customFoodInputFrom({ ...filledFields, fat_g: "", portions: [] }, null),
      );

      expect(!result.success && result.error.issues.map((issue) => issue.path)).toEqual([
        ["fat_g"],
      ]);
    });
  });
});

describe("foodToFormFields", () => {
  it("should turn a food row into the text the form shows, keyed as the schema is", () => {
    const food = buildFood({
      name: "Oat bar",
      brand: "Acme",
      barcode: "4006381333931",
      basis: "per_100ml",
      kcal: 400,
      protein_g: 8.5,
      fat_g: 12,
      carbs_g: 60,
      fibre_g: 5,
    });

    expect(foodToFormFields(food)).toEqual({
      name: "Oat bar",
      brand: "Acme",
      barcode: "4006381333931",
      basis: "per_100ml",
      kcal: "400",
      protein_g: "8.5",
      fat_g: "12",
      carbs_g: "60",
      fibre_g: "5",
    });
  });

  it("should show a missing value as blank text, and a recorded zero as 0", () => {
    const fields = foodToFormFields(
      buildFood({ brand: null, barcode: null, fibre_g: null, fat_g: 0 }),
    );

    expect(fields).toMatchObject({ brand: "", barcode: "", fibre_g: "", fat_g: "0" });
  });
});

describe("portionToFormFields", () => {
  it("should show the grams of a portion as its amount", () => {
    expect(
      portionToFormFields(
        buildFoodPortion({ label: "1 bar", grams: 45, ml: null, is_default: true }),
      ),
    ).toEqual({ label: "1 bar", amount: "45", isDefault: true });
  });

  it("should show the millilitres of a portion as its amount", () => {
    expect(
      portionToFormFields(buildFoodPortion({ label: "1 glass", grams: null, ml: 250 })),
    ).toEqual({ label: "1 glass", amount: "250", isDefault: false });
  });
});

describe("copyFormStart", () => {
  it("should start a copy from the food's own values", () => {
    const start = copyFormStart(buildFood({ name: "Oat bar", carbs_g: 60 }));

    expect(start.fields).toMatchObject({ name: "Oat bar", carbs_g: "60" });
    expect(start.isCarbsIncludingFibre).toBe(false);
    expect(start.notGiven).toEqual([]);
  });

  it("should blank the carbohydrate of a food whose carbohydrate includes fibre", () => {
    const start = copyFormStart(
      buildFood({ carbs_g: 60, quality: { carbs_convention: "us_total" } }),
    );

    expect(start.fields.carbs_g).toBe("");
    expect(start.isCarbsIncludingFibre).toBe(true);
    expect(start.notGiven).toEqual(["carbs_g"]);
  });

  it("should keep the carbohydrate of a food converted to the EU convention", () => {
    const start = copyFormStart(buildFood({ carbs_g: 60, quality: { carbs_convention: "eu" } }));

    expect(start.fields.carbs_g).toBe("60");
    expect(start.isCarbsIncludingFibre).toBe(false);
  });

  it("should name each required nutrient the food leaves blank, in the order the forms draw them", () => {
    const start = copyFormStart(
      buildFood({ kcal: null, protein_g: null, carbs_g: null, fat_g: null, fibre_g: null }),
    );

    expect(start.notGiven).toEqual(["kcal", "protein_g", "carbs_g", "fat_g"]);
  });

  it("should not name fibre, which may be left blank, nor a recorded zero", () => {
    const start = copyFormStart(buildFood({ fibre_g: null, fat_g: 0 }));

    expect(start.notGiven).toEqual([]);
  });
});
