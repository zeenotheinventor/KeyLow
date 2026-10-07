import { describe, expect, it } from "vitest";

import { fixtures, normalisableFixtures, normaliseOk, withoutNutriments } from "./offFixtures";

import type { OffFixture } from "./offFixtures";

const macroColumns = ["kcal", "protein_g", "fat_g", "carbs_g"] as const;

type NutrientColumn =
  "kcal" | "protein_g" | "fat_g" | "sat_fat_g" | "carbs_g" | "sugars_g" | "fibre_g" | "salt_g";

const sourceBases: Record<Exclude<NutrientColumn, "kcal">, readonly string[]> = {
  protein_g: ["proteins"],
  fat_g: ["fat"],
  sat_fat_g: ["saturated-fat"],
  carbs_g: ["carbohydrates"],
  sugars_g: ["sugars"],
  fibre_g: ["fiber"],
  salt_g: ["salt", "sodium"],
};

function hasSourceData(fixture: OffFixture, bases: readonly string[]): boolean {
  return bases.some(
    (base) => `${base}_100g` in fixture.nutriments || `${base}_serving` in fixture.nutriments,
  );
}

/** Independent oracle: can this column legitimately hold a number given what the payload recorded? */
function mayHoldNumber(fixture: OffFixture, column: NutrientColumn): boolean {
  if (column !== "kcal") {
    return hasSourceData(fixture, sourceBases[column]);
  }
  const canDerive = (["protein_g", "fat_g", "carbs_g", "fibre_g"] as const).every((macro) =>
    hasSourceData(fixture, sourceBases[macro]),
  );
  return canDerive || hasSourceData(fixture, ["energy-kcal", "energy-kj", "energy"]);
}

const allColumns: readonly NutrientColumn[] = [
  "kcal",
  "protein_g",
  "fat_g",
  "sat_fat_g",
  "carbs_g",
  "sugars_g",
  "fibre_g",
  "salt_g",
];

// Every fixture, with each nutriments key removed in turn, then with all of them removed.
const permutations = Object.entries(normalisableFixtures).flatMap(([fixtureName, fixture]) => {
  const keys = Object.keys(fixture.nutriments);
  return [
    ...keys.map((key) => ({
      description: `${fixtureName} without ${key}`,
      mutated: withoutNutriments(fixture, [key]),
    })),
    {
      description: `${fixtureName} without any nutriments`,
      mutated: withoutNutriments(fixture, keys),
    },
  ];
});

describe("a field missing from the payload never becomes a number", () => {
  it.each(permutations)("$description", ({ mutated }) => {
    const { food } = normaliseOk(mutated);

    for (const column of allColumns) {
      if (!mayHoldNumber(mutated, column)) {
        expect(food[column], column).toBeNull();
      }
    }

    for (const base of Object.keys(food.micros)) {
      const isRecorded =
        `${base}_100g` in mutated.nutriments || `${base}_serving` in mutated.nutriments;
      expect(isRecorded, base).toBe(true);
    }

    const nullMacros = macroColumns.filter((column) => food[column] === null);
    const expectedMissing = [
      ...nullMacros,
      ...(food.quality.carbs_convention === "us_total" ? ["fibre_g"] : []),
    ];
    expect(food.quality.suspect ?? false).toBe(expectedMissing.length > 0);
    expect(food.quality.fields_missing ?? []).toEqual(expectedMissing);
  });
});

describe("removing one nutriment from a fully recorded product", () => {
  const fullyRecorded = withoutNutriments(fixtures.kcalPresent, ["energy-kj_100g", "sodium_100g"]);
  const base = normaliseOk(fullyRecorded).food;

  it("should start from a product with every column recorded and nothing suspect", () => {
    expect(allColumns.map((column) => base[column])).not.toContain(null);
    expect(base.quality).toEqual({});
  });

  it.each([
    { removed: ["proteins_100g"], nullColumns: ["protein_g"], missing: ["protein_g"] },
    { removed: ["fat_100g"], nullColumns: ["fat_g"], missing: ["fat_g"] },
    { removed: ["carbohydrates_100g"], nullColumns: ["carbs_g"], missing: ["carbs_g"] },
    // Without fibre the energy cannot be derived either, so removing both leaves kcal missing.
    {
      removed: ["energy-kcal_100g", "fiber_100g"],
      nullColumns: ["kcal", "fibre_g"],
      missing: ["kcal"],
    },
    { removed: ["fiber_100g"], nullColumns: ["fibre_g"], missing: [] },
    { removed: ["saturated-fat_100g"], nullColumns: ["sat_fat_g"], missing: [] },
    { removed: ["sugars_100g"], nullColumns: ["sugars_g"], missing: [] },
    { removed: ["salt_100g"], nullColumns: ["salt_g"], missing: [] },
  ])(
    "should null $nullColumns and list $missing when $removed is removed",
    ({ removed, nullColumns, missing }) => {
      const { food } = normaliseOk(withoutNutriments(fullyRecorded, removed));
      const expectedNutrients = Object.fromEntries(
        allColumns.map((column) => [column, nullColumns.includes(column) ? null : base[column]]),
      );
      expect(food).toEqual({
        ...base,
        ...expectedNutrients,
        quality: missing.length === 0 ? {} : { suspect: true, fields_missing: missing },
      });
    },
  );

  it("should derive kcal from the macros when only energy-kcal is removed", () => {
    const { food } = normaliseOk(withoutNutriments(fullyRecorded, ["energy-kcal_100g"]));
    expect(food.kcal).toBe(4 * 9.5 + 9 * 7.5 + 4 * 62 + 2 * 8);
    expect(food.quality).toEqual({ kcal_derived: true });
  });

  it("should fall back to sodium for salt when only salt is removed", () => {
    const withSodium = withoutNutriments(fixtures.kcalPresent, ["energy-kj_100g", "salt_100g"]);
    expect(normaliseOk(withSodium).food.salt_g).toBe(0.25);
  });
});
