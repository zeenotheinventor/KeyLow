import { weekAverage } from "@keylow/core/diary";

import { weekDayTotals } from "./weekDayTotals";

import type { DiaryWeekDay } from "@keylow/api-client";

const totals = (overrides: Partial<NonNullable<DiaryWeekDay["totals"]>>) => ({
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
    expect(weekDayTotals(totals({}))).toEqual({
      kcal: 1500,
      protein_g: 100,
      carbs_g: 150,
      fat_g: 50,
    });
  });

  it("should read a nutrient no entry gave a value for as 0, as the day's bars do", () => {
    expect(weekDayTotals(totals({ kcal: null, protein_g: null }))).toEqual({
      kcal: 0,
      protein_g: 0,
      carbs_g: 150,
      fat_g: 50,
    });
  });

  it("should leave a day with nothing logged out of the average, and count a day of 0 kcal", () => {
    const days = [
      { localDate: "2026-10-12", totals: weekDayTotals(totals({ kcal: null })) },
      { localDate: "2026-10-13", totals: weekDayTotals(null) },
      { localDate: "2026-10-14", totals: weekDayTotals(totals({ kcal: 2000 })) },
    ];

    expect(weekAverage(days, "2026-10-14")?.kcal).toBe(1000);
  });
});
