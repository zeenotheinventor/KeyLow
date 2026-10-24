import { describe, expect, it } from "vitest";

import {
  defaultUnitsForRegion,
  entryWeightUnit,
  heightUnitFor,
  weightUnitToSave,
} from "../../src/setup";

describe("defaultUnitsForRegion", () => {
  it.each([["US"], ["LR"], ["MM"]])("should give pounds and feet and inches for %s", (region) => {
    expect(defaultUnitsForRegion(region)).toEqual({ weightUnit: "lb", heightUnit: "ft_in" });
  });

  it.each([["GB"], ["DE"], ["AU"], ["CA"], ["IE"]])(
    "should give kilograms and centimetres for %s",
    (region) => {
      expect(defaultUnitsForRegion(region)).toEqual({ weightUnit: "kg", heightUnit: "cm" });
    },
  );

  it("should give kilograms and centimetres when the region is unknown", () => {
    expect(defaultUnitsForRegion(null)).toEqual({ weightUnit: "kg", heightUnit: "cm" });
    expect(defaultUnitsForRegion(undefined)).toEqual({ weightUnit: "kg", heightUnit: "cm" });
    expect(defaultUnitsForRegion("")).toEqual({ weightUnit: "kg", heightUnit: "cm" });
  });

  it("should read a region in lower case", () => {
    expect(defaultUnitsForRegion("us")).toEqual({ weightUnit: "lb", heightUnit: "ft_in" });
  });
});

describe("entryWeightUnit", () => {
  it("should use a stored kilogram unit as it is, whatever the region", () => {
    expect(entryWeightUnit("kg", "US")).toBe("kg");
  });

  it("should use a stored pound unit as it is, whatever the region", () => {
    expect(entryWeightUnit("lb", "GB")).toBe("lb");
  });

  it("should give pounds for a stored stone unit, whatever the region", () => {
    expect(entryWeightUnit("st", "GB")).toBe("lb");
    expect(entryWeightUnit("st", "US")).toBe("lb");
  });

  it("should give the region default when nothing is stored", () => {
    expect(entryWeightUnit(null, "US")).toBe("lb");
    expect(entryWeightUnit(null, "GB")).toBe("kg");
    expect(entryWeightUnit(null, null)).toBe("kg");
  });
});

describe("entryWeightUnit with a stored value the profile cannot hold", () => {
  it("should read text that is not a weight unit as none stored, so the region decides", () => {
    expect(entryWeightUnit("stone", "US")).toBe("lb");
    expect(entryWeightUnit("stone", "GB")).toBe("kg");
    expect(entryWeightUnit("", "US")).toBe("lb");
  });
});

describe("heightUnitFor", () => {
  it("should give centimetres with kilograms and feet and inches with pounds", () => {
    expect(heightUnitFor("kg")).toBe("cm");
    expect(heightUnitFor("lb")).toBe("ft_in");
  });
});

describe("weightUnitToSave", () => {
  it("should save the chosen unit when nothing is stored", () => {
    expect(weightUnitToSave(null, "kg")).toBe("kg");
    expect(weightUnitToSave(null, "lb")).toBe("lb");
  });

  it.each([["kg"], ["lb"], ["st"]] as const)(
    "should save nothing when %s is stored, whatever was chosen",
    (stored) => {
      expect(weightUnitToSave(stored, "kg")).toBeUndefined();
      expect(weightUnitToSave(stored, "lb")).toBeUndefined();
    },
  );
});
