import { describe, expect, it } from "vitest";

import { params } from "./goldenWeekInputs";
import { rowId, setRow } from "./historyRows";
import { goldenPullDay, goldenLegsDay } from "./routines";
import {
  goldenLegsSets,
  goldenPullSets,
  LAT_PULLDOWN_ID,
  LEG_PRESS_ID,
  ROMANIAN_DEADLIFT_ID,
  SEATED_LEG_CURL_ID,
  SQUAT_ID,
  STANDING_CALF_RAISE_ID,
} from "./sessionRows";
import {
  heatValues,
  muscleState,
  planProgress,
  scaffoldSession,
  sessionClock,
  sessionHeatValues,
  sessionMuscleSets,
} from "../../src/training";

import type { HistorySet } from "../../src/training";

const legs = scaffoldSession(goldenLegsDay);
const pull = scaffoldSession(goldenPullDay);

const OTHER_EXERCISE_ID = rowId(1, 99);
const ANOTHER_EXERCISE_ID = rowId(1, 98);

/** Sets of one exercise, one minute apart, each with its own id and position, starting after `after`. */
const setsOf = (
  exerciseId: string,
  count: number,
  overrides: Parameters<typeof setRow>[0] = {},
  after = 0,
): HistorySet[] =>
  Array.from({ length: count }, (_, index) =>
    setRow({
      id: rowId(5, 1000 + after + index),
      exercise_id: exerciseId,
      position: after + index,
      performed_at: `2026-10-19T18:${String(10 + after + index).padStart(2, "0")}:00Z`,
      ...overrides,
    }),
  );

describe("planProgress for the golden Legs day at 19:00", () => {
  const progress = planProgress(legs, goldenLegsSets);

  it("should count 8 of 16 sets, and 2 warm-ups, with none extra", () => {
    expect(progress.logged).toBe(8);
    expect(progress.planned).toBe(16);
    expect(progress.warmups).toBe(2);
    expect(progress.extra).toBe(0);
  });

  it("should count each planned exercise against its target in the plan's order", () => {
    expect(progress.exercises).toStrictEqual([
      { exerciseId: SQUAT_ID, planned: 3, logged: 3, remaining: 0, extra: 0 },
      { exerciseId: ROMANIAN_DEADLIFT_ID, planned: 3, logged: 3, remaining: 0, extra: 0 },
      { exerciseId: LEG_PRESS_ID, planned: 3, logged: 2, remaining: 1, extra: 0 },
      { exerciseId: SEATED_LEG_CURL_ID, planned: 3, logged: 0, remaining: 3, extra: 0 },
      { exerciseId: STANDING_CALF_RAISE_ID, planned: 4, logged: 0, remaining: 4, extra: 0 },
    ]);
  });

  it("should name leg press set 3 as the next set", () => {
    expect(progress.nextSet).toStrictEqual({ exerciseId: LEG_PRESS_ID, setNumber: 3 });
  });

  it("should list the leg press set, 3 curls and 4 calf raises as not logged", () => {
    expect(progress.notLogged).toStrictEqual([
      { exerciseId: LEG_PRESS_ID, remaining: 1 },
      { exerciseId: SEATED_LEG_CURL_ID, remaining: 3 },
      { exerciseId: STANDING_CALF_RAISE_ID, remaining: 4 },
    ]);
  });
});

describe("planProgress for the golden Pull day", () => {
  const progress = planProgress(pull, goldenPullSets);

  it("should flag the 2 lat pulldown sets beyond the target of 3 as extra", () => {
    expect(progress.exercises.find((entry) => entry.exerciseId === LAT_PULLDOWN_ID)).toStrictEqual({
      exerciseId: LAT_PULLDOWN_ID,
      planned: 3,
      logged: 5,
      remaining: 0,
      extra: 2,
    });
  });

  it("should count 17 sets against 15 planned, 2 of them extra, and the row warm-up apart", () => {
    expect(progress.logged).toBe(17);
    expect(progress.planned).toBe(15);
    expect(progress.extra).toBe(2);
    expect(progress.warmups).toBe(1);
  });

  it("should have no next set and nothing not logged once every exercise is done", () => {
    expect(progress.nextSet).toBeNull();
    expect(progress.notLogged).toStrictEqual([]);
  });
});

