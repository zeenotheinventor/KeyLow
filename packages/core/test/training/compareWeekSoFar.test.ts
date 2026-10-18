import { describe, expect, it } from "vitest";

import {
  GOLDEN_TIME_ZONE,
  comparison as wholeWeekComparison,
  params,
  recordOfMuscles,
  week as goldenProjection,
} from "./goldenWeekInputs";
import {
  LONDON,
  legs,
  loggedSets,
  pull,
  push,
  PREVIOUS_WEEK,
  session,
  squat,
  squatMuscles,
  WEEK,
} from "./plans";
import { compareWeek, compareWeekSoFar, MUSCLE_IDS, projectWeek } from "../../src/training";
import goldenWeek from "../fixtures/training/goldenWeek.json";

import type { LoggedWeek, MuscleId, PlanRoutine, PlanRoutineDay } from "../../src/training";

/*
 * The golden week of KEY-353 (Monday 12 to Sunday 18 October 2026, Europe/London) read as a gap so far,
 * under question G of KEY-339: before Sunday only the planned days up to yesterday count, and today
 * counts once it is logged. The agreed actual sets are the fixture's, and every other number is worked
 * by hand from the plans below.
 */

const THURSDAY_19_00 = "2026-10-15T19:00:00+01:00";
const SATURDAY_23_59 = "2026-10-17T23:59:00+01:00";
const SUNDAY_00_00 = "2026-10-18T00:00:00+01:00";
const SUNDAY_20_00 = "2026-10-18T20:00:00+01:00";

const agreedWeek = goldenWeek.expected.planWeek.muscles;

const PUSH_MUSCLES: MuscleId[] = [
  "chest_upper",
  "chest_lower",
  "delt_front",
  "delt_side",
  "triceps",
];

const noneLogged: LoggedWeek = { sessions: [], sets: [] };

const thursdayLegs: PlanRoutineDay = { ...legs, weekday: 3 };
const sundayPush: PlanRoutineDay = { ...push, weekday: 6 };

