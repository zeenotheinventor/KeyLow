import { describe, expect, it } from "vitest";

import { weekAverage } from "../../../src/diary/rules/weekAverage";
import { weekDayTotals } from "../../../src/diary/rules/weekDayTotals";

// A `day_totals` row, as the diary's week reads it.
const dayTotalsRow = (
  overrides: Partial<Record<"kcal" | "protein_g" | "carbs_g" | "fat_g", number | null>>,
) => ({
  local_date: "2026-10-12",
  entry_count: 3,
  kcal: 1500,
  protein_g: 100,
  carbs_g: 150,
  fat_g: 50,
  fibre_g: null,
  sat_fat_g: null,
  sugars_g: null,
  salt_g: null,
  ...overrides,
});

describe("weekDayTotals", () => {
  it("should give null for a day with no entries", () => {
    expect(weekDayTotals(null)).toBeNull();
  });

  it("should give the four figures the average takes", () => {
    expect(weekDayTotals(dayTotalsRow({}))).toEqual({
      kcal: 1500,
      protein_g: 100,
      carbs_g: 150,
      fat_g: 50,
    });
  });

  it("should read a nutrient no entry gave a value for as 0, as the day's bars do", () => {
    expect(weekDayTotals(dayTotalsRow({ kcal: null, protein_g: null }))).toEqual({
      kcal: 0,
      protein_g: 0,
      carbs_g: 150,
      fat_g: 50,
    });
  });

  it("should read all four nutrients as 0 when no entry gave a value for any", () => {
    expect(
      weekDayTotals(dayTotalsRow({ kcal: null, protein_g: null, carbs_g: null, fat_g: null })),
    ).toEqual({ kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
  });

  it("should leave a day with nothing logged out of the average, and count a day of 0 kcal", () => {
    const days = [
      { localDate: "2026-10-12", totals: weekDayTotals(dayTotalsRow({ kcal: null })) },
      { localDate: "2026-10-13", totals: weekDayTotals(null) },
      { localDate: "2026-10-14", totals: weekDayTotals(dayTotalsRow({ kcal: 2000 })) },
    ];

    expect(weekAverage(days, "2026-10-14")?.kcal).toBe(1000);
  });
});
