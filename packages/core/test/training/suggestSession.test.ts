import { describe, expect, it } from "vitest";

import { recordOfMuscles } from "./goldenWeekInputs";
import { evenState, GOLDEN_LIBRARY, V_TAPER_GOALS, WEDNESDAY_STATE } from "./suggestGolden";
import { MUSCLE_IDS, suggestSession, SUGGEST_PARAMS_V1 } from "../../src/training";

import type {
  Equipment,
  ExerciseMechanic,
  ExperienceLevel,
  MuscleId,
  SuggestExercise,
  SuggestGoals,
  SuggestState,
  SuggestedSession,
  Suggestion,
  TrainingGoal,
} from "../../src/training";

/*
 * Behaviour of `suggestSession` that the golden suggestions do not show: the rules one at a time, on
 * small libraries where the arithmetic is readable. The expected values are worked by hand from the
 * rules of Zee's agreed document on KEY-396 (Part 3), never computed from the code under test.
 */

const sessionOf = (suggestion: Suggestion): SuggestedSession => {
  if (suggestion.kind !== "session") {
    throw new Error("Expected a session");
  }
  return suggestion;
};

const idsOf = (suggestion: Suggestion): string[] =>
  sessionOf(suggestion).exercises.map((exercise) => exercise.exercise_id);

const exercise = (
  id: string,
  primary: MuscleId[],
  overrides: Partial<Pick<SuggestExercise, "name" | "equipment" | "mechanic">> = {},
  secondary: MuscleId[] = [],
): SuggestExercise => ({
  id,
  name: overrides.name ?? id,
  equipment: overrides.equipment ?? "barbell",
  mechanic: overrides.mechanic ?? "compound",
  muscles: [
    ...primary.map((muscle_id) => ({ muscle_id, role: "primary" as const, weight: 1 })),
    ...secondary.map((muscle_id) => ({ muscle_id, role: "secondary" as const, weight: 0.5 })),
  ],
});

const goalsWith = (
  priority: Partial<Record<MuscleId, number>>,
  overrides: Partial<SuggestGoals> = {},
): SuggestGoals => ({
  goal: "aesthetic",
  experience: "intermediate",
  equipment: ["barbell", "dumbbell"],
  session_minutes: 60,
  muscle_priority: priority,
  ...overrides,
});

const suggest = (
  goals: SuggestGoals,
  library: SuggestExercise[],
  state: SuggestState = evenState(0, 0),
  constraints: { minutes?: number; equipment?: Equipment[] } = {},
) => suggestSession(state, goals, library, constraints, SUGGEST_PARAMS_V1);

const stateWith = (
  changes: Partial<Record<MuscleId, { weeklySets?: number; heat?: number }>>,
): SuggestState =>
  recordOfMuscles((muscle) => ({
    weeklySets: changes[muscle]?.weeklySets ?? 0,
    heat: changes[muscle]?.heat ?? 0,
  }));

describe("suggestSession errors", () => {
  it("should throw a RangeError stating the rule for an empty equipment list in the goal", () => {
    expect(() => suggest(goalsWith({ chest_upper: 3 }, { equipment: [] }), GOLDEN_LIBRARY)).toThrow(
      new RangeError("Suggestions need at least one piece of equipment"),
    );
  });

  it("should throw a RangeError stating the rule for an empty equipment list in the constraints", () => {
    expect(() =>
      suggest(V_TAPER_GOALS, GOLDEN_LIBRARY, WEDNESDAY_STATE, { equipment: [] }),
    ).toThrow(new RangeError("Suggestions need at least one piece of equipment"));
  });

  it.each([0, -7, Number.NaN])(
    "should throw a RangeError stating the rule for a minutes budget of %s",
    (minutes) => {
      expect(() => suggest(V_TAPER_GOALS, GOLDEN_LIBRARY, WEDNESDAY_STATE, { minutes })).toThrow(
        new RangeError("The session minutes must be greater than 0"),
      );
    },
  );

  it("should throw for a goal whose session minutes is not above 0 when the constraints name none", () => {
    expect(() =>
      suggest(goalsWith({ chest_upper: 3 }, { session_minutes: 0 }), GOLDEN_LIBRARY),
    ).toThrow(new RangeError("The session minutes must be greater than 0"));
  });

  it("should not put a value in an error message", () => {
    let message = "";
    try {
      suggest(V_TAPER_GOALS, GOLDEN_LIBRARY, WEDNESDAY_STATE, { minutes: -1234 });
    } catch (error) {
      message = error instanceof Error ? error.message : "";
    }
    expect(message).not.toContain("1234");
    expect(message).not.toContain("-");
  });
});

