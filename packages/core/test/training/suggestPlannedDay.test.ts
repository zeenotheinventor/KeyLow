import { describe, expect, it } from "vitest";

import { goalsWith, libraryExercise, plannedDayOf, stateWith } from "./suggestPlanInputs";
import { suggestSession, SUGGEST_PARAMS_V1 } from "../../src/training";

import type { PlannedEntry } from "./suggestPlanInputs";
import type {
  PlanRoutineDay,
  SuggestExercise,
  SuggestGoals,
  SuggestState,
} from "../../src/training";

/*
 * `suggestSession` on a planned routine day: the plan is kept, and Ki-Lo only adds (KEY-401).
 * The libraries are small so every expected value is worked by hand from the rules of Zee's agreed
 * document on KEY-396 (Part 3), never computed from the code under test. MAV low is 10 sets for every muscle
 * used here but lats and traps_mid, chest_upper and chest_lower, which are 12. A set of aesthetic
 * isolation work is 12 to 15 reps at RIR 1, a compound set 8 to 10 at RIR 2, and an intermediate user
 * gets 3 sets per exercise. A session reads `exercises × 2 + sets × 2.5` minutes, rounded to 5, half up.
 */

const squat = libraryExercise("squat", ["quads"], { equipment: "barbell" }, ["glute_max"]);
const legCurl = libraryExercise("leg-curl", ["hamstrings"], {
  equipment: "machine",
  mechanic: "isolation",
});
const calfRaise = libraryExercise("calf-raise", ["calves"], {
  equipment: "machine",
  mechanic: "isolation",
});
const lateralRaise = libraryExercise("lateral-raise", ["delt_side"], {
  equipment: "dumbbell",
  mechanic: "isolation",
});
const cableRaise = libraryExercise("cable-raise", ["delt_side"], {
  equipment: "cable",
  mechanic: "isolation",
});
const curl = libraryExercise("curl", ["biceps"], { equipment: "dumbbell", mechanic: "isolation" });
const pushdown = libraryExercise("pushdown", ["triceps"], {
  equipment: "cable",
  mechanic: "isolation",
});
// Two primary muscles, one of which (lats) the tests make hot.
const cableRow = libraryExercise("cable-row", ["lats", "traps_mid"], { equipment: "cable" });
const barbellRow = libraryExercise("barbell-row", ["lats", "traps_mid"], { equipment: "barbell" });
const dumbbellRow = libraryExercise("dumbbell-row", ["lats"], { equipment: "dumbbell" });
const shrug = libraryExercise("shrug", ["traps_mid"], {
  equipment: "dumbbell",
  mechanic: "isolation",
});

const suggest = (
  plan: readonly PlannedEntry[],
  library: readonly SuggestExercise[],
  priority: SuggestGoals["muscle_priority"],
  state: SuggestState = stateWith({}),
  constraints: { minutes?: number; equipment?: SuggestGoals["equipment"] } = {},
  goals: Partial<SuggestGoals> = {},
) =>
  suggestSession(
    state,
    goalsWith(priority, goals),
    library,
    { ...constraints, plannedDay: plannedDayOf(plan) },
    SUGGEST_PARAMS_V1,
  );

const day = (plan: readonly PlannedEntry[]): PlanRoutineDay => plannedDayOf(plan);

