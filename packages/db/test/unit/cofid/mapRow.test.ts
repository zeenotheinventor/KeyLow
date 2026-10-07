import { readFileSync } from "node:fs";

import { foodQualitySchema } from "@keylow/core";
import { describe, expect, it } from "vitest";

import { requireCofidColumns, mapRow } from "../../../scripts/cofid/mapRow";
import { COFID_COLUMNS, cofidRow } from "../../support/cofidRow";

const column = COFID_COLUMNS;
const kilojoules = "proximates_energy_kj_kj";

describe("mapRow", () => {
  describe("identity", () => {
    it("should map the row to a global cofid food with the code as its source reference", () => {
      const { food } = mapRow(
        cofidRow({ food_code: "13-145", food_name: "Ackee, canned, drained", food_group: "DG" }),
      );

      expect(food).toMatchObject({
        source: "cofid",
        source_ref: "13-145",
        owner_id: null,
        name: "Ackee, canned, drained",
        brand: null,
        barcode: null,
        density_g_per_ml: null,
        food_group: "DG",
        fetched_at: null,
      });
    });

    it("should store a blank group as null", () => {
      expect(mapRow(cofidRow({ food_group: "" })).food.food_group).toBeNull();
    });

    it("should refuse a row without a name", () => {
      expect(() => mapRow(cofidRow({ food_code: "11-9", food_name: "" }))).toThrow("11-9");
    });

    it("should refuse a row without a code", () => {
      expect(() => mapRow(cofidRow({ food_code: "" }))).toThrow("no food code");
    });
  });

  describe("basis", () => {
    it("should store a food as per 100 g by default", () => {
      expect(mapRow(cofidRow({ food_group: "DG" })).food.basis).toBe("per_100g");
    });

    it.each(["QA", "QC", "QE", "QF", "QG", "QI", "QK", "Q"])(
      "should store the alcoholic beverage group %s as per 100 ml",
      (group) => {
        expect(mapRow(cofidRow({ food_group: group })).food.basis).toBe("per_100ml");
      },
    );

    it("should not read a group that merely contains a Q as a beverage", () => {
      expect(mapRow(cofidRow({ food_group: "AQ" })).food.basis).toBe("per_100g");
    });
  });

  describe("macros", () => {
    it("should map the five macros, sugars and saturated fat from their columns", () => {
      const { food } = mapRow(
        cofidRow({
          [column.kcal]: "151",
          [column.protein]: "2.9",
          [column.fat]: "15.2",
          [column.carbs]: "0.8",
          [column.sugars]: "0.6",
          [column.saturatedFat]: "3.45",
          [column.fibreAoac]: "1.7",
        }),
      );

      expect(food).toMatchObject({
        kcal: 151,
        protein_g: 2.9,
        fat_g: 15.2,
        carbs_g: 0.8,
        sugars_g: 0.6,
        sat_fat_g: 3.45,
        fibre_g: 1.7,
      });
    });

    it("should take energy from the kcal column and never derive it from kJ", () => {
      const {
        food,
        food: { quality },
      } = mapRow(
        cofidRow({
          [column.kcal]: "N",
          [kilojoules]: "625",
          [column.protein]: "1",
          [column.fat]: "1",
          [column.carbs]: "1",
        }),
      );

      expect(food.kcal).toBeNull();
      expect(quality).toMatchObject({ suspect: true, fields_missing: ["kcal", "fibre_g"] });
    });
  });

  describe("Tr", () => {
    it("should map a trace to 0 and list the field in the trace fields", () => {
      const { food } = mapRow(
        cofidRow({
          [column.kcal]: "16",
          [column.protein]: "1.3",
          [column.fat]: "1.2",
          [column.carbs]: "Tr",
        }),
      );

      expect(food.carbs_g).toBe(0);
      expect(food.quality.trace_fields).toEqual(["carbs_g"]);
    });

    it("should not treat a trace as missing", () => {
      const { food } = mapRow(
        cofidRow({
          [column.kcal]: "16",
          [column.protein]: "1.3",
          [column.fat]: "1.2",
          [column.carbs]: "Tr",
          [column.fibreAoac]: "0.5",
        }),
      );

      expect(food.quality.suspect).toBeUndefined();
      expect(food.quality.fields_missing).toBeUndefined();
    });

    it("should list the optional columns too, by the food field they fill", () => {
      const { food } = mapRow(cofidRow({ [column.sugars]: "Tr", [column.saturatedFat]: "Tr" }));

      expect(food).toMatchObject({ sugars_g: 0, sat_fat_g: 0 });
      expect(food.quality.trace_fields).toEqual(["sat_fat_g", "sugars_g"]);
    });
  });

  describe("N and blank", () => {
    it("should map N to null and list a missing headline macro as suspect", () => {
      const { food } = mapRow(
        cofidRow({
          [column.kcal]: "N",
          [column.protein]: "6.1",
          [column.fat]: "8.7",
          [column.carbs]: "N",
          [column.fibreAoac]: "0.5",
        }),
      );

      expect(food).toMatchObject({ kcal: null, carbs_g: null, protein_g: 6.1, fat_g: 8.7 });
      expect(food.quality).toEqual({
        suspect: true,
        fields_missing: ["kcal", "carbs_g"],
        fibre_method: "aoac",
      });
    });

    it("should map a blank headline macro to null in the same way as N", () => {
      const { food } = mapRow(
        cofidRow({
          [column.kcal]: "100",
          [column.protein]: "",
          [column.fat]: "1",
          [column.carbs]: "1",
          [column.fibreAoac]: "1",
        }),
      );

      expect(food.protein_g).toBeNull();
      expect(food.quality).toMatchObject({ suspect: true, fields_missing: ["protein_g"] });
    });

    it("should map N or blank in sugars and saturated fat to null without any quality flag", () => {
      const { food } = mapRow(
        cofidRow({
          [column.kcal]: "100",
          [column.protein]: "1",
          [column.fat]: "1",
          [column.carbs]: "1",
          [column.fibreAoac]: "1",
          [column.sugars]: "N",
          [column.saturatedFat]: "",
        }),
      );

      expect(food).toMatchObject({ sugars_g: null, sat_fat_g: null });
      expect(food.quality).toEqual({ fibre_method: "aoac" });
    });

    it("should map a negative amount to null, as it is impossible", () => {
      const { food } = mapRow(cofidRow({ [column.kcal]: "100", [column.protein]: "-0.01" }));

      expect(food.protein_g).toBeNull();
      expect(food.quality.fields_missing).toContain("protein_g");
    });
  });

  describe("salt", () => {
    it.each([
      ["240", 0.6],
      ["77", 0.1925],
      ["0.7", 0.00175],
      ["6", 0.015],
      ["0", 0],
    ])("should compute salt from %s mg of sodium as %s g", (sodium, salt) => {
      expect(mapRow(cofidRow({ [column.sodium]: sodium })).food.salt_g).toBe(salt);
    });

    it("should map a trace of sodium to a trace of salt", () => {
      const { food } = mapRow(cofidRow({ [column.sodium]: "Tr" }));

      expect(food.salt_g).toBe(0);
      expect(food.quality.trace_fields).toEqual(["salt_g"]);
    });

    it.each(["N", ""])("should leave salt null when the sodium cell is %j", (sodium) => {
      const { food } = mapRow(cofidRow({ [column.sodium]: sodium }));

      expect(food.salt_g).toBeNull();
    });
  });

  describe("fibre", () => {
    const fibre = (aoac: string, englyst: string) =>
      mapRow(cofidRow({ [column.fibreAoac]: aoac, [column.fibreEnglyst]: englyst })).food;

    it("should use AOAC fibre where it is present", () => {
      const food = fibre("3.1", "2.4");

      expect(food.fibre_g).toBe(3.1);
      expect(food.quality.fibre_method).toBe("aoac");
    });

    it.each(["N", ""])("should fall back to Englyst fibre when the AOAC cell is %j", (aoac) => {
      const food = fibre(aoac, "2.4");

      expect(food.fibre_g).toBe(2.4);
      expect(food.quality.fibre_method).toBe("englyst");
    });

    it("should treat an AOAC trace as AOAC fibre of 0", () => {
      const food = fibre("Tr", "2.4");

      expect(food.fibre_g).toBe(0);
      expect(food.quality.fibre_method).toBe("aoac");
      expect(food.quality.trace_fields).toEqual(["fibre_g"]);
    });

    it("should map an Englyst trace to 0 when AOAC is absent", () => {
      const food = fibre("N", "Tr");

      expect(food.fibre_g).toBe(0);
      expect(food.quality.fibre_method).toBe("englyst");
      expect(food.quality.trace_fields).toEqual(["fibre_g"]);
    });

    it("should leave fibre null with no method when neither method has a value", () => {
      const food = fibre("N", "");

      expect(food.fibre_g).toBeNull();
      expect(food.quality.fibre_method).toBeUndefined();
      expect(food.quality.fields_missing).toEqual([
        "kcal",
        "protein_g",
        "fat_g",
        "carbs_g",
        "fibre_g",
      ]);
    });

    it("should list missing fibre as missing without making the food suspect", () => {
      const { food } = mapRow(
        cofidRow({
          [column.kcal]: "100",
          [column.protein]: "1",
          [column.fat]: "1",
          [column.carbs]: "1",
        }),
      );

      expect(food.quality).toEqual({ fields_missing: ["fibre_g"] });
    });
  });

  describe("micros", () => {
    it("should put every other nutrient into micros under its column name", () => {
      const { food } = mapRow(
        cofidRow({
          [kilojoules]: "625",
          inorganics_potassium_mg: "270",
          vitamins_vitamin_c_mg: "0.5",
        }),
      );

      expect(food.micros).toEqual({
        [kilojoules]: 625,
        inorganics_potassium_mg: 270,
        vitamins_vitamin_c_mg: 0.5,
      });
    });

    it("should leave out the columns that have a column of their own", () => {
      const { food } = mapRow(
        cofidRow({
          [column.kcal]: "1",
          [column.protein]: "1",
          [column.fat]: "1",
          [column.carbs]: "1",
          [column.sugars]: "1",
          [column.saturatedFat]: "1",
          [column.sodium]: "1",
          [column.fibreAoac]: "1",
          [column.fibreEnglyst]: "1",
        }),
      );

      expect(food.micros).toEqual({});
    });

    it("should leave out the factors, which are not nutrient amounts", () => {
      const { food } = mapRow(
        cofidRow({ factors_edible_proportion: "N", factors_specific_gravity: "1.03" }),
      );

      expect(food.micros).toEqual({});
    });

    it("should map a trace to 0 and list the micro in the trace fields after the macros", () => {
      const { food } = mapRow(
        cofidRow({
          [column.protein]: "Tr",
          vitamins_retinol_ug: "Tr",
          inorganics_iron_mg: "Tr",
        }),
      );

      expect(food.micros).toEqual({ vitamins_retinol_ug: 0, inorganics_iron_mg: 0 });
      expect(food.quality.trace_fields).toEqual([
        "protein_g",
        "vitamins_retinol_ug",
        "inorganics_iron_mg",
      ]);
    });

    it("should leave out a micro that is N, blank or negative, because missing is never 0", () => {
      const { food } = mapRow(
        cofidRow({
          vitamins_vitamin_k1_ug: "N",
          inorganics_iron_mg: "",
          sfa_fa_c8_0_100g_fa_g: "-0.01",
          vitamins_retinol_ug: "0",
        }),
      );

      expect(food.micros).toEqual({ vitamins_retinol_ug: 0 });
    });

    it("should read a value in brackets as the number", () => {
      const { food } = mapRow(cofidRow({ sfa_food_c10_0_100g_food_g: "(0.07)" }));

      expect(food.micros).toEqual({ sfa_food_c10_0_100g_food_g: 0.07 });
    });
  });

  describe("quality", () => {
    it("should be empty for a food with nothing notable", () => {
      const { food } = mapRow(
        cofidRow({
          [column.kcal]: "100",
          [column.protein]: "1",
          [column.fat]: "1",
          [column.carbs]: "1",
          [column.fibreEnglyst]: "1",
        }),
      );

      expect(food.quality).toEqual({ fibre_method: "englyst" });
    });

    it("should pass the quality schema unchanged", () => {
      const { food } = mapRow(
        cofidRow({ [column.kcal]: "N", [column.protein]: "Tr", [column.fibreAoac]: "Tr" }),
      );

      expect(foodQualitySchema.parse(food.quality)).toEqual(food.quality);
    });
  });

  describe("cells it cannot read", () => {
    it.each([
      ["a macro", column.protein],
      ["a micro", "vitamins_retinol_ug"],
      ["a factor", "factors_total_solids"],
    ])("should refuse an unreadable cell in %s and name the food and column", (_label, name) => {
      expect(() => mapRow(cofidRow({ food_code: "11-7", [name]: "0.5-1" }))).toThrow(
        new RegExp(`11-7.*${name}.*"0.5-1"`, "s"),
      );
    });
  });

  describe("raw", () => {
    it("should hold the whole source row with the cell text untouched and blanks as null", () => {
      const { raw } = mapRow(
        cofidRow({
          [column.carbs]: "Tr",
          [column.kcal]: "N",
          sfa_food_c10_0_100g_food_g: "(0.07)",
          sfa_fa_c8_0_100g_fa_g: "-0.01",
        }),
      );

      expect(raw[column.carbs]).toBe("Tr");
      expect(raw[column.kcal]).toBe("N");
      expect(raw["sfa_food_c10_0_100g_food_g"]).toBe("(0.07)");
      expect(raw["sfa_fa_c8_0_100g_fa_g"]).toBe("-0.01");
      expect(raw[column.protein]).toBeNull();
      expect(raw["food_name"]).toBe("Test food");
    });

    it("should have exactly the columns of the row", () => {
      const row = cofidRow({ vitamins_retinol_ug: "3" });

      expect(Object.keys(mapRow(row).raw)).toEqual(Object.keys(row));
    });
  });
});

