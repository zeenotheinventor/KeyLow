import { describe, expect, it } from "vitest";

import {
  comparison,
  GOLDEN_TIME_ZONE,
  loggedSets,
  params,
  recordOfMuscles,
  routine,
  targeted,
  week,
} from "./goldenWeekInputs";
import { benchPress, heatSet, repeat } from "./heatSets";
import {
  compareWeek,
  GAP_VALUES,
  HEAT_STEP_CUTS_V1,
  LOADED_HEAT_PERCENT,
  gapValues,
  heatStepOf,
  heatValues,
  isReadyHeat,
  MUSCLE_IDS,
  muscleState,
  projectedState,
  projectWeek,
  VOLUME_STATUSES,
  volumeValues,
  warmestMuscles,
  weeklyVolume,
} from "../../src/training";
import { heatPercentOf } from "../../src/training/heatReadout";

import type { LoggedSet, MuscleId, MusclePlanComparison } from "../../src/training";

/** A full record at 0 with the given muscles set, as the canvas strings list only the muscles that glow. */
const withOthersAtZero = (listed: Partial<Record<MuscleId, number>>): Record<MuscleId, number> =>
  recordOfMuscles((muscle) => listed[muscle] ?? 0);

/** Every muscle at no heat, but for the ones given. */
const statesWith = (heatByMuscle: Partial<Record<MuscleId, number>>) =>
  recordOfMuscles((muscle) => ({ heat: heatByMuscle[muscle] ?? 0 }));

describe("HEAT_STEP_CUTS_V1", () => {
  it("should be the rounded percents at which steps 1, 3, 4 and 5 start, and the ready share that step 2 starts above", () => {
    expect(HEAT_STEP_CUTS_V1).toStrictEqual([5, 25, 40, 60, 80]);
  });
});

describe("LOADED_HEAT_PERCENT", () => {
  it("should be the rounded percent where the map reaches its very hot step, 4", () => {
    expect(LOADED_HEAT_PERCENT).toBe(60);
    expect(HEAT_STEP_CUTS_V1[3]).toBe(LOADED_HEAT_PERCENT);
    expect(heatValues(statesWith({ quads: 0.6, calves: 0.59 })).quads).toBe(4);
    expect(heatValues(statesWith({ quads: 0.6, calves: 0.59 })).calves).toBe(3);
  });
});

describe("isReadyHeat", () => {
  it.each([
    [0, true],
    [0.25, true],
    [0.2501, false],
    [1, false],
  ])("should say a heat of %s is ready: %s", (heat, ready) => {
    expect(isReadyHeat("lats", heat)).toBe(ready);
  });
});

describe("heatStepOf", () => {
  it.each([
    [0.044, 0],
    [0.045, 1],
    [0.25, 1],
    [0.2501, 2],
    [0.395, 3],
    [0.595, 4],
    [0.795, 5],
  ])("should put a heat of %s at step %s", (heat, step) => {
    expect(heatStepOf("quads", heat)).toBe(step);
  });

  it("should put a heat that rounds to 25 % at step 2 when it is above the ready share", () => {
    expect(heatPercentOf(0.254)).toBe(25);
    expect(heatStepOf("quads", 0.254)).toBe(2);
  });
});

