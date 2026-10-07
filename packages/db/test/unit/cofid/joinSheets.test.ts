import { describe, expect, it } from "vitest";

import { columnName } from "../../../scripts/cofid/columns";
import { joinSheets } from "../../../scripts/cofid/joinSheets";

import type { RawSheet, RawSheetRow } from "../../../scripts/cofid/readSheet";

const row = (
  code: string,
  name: string,
  cells: string[],
  overrides: Partial<Record<"description" | "reference", string>> = {},
): RawSheetRow => ({
  identity: [
    code,
    name,
    overrides.description ?? "Recipe",
    "DG",
    "",
    overrides.reference ?? "MW6",
    "",
  ],
  cells,
});

const proximates = (...rows: RawSheetRow[]): RawSheet => ({
  slug: "proximates",
  headers: ["Water (g)", "Protein (g)"],
  rows,
});
const inorganics = (...rows: RawSheetRow[]): RawSheet => ({
  slug: "inorganics",
  headers: ["Sodium (mg)"],
  rows,
});

describe("columnName", () => {
  it.each([
    ["proximates", "Protein (g)", "proximates_protein_g"],
    ["proximates", "Energy (kcal) (kcal)", "proximates_energy_kcal_kcal"],
    ["vitamins", "Retinol (µg)", "vitamins_retinol_ug"],
    ["vitamin_fractions", "13-cis-retinol (µg)", "vitamin_fractions_13_cis_retinol_ug"],
    ["factors", "Nitrogen conversion factor ", "factors_nitrogen_conversion_factor"],
    ["sfa_food", "C4:0 /100g food (g)", "sfa_food_c4_0_100g_food_g"],
  ])("should name %s %j as %s", (slug, header, expected) => {
    expect(columnName(slug, header)).toBe(expected);
  });
});

describe("joinSheets", () => {
  it("should put the identity columns first, then each sheet's columns in sheet order", () => {
    const table = joinSheets(
      [
        inorganics(row("11-1", "Bread", ["400"])),
        proximates(row("11-1", "Bread", ["37.3", "9.4"])),
      ],
      "proximates",
    );

    expect(table.header).toEqual([
      "food_code",
      "food_name",
      "description",
      "food_group",
      "previous_code",
      "main_data_references",
      "footnote",
      "inorganics_sodium_mg",
      "proximates_water_g",
      "proximates_protein_g",
    ]);
    expect(table.rows).toEqual([
      ["11-1", "Bread", "Recipe", "DG", "", "MW6", "", "400", "37.3", "9.4"],
    ]);
  });

  it("should join on the food code even when the sheets list the foods in a different order", () => {
    const table = joinSheets(
      [
        proximates(row("11-1", "Bread", ["37", "9"]), row("11-2", "Butter", ["15", "0.5"])),
        inorganics(row("11-2", "Butter", ["600"]), row("11-1", "Bread", ["400"])),
      ],
      "proximates",
    );

    expect(table.rows.map((joined) => joined.slice(7))).toEqual([
      ["37", "9", "400"],
      ["15", "0.5", "600"],
    ]);
  });

  it("should sort the rows by food code with the numbers compared as numbers", () => {
    const table = joinSheets(
      [
        proximates(
          row("11-1135", "C", ["1", "1"]),
          row("11-135", "B", ["1", "1"]),
          row("10-2000", "A", ["1", "1"]),
        ),
      ],
      "proximates",
    );

    expect(table.rows.map((joined) => joined[0])).toEqual(["10-2000", "11-135", "11-1135"]);
  });

  it("should produce the same rows whatever order the sheet lists them in", () => {
    const first = row("11-1", "Bread", ["37", "9"]);
    const second = row("11-2", "Butter", ["15", "0.5"]);

    expect(joinSheets([proximates(first, second)], "proximates")).toEqual(
      joinSheets([proximates(second, first)], "proximates"),
    );
  });

  it("should keep two foods that share a code and pair them by their order in each sheet", () => {
    const table = joinSheets(
      [
        proximates(
          row("13-669", "Aubergine, roasted", ["83", "2"]),
          row("13-669", "Watercress", ["94", "1"]),
        ),
        inorganics(row("13-669", "Aubergine, roasted", ["5"]), row("13-669", "Watercress", ["49"])),
      ],
      "proximates",
    );

    expect(table.rows.map((joined) => [joined[1], ...joined.slice(7)])).toEqual([
      ["Aubergine, roasted", "83", "2", "5"],
      ["Watercress", "94", "1", "49"],
    ]);
  });

  it("should refuse a sheet whose food has a different name for the same code", () => {
    expect(() =>
      joinSheets(
        [proximates(row("11-1", "Bread", ["1", "1"])), inorganics(row("11-1", "Bun", ["1"]))],
        "proximates",
      ),
    ).toThrow('Food 11-1 is named "Bun" in inorganics but "Bread" in proximates');
  });

  it("should refuse a food that is missing from one of the sheets", () => {
    expect(() =>
      joinSheets([proximates(row("11-1", "Bread", ["1", "1"])), inorganics()], "proximates"),
    ).toThrow("11-1 is missing from inorganics");
  });

  it("should refuse a sheet holding a food the identity sheet does not have", () => {
    expect(() =>
      joinSheets(
        [
          proximates(row("11-1", "Bread", ["1", "1"])),
          inorganics(row("11-1", "Bread", ["1"]), row("11-2", "Butter", ["1"])),
        ],
        "proximates",
      ),
    ).toThrow("inorganics has 2 foods but proximates has 1");
  });

  it("should refuse two headers that would get the same column name", () => {
    expect(() =>
      joinSheets(
        [{ slug: "proximates", headers: ["Water (g)", "Water  (g)"], rows: [] }],
        "proximates",
      ),
    ).toThrow("proximates_water_g");
  });

  it("should refuse a row whose number of cells differs from the number of headers", () => {
    expect(() => joinSheets([proximates(row("11-1", "Bread", ["1"]))], "proximates")).toThrow(
      "11-1",
    );
  });

  it("should report where a later sheet disagrees with the identity sheet about description or references", () => {
    const table = joinSheets(
      [
        proximates(row("11-1", "Bread", ["1", "1"])),
        inorganics(row("11-1", "Bread", ["1"], { description: "Recipe;", reference: "QIB" })),
      ],
      "proximates",
    );

    expect(table.identityDifferences).toEqual([
      { code: "11-1", sheet: "inorganics", column: "description" },
      { code: "11-1", sheet: "inorganics", column: "main_data_references" },
    ]);
  });
});
