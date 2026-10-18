import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  actualStateAt,
  comparison,
  loggedSets,
  params,
  routine,
  sessionDayNames,
  THURSDAY_EVENING,
  GOLDEN_TIME_ZONE,
} from "./goldenWeekInputs";
import { bench, dayId, planExercise } from "./plans";
import { muscleIdSchema } from "../../src/schemas";
import { MUSCLE_IDS, muscleDetail } from "../../src/training";

import type { MuscleDetailInput, MuscleDetailSet, MuscleId } from "../../src/training";

const NOW = "2026-10-15T18:00:00.000Z";
const LONDON = "Europe/London";
const MILLISECONDS_PER_HOUR = 3_600_000;
const MILLISECONDS_PER_DAY = 24 * MILLISECONDS_PER_HOUR;

const hoursBefore = (hours: number): string =>
  new Date(Date.parse(NOW) - hours * MILLISECONDS_PER_HOUR).toISOString();

const stateSchema = z.record(muscleIdSchema, z.object({ heat: z.number(), readyAt: z.string() }));
const comparisonSchema = z.record(
  muscleIdSchema,
  z.object({ actualWeeklySets: z.number(), projectedWeeklySets: z.number() }),
);

type StateOverrides = Partial<Record<MuscleId, { heat: number; readyAt: string }>>;
type ComparisonOverrides = Partial<
  Record<MuscleId, { actualWeeklySets: number; projectedWeeklySets: number }>
>;

const syntheticState = (overrides: StateOverrides) =>
  stateSchema.parse(
    Object.fromEntries(
      MUSCLE_IDS.map((muscle) => [muscle, overrides[muscle] ?? { heat: 0, readyAt: NOW }]),
    ),
  );

const syntheticComparison = (overrides: ComparisonOverrides) =>
  comparisonSchema.parse(
    Object.fromEntries(
      MUSCLE_IDS.map((muscle) => [
        muscle,
        overrides[muscle] ?? { actualWeeklySets: 0, projectedWeeklySets: 0 },
      ]),
    ),
  );

/** A synthetic sheet for the side delts at `NOW`, with no sets, no sessions and no plan. */
const syntheticInput = (overrides: Partial<MuscleDetailInput> = {}): MuscleDetailInput => ({
  muscle: "delt_side",
  state: syntheticState({}),
  comparison: syntheticComparison({}),
  sets: [],
  sessions: [],
  targeted: { routine: null },
  view: "actual",
  now: NOW,
  tz: LONDON,
  params,
  ...overrides,
});

type SyntheticSet = {
  at: string;
  exercise?: string;
  session?: string;
  muscles?: { muscle_id: MuscleId; weight: number }[];
  setType?: MuscleDetailSet["set_type"];
  deleted?: boolean;
};

/** A working set at full effort that trains the side delts at weight 1, unless said otherwise. */
const syntheticSet = ({
  at,
  exercise = "lateral-raise",
  session = "session-1",
  muscles = [{ muscle_id: "delt_side", weight: 1 }],
  setType = "working",
  deleted = false,
}: SyntheticSet): MuscleDetailSet => ({
  session_id: session,
  set_type: setType,
  rir: null,
  rpe: null,
  performed_at: at,
  deleted_at: deleted ? NOW : null,
  snapshot: {
    ref: exercise,
    name: `Name of ${exercise}`,
    muscles: muscles.map(({ muscle_id, weight }) => ({ muscle_id, role: "primary", weight })),
  },
});

const goldenInput = (muscle: MuscleId, overrides: Partial<MuscleDetailInput> = {}) =>
  muscleDetail({
    muscle,
    state: actualStateAt(THURSDAY_EVENING),
    comparison,
    sets: loggedSets,
    sessions: sessionDayNames,
    targeted: { routine },
    view: "actual",
    now: THURSDAY_EVENING,
    tz: GOLDEN_TIME_ZONE,
    params,
    ...overrides,
  });