describe("a planned day is kept", () => {
  const plan: PlannedEntry[] = [
    { exercise: squat, sets: 4, targetRir: 2 },
    { exercise: legCurl, sets: 3, targetRir: 1 },
    { exercise: calfRaise, sets: 2, targetRir: null },
  ];
  const result = suggest(plan, [squat, legCurl, calfRaise, lateralRaise], { delt_side: 3 });

  it("should keep every planned exercise, in order, with its planned sets, ahead of what is added", () => {
    // Priorities only name delt_side, so the one addition is the lateral raise at the end.
    expect(result).toStrictEqual({
      kind: "plan_adjusted",
      exercises: [
        ...day(plan).exercises.map((each) => ({
          origin: "plan",
          routine_exercise_id: each.id,
          exercise_id: each.exercise_id,
          sets: each.target_sets,
          target_rir: each.target_rir,
        })),
        {
          origin: "added",
          exercise_id: "lateral-raise",
          sets: 3,
          rep_min: 12,
          rep_max: 15,
          target_rir: 1,
          reasons: [
            {
              muscle_id: "delt_side",
              priority: 3,
              weekly_sets: 0,
              mav_low: 10,
              heat: 0,
              score: 30,
            },
          ],
        },
      ],
      added: 1,
      // 3 planned exercises and 9 sets: 6 + 22.5 = 28.5, shown 30. With the raise, 4 and 12: 8 + 30 = 38, shown 40.
      sets: 12,
      minutes: 40,
      planned: { sets: 9, minutes: 30 },
      skipped: [],
      no_room: null,
    });
  });

  it("should not add an exercise that is already in the plan", () => {
    // The planned raise gives delt_side 3 of 10 sets, so it still has a gap of 7 (score 21) and the cable
    // raise, not the planned lateral raise again, is the exercise added.
    const planned = suggest(
      [{ exercise: lateralRaise, sets: 3, targetRir: 1 }],
      [lateralRaise, cableRaise],
      { delt_side: 3 },
    );
    expect(planned).toMatchObject({
      kind: "plan_adjusted",
      exercises: [{ origin: "plan" }, { origin: "added", exercise_id: "cable-raise" }],
    });
  });

  it("should add at most 2 exercises, the two with the highest scores", () => {
    // delt_side 3 x 10 = 30, biceps 2 x 10 = 20, triceps 1 x 10 = 10. The cap leaves the pushdown out.
    const capped = suggest(
      [{ exercise: squat, sets: 4 }],
      [squat, lateralRaise, curl, pushdown],
      { delt_side: 3, biceps: 2, triceps: 1 },
      stateWith({}),
      { minutes: 180 },
    );
    expect(capped).toMatchObject({
      added: 2,
      exercises: [{ origin: "plan" }, { exercise_id: "lateral-raise" }, { exercise_id: "curl" }],
    });
  });

  it("should treat a day with no exercises as a day to add to", () => {
    expect(suggest([], [lateralRaise], { delt_side: 3 })).toMatchObject({
      kind: "plan_adjusted",
      planned: { sets: 0, minutes: 0 },
      added: 1,
    });
  });
});

