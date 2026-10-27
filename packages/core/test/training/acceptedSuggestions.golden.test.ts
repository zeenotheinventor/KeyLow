import { describe, expect, it } from "vitest";

import {
  GOLDEN_TIME_ZONE,
  GOLDEN_WEEK_START,
  loggedSets,
  params,
  routine,
} from "./goldenWeekInputs";
import {
  GOLDEN_LIBRARY,
  idOf,
  V_TAPER_GOALS,
  WEDNESDAY_NOON,
  WEDNESDAY_STATE,
} from "./suggestGolden";
import { acceptedSuggestionSchema } from "../../src/schemas";
import {
  compareWeek,
  compareWeekSoFar,
  MUSCLE_IDS,
  muscleState,
  parseAcceptedSuggestion,
  projectedState,
  projectWeek,
  suggestSession,
  SUGGEST_PARAMS_V2,
  toAcceptedExercises,
} from "../../src/training";
import goldenWeek from "../fixtures/training/goldenWeek.json";

import type {
  AcceptedSuggestion,
  LoggedSession,
  LoggedSet,
  MuscleId,
  PlannedSet,
} from "../../src/training";

/*
 * The golden accepted suggestion of Zee's agreement on KEY-396 (Part 4, case (a)): on Wednesday 14 October
 * 2026 at 12:00 the V-taper user accepts 3 sets of incline dumbbell press, 8 to 10 reps at RIR 2, into
 * Thursday's Legs. It is not the side lateral raise the ticket first named: upper chest scores 18.79 and
 * side delts 11.85, and the raises do not fit the 60 minutes. KEY-402's numbers are worked by hand from
 * the golden library, never computed from the code under test.
 *
 * The press works upper chest at 1.0 (primary) and lower chest, front delts and triceps at 0.5. At RIR 2
 * every set is full effort, so 3 sets add 3.00 to upper chest and 3 x 0.5 = 1.50 to each of the other
 * three, and nothing to side delts. The document's totals after the pick agree: upper chest 4.80 + 3.00 =
 * 7.80, lower chest 4.50 + 1.50 = 6.00, front delts 6.00 + 1.50 = 7.50 and triceps 7.50 + 1.50 = 9.00
 * (its "sets after pick 1"). Monday and Tuesday are logged, Thursday's Legs and Saturday's Push are
 * planned, and Saturday's Push is Monday's again, so each of its sets doubles the logged week.
 */

const THURSDAY = "2026-10-15";
const FRIDAY_NOON = "2026-10-16T12:00:00+01:00";
const SUNDAY_EVENING = "2026-10-18T20:00:00+01:00";

const legsDay = (() => {
  const day = routine.days.find((each) => each.weekday === 3);
  if (day === undefined) {
    throw new Error("The golden routine has a Thursday");
  }
  return day;
})();

const suggestion = suggestSession(
  WEDNESDAY_STATE,
  V_TAPER_GOALS,
  GOLDEN_LIBRARY,
  { plannedDay: legsDay },
  SUGGEST_PARAMS_V2,
);

const accepted: AcceptedSuggestion = {
  local_date: THURSDAY,
  routine_day_id: legsDay.id,
  exercises: toAcceptedExercises(suggestion, GOLDEN_LIBRARY),
};

const allSessions: LoggedSession[] = goldenWeek.sessions.map((each) => ({
  id: each.id,
  local_date: each.localDate,
  routine_day_id: each.routineDayId,
  deleted_at: null,
}));
const beforeThursday = allSessions.filter((each) => each.local_date < THURSDAY);
const setsOf = (sessions: readonly LoggedSession[]): LoggedSet[] =>
  loggedSets.filter((set) => sessions.some((each) => each.id === set.session_id));

const project = (
  sessions: readonly LoggedSession[],
  sets: readonly LoggedSet[],
  acceptedSuggestions: readonly AcceptedSuggestion[],
) =>
  projectWeek(
    routine,
    GOLDEN_WEEK_START,
    GOLDEN_TIME_ZONE,
    { sessions, sets, acceptedSuggestions },
    params,
  );

const wednesdayWeek = project(beforeThursday, setsOf(beforeThursday), [accepted]);
const wednesdayWeekWithout = project(beforeThursday, setsOf(beforeThursday), []);

const weeklySetsOf = (week: ReturnType<typeof project>, muscle: MuscleId): number =>
  compareWeek(week.actual, week.projected, params)[muscle].projectedWeeklySets;

const TWO_DECIMAL_PLACES = 2;