describe("the nothing cases", () => {
  // The medium muscles of the document, whose MAV low is 12. The rest are 10.
  const MEDIUM = new Set<MuscleId>([
    "chest_upper",
    "chest_lower",
    "lats",
    "traps_upper",
    "traps_mid",
    "glute_med",
    "adductors",
  ]);

  it("should offer nothing when every muscle is exactly at its MAV low (priorities covered)", () => {
    const covered = recordOfMuscles((muscle) => ({
      weeklySets: MEDIUM.has(muscle) ? 12 : 10,
      heat: 0.2,
    }));
    expect(suggest(V_TAPER_GOALS, GOLDEN_LIBRARY, covered)).toStrictEqual({
      kind: "nothing",
      why: "priorities_covered",
      skipped: [],
      no_room: null,
    });
  });

  it("should offer nothing when no muscle has a priority", () => {
    expect(suggest(goalsWith({}), GOLDEN_LIBRARY).kind).toBe("nothing");
  });

  it("should offer nothing when every muscle the goal ranks is hot (all hot), listing each", () => {
    const hot = suggest(V_TAPER_GOALS, GOLDEN_LIBRARY, evenState(0, 0.9));
    expect(hot).toStrictEqual({
      kind: "nothing",
      why: "all_hot",
      skipped: [
        "chest_upper",
        "chest_lower",
        "delt_front",
        "delt_side",
        "delt_rear",
        "lats",
        "traps_mid",
        "lower_back",
        "biceps",
        "triceps",
        "forearms",
        "glute_max",
        "quads",
        "hamstrings",
        "calves",
      ].map((muscle_id) => ({ muscle_id, heat: 0.9 })),
      no_room: null,
    });
  });

  it("should offer nothing, saying no room, when not even the first exercise fits the minutes", () => {
    // With nothing logged chest_upper and lats score 3 x 12 = 36 and list position puts chest_upper first.
    // The incline press is 1 exercise and 3 sets: 2 + 7.5 = 9.5, shown 10, over 5 minutes.
    expect(suggest(V_TAPER_GOALS, GOLDEN_LIBRARY, evenState(0, 0), { minutes: 5 })).toStrictEqual({
      kind: "nothing",
      why: "no_room",
      skipped: [],
      no_room: { muscle_id: "chest_upper", score: 36, minutes_if_added: 10 },
    });
  });
});

describe("the type of a nothing", () => {
  it("should carry the muscle that did not fit exactly when the reason is no room", () => {
    const result = suggest(V_TAPER_GOALS, GOLDEN_LIBRARY, evenState(0, 0), { minutes: 5 });
    if (result.kind === "nothing" && result.why === "no_room") {
      expect(result.no_room.minutes_if_added).toBe(10);
    } else {
      throw new Error("Expected nothing, for no room");
    }
  });
});

describe("the hot threshold", () => {
  const library = [exercise("press", ["chest_upper"])];
  const goals = goalsWith({ chest_upper: 3 });

  it("should pass a primary muscle whose heat is exactly 0.5", () => {
    expect(idsOf(suggest(goals, library, stateWith({ chest_upper: { heat: 0.5 } })))).toStrictEqual(
      ["press"],
    );
  });

  it("should skip a primary muscle whose heat is above 0.5", () => {
    expect(suggest(goals, library, stateWith({ chest_upper: { heat: 0.5000001 } })).kind).toBe(
      "nothing",
    );
  });

  it("should skip an exercise when any one of its primary muscles is hot", () => {
    const row = exercise("row", ["lats", "traps_mid"]);
    const state = stateWith({ traps_mid: { heat: 0.8 } });
    expect(suggest(goalsWith({ lats: 3, traps_mid: 3 }), [row], state).kind).toBe("nothing");
  });

  it("should not skip an exercise because a muscle it only works as a secondary is hot", () => {
    const press = exercise("press", ["chest_upper"], {}, ["triceps"]);
    expect(idsOf(suggest(goals, [press], stateWith({ triceps: { heat: 0.9 } })))).toStrictEqual([
      "press",
    ]);
  });

  it("should leave out a hot muscle with no score from the skipped list", () => {
    const result = sessionOf(
      suggest(goals, library, stateWith({ chest_lower: { heat: 0.9, weeklySets: 20 } })),
    );
    expect(result.skipped).toStrictEqual([]);
  });
});

