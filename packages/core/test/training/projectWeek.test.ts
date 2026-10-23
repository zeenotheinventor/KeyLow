import { describe, expect, it } from "vitest";

import {
  arms,
  bench,
  benchMuscles,
  curl,
  curlMuscles,
  dayId,
  LONDON,
  legs,
  loggedSets,
  planExercise,
  PREVIOUS_WEEK,
  pull,
  push,
  routine,
  row,
  rowMuscles,
  session,
  squat,
  squatMuscles,
  WEEK,
} from "./plans";
import {
  COMPARE_PARAMS_V1,
  compareWeek,
  expandPlan,
  muscleState,
  projectedState,
  projectWeek,
  targetedMuscles,
} from "../../src/training";

import type { LoggedWeek, PlannedSet, PlanRoutineDay } from "../../src/training";

const params = COMPARE_PARAMS_V1;

const MONDAY_EVENING = "2026-10-19T17:30:00.000Z";
const FRIDAY_EVENING = "2026-10-23T17:30:00.000Z";

describe("projectWeek", () => {
  it("should project the whole plan when nothing is logged", () => {
    const week = projectWeek(routine, WEEK, LONDON, { sessions: [], sets: [] }, params);

    expect(week.planned).toEqual(expandPlan(routine, WEEK, LONDON, params));
    expect(week.projected).toEqual(week.planned);
    expect(week.actual).toEqual([]);
  });

  it("should replace a done day with its sets and keep a skipped day planned", () => {
    /*
     * Monday is done with two extra bench sets (5 for 3 planned), Wednesday is skipped, and Friday is
     * done as planned. Monday's five logged sets take the place of its three planned ones in the
     * projection, so the extra sets match on both sides. Wednesday stays planned, so quads and
     * glute_max show the missed day as a gap.
     */
    const monday = session(1, "2026-10-19", push.id);
    const friday = session(2, "2026-10-23", pull.id);
    const mondaySets = loggedSets(monday, bench, benchMuscles, 5, MONDAY_EVENING);
    const fridaySets = loggedSets(friday, row, rowMuscles, 3, FRIDAY_EVENING, { rir: 1 });
    const logged: LoggedWeek = { sessions: [monday, friday], sets: [...mondaySets, ...fridaySets] };

    const week = projectWeek(routine, WEEK, LONDON, logged, params);

    expect(week.actual).toEqual([...mondaySets, ...fridaySets]);
    expect(week.projected).toEqual([
      ...week.planned.filter((set) => set.routine_day_id === legs.id),
      ...mondaySets,
      ...fridaySets,
    ]);

    const comparison = compareWeek(week.actual, week.projected, params);
    expect(comparison.chest_lower).toStrictEqual({
      actualWeeklySets: 5,
      projectedWeeklySets: 5,
      gap: 0,
      status: "on_plan",
    });
    expect(comparison.quads).toStrictEqual({
      actualWeeklySets: 0,
      projectedWeeklySets: 4,
      gap: -4,
      status: "behind",
    });
    // glute_max is 4 sets at a weight of 0.5: 2 behind, outside the 1-set tolerance.
    expect(comparison.glute_max.gap).toBe(-2);
    expect(comparison.glute_max.status).toBe("behind");
    expect(comparison.lats.status).toBe("on_plan");

    // Against the plan alone, the extra bench sets read as ahead.
    expect(compareWeek(week.actual, week.planned, params).chest_lower).toStrictEqual({
      actualWeeklySets: 5,
      projectedWeeklySets: 3,
      gap: 2,
      status: "ahead",
    });
  });

  it("should replace a planned day even when it is logged on another day of the week", () => {
    const tuesday = session(1, "2026-10-20", push.id);
    const sets = loggedSets(tuesday, bench, benchMuscles, 3, "2026-10-20T08:00:00.000Z");
    const week = projectWeek(routine, WEEK, LONDON, { sessions: [tuesday], sets }, params);

    expect(week.projected.some((set) => "planned" in set && set.routine_day_id === push.id)).toBe(
      false,
    );
    expect(compareWeek(week.actual, week.projected, params).chest_lower.gap).toBe(0);
  });

  it("should leave Wednesday's planned Legs out of the projection when Legs is logged on Friday, a make-up (KEY-531)", () => {
    const friday = session(1, "2026-10-23", legs.id);
    const sets = loggedSets(friday, squat, squatMuscles, 4, "2026-10-23T08:00:00.000Z");
    const week = projectWeek(routine, WEEK, LONDON, { sessions: [friday], sets }, params);

    expect(week.projected.some((set) => "planned" in set && set.routine_day_id === legs.id)).toBe(
      false,
    );
    expect(compareWeek(week.actual, week.projected, params).quads.gap).toBe(0);
  });

  it("should count an unplanned session in actual only", () => {
    const saturday = session(1, "2026-10-24", null);
    const sets = loggedSets(saturday, curl, curlMuscles, 3, "2026-10-24T10:00:00.000Z");
    const week = projectWeek(routine, WEEK, LONDON, { sessions: [saturday], sets }, params);

    expect(week.actual).toEqual(sets);
    expect(week.projected).toEqual(week.planned);
    // biceps is planned at 1.5 sets (three rows at a weight of 0.5) and gets 3 more from the curls.
    expect(compareWeek(week.actual, week.projected, params).biceps).toStrictEqual({
      actualWeeklySets: 3,
      projectedWeeklySets: 1.5,
      gap: 1.5,
      status: "ahead",
    });
  });

  it("should leave a planned day in place when an unplanned session falls on its weekday", () => {
    const monday = session(1, "2026-10-19", null);
    const sets = loggedSets(monday, curl, curlMuscles, 1, MONDAY_EVENING);
    const week = projectWeek(routine, WEEK, LONDON, { sessions: [monday], sets }, params);

    expect(week.projected).toEqual(week.planned);
    expect(compareWeek(week.actual, week.projected, params).chest_lower.status).toBe("behind");
  });

  it("should count a session of another routine's day in actual only", () => {
    const other = session(1, "2026-10-19", dayId(99));
    const sets = loggedSets(other, bench, benchMuscles, 3, MONDAY_EVENING);
    const week = projectWeek(routine, WEEK, LONDON, { sessions: [other], sets }, params);

    expect(week.actual).toEqual(sets);
    expect(week.projected).toEqual(week.planned);
  });

  it("should count a session of a null-weekday day in both views, though the day is never placed", () => {
    const thursday = session(1, "2026-10-22", arms.id);
    const sets = loggedSets(thursday, curl, curlMuscles, 3, "2026-10-22T18:00:00.000Z");
    const week = projectWeek(routine, WEEK, LONDON, { sessions: [thursday], sets }, params);

    expect(week.planned.some((set) => set.routine_day_id === arms.id)).toBe(false);
    expect(week.projected).toEqual([...week.planned, ...sets]);
    // biceps: the curls on both sides, and Friday's planned rows (1.5) on the projected side only.
    expect(compareWeek(week.actual, week.projected, params).biceps).toMatchObject({
      actualWeeklySets: 3,
      projectedWeeklySets: 4.5,
    });
  });

  it("should count both sessions of a day logged twice", () => {
    const first = session(1, "2026-10-19", push.id);
    const second = session(2, "2026-10-20", push.id);
    const sets = [
      ...loggedSets(first, bench, benchMuscles, 2, MONDAY_EVENING),
      ...loggedSets(second, bench, benchMuscles, 2, "2026-10-20T17:30:00.000Z"),
    ];
    const week = projectWeek(routine, WEEK, LONDON, { sessions: [first, second], sets }, params);

    expect(compareWeek(week.actual, week.projected, params).chest_lower).toMatchObject({
      actualWeeklySets: 4,
      projectedWeeklySets: 4,
    });
  });

  it("should leave out deleted sessions and sets, sets of unknown sessions and other weeks", () => {
    const deleted = session(1, "2026-10-19", push.id, { deleted_at: MONDAY_EVENING });
    const lastWeek = session(2, "2026-10-16", legs.id);
    const friday = session(3, "2026-10-23", pull.id);
    const sets = [
      ...loggedSets(deleted, bench, benchMuscles, 3, MONDAY_EVENING),
      ...loggedSets(lastWeek, bench, squatMuscles, 4, "2026-10-16T17:30:00.000Z"),
      ...loggedSets(friday, row, rowMuscles, 1, FRIDAY_EVENING, { deleted_at: FRIDAY_EVENING }),
      ...loggedSets(session(4, "2026-10-23", null), curl, curlMuscles, 2, FRIDAY_EVENING),
    ];
    const week = projectWeek(
      routine,
      WEEK,
      LONDON,
      { sessions: [deleted, lastWeek, friday], sets },
      params,
    );

    expect(week.actual).toEqual([]);
    // Friday has a live session with no live sets, so the day is done with nothing in it.
    expect(week.projected).toEqual(week.planned.filter((set) => set.routine_day_id !== pull.id));
  });

  describe("at a time zone edge", () => {
    /*
     * A session started at 23:15 UTC on Sunday 18 October is 00:15 BST on Monday 19 October in
     * London, so its local date is the Monday. It belongs to the new week and replaces Monday's
     * planned day there, though its UTC date is still the Sunday of the week before.
     */
    const justAfterMidnight = session(1, "2026-10-19", push.id);
    const sets = loggedSets(justAfterMidnight, bench, benchMuscles, 3, "2026-10-18T23:15:00.000Z");
    const logged: LoggedWeek = { sessions: [justAfterMidnight], sets };

    it("should put a session just after local midnight in the week of its local date", () => {
      const week = projectWeek(routine, WEEK, LONDON, logged, params);

      expect(week.actual).toEqual(sets);
      expect(week.projected.some((set) => "planned" in set && set.routine_day_id === push.id)).toBe(
        false,
      );
      expect(compareWeek(week.actual, week.projected, params).chest_lower.status).toBe("on_plan");
    });

    it("should leave it out of the week its UTC date falls in", () => {
      const week = projectWeek(routine, PREVIOUS_WEEK, LONDON, logged, params);

      expect(week.actual).toEqual([]);
      expect(week.projected).toEqual(week.planned);
    });
  });

  it("should refuse a session whose local date is not a calendar day", () => {
    const bad = session(1, "2026-10-32", null);
    expect(() => projectWeek(routine, WEEK, LONDON, { sessions: [bad], sets: [] }, params)).toThrow(
      new RangeError("A session's local date must be a calendar day written YYYY-MM-DD"),
    );
  });

  it("should refuse what expandPlan refuses", () => {
    expect(() =>
      projectWeek(routine, "2026-10-18", LONDON, { sessions: [], sets: [] }, params),
    ).toThrow(new RangeError("A week must start on a Monday, written YYYY-MM-DD"));
  });
});

