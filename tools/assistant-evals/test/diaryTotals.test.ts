import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { DIARY_DAY_COUNT, FIXTURE_FOODS, FIXTURE_FOOD_CODES, diaryDay } from "../fixtures/diary.ts";
import {
  FIXTURE_FOOD_VALUES,
  dayEntries,
  dayTotals,
  rangeTotals,
  seededFoods,
  weightRange,
} from "../fixtures/diaryTotals.ts";

const SEED = readFileSync(
  new URL("../../../packages/db/supabase/seeds/10_cofid_subset.sql", import.meta.url),
  "utf8",
);

// The row of a food in the generated seed: name, then basis, density and the eight values in column order.
function seedRow(code: string) {
  const start = SEED.indexOf(`values ('cofid', '${code}', null, '`);
  if (start === -1) {
    throw new Error(`The seed has no row for ${code}`);
  }
  const row = SEED.slice(start + `values ('cofid', '${code}', null, '`.length);
  const nameEnd = row.search(/'(?!')/);
  const rest = row
    .slice(nameEnd + 1)
    .split(",")
    .map((part) => part.trim());
  // rest: "", brand, barcode, basis, density, kcal, protein, fat, sat fat, carbs, sugars, fibre, salt
  const [, , , basis, density, kcal, protein, fat, satFat, carbs, sugars, fibre, salt] = rest;
  return {
    name: row.slice(0, nameEnd).replaceAll("''", "'"),
    basis,
    density,
    values: [kcal, protein, fat, satFat, carbs, sugars, fibre, salt].map(Number),
  };
}

describe("the fixture foods", () => {
  it.each(FIXTURE_FOODS)("should be the row of the local seed for %s", (food) => {
    const seeded = seedRow(FIXTURE_FOOD_CODES[food]);
    const held = FIXTURE_FOOD_VALUES[food];

    expect(seeded.name).toBe(held.name);
    expect(seeded.basis).toBe("'per_100g'");
    expect(seeded.density).toBe("null");
    expect(seeded.values).toEqual([
      held.kcal,
      held.protein_g,
      held.fat_g,
      held.sat_fat_g,
      held.carbs_g,
      held.sugars_g,
      held.fibre_g,
      held.salt_g,
    ]);
  });
});

describe("seededFoods", () => {
  it("should hold every fixture food, per 100 g", () => {
    const foods = seededFoods();

    expect(foods.size).toBe(13);
    expect(foods.get("oats")).toMatchObject({ kcal: 381, protein_g: 10.9, basis: "per_100g" });
    expect(foods.get("oil")).toMatchObject({ kcal: 899, fat_g: 99.9 });
  });
});

describe("dayEntries", () => {
  it("should scale a food by its grams, as the app does when it logs it", () => {
    // Day 1 has an egg and bread for breakfast: 120 g of egg at 143 kcal per 100 g is 171.6 kcal.
    const [egg] = dayEntries(1);

    expect(egg?.name).toBe("egg");
    expect(egg?.time).toBe("07:45");
    expect(egg?.nutrients.kcal).toBeCloseTo(171.6, 6);
  });

  it("should take a recipe serving from the recipe's computed totals", () => {
    // Day 0 starts with the porridge bowl: 50 g oats, 200 g milk and 90 g banana, one serving of 340 g.
    const [porridge] = dayEntries(0);

    expect(porridge?.name).toBe("Eval porridge bowl");
    expect(porridge?.nutrients.kcal).toBeCloseTo(0.5 * 381 + 2 * 63 + 0.9 * 81, 6);
  });

  it("should list as many entries as the diary plans for the day", () => {
    for (let day = 0; day < DIARY_DAY_COUNT; day += 1) {
      expect(dayEntries(day)).toHaveLength(diaryDay(day).entries.length);
    }
  });
});

describe("dayTotals and rangeTotals", () => {
  it("should add a day's entries up with core's sumEntries", () => {
    const byHand = dayEntries(3).reduce((sum, { nutrients }) => sum + (nutrients.kcal ?? 0), 0);

    expect(dayTotals(3).kcal).toBeCloseTo(byHand, 6);
  });

  it("should average over the days that have entries and count the days logged", () => {
    const range = rangeTotals(10, 16);

    expect(range.daysLogged).toBe(7);
    expect(range.total.kcal).toBeCloseTo(
      [10, 11, 12, 13, 14, 15, 16].reduce((sum, day) => sum + (dayTotals(day).kcal ?? 0), 0),
      6,
    );
    expect(range.average.kcal).toBeCloseTo((range.total.kcal ?? 0) / 7, 6);
  });

  it("should ignore days outside the diary, so a range that starts before it counts only its logged days", () => {
    const range = rangeTotals(-3, 2);

    expect(range.daysLogged).toBe(3);
    expect(range.entryCount).toBe(
      [0, 1, 2].reduce((sum, day) => sum + diaryDay(day).entries.length, 0),
    );
  });

  it("should know nothing about a range with no logged day", () => {
    const range = rangeTotals(-30, -20);

    expect(range.daysLogged).toBe(0);
    expect(range.entryCount).toBe(0);
  });
});

describe("weightRange", () => {
  const anchorDate = "2026-11-02";

  it("should list the weigh-ins of the range, one every second day, as the diary plans them", () => {
    const range = weightRange(anchorDate, 20, 33);

    expect(range.weighIns.map(({ dayNumber }) => dayNumber)).toEqual([20, 22, 24, 26, 28, 30, 32]);
    expect(range.weighIns[5]?.weightKg).toBe(diaryDay(30).weightKg);
  });

  it("should give the trend at the first and the last day of the range, rounded to 0.1 kg", () => {
    const range = weightRange(anchorDate, 28, 40);

    expect(range.trendStart).toBeGreaterThan(range.trendEnd ?? 0);
    expect(range.trendEnd).toBeCloseTo(80.9, 0);
    expect(Math.round((range.trendEnd ?? 0) * 10) / 10).toBe(range.trendEnd);
  });

  it("should give a weekly rate that is negative while the weight falls", () => {
    expect(weightRange(anchorDate, 26, 40).weeklyRateKg).toBeLessThan(0);
  });

  it("should have no trend and no rate for a range before the first weigh-in", () => {
    const range = weightRange(anchorDate, -10, -3);

    expect(range.weighIns).toEqual([]);
    expect(range.trendStart).toBeNull();
    expect(range.trendEnd).toBeNull();
    expect(range.weeklyRateKg).toBeNull();
  });
});
