import { describe, expect, it } from "vitest";

import {
  ENERGY_NOT_GIVEN,
  NOT_GIVEN,
  SHARES_OF_ENERGY_ARE_ESTIMATES,
  VALUES_PER_100_G_NOTE,
  describeBasis,
  describeEnergy,
  describeShareOfEnergy,
  describeSpokenBasis,
} from "../../src/copy";

describe("nutrient wording", () => {
  it("should pin the drawn sentences", () => {
    expect(NOT_GIVEN).toBe("not given");
    expect(ENERGY_NOT_GIVEN).toBe("Energy not given");
    expect(VALUES_PER_100_G_NOTE).toBe("Values per 100 g unless marked");
    expect(SHARES_OF_ENERGY_ARE_ESTIMATES).toBe("Shares of energy are estimates");
  });

  it("should never say 0 for a nutrient that is not given", () => {
    expect(NOT_GIVEN).not.toMatch(/\d/);
    expect(ENERGY_NOT_GIVEN).not.toMatch(/\d/);
  });
});

describe("describeBasis", () => {
  it.each([
    ["per_100g", "per 100 g"],
    ["per_100ml", "per 100 ml"],
  ] as const)("should label %s as %s", (basis, expected) => {
    expect(describeBasis(basis)).toBe(expected);
  });
});

describe("describeSpokenBasis", () => {
  it.each([
    ["per_100g", "per 100 grams"],
    ["per_100ml", "per 100 millilitres"],
  ] as const)("should spell %s out as %s", (basis, expected) => {
    expect(describeSpokenBasis(basis)).toBe(expected);
  });
});

describe("describeEnergy", () => {
  it("should spell out the energy for a screen reader", () => {
    expect(describeEnergy(148)).toBe("energy 148 kilocalories");
  });

  it("should write the energy as the screen shows it", () => {
    expect(describeEnergy(2480.4)).toBe("energy 2,480 kilocalories");
  });

  it("should say kilocalorie for exactly one", () => {
    expect(describeEnergy(1)).toBe("energy 1 kilocalorie");
  });

  it("should read a missing energy as not given, never 0", () => {
    expect(describeEnergy(null)).toBe("energy not given");
  });

  it("should read a stated zero as zero", () => {
    expect(describeEnergy(0)).toBe("energy 0 kilocalories");
  });
});

describe("describeShareOfEnergy", () => {
  it("should write the share the way the tiles show it", () => {
    expect(describeShareOfEnergy(32)).toBe("32 % of energy");
  });
});
