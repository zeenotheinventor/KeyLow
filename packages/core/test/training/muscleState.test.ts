import { describe, expect, it } from "vitest";

import { at, benchPress, DAY, heatSet, HOUR, lateralRaise, MORNING, repeat } from "./heatSets";
import {
  MUSCLE_IDS,
  muscleState,
  TRAINING_PARAMS_V1,
  VOLUME_STATUSES,
  volumeStatusOf,
  weeklyVolume,
} from "../../src/training";

import type { SetSnapshotMuscle } from "../../src/schemas";
import type { TrainingParams } from "../../src/training";

const params = TRAINING_PARAMS_V1;

const squat: SetSnapshotMuscle[] = [
  { muscle_id: "quads", role: "primary", weight: 1 },
  { muscle_id: "glute_max", role: "secondary", weight: 0.5 },
];

const triceps: SetSnapshotMuscle[] = [{ muscle_id: "triceps", role: "primary", weight: 1 }];

describe("muscleState", () => {
  it("should give every muscle id, in the order of the list, and nothing else", () => {
    expect(Object.keys(muscleState([], at(MORNING), params))).toEqual([...MUSCLE_IDS]);
  });

  it("should leave every muscle cold, ready now and under volume with no sets", () => {
    for (const state of Object.values(muscleState([], at(MORNING), params))) {
      expect(state).toStrictEqual({
        heat: 0,
        readyAt: at(MORNING),
        weeklySets: 0,
        volumeStatus: "under",
      });
    }
  });

  it("should decay one small muscle's set by e over τ", () => {
    /*
     * One working set of lateral raises, no effort measure, so effort 1. delt_side has weight 1, so
     * s = 1 × 1 = 1. delt_side is small: τ = 24 h, C = 8, θ = 2. Read 24 h later:
     * F = 1 × exp(−24 / 24) = e^−1 = 0.36787944117144233
     * heat = F / C = 0.36787944117144233 / 8 = 0.04598493014643029
     * F is below θ = 2, so readyAt is now.
     */
    const now = MORNING + 24 * HOUR;
    const state = muscleState([heatSet(lateralRaise)], at(now), params).delt_side;

    expect(state.heat).toBeCloseTo(0.04598493014643029, 15);
    expect(state.readyAt).toBe(at(now));
  });

  it("should decay one large muscle's set over its longer τ", () => {
    /*
     * One working set of squats at RIR 2, effort 1. quads has weight 1, so s = 1. quads is large:
     * τ = 40 h, C = 10. Read 40 h later: F = exp(−40 / 40) = 0.36787944117144233, heat = F / 10 =
     * 0.036787944117144235.
     */
    const state = muscleState([heatSet(squat, { rir: 2 })], at(MORNING + 40 * HOUR), params);

    expect(state.quads.heat).toBeCloseTo(0.036787944117144235, 15);
  });

  it("should scale the stimulus by weight and effort", () => {
    /*
     * One working set of bench press at RIR 4, effort 0.5. chest_upper has weight 0.6, so
     * s = 0.6 × 0.5 = 0.3. chest_upper is medium: τ = 32 h, C = 10. Read 32 h later:
     * F = 0.3 × e^−1 = 0.1103638323514327, heat = F / 10 = 0.01103638323514327.
     */
    const state = muscleState([heatSet(benchPress, { rir: 4 })], at(MORNING + 32 * HOUR), params);

    expect(state.chest_upper.heat).toBeCloseTo(0.01103638323514327, 15);
  });

  it("should hold heat at 1 once fatigue passes capacity", () => {
    // Ten sets of lateral raises at once: F = 10 at the moment they land, above C = 8, so heat is 1.
    const state = muscleState(repeat(10, heatSet(lateralRaise)), at(MORNING), params);

    expect(state.delt_side.heat).toBe(1);
  });

  it("should put readyAt where fatigue falls to θ", () => {
    /*
     * Four working sets of lateral raises at 08:00, read at once. F = 4 × 1 = 4, above θ = 2.
     * heat = 4 / 8 = 0.5.
     * readyAt = now + τ × ln(F / θ) = 08:00 + 24 h × ln 2 = 08:00 + 16.635532333438686 h.
     * In milliseconds that is 59,887,916.40037927, rounded up to 59,887,917 = 16 h 38 min 7.917 s,
     * so readyAt is 00:38:07.917 the next day.
     */
    const state = muscleState(repeat(4, heatSet(lateralRaise)), at(MORNING), params).delt_side;

    expect(state.heat).toBe(0.5);
    expect(state.readyAt).toBe("2026-10-19T00:38:07.917Z");
  });

  it("should give the same readyAt whenever it is read before the muscle is ready", () => {
    /*
     * Four working sets of bench press at 08:00, read at 16:00. chest_lower has weight 1, so s = 1;
     * it is medium: τ = 32 h, C = 10, θ = 2.5.
     * F = 4 × exp(−8 / 32) = 3.1152031322856195, heat = 0.31152031322856194.
     * readyAt = 16:00 + 32 h × ln(3.1152 / 2.5), which is the same moment as
     * 08:00 + 32 h × ln(4 / 2.5) = 08:00 + 32 × 0.4700036292457356 h = 08:00 + 15.040116135863538 h,
     * that is 23:02:24.418, rounded up to the next millisecond: 23:02:24.419.
     */
    const sets = repeat(4, heatSet(benchPress));
    const atEight = muscleState(sets, at(MORNING + 8 * HOUR), params).chest_lower;

    expect(atEight.heat).toBeCloseTo(0.31152031322856194, 15);
    expect(atEight.readyAt).toBe("2026-10-18T23:02:24.419Z");
    expect(muscleState(sets, at(MORNING), params).chest_lower.readyAt).toBe(
      "2026-10-18T23:02:24.419Z",
    );
  });

  it("should count weekly sets as the sum of weight times effort", () => {
    /*
     * Bench press: one set at RIR 2 (effort 1) and one at RPE 6 (effort 0.5). chest_upper (weight 0.6)
     * takes 0.6 × 1 + 0.6 × 0.5 = 0.9 sets, chest_lower (weight 1) 1.5, triceps (weight 0.5) 0.75.
     */
    const state = muscleState(
      [heatSet(benchPress, { rir: 2 }), heatSet(benchPress, { rpe: 6 })],
      at(MORNING + HOUR),
      params,
    );

    expect(state.chest_upper.weeklySets).toBe(0.9);
    expect(state.chest_lower.weeklySets).toBe(1.5);
    expect(state.triceps.weeklySets).toBe(0.75);
    expect(state.chest_lower.volumeStatus).toBe("under");
  });

  it("should give each muscle the status of its own landmarks", () => {
    /*
     * Eight working sets of bench press: chest_lower takes 8 × 1 = 8 sets, at medium's MEV of 8, so
     * maintaining; triceps takes 8 × 0.5 = 4, below small's MEV of 6, so under.
     */
    const state = muscleState(repeat(8, heatSet(benchPress)), at(MORNING + HOUR), params);

    expect(state.chest_lower).toMatchObject({ weeklySets: 8, volumeStatus: "maintaining" });
    expect(state.triceps).toMatchObject({ weeklySets: 4, volumeStatus: "under" });
  });

  it("should absorb floating point drift in weekly sets", () => {
    const tenthOfTriceps: SetSnapshotMuscle[] = [
      { muscle_id: "biceps", role: "primary", weight: 1 },
      { muscle_id: "triceps", role: "secondary", weight: 0.1 },
    ];

    const state = muscleState(repeat(60, heatSet(tenthOfTriceps)), at(MORNING + HOUR), params);

    expect(state.triceps).toMatchObject({ weeklySets: 6, volumeStatus: "maintaining" });
  });

  it("should leave out a set exactly fourteen days old from heat and keep one a millisecond younger", () => {
    const set = heatSet(squat);

    expect(muscleState([set], at(MORNING + 14 * DAY), params).quads.heat).toBe(0);
    expect(muscleState([set], at(MORNING + 14 * DAY - 1), params).quads.heat).toBeGreaterThan(0);
  });

  it("should count a set in weekly sets for seven days and not a millisecond longer", () => {
    const set = heatSet(squat);

    expect(muscleState([set], at(MORNING + 7 * DAY - 1), params).quads.weeklySets).toBe(1);
    expect(muscleState([set], at(MORNING + 7 * DAY), params).quads.weeklySets).toBe(0);
  });

  it("should count a set performed at the very moment it is read", () => {
    const state = muscleState([heatSet(triceps)], at(MORNING), params).triceps;

    expect(state).toMatchObject({ heat: 1 / 8, weeklySets: 1 });
  });

  it("should ignore a set after now", () => {
    const state = muscleState(
      [heatSet(triceps, { performed_at: at(MORNING + 1) })],
      at(MORNING),
      params,
    );

    expect(state.triceps).toStrictEqual(muscleState([], at(MORNING), params).triceps);
  });

  it("should ignore a soft-deleted set", () => {
    const deleted = heatSet(triceps, { deleted_at: at(MORNING + HOUR) });

    expect(muscleState([deleted], at(MORNING + 2 * HOUR), params)).toStrictEqual(
      muscleState([], at(MORNING + 2 * HOUR), params),
    );
  });

  it("should ignore a warm-up", () => {
    const warmup = heatSet(triceps, { set_type: "warmup", rir: 0 });

    expect(muscleState([warmup], at(MORNING), params)).toStrictEqual(
      muscleState([], at(MORNING), params),
    );
  });

  it("should read the muscles from each set's own snapshot", () => {
    // The same exercise logged before and after its map was edited: each set keeps its own map.
    const before = heatSet([{ muscle_id: "chest_lower", role: "primary", weight: 1 }]);
    const after = heatSet([
      { muscle_id: "chest_lower", role: "primary", weight: 0.5 },
      { muscle_id: "delt_front", role: "secondary", weight: 0.5 },
    ]);

    const state = muscleState([before, after], at(MORNING + HOUR), params);

    expect(state.chest_lower.weeklySets).toBe(1.5);
    expect(state.delt_front.weeklySets).toBe(0.5);
  });

  it("should give readyAt in UTC whatever offset now was written with", () => {
    expect(muscleState([], "2026-10-18T09:00:00+01:00", params).abs.readyAt).toBe(
      "2026-10-18T08:00:00.000Z",
    );
  });

  it("should use a muscle's override in place of its class", () => {
    /*
     * neck is small (τ = 24 h). With τ overridden to 12 h, one set read 12 h later gives
     * F = e^−1 and heat = e^−1 / 8, the value small muscles reach after 24 h.
     */
    const neck: SetSnapshotMuscle[] = [{ muscle_id: "neck", role: "primary", weight: 1 }];
    const overridden: TrainingParams = { ...params, muscleOverrides: { neck: { tauHours: 12 } } };

    expect(muscleState([heatSet(neck)], at(MORNING + 12 * HOUR), overridden).neck.heat).toBeCloseTo(
      0.04598493014643029,
      15,
    );
  });

  it("should refuse a now that is not a timestamp with a zone", () => {
    for (const now of ["not a time", "2026-10-18", "2026-10-18T08:00:00"]) {
      expect(() => muscleState([], now, params)).toThrow(
        new RangeError("The moment to compute at must be an ISO timestamp with a zone"),
      );
    }
  });

  it("should refuse a set whose performed_at is not a timestamp with a zone", () => {
    expect(() =>
      muscleState([heatSet(triceps, { performed_at: "2026-10-18T08:00:00" })], at(MORNING), params),
    ).toThrow(new RangeError("A set's performed_at must be an ISO timestamp with a zone"));
  });
});

