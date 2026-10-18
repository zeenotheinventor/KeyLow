import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { at, DAY, MORNING } from "./heatSets";
import {
  MUSCLE_IDS,
  MUSCLE_ROLES,
  muscleState,
  SET_TYPES,
  TRAINING_PARAMS_V1,
  weeklyVolume,
} from "../../src/training";

import type { SetSnapshotMuscle } from "../../src/schemas";
import type { HeatSet } from "../../src/training";

const params = TRAINING_PARAMS_V1;
const NOW = MORNING;

const muscleMap: fc.Arbitrary<SetSnapshotMuscle[]> = fc
  .uniqueArray(fc.constantFrom(...MUSCLE_IDS), { minLength: 1, maxLength: 4 })
  .chain((muscles) =>
    fc.tuple(
      ...muscles.map((muscle_id) =>
        fc.record({
          muscle_id: fc.constant(muscle_id),
          role: fc.constantFrom(...MUSCLE_ROLES),
          weight: fc.double({ min: 0.05, max: 1, noNaN: true }),
        }),
      ),
    ),
  );

const effortMeasure = fc.oneof(
  fc.record({ rir: fc.constant(null), rpe: fc.constant(null) }),
  fc.record({ rir: fc.integer({ min: 0, max: 10 }), rpe: fc.constant(null) }),
  fc.record({
    rir: fc.constant(null),
    rpe: fc.integer({ min: 2, max: 20 }).map((half) => half / 2),
  }),
);

/** A set performed between `minAgo` and `maxAgo` milliseconds before `NOW`. */
const setBefore = (
  minAgo: number,
  maxAgo: number,
  setType: fc.Arbitrary<HeatSet["set_type"]> = fc.constantFrom(...SET_TYPES),
): fc.Arbitrary<HeatSet> =>
  fc
    .record({
      set_type: setType,
      measure: effortMeasure,
      ago: fc.integer({ min: minAgo, max: maxAgo }),
      deleted: fc.boolean(),
      muscles: muscleMap,
    })
    .map(({ set_type, measure, ago, deleted, muscles }) => ({
      set_type,
      ...measure,
      performed_at: at(NOW - ago),
      deleted_at: deleted ? at(NOW) : null,
      snapshot: { muscles },
    }));

/** Sets from up to twenty days before `NOW` up to `NOW` itself, a few of them deleted. */
const recentSets = fc.array(setBefore(0, 20 * DAY), { maxLength: 30 });

describe("muscleState properties", () => {
  it("should never raise heat as time passes without a new set", () => {
    fc.assert(
      fc.property(recentSets, fc.integer({ min: 0, max: 20 * DAY }), (sets, later) => {
        const before = muscleState(sets, at(NOW), params);
        const after = muscleState(sets, at(NOW + later), params);
        for (const muscle of MUSCLE_IDS) {
          expect(after[muscle].heat).toBeLessThanOrEqual(before[muscle].heat);
          expect(after[muscle].weeklySets).toBeLessThanOrEqual(before[muscle].weeklySets);
        }
      }),
    );
  });

  it("should never make a muscle ready sooner for more volume", () => {
    fc.assert(
      fc.property(recentSets, recentSets, (sets, more) => {
        const fewer = muscleState(sets, at(NOW), params);
        const extra = muscleState([...sets, ...more], at(NOW), params);
        for (const muscle of MUSCLE_IDS) {
          expect(Date.parse(extra[muscle].readyAt)).toBeGreaterThanOrEqual(
            Date.parse(fewer[muscle].readyAt),
          );
          expect(extra[muscle].heat).toBeGreaterThanOrEqual(fewer[muscle].heat);
          expect(extra[muscle].weeklySets).toBeGreaterThanOrEqual(fewer[muscle].weeklySets);
        }
      }),
    );
  });

  it("should add nothing for a warm-up", () => {
    const warmups = fc.array(setBefore(0, 20 * DAY, fc.constant("warmup")), {
      minLength: 1,
      maxLength: 10,
    });
    fc.assert(
      fc.property(recentSets, warmups, (sets, added) => {
        expect(muscleState([...sets, ...added], at(NOW), params)).toStrictEqual(
          muscleState(sets, at(NOW), params),
        );
      }),
    );
  });

  it("should give heat 0 to every muscle with no set in fourteen days", () => {
    const oldSets = fc.array(setBefore(14 * DAY, 60 * DAY), { maxLength: 30 });
    fc.assert(
      fc.property(oldSets, (sets) => {
        for (const state of Object.values(muscleState(sets, at(NOW), params))) {
          expect(state.heat).toBe(0);
          expect(state.readyAt).toBe(at(NOW));
          expect(state.weeklySets).toBe(0);
        }
      }),
    );
  });

  it("should give heat 0 to a muscle that no live set of the last fourteen days trained", () => {
    fc.assert(
      fc.property(recentSets, (sets) => {
        const state = muscleState(sets, at(NOW), params);
        const trained = new Set(
          sets
            .filter(
              (set) =>
                set.deleted_at === null &&
                set.set_type !== "warmup" &&
                Date.parse(set.performed_at) > NOW - 14 * DAY,
            )
            .flatMap((set) => set.snapshot.muscles.map((muscle) => muscle.muscle_id)),
        );
        for (const muscle of MUSCLE_IDS.filter((id) => !trained.has(id))) {
          expect(state[muscle].heat).toBe(0);
        }
      }),
    );
  });

  it("should give the same result whatever order the sets come in", () => {
    // Many sets, so most muscles sum enough terms for the order of addition to matter.
    const manySets = fc.array(setBefore(0, 20 * DAY), { minLength: 20, maxLength: 60 });
    const setsInTwoOrders = manySets.chain((sets) =>
      fc.tuple(
        fc.constant(sets),
        fc.shuffledSubarray(sets, { minLength: sets.length, maxLength: sets.length }),
      ),
    );
    fc.assert(
      fc.property(setsInTwoOrders, ([sets, shuffled]) => {
        expect(muscleState(shuffled, at(NOW), params)).toStrictEqual(
          muscleState(sets, at(NOW), params),
        );
      }),
    );
  });

  it("should keep heat between 0 and 1 and readyAt no earlier than now", () => {
    fc.assert(
      fc.property(recentSets, (sets) => {
        for (const state of Object.values(muscleState(sets, at(NOW), params))) {
          expect(state.heat).toBeGreaterThanOrEqual(0);
          expect(state.heat).toBeLessThanOrEqual(1);
          expect(Date.parse(state.readyAt)).toBeGreaterThanOrEqual(NOW);
        }
      }),
    );
  });

  it("should ignore every set after now", () => {
    const futureSets = fc.array(setBefore(-20 * DAY, -1), { minLength: 1, maxLength: 10 });
    fc.assert(
      fc.property(recentSets, futureSets, (sets, future) => {
        expect(muscleState([...sets, ...future], at(NOW), params)).toStrictEqual(
          muscleState(sets, at(NOW), params),
        );
      }),
    );
  });

  it("should agree with weeklyVolume on every muscle's weekly sets and status", () => {
    fc.assert(
      fc.property(recentSets, (sets) => {
        const state = muscleState(sets, at(NOW), params);
        const volume = weeklyVolume(sets, at(NOW), params);
        for (const muscle of MUSCLE_IDS) {
          expect(volume[muscle]).toStrictEqual({
            weeklySets: state[muscle].weeklySets,
            volumeStatus: state[muscle].volumeStatus,
          });
        }
      }),
    );
  });
});
