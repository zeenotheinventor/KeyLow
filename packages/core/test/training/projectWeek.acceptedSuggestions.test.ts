import { describe, expect, it } from "vitest";

import { acceptedExercise, curlSuggestion } from "./acceptedSuggestions";
import {
  bench,
  benchMuscles,
  curl,
  curlMuscles,
  LONDON,
  legs,
  loggedSets,
  pull,
  push,
  routine,
  session,
  squat,
  squatMuscles,
  WEEK,
} from "./plans";
import {
  COMPARE_PARAMS_V1,
  compareWeek,
  compareWeekSoFar,
  expandPlan,
  projectedState,
  projectWeek,
  targetedMuscles,
} from "../../src/training";

import type { AcceptedSuggestion, LoggedWeek } from "../../src/training";

/*
 * Accepted suggestions count as planned (ADR 0005, "Projected against actual"; KEY-402). The small routine
 * is push on Monday 19 October, legs on Wednesday 21 and pull on Friday 23, with an any-day arms day. A
 * suggestion is 3 sets of dumbbell curl (biceps primary, weight 1) at RIR 2, which is full effort, so it
 * adds 3.00 effective sets to biceps. London is on BST, so the planned time 18:00 is 17:00 UTC.
 */

const params = COMPARE_PARAMS_V1;

const MONDAY = "2026-10-19";
const TUESDAY = "2026-10-20";
const WEDNESDAY = "2026-10-21";
const THURSDAY = "2026-10-22";
const SATURDAY = "2026-10-24";
const NEXT_MONDAY = "2026-10-26";
const PREVIOUS_SUNDAY = "2026-10-18";

const nothingLogged: LoggedWeek = { sessions: [], sets: [] };

const withSuggestions = (
  acceptedSuggestions: readonly AcceptedSuggestion[],
  logged: LoggedWeek = nothingLogged,
): LoggedWeek => ({ ...logged, acceptedSuggestions });

const standalone = curlSuggestion(TUESDAY, null);
const foldedIntoLegs = curlSuggestion(WEDNESDAY, legs.id);

const baseline = projectWeek(routine, WEEK, LONDON, nothingLogged, params);

const bicepsSets = (projected: ReturnType<typeof projectWeek>["projected"]): number =>
  compareWeek([], projected, params).biceps.projectedWeeklySets;