describe("weeklyVolume", () => {
  it("should give the weekly sets and statuses muscleState gives", () => {
    const sets = [
      ...repeat(12, heatSet(benchPress, { rir: 1 })),
      ...repeat(3, heatSet(squat, { performed_at: at(MORNING - 3 * DAY), rpe: 8 })),
    ];
    const state = muscleState(sets, at(MORNING + HOUR), params);

    const volume = weeklyVolume(sets, at(MORNING + HOUR), params);

    expect(Object.keys(volume)).toEqual([...MUSCLE_IDS]);
    for (const muscle of MUSCLE_IDS) {
      expect(volume[muscle]).toStrictEqual({
        weeklySets: state[muscle].weeklySets,
        volumeStatus: state[muscle].volumeStatus,
      });
    }
    expect(volume.chest_lower).toStrictEqual({ weeklySets: 12, volumeStatus: "productive" });
    expect(volume.quads).toStrictEqual({ weeklySets: 3, volumeStatus: "under" });
  });

  it("should count only the seven days up to asOf", () => {
    const sets = [
      heatSet(triceps, { performed_at: at(MORNING - 7 * DAY) }),
      heatSet(triceps, { performed_at: at(MORNING - 6 * DAY) }),
      heatSet(triceps, { performed_at: at(MORNING) }),
      heatSet(triceps, { performed_at: at(MORNING + 1) }),
    ];

    expect(weeklyVolume(sets, at(MORNING), params).triceps.weeklySets).toBe(2);
  });

  it("should refuse an asOf that is not a timestamp with a zone", () => {
    expect(() => weeklyVolume([], "yesterday", params)).toThrow(
      new RangeError("The moment to compute at must be an ISO timestamp with a zone"),
    );
  });
});