describe("compareWeekSoFar", () => {
  describe("the golden week at Thursday 19:00, with Legs in progress", () => {
    const soFar = compareWeekSoFar(goldenProjection, THURSDAY_19_00, GOLDEN_TIME_ZONE, params);

    it("should read every muscle on plan, the logged Legs day in place of its planned day", () => {
      expect(soFar).toStrictEqual(
        recordOfMuscles((muscle) => ({
          actualWeeklySets: agreedWeek[muscle].actualWeeklySets,
          projectedWeeklySets: agreedWeek[muscle].actualWeeklySets,
          gap: 0,
          status: "on_plan",
        })),
      );
    });

    it("should read the five push muscles on plan where compareWeek reads them behind", () => {
      for (const muscle of PUSH_MUSCLES) {
        expect(wholeWeekComparison[muscle].status).toBe("behind");
        expect(soFar[muscle].status).toBe("on_plan");
      }
    });

    it("should keep Tuesday's extra lat pulldown sets on plan", () => {
      expect(soFar.lats).toStrictEqual({
        actualWeeklySets: 11,
        projectedWeeklySets: 11,
        gap: 0,
        status: "on_plan",
      });
    });
  });

  describe("the golden week at Sunday 20:00", () => {
    const soFar = compareWeekSoFar(goldenProjection, SUNDAY_20_00, GOLDEN_TIME_ZONE, params);

    it("should equal compareWeek for every muscle", () => {
      expect(soFar).toStrictEqual(wholeWeekComparison);
    });

    it("should be the agreed gap, Saturday's missed Push", () => {
      const behindGaps: Partial<Record<MuscleId, number>> = {
        triceps: -7.5,
        delt_front: -6,
        delt_side: -5.5,
        chest_upper: -4.8,
        chest_lower: -4.5,
      };
      for (const muscle of MUSCLE_IDS) {
        const expectedGap = behindGaps[muscle] ?? 0;
        expect(soFar[muscle].gap).toBeCloseTo(expectedGap, 2);
        expect(soFar[muscle].status).toBe(expectedGap === 0 ? "on_plan" : "behind");
      }
    });
  });

  it("should not count Saturday's Push at Saturday 23:59 and count it from Sunday 00:00", () => {
    const saturday = compareWeekSoFar(goldenProjection, SATURDAY_23_59, GOLDEN_TIME_ZONE, params);
    const sunday = compareWeekSoFar(goldenProjection, SUNDAY_00_00, GOLDEN_TIME_ZONE, params);

    expect(saturday.triceps).toMatchObject({ gap: 0, status: "on_plan" });
    expect(sunday).toStrictEqual(wholeWeekComparison);
  });

  describe("a planned Thursday with no session", () => {
    const routine: PlanRoutine = { days: [push, thursdayLegs, pull] };
    const projection = projectWeek(routine, WEEK, LONDON, noneLogged, params);

    it("should not be counted at Thursday 23:59, while Monday's missed Push is", () => {
      const soFar = compareWeekSoFar(projection, "2026-10-22T23:59:00+01:00", LONDON, params);

      expect(soFar.quads).toStrictEqual({
        actualWeeklySets: 0,
        projectedWeeklySets: 0,
        gap: 0,
        status: "on_plan",
      });
      expect(soFar.chest_lower).toStrictEqual({
        actualWeeklySets: 0,
        projectedWeeklySets: 3,
        gap: -3,
        status: "behind",
      });
    });

    it("should be counted as missed at Friday 00:00, while Friday's Pull is not yet", () => {
      const soFar = compareWeekSoFar(projection, "2026-10-23T00:00:00+01:00", LONDON, params);

      expect(soFar.quads).toStrictEqual({
        actualWeeklySets: 0,
        projectedWeeklySets: 4,
        gap: -4,
        status: "behind",
      });
      expect(soFar.glute_max).toMatchObject({ projectedWeeklySets: 2, gap: -2 });
      expect(soFar.lats).toMatchObject({ projectedWeeklySets: 0, gap: 0, status: "on_plan" });
    });

    it("should count a Thursday that is logged, in part, at Thursday 19:00 as on plan", () => {
      const thursday = session(1, "2026-10-22", thursdayLegs.id);
      const logged: LoggedWeek = {
        sessions: [thursday],
        sets: loggedSets(thursday, squat, squatMuscles, 2, "2026-10-22T18:30:00+01:00"),
      };
      const withThursday = projectWeek(routine, WEEK, LONDON, logged, params);

      const soFar = compareWeekSoFar(withThursday, "2026-10-22T19:00:00+01:00", LONDON, params);

      expect(soFar.quads).toStrictEqual({
        actualWeeklySets: 2,
        projectedWeeklySets: 2,
        gap: 0,
        status: "on_plan",
      });
    });
  });

  describe("the user's own day", () => {
    const sundayRoutine: PlanRoutine = { days: [sundayPush] };
    const missedPush = {
      actualWeeklySets: 0,
      projectedWeeklySets: 3,
      gap: -3,
      status: "behind",
    };
    const nothingDue = {
      actualWeeklySets: 0,
      projectedWeeklySets: 0,
      gap: 0,
      status: "on_plan",
    };

    it("should count Sunday's plan in London and not in Los Angeles at 2026-10-18T23:30:00Z", () => {
      const at = "2026-10-18T23:30:00Z";
      const london = projectWeek(sundayRoutine, PREVIOUS_WEEK, LONDON, noneLogged, params);
      const losAngeles = projectWeek(
        sundayRoutine,
        PREVIOUS_WEEK,
        "America/Los_Angeles",
        noneLogged,
        params,
      );

      expect(compareWeekSoFar(london, at, LONDON, params).chest_lower).toStrictEqual(missedPush);
      expect(
        compareWeekSoFar(losAngeles, at, "America/Los_Angeles", params).chest_lower,
      ).toStrictEqual(nothingDue);
    });

    it("should keep Sunday 25 October, the day the clocks go back, as one day until Monday 00:00 London", () => {
      const projection = projectWeek(sundayRoutine, WEEK, LONDON, noneLogged, params);

      // 23:30 UTC is 23:30 in London once the clocks have gone back, still Sunday.
      expect(
        compareWeekSoFar(projection, "2026-10-25T23:30:00Z", LONDON, params).chest_lower,
      ).toStrictEqual(nothingDue);
      expect(
        compareWeekSoFar(projection, "2026-10-26T00:00:00Z", LONDON, params).chest_lower,
      ).toStrictEqual(missedPush);
    });
  });

  it("should keep the actual sets of compareWeek and plan fewer sets than it before Sunday", () => {
    const soFar = compareWeekSoFar(goldenProjection, THURSDAY_19_00, GOLDEN_TIME_ZONE, params);
    const whole = compareWeek(goldenProjection.actual, goldenProjection.projected, params);

    expect(soFar.triceps.actualWeeklySets).toBe(whole.triceps.actualWeeklySets);
    expect(soFar.triceps.projectedWeeklySets).toBeLessThan(whole.triceps.projectedWeeklySets);
  });

  it("should refuse a time zone that is not an IANA name", () => {
    expect(() => compareWeekSoFar(goldenProjection, SUNDAY_20_00, "Not/AZone", params)).toThrow(
      new RangeError("A week's time zone must be an IANA zone name"),
    );
  });

  it("should refuse a moment with no zone", () => {
    expect(() =>
      compareWeekSoFar(goldenProjection, "2026-10-18T20:00:00", GOLDEN_TIME_ZONE, params),
    ).toThrow(new RangeError("The moment to compute at must be an ISO timestamp with a zone"));
  });
});