describe("muscleDetail on the golden week, Thursday 15 October 19:00", () => {
  describe("the side delts, as the muscle sheet board draws them", () => {
    const detail = goldenInput("delt_side");

    it("should read 3 percent heat in step 0 and ready now", () => {
      expect(detail.heatPercent).toBe(3);
      expect(detail.heatStep).toBe(0);
      expect(detail.readyInHours).toBe(0);
    });

    it("should read 5.5 sets done against 11 planned, both below the minimum and inside the target", () => {
      expect(detail.weeklySets).toMatchObject({
        actual: 5.5,
        planned: 11,
        actualPosition: "below",
        plannedPosition: "inside",
      });
    });

    it("should give the target of 10 to 16 with a minimum of 6 and a maximum of 22", () => {
      expect(detail.weeklySets.target).toStrictEqual({
        mev: 6,
        mav: { low: 10, high: 16 },
        mrv: 22,
      });
    });

    it("should be under the minimum so far", () => {
      expect(detail.weeklySets.volumeStatus).toBe("under");
    });

    it("should be targeted by the routine and not by a goal", () => {
      expect(detail.targeting).toStrictEqual({
        targeted: true,
        routineTrains: true,
        goalRanks: false,
      });
    });

    it("should have last been trained on Monday 12 October in Push, by lateral raises and the press", () => {
      expect(detail.lastTrained).toStrictEqual({
        localDate: "2026-10-12",
        sessionId: "00000004-0000-4000-8000-000000000001",
        routineDayName: "Push",
        exercises: [
          {
            exerciseId: "00000001-0000-4000-8000-000000000004",
            name: "Side Lateral Raise",
            sets: 4,
          },
          {
            exerciseId: "00000001-0000-4000-8000-000000000003",
            name: "Seated Barbell Military Press",
            sets: 3,
          },
        ],
      });
    });
  });

  describe("the abs, as the not targeted board draws them", () => {
    const detail = goldenInput("abs");

    it("should read 0 percent heat in step 0 with 0 sets this week", () => {
      expect(detail.heatPercent).toBe(0);
      expect(detail.heatStep).toBe(0);
      expect(detail.weeklySets).toMatchObject({ actual: 0, planned: 0 });
    });

    it("should be not targeted, and neither the routine nor a goal is the reason", () => {
      expect(detail.targeting).toStrictEqual({
        targeted: false,
        routineTrains: false,
        goalRanks: false,
      });
      expect(detail.weeklySets.volumeStatus).toBe("not_targeted");
    });

    it("should have no last trained entry", () => {
      expect(detail.lastTrained).toBeNull();
    });
  });

  it.each([
    ["hamstrings", 55, 3, 31],
    ["quads", 50, 3, 27],
    ["glute_max", 40, 3, 19],
  ] as const)(
    "should read %s at %d percent, step %d, ready in %d hours",
    (muscle, percent, step, hours) => {
      const detail = goldenInput(muscle);

      expect(detail.heatPercent).toBe(percent);
      expect(detail.heatStep).toBe(step);
      expect(detail.readyInHours).toBe(hours);
    },
  );

  it("should give the legs their own last session, Thursday's unfinished Legs", () => {
    const detail = goldenInput("hamstrings");

    expect(detail.lastTrained).toMatchObject({
      localDate: "2026-10-15",
      sessionId: "00000004-0000-4000-8000-000000000003",
      routineDayName: "Legs",
    });
  });

  it("should not call a muscle trained by the routine when its map lists it at weight 0", () => {
    const pressWithNoSideDelts = planExercise(
      bench,
      [
        { muscle_id: "chest_lower", role: "primary", weight: 1 },
        { muscle_id: "delt_side", role: "secondary", weight: 0 },
      ],
      3,
      2,
      0,
    );
    const detail = goldenInput("delt_side", {
      targeted: {
        routine: {
          days: [{ id: dayId(1), position: 0, weekday: 0, exercises: [pressWithNoSideDelts] }],
        },
      },
    });

    expect(detail.targeting).toStrictEqual({
      targeted: false,
      routineTrains: false,
      goalRanks: false,
    });
  });

  it("should name the goal as the reason a muscle is targeted when the routine does not train it", () => {
    const detail = goldenInput("abs", { targeted: { routine, priority: { abs: 0.5 } } });

    expect(detail.targeting).toStrictEqual({
      targeted: true,
      routineTrains: false,
      goalRanks: true,
    });
  });
});