describe("the score", () => {
  it("should prefer the muscle with the larger priority times gap times freshness", () => {
    // chest_upper: 1 x 12 x 1 = 12. delt_side: 1 x 10 x 0.5 = 5. A 10 minute budget fits only one.
    const library = [exercise("raise", ["delt_side"]), exercise("press", ["chest_upper"])];
    const state = stateWith({ delt_side: { heat: 0.5 } });
    expect(
      idsOf(suggest(goalsWith({ chest_upper: 1, delt_side: 1 }), library, state, { minutes: 10 })),
    ).toStrictEqual(["press"]);
  });

  it("should treat a muscle at or over its MAV low as having no gap", () => {
    const library = [exercise("press", ["chest_upper"])];
    expect(
      suggest(
        goalsWith({ chest_upper: 3 }),
        library,
        stateWith({ chest_upper: { weeklySets: 12 } }),
      ).kind,
    ).toBe("nothing");
  });

  it("should count the sets already given in the session, so a muscle covered by one exercise stops leading", () => {
    // press: chest_upper primary. fly: chest_upper secondary at 0.5, chest_lower primary. After press
    // (3 sets) chest_upper has 3 of 12, so the second pick is still about chest_lower.
    const library = [
      exercise("press", ["chest_upper"], {}, ["chest_lower"]),
      exercise("fly", ["chest_lower"]),
    ];
    const result = sessionOf(suggest(goalsWith({ chest_upper: 3, chest_lower: 3 }), library));
    expect(result.exercises[1]?.reasons).toStrictEqual([
      {
        muscle_id: "chest_lower",
        priority: 3,
        weekly_sets: 1.5,
        logged_sets: 0,
        mav_low: 12,
        heat: 0,
        score: 31.5,
      },
    ]);
  });
});

describe("rounding", () => {
  it("should round the sets of a muscle credited three times at 0.2 to exactly 1.8", () => {
    // Each of three picks gives calves a 0.2 stabiliser weight at 3 sets, and 0.2 x 3 is 0.6000000000000001
    // in floating point, so three of them add to 1.8000000000000003 unrounded. The calf raise leads last.
    const stabilising = (id: string, muscle: MuscleId): SuggestExercise => ({
      id,
      name: id,
      equipment: "barbell",
      mechanic: "compound",
      muscles: [
        { muscle_id: muscle, role: "primary", weight: 1 },
        { muscle_id: "calves", role: "stabiliser", weight: 0.2 },
      ],
    });
    const library = [
      stabilising("press", "chest_upper"),
      stabilising("row", "lats"),
      stabilising("raise", "delt_side"),
      exercise("calf raise", ["calves"]),
    ];
    const result = sessionOf(
      suggest(goalsWith({ chest_upper: 3, lats: 3, delt_side: 3, calves: 1 }), library),
    );
    expect(result.exercises.map((picked) => picked.exercise_id)).toStrictEqual([
      "press",
      "row",
      "raise",
      "calf raise",
    ]);
    expect(result.exercises[3]?.reasons[0]?.weekly_sets).toBe(1.8);
  });

  it("should treat scores that differ only after the sixth decimal as equal, so list position decides", () => {
    // chest_upper: 1 x (12 - 8.3) = 3.6999999999999993. delt_front: 1 x (10 - 6.3) = 3.7. Both are 3.7, and
    // chest_upper is earlier in the muscle list. The delt_front exercise comes first in the library.
    const library = [exercise("front", ["delt_front"]), exercise("chest", ["chest_upper"])];
    const state = stateWith({
      chest_upper: { weeklySets: 8.3 },
      delt_front: { weeklySets: 6.3 },
    });
    expect(
      idsOf(suggest(goalsWith({ chest_upper: 1, delt_front: 1 }), library, state, { minutes: 10 })),
    ).toStrictEqual(["chest"]);
  });
});

