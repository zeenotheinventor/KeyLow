import { describe, expect, it } from "vitest";

import {
  COFID_DENSITY_OVERRIDES,
  COFID_GROUP_DENSITIES,
  estimateDensity,
} from "../../src/nutrition/density";

import type { Food } from "../../src/schemas/food";

type DensityFood = Pick<Food, "source" | "source_ref" | "food_group" | "density_g_per_ml">;

const cofidFood = (overrides: Partial<DensityFood>): DensityFood => ({
  source: "cofid",
  source_ref: "99-999",
  food_group: null,
  density_g_per_ml: null,
  ...overrides,
});

describe("estimateDensity precedence", () => {
  it("should keep the food's own density even when the override and the group disagree", () => {
    const honeyWithOwnDensity = cofidFood({
      source_ref: "17-050",
      food_group: "BAH",
      density_g_per_ml: 0.5,
    });

    expect(estimateDensity(honeyWithOwnDensity)).toEqual({ gPerMl: 0.5, basis: "food" });
  });

  it("should use the override for the food's CoFID code before its group", () => {
    const honey = cofidFood({ source_ref: "17-050", food_group: "BAH" });

    expect(estimateDensity(honey)).toEqual({ gPerMl: 1.42, basis: "override" });
  });

  it("should use the group estimate when the food has no density and no override", () => {
    const semiSkimmedMilk = cofidFood({ source_ref: "12-313", food_group: "BAH" });

    expect(estimateDensity(semiSkimmedMilk)).toEqual({ gPerMl: 1.03, basis: "group" });
  });

  it("should return null for a CoFID food whose group has no density", () => {
    const chickenBreast = cofidFood({ source_ref: "18-323", food_group: "MCA" });

    expect(estimateDensity(chickenBreast)).toBeNull();
  });

  it("should return null for a CoFID food with no group and no override", () => {
    expect(estimateDensity(cofidFood({ food_group: null }))).toBeNull();
  });

  it("should still use the group when a CoFID food has no source reference", () => {
    const milk = cofidFood({ source_ref: null, food_group: "BAH" });

    expect(estimateDensity(milk)).toEqual({ gPerMl: 1.03, basis: "group" });
  });
});

describe("estimateDensity group lookup", () => {
  it("should resolve a code through its own entry when the table lists one", () => {
    // BNH is listed with its own density, which differs from its parent BN.
    const yogurt = cofidFood({ food_group: "BNH" });
    const parentYogurt = cofidFood({ food_group: "BN" });

    expect(estimateDensity(yogurt)).toEqual({ gPerMl: 1.08, basis: "group" });
    expect(estimateDensity(parentYogurt)).toEqual({ gPerMl: 1.04, basis: "group" });
  });

  it("should resolve a code the table does not list through its listed parent", () => {
    const madeUpMilkGroup = cofidFood({ food_group: "BAZ" });

    expect(estimateDensity(madeUpMilkGroup)).toEqual({ gPerMl: 1.03, basis: "group" });
  });

  it("should return null for a code with no listed ancestor", () => {
    expect(estimateDensity(cofidFood({ food_group: "ZZ" }))).toBeNull();
  });

  it("should stop at a group listed as having no volume measure instead of using its parent", () => {
    // BAR (evaporated milk beside a dry whitener) is listed without a density, and its parent BA has one.
    expect(estimateDensity(cofidFood({ food_group: "BAR" }))).toBeNull();
    expect(estimateDensity(cofidFood({ food_group: "BARX" }))).toBeNull();
  });
});

describe("estimateDensity with keys that exist on every object", () => {
  it.each(["constructor", "__proto__", "toString", "hasOwnProperty"])(
    "should return null for a CoFID group named %s",
    (group) => {
      expect(estimateDensity(cofidFood({ food_group: group }))).toBeNull();
    },
  );

  it.each(["constructor", "__proto__", "toString", "hasOwnProperty"])(
    "should not read a CoFID food code named %s as an override",
    (code) => {
      expect(estimateDensity(cofidFood({ source_ref: code, food_group: null }))).toBeNull();
    },
  );
});

describe("estimateDensity ignores other sources", () => {
  it("should return null for an Open Food Facts food with no density, whatever its group text", () => {
    const oils = { source: "off", source_ref: "5000000000000", food_group: "oils" } as const;

    expect(estimateDensity({ ...oils, density_g_per_ml: null })).toBeNull();
  });

  it("should not read an Open Food Facts group as a CoFID group code", () => {
    const lookalike = { source: "off", source_ref: "17-050", food_group: "BAH" } as const;

    expect(estimateDensity({ ...lookalike, density_g_per_ml: null })).toBeNull();
  });

  it("should return the density of a user food that has one", () => {
    const userFood = { source: "user", source_ref: null, food_group: null } as const;

    expect(estimateDensity({ ...userFood, density_g_per_ml: 0.8 })).toEqual({
      gPerMl: 0.8,
      basis: "food",
    });
  });

  it("should return null for a user food without a density, even with a CoFID-looking reference", () => {
    const userFood = { source: "user", source_ref: "17-050", food_group: "BAH" } as const;

    expect(estimateDensity({ ...userFood, density_g_per_ml: null })).toBeNull();
  });
});

describe("the density tables", () => {
  const groupEntries = Object.entries(COFID_GROUP_DENSITIES);
  const groupDensities = groupEntries.flatMap(([code, entry]) =>
    entry.gPerMl === null ? [] : [{ code, ...entry }],
  );
  const overrides = Object.entries(COFID_DENSITY_OVERRIDES).map(([code, entry]) => ({
    code,
    ...entry,
  }));

  it("should list at least one group with a density and one without", () => {
    expect(groupDensities.length).toBeGreaterThan(0);
    expect(groupEntries.length).toBeGreaterThan(groupDensities.length);
  });

  it.each([...groupDensities, ...overrides])(
    "should hold a plausible density for $code, between 0.3 and 1.6 g/ml",
    ({ gPerMl }) => {
      expect(gPerMl).toBeGreaterThanOrEqual(0.3);
      expect(gPerMl).toBeLessThanOrEqual(1.6);
    },
  );

  it.each([...groupDensities, ...overrides])(
    "should name a source for the density of $code",
    ({ source }) => {
      expect(source.trim()).not.toBe("");
    },
  );

  it.each(groupEntries.filter(([, entry]) => entry.gPerMl === null))(
    "should give a reason for the group %s having no volume measure",
    (_code, entry) => {
      expect("reason" in entry ? entry.reason.trim() : "").not.toBe("");
    },
  );
});
