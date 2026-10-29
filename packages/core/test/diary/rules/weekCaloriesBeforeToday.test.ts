import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  weekAverageBarOf,
  weekCaloriesBeforeToday,
} from "../../../src/diary/rules/weekCaloriesBeforeToday";
import { weekOf } from "../../../src/diary/rules/weekStrip";

import type { WeekCaloriesDay } from "../../../src/diary/rules/weekCaloriesBeforeToday";

// The week of Monday 12 to Sunday 18 October 2026, as `getDiaryWeek` gives it.
const WEEK = weekOf("2026-10-12");
const THURSDAY = "2026-10-15";

/** One week from a kcal per day, Monday first. Undefined is a day with nothing logged, null a day logged with no calories. */
const weekOfKcal = (kcal: readonly (number | null | undefined)[]): WeekCaloriesDay[] =>
  WEEK.map((localDate, index) => {
    const value = kcal[index];

    return { localDate, totals: value === undefined ? null : { kcal: value } };
  });

describe("weekCaloriesBeforeToday", () => {
  it("should average the days logged from Monday to yesterday and leave today out", () => {
    const result = weekCaloriesBeforeToday(weekOfKcal([2140, 2260, 1286, 1039]), THURSDAY, 2200);

    expect(result.isFirstDay).toBe(false);
    expect(result.daysLogged).toBe(3);
    expect(result.calories).toEqual(weekAverageBarOf(5686 / 3, 2200));
  });

  it("should leave out a day with nothing logged and a day after today", () => {
    const result = weekCaloriesBeforeToday(
      weekOfKcal([2000, undefined, 1000, 500, 9000]),
      THURSDAY,
      null,
    );

    expect(result.daysLogged).toBe(2);
    expect(result.calories.averageKcal).toBe(1500);
  });

  it("should count a logged day with no calories as 0", () => {
    const result = weekCaloriesBeforeToday(weekOfKcal([2000, null]), "2026-10-14", null);

    expect(result.daysLogged).toBe(2);
    expect(result.calories.averageKcal).toBe(1000);
  });

  it("should be the first day on a Monday, with nothing to average even when Monday has entries", () => {
    const result = weekCaloriesBeforeToday(weekOfKcal([1800]), "2026-10-12", 2200);

    expect(result).toEqual({
      isFirstDay: true,
      daysLogged: 0,
      calories: { averageKcal: null, targetKcal: 2200, barFill: null, kcalOverTarget: null },
    });
  });

  it("should have nothing to average from Tuesday on when only today is logged", () => {
    const result = weekCaloriesBeforeToday(weekOfKcal([undefined, 1900]), "2026-10-13", 2200);

    expect(result.isFirstDay).toBe(false);
    expect(result.daysLogged).toBe(0);
    expect(result.calories.averageKcal).toBeNull();
  });

  it("should have an average exactly when a day before today is logged", () => {
    const kcal = fc.option(
      fc.option(fc.double({ min: 0, max: 10_000, noNaN: true }), { nil: null }),
      {
        nil: undefined,
      },
    );

    fc.assert(
      fc.property(
        fc.array(kcal, { minLength: 7, maxLength: 7 }),
        fc.constantFrom(...WEEK),
        (values, today) => {
          const { daysLogged, calories } = weekCaloriesBeforeToday(weekOfKcal(values), today, 2200);

          expect(daysLogged > 0).toBe(calories.averageKcal !== null);
        },
      ),
    );
  });

  describe("weekAverageBarOf, which the card and the weekly averages page share", () => {
    it("should fill the bar to the average over the target", () => {
      expect(weekAverageBarOf(1681.25, 2200)).toEqual({
        averageKcal: 1681.25,
        targetKcal: 2200,
        barFill: 1681.25 / 2200,
        kcalOverTarget: null,
      });
    });

    it("should be full and over by the whole kilocalories past the target", () => {
      expect(weekAverageBarOf(2450, 2200)).toEqual({
        averageKcal: 2450,
        targetKcal: 2200,
        barFill: 1,
        kcalOverTarget: 250,
      });
    });

    it("should have no fill and no overage with no average", () => {
      expect(weekAverageBarOf(null, 2200)).toEqual({
        averageKcal: null,
        targetKcal: 2200,
        barFill: null,
        kcalOverTarget: null,
      });
    });

    it("should read a target that is not above 0 as no target", () => {
      expect(weekAverageBarOf(1800, 0)).toMatchObject({ targetKcal: null, barFill: null });
    });
  });
});
