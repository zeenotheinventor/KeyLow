import { describe, expect, it } from "vitest";

import { parsePortionRows } from "../../../scripts/portions/portionRows";

const header =
  "food_code,label,grams,ml,is_default,position,weight_basis,fdc_id,fdc_description,source";

const fileOf = (...lines: string[]): string => [header, ...lines, ""].join("\n");

describe("parsePortionRows", () => {
  it("should read a grams portion by column name", () => {
    const rows = parsePortionRows(
      fileOf(
        "14-318,1 medium,118,,true,1,flesh only,173944,Bananas raw,USDA FoodData Central 173944",
      ),
    );

    expect(rows).toEqual([
      { foodCode: "14-318", label: "1 medium", grams: 118, ml: null, isDefault: true, position: 1 },
    ]);
  });

  it("should read a millilitre portion", () => {
    const rows = parsePortionRows(
      fileOf("12-307,1 glass,,250,false,0,as sold,1,Milk,USDA FoodData Central 1"),
    );

    expect(rows).toEqual([
      { foodCode: "12-307", label: "1 glass", grams: null, ml: 250, isDefault: false, position: 0 },
    ]);
  });

  it("should find columns by name wherever they sit, and ignore the citation columns", () => {
    const text = [
      "source,position,is_default,ml,grams,label,food_code,fdc_id,fdc_description,weight_basis",
      '"USDA FoodData Central, FDC id 9",2,false,,40,1 slice,11-980,9,"Bread, white",sliced',
      "",
    ].join("\n");

    expect(parsePortionRows(text)).toEqual([
      { foodCode: "11-980", label: "1 slice", grams: 40, ml: null, isDefault: false, position: 2 },
    ]);
  });

  it("should refuse a file that lacks a column the loader reads", () => {
    expect(() =>
      parsePortionRows("food_code,label,grams,ml,is_default\n11-980,1 slice,40,,false\n"),
    ).toThrow("position");
  });

  it("should refuse a row with both grams and ml", () => {
    expect(() => parsePortionRows(fileOf("11-980,1 slice,40,30,false,0,x,1,x,x"))).toThrow(
      "Row 2: give exactly one of grams and ml",
    );
  });

  it("should refuse a row with neither grams nor ml", () => {
    expect(() => parsePortionRows(fileOf("11-980,1 slice,,,false,0,x,1,x,x"))).toThrow(
      "Row 2: give exactly one of grams and ml",
    );
  });

  it("should refuse a weight that is zero or not a number", () => {
    expect(() => parsePortionRows(fileOf("11-980,1 slice,0,,false,0,x,1,x,x"))).toThrow("grams");
    expect(() => parsePortionRows(fileOf("11-980,1 slice,lots,,false,0,x,1,x,x"))).toThrow("grams");
  });

  it("should refuse an is_default that is not true or false", () => {
    expect(() => parsePortionRows(fileOf("11-980,1 slice,40,,yes,0,x,1,x,x"))).toThrow(
      "is_default",
    );
  });

  it("should refuse a position that is not a whole number", () => {
    expect(() => parsePortionRows(fileOf("11-980,1 slice,40,,false,1.5,x,1,x,x"))).toThrow(
      "position",
    );
  });

  it("should refuse a food code that is not a CoFID code", () => {
    expect(() => parsePortionRows(fileOf("bread,1 slice,40,,false,0,x,1,x,x"))).toThrow(
      "food_code",
    );
  });

  it("should refuse a repeated food code and label, which would write one row twice", () => {
    expect(() =>
      parsePortionRows(
        fileOf("11-980,1 slice,40,,false,0,x,1,x,x", "11-980,1 slice,42,,false,1,x,1,x,x"),
      ),
    ).toThrow("1 slice");
  });

  it("should refuse a food with two defaults, which the database would reject", () => {
    expect(() =>
      parsePortionRows(
        fileOf("11-980,1 slice,40,,true,0,x,1,x,x", "11-980,1 large,50,,true,1,x,1,x,x"),
      ),
    ).toThrow("11-980");
  });
});
