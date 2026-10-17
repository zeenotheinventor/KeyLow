import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { incompleteDaysThisWeek } from "../../../src/diary/rules/incompleteDaysThisWeek";
import { weekAverage } from "../../../src/diary/rules/weekAverage";
import { weekOf } from "../../../src/diary/rules/weekStrip";
import { weekSummary } from "../../../src/diary/rules/weekSummary";

import type { WeekSummaryDay } from "../../../src/diary/rules/weekSummary";

const totalsOf = (kcal: number) => ({ kcal, protein_g: 100, carbs_g: 100, fat_g: 50 });

// The week of Monday 12 to Sunday 18 October 2026, as `getDiaryWeek` gives it.
const WEEK = weekOf("2026-10-12");

type DaySpec = { kcal?: number; complete?: boolean };

/** One week from a spec per day, Monday first. A day with no kcal has no totals, and one with no `complete` has no day log row. */
const weekOfDays = (specs: readonly DaySpec[]): WeekSummaryDay[] =>
  WEEK.map((localDate, index) => {
    const spec = specs[index] ?? {};

    return {
      localDate,
      dayLog: spec.complete === undefined ? null : { is_complete: spec.complete },
      totals: spec.kcal === undefined ? null : totalsOf(spec.kcal),
    };
  });

const THURSDAY = "2026-10-15";

// The M3 sample week: Mon 2,140 and Tue 2,260 complete, Wed 1,286, Thu 1,039 (today), Fri to Sun to come.
const sampleWeek = weekOfDays([
  { kcal: 2140, complete: true },
  { kcal: 2260, complete: true },
  { kcal: 1286, complete: false },
  { kcal: 1039 },
]);

