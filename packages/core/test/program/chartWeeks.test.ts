import { describe, expect, it } from "vitest";

import { addCalendarDays } from "../../src/dates";
import { checkinStep, toDayInputs } from "../../src/engine";
import { expenditureChartWeeks } from "../../src/program";
import { expenditureMeasurementSchema } from "../../src/schemas";
import { goldenCheckinFixture } from "../../src/testing";

import type { ProgramSnapshot } from "../../src/program";

/*
 * One point for each Monday-start week, oldest first, at most 12 and ending in the current week. A week with
 * no snapshot carries the one before it only when that is a start snapshot (the settling weeks, Zee's answer
 * on KEY-623), and is a gap after a check-in. Every expected figure is a literal worked out on the canvas.
 */

const GOLDEN_DAY_ZERO = "2026-09-25";
const FRIDAY_23_OCTOBER = "2026-10-23";
const MONDAY_26_OCTOBER = "2026-10-26";
const WEDNESDAY_28_OCTOBER = "2026-10-28";

// The start belief of the golden person (ADR 0002): 2,500 with a standard deviation of 375.
const GOLDEN_START: ProgramSnapshot = {
  kind: "start",
  asOfDate: GOLDEN_DAY_ZERO,
  muKcal: 2500,
  varKcal2: 140625,
  measurement: null,
};

// The settling person of the canvas: 2,413.125 with a likely range of 1,950 to 2,880.
const SETTLING_START: ProgramSnapshot = {
  kind: "start",
  asOfDate: FRIDAY_23_OCTOBER,
  muKcal: 2413.125,
  varKcal2: 131044,
  measurement: null,
};

/** The golden person's three check-ins, each from the belief before it, as the database holds them. */
function goldenSnapshots(): ProgramSnapshot[] {
  const fixture = goldenCheckinFixture(GOLDEN_DAY_ZERO);
  const days = toDayInputs(fixture.dayTotals, fixture.dayLogs);
  let belief = fixture.prior;
  const checkins = [14, 21, 28].map((daysAfterDayZero): ProgramSnapshot => {
    const { snapshot } = checkinStep({
      asOfDate: addCalendarDays(GOLDEN_DAY_ZERO, daysAfterDayZero),
      prior: belief,
      weighIns: fixture.weighIns,
      days,
      program: fixture.program,
      bmrKcal: fixture.bmrKcal,
    });
    belief = { muKcal: snapshot.mu_kcal, varKcal2: snapshot.var_kcal2 };
    return {
      kind: "checkin",
      asOfDate: snapshot.as_of_date,
      muKcal: snapshot.mu_kcal,
      varKcal2: snapshot.var_kcal2,
      measurement: expenditureMeasurementSchema.parse(snapshot.measurement),
    };
  });
  return [GOLDEN_START, ...checkins];
}

// A check-in that could not measure keeps its estimate, which is all these tests need of one.
const UNMEASURED = expenditureMeasurementSchema.parse({
  eligible: false,
  reasons: ["span"],
  spanDays: 0,
  weighDays: 0,
  completeDays: 0,
});

const checkinOn = (asOfDate: string, muKcal = 2500): ProgramSnapshot => ({
  kind: "checkin",
  asOfDate,
  muKcal,
  varKcal2: 10000,
  measurement: UNMEASURED,
});