describe("projectWeek with accepted suggestions", () => {
  describe("what an accepted suggestion adds", () => {
    it("should add its 3 sets to the planned and the projected sets, and none to the actual", () => {
      const week = projectWeek(routine, WEEK, LONDON, withSuggestions([standalone]), params);

      expect(week.planned).toHaveLength(baseline.planned.length + 3);
      expect(week.projected).toHaveLength(baseline.projected.length + 3);
      expect(week.actual).toEqual([]);
    });

    it("should plan each set of it on its date at 18:00 local, as a working set at the target RIR", () => {
      const week = projectWeek(routine, WEEK, LONDON, withSuggestions([standalone]), params);
      const added = week.planned.filter((set) => set.local_date === TUESDAY);

      expect(added).toHaveLength(3);
      for (const [position, set] of added.entries()) {
        expect(set).toMatchObject({
          planned: true,
          set_type: "working",
          rir: 2,
          rpe: null,
          deleted_at: null,
          exercise_id: curl.id,
          routine_day_id: null,
          local_date: TUESDAY,
          performed_at: "2026-10-20T17:00:00.000Z",
          position,
        });
      }
    });

    it("should carry the snapshot stored with the exercise", () => {
      const [stored] = standalone.exercises;
      const week = projectWeek(routine, WEEK, LONDON, withSuggestions([standalone]), params);

      expect(week.planned.find((set) => set.local_date === TUESDAY)?.snapshot).toEqual(
        stored?.snapshot,
      );
    });

    it("should add the effective sets of the exercise to the projected week of its muscles", () => {
      const week = projectWeek(routine, WEEK, LONDON, withSuggestions([standalone]), params);

      // Pull's 3 rows at RIR 1 work biceps at 0.5 each: 1.50. The suggestion adds 3 curls at weight 1.
      expect(bicepsSets(baseline.projected)).toBeCloseTo(1.5, 9);
      expect(bicepsSets(week.projected)).toBeCloseTo(4.5, 9);
    });

    it("should plan it on the routine day's date and number its sets from 0 in the suggestion", () => {
      const week = projectWeek(routine, WEEK, LONDON, withSuggestions([foldedIntoLegs]), params);
      const added = week.planned.filter((set) => set.exercise_id === curl.id);

      expect(added.map((set) => [set.routine_day_id, set.local_date, set.position])).toEqual([
        [legs.id, WEDNESDAY, 0],
        [legs.id, WEDNESDAY, 1],
        [legs.id, WEDNESDAY, 2],
      ]);
    });

    it("should expand every exercise of the suggestion in position order, after the planned sets", () => {
      const suggestion: AcceptedSuggestion = {
        local_date: THURSDAY,
        routine_day_id: null,
        exercises: [
          acceptedExercise(squat, squatMuscles, 2, 2, 1),
          acceptedExercise(curl, curlMuscles, 1, 2, 0),
        ],
      };
      const week = projectWeek(routine, WEEK, LONDON, withSuggestions([suggestion]), params);

      expect(week.planned.slice(baseline.planned.length).map((set) => set.exercise_id)).toEqual([
        curl.id,
        squat.id,
        squat.id,
      ]);
    });

    it("should leave the planned sets of the routine as expandPlan gives them", () => {
      const week = projectWeek(routine, WEEK, LONDON, withSuggestions([standalone]), params);

      expect(week.planned.slice(0, baseline.planned.length)).toEqual(
        expandPlan(routine, WEEK, LONDON, params),
      );
    });
  });

  describe("which suggestions are read", () => {
    it("should ignore a suggestion on a day outside the week", () => {
      const week = projectWeek(
        routine,
        WEEK,
        LONDON,
        withSuggestions([curlSuggestion(PREVIOUS_SUNDAY, null), curlSuggestion(NEXT_MONDAY, null)]),
        params,
      );

      expect(week).toEqual(baseline);
    });

    it("should plan one on the first and the last day of the week", () => {
      const week = projectWeek(
        routine,
        WEEK,
        LONDON,
        withSuggestions([curlSuggestion(MONDAY, null), curlSuggestion("2026-10-25", null)]),
        params,
      );

      expect(week.planned).toHaveLength(baseline.planned.length + 6);
    });

    it("should count a suggestion folded into a day the routine no longer has", () => {
      const removedDay = "00000003-0000-4000-8000-0000000000ff";
      const week = projectWeek(
        routine,
        WEEK,
        LONDON,
        withSuggestions([curlSuggestion(THURSDAY, removedDay)]),
        params,
      );

      expect(week.projected).toHaveLength(baseline.projected.length + 3);
    });
  });

  describe("replacement by what was logged", () => {
    it("should replace a standalone suggestion's sets with the sets of a session on its date", () => {
      const onTuesday = session(1, TUESDAY, null);
      const logged = loggedSets(onTuesday, curl, curlMuscles, 2, "2026-10-20T17:00:00.000Z");
      const week = projectWeek(
        routine,
        WEEK,
        LONDON,
        withSuggestions([standalone], { sessions: [onTuesday], sets: logged }),
        params,
      );

      expect(
        week.projected.filter((set) => "planned" in set && set.local_date === TUESDAY),
      ).toEqual([]);
      expect(week.projected.filter((set) => !("planned" in set))).toEqual(logged);
      expect(week.actual).toEqual(logged);
      expect(bicepsSets(week.projected)).toBeCloseTo(1.5 + 2, 9);
    });

    it("should replace a suggestion with a session that has no sets yet", () => {
      const week = projectWeek(
        routine,
        WEEK,
        LONDON,
        withSuggestions([standalone], { sessions: [session(1, TUESDAY, null)], sets: [] }),
        params,
      );

      expect(week.projected).toHaveLength(baseline.projected.length);
    });

    it("should replace a suggestion with a session of a routine day logged on its date", () => {
      const pullOnTuesday = session(1, TUESDAY, pull.id);
      const week = projectWeek(
        routine,
        WEEK,
        LONDON,
        withSuggestions([standalone], { sessions: [pullOnTuesday], sets: [] }),
        params,
      );

      expect(
        week.projected.filter((set) => "planned" in set && set.exercise_id === curl.id),
      ).toEqual([]);
    });

    it("should replace a suggestion folded into a day when that day is logged on another date", () => {
      const legsOnThursday = session(1, THURSDAY, legs.id);
      const week = projectWeek(
        routine,
        WEEK,
        LONDON,
        withSuggestions([foldedIntoLegs], { sessions: [legsOnThursday], sets: [] }),
        params,
      );

      expect(
        week.projected.filter((set) => "planned" in set && set.local_date === WEDNESDAY),
      ).toEqual([]);
      expect(week.planned.filter((set) => set.exercise_id === curl.id)).toHaveLength(3);
    });

    it("should keep a suggestion folded into a day when a free session is on its date, and leave that session in actual only", () => {
      // Legs, with the curls folded in, was never logged. A free arms session on the same date is a
      // different workout: the suggestion lives and dies with Legs, so it and Legs stay planned.
      const freeOnWednesday = session(1, WEDNESDAY, null);
      const logged = loggedSets(freeOnWednesday, curl, curlMuscles, 2, "2026-10-21T17:00:00.000Z");
      const week = projectWeek(
        routine,
        WEEK,
        LONDON,
        withSuggestions([foldedIntoLegs], { sessions: [freeOnWednesday], sets: logged }),
        params,
      );
      const withoutSuggestion = projectWeek(
        routine,
        WEEK,
        LONDON,
        { sessions: [freeOnWednesday], sets: logged },
        params,
      );

      expect(week.projected).toEqual([
        ...withoutSuggestion.projected,
        ...week.planned.filter((set) => set.exercise_id === curl.id),
      ]);
      expect(week.projected.filter((set) => !("planned" in set))).toEqual([]);
      expect(week.actual).toEqual(logged);
    });

    it("should keep a suggestion folded into a day when another routine day is logged on its date", () => {
      const week = projectWeek(
        routine,
        WEEK,
        LONDON,
        withSuggestions([foldedIntoLegs], { sessions: [session(1, WEDNESDAY, pull.id)], sets: [] }),
        params,
      );

      expect(
        week.projected.filter((set) => "planned" in set && set.routine_day_id === legs.id),
      ).toHaveLength(4 + 3);
    });

    it("should replace a suggestion folded into a day when that day is logged on its date", () => {
      const week = projectWeek(
        routine,
        WEEK,
        LONDON,
        withSuggestions([foldedIntoLegs], { sessions: [session(1, WEDNESDAY, legs.id)], sets: [] }),
        params,
      );

      expect(
        week.projected.filter((set) => "planned" in set && set.local_date === WEDNESDAY),
      ).toEqual([]);
    });

    it("should treat a suggestion folded into a day the routine no longer has as standalone: a session on its date replaces it", () => {
      const removedDay = "00000003-0000-4000-8000-0000000000ff";
      const freeOnThursday = session(1, THURSDAY, null);
      const logged = loggedSets(freeOnThursday, curl, curlMuscles, 1, "2026-10-22T17:00:00.000Z");
      const week = projectWeek(
        routine,
        WEEK,
        LONDON,
        withSuggestions([curlSuggestion(THURSDAY, removedDay)], {
          sessions: [freeOnThursday],
          sets: logged,
        }),
        params,
      );

      expect(
        week.projected.filter((set) => "planned" in set && set.local_date === THURSDAY),
      ).toEqual([]);
      expect(week.projected.filter((set) => !("planned" in set))).toEqual(logged);
    });

    it("should keep a standalone suggestion when a session is on another date", () => {
      const week = projectWeek(
        routine,
        WEEK,
        LONDON,
        withSuggestions([standalone], { sessions: [session(1, THURSDAY, null)], sets: [] }),
        params,
      );

      expect(
        week.projected.filter((set) => "planned" in set && set.local_date === TUESDAY),
      ).toHaveLength(3);
    });

    it("should keep a suggestion when the only session on its date is deleted", () => {
      const deleted = session(1, TUESDAY, null, { deleted_at: "2026-10-20T20:00:00.000Z" });
      const week = projectWeek(
        routine,
        WEEK,
        LONDON,
        withSuggestions([standalone], { sessions: [deleted], sets: [] }),
        params,
      );

      expect(week.projected).toHaveLength(baseline.projected.length + 3);
    });

    it("should keep a suggestion when the session on its date is in another week", () => {
      const inNextWeek = session(1, NEXT_MONDAY, null);
      const week = projectWeek(
        routine,
        WEEK,
        LONDON,
        withSuggestions([curlSuggestion(SATURDAY, null)], { sessions: [inNextWeek], sets: [] }),
        params,
      );

      expect(week.projected).toHaveLength(baseline.projected.length + 3);
    });

    it("should leave the other suggestions of the week planned", () => {
      const week = projectWeek(
        routine,
        WEEK,
        LONDON,
        withSuggestions([standalone, curlSuggestion(THURSDAY, null)], {
          sessions: [session(1, TUESDAY, null)],
          sets: [],
        }),
        params,
      );

      expect(
        week.projected.filter((set) => "planned" in set && set.local_date === THURSDAY),
      ).toHaveLength(3);
    });

    it("should keep the replaced suggestion's sets in planned, whatever was logged", () => {
      const week = projectWeek(
        routine,
        WEEK,
        LONDON,
        withSuggestions([standalone], { sessions: [session(1, TUESDAY, null)], sets: [] }),
        params,
      );

      expect(week.planned).toHaveLength(baseline.planned.length + 3);
    });

    it("should take a session at 00:30 local on its date for the new day, not the UTC day", () => {
      // 00:30 BST on Wednesday 21 October is 23:30 UTC on Tuesday 20 October; its local date is Wednesday.
      const afterMidnight = session(1, WEDNESDAY, null);
      const logged = loggedSets(afterMidnight, curl, curlMuscles, 1, "2026-10-20T23:30:00.000Z");
      const week = projectWeek(
        routine,
        WEEK,
        LONDON,
        withSuggestions([standalone, curlSuggestion(WEDNESDAY, null)], {
          sessions: [afterMidnight],
          sets: logged,
        }),
        params,
      );

      expect(
        week.projected.filter((set) => "planned" in set && set.local_date === TUESDAY),
      ).toHaveLength(3);
      expect(
        week.projected.filter((set) => "planned" in set && set.exercise_id === curl.id),
      ).toHaveLength(3);
      expect(week.projected.filter((set) => !("planned" in set))).toEqual(logged);
    });
  });

  describe("time zones", () => {
    it("should plan a suggestion at 18:00 in the week's zone", () => {
      const week = projectWeek(
        routine,
        WEEK,
        "Pacific/Auckland",
        withSuggestions([standalone]),
        params,
      );

      // Auckland is on NZDT (UTC+13) on 20 October 2026, so 18:00 there is 05:00 UTC the same day.
      expect(week.planned.find((set) => set.exercise_id === curl.id)?.performed_at).toBe(
        "2026-10-20T05:00:00.000Z",
      );
    });
  });

  describe("refusals", () => {
    it("should refuse a suggestion whose date is not a calendar day, naming the rule", () => {
      expect(() =>
        projectWeek(
          routine,
          WEEK,
          LONDON,
          withSuggestions([curlSuggestion("2026-10-32", null)]),
          params,
        ),
      ).toThrow(
        new RangeError(
          "An accepted suggestion's local date must be a calendar day written YYYY-MM-DD",
        ),
      );
    });

    it("should refuse an exercise whose muscle map is taken from another exercise", () => {
      const wrong: AcceptedSuggestion = {
        ...standalone,
        exercises: [{ ...acceptedExercise(curl, curlMuscles, 3, 2, 0), exercise_id: bench.id }],
      };

      expect(() => projectWeek(routine, WEEK, LONDON, withSuggestions([wrong]), params)).toThrow(
        new RangeError("A routine exercise's muscle map must be taken from its own exercise"),
      );
    });

    it("should refuse target sets out of range, as for a routine exercise", () => {
      const tooMany: AcceptedSuggestion = {
        ...standalone,
        exercises: [acceptedExercise(curl, curlMuscles, 21, 2, 0)],
      };

      expect(() => projectWeek(routine, WEEK, LONDON, withSuggestions([tooMany]), params)).toThrow(
        /target sets/,
      );
    });
  });

  describe("heat and the gap", () => {
    const logged: LoggedWeek = {
      sessions: [session(1, MONDAY, push.id)],
      sets: loggedSets(
        session(1, MONDAY, push.id),
        bench,
        benchMuscles,
        3,
        "2026-10-19T17:00:00.000Z",
      ),
    };
    const week = projectWeek(routine, WEEK, LONDON, withSuggestions([standalone], logged), params);
    const without = projectWeek(routine, WEEK, LONDON, logged, params);

    it("should not count it in projected heat on its own day, only from the day after", () => {
      const tuesdayNoon = "2026-10-20T12:00:00.000Z";
      const wednesdayNoon = "2026-10-21T12:00:00.000Z";

      expect(projectedState(week.projected, tuesdayNoon, LONDON, params)).toEqual(
        projectedState(without.projected, tuesdayNoon, LONDON, params),
      );
      // 18:00 BST Tuesday is 17:00 UTC, so at Wednesday 12:00 UTC the three curls are 19 hours old.
      expect(
        projectedState(week.projected, wednesdayNoon, LONDON, params).biceps.heat,
      ).toBeGreaterThan(
        projectedState(without.projected, wednesdayNoon, LONDON, params).biceps.heat,
      );
    });

    it("should put the sets in the week's projected total and, once due, in the gap", () => {
      const sunday = "2026-10-25T20:00:00.000Z";

      expect(compareWeek(week.actual, week.projected, params).biceps.gap).toBeCloseTo(-4.5, 9);
      expect(compareWeekSoFar(week, sunday, LONDON, params).biceps).toMatchObject({
        actualWeeklySets: 0,
        status: "behind",
      });
      expect(compareWeekSoFar(week, sunday, LONDON, params).biceps.gap).toBeCloseTo(-4.5, 9);
    });

    it("should leave the gap alone until the suggestion's day is over", () => {
      const tuesdayMorning = "2026-10-20T08:00:00.000Z";

      expect(compareWeekSoFar(week, tuesdayMorning, LONDON, params)).toEqual(
        compareWeekSoFar(without, tuesdayMorning, LONDON, params),
      );
    });

    it("should read the gap as 0 for a suggestion done in a session on its date", () => {
      const onTuesday = session(2, TUESDAY, null);
      const done = loggedSets(onTuesday, curl, curlMuscles, 3, "2026-10-20T17:30:00.000Z");
      const doneWeek = projectWeek(
        routine,
        WEEK,
        LONDON,
        withSuggestions([standalone], {
          sessions: [...logged.sessions, onTuesday],
          sets: [...logged.sets, ...done],
        }),
        params,
      );
      const sunday = "2026-10-25T20:00:00.000Z";

      expect(
        compareWeekSoFar(doneWeek, sunday, LONDON, params).biceps.actualWeeklySets,
      ).toBeCloseTo(3, 9);
      // Pull's 1.50 biceps sets are still planned and missed; the curls are done.
      expect(compareWeekSoFar(doneWeek, sunday, LONDON, params).biceps.gap).toBeCloseTo(3 - 4.5, 9);
    });
  });

  describe("targeted muscles", () => {
    // A routine of legs alone does not train biceps; the suggestion's curls do.
    const legsOnly = { days: [legs] };
    const week = projectWeek(legsOnly, WEEK, LONDON, withSuggestions([standalone]), params);
    const wednesdayNoon = "2026-10-21T12:00:00.000Z";

    it("should leave targetedMuscles unchanged: a muscle only a suggestion trains is not targeted by the plan", () => {
      expect(targetedMuscles({ routine: legsOnly }).has("biceps")).toBe(false);
      expect(
        projectedState(
          week.projected,
          wednesdayNoon,
          LONDON,
          params,
          targetedMuscles({ routine: legsOnly }),
        ).biceps,
      ).toMatchObject({ weeklySets: 3, volumeStatus: "not_targeted" });
    });

    it("should be targeted by the goal that produced the suggestion, as before", () => {
      const targeted = targetedMuscles({ routine: legsOnly, priority: { biceps: 2 } });

      expect(
        projectedState(week.projected, wednesdayNoon, LONDON, params, targeted).biceps,
      ).toMatchObject({ weeklySets: 3, volumeStatus: "under" });
    });
  });
});