describe("heatValues", () => {
  it.each([
    [0, 0],
    [0.044, 0],
    [0.045, 1],
    [0.05, 1],
    [0.194, 1],
    [0.195, 1],
    [0.2, 1],
    [0.25, 1],
    [0.2501, 2],
    [0.254, 2],
    [0.255, 2],
    [0.394, 2],
    [0.395, 3],
    [0.4, 3],
    [0.594, 3],
    [0.595, 4],
    [0.6, 4],
    [0.794, 4],
    [0.795, 5],
    [0.8, 5],
    [1, 5],
  ])("should put a heat of %s at step %s", (heat, step) => {
    expect(heatValues(statesWith({ lats: heat })).lats).toBe(step);
  });

  it("should hold every muscle id", () => {
    expect(Object.keys(heatValues(statesWith({}))).sort()).toStrictEqual([...MUSCLE_IDS].sort());
  });

  describe("on the golden week", () => {
    it("should step Thursday 15 October 19:00 Actual as the canvas does", () => {
      const states = muscleState(loggedSets, "2026-10-15T19:00:00+01:00", params.training);

      expect(heatValues(states)).toStrictEqual(
        withOthersAtZero({
          chest_upper: 1,
          chest_lower: 1,
          delt_rear: 1,
          lats: 1,
          traps_mid: 1,
          lower_back: 1,
          biceps: 1,
          triceps: 1,
          glute_max: 3,
          quads: 3,
          hamstrings: 3,
          calves: 1,
        }),
      );
    });

    it("should step Tuesday 13 October 20:00 Actual as the canvas does", () => {
      const states = muscleState(loggedSets, "2026-10-13T20:00:00+01:00", params.training);

      expect(heatValues(states)).toStrictEqual(
        withOthersAtZero({
          chest_upper: 1,
          chest_lower: 1,
          delt_front: 2,
          delt_side: 1,
          delt_rear: 4,
          lats: 5,
          traps_mid: 4,
          biceps: 5,
          triceps: 2,
          forearms: 1,
        }),
      );
    });

    it("should step Sunday 18 October 20:00 Projected as the canvas does", () => {
      const states = projectedState(
        week.projected,
        "2026-10-18T20:00:00+01:00",
        "Europe/London",
        params,
      );

      expect(heatValues(states)).toStrictEqual(
        withOthersAtZero({
          chest_upper: 1,
          chest_lower: 1,
          delt_front: 2,
          delt_side: 1,
          triceps: 2,
          glute_max: 1,
          quads: 1,
          hamstrings: 1,
        }),
      );
    });

    it("should step Sunday 18 October 20:00 Actual as the canvas does", () => {
      const states = muscleState(loggedSets, "2026-10-18T20:00:00+01:00", params.training);

      expect(heatValues(states)).toStrictEqual(
        withOthersAtZero({ glute_max: 1, quads: 1, hamstrings: 1 }),
      );
    });
  });
});

/** A comparison with the sets given for some muscles, the others at 0 sets on plan. */
const comparisonWith = (
  setsByMuscle: Partial<Record<MuscleId, { actual?: number; projected?: number }>>,
): Record<MuscleId, MusclePlanComparison> =>
  recordOfMuscles((muscle) => {
    const { actual = 0, projected = 0 } = setsByMuscle[muscle] ?? {};
    return {
      actualWeeklySets: actual,
      projectedWeeklySets: projected,
      gap: actual - projected,
      status: "on_plan",
    };
  });

const NOT_TRAINED = 0;
const MAINTAINING = 1;
const GROWING = 2;
const PRODUCTIVE = 3;
const HIGH = 4;