describe("the order of muscles", () => {
  it("should let the higher priority lead when two muscles score the same", () => {
    // All three score 12.00: chest_upper 1 x 12, lats 2 x 6, delt_side 3 x 4. A 10 minute budget fits one.
    const library = [
      exercise("chest", ["chest_upper"]),
      exercise("back", ["lats"]),
      exercise("shoulder", ["delt_side"]),
    ];
    const state = stateWith({ lats: { weeklySets: 6 }, delt_side: { weeklySets: 6 } });
    const goals = goalsWith({ chest_upper: 1, lats: 2, delt_side: 3 });
    expect(idsOf(suggest(goals, library, state, { minutes: 10 }))).toStrictEqual(["shoulder"]);
  });

  it("should let the earlier muscle in the list lead when score and priority are both equal", () => {
    // chest_upper and lats both score 2 x 12 = 24. The lats exercise comes first in the library.
    const library = [exercise("back", ["lats"]), exercise("chest", ["chest_upper"])];
    expect(
      idsOf(
        suggest(goalsWith({ chest_upper: 2, lats: 2 }), library, evenState(0, 0), { minutes: 10 }),
      ),
    ).toStrictEqual(["chest"]);
  });

  it("should let a muscle lead at most one exercise", () => {
    const library = [
      exercise("press a", ["chest_upper"]),
      exercise("press b", ["chest_upper"]),
      exercise("raise", ["delt_side"]),
    ];
    expect(idsOf(suggest(goalsWith({ chest_upper: 3, delt_side: 1 }), library))).toStrictEqual([
      "press a",
      "raise",
    ]);
  });

  it("should move to the next muscle when the leading one has no eligible exercise", () => {
    const library = [exercise("raise", ["delt_side"])];
    expect(idsOf(suggest(goalsWith({ chest_upper: 3, delt_side: 1 }), library))).toStrictEqual([
      "raise",
    ]);
  });
});

describe("the tie-break between exercises for the same muscle", () => {
  const goals = goalsWith({ chest_upper: 3 });

  it("should prefer the exercise whose primary muscles score more in all", () => {
    const one = exercise("a one", ["chest_upper"]);
    const two = exercise("z two", ["chest_upper", "delt_side"]);
    expect(idsOf(suggest(goalsWith({ chest_upper: 3, delt_side: 1 }), [one, two]))[0]).toBe(
      "z two",
    );
  });

  it("should prefer a compound to an isolation when the score is equal, whatever the name and id", () => {
    const isolation = exercise("a", ["chest_upper"], { name: "A fly", mechanic: "isolation" });
    const compound = exercise("b", ["chest_upper"], { name: "B press", mechanic: "compound" });
    expect(idsOf(suggest(goals, [isolation, compound]))).toStrictEqual(["b"]);
  });

  it("should prefer the earlier name when score and mechanic are equal, whatever the id", () => {
    const later = exercise("a", ["chest_upper"], { name: "Bravo" });
    const earlier = exercise("b", ["chest_upper"], { name: "Alpha" });
    expect(idsOf(suggest(goals, [later, earlier]))).toStrictEqual(["b"]);
  });

  it("should prefer the earlier id when everything else is equal", () => {
    const second = exercise("b", ["chest_upper"], { name: "Same" });
    const first = exercise("a", ["chest_upper"], { name: "Same" });
    expect(idsOf(suggest(goals, [second, first]))).toStrictEqual(["a"]);
  });

  it("should compare names by code unit, not by the language of the device", () => {
    // In code unit order "Zebra" comes before "apple".
    const lower = exercise("a", ["chest_upper"], { name: "apple" });
    const upper = exercise("b", ["chest_upper"], { name: "Zebra" });
    expect(idsOf(suggest(goals, [lower, upper]))).toStrictEqual(["b"]);
  });
});