describe("planProgress with a plan", () => {
  it("should start at set 1 of the first exercise with nothing logged", () => {
    const progress = planProgress(legs, []);

    expect(progress.logged).toBe(0);
    expect(progress.nextSet).toStrictEqual({ exerciseId: SQUAT_ID, setNumber: 1 });
    expect(progress.notLogged.map((entry) => entry.remaining)).toStrictEqual([3, 3, 3, 3, 4]);
  });

  it("should never count a warm-up towards a target", () => {
    const progress = planProgress(legs, setsOf(SQUAT_ID, 4, { set_type: "warmup" }));

    expect(progress.logged).toBe(0);
    expect(progress.warmups).toBe(4);
    expect(progress.exercises[0]).toStrictEqual({
      exerciseId: SQUAT_ID,
      planned: 3,
      logged: 0,
      remaining: 3,
      extra: 0,
    });
    expect(progress.nextSet).toStrictEqual({ exerciseId: SQUAT_ID, setNumber: 1 });
  });

  it.each(["working", "drop", "failure"] as const)(
    "should count a %s set towards a target",
    (type) => {
      const progress = planProgress(legs, setsOf(SQUAT_ID, 1, { set_type: type }));

      expect(progress.logged).toBe(1);
      expect(progress.nextSet).toStrictEqual({ exerciseId: SQUAT_ID, setNumber: 2 });
    },
  );

  it("should name the first exercise in plan order that still has sets, even after later ones are done", () => {
    const progress = planProgress(legs, setsOf(STANDING_CALF_RAISE_ID, 4));

    expect(progress.nextSet).toStrictEqual({ exerciseId: SQUAT_ID, setNumber: 1 });
    expect(progress.notLogged.map((entry) => entry.exerciseId)).toStrictEqual([
      SQUAT_ID,
      ROMANIAN_DEADLIFT_ID,
      LEG_PRESS_ID,
      SEATED_LEG_CURL_ID,
    ]);
  });

  it("should leave out a soft-deleted set, so it frees its place", () => {
    const sets = [
      ...setsOf(SQUAT_ID, 2),
      ...setsOf(SQUAT_ID, 1, { deleted_at: "2026-10-19T19:00:00Z" }, 2),
    ];

    const progress = planProgress(legs, sets);

    expect(progress.logged).toBe(2);
    expect(progress.nextSet).toStrictEqual({ exerciseId: SQUAT_ID, setNumber: 3 });
  });

  it("should list an added exercise after the planned ones and count all its sets as extra", () => {
    const progress = planProgress(legs, setsOf(OTHER_EXERCISE_ID, 2));

    expect(progress.exercises.at(-1)).toStrictEqual({
      exerciseId: OTHER_EXERCISE_ID,
      planned: 0,
      logged: 2,
      remaining: 0,
      extra: 2,
    });
    expect(progress.exercises).toHaveLength(6);
    expect(progress.extra).toBe(2);
    expect(progress.logged).toBe(2);
    expect(progress.planned).toBe(16);
  });

  it("should list added exercises in the order they were first logged", () => {
    const sets = [
      ...setsOf(ANOTHER_EXERCISE_ID, 1, {}, 0),
      ...setsOf(OTHER_EXERCISE_ID, 1, {}, 1),
      ...setsOf(ANOTHER_EXERCISE_ID, 1, {}, 2),
    ];

    const progress = planProgress(legs, sets);

    expect(progress.exercises.slice(5).map((entry) => entry.exerciseId)).toStrictEqual([
      ANOTHER_EXERCISE_ID,
      OTHER_EXERCISE_ID,
    ]);
  });

  it("should not list an added exercise that has only warm-ups", () => {
    const progress = planProgress(legs, setsOf(OTHER_EXERCISE_ID, 2, { set_type: "warmup" }));

    expect(progress.exercises).toHaveLength(5);
    expect(progress.warmups).toBe(2);
  });

  it("should add up the targets of an exercise the day plans twice, in its first place", () => {
    const [first, second] = legs.exercises;
    if (first === undefined || second === undefined) {
      throw new Error("The golden Legs day has two exercises");
    }
    const twice = { ...legs, exercises: [first, second, first] };

    const progress = planProgress(twice, setsOf(SQUAT_ID, 4));

    expect(progress.exercises).toStrictEqual([
      { exerciseId: SQUAT_ID, planned: 6, logged: 4, remaining: 2, extra: 0 },
      { exerciseId: ROMANIAN_DEADLIFT_ID, planned: 3, logged: 0, remaining: 3, extra: 0 },
    ]);
    expect(progress.nextSet).toStrictEqual({ exerciseId: SQUAT_ID, setNumber: 5 });
  });

  it("should throw a RangeError that states the rule, and not the value, for a bad time", () => {
    const sets = setsOf(SQUAT_ID, 1, { performed_at: "yesterday evening" });

    expect(() => planProgress(legs, sets)).toThrow(RangeError);
    expect(() => planProgress(legs, sets)).toThrow(/performed_at must be an ISO timestamp/);
    expect(() => planProgress(legs, sets)).not.toThrow(/yesterday/);
  });
});

describe("planProgress for a free session", () => {
  it("should return the totals only", () => {
    const sets = [
      ...setsOf(SQUAT_ID, 3),
      ...setsOf(OTHER_EXERCISE_ID, 2, { set_type: "warmup" }, 3),
    ];

    expect(planProgress(null, sets)).toStrictEqual({
      logged: 3,
      planned: null,
      warmups: 2,
      extra: 0,
      exercises: [],
      nextSet: null,
      notLogged: [],
    });
  });
});

