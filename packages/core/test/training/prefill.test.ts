import { describe, expect, it } from "vitest";

import { rowId } from "./historyRows";
import { goldenLegsSets, LEG_PRESS_ID, ROMANIAN_DEADLIFT_ID, SQUAT_ID } from "./sessionRows";
import { prefillNextSet, sameAgain } from "../../src/training";

import type { LastPerformanceSet, PrefillSessionSet } from "../../src/training";

const EXERCISE_ID = rowId(1, 1);
const OTHER_EXERCISE_ID = rowId(1, 2);

/** A set of the session, `minute` minutes after 18:00, at position `minute`. */
const sessionSet = (
  minute: number,
  overrides: Partial<PrefillSessionSet> = {},
): PrefillSessionSet => ({
  id: rowId(5, 2000 + minute),
  exercise_id: EXERCISE_ID,
  position: minute,
  set_type: "working",
  reps: 10,
  load_kg: 50,
  rir: 2,
  rpe: null,
  performed_at: `2026-10-19T18:${String(minute).padStart(2, "0")}:00Z`,
  deleted_at: null,
  ...overrides,
});

/** A set of the session before, `minute` minutes after 18:00 on 12 October. */
const lastTimeSet = (
  minute: number,
  overrides: Partial<LastPerformanceSet> = {},
): LastPerformanceSet => ({
  id: rowId(6, 3000 + minute),
  position: minute,
  set_type: "working",
  reps: 8,
  load_kg: 45,
  rir: 3,
  rpe: null,
  performed_at: `2026-10-12T18:${String(minute).padStart(2, "0")}:00Z`,
  deleted_at: null,
  ...overrides,
});

describe("prefillNextSet from this session", () => {
  it("should open leg press set 3 on 180 kg, 11 reps and RIR 1, from the session", () => {
    expect(prefillNextSet(LEG_PRESS_ID, goldenLegsSets, [])).toStrictEqual({
      load_kg: 180,
      reps: 11,
      rir: 1,
      rpe: null,
      set_type: "working",
      source: "session",
    });
  });

  it("should take the last set of the exercise, not the first", () => {
    expect(prefillNextSet(SQUAT_ID, goldenLegsSets, [])).toMatchObject({
      load_kg: 100,
      reps: 6,
      source: "session",
    });
  });

  it("should never take a warm-up as the source, and use the working set before it", () => {
    const sets = [sessionSet(1, { reps: 9 }), sessionSet(2, { set_type: "warmup", reps: 5 })];

    expect(prefillNextSet(EXERCISE_ID, sets, [])).toMatchObject({ reps: 9, source: "session" });
  });

  it("should never take a warm-up as the source, and use last time when only warm-ups were logged", () => {
    const sets = [sessionSet(1, { set_type: "warmup", reps: 5 })];

    expect(prefillNextSet(EXERCISE_ID, sets, [lastTimeSet(1, { reps: 7 })])).toMatchObject({
      reps: 7,
      source: "last_time",
    });
  });

  it.each(["drop", "failure"] as const)(
    "should take a %s set as the source and open as a working set",
    (type) => {
      const prefill = prefillNextSet(EXERCISE_ID, [sessionSet(1, { set_type: type })], []);

      expect(prefill).toMatchObject({ source: "session", set_type: "working" });
    },
  );

  it("should leave out the sets of other exercises", () => {
    const sets = [
      sessionSet(1, { reps: 9 }),
      sessionSet(2, { exercise_id: OTHER_EXERCISE_ID, reps: 4 }),
    ];

    expect(prefillNextSet(EXERCISE_ID, sets, [])).toMatchObject({ reps: 9 });
  });

  it("should leave out a soft-deleted set", () => {
    const sets = [
      sessionSet(1, { reps: 9 }),
      sessionSet(2, { reps: 4, deleted_at: "2026-10-19T19:00:00Z" }),
    ];

    expect(prefillNextSet(EXERCISE_ID, sets, [])).toMatchObject({ reps: 9 });
  });

  it("should order the sets by position first and by time after, wherever they arrive", () => {
    const earlierByPosition = sessionSet(5, { position: 0, reps: 9 });
    const laterByPosition = sessionSet(1, { position: 1, reps: 4 });

    expect(prefillNextSet(EXERCISE_ID, [laterByPosition, earlierByPosition], [])).toMatchObject({
      reps: 4,
    });
  });

  it("should carry an RPE and a blank load as they were", () => {
    const sets = [sessionSet(1, { load_kg: null, rir: null, rpe: 8.5 })];

    expect(prefillNextSet(EXERCISE_ID, sets, [])).toMatchObject({
      load_kg: null,
      rir: null,
      rpe: 8.5,
    });
  });

  it("should carry a blank effort as blank, which counts as hard", () => {
    const sets = [sessionSet(1, { rir: null, rpe: null })];

    expect(prefillNextSet(EXERCISE_ID, sets, [])).toMatchObject({ rir: null, rpe: null });
  });
});