describe("the planned sets count towards what is left", () => {
  it("should add nothing for a muscle the planned day already brings to its MAV low", () => {
    // delt_side has 8 of 10 sets and the planned raise gives 3 more: 11, no gap, so no score.
    const result = suggest(
      [{ exercise: lateralRaise, sets: 3, targetRir: 2 }],
      [lateralRaise, cableRaise],
      { delt_side: 3 },
      stateWith({ delt_side: { weeklySets: 8 } }),
    );
    expect(result).toStrictEqual({
      kind: "nothing",
      why: "priorities_covered",
      skipped: [],
      no_room: null,
    });
  });

  it("should score the gap that is left, and give the planned sets in the reason's weekly sets", () => {
    // 6 logged and 3 planned: 9 of 10, score 3 x 1 x 1 = 3.
    const result = suggest(
      [{ exercise: lateralRaise, sets: 3, targetRir: 2 }],
      [lateralRaise, cableRaise],
      { delt_side: 3 },
      stateWith({ delt_side: { weeklySets: 6 } }),
    );
    expect(result).toMatchObject({
      exercises: [
        { origin: "plan" },
        {
          origin: "added",
          exercise_id: "cable-raise",
          reasons: [{ muscle_id: "delt_side", weekly_sets: 9, score: 3 }],
        },
      ],
    });
  });

  it("should credit a secondary muscle at its weight", () => {
    // 4 sets of a press that works triceps at 0.5 give 2. 8 logged and 2 planned: 10 of 10, no gap.
    const press = libraryExercise("press", ["chest_lower"], {}, ["triceps"]);
    expect(
      suggest(
        [{ exercise: press, sets: 4 }],
        [press, pushdown],
        { triceps: 2 },
        stateWith({ triceps: { weeklySets: 8 } }),
      ),
    ).toMatchObject({ kind: "nothing", why: "priorities_covered" });
  });

  it("should credit a planned set by its target RIR, as the plan does: a moderate set counts half", () => {
    // RIR 5 is a moderate set (0.5): 4 sets give 2. 7 logged and 2 planned: 9 of 10, score 3 x 1 = 3.
    const result = suggest(
      [{ exercise: lateralRaise, sets: 4, targetRir: 5 }],
      [lateralRaise, cableRaise],
      { delt_side: 3 },
      stateWith({ delt_side: { weeklySets: 7 } }),
    );
    expect(result).toMatchObject({
      exercises: [{ origin: "plan" }, { reasons: [{ weekly_sets: 9, score: 3 }] }],
    });
  });

  it("should credit a planned set with no target RIR in full", () => {
    // 4 sets give 4. 7 logged and 4 planned: 11 of 10, no gap.
    expect(
      suggest(
        [{ exercise: lateralRaise, sets: 4, targetRir: null }],
        [lateralRaise, cableRaise],
        { delt_side: 3 },
        stateWith({ delt_side: { weeklySets: 7 } }),
      ),
    ).toMatchObject({ kind: "nothing", why: "priorities_covered" });
  });

  it("should give a later pick the sets credited by the plan and by the earlier pick", () => {
    // Pick 1: chest_upper 3 x 12 = 36, the press. It gives chest_upper 3 and delt_front 1.5.
    // Pick 2: delt_front 2 x (10 - 1.5) = 17, the front raise, whose reason reads 1.5 weekly sets.
    const inclinePress = libraryExercise(
      "incline-press",
      ["chest_upper"],
      { equipment: "dumbbell" },
      ["delt_front"],
    );
    const frontRaise = libraryExercise("front-raise", ["delt_front"], {
      equipment: "dumbbell",
      mechanic: "isolation",
    });
    const result = suggest([{ exercise: squat, sets: 4 }], [squat, inclinePress, frontRaise], {
      chest_upper: 3,
      delt_front: 2,
    });
    expect(result).toMatchObject({
      exercises: [
        { origin: "plan" },
        {
          exercise_id: "incline-press",
          reasons: [{ muscle_id: "chest_upper", weekly_sets: 0, score: 36 }],
        },
        {
          exercise_id: "front-raise",
          reasons: [{ muscle_id: "delt_front", weekly_sets: 1.5, score: 17 }],
        },
      ],
    });
  });
});

describe("the length of the plan counts against the minutes", () => {
  // 2 planned exercises and 7 sets: 4 + 17.5 = 21.5, shown 20. The raise makes 3 and 10: 6 + 25 = 31, shown 30.
  const plan: PlannedEntry[] = [
    { exercise: squat, sets: 4 },
    { exercise: legCurl, sets: 3 },
  ];

  it("should add the exercise when the plan and the addition fit the minutes", () => {
    expect(
      suggest(plan, [squat, legCurl, lateralRaise], { delt_side: 3 }, stateWith({}), {
        minutes: 30,
      }),
    ).toMatchObject({
      kind: "plan_adjusted",
      minutes: 30,
      planned: { sets: 7, minutes: 20 },
      added: 1,
    });
  });

  it("should offer nothing, saying no room, when the plan plus the addition reads longer than the minutes", () => {
    // The raise alone would read 10 minutes, so only counting the plan's 20 minutes leaves it out.
    expect(
      suggest(plan, [squat, legCurl, lateralRaise], { delt_side: 3 }, stateWith({}), {
        minutes: 25,
      }),
    ).toStrictEqual({
      kind: "nothing",
      why: "no_room",
      skipped: [],
      no_room: { muscle_id: "delt_side", score: 30, minutes_if_added: 30 },
    });
  });

  it("should offer nothing, saying no room, when the plan alone reads longer than the minutes", () => {
    expect(
      suggest(plan, [squat, legCurl, lateralRaise], { delt_side: 3 }, stateWith({}), {
        minutes: 15,
      }),
    ).toMatchObject({ kind: "nothing", why: "no_room" });
  });

  it("should use the minutes of the goal when the constraints name none", () => {
    expect(
      suggest(
        plan,
        [squat, legCurl, lateralRaise],
        { delt_side: 3 },
        stateWith({}),
        {},
        { session_minutes: 25 },
      ),
    ).toMatchObject({ kind: "nothing", why: "no_room" });
  });
});