describe("COFID_COLUMNS", () => {
  // Written out in full on purpose: the mapping tests build their rows from the constant, so only
  // literals here can catch it pointing at the wrong workbook column.
  const expectedColumns = {
    kcal: "proximates_energy_kcal_kcal",
    protein: "proximates_protein_g",
    fat: "proximates_fat_g",
    carbs: "proximates_carbohydrate_g",
    sugars: "proximates_total_sugars_g",
    saturatedFat: "proximates_satd_fa_100g_fd_g",
    fibreEnglyst: "proximates_nsp_g",
    fibreAoac: "proximates_aoac_fibre_g",
    sodium: "inorganics_sodium_mg",
  };

  it("should name the workbook columns the mapping reads", () => {
    expect(COFID_COLUMNS).toEqual(expectedColumns);
  });

  it("should all exist in the header of the committed normalised CSV", () => {
    const csv = readFileSync(
      new URL("../../../data/cofid/cofid-2021.normalised.csv", import.meta.url),
      "utf8",
    );
    const header = csv.slice(0, csv.indexOf("\n")).split(",");

    expect(header).toEqual(expect.arrayContaining(Object.values(expectedColumns)));
  });
});

describe("requireCofidColumns", () => {
  it("should accept a header that holds every column the mapping reads", () => {
    expect(() => {
      requireCofidColumns(Object.keys(cofidRow()));
    }).not.toThrow();
  });

  it("should name the columns that are missing", () => {
    const header = Object.keys(cofidRow()).filter(
      (name) => name !== column.sodium && name !== column.kcal,
    );

    expect(() => {
      requireCofidColumns(header);
    }).toThrow(`${column.kcal}, ${column.sodium}`);
  });
});