describe("volumeValues", () => {
  it("should index the statuses in the order of VOLUME_STATUSES", () => {
    expect(VOLUME_STATUSES.indexOf("not_trained")).toBe(NOT_TRAINED);
    expect(VOLUME_STATUSES.indexOf("maintaining")).toBe(MAINTAINING);
    expect(VOLUME_STATUSES.indexOf("growing")).toBe(GROWING);
    expect(VOLUME_STATUSES.indexOf("productive")).toBe(PRODUCTIVE);
    expect(VOLUME_STATUSES.indexOf("high")).toBe(HIGH);
  });

  // The edges of the five bands, 0, just above 0, just under 4, 4, just under 10, 10, 20 and just above 20.
  it.each([
    [0, NOT_TRAINED],
    [0.25, MAINTAINING],
    [3.99, MAINTAINING],
    [4, GROWING],
    [9.99, GROWING],
    [10, PRODUCTIVE],
    [20, PRODUCTIVE],
    [20.25, HIGH],
  ])(
    "should put %s weekly sets at value %s, for a small, a medium and a large muscle",
    (sets, value) => {
      const values = volumeValues(
        comparisonWith({
          triceps: { actual: sets },
          chest_lower: { actual: sets },
          quads: { actual: sets },
        }),
        "actual",
      );

      expect(values.triceps).toBe(value);
      expect(values.chest_lower).toBe(value);
      expect(values.quads).toBe(value);
    },
  );

  it("should read the actual sets in Actual and the projected sets in Projected", () => {
    const sets = comparisonWith({ triceps: { actual: 2, projected: 12 } });

    expect(volumeValues(sets, "actual").triceps).toBe(MAINTAINING);
    expect(volumeValues(sets, "projected").triceps).toBe(PRODUCTIVE);
  });

  it("should hold every muscle id", () => {
    const values = volumeValues(comparisonWith({}), "projected");

    expect(Object.keys(values).sort()).toStrictEqual([...MUSCLE_IDS].sort());
  });

  describe("on the golden week as of Sunday 18 October", () => {
    it("should give Projected the bands of the volume board", () => {
      expect(volumeValues(comparison, "projected")).toStrictEqual(
        recordOfMuscles((muscle) => {
          switch (muscle) {
            case "triceps":
            case "delt_front":
            case "delt_side":
            case "lats":
              return PRODUCTIVE;
            case "chest_upper":
            case "chest_lower":
            case "biceps":
            case "traps_mid":
            case "delt_rear":
            case "hamstrings":
            case "quads":
            case "glute_max":
              return GROWING;
            case "lower_back":
            case "calves":
            case "forearms":
              return MAINTAINING;
            case "traps_upper":
            case "abs":
            case "obliques":
            case "glute_med":
            case "adductors":
            case "tibialis":
            case "neck":
              return NOT_TRAINED;
          }
        }),
      );
    });

    it("should read a muscle the plan leaves out like any other, by its sets", () => {
      // The plan does not decide a status: only the sets do. Nothing is high in this week.
      const values = volumeValues(comparison, "projected");

      expect(Object.values(values)).not.toContain(HIGH);
      expect(values.traps_upper).toBe(NOT_TRAINED);
    });

    it("should give Actual the bands of the three logged days", () => {
      expect(volumeValues(comparison, "actual")).toStrictEqual(
        recordOfMuscles((muscle) => {
          switch (muscle) {
            case "lats":
              return PRODUCTIVE;
            case "chest_upper":
            case "chest_lower":
            case "delt_front":
            case "delt_side":
            case "delt_rear":
            case "traps_mid":
            case "biceps":
            case "triceps":
            case "glute_max":
            case "quads":
            case "hamstrings":
              return GROWING;
            case "lower_back":
            case "forearms":
            case "calves":
              return MAINTAINING;
            case "traps_upper":
            case "abs":
            case "obliques":
            case "glute_med":
            case "adductors":
            case "tibialis":
            case "neck":
              return NOT_TRAINED;
          }
        }),
      );
    });
  });

  describe("on the week of the clock change (Monday 19 to Sunday 25 October 2026, London)", () => {
    // Twelve bench press sets at 00:30 BST on Monday: the first half hour of a calendar week that
    // is 169 hours long.
    const mondayJustAfterMidnight = "2026-10-18T23:30:00.000Z";
    const mondayId = routine.days.find((day) => day.weekday === 0)?.id ?? "";
    const mondaySets: LoggedSet[] = repeat(
      12,
      heatSet(benchPress, { performed_at: mondayJustAfterMidnight }),
    ).map((set) => ({ ...set, session_id: "monday-session" }));
    const sessions = [
      {
        id: "monday-session",
        local_date: "2026-10-19",
        routine_day_id: mondayId,
        deleted_at: null,
      },
    ];
    const clockChangeWeek = projectWeek(
      routine,
      "2026-10-19",
      GOLDEN_TIME_ZONE,
      { sessions, sets: mondaySets },
      params,
    );
    const clockChangeComparison = compareWeek(
      clockChangeWeek.actual,
      clockChangeWeek.projected,
      params,
    );

    it("should count the calendar week, so a set just after Monday midnight is in it", () => {
      const values = volumeValues(clockChangeComparison, "actual");

      expect(values.chest_lower).toBe(PRODUCTIVE);
      expect(values.chest_upper).toBe(GROWING);
      expect(values.delt_front).toBe(GROWING);
      expect(values.triceps).toBe(GROWING);
    });

    it("should differ from the rolling window, which has already dropped that set by Sunday night", () => {
      const rolling = weeklyVolume(mondaySets, "2026-10-25T23:30:00.000Z", params.training);

      expect(rolling.chest_lower.volumeStatus).toBe("not_trained");
    });
  });
});

const BEHIND = 0;
const ON_PLAN = 1;
const AHEAD = 2;
const NOT_IN_PLAN = 3;

/** A comparison of one muscle with the status and sets given, the others untouched. */
const withStatus = (
  muscle: MuscleId,
  status: MusclePlanComparison["status"],
  sets: { actual: number; projected: number },
): Record<MuscleId, MusclePlanComparison> => ({
  ...comparisonWith({}),
  [muscle]: {
    actualWeeklySets: sets.actual,
    projectedWeeklySets: sets.projected,
    gap: sets.actual - sets.projected,
    status,
  },
});

describe("GAP_VALUES", () => {
  it("should name the four values in order", () => {
    expect(GAP_VALUES).toStrictEqual(["behind", "on_plan", "ahead", "not_in_plan"]);
  });
});

