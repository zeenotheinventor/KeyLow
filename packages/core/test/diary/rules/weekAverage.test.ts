import { describe, expect, it } from "vitest";

import { weekAverage } from "../../../src/diary/rules/weekAverage";
import { weekCaloriesBeforeToday } from "../../../src/diary/rules/weekCaloriesBeforeToday";
import { weekNutrientAverages } from "../../../src/diary/rules/weekNutrientAverages";

import type { WeekAverageDay } from "../../../src/diary/rules/weekAverage";
import type { WeekNutrientDayTotals } from "../../../src/diary/rules/weekNutrientAverages";

const totals = (kcal: number, protein_g: number, carbs_g: number, fat_g: number) => ({
  kcal,
  protein_g,
  carbs_g,
  fat_g,
});

// The week of Monday 12 October 2026 on the web diary board, today the Thursday.
const monday = { localDate: "2026-10-12", totals: totals(2140, 158, 214, 66) };
const tuesday = { localDate: "2026-10-13", totals: totals(2260, 149, 231, 74) };
const wednesday = { localDate: "2026-10-14", totals: totals(1286, 111, 129, 35) };
const thursday = { localDate: "2026-10-15", totals: totals(1039, 86, 129, 19) };
const noEntries = (localDate: string): WeekAverageDay => ({ localDate, totals: null });

const fullWeek: WeekAverageDay[] = [
  monday,
  tuesday,
  wednesday,
  thursday,
  noEntries("2026-10-16"),
  noEntries("2026-10-17"),
  noEntries("2026-10-18"),
];

const THURSDAY = "2026-10-15";

describe("weekAverage", () => {
  describe("the days it counts", () => {
    it("should average Monday to yesterday and leave today out", () => {
      const result = weekAverage(fullWeek, THURSDAY);

      expect(result.kind).toBe("average");
      if (result.kind === "average") {
        expect(result.daysLogged).toBe(3);
        expect(result.totals.kcal).toBeCloseTo(1895.33, 2);
        expect(result.totals.protein_g).toBeCloseTo(139.33, 2);
        expect(result.totals.carbs_g).toBeCloseTo(191.33, 2);
        expect(result.totals.fat_g).toBeCloseTo(58.33, 2);
      }
    });

    it("should not move when today's entries change", () => {
      const heavierToday = { localDate: THURSDAY, totals: totals(9000, 900, 900, 900) };

      expect(weekAverage([monday, tuesday, wednesday, heavierToday], THURSDAY)).toEqual(
        weekAverage(fullWeek, THURSDAY),
      );
    });

    it("should leave out the days after today, even when they hold entries", () => {
      const logged = { localDate: "2026-10-16", totals: totals(5000, 1, 1, 1) };

      expect(weekAverage([monday, tuesday, wednesday, thursday, logged], THURSDAY)).toEqual(
        weekAverage(fullWeek, THURSDAY),
      );
    });

    it("should leave out a day before today with no entries, so a day not tracked does not pull it down", () => {
      const result = weekAverage([monday, noEntries("2026-10-13"), wednesday], THURSDAY);

      expect(result).toEqual({
        kind: "average",
        daysLogged: 2,
        totals: totals(1713, 134.5, 171.5, 50.5),
      });
    });

    it("should count Monday to Saturday on the Sunday", () => {
      const saturday = { localDate: "2026-10-17", totals: totals(1800, 100, 200, 60) };
      const sunday = { localDate: "2026-10-18", totals: totals(9000, 900, 900, 900) };
      const days = [
        monday,
        tuesday,
        wednesday,
        thursday,
        noEntries("2026-10-16"),
        saturday,
        sunday,
      ];

      const result = weekAverage(days, "2026-10-18");

      expect(result.kind).toBe("average");
      expect(result).toMatchObject({ daysLogged: 5 });
    });

    it.each(["2026-10-19", "2026-10-21"])(
      "should count all seven days of a past week when today is %s, a Monday or not",
      (today) => {
        const pastWeek = fullWeek.map((entry) => ({
          ...entry,
          totals: totals(1000, 100, 100, 50),
        }));

        expect(weekAverage(pastWeek, today)).toMatchObject({ kind: "average", daysLogged: 7 });
      },
    );
  });

  describe("the states without an average", () => {
    it("should start tomorrow on the Monday of the week, whether or not Monday is logged", () => {
      expect(weekAverage(fullWeek, "2026-10-12")).toEqual({ kind: "startsTomorrow" });
      expect(weekAverage([noEntries("2026-10-12"), ...fullWeek.slice(1)], "2026-10-12")).toEqual({
        kind: "startsTomorrow",
      });
    });

    it("should have nothing before today on a Tuesday with only today logged", () => {
      const days = fullWeek.map((entry) =>
        entry.localDate === "2026-10-13" ? entry : noEntries(entry.localDate),
      );

      expect(weekAverage(days, "2026-10-13")).toEqual({ kind: "nothingBeforeToday" });
    });

    it("should have nothing before today mid-week with nothing logged", () => {
      const days = fullWeek.map((entry) => noEntries(entry.localDate));

      expect(weekAverage(days, THURSDAY)).toEqual({ kind: "nothingBeforeToday" });
    });

    it("should have no entries for a past week with nothing logged", () => {
      const days = fullWeek.map((entry) => noEntries(entry.localDate));

      expect(weekAverage(days, "2026-10-19")).toEqual({ kind: "noEntries" });
    });

    it("should have no entries for a week still to come", () => {
      const days = fullWeek.map((entry) => noEntries(entry.localDate));

      expect(weekAverage(days, "2026-10-05")).toEqual({ kind: "noEntries" });
    });
  });

  describe("agreeing with the This week card and the weekly averages page", () => {
    const nutrientDay = (entry: WeekAverageDay) => ({
      localDate: entry.localDate,
      totals:
        entry.totals === null
          ? null
          : ({
              ...entry.totals,
              fibre_g: null,
              sat_fat_g: null,
              sugars_g: null,
              salt_g: null,
            } satisfies WeekNutrientDayTotals),
    });

    it.each([THURSDAY, "2026-10-13", "2026-10-18"])(
      "should give the same numbers on %s",
      (today) => {
        const result = weekAverage(fullWeek, today);
        const card = weekCaloriesBeforeToday(fullWeek, today, 2200);
        const page = weekNutrientAverages({
          days: fullWeek.map(nutrientDay),
          today,
          targets: { kcal: 2200, protein_g: null, carbs_g: null, fat_g: null },
        });
        const averageOf = (key: "kcal" | "protein_g" | "carbs_g" | "fat_g") =>
          page.nutrients.find((nutrient) => nutrient.key === key)?.dailyAverage;

        expect(result.kind).toBe("average");
        if (result.kind === "average") {
          expect(result.daysLogged).toBe(card.daysLogged);
          expect(result.totals.kcal).toBe(card.calories.averageKcal);
          expect(result.totals.protein_g).toBe(averageOf("protein_g"));
          expect(result.totals.carbs_g).toBe(averageOf("carbs_g"));
          expect(result.totals.fat_g).toBe(averageOf("fat_g"));
        }
      },
    );
  });
});