describe("sessionMuscleSets", () => {
  it("should list the golden Legs session as hamstrings 5.5, quads 5, glutes 4, lower back 2.1 and calves 1.6", () => {
    expect(sessionMuscleSets(goldenLegsSets, params.training)).toStrictEqual([
      { muscle: "hamstrings", effectiveSets: 5.5 },
      { muscle: "quads", effectiveSets: 5 },
      { muscle: "glute_max", effectiveSets: 4 },
      { muscle: "lower_back", effectiveSets: 2.1 },
      { muscle: "calves", effectiveSets: 1.6 },
    ]);
  });

  it("should leave out the muscles nothing trained, and every muscle for no sets", () => {
    expect(sessionMuscleSets([], params.training)).toStrictEqual([]);
  });

  it("should count nothing for a warm-up", () => {
    expect(
      sessionMuscleSets(setsOf(SQUAT_ID, 3, { set_type: "warmup" }), params.training),
    ).toStrictEqual([]);
  });

  it("should leave out a soft-deleted set", () => {
    const sets = setsOf(SQUAT_ID, 2, { deleted_at: "2026-10-19T19:00:00Z" });

    expect(sessionMuscleSets(sets, params.training)).toStrictEqual([]);
  });

  it("should weight a set by its muscle weight and its effort, a blank RIR counting as hard", () => {
    const muscles = [
      { muscle_id: "quads", role: "primary", weight: 1 },
      { muscle_id: "calves", role: "stabiliser", weight: 0.2 },
    ] as const;
    const sets = [
      ...setsOf(SQUAT_ID, 2, { muscles, rir: null }),
      ...setsOf(SQUAT_ID, 1, { muscles, rir: 4 }, 2),
    ];

    expect(sessionMuscleSets(sets, params.training)).toStrictEqual([
      { muscle: "quads", effectiveSets: 2.5 },
      { muscle: "calves", effectiveSets: 0.5 },
    ]);
  });

  it("should put muscles with equal sets in the muscle list's order", () => {
    const muscles = [
      { muscle_id: "triceps", role: "primary", weight: 1 },
      { muscle_id: "biceps", role: "primary", weight: 1 },
      { muscle_id: "chest_upper", role: "primary", weight: 1 },
    ] as const;

    expect(sessionMuscleSets(setsOf(SQUAT_ID, 1, { muscles }), params.training)).toStrictEqual([
      { muscle: "chest_upper", effectiveSets: 1 },
      { muscle: "biceps", effectiveSets: 1 },
      { muscle: "triceps", effectiveSets: 1 },
    ]);
  });
});

describe("sessionHeatValues", () => {
  const atLegsEnd = "2026-10-15T18:00:00Z";

  it("should be the heat step of each muscle's own heat from the sets given", () => {
    expect(sessionHeatValues(goldenLegsSets, atLegsEnd, params.training)).toStrictEqual(
      heatValues(muscleState(goldenLegsSets, atLegsEnd, params.training), params.training),
    );
  });

  it("should leave a muscle the session did not train at step 0", () => {
    const steps = sessionHeatValues(goldenLegsSets, atLegsEnd, params.training);

    expect(steps.biceps).toBe(0);
    expect(steps.hamstrings).toBeGreaterThan(0);
  });

  it("should have every muscle at step 0 for no sets", () => {
    expect(
      Object.values(sessionHeatValues([], atLegsEnd, params.training)).every((step) => step === 0),
    ).toBe(true);
  });
});

describe("sessionClock", () => {
  const open = { started_at: "2026-10-15T18:30:00+01:00", ended_at: null };

  it("should count the whole seconds since the start while the session is open", () => {
    expect(sessionClock(open, "2026-10-15T19:00:00+01:00")).toBe(1800);
  });

  it("should read 12 seconds into a session, the canvas's 00:12", () => {
    expect(sessionClock(open, "2026-10-15T18:30:12+01:00")).toBe(12);
  });

  it("should drop the part of a second not yet complete", () => {
    expect(sessionClock(open, "2026-10-15T18:59:59.500+01:00")).toBe(1799);
    expect(sessionClock(open, "2026-10-15T18:30:00.999+01:00")).toBe(0);
  });

  it("should compare moments, not clock readings, across zones", () => {
    expect(sessionClock(open, "2026-10-15T17:45:00Z")).toBe(900);
  });

  it("should run from the start to the end of a finished session and ignore now", () => {
    const finished = { ...open, ended_at: "2026-10-15T19:12:00+01:00" };

    expect(sessionClock(finished, "2026-10-16T09:00:00+01:00")).toBe(2520);
  });

  it("should never be negative, when the clock reads before the start", () => {
    expect(sessionClock(open, "2026-10-15T18:00:00+01:00")).toBe(0);
  });

  it("should never be negative, for a session recorded as ending before it started", () => {
    const backwards = { ...open, ended_at: "2026-10-15T18:00:00+01:00" };

    expect(sessionClock(backwards, "2026-10-15T19:00:00+01:00")).toBe(0);
  });

  it("should throw a RangeError that states the rule, and not the value, for a time without a zone", () => {
    expect(() => sessionClock(open, "2026-10-15 19:00")).toThrow(RangeError);
    expect(() => sessionClock(open, "2026-10-15 19:00")).not.toThrow(/19:00/);
  });
});