describe("muscleDetail, the view", () => {
  it("should judge the volume status on the actual figure in the actual view and the planned one in the projected view", () => {
    const actual = goldenInput("delt_side", { view: "actual" });
    const projected = goldenInput("delt_side", { view: "projected" });

    expect(actual.weeklySets.volumeStatus).toBe("under");
    expect(projected.weeklySets.volumeStatus).toBe("productive");
  });

  it("should never change the actual figure, the planned figure or the heat", () => {
    const actual = goldenInput("delt_side", { view: "actual" });
    const projected = goldenInput("delt_side", { view: "projected" });

    expect(projected.weeklySets.actual).toBe(actual.weeklySets.actual);
    expect(projected.weeklySets.planned).toBe(actual.weeklySets.planned);
    expect(projected.heatPercent).toBe(actual.heatPercent);
    expect(projected.lastTrained).toStrictEqual(actual.lastTrained);
  });

  it("should leave a muscle that is not targeted not targeted in either view", () => {
    expect(goldenInput("abs", { view: "projected" }).weeklySets.volumeStatus).toBe("not_targeted");
  });
});

describe("muscleDetail, sets this week", () => {
  it("should read the calendar week of the comparison and not the rolling weekly sets of the state", () => {
    const detail = muscleDetail(
      syntheticInput({
        state: syntheticState({ delt_side: { heat: 0, readyAt: NOW } }),
        comparison: syntheticComparison({
          delt_side: { actualWeeklySets: 5.5, projectedWeeklySets: 11 },
        }),
      }),
    );

    expect(detail.weeklySets).toMatchObject({ actual: 5.5, planned: 11 });
  });

  it.each([
    [9.5, "below"],
    [10, "inside"],
    [16, "inside"],
    [16.5, "above"],
  ] as const)("should place %d sets %s the target of 10 to 16", (sets, position) => {
    const detail = muscleDetail(
      syntheticInput({
        comparison: syntheticComparison({
          delt_side: { actualWeeklySets: sets, projectedWeeklySets: sets },
        }),
      }),
    );

    expect(detail.weeklySets.actualPosition).toBe(position);
    expect(detail.weeklySets.plannedPosition).toBe(position);
  });

  it.each([
    [5.9, "under"],
    [6, "maintaining"],
    [10, "productive"],
    [22, "productive"],
    [22.5, "over"],
  ] as const)("should call %d sets %s for a targeted muscle", (sets, status) => {
    const detail = muscleDetail(
      syntheticInput({
        comparison: syntheticComparison({
          delt_side: { actualWeeklySets: sets, projectedWeeklySets: sets },
        }),
      }),
    );

    expect(detail.weeklySets.volumeStatus).toBe(status);
  });

  it("should keep the real status of a muscle that is not targeted once it reaches its minimum", () => {
    const detail = muscleDetail(
      syntheticInput({
        muscle: "abs",
        targeted: { routine },
        comparison: syntheticComparison({
          abs: { actualWeeklySets: 7, projectedWeeklySets: 7 },
        }),
      }),
    );

    expect(detail.targeting.targeted).toBe(false);
    expect(detail.weeklySets.volumeStatus).toBe("maintaining");
  });
});

describe("muscleDetail, ready in", () => {
  it("should round the hours to the nearest whole hour", () => {
    const detail = muscleDetail(
      syntheticInput({
        state: syntheticState({
          delt_side: {
            heat: 0.5,
            readyAt: new Date(Date.parse(NOW) + 27.49 * MILLISECONDS_PER_HOUR).toISOString(),
          },
        }),
      }),
    );

    expect(detail.readyInHours).toBe(27);
  });
});