describe("projectedState", () => {
  const monday = session(1, "2026-10-19", push.id);
  const mondaySets = loggedSets(monday, bench, benchMuscles, 3, MONDAY_EVENING);
  const week = projectWeek(routine, WEEK, LONDON, { sessions: [monday], sets: mondaySets }, params);

  it("should be muscleState over the projected sets up to the moment", () => {
    const moment = "2026-10-22T12:00:00.000Z";
    expect(projectedState(week.projected, moment, LONDON, params)).toEqual(
      muscleState(week.projected, moment, params.training),
    );
  });

  it("should pass the targeted muscles on to muscleState", () => {
    const moment = "2026-10-22T12:00:00.000Z";
    const targeted = targetedMuscles({ routine });

    const state = projectedState(week.projected, moment, LONDON, params, targeted);

    expect(state).toEqual(muscleState(week.projected, moment, params.training, targeted));
    expect(state.abs.volumeStatus).toBe("not_targeted");
    expect(state.quads.volumeStatus).toBe("under");
    expect(projectedState(week.projected, moment, LONDON, params).abs.volumeStatus).toBe("under");
  });

  it("should count a planned day from the day after, not once its time has passed", () => {
    const wednesdayBeforeLegs = "2026-10-21T15:00:00.000Z";
    const wednesdayAfterLegs = "2026-10-21T18:00:00.000Z";
    const wednesdayEnd = "2026-10-21T22:59:00.000Z";
    const thursdayStart = "2026-10-21T23:00:00.000Z";
    const thursdayNoon = "2026-10-22T11:00:00.000Z";

    expect(projectedState(week.projected, wednesdayBeforeLegs, LONDON, params).quads.heat).toBe(0);
    expect(projectedState(week.projected, wednesdayAfterLegs, LONDON, params).quads.heat).toBe(0);
    expect(projectedState(week.projected, wednesdayEnd, LONDON, params).quads.heat).toBe(0);

    const legsSets = week.planned.filter((set) => set.routine_day_id === legs.id);
    for (const moment of [thursdayStart, thursdayNoon]) {
      const quads = projectedState(week.projected, moment, LONDON, params).quads;
      expect(quads.heat).toBeGreaterThan(0);
      expect(quads).toEqual(muscleState(legsSets, moment, params.training).quads);
    }
    // Nothing was logged on Wednesday, so the actual view stays cold.
    expect(muscleState(week.actual, thursdayNoon, params.training).quads.heat).toBe(0);
  });

  it("should use the logged sets of a done day, not its planned ones", () => {
    const moment = "2026-10-19T20:00:00.000Z";
    expect(projectedState(week.projected, moment, LONDON, params).chest_lower).toEqual(
      muscleState(mondaySets, moment, params.training).chest_lower,
    );
  });

  describe("on a week with a planned Thursday", () => {
    const thursday: PlanRoutineDay = {
      id: dayId(5),
      position: 4,
      weekday: 3,
      exercises: [planExercise(curl, curlMuscles, 2, 1, 0)],
    };
    const fullWeek = projectWeek(
      { days: [push, legs, thursday, pull] },
      WEEK,
      LONDON,
      { sessions: [], sets: [] },
      params,
    );
    const plannedOf = (...days: PlanRoutineDay[]): PlannedSet[] =>
      fullWeek.planned.filter((set) => days.some((day) => day.id === set.routine_day_id));

    it("should leave out the planned Thursday and Friday and count Monday and Wednesday on Thursday", () => {
      const thursdayEvening = "2026-10-22T19:00:00.000Z";
      const state = projectedState(fullWeek.projected, thursdayEvening, LONDON, params);

      expect(state).toEqual(muscleState(plannedOf(push, legs), thursdayEvening, params.training));
      expect(state.quads.heat).toBeGreaterThan(0);
      expect(state.biceps.heat).toBe(0);
      expect(state.lats.heat).toBe(0);
    });

    it("should count the planned Thursday from Friday 00:00 and not the planned Friday", () => {
      const fridayStart = "2026-10-22T23:00:00.000Z";
      const state = projectedState(fullWeek.projected, fridayStart, LONDON, params);

      expect(state).toEqual(
        muscleState(plannedOf(push, legs, thursday), fridayStart, params.training),
      );
      expect(state.biceps.heat).toBeGreaterThan(0);
      expect(state.lats.heat).toBe(0);
    });
  });

  describe("on a planned day that was logged today", () => {
    const wednesday = session(1, "2026-10-21", legs.id);
    const wednesdayMorning = "2026-10-21T09:00:00.000Z";

    it("should count a logged set the moment it is performed, however early in the day", () => {
      const sets = loggedSets(wednesday, squat, squatMuscles, 4, wednesdayMorning);
      const logged = projectWeek(routine, WEEK, LONDON, { sessions: [wednesday], sets }, params);
      const afterSets = "2026-10-21T09:30:00.000Z";
      const beforeSets = "2026-10-21T08:59:00.000Z";

      expect(projectedState(logged.projected, afterSets, LONDON, params).quads).toEqual(
        muscleState(sets, afterSets, params.training).quads,
      );
      expect(
        projectedState(logged.projected, afterSets, LONDON, params).quads.heat,
      ).toBeGreaterThan(0);
      expect(projectedState(logged.projected, beforeSets, LONDON, params).quads.heat).toBe(0);
    });

    it("should count only the logged sets of a half-logged day and nothing for the unlogged ones", () => {
      const sets = loggedSets(wednesday, squat, squatMuscles, 2, wednesdayMorning);
      const logged = projectWeek(routine, WEEK, LONDON, { sessions: [wednesday], sets }, params);
      const evening = "2026-10-21T20:00:00.000Z";
      const nextDay = "2026-10-22T11:00:00.000Z";

      expect(
        logged.projected.some((set) => "planned" in set && set.routine_day_id === legs.id),
      ).toBe(false);
      for (const moment of [evening, nextDay]) {
        expect(projectedState(logged.projected, moment, LONDON, params).quads).toEqual(
          muscleState(sets, moment, params.training).quads,
        );
      }
    });

    it("should leave an unplanned session of the day to the actual view", () => {
      const unplanned = session(2, "2026-10-21", null);
      const sets = loggedSets(unplanned, curl, curlMuscles, 3, wednesdayMorning);
      const logged = projectWeek(routine, WEEK, LONDON, { sessions: [unplanned], sets }, params);
      const moment = "2026-10-21T12:00:00.000Z";

      expect(projectedState(logged.projected, moment, LONDON, params).biceps.heat).toBe(0);
      expect(muscleState(logged.actual, moment, params.training).biceps.heat).toBeGreaterThan(0);
    });
  });

  it("should count a planned Monday with no session from Tuesday 00:00", () => {
    const quiet = projectWeek(routine, WEEK, LONDON, { sessions: [], sets: [] }, params);
    const mondayEnd = "2026-10-19T22:59:00.000Z";
    const tuesdayStart = "2026-10-19T23:00:00.000Z";
    const pushSets = quiet.planned.filter((set) => set.routine_day_id === push.id);

    expect(projectedState(quiet.projected, mondayEnd, LONDON, params).chest_lower.heat).toBe(0);
    const chestLower = projectedState(quiet.projected, tuesdayStart, LONDON, params).chest_lower;
    expect(chestLower.heat).toBeGreaterThan(0);
    expect(chestLower).toEqual(muscleState(pushSets, tuesdayStart, params.training).chest_lower);
  });

  describe("by the date in the week's zone", () => {
    const sunday: PlanRoutineDay = {
      id: dayId(6),
      position: 4,
      weekday: 6,
      exercises: [planExercise(curl, curlMuscles, 2, 1, 0)],
    };
    const weekendRoutine = { days: [push, sunday] };
    const quiet: LoggedWeek = { sessions: [], sets: [] };
    // The Sunday of the week before and the Monday after it, as a heat window across the weeks has them.
    const setsAround = (tz: string, sundayWeek: string, mondayWeek: string): PlannedSet[] => [
      ...projectWeek(weekendRoutine, sundayWeek, tz, quiet, params).planned.filter(
        (set) => set.routine_day_id === sunday.id,
      ),
      ...projectWeek(weekendRoutine, mondayWeek, tz, quiet, params).planned.filter(
        (set) => set.routine_day_id === push.id,
      ),
    ];

    it("should count Sunday and not Monday at 00:30 on Monday in London", () => {
      const sets = setsAround(LONDON, PREVIOUS_WEEK, WEEK);
      const moment = "2026-10-18T23:30:00.000Z";
      const state = projectedState(sets, moment, LONDON, params);

      expect(state.biceps.heat).toBeGreaterThan(0);
      expect(state.biceps).toEqual(
        muscleState(
          sets.filter((set) => set.routine_day_id === sunday.id),
          moment,
          params.training,
        ).biceps,
      );
      expect(state.chest_lower.heat).toBe(0);
    });

    it("should count neither at the same instant in Los Angeles, where it is still Sunday", () => {
      const sets = setsAround("America/Los_Angeles", PREVIOUS_WEEK, WEEK);
      const state = projectedState(sets, "2026-10-18T23:30:00.000Z", "America/Los_Angeles", params);

      expect(state.biceps.heat).toBe(0);
      expect(state.chest_lower.heat).toBe(0);
    });

    it("should hold Sunday back in Los Angeles through its evening, after the planned time has passed", () => {
      const sets = setsAround("America/Los_Angeles", PREVIOUS_WEEK, WEEK);
      // 19:00 PDT on Sunday, an hour after the 18:00 planned time.
      const sundayEvening = "2026-10-19T02:00:00.000Z";
      const mondayStart = "2026-10-19T07:00:00.000Z";

      expect(projectedState(sets, sundayEvening, "America/Los_Angeles", params).biceps.heat).toBe(
        0,
      );
      expect(
        projectedState(sets, mondayStart, "America/Los_Angeles", params).biceps.heat,
      ).toBeGreaterThan(0);
    });

    it("should hold Sunday back until local midnight on the day the clocks go back", () => {
      const sunday25 = projectWeek(weekendRoutine, WEEK, LONDON, quiet, params).planned.filter(
        (set) => set.routine_day_id === sunday.id,
      );
      const sundayNight = "2026-10-25T23:30:00.000Z";
      const mondayStart = "2026-10-26T00:00:00.000Z";

      expect(projectedState(sunday25, sundayNight, LONDON, params).biceps.heat).toBe(0);
      const biceps = projectedState(sunday25, mondayStart, LONDON, params).biceps;
      expect(biceps.heat).toBeGreaterThan(0);
      expect(biceps).toEqual(muscleState(sunday25, mondayStart, params.training).biceps);
    });
  });

  describe("on input it refuses", () => {
    it("should refuse a time zone that is not an IANA name, naming the rule and not the value", () => {
      expect(() =>
        projectedState(week.projected, "2026-10-22T12:00:00.000Z", "Not/AZone", params),
      ).toThrow(new RangeError("A week's time zone must be an IANA zone name"));
    });

    it("should refuse a moment without a zone as muscleState does", () => {
      expect(() => projectedState(week.projected, "2026-10-22T12:00:00", LONDON, params)).toThrow(
        new RangeError("The moment to compute at must be an ISO timestamp with a zone"),
      );
    });
  });
});