describe("equipment", () => {
  const library = [
    exercise("bar", ["chest_upper"], { equipment: "barbell" }),
    exercise("bell", ["delt_side"], { equipment: "dumbbell" }),
    exercise("cable", ["lats"], { equipment: "cable" }),
  ];
  const goals = goalsWith({ chest_upper: 3, delt_side: 2, lats: 1 }, { equipment: ["dumbbell"] });

  it("should only suggest exercises whose equipment the goal lists", () => {
    expect(idsOf(suggest(goals, library))).toStrictEqual(["bell"]);
  });

  it("should let the constraints narrow the goal's equipment, never widen it", () => {
    // The goal lists dumbbells only. A screen that passes cable as well still gets no cable exercise.
    expect(
      idsOf(suggest(goals, library, evenState(0, 0), { equipment: ["cable", "dumbbell"] })),
    ).toStrictEqual(["bell"]);
  });

  it("should offer nothing when the constraints and the goal share no equipment", () => {
    expect(suggest(goals, library, evenState(0, 0), { equipment: ["cable"] })).toStrictEqual({
      kind: "nothing",
      why: "no_exercise",
      skipped: [],
      no_room: null,
    });
  });

  it("should narrow a wider goal to the equipment of the constraints", () => {
    const wide = { ...goals, equipment: ["barbell", "dumbbell", "cable"] satisfies Equipment[] };
    expect(idsOf(suggest(wide, library, evenState(0, 0), { equipment: ["cable"] }))).toStrictEqual([
      "cable",
    ]);
  });
});

describe("the minutes budget", () => {
  const library = MUSCLE_IDS.slice(0, 6).map((muscle) => exercise(`for ${muscle}`, [muscle]));
  const goals = goalsWith(Object.fromEntries(MUSCLE_IDS.map((muscle) => [muscle, 3])));

  it("should use the minutes of the goal when the constraints name none", () => {
    // 3 exercises and 9 sets: 6 + 22.5 = 28.5, shown 30. A fourth would be 8 + 30 = 38, shown 40.
    expect(sessionOf(suggest({ ...goals, session_minutes: 30 }, library)).minutes).toBe(30);
    expect(sessionOf(suggest({ ...goals, session_minutes: 30 }, library)).exercises).toHaveLength(
      3,
    );
  });

  it("should let the constraints narrow the minutes of the goal", () => {
    expect(
      sessionOf(suggest(goals, library, evenState(0, 0), { minutes: 30 })).exercises,
    ).toHaveLength(3);
  });

  it("should accept an exercise that reads exactly the minutes available", () => {
    // 3 exercises and 9 sets read 30, which is not more than 30.
    expect(sessionOf(suggest(goals, library, evenState(0, 0), { minutes: 30 })).minutes).toBe(30);
  });

  it("should judge by the rounded estimate, so 28.5 minutes fits a budget of 30 but not 29", () => {
    // 3 exercises and 9 sets are 28.5 minutes raw and 30 shown, so 29 minutes holds only 2 exercises (20).
    expect(
      sessionOf(suggest(goals, library, evenState(0, 0), { minutes: 29 })).exercises,
    ).toHaveLength(2);
  });
});

describe("the number of exercises", () => {
  const priorityMuscles: MuscleId[] = [
    "chest_upper",
    "chest_lower",
    "delt_front",
    "delt_side",
    "delt_rear",
    "lats",
    "traps_mid",
    "biceps",
    "triceps",
    "quads",
  ];
  const library = priorityMuscles.map((muscle) => exercise(`for ${muscle}`, [muscle]));
  const goals = goalsWith(Object.fromEntries(priorityMuscles.map((muscle) => [muscle, 3])), {
    session_minutes: 180,
  });

  it("should stop at 8 exercises in a fresh suggestion, taking the 8 that score most", () => {
    // Medium muscles score 36 and the others 30, with ties in list order. Triceps and quads are left out.
    expect(idsOf(suggest(goals, library))).toStrictEqual([
      "for chest_upper",
      "for chest_lower",
      "for lats",
      "for traps_mid",
      "for delt_front",
      "for delt_side",
      "for delt_rear",
      "for biceps",
    ]);
  });
});

