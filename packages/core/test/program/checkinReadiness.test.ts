import { describe, expect, it } from "vitest";

import { computeTrend, measureExpenditure } from "../../src/engine";
import {
  acceptedWeighInDates,
  checkinWindow,
  checkinWindowWeeks,
  completeDayDates,
  firstCheckinReadiness,
} from "../../src/program";

import type { DayInput, TrendInput } from "../../src/engine";

/*
 * What the first check-in needs, counted the way the measurement counts it (ADR 0002, Amendment 2, "The
 * measurement"): the window is the 28 days before the check-in day, the check-in day itself excluded.
 * The canvas case is the setup canvas's sample man: set up on Friday 23 October, first check-in on
 * Friday 6 November, and today is Wednesday 28 October.
 */

const FIRST_CHECKIN = "2026-11-06";
const TODAY = "2026-10-28";

const CANVAS_WEIGH_INS = ["2026-10-23", "2026-10-25", "2026-10-27", "2026-10-28"];
const CANVAS_COMPLETE_DAYS = ["2026-10-23", "2026-10-24", "2026-10-26", "2026-10-27"];

function readinessOf(
  weighInDates: readonly string[],
  completeDates: readonly string[] = [],
  today: string = TODAY,
) {
  return firstCheckinReadiness({ asOfDate: FIRST_CHECKIN, today, weighInDates, completeDates });
}

describe("checkinWindow", () => {
  it("should run from 28 days before the check-in to the day before it", () => {
    expect(checkinWindow(FIRST_CHECKIN)).toEqual({
      startDate: "2026-10-09",
      endDate: "2026-11-05",
    });
  });
});

describe("checkinWindowWeeks", () => {
  it("should name five Mondays when the window starts on a Friday, 5 October to 2 November", () => {
    expect(checkinWindowWeeks(FIRST_CHECKIN)).toEqual({
      weekStarts: ["2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02"],
      touchesFifthWeek: true,
    });
  });

  it("should touch only four weeks when the window starts on a Monday and ends on a Sunday", () => {
    expect(checkinWindowWeeks("2026-11-09")).toEqual({
      weekStarts: ["2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09"],
      touchesFifthWeek: false,
    });
  });

  it("should touch the fifth week when the window ends on its Monday", () => {
    expect(checkinWindowWeeks("2026-11-03").touchesFifthWeek).toBe(true);
  });
});

describe("completeDayDates", () => {
  const day = (localDate: string, intakeKcal: number | null, isComplete: boolean): DayInput => ({
    localDate,
    intakeKcal,
    isComplete,
  });

  it("should be the days marked complete that have an intake", () => {
    expect(
      completeDayDates([day("2026-10-23", 2100, true), day("2026-10-24", 1900, true)]),
    ).toEqual(["2026-10-23", "2026-10-24"]);
  });

  it("should leave out a day marked complete with nothing logged", () => {
    expect(completeDayDates([day("2026-10-23", null, true)])).toEqual([]);
  });

  it("should leave out a day with an intake that is not marked complete", () => {
    expect(completeDayDates([day("2026-10-23", 2100, false)])).toEqual([]);
  });

  it("should give the complete days the measurement counts, 2 of the 4 days", () => {
    const days = [
      day("2026-10-23", 2100, true),
      day("2026-10-24", null, true),
      day("2026-10-25", 2000, false),
      day("2026-10-26", 1800, true),
    ];
    const measurement = measureExpenditure({ asOfDate: "2026-10-30", trend: [], days });

    expect(measurement.completeDays).toBe(2);
    expect(completeDayDates(days)).toHaveLength(2);
  });
});

