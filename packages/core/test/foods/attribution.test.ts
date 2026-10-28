import { describe, expect, it } from "vitest";

import { DATA_SOURCE_ATTRIBUTION as rootAttribution } from "@keylow/core";
import { DATA_SOURCE_ATTRIBUTION as foodsAttribution } from "@keylow/core/foods";

import { DATA_SOURCE_ATTRIBUTION } from "../../src/foods/attribution";

describe("DATA_SOURCE_ATTRIBUTION", () => {
  it("should pin the Open Food Facts attribution", () => {
    expect(DATA_SOURCE_ATTRIBUTION.off).toEqual({
      name: "Open Food Facts",
      licence: "Open Database License (ODbL) v1.0",
      text: "Data from Open Food Facts, available under the Open Database Licence.",
      url: "https://world.openfoodfacts.org",
    });
  });

  it("should pin the CoFID attribution", () => {
    expect(DATA_SOURCE_ATTRIBUTION.cofid).toEqual({
      name: "McCance and Widdowson's The Composition of Foods Integrated Dataset (CoFID)",
      licence: "Open Government Licence v3.0",
      text: "Contains public sector information licensed under the Open Government Licence v3.0. Source: McCance and Widdowson's The Composition of Foods Integrated Dataset, Public Health England and the Office for Health Improvement and Disparities.",
      url: "https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid",
    });
  });

  it("should pin the USDA FoodData Central attribution", () => {
    expect(DATA_SOURCE_ATTRIBUTION.usda).toEqual({
      name: "USDA FoodData Central",
      licence: "CC0 1.0 Universal (public domain)",
      text: "Data from USDA FoodData Central, U.S. Department of Agriculture, Agricultural Research Service, released into the public domain under CC0 1.0. Natural portions and some foods come from its SR Legacy release (April 2018).",
      url: "https://fdc.nal.usda.gov",
    });
  });

  it("should have exactly the off, cofid and usda entries", () => {
    expect(Object.keys(DATA_SOURCE_ATTRIBUTION).sort()).toEqual(["cofid", "off", "usda"]);
  });

  it("should be importable from the package root", () => {
    expect(rootAttribution).toBe(DATA_SOURCE_ATTRIBUTION);
  });

  it("should be importable from the foods subpath", () => {
    expect(foodsAttribution).toBe(DATA_SOURCE_ATTRIBUTION);
  });
});