describe("the golden accepted suggestion", () => {
  describe("the suggestion", () => {
    it("should be 3 sets of incline dumbbell press added to Thursday's Legs, as the agreement says", () => {
      expect(accepted.exercises).toHaveLength(1);
      expect(accepted.exercises[0]).toMatchObject({
        exercise_id: idOf("Incline Dumbbell Press"),
        target_sets: 3,
        target_rir: 2,
      });
      expect(accepted.exercises.map((each) => each.exercise.name)).not.toContain(
        "Side Lateral Raise",
      );
    });

    it("should survive being stored and read back, and feed the projection", () => {
      const reasons = {
        picks:
          suggestion.kind === "plan_adjusted"
            ? suggestion.exercises.flatMap((each) =>
                each.origin === "added"
                  ? [
                      {
                        exercise_id: each.exercise_id,
                        reasons: each.reasons.map((r) => ({ ...r })),
                      },
                    ]
                  : [],
              )
            : [],
      };
      const stored = { ...accepted, reasons, params_version: "keylow-training-v2" };
      const parsed = parseAcceptedSuggestion({
        id: "00000009-0000-4000-8000-000000000001",
        ...stored,
      });

      expect(acceptedSuggestionSchema.parse(JSON.parse(JSON.stringify(stored)))).toStrictEqual(
        stored,
      );
      expect(parsed.ok ? parsed.suggestion.reasons.picks[0]?.reasons[0] : null).toMatchObject({
        muscle_id: "chest_upper",
        priority: 3,
        mav_low: 10,
      });
      if (parsed.ok) {
        expect(
          project(beforeThursday, setsOf(beforeThursday), [parsed.suggestion]).planned,
        ).toEqual(wednesdayWeek.planned);
      }
    });
  });

  describe("on Wednesday 14 October, before Thursday is done", () => {
    it("should plan its 3 sets on Thursday at 18:00 BST, which is 17:00 UTC, in Legs", () => {
      const added = wednesdayWeek.planned.filter(
        (set): set is PlannedSet =>
          set.exercise_id === idOf("Incline Dumbbell Press") && set.local_date === THURSDAY,
      );

      expect(added.map((set) => [set.routine_day_id, set.performed_at, set.rir])).toEqual([
        [legsDay.id, "2026-10-15T17:00:00.000Z", 2],
        [legsDay.id, "2026-10-15T17:00:00.000Z", 2],
        [legsDay.id, "2026-10-15T17:00:00.000Z", 2],
      ]);
      expect(wednesdayWeek.planned).toHaveLength(wednesdayWeekWithout.planned.length + 3);
      expect(wednesdayWeek.actual).toEqual(wednesdayWeekWithout.actual);
    });

    it.each<[MuscleId, number, number]>([
      // Monday's logged week plus Saturday's planned Push, then what the press adds.
      ["chest_upper", 9.6, 12.6],
      ["chest_lower", 9.0, 10.5],
      ["delt_front", 12.0, 13.5],
      ["triceps", 15.0, 16.5],
      ["delt_side", 11.0, 11.0],
    ])("should take the week's projected %s sets from %f to %f", (muscle, before, after) => {
      expect(weeklySetsOf(wednesdayWeekWithout, muscle)).toBeCloseTo(before, TWO_DECIMAL_PLACES);
      expect(weeklySetsOf(wednesdayWeek, muscle)).toBeCloseTo(after, TWO_DECIMAL_PLACES);
    });

    it("should change no other muscle's projected sets", () => {
      const changed = MUSCLE_IDS.filter(
        (muscle) =>
          Math.abs(
            weeklySetsOf(wednesdayWeek, muscle) - weeklySetsOf(wednesdayWeekWithout, muscle),
          ) > 1e-9,
      );

      expect([...changed].sort()).toStrictEqual([
        "chest_lower",
        "chest_upper",
        "delt_front",
        "triceps",
      ]);
    });

    it("should not count it in Wednesday's projected heat: planned sets count from the day after", () => {
      expect(
        projectedState(wednesdayWeek.projected, WEDNESDAY_NOON, GOLDEN_TIME_ZONE, params),
      ).toEqual(
        projectedState(wednesdayWeekWithout.projected, WEDNESDAY_NOON, GOLDEN_TIME_ZONE, params),
      );
    });

    it("should count it in Friday's projected heat, and in the sets of the rolling week", () => {
      const withPress = projectedState(
        wednesdayWeek.projected,
        FRIDAY_NOON,
        GOLDEN_TIME_ZONE,
        params,
      );
      const without = projectedState(
        wednesdayWeekWithout.projected,
        FRIDAY_NOON,
        GOLDEN_TIME_ZONE,
        params,
      );
      const bySets = new Set<MuscleId>(["chest_upper", "chest_lower", "delt_front", "triceps"]);

      for (const muscle of MUSCLE_IDS) {
        if (bySets.has(muscle)) {
          expect(withPress[muscle].heat).toBeGreaterThan(without[muscle].heat);
        } else {
          expect(withPress[muscle]).toEqual(without[muscle]);
        }
      }
      expect(withPress.chest_upper.weeklySets - without.chest_upper.weeklySets).toBeCloseTo(
        3,
        TWO_DECIMAL_PLACES,
      );
    });

    it("should give Friday's heat the three press sets as if they had been logged at 18:00 on Thursday", () => {
      const press = wednesdayWeek.planned.filter(
        (set) => set.exercise_id === idOf("Incline Dumbbell Press") && set.local_date === THURSDAY,
      );
      const counted = wednesdayWeekWithout.projected.filter(
        (set) => !("planned" in set) || set.local_date < "2026-10-16",
      );

      expect(
        projectedState(wednesdayWeek.projected, FRIDAY_NOON, GOLDEN_TIME_ZONE, params),
      ).toEqual(muscleState([...counted, ...press], FRIDAY_NOON, params.training));
    });

    it("should leave the gap alone until Thursday is over", () => {
      expect(compareWeekSoFar(wednesdayWeek, WEDNESDAY_NOON, GOLDEN_TIME_ZONE, params)).toEqual(
        compareWeekSoFar(wednesdayWeekWithout, WEDNESDAY_NOON, GOLDEN_TIME_ZONE, params),
      );
    });
  });

  describe("on Sunday 18 October, when Thursday was never logged", () => {
    const sunday = compareWeekSoFar(wednesdayWeek, SUNDAY_EVENING, GOLDEN_TIME_ZONE, params);
    const sundayWithout = compareWeekSoFar(
      wednesdayWeekWithout,
      SUNDAY_EVENING,
      GOLDEN_TIME_ZONE,
      params,
    );

    it("should read the press sets as planned and not done: behind by 3.00 more on upper chest", () => {
      // Logged 4.80 against 9.60 projected is the agreed -4.80; the missed press adds 3.00 to the plan.
      expect(sundayWithout.chest_upper.gap).toBeCloseTo(-4.8, TWO_DECIMAL_PLACES);
      expect(sunday.chest_upper).toMatchObject({ actualWeeklySets: 4.8, status: "behind" });
      expect(sunday.chest_upper.projectedWeeklySets).toBeCloseTo(12.6, TWO_DECIMAL_PLACES);
      expect(sunday.chest_upper.gap).toBeCloseTo(-7.8, TWO_DECIMAL_PLACES);
    });

    it("should read lower chest, front delts and triceps 1.50 further behind, and side delts as before", () => {
      for (const muscle of ["chest_lower", "delt_front", "triceps"] as const) {
        expect(sunday[muscle].gap - sundayWithout[muscle].gap).toBeCloseTo(
          -1.5,
          TWO_DECIMAL_PLACES,
        );
      }
      expect(sunday.delt_side).toEqual(sundayWithout.delt_side);
    });
  });

  describe("once Thursday's session is logged", () => {
    const pressSetsLogged = (sessionId: string, count: number): LoggedSet[] =>
      wednesdayWeek.planned
        .filter(
          (set) =>
            set.exercise_id === idOf("Incline Dumbbell Press") && set.local_date === THURSDAY,
        )
        .slice(0, count)
        .map((set) => ({
          session_id: sessionId,
          set_type: "working",
          rir: 2,
          rpe: null,
          performed_at: "2026-10-15T18:40:00+01:00",
          deleted_at: null,
          snapshot: set.snapshot,
        }));
    const thursday = allSessions.find((each) => each.local_date === THURSDAY);
    if (thursday === undefined) {
      throw new Error("The golden week has a Thursday session");
    }

    it("should take the suggestion's sets out of the projection when Legs is logged without the press", () => {
      const week = project(allSessions, loggedSets, [accepted]);
      const without = project(allSessions, loggedSets, []);

      expect(week.projected).toEqual(without.projected);
      expect(week.planned).toHaveLength(without.planned.length + 3);
      // The agreed plan week of the fixture: upper chest 4.80 logged, 9.60 projected, gap -4.80.
      expect(compareWeek(week.actual, week.projected, params).chest_upper).toMatchObject({
        projectedWeeklySets: 9.6,
        gap: -4.8,
        status: "behind",
      });
    });

    it("should put the logged press sets in their place when Legs is logged with them", () => {
      const sets = [...loggedSets, ...pressSetsLogged(thursday.id, 3)];
      const week = project(allSessions, sets, [accepted]);
      const comparison = compareWeek(week.actual, week.projected, params);

      expect(
        week.projected.filter((set) => "planned" in set && set.local_date === THURSDAY),
      ).toEqual([]);
      expect(comparison.chest_upper.actualWeeklySets).toBeCloseTo(7.8, TWO_DECIMAL_PLACES);
      expect(comparison.chest_upper.projectedWeeklySets).toBeCloseTo(12.6, TWO_DECIMAL_PLACES);
      expect(comparison.chest_upper.gap).toBeCloseTo(-4.8, TWO_DECIMAL_PLACES);
    });

    it("should do the same when Legs is logged on another day of the week", () => {
      const early = { ...thursday, local_date: "2026-10-14" };
      const week = project(
        allSessions.map((each) => (each.id === thursday.id ? early : each)),
        loggedSets,
        [accepted],
      );

      expect(
        week.projected.filter((set) => "planned" in set && set.local_date === THURSDAY),
      ).toEqual([]);
    });
  });
});