describe("muscleDetail, last trained", () => {
  it("should be null when no set trained the muscle", () => {
    expect(muscleDetail(syntheticInput()).lastTrained).toBeNull();
  });

  it("should be null for a muscle trained only by a warm-up", () => {
    const detail = muscleDetail(
      syntheticInput({ sets: [syntheticSet({ at: hoursBefore(30), setType: "warmup" })] }),
    );

    expect(detail.lastTrained).toBeNull();
  });

  it("should leave a warm-up out of the set counts and the day", () => {
    const detail = muscleDetail(
      syntheticInput({
        sets: [
          syntheticSet({ at: hoursBefore(30), setType: "warmup", exercise: "warm-up-only" }),
          syntheticSet({ at: hoursBefore(54) }),
          syntheticSet({ at: hoursBefore(54), setType: "warmup" }),
          syntheticSet({ at: hoursBefore(54) }),
        ],
      }),
    );

    expect(detail.lastTrained?.exercises).toStrictEqual([
      { exerciseId: "lateral-raise", name: "Name of lateral-raise", sets: 2 },
    ]);
  });

  it("should leave out a deleted set, a set after now and a set that did not work the muscle", () => {
    // Each left out set is newer than the one that counts and has its own exercise and session, so
    // counting any of them would change the day, the session or the exercises.
    const detail = muscleDetail(
      syntheticInput({
        sets: [
          syntheticSet({ at: hoursBefore(80) }),
          syntheticSet({
            at: hoursBefore(10),
            deleted: true,
            exercise: "deleted-raise",
            session: "session-deleted",
          }),
          syntheticSet({
            at: hoursBefore(-5),
            exercise: "future-raise",
            session: "session-future",
          }),
          syntheticSet({
            at: hoursBefore(20),
            exercise: "curl",
            session: "session-curl",
            muscles: [{ muscle_id: "biceps", weight: 1 }],
          }),
        ],
      }),
    );

    expect(detail.lastTrained).toStrictEqual({
      localDate: "2026-10-12",
      sessionId: "session-1",
      routineDayName: null,
      exercises: [{ exerciseId: "lateral-raise", name: "Name of lateral-raise", sets: 1 }],
    });
  });

  it("should count a set at a weight above 0 and leave a set at no weight", () => {
    expect(
      muscleDetail(
        syntheticInput({
          sets: [
            syntheticSet({
              at: hoursBefore(5),
              muscles: [{ muscle_id: "delt_side", weight: 0.3 }],
            }),
          ],
        }),
      ).lastTrained?.exercises,
    ).toHaveLength(1);
    expect(
      muscleDetail(
        syntheticInput({
          sets: [
            syntheticSet({ at: hoursBefore(5), muscles: [{ muscle_id: "delt_side", weight: 0 }] }),
          ],
        }),
      ).lastTrained,
    ).toBeNull();
  });

  it("should take the newest day, whatever order the sets come in", () => {
    const detail = muscleDetail(
      syntheticInput({
        sets: [
          syntheticSet({ at: hoursBefore(100), exercise: "older", session: "session-old" }),
          syntheticSet({ at: hoursBefore(60), exercise: "newer", session: "session-new" }),
        ],
      }),
    );

    expect(detail.lastTrained).toMatchObject({
      localDate: "2026-10-13",
      sessionId: "session-new",
    });
    expect(detail.lastTrained?.exercises.map(({ exerciseId }) => exerciseId)).toStrictEqual([
      "newer",
    ]);
  });

  it("should put the exercise with the most sets first and break a tie by name", () => {
    const detail = muscleDetail(
      syntheticInput({
        sets: [
          syntheticSet({ at: hoursBefore(30), exercise: "b-fly" }),
          syntheticSet({ at: hoursBefore(30), exercise: "a-press" }),
          syntheticSet({ at: hoursBefore(31), exercise: "c-raise" }),
          syntheticSet({ at: hoursBefore(31), exercise: "c-raise" }),
        ],
      }),
    );

    expect(
      detail.lastTrained?.exercises.map(({ exerciseId, sets }) => [exerciseId, sets]),
    ).toStrictEqual([
      ["c-raise", 2],
      ["a-press", 1],
      ["b-fly", 1],
    ]);
  });

  it("should give the day name of the session of the newest set, or null when the session has none", () => {
    const sets = [syntheticSet({ at: hoursBefore(30), session: "session-1" })];

    expect(
      muscleDetail(
        syntheticInput({ sets, sessions: [{ id: "session-1", routine_day_name: "Pull" }] }),
      ).lastTrained?.routineDayName,
    ).toBe("Pull");
    expect(
      muscleDetail(
        syntheticInput({ sets, sessions: [{ id: "session-1", routine_day_name: null }] }),
      ).lastTrained?.routineDayName,
    ).toBeNull();
    expect(muscleDetail(syntheticInput({ sets })).lastTrained?.routineDayName).toBeNull();
  });

  it("should count a day in the user's zone, so a late evening in London is that evening's date", () => {
    // 23:30 BST on Wednesday 14 October is 22:30 UTC and 11:30 on Thursday in Auckland.
    const at = "2026-10-14T22:30:00.000Z";

    expect(
      muscleDetail(syntheticInput({ sets: [syntheticSet({ at })], tz: LONDON })).lastTrained
        ?.localDate,
    ).toBe("2026-10-14");
    expect(
      muscleDetail(syntheticInput({ sets: [syntheticSet({ at })], tz: "Pacific/Auckland" }))
        .lastTrained?.localDate,
    ).toBe("2026-10-15");
  });

  it("should gather the exercises of the whole local day, across two sessions", () => {
    const detail = muscleDetail(
      syntheticInput({
        sets: [
          syntheticSet({
            at: "2026-10-14T08:00:00.000Z",
            exercise: "morning",
            session: "session-am",
          }),
          syntheticSet({
            at: "2026-10-14T17:00:00.000Z",
            exercise: "evening",
            session: "session-pm",
          }),
        ],
      }),
    );

    expect(detail.lastTrained?.sessionId).toBe("session-pm");
    expect(detail.lastTrained?.exercises.map(({ exerciseId }) => exerciseId)).toStrictEqual([
      "evening",
      "morning",
    ]);
  });

  describe("the 14 day window", () => {
    it("should include a set just inside it", () => {
      const detail = muscleDetail(
        syntheticInput({
          sets: [
            syntheticSet({
              at: new Date(Date.parse(NOW) - 14 * MILLISECONDS_PER_DAY + 1).toISOString(),
            }),
          ],
        }),
      );

      expect(detail.lastTrained).not.toBeNull();
    });

    it("should leave out a set exactly 14 days old, as the heat does", () => {
      const detail = muscleDetail(
        syntheticInput({
          sets: [
            syntheticSet({
              at: new Date(Date.parse(NOW) - 14 * MILLISECONDS_PER_DAY).toISOString(),
            }),
          ],
        }),
      );

      expect(detail.lastTrained).toBeNull();
    });

    it("should include a set at now", () => {
      expect(
        muscleDetail(syntheticInput({ sets: [syntheticSet({ at: NOW })] })).lastTrained,
      ).not.toBeNull();
    });
  });

  it("should give the same sheet whatever order the sets come in", () => {
    const anyOrder = fc.shuffledSubarray(loggedSets, {
      minLength: loggedSets.length,
      maxLength: loggedSets.length,
    });

    fc.assert(
      fc.property(anyOrder, fc.constantFrom(...MUSCLE_IDS), (sets, muscle) => {
        expect(goldenInput(muscle, { sets })).toStrictEqual(goldenInput(muscle));
      }),
    );
  });
});