describe("expenditureChartWeeks", () => {
  describe("the golden fixture after its third check-in", () => {
    const weeks = expenditureChartWeeks(goldenSnapshots(), FRIDAY_23_OCTOBER);

    it("should give one week for each Monday from the start to the current week, oldest first", () => {
      expect(weeks.map((week) => week.week)).toEqual([
        "2026-09-21",
        "2026-09-28",
        "2026-10-05",
        "2026-10-12",
        "2026-10-19",
      ]);
    });

    it("should give 2,500 for the start week and carry it into the settling week", () => {
      expect(weeks[0]?.band).toEqual({ muKcal: 2500, lowKcal: 2020, highKcal: 2980 });
      expect(weeks[1]?.band).toEqual({ muKcal: 2500, lowKcal: 2020, highKcal: 2980 });
      expect(weeks[0]?.kind).toBe("start");
      expect(weeks[1]?.kind).toBe("start");
    });

    it("should give the mean and the likely range of each check-in week", () => {
      expect(weeks[2]?.band?.muKcal).toBeCloseTo(2559.56, 2);
      expect(weeks[2]?.band).toMatchObject({ lowKcal: 2290, highKcal: 2830 });
      expect(weeks[3]?.band?.muKcal).toBeCloseTo(2574.22, 2);
      expect(weeks[3]?.band).toMatchObject({ lowKcal: 2390, highKcal: 2760 });
      expect(weeks[4]?.band?.muKcal).toBeCloseTo(2579.54, 2);
      expect(weeks[4]?.band).toMatchObject({ lowKcal: 2430, highKcal: 2730 });
      expect(weeks.slice(2).map((week) => week.kind)).toEqual(["checkin", "checkin", "checkin"]);
    });
  });

  it("should end the golden fixture at 19 October when it is viewed on Monday 26 October, 5 weeks", () => {
    const weeks = expenditureChartWeeks(goldenSnapshots(), MONDAY_26_OCTOBER);

    expect(weeks.map((week) => week.week)).toEqual([
      "2026-09-21",
      "2026-09-28",
      "2026-10-05",
      "2026-10-12",
      "2026-10-19",
    ]);
  });

  it("should give nothing when there is no snapshot", () => {
    expect(expenditureChartWeeks([], WEDNESDAY_28_OCTOBER)).toEqual([]);
  });

  it("should carry a start snapshot into the current week, to 2,413 in both weeks", () => {
    const weeks = expenditureChartWeeks([SETTLING_START], WEDNESDAY_28_OCTOBER);

    expect(weeks.map((week) => week.week)).toEqual(["2026-10-19", "2026-10-26"]);
    expect(weeks[0]?.band).toEqual({ muKcal: 2413.125, lowKcal: 1950, highKcal: 2880 });
    expect(weeks[1]?.band).toEqual({ muKcal: 2413.125, lowKcal: 1950, highKcal: 2880 });
  });

  it("should give one week for a start snapshot taken this week", () => {
    const weeks = expenditureChartWeeks([SETTLING_START], "2026-10-24");

    expect(weeks).toHaveLength(1);
    expect(weeks[0]?.week).toBe("2026-10-19");
  });

  it("should end at the week of the newest snapshot when that is a check-in, not run on to the current week", () => {
    const weeks = expenditureChartWeeks([checkinOn(FRIDAY_23_OCTOBER)], WEDNESDAY_28_OCTOBER);

    expect(weeks).toEqual([
      {
        week: "2026-10-19",
        kind: "checkin",
        band: { muKcal: 2500, lowKcal: 2370, highKcal: 2630 },
      },
    ]);
  });

  it("should keep the gap open for every week after a check-in, and carry a later start snapshot again", () => {
    const weeks = expenditureChartWeeks(
      [checkinOn("2026-10-02"), { ...SETTLING_START, asOfDate: "2026-10-23", muKcal: 2300 }],
      "2026-11-04",
    );

    expect(weeks.map((week) => [week.week, week.kind, week.band?.muKcal ?? null])).toEqual([
      ["2026-09-28", "checkin", 2500],
      ["2026-10-05", null, null],
      ["2026-10-12", null, null],
      ["2026-10-19", "start", 2300],
      ["2026-10-26", "start", 2300],
      ["2026-11-02", "start", 2300],
    ]);
  });

  it("should take the newest snapshot of a week", () => {
    const weeks = expenditureChartWeeks(
      [{ ...SETTLING_START, asOfDate: "2026-10-19", muKcal: 2400 }, checkinOn("2026-10-23", 2450)],
      FRIDAY_23_OCTOBER,
    );

    expect(weeks).toHaveLength(1);
    expect(weeks[0]?.kind).toBe("checkin");
    expect(weeks[0]?.band?.muKcal).toBe(2450);
  });

  it("should treat Sunday as the last day of its week", () => {
    const weeks = expenditureChartWeeks(
      [{ ...SETTLING_START, asOfDate: "2026-10-25" }],
      "2026-10-26",
    );

    expect(weeks.map((week) => week.week)).toEqual(["2026-10-19", "2026-10-26"]);
  });

  it("should keep the newest 12 weeks of more than 12", () => {
    // Fourteen check-ins, one each Friday from 2 January 2026.
    const snapshots = Array.from({ length: 14 }, (_, index) =>
      checkinOn(addCalendarDays("2026-01-02", index * 7), 2000 + index),
    );

    const weeks = expenditureChartWeeks(snapshots, "2026-04-03");

    expect(weeks).toHaveLength(12);
    expect(weeks[0]?.week).toBe("2026-01-12");
    expect(weeks[0]?.band?.muKcal).toBe(2002);
    expect(weeks[11]?.week).toBe("2026-03-30");
    expect(weeks[11]?.band?.muKcal).toBe(2013);
  });

  it("should carry a start snapshot from before the 12 weeks into them", () => {
    const weeks = expenditureChartWeeks(
      [{ ...SETTLING_START, asOfDate: "2026-01-02" }],
      "2026-04-03",
    );

    expect(weeks).toHaveLength(12);
    expect(weeks.every((week) => week.kind === "start")).toBe(true);
  });
});