describe("gapValues", () => {
  const allTargeted = new Set<MuscleId>(MUSCLE_IDS);

  it.each([
    ["behind", BEHIND],
    ["on_plan", ON_PLAN],
    ["ahead", AHEAD],
  ] as const)("should give a trained %s muscle the value %s", (status, value) => {
    const gaps = gapValues(withStatus("lats", status, { actual: 4, projected: 8 }), allTargeted);

    expect(gaps.lats).toBe(value);
  });

  it("should call a targeted muscle with nothing planned and nothing done not in plan", () => {
    const gaps = gapValues(withStatus("lats", "on_plan", { actual: 0, projected: 0 }), allTargeted);

    expect(gaps.lats).toBe(NOT_IN_PLAN);
  });

  it("should call a muscle that is not targeted not in plan", () => {
    const gaps = gapValues(
      withStatus("lats", "ahead", { actual: 4, projected: 0 }),
      new Set<MuscleId>(),
    );

    expect(gaps.lats).toBe(NOT_IN_PLAN);
  });

  it("should not call a muscle with something planned and nothing done not in plan", () => {
    const gaps = gapValues(withStatus("lats", "behind", { actual: 0, projected: 6 }), allTargeted);

    expect(gaps.lats).toBe(BEHIND);
  });

  it("should hold every muscle id", () => {
    expect(Object.keys(gapValues(comparisonWith({}), targeted)).sort()).toStrictEqual(
      [...MUSCLE_IDS].sort(),
    );
  });

  it("should make the missed Saturday Push the whole gap on the golden week at Sunday 20:00", () => {
    expect(gapValues(comparison, targeted)).toStrictEqual(
      recordOfMuscles((muscle) => {
        switch (muscle) {
          case "triceps":
          case "delt_front":
          case "delt_side":
          case "chest_upper":
          case "chest_lower":
            return BEHIND;
          case "traps_upper":
          case "abs":
          case "obliques":
          case "glute_med":
          case "adductors":
          case "tibialis":
          case "neck":
            return NOT_IN_PLAN;
          case "delt_rear":
          case "lats":
          case "traps_mid":
          case "lower_back":
          case "biceps":
          case "forearms":
          case "glute_max":
          case "quads":
          case "hamstrings":
          case "calves":
            return ON_PLAN;
        }
      }),
    );
  });
});

describe("warmestMuscles", () => {
  it("should name the warmest three on the golden Thursday at 17:55 as the dashboard card does", () => {
    const states = muscleState(loggedSets, "2026-10-15T17:55:00+01:00", params.training);

    expect(warmestMuscles(states)).toStrictEqual([
      { muscle: "lats", percent: 25 },
      { muscle: "traps_mid", percent: 18 },
      { muscle: "biceps", percent: 15 },
    ]);
  });

  it("should take as many muscles as asked for", () => {
    const states = statesWith({ lats: 0.5, biceps: 0.4, triceps: 0.3, forearms: 0.2 });

    expect(warmestMuscles(states, 2)).toStrictEqual([
      { muscle: "lats", percent: 50 },
      { muscle: "biceps", percent: 40 },
    ]);
  });

  it("should break a tie in the order of the muscle list", () => {
    const states = statesWith({ forearms: 0.3, chest_upper: 0.3, lats: 0.3, biceps: 0.3 });

    expect(warmestMuscles(states).map(({ muscle }) => muscle)).toStrictEqual([
      "chest_upper",
      "lats",
      "biceps",
    ]);
  });

  it("should leave out a muscle with no heat, so fewer than n can come back", () => {
    expect(warmestMuscles(statesWith({ lats: 0.25 }))).toStrictEqual([
      { muscle: "lats", percent: 25 },
    ]);
  });

  it("should leave out a muscle whose heat rounds to 0 %, and keep one that rounds to 1 %", () => {
    expect(warmestMuscles(statesWith({ lats: 0.003, biceps: 0.005 }))).toStrictEqual([
      { muscle: "biceps", percent: 1 },
    ]);
  });

  it("should give an empty list when only muscles that round to 0 % are warm", () => {
    expect(warmestMuscles(statesWith({ lats: 0.003 }))).toStrictEqual([]);
  });

  it("should give an empty list when no muscle has heat", () => {
    expect(warmestMuscles(statesWith({}))).toStrictEqual([]);
  });

  it("should round the percent as the heat steps do", () => {
    expect(warmestMuscles(statesWith({ lats: 0.245 }))[0]?.percent).toBe(25);
  });
});