describe("muscleDetail, refusals", () => {
  it("should refuse a time zone that is not an IANA name, naming the rule", () => {
    expect(() => muscleDetail(syntheticInput({ tz: "Mars/Olympus" }))).toThrow(
      new RangeError("A time zone must be an IANA zone name"),
    );
  });

  it("should refuse a moment that is not an ISO timestamp with a zone, naming the rule", () => {
    expect(() => muscleDetail(syntheticInput({ now: "2026-10-15T18:00:00" }))).toThrow(
      new RangeError("The moment to compute at must be an ISO timestamp with a zone"),
    );
  });

  it("should refuse a set whose time is not an ISO timestamp with a zone, naming the rule", () => {
    expect(() =>
      muscleDetail(syntheticInput({ sets: [syntheticSet({ at: "Monday evening" })] })),
    ).toThrow(new RangeError("A set's performed_at must be an ISO timestamp with a zone"));
  });

  it("should refuse a goal priority for a muscle that is not on the list, naming the rule", () => {
    // The map is typed by muscle id, so an unknown key can only come from untyped data.
    const unknownMuscle: Record<string, number> = { elbow: 1 };

    expect(() =>
      muscleDetail(syntheticInput({ targeted: { routine: null, priority: unknownMuscle } })),
    ).toThrow(new RangeError("A muscle priority must name a muscle of the list"));
  });
});