describe("weekSummary", () => {
  describe("the M3 sample week", () => {
    const summary = weekSummary({ days: sampleWeek, today: THURSDAY, targetKcal: 2200 });

    it("should count the four days from Monday to today and two of them complete", () => {
      expect(summary.daysSoFar).toBe(4);
      expect(summary.daysComplete).toBe(2);
    });

    it("should count four days with food logged and average 1,681.25 kcal", () => {
      expect(summary.daysLogged).toBe(4);
      expect(summary.averageKcal).toBe(1681.25);
    });

    it("should fill the bar to 1,681.25 over 2,200 and not be over target", () => {
      expect(summary.targetKcal).toBe(2200);
      expect(summary.barFill).toBeCloseTo(0.7642, 4);
      expect(summary.kcalOverTarget).toBeNull();
    });

    it("should mark Monday and Tuesday complete, Wednesday open, Thursday today and the rest upcoming", () => {
      expect(summary.markers).toEqual([
        { localDate: "2026-10-12", state: "complete" },
        { localDate: "2026-10-13", state: "complete" },
        { localDate: "2026-10-14", state: "open" },
        { localDate: "2026-10-15", state: "today", isComplete: false },
        { localDate: "2026-10-16", state: "upcoming" },
        { localDate: "2026-10-17", state: "upcoming" },
        { localDate: "2026-10-18", state: "upcoming" },
      ]);
    });

    it("should name the week by its Monday", () => {
      expect(summary.weekStart).toBe("2026-10-12");
    });
  });

  describe("the over-target week", () => {
    const days = weekOfDays([
      { kcal: 2140, complete: true },
      { kcal: 2260, complete: true },
      { kcal: 2988, complete: false },
      { kcal: 2412 },
    ]);
    const summary = weekSummary({ days, today: THURSDAY, targetKcal: 2200 });

    it("should average 2,450 and be 250 over the target", () => {
      expect(summary.averageKcal).toBe(2450);
      expect(summary.kcalOverTarget).toBe(250);
    });

    it("should fill the bar to exactly 1", () => {
      expect(summary.barFill).toBe(1);
    });
  });

  describe("a week with nothing logged", () => {
    const summary = weekSummary({ days: weekOfDays([]), today: THURSDAY, targetKcal: 2200 });

    it("should have no average, no fill and no overage", () => {
      expect(summary.averageKcal).toBeNull();
      expect(summary.barFill).toBeNull();
      expect(summary.kcalOverTarget).toBeNull();
    });

    it("should count four days so far, none logged and none complete", () => {
      expect(summary.daysSoFar).toBe(4);
      expect(summary.daysLogged).toBe(0);
      expect(summary.daysComplete).toBe(0);
    });

    it("should mark the four days so far open, with today among them", () => {
      expect(summary.markers.map((marker) => marker.state)).toEqual([
        "open",
        "open",
        "open",
        "today",
        "upcoming",
        "upcoming",
        "upcoming",
      ]);
    });
  });

  it("should leave a day with no entries out of the average and still count it as a day so far", () => {
    const days = weekOfDays([{ kcal: 2000, complete: true }, {}, { kcal: 1000 }]);

    const summary = weekSummary({ days, today: "2026-10-14", targetKcal: 2200 });

    expect(summary.daysSoFar).toBe(3);
    expect(summary.daysLogged).toBe(2);
    expect(summary.averageKcal).toBe(1500);
  });

  describe("on a Monday", () => {
    it("should count one day so far and one complete when Monday is marked", () => {
      const days = weekOfDays([{ kcal: 1800, complete: true }]);

      const summary = weekSummary({ days, today: "2026-10-12", targetKcal: 2200 });

      expect(summary.daysSoFar).toBe(1);
      expect(summary.daysComplete).toBe(1);
      expect(summary.daysLogged).toBe(1);
      expect(summary.markers[0]).toEqual({
        localDate: "2026-10-12",
        state: "today",
        isComplete: true,
      });
    });
  });

  describe("on a Sunday", () => {
    it("should count all seven days so far and leave no upcoming marker", () => {
      const days = weekOfDays([
        { kcal: 2000, complete: true },
        { kcal: 2000, complete: true },
        { kcal: 2000, complete: true },
        { kcal: 2000 },
        { kcal: 2000 },
        { kcal: 2000, complete: true },
        { kcal: 2000 },
      ]);

      const summary = weekSummary({ days, today: "2026-10-18", targetKcal: 2200 });

      expect(summary.daysSoFar).toBe(7);
      expect(summary.daysComplete).toBe(4);
      expect(summary.markers.filter((marker) => marker.state === "upcoming")).toEqual([]);
    });
  });

  describe("with no target", () => {
    const summary = weekSummary({ days: sampleWeek, today: THURSDAY, targetKcal: null });

    it("should have no target, no fill and no overage but still the average", () => {
      expect(summary.targetKcal).toBeNull();
      expect(summary.barFill).toBeNull();
      expect(summary.kcalOverTarget).toBeNull();
      expect(summary.averageKcal).toBe(1681.25);
    });
  });

  describe("a day still to come", () => {
    const days = weekOfDays([
      { kcal: 2000, complete: true },
      {},
      {},
      { kcal: 1000 },
      { kcal: 5000, complete: true },
    ]);
    const summary = weekSummary({ days, today: THURSDAY, targetKcal: 2200 });

    it("should never be counted as complete, even when it is marked complete", () => {
      expect(summary.daysComplete).toBe(1);
      expect(summary.markers[4]).toEqual({ localDate: "2026-10-16", state: "upcoming" });
    });

    it("should never be counted in the average or the days logged, even with totals", () => {
      expect(summary.daysLogged).toBe(2);
      expect(summary.averageKcal).toBe(1500);
    });
  });

  describe("today marked complete", () => {
    it("should count today as complete and say so on its marker", () => {
      const days = weekOfDays([
        { kcal: 2000, complete: true },
        {},
        {},
        { kcal: 1900, complete: true },
      ]);

      const summary = weekSummary({ days, today: THURSDAY, targetKcal: 2200 });

      expect(summary.daysComplete).toBe(2);
      expect(summary.markers[3]).toEqual({
        localDate: THURSDAY,
        state: "today",
        isComplete: true,
      });
    });
  });

  describe("the average against the target", () => {
    const summaryFor = (kcal: number, targetKcal: number) =>
      weekSummary({ days: weekOfDays([{ kcal }]), today: "2026-10-12", targetKcal });

    it("should be over by the whole kilocalories the card shows", () => {
      expect(summaryFor(2200.4, 2200).kcalOverTarget).toBeNull();
      expect(summaryFor(2200.5, 2200).kcalOverTarget).toBe(1);
    });

    it("should not be over when the average equals the target", () => {
      const summary = summaryFor(2200, 2200);

      expect(summary.kcalOverTarget).toBeNull();
      expect(summary.barFill).toBe(1);
    });

    it("should read a target of zero as no target", () => {
      const summary = summaryFor(1800, 0);

      expect(summary.targetKcal).toBeNull();
      expect(summary.barFill).toBeNull();
    });
  });

  describe("a stale week, with today after the days given", () => {
    const summary = weekSummary({ days: sampleWeek, today: "2026-10-19", targetKcal: 2200 });

    it("should count every given day so far and its complete days, agreeing with the markers", () => {
      expect(summary.daysSoFar).toBe(7);
      expect(summary.daysComplete).toBe(2);
      expect(summary.daysComplete).toBeLessThanOrEqual(summary.daysSoFar);
      expect(summary.markers.filter((marker) => marker.state === "complete")).toHaveLength(
        summary.daysComplete,
      );
    });
  });

  describe("properties", () => {
    const dayArbitrary = fc.record({
      totals: fc.option(
        fc.double({ min: 0, max: 10_000, noNaN: true }).map((kcal) => totalsOf(kcal)),
        { nil: null },
      ),
      dayLog: fc.option(fc.record({ is_complete: fc.boolean() }), { nil: null }),
    });
    const weekArbitrary = fc.record({
      days: fc.array(dayArbitrary, { minLength: 7, maxLength: 7 }).map((generated) =>
        WEEK.map((localDate, index) => ({
          localDate,
          dayLog: generated[index]?.dayLog ?? null,
          totals: generated[index]?.totals ?? null,
        })),
      ),
      todayIndex: fc.integer({ min: 0, max: 6 }),
      targetKcal: fc.option(fc.integer({ min: 1, max: 6000 }), { nil: null }),
    });

    it("should never count more complete days than days so far", () => {
      fc.assert(
        fc.property(weekArbitrary, ({ days, todayIndex, targetKcal }) => {
          const summary = weekSummary({ days, today: WEEK[todayIndex] ?? "", targetKcal });

          expect(summary.daysComplete).toBeLessThanOrEqual(summary.daysSoFar);
          expect(summary.daysSoFar).toBe(todayIndex + 1);
        }),
      );
    });

    it("should count the days complete as the week strip does", () => {
      fc.assert(
        fc.property(weekArbitrary, ({ days, todayIndex, targetKcal }) => {
          const today = WEEK[todayIndex] ?? "";
          const rows = days.map((day) => ({
            local_date: day.localDate,
            is_complete: day.dayLog?.is_complete ?? false,
          }));
          const incomplete = incompleteDaysThisWeek(rows, new Date(`${today}T12:00:00Z`), "UTC");

          const summary = weekSummary({ days, today, targetKcal });

          expect(summary.daysSoFar - summary.daysComplete).toBe(incomplete);
        }),
      );
    });

    it("should keep the average between the smallest and largest logged day so far", () => {
      fc.assert(
        fc.property(weekArbitrary, ({ days, todayIndex, targetKcal }) => {
          const today = WEEK[todayIndex] ?? "";
          const logged = days.flatMap((day) =>
            day.localDate <= today && day.totals !== null ? [day.totals.kcal] : [],
          );

          const { averageKcal } = weekSummary({ days, today, targetKcal });

          if (logged.length === 0) {
            expect(averageKcal).toBeNull();
            return;
          }
          expect(averageKcal).toBeGreaterThanOrEqual(Math.min(...logged) - 1e-9);
          expect(averageKcal).toBeLessThanOrEqual(Math.max(...logged) + 1e-9);
        }),
      );
    });

    it("should have days logged exactly when there is an average", () => {
      fc.assert(
        fc.property(weekArbitrary, ({ days, todayIndex, targetKcal }) => {
          const summary = weekSummary({ days, today: WEEK[todayIndex] ?? "", targetKcal });

          expect(summary.daysLogged > 0).toBe(summary.averageKcal !== null);
        }),
      );
    });

    it("should give the average core weekAverage gives", () => {
      fc.assert(
        fc.property(weekArbitrary, ({ days, todayIndex, targetKcal }) => {
          const today = WEEK[todayIndex] ?? "";

          const summary = weekSummary({ days, today, targetKcal });

          expect(summary.averageKcal).toEqual(weekAverage(days, today)?.kcal ?? null);
        }),
      );
    });

    it("should keep the bar fill from 0 to 1 and report an overage only past the target", () => {
      fc.assert(
        fc.property(weekArbitrary, ({ days, todayIndex, targetKcal }) => {
          const summary = weekSummary({ days, today: WEEK[todayIndex] ?? "", targetKcal });

          if (summary.barFill !== null) {
            expect(summary.barFill).toBeGreaterThanOrEqual(0);
            expect(summary.barFill).toBeLessThanOrEqual(1);
          }
          if (summary.kcalOverTarget !== null) {
            expect(summary.kcalOverTarget).toBeGreaterThan(0);
            expect(summary.barFill).toBe(1);
          }
        }),
      );
    });

    it("should mark exactly the days after today as upcoming", () => {
      fc.assert(
        fc.property(weekArbitrary, ({ days, todayIndex, targetKcal }) => {
          const today = WEEK[todayIndex] ?? "";

          const { markers } = weekSummary({ days, today, targetKcal });

          expect(markers.map((marker) => marker.state === "upcoming")).toEqual(
            WEEK.map((localDate) => localDate > today),
          );
          expect(markers.filter((marker) => marker.state === "today")).toHaveLength(1);
        }),
      );
    });
  });
});