describe("sets, reps and RIR", () => {
  const library = [exercise("press", ["chest_upper"])];

  it.each<[ExperienceLevel, number]>([
    ["beginner", 2],
    ["intermediate", 3],
    ["advanced", 4],
  ])("should give a %s user %s sets for each exercise", (experience, sets) => {
    const result = sessionOf(suggest(goalsWith({ chest_upper: 3 }, { experience }), library));
    expect(result.exercises[0]?.sets).toBe(sets);
    expect(result.sets).toBe(sets);
  });

  it.each<[TrainingGoal, ExerciseMechanic, number, number, number]>([
    ["strength", "isolation", 8, 12, 2],
    ["hybrid", "compound", 5, 8, 2],
    ["hybrid", "isolation", 10, 15, 1],
  ])("should give a %s %s exercise %s to %s reps at RIR %s", (goal, mechanic, min, max, rir) => {
    const result = sessionOf(
      suggest(goalsWith({ chest_upper: 3 }, { goal }), [
        exercise("press", ["chest_upper"], { mechanic }),
      ]),
    );
    expect(result.exercises[0]).toMatchObject({ rep_min: min, rep_max: max, target_rir: rir });
  });

  it("should credit the sets of a pick to every muscle it works, at its weight", () => {
    // press works chest_lower at 0.5, so 3 sets give it 1.5 before the next pick is scored.
    const result = sessionOf(
      suggest(goalsWith({ chest_upper: 3, chest_lower: 3 }), [
        exercise("press", ["chest_upper"], {}, ["chest_lower"]),
        exercise("fly", ["chest_lower"]),
      ]),
    );
    expect(result.exercises[1]?.reasons[0]?.weekly_sets).toBe(1.5);
  });
});

describe("the reasons are data only", () => {
  it("should carry muscle ids and numbers, and no exercise name or sentence", () => {
    const result = sessionOf(
      suggestSession(WEDNESDAY_STATE, V_TAPER_GOALS, GOLDEN_LIBRARY, {}, SUGGEST_PARAMS_V1),
    );
    for (const picked of result.exercises) {
      expect(Object.keys(picked).sort()).toStrictEqual([
        "exercise_id",
        "origin",
        "reasons",
        "rep_max",
        "rep_min",
        "sets",
        "target_rir",
      ]);
      for (const each of picked.reasons) {
        expect(Object.keys(each).sort()).toStrictEqual([
          "heat",
          "logged_sets",
          "mav_low",
          "muscle_id",
          "priority",
          "score",
          "weekly_sets",
        ]);
        expect(MUSCLE_IDS).toContain(each.muscle_id);
        for (const key of [
          "heat",
          "logged_sets",
          "mav_low",
          "priority",
          "score",
          "weekly_sets",
        ] as const) {
          expect(typeof each[key]).toBe("number");
        }
      }
    }
    const json = JSON.stringify(result);
    for (const library of GOLDEN_LIBRARY) {
      expect(json).not.toContain(library.name);
    }
  });
});

describe("purity", () => {
  it("should not change its inputs", () => {
    const state = structuredClone(WEDNESDAY_STATE);
    const goals = structuredClone(V_TAPER_GOALS);
    const library = structuredClone(GOLDEN_LIBRARY);
    suggestSession(state, goals, library, { minutes: 45 }, SUGGEST_PARAMS_V1);
    expect(state).toStrictEqual(WEDNESDAY_STATE);
    expect(goals).toStrictEqual(V_TAPER_GOALS);
    expect(library).toStrictEqual(GOLDEN_LIBRARY);
  });

  it("should give the same answer when asked twice", () => {
    expect(suggest(V_TAPER_GOALS, GOLDEN_LIBRARY, WEDNESDAY_STATE)).toStrictEqual(
      suggest(V_TAPER_GOALS, GOLDEN_LIBRARY, WEDNESDAY_STATE),
    );
  });
});