describe("volumeStatusOf", () => {
  const { small, medium, large } = params.sizeClasses;

  it.each([
    [0, "under"],
    [5.75, "under"],
    [6, "maintaining"],
    [9.75, "maintaining"],
    [10, "productive"],
    [16, "productive"],
    [16.25, "productive"],
    [22, "productive"],
    [22.25, "over"],
  ] as const)("should call %d small-muscle sets %s", (weeklySets, status) => {
    expect(volumeStatusOf(weeklySets, small)).toBe(status);
  });

  it.each([
    [7.75, "under"],
    [8, "maintaining"],
    [12, "productive"],
    [18, "productive"],
    [22, "productive"],
    [22.25, "over"],
  ] as const)("should call %d medium-muscle sets %s", (weeklySets, status) => {
    expect(volumeStatusOf(weeklySets, medium)).toBe(status);
  });

  it.each([
    [5.75, "under"],
    [6, "maintaining"],
    [10, "productive"],
    [20, "productive"],
    [20.25, "over"],
  ] as const)("should call %d large-muscle sets %s", (weeklySets, status) => {
    expect(volumeStatusOf(weeklySets, large)).toBe(status);
  });

  it("should name the four statuses of ADR 0005 in order", () => {
    expect(VOLUME_STATUSES).toEqual(["under", "maintaining", "productive", "over"]);
  });
});
