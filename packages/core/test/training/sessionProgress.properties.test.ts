import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { params } from "./goldenWeekInputs";
import { rowId, setRow } from "./historyRows";
import {
  planProgress,
  prefillNextSet,
  SET_TYPES,
  sessionClock,
  sessionMuscleSets,
} from "../../src/training";

import type { HistorySet, SessionScaffold } from "../../src/training";

const EXERCISE_IDS = [rowId(1, 1), rowId(1, 2), rowId(1, 3), rowId(1, 4)];
const MUSCLES = ["quads", "hamstrings", "glute_max", "calves"] as const;

const scaffold: SessionScaffold = {
  routine_day_id: rowId(3, 1),
  exercises: [rowId(1, 1), rowId(1, 2), rowId(1, 3)].map((exercise_id, index) => ({
    exercise_id,
    slots: index + 1,
    rep_min: 5,
    rep_max: 8,
    target_rir: null,
  })),
};

/** A set of any exercise, type and effort, so ties of position and moment turn up often. */
const anySet = fc
  .record({
    exercise: fc.constantFrom(...EXERCISE_IDS),
    set_type: fc.constantFrom(...SET_TYPES),
    position: fc.integer({ min: 0, max: 3 }),
    minute: fc.integer({ min: 0, max: 3 }),
    deleted: fc.boolean(),
    muscle: fc.constantFrom(...MUSCLES),
    rir: fc.constantFrom(null, 0, 4, 6),
    reps: fc.integer({ min: 1, max: 20 }),
  })
  .map(({ exercise, set_type, position, minute, deleted, muscle, rir, reps }) => ({
    ...setRow({
      exercise_id: exercise,
      set_type,
      position,
      rir,
      performed_at: `2026-10-19T18:0${minute}:00Z`,
      deleted_at: deleted ? "2026-10-20T10:00:00Z" : null,
      muscles: [{ muscle_id: muscle, role: "primary", weight: 1 }],
    }),
    reps,
    load_kg: reps * 2.5,
  }));

/** Gives each generated set its own id, as the sets of one session have. */
const withIds = <Row extends HistorySet>(rows: readonly Row[]): Row[] =>
  rows.map((row, index) => ({ ...row, id: rowId(5, index) }));

const sessionSets = fc.array(anySet, { maxLength: 20 }).map(withIds);

/** Sorts by random keys, which is a shuffle that fast-check can replay and shrink. */
const shuffledBy = <Item>(items: readonly Item[], keys: readonly number[]): Item[] =>
  items
    .map((item, index) => ({ item, key: keys[index] ?? 0 }))
    .sort((first, second) => first.key - second.key)
    .map(({ item }) => item);

const keysFor = (length: number) => fc.array(fc.nat(), { minLength: length, maxLength: length });

describe("planProgress, properties", () => {
  it("should give the same progress whatever order the sets arrive in", () => {
    fc.assert(
      fc.property(sessionSets, keysFor(20), (sets, keys) => {
        expect(planProgress(scaffold, shuffledBy(sets, keys))).toStrictEqual(
          planProgress(scaffold, sets),
        );
      }),
    );
  });

  it("should add up: the exercises' logged and extra sets make the totals, and a target is met or left", () => {
    fc.assert(
      fc.property(sessionSets, (sets) => {
        const progress = planProgress(scaffold, sets);

        expect(progress.exercises.reduce((total, entry) => total + entry.logged, 0)).toBe(
          progress.logged,
        );
        expect(progress.exercises.reduce((total, entry) => total + entry.extra, 0)).toBe(
          progress.extra,
        );
        for (const entry of progress.exercises) {
          expect(entry.logged - entry.extra + entry.remaining).toBe(entry.planned);
        }
        expect(progress.notLogged.map((entry) => entry.exerciseId)).toStrictEqual(
          progress.exercises
            .filter((entry) => entry.remaining > 0)
            .map((entry) => entry.exerciseId),
        );
      }),
    );
  });

  it("should count the same working sets with the warm-ups taken out", () => {
    fc.assert(
      fc.property(sessionSets, (sets) => {
        const withoutWarmups = sets.filter((set) => set.set_type !== "warmup");

        const progress = planProgress(scaffold, sets);
        const stripped = planProgress(scaffold, withoutWarmups);

        expect({ ...progress, warmups: 0 }).toStrictEqual({ ...stripped, warmups: 0 });
      }),
    );
  });
});

describe("sessionMuscleSets, properties", () => {
  it("should give the same list whatever order the sets arrive in", () => {
    fc.assert(
      fc.property(sessionSets, keysFor(20), (sets, keys) => {
        expect(sessionMuscleSets(shuffledBy(sets, keys), params.training)).toStrictEqual(
          sessionMuscleSets(sets, params.training),
        );
      }),
    );
  });

  it("should list the muscles from the most sets to the fewest, with none at zero", () => {
    fc.assert(
      fc.property(sessionSets, (sets) => {
        const listed = sessionMuscleSets(sets, params.training);

        expect(listed.every((entry) => entry.effectiveSets > 0)).toBe(true);
        listed.slice(1).forEach((entry, index) => {
          expect((listed[index]?.effectiveSets ?? 0) >= entry.effectiveSets).toBe(true);
        });
      }),
    );
  });
});

describe("prefillNextSet, properties", () => {
  it("should open the same whatever order the sets of either source arrive in", () => {
    fc.assert(
      fc.property(
        sessionSets,
        sessionSets,
        keysFor(20),
        keysFor(20),
        fc.constantFrom(...EXERCISE_IDS),
        (sets, lastTime, sessionKeys, lastTimeKeys, exerciseId) => {
          const earlier = lastTime.map((set, index) => ({ ...set, id: rowId(6, index) }));

          expect(
            prefillNextSet(
              exerciseId,
              shuffledBy(sets, sessionKeys),
              shuffledBy(earlier, lastTimeKeys),
            ),
          ).toStrictEqual(prefillNextSet(exerciseId, sets, earlier));
        },
      ),
    );
  });

  it("should open on the values of a set that is not a warm-up, or blank", () => {
    fc.assert(
      fc.property(sessionSets, fc.constantFrom(...EXERCISE_IDS), (sets, exerciseId) => {
        const prefill = prefillNextSet(exerciseId, sets, []);
        const sources = sets.filter(
          (set) =>
            set.exercise_id === exerciseId && set.deleted_at === null && set.set_type !== "warmup",
        );

        expect(prefill.set_type).toBe("working");
        expect(prefill.source).toBe(sources.length > 0 ? "session" : "none");
      }),
    );
  });
});

describe("sessionClock, properties", () => {
  const instant = fc
    .integer({ min: 0, max: 4_000_000_000_000 })
    .map((ms) => new Date(ms).toISOString());

  it("should never be negative or fractional, whichever way round the times are", () => {
    fc.assert(
      fc.property(
        instant,
        instant,
        fc.option(instant, { nil: null }),
        (startedAt, now, endedAt) => {
          const minutes = sessionClock({ started_at: startedAt, ended_at: endedAt }, now);

          expect(minutes).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(minutes)).toBe(true);
        },
      ),
    );
  });
});