describe("prefillNextSet from last time", () => {
  it("should use the first working set of last time when this session has none of the exercise", () => {
    const lastTime = [
      lastTimeSet(0, { set_type: "warmup", reps: 12, load_kg: 20 }),
      lastTimeSet(1, { reps: 8, load_kg: 45, rir: 3 }),
      lastTimeSet(2, { reps: 7, load_kg: 45, rir: 1 }),
    ];

    expect(prefillNextSet(EXERCISE_ID, [], lastTime)).toStrictEqual({
      load_kg: 45,
      reps: 8,
      rir: 3,
      rpe: null,
      set_type: "working",
      source: "last_time",
    });
  });

  it("should use last time when this session only has sets of other exercises", () => {
    const sets = [sessionSet(1, { exercise_id: OTHER_EXERCISE_ID })];

    expect(prefillNextSet(EXERCISE_ID, sets, [lastTimeSet(1)])).toMatchObject({
      source: "last_time",
    });
  });

  it("should prefer this session to last time", () => {
    expect(prefillNextSet(EXERCISE_ID, [sessionSet(1)], [lastTimeSet(1)])).toMatchObject({
      source: "session",
      reps: 10,
    });
  });

  it("should order last time's sets, wherever they arrive, and leave out a soft-deleted one", () => {
    const lastTime = [
      lastTimeSet(3, { reps: 6 }),
      lastTimeSet(1, { reps: 9, deleted_at: "2026-10-12T19:00:00Z" }),
      lastTimeSet(2, { reps: 8 }),
    ];

    expect(prefillNextSet(EXERCISE_ID, [], lastTime)).toMatchObject({ reps: 8 });
  });

  it("should never take a warm-up from last time", () => {
    expect(prefillNextSet(EXERCISE_ID, [], [lastTimeSet(1, { set_type: "warmup" })])).toStrictEqual(
      {
        load_kg: null,
        reps: null,
        rir: null,
        rpe: null,
        set_type: "working",
        source: "none",
      },
    );
  });
});

describe("prefillNextSet with nothing to go on", () => {
  it("should open blank as a working set, from none", () => {
    expect(prefillNextSet(ROMANIAN_DEADLIFT_ID, [], [])).toStrictEqual({
      load_kg: null,
      reps: null,
      rir: null,
      rpe: null,
      set_type: "working",
      source: "none",
    });
  });
});

describe("prefillNextSet errors", () => {
  it("should throw a RangeError that states the rule, and not the value, for a bad time", () => {
    const sets = [sessionSet(1, { performed_at: "last night" })];

    expect(() => prefillNextSet(EXERCISE_ID, sets, [])).toThrow(RangeError);
    expect(() => prefillNextSet(EXERCISE_ID, sets, [])).toThrow(
      /performed_at must be an ISO timestamp/,
    );
    expect(() => prefillNextSet(EXERCISE_ID, sets, [])).not.toThrow(/night/);
  });
});

describe("sameAgain", () => {
  it("should repeat a set exactly, as the cleaned numbers of a draft", () => {
    expect(sameAgain(sessionSet(1, { reps: 11, load_kg: 180, rir: 1 }))).toStrictEqual({
      setType: "working",
      loadKg: 180,
      reps: 11,
      rir: 1,
      rpe: null,
    });
  });

  it("should keep the set type, a blank load and an RPE", () => {
    const set = sessionSet(1, { set_type: "drop", load_kg: null, rir: null, rpe: 7.5 });

    expect(sameAgain(set)).toStrictEqual({
      setType: "drop",
      loadKg: null,
      reps: 10,
      rir: null,
      rpe: 7.5,
    });
  });

  it("should repeat what a prefill opened with", () => {
    const prefill = prefillNextSet(LEG_PRESS_ID, goldenLegsSets, []);
    if (prefill.source === "none") {
      throw new Error("The golden session has a leg press set to repeat");
    }

    expect(sameAgain(prefill)).toStrictEqual({
      setType: "working",
      loadKg: 180,
      reps: 11,
      rir: 1,
      rpe: null,
    });
  });
});