describe("a planned exercise that cannot be done is kept (no swaps in v1)", () => {
  it("should keep, in place and credited, an exercise with a hot primary muscle and one whose equipment the user lacks", () => {
    // The cable row works lats, which are hot (0.6), and the barbell row needs a barbell the user lacks.
    // Both stay with their planned sets. Each gives traps_mid 3 sets, so traps_mid reads 6 of 12 when the
    // shrug is picked (2 x 6 = 12) after the lateral raise (3 x 10 = 30). Lats read 6 of 12 and score
    // 1 x 6 x 0.4 = 2.4, so they are skipped for heat.
    const result = suggest(
      [
        { exercise: cableRow, sets: 3 },
        { exercise: barbellRow, sets: 3 },
      ],
      [cableRow, barbellRow, shrug, lateralRaise],
      { delt_side: 3, traps_mid: 2, lats: 1 },
      stateWith({ lats: { heat: 0.6 } }),
      {},
      { equipment: ["dumbbell", "cable"] },
    );
    expect(result).toMatchObject({
      kind: "plan_adjusted",
      added: 2,
      exercises: [
        { origin: "plan", exercise_id: "cable-row", sets: 3 },
        { origin: "plan", exercise_id: "barbell-row", sets: 3 },
        { origin: "added", exercise_id: "lateral-raise" },
        {
          origin: "added",
          exercise_id: "shrug",
          reasons: [{ muscle_id: "traps_mid", weekly_sets: 6, score: 12 }],
        },
      ],
      skipped: [{ muscle_id: "lats", heat: 0.6 }],
    });
  });

  it("should offer nothing, and leave the plan alone, when the only gaps are for a hot muscle", () => {
    expect(
      suggest(
        [{ exercise: cableRow, sets: 3 }],
        [cableRow, dumbbellRow],
        { lats: 1 },
        stateWith({ lats: { heat: 0.6 } }),
      ),
    ).toStrictEqual({
      kind: "nothing",
      why: "all_hot",
      skipped: [{ muscle_id: "lats", heat: 0.6 }],
      no_room: null,
    });
  });
});

describe("the nothing cases on a planned day", () => {
  it("should offer nothing, with no gap, for a user with priorities nothing in the library can serve", () => {
    expect(suggest([{ exercise: squat, sets: 4 }], [squat], { delt_side: 3 })).toStrictEqual({
      kind: "nothing",
      why: "no_exercise",
      skipped: [],
      no_room: null,
    });
  });

  it("should offer nothing, saying all are hot, when every exercise for the gaps has a hot primary muscle", () => {
    expect(
      suggest(
        [{ exercise: squat, sets: 4 }],
        [squat, lateralRaise],
        { delt_side: 3 },
        stateWith({ delt_side: { heat: 0.9 } }),
      ),
    ).toStrictEqual({
      kind: "nothing",
      why: "all_hot",
      skipped: [{ muscle_id: "delt_side", heat: 0.9 }],
      no_room: null,
    });
  });
});

describe("the errors of a planned day", () => {
  it("should throw a RangeError stating the rule for an empty equipment list", () => {
    expect(() =>
      suggest([{ exercise: squat, sets: 4 }], [squat], {}, stateWith({}), { equipment: [] }),
    ).toThrow(new RangeError("Suggestions need at least one piece of equipment"));
  });

  it("should throw a RangeError stating the rule for minutes that are not above 0", () => {
    expect(() =>
      suggest([{ exercise: squat, sets: 4 }], [squat], {}, stateWith({}), { minutes: 0 }),
    ).toThrow(new RangeError("The session minutes must be greater than 0"));
  });
});

describe("a day without a planned day is unchanged", () => {
  it("should give a session, not a plan adjusted, when the constraints name no planned day", () => {
    const result = suggestSession(
      stateWith({}),
      goalsWith({ delt_side: 3 }),
      [lateralRaise],
      {},
      SUGGEST_PARAMS_V1,
    );
    expect(result.kind).toBe("session");
  });
});
