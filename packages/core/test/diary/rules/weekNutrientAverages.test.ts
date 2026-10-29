import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { weekAverage } from "../../../src/diary/rules/weekAverage";
import { weekDayTotals } from "../../../src/diary/rules/weekDayTotals";
import {
  WEEK_NUTRIENT_KEYS,
  weekNutrientAverages,
} from "../../../src/diary/rules/weekNutrientAverages";
import { weekOf } from "../../../src/diary/rules/weekStrip";

import type {
  WeekNutrientAveragesDay,
  WeekNutrientDayTotals,
  WeekNutrientKey,
} from "../../../src/diary/rules/weekNutrientAverages";

// The week of Monday 12 to Sunday 18 October 2026, as `getDiaryWeek` gives it.
const WEEK = weekOf("2026-10-12");
const THURSDAY = "2026-10-15";
const NO_TARGETS = { kcal: null, protein_g: null, carbs_g: null, fat_g: null };

const dayTotals = (overrides: Partial<WeekNutrientDayTotals> = {}): WeekNutrientDayTotals => ({
  kcal: 2000,
  protein_g: 150,
  carbs_g: 200,
  fat_g: 70,
  fibre_g: 30,
  sat_fat_g: 20,
  sugars_g: 50,
  salt_g: 5,
  ...overrides,
});

/** One week from a list of totals, Monday first. A missing or null entry is a day with nothing logged. */
const weekOfTotals = (
  totals: readonly (WeekNutrientDayTotals | null | undefined)[],
): WeekNutrientAveragesDay[] =>
  WEEK.map((localDate, index) => ({ localDate, totals: totals[index] ?? null }));

const nutrient = (result: ReturnType<typeof weekNutrientAverages>, key: WeekNutrientKey) =>
  result.nutrients.find((row) => row.key === key);

describe("weekNutrientAverages", () => {
  it("should list every nutrient in order", () => {
    const result = weekNutrientAverages({
      days: weekOfTotals([]),
      today: THURSDAY,
      targets: NO_TARGETS,
    });

    expect(result.nutrients.map((row) => row.key)).toEqual([...WEEK_NUTRIENT_KEYS]);
    expect(result.weekStart).toBe("2026-10-12");
  });

  it("should give null for every nutrient when nothing is logged", () => {
    const result = weekNutrientAverages({
      days: weekOfTotals([]),
      today: THURSDAY,
      targets: NO_TARGETS,
    });

    expect(result.daysLogged).toBe(0);
    for (const row of result.nutrients) {
      expect(row.dailyAverage).toBeNull();
      expect(row.weekTotal).toBeNull();
    }
  });

  it("should average over the days logged so far and total them", () => {
    const result = weekNutrientAverages({
      days: weekOfTotals([
        dayTotals({ kcal: 2100, protein_g: 140 }),
        null,
        dayTotals({ kcal: 1900, protein_g: 160 }),
      ]),
      today: THURSDAY,
      targets: NO_TARGETS,
    });

    expect(result.daysLogged).toBe(2);
    expect(nutrient(result, "kcal")).toMatchObject({ dailyAverage: 2000, weekTotal: 4000 });
    expect(nutrient(result, "protein_g")).toMatchObject({ dailyAverage: 150, weekTotal: 300 });
    expect(nutrient(result, "salt_g")).toMatchObject({ dailyAverage: 5, weekTotal: 10 });
  });

  it("should leave out a day after today, even with entries", () => {
    const result = weekNutrientAverages({
      days: weekOfTotals([dayTotals({ kcal: 2000 }), null, null, null, dayTotals({ kcal: 9000 })]),
      today: THURSDAY,
      targets: NO_TARGETS,
    });

    expect(result.daysLogged).toBe(1);
    expect(nutrient(result, "kcal")?.dailyAverage).toBe(2000);
  });

  it("should give null for a nutrient no logged day gave a value for, never 0", () => {
    const result = weekNutrientAverages({
      days: weekOfTotals([dayTotals({ sat_fat_g: null }), dayTotals({ sat_fat_g: null })]),
      today: THURSDAY,
      targets: NO_TARGETS,
    });

    expect(nutrient(result, "sat_fat_g")).toMatchObject({ dailyAverage: null, weekTotal: null });
  });

  it("should count a logged day with no value for a nutrient as 0, as the day's bars do", () => {
    const result = weekNutrientAverages({
      days: weekOfTotals([dayTotals({ sugars_g: 60 }), dayTotals({ sugars_g: null })]),
      today: THURSDAY,
      targets: NO_TARGETS,
    });

    expect(nutrient(result, "sugars_g")?.dailyAverage).toBe(30);
  });

  it("should carry the daily targets for calories and the macros only, and drop one that is not above 0", () => {
    const result = weekNutrientAverages({
      days: weekOfTotals([dayTotals()]),
      today: THURSDAY,
      targets: { kcal: 2200, protein_g: 160, carbs_g: 0, fat_g: null },
    });

    expect(result.nutrients.map((row) => row.dailyTarget)).toEqual([
      2200,
      160,
      null,
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it("should give null, not 0 g, for a macro no logged day gave a value for", () => {
    const result = weekNutrientAverages({
      days: weekOfTotals([dayTotals({ protein_g: null }), dayTotals({ protein_g: null })]),
      today: THURSDAY,
      targets: NO_TARGETS,
    });

    expect(nutrient(result, "protein_g")).toMatchObject({ dailyAverage: null, weekTotal: null });
  });

  it("should agree with the This week card's average for calories and the macros wherever a day gave a value", () => {
    const amount = fc.option(fc.double({ min: 0, max: 5000, noNaN: true }), { nil: null });
    const day = fc.option(
      fc.record({
        kcal: amount,
        protein_g: amount,
        carbs_g: amount,
        fat_g: amount,
        fibre_g: amount,
        sat_fat_g: amount,
        sugars_g: amount,
        salt_g: amount,
      }),
      { nil: null },
    );

    fc.assert(
      fc.property(
        fc.array(day, { minLength: 7, maxLength: 7 }),
        fc.constantFrom(...WEEK),
        (totals, today) => {
          const days = weekOfTotals(totals);
          const result = weekNutrientAverages({ days, today, targets: NO_TARGETS });
          const card = weekAverage(
            days.map((entry) => ({
              localDate: entry.localDate,
              totals: weekDayTotals(entry.totals),
            })),
            today,
          );

          for (const key of ["kcal", "protein_g", "carbs_g", "fat_g"] as const) {
            const average = nutrient(result, key)?.dailyAverage ?? null;
            // A macro no logged day gave a value for reads not given here, and 0 on the card.
            expect(average ?? (card === null ? null : 0)).toBe(card?.[key] ?? null);
          }
        },
      ),
    );
  });
});