describe("firstCheckinReadiness", () => {
  describe("the canvas case, as of 6 November on 28 October", () => {
    const readiness = readinessOf(CANVAS_WEIGH_INS, CANVAS_COMPLETE_DAYS);

    it("should count 4 days with a weigh-in", () => {
      expect(readiness.weighDays).toBe(4);
    });

    it("should count the weigh-ins as covering 6 days, 23 to 28 October", () => {
      expect(readiness.coverDays).toBe(6);
    });

    it("should count 4 complete days", () => {
      expect(readiness.completeDays).toBe(4);
    });

    it("should say to weigh in on 5 November, the 14th day of the cover", () => {
      expect(readiness.tipDate).toBe("2026-11-05");
    });
  });

  describe("its targets", () => {
    it("should need weigh-ins on 8 days", () => {
      expect(readinessOf([]).targets.weighDays).toBe(8);
    });

    it("should need the weigh-ins to cover 14 days", () => {
      expect(readinessOf([]).targets.coverDays).toBe(14);
    });

    it("should need 10 complete days", () => {
      expect(readinessOf([]).targets.completeDays).toBe(10);
    });
  });

  describe("the window", () => {
    it("should count a day on the first day of the window, 9 October", () => {
      const readiness = readinessOf(["2026-10-09"], ["2026-10-09"]);

      expect(readiness.weighDays).toBe(1);
      expect(readiness.completeDays).toBe(1);
    });

    it("should not count a day before the window, 8 October", () => {
      const readiness = readinessOf(["2026-10-08"], ["2026-10-08"]);

      expect(readiness.weighDays).toBe(0);
      expect(readiness.completeDays).toBe(0);
    });

    it("should count a day on the last day of the window, 5 November", () => {
      const readiness = readinessOf(["2026-11-05"], ["2026-11-05"], "2026-11-05");

      expect(readiness.weighDays).toBe(1);
      expect(readiness.completeDays).toBe(1);
    });

    it("should not count the check-in day itself, 6 November", () => {
      const readiness = readinessOf(["2026-11-06"], ["2026-11-06"], "2026-11-06");

      expect(readiness.weighDays).toBe(0);
      expect(readiness.completeDays).toBe(0);
    });

    it("should count readings from before the programme was set up", () => {
      const readiness = readinessOf(["2026-10-12", "2026-10-23"], []);

      expect(readiness.weighDays).toBe(2);
    });
  });

  describe("the counts", () => {
    it("should count a day once, however many times it is given, and in any order", () => {
      const readiness = readinessOf(
        ["2026-10-27", "2026-10-23", "2026-10-27"],
        ["2026-10-26", "2026-10-24", "2026-10-26"],
      );

      expect(readiness.weighDays).toBe(2);
      expect(readiness.completeDays).toBe(2);
      expect(readiness.coverDays).toBe(5);
    });

    it("should count nothing, and cover nothing, with no weigh-ins", () => {
      expect(readinessOf([])).toMatchObject({ weighDays: 0, coverDays: 0, completeDays: 0 });
    });

    it("should cover 1 day with one weigh-in", () => {
      expect(readinessOf(["2026-10-23"]).coverDays).toBe(1);
    });

    it("should cover both ends, 14 days from 10 to 23 October", () => {
      expect(readinessOf(["2026-10-10", "2026-10-23"]).coverDays).toBe(14);
    });
  });

  describe("the tip date", () => {
    it("should be null once the weigh-ins cover 14 days", () => {
      expect(readinessOf(["2026-10-10", "2026-10-23"]).tipDate).toBeNull();
    });

    it("should be null when the weigh-ins cover exactly 14 days, though the date that would have completed them is today", () => {
      expect(readinessOf(["2026-10-15", "2026-10-28"], [], "2026-10-28").tipDate).toBeNull();
    });

    it("should be null with no weigh-in to count from", () => {
      expect(readinessOf([]).tipDate).toBeNull();
    });

    it("should be an earlier date when the first weigh-in in the window is older", () => {
      const readiness = readinessOf(["2026-10-20", "2026-10-25", "2026-10-28"]);

      expect(readiness.tipDate).toBe("2026-11-02");
    });

    it("should be today when today is the date that completes the cover", () => {
      const readiness = readinessOf(["2026-10-15", "2026-10-20"], [], "2026-10-28");

      expect(readiness.tipDate).toBe("2026-10-28");
    });

    it("should be null when the date that completes the cover has gone by", () => {
      const readiness = readinessOf(["2026-10-10", "2026-10-20"], [], "2026-10-28");

      expect(readiness.tipDate).toBeNull();
    });

    it("should be null when the date that completes the cover is after the window ends", () => {
      const readiness = readinessOf(["2026-10-24", "2026-10-28"], [], "2026-10-28");

      expect(readiness.tipDate).toBeNull();
    });

    it("should still be the last day of the window, 5 November, when the first weigh-in is 23 October", () => {
      expect(readinessOf(["2026-10-23"], [], "2026-11-05").tipDate).toBe("2026-11-05");
    });
  });
});

/** Readings on consecutive dates from 2026-10-10, with null for a day nobody weighed. */
function week(weights: readonly (number | null)[]): TrendInput[] {
  return weights.flatMap((weightKg, index) =>
    weightKg === null
      ? []
      : [{ localDate: `2026-10-${String(10 + index).padStart(2, "0")}`, weightKg }],
  );
}

const FIVE_STEADY = [80, 80, 80, 80, 80];

describe("acceptedWeighInDates", () => {
  it("should be the days with a reading, and not the days the trend filled in between them", () => {
    const trend = computeTrend(CANVAS_WEIGH_INS.map((localDate) => ({ localDate, weightKg: 80 })));

    expect(trend.map((point) => point.date)).toHaveLength(6);
    expect(acceptedWeighInDates(trend)).toEqual(CANVAS_WEIGH_INS);
  });

  it("should leave out a reading the trend rejected as a spike", () => {
    const trend = computeTrend(week([...FIVE_STEADY, 95, 80.3]));

    expect(acceptedWeighInDates(trend)).toEqual([
      "2026-10-10",
      "2026-10-11",
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-16",
    ]);
  });

  it("should count a reading the trend clamped but accepted", () => {
    const trend = computeTrend(week([...FIVE_STEADY, 84]));

    expect(trend[5]).toMatchObject({ winsorised: true, rejected: false });
    expect(acceptedWeighInDates(trend)).toContain("2026-10-15");
  });

  it("should give the weigh-in days the measurement counts, 6 of the 7 readings", () => {
    const trend = computeTrend(week([...FIVE_STEADY, 95, 80.3]));
    const measurement = measureExpenditure({ asOfDate: "2026-10-30", trend, days: [] });
    const readiness = firstCheckinReadiness({
      asOfDate: "2026-10-30",
      today: "2026-10-20",
      weighInDates: acceptedWeighInDates(trend),
      completeDates: [],
    });

    expect(measurement.weighDays).toBe(6);
    expect(readiness.weighDays).toBe(6);
    expect(readiness.coverDays).toBe(measurement.spanDays);
  });
});
