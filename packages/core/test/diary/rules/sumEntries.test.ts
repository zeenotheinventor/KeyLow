import { describe, expect, it } from "vitest";

import { sumEntries } from "../../../src/diary/rules/sumEntries";
import { sumNutrients } from "../../../src/nutrition";

import type { NullableNutrients } from "../../../src/schemas";

const nutrients = (overrides: Partial<NullableNutrients> = {}): NullableNutrients => ({
  kcal: 0,
  protein_g: 0,
  fat_g: 0,
  carbs_g: 0,
  fibre_g: 0,
  ...overrides,
});

const nothing = {
  kcal: null,
  protein_g: null,
  fat_g: null,
  carbs_g: null,
  fibre_g: null,
  sat_fat_g: null,
  sugars_g: null,
  salt_g: null,
};

describe("sumEntries", () => {
  it("should return null for every key when there are no entries", () => {
    expect(sumEntries([])).toEqual(nothing);
  });

  it("should add the five required keys across entries", () => {
    const entries = [
      { nutrients: nutrients({ kcal: 200, protein_g: 10, fat_g: 5, carbs_g: 30, fibre_g: 2 }) },
      {
        nutrients: nutrients({ kcal: 150.5, protein_g: 1.5, fat_g: 7, carbs_g: 12, fibre_g: 0.5 }),
      },
    ];

    expect(sumEntries(entries)).toEqual({
      ...nothing,
      kcal: 350.5,
      protein_g: 11.5,
      fat_g: 12,
      carbs_g: 42,
      fibre_g: 2.5,
    });
  });

  it("should add saturated fat, sugars and salt", () => {
    const entries = [
      { nutrients: nutrients({ sat_fat_g: 1.5, sugars_g: 4, salt_g: 0.25 }) },
      { nutrients: nutrients({ sat_fat_g: 2, sugars_g: 6, salt_g: 0.5 }) },
    ];

    expect(sumEntries(entries)).toMatchObject({ sat_fat_g: 3.5, sugars_g: 10, salt_g: 0.75 });
  });

  it("should leave out an entry that is deleted", () => {
    const entries = [
      { nutrients: nutrients({ kcal: 200 }), deleted_at: null },
      { nutrients: nutrients({ kcal: 900 }), deleted_at: "2026-10-15T09:00:00Z" },
    ];

    expect(sumEntries(entries).kcal).toBe(200);
  });

  it("should return null for every key when every entry is deleted", () => {
    const entries = [{ nutrients: nutrients({ kcal: 900 }), deleted_at: "2026-10-15T09:00:00Z" }];

    expect(sumEntries(entries)).toEqual(nothing);
  });

  it("should skip a null value and add the rest", () => {
    const entries = [
      { nutrients: nutrients({ kcal: 200, fibre_g: null }) },
      { nutrients: nutrients({ kcal: 100, fibre_g: 3 }) },
    ];

    expect(sumEntries(entries)).toMatchObject({ kcal: 300, fibre_g: 3 });
  });

  it("should return null for a key that is null in every entry", () => {
    const entries = [
      { nutrients: nutrients({ fibre_g: null }) },
      { nutrients: nutrients({ fibre_g: null }) },
    ];

    expect(sumEntries(entries).fibre_g).toBeNull();
  });

  it("should skip an optional key an entry leaves out", () => {
    const entries = [{ nutrients: nutrients() }, { nutrients: nutrients({ salt_g: 0.4 }) }];

    expect(sumEntries(entries)).toMatchObject({ salt_g: 0.4, sugars_g: null });
  });

  it("should return 0, not null, when the known values are 0", () => {
    expect(sumEntries([{ nutrients: nutrients({ protein_g: 0 }) }]).protein_g).toBe(0);
  });

  it("should differ from sumNutrients, which makes a sum null when any item is null", () => {
    const withUnknownFibre = nutrients({ fibre_g: null });
    const withFibre = nutrients({ fibre_g: 3 });

    expect(sumNutrients([withUnknownFibre, withFibre]).fibre_g).toBeNull();
    expect(sumEntries([{ nutrients: withUnknownFibre }, { nutrients: withFibre }]).fibre_g).toBe(3);
    expect(sumNutrients([]).kcal).toBe(0);
    expect(sumEntries([]).kcal).toBeNull();
  });
});
