import { describe, expect, it } from "vitest";

import { fakeDatabase, readTool, turnResult, writeTool } from "./helpers.ts";
import { READ_TOOLS } from "../cases/ask.ts";
import {
  exerciseMusclesCasesOf,
  figureIsTheMap,
  figuresDrawnFor,
  musclesNamedIn,
  noFigureDrawn,
  noMusclesNamed,
  noRanking,
  replyNamesOnlyTheFigure,
} from "../cases/exerciseMuscles.ts";
import { adviceCasesOf } from "../cases/trainingAdvice.ts";
import { CUSTOM_EXERCISE } from "../fixtures/training.ts";
import { THRESHOLD_PERCENT } from "../src/thresholds.ts";
import { LIVE_WORKOUT } from "../src/trainingWorld.ts";

import type { EvalCase, GradeContext, Grader } from "../src/case.ts";
import type { TrainingWorld } from "../src/trainingWorld.ts";
import type { EvalDatabase, RowQuery, TurnResult } from "../src/types.ts";
import type { AssistantExerciseMuscles } from "@keylow/core";

// Nothing here asks a model: every grader is given a turn made by hand, as a right model would answer it and as
// a wrong one would, and a database that answers by its filters.

const notUsed = () => Promise.reject(new Error("the world is not used by a grader"));
const calls: string[] = [];
const world: TrainingWorld = {
  anchorDate: "2026-11-07",
  ensureHistory: () => {
    calls.push("history");
    return Promise.resolve();
  },
  exerciseIds: notUsed,
  exerciseName: notUsed,
  suggestion: notUsed,
  muscleFacts: notUsed,
  clearGoal: notUsed,
  restoreGoal: notUsed,
  startWorkout: () => {
    calls.push("start workout");
    return Promise.resolve();
  },
  discardWorkout: () => {
    calls.push("discard workout");
    return Promise.resolve();
  },
};

const cases = exerciseMusclesCasesOf(() => world);
const caseOf = (id: string): EvalCase => {
  const found = cases.find((evalCase) => evalCase.id === id);
  if (found === undefined) {
    throw new Error(`no case ${id}`);
  }
  return found;
};

const romanianId = "e5e70000-0000-4000-8000-000000000001";
const legCurlId = "e5e70000-0000-4000-8000-000000000002";
const benchId = "e5e70000-0000-4000-8000-000000000003";
const facePullId = "e5e70000-0000-4000-8000-000000000004";

const romanian: AssistantExerciseMuscles = {
  exerciseName: "Romanian Deadlift",
  muscles: [
    { muscle_id: "lower_back", role: "secondary" },
    { muscle_id: "glute_max", role: "secondary" },
    { muscle_id: "hamstrings", role: "primary" },
    { muscle_id: "calves", role: "stabiliser" },
  ],
};
const legCurl: AssistantExerciseMuscles = {
  exerciseName: "Seated Leg Curl",
  muscles: [
    { muscle_id: "hamstrings", role: "primary" },
    { muscle_id: "calves", role: "stabiliser" },
  ],
};
const bench: AssistantExerciseMuscles = {
  exerciseName: "Barbell Bench Press - Medium Grip",
  muscles: [
    { muscle_id: "chest_upper", role: "primary" },
    { muscle_id: "chest_lower", role: "primary" },
    { muscle_id: "triceps", role: "secondary" },
    { muscle_id: "delt_front", role: "secondary" },
  ],
};
const facePull: AssistantExerciseMuscles = {
  exerciseName: CUSTOM_EXERCISE.name,
  muscles: [...CUSTOM_EXERCISE.muscles],
};

// The stored rows, with a weight each as the table holds them.
const storedRows = (
  id: string,
  name: string,
  muscles: AssistantExerciseMuscles["muscles"],
): { exercise: Record<string, unknown>; muscles: Record<string, unknown>[] } => ({
  exercise: { id, name },
  muscles: muscles.map((muscle) => ({ exercise_id: id, ...muscle, weight: 1 })),
});

const stored = [
  storedRows(romanianId, romanian.exerciseName, romanian.muscles),
  storedRows(legCurlId, legCurl.exerciseName, legCurl.muscles),
  storedRows(benchId, bench.exerciseName, bench.muscles),
  storedRows(facePullId, facePull.exerciseName, facePull.muscles),
];

/** A database that answers the two reads of `figureIsTheMap` by their filters, and counts the live workout. */
function database(
  options: { sets?: number; openWorkouts?: number; actions?: number; stored?: typeof stored } = {},
): EvalDatabase {
  const {
    sets = LIVE_WORKOUT.sets,
    openWorkouts = 1,
    actions = 0,
    stored: rows = stored,
  } = options;
  const base = fakeDatabase();
  return {
    ...base,
    readRows: ({ table, where }: RowQuery) => {
      if (table === "exercises") {
        return Promise.resolve(
          rows
            .filter(({ exercise }) => exercise["id"] === where["id"])
            .map(({ exercise }) => exercise),
        );
      }
      if (table === "exercise_muscles") {
        return Promise.resolve(
          rows.flatMap(({ muscles }) =>
            muscles.filter((row) => row["exercise_id"] === where["exercise_id"]),
          ),
        );
      }
      if (table === "workout_sessions") {
        return Promise.resolve(
          Array.from({ length: openWorkouts }, () => ({ id: "live-session" })),
        );
      }
      return Promise.resolve([]);
    },
    countRows: ({ table }: RowQuery) =>
      Promise.resolve(
        table === "workout_sets" ? sets : table === "assistant_actions" ? actions : 0,
      ),
  };
}

const showMuscles = (id: string) => readTool("show_exercise_muscles", { exercise_id: id });
const searchFor = (query: string) => readTool("search_exercises", { query });

const contextOf = (turn: TurnResult, data = database()): GradeContext => ({
  turns: [turn],
  database: data,
});

const failuresOf = async (id: string, turn: TurnResult, data = database()) =>
  (await Promise.all(caseOf(id).expect.map((grade) => grade(contextOf(turn, data)))))
    .filter(({ passed }) => !passed)
    .map(({ reason }) => reason);

// What a right model does for each case: the searches, the calls, the figures and a reply that names the same muscles.
const rightTurns: Record<string, Partial<TurnResult>> = {
  "muscles-one": {
    answer: "Romanian deadlift works mainly your hamstrings, then your glutes and lower back.",
    toolCalls: [searchFor("romanian deadlift"), showMuscles(romanianId)],
    exerciseMuscles: [romanian],
  },
  "muscles-words": {
    answer: "Bench press works mainly your upper chest and lower chest, then your triceps.",
    toolCalls: [searchFor("bench press"), showMuscles(benchId)],
    exerciseMuscles: [bench],
  },
  "muscles-compare": {
    answer: "Both count a full set for your hamstrings.",
    toolCalls: [
      searchFor("romanian deadlift"),
      searchFor("leg curl"),
      showMuscles(romanianId),
      showMuscles(legCurlId),
    ],
    exerciseMuscles: [romanian, legCurl],
  },
  "muscles-unknown": {
    answer: "No exercise called a zorblat press is in Ki-Lo.",
    toolCalls: [searchFor("zorblat press")],
  },
  "muscles-during-workout": {
    answer: "Bench press works mainly your upper chest and lower chest, then your triceps.",
    toolCalls: [searchFor("bench press"), showMuscles(benchId)],
    exerciseMuscles: [bench],
  },
  "muscles-custom": {
    answer: "Eval face pull works mainly your rear delts, then your mid traps.",
    toolCalls: [searchFor("face pull"), showMuscles(facePullId)],
    exerciseMuscles: [facePull],
  },
};

const turnFor = (id: string, change: Partial<TurnResult> = {}) =>
  turnResult({ ...rightTurns[id], ...change });

describe("the muscles cases", () => {
  it("should be 6 cases of the trainingAdvice set, none of them must-pass", () => {
    expect(cases.map(({ id }) => id)).toEqual([
      "muscles-one",
      "muscles-words",
      "muscles-compare",
      "muscles-unknown",
      "muscles-during-workout",
      "muscles-custom",
    ]);
    expect(cases.every(({ set }) => set === "trainingAdvice")).toBe(true);
    expect(cases.some(({ mustPass }) => mustPass === true)).toBe(false);
    expect(THRESHOLD_PERCENT.trainingAdvice).toBe(90);
  });

  it("should take the set from 26 cases to 32", () => {
    expect(adviceCasesOf("2026-11-07")).toHaveLength(26);
    expect(adviceCasesOf("2026-11-07").length + cases.length).toBe(32);
  });

  it("should give every case its own id and its own question, in plain British English", () => {
    expect(new Set(cases.map(({ id }) => id)).size).toBe(6);
    expect(new Set(cases.flatMap(({ messages }) => messages)).size).toBe(6);
    for (const message of cases.flatMap(({ messages }) => messages)) {
      expect(message).not.toMatch(/—/);
    }
  });

  it("should write the history before the case, as the other cases of the set do", async () => {
    calls.length = 0;

    await caseOf("muscles-one").prepare?.();

    expect(calls).toEqual(["history"]);
  });

  it("should know the tool as a read tool, so a food question that reaches for it is another matter", () => {
    expect(READ_TOOLS.has("show_exercise_muscles")).toBe(true);
  });

  it("should start a workout for the during-workout case only, and discard it after", async () => {
    calls.length = 0;
    const duringWorkout = caseOf("muscles-during-workout");

    await duringWorkout.setup?.({
      seedConversation: notUsed,
      waitForCompaction: notUsed,
      undoTurn: notUsed,
      restoreTargets: notUsed,
    });
    await duringWorkout.cleanUp?.([], {
      seedConversation: notUsed,
      waitForCompaction: notUsed,
      undoTurn: notUsed,
      restoreTargets: notUsed,
    });

    expect(calls).toEqual(["start workout", "discard workout"]);
    for (const id of cases
      .map(({ id: caseId }) => caseId)
      .filter((id) => id !== duringWorkout.id)) {
      expect(caseOf(id).setup).toBeUndefined();
      expect(caseOf(id).cleanUp).toBeUndefined();
    }
  });
});

describe("a turn a right model would give", () => {
  it.each(cases.map(({ id }) => [id] as const))("should pass %s", async (id) => {
    expect(await failuresOf(id, turnFor(id))).toEqual([]);
  });

  it("should take a reply that names a muscle by the last word of its name, or by its singular", async () => {
    const turn = turnFor("muscles-words", {
      answer: "Bench press works mainly your chest, then your tricep.",
    });

    expect(await failuresOf("muscles-words", turn)).toEqual([]);
  });

  it("should take a question to the person for a word nobody knows", async () => {
    const turn = turnFor("muscles-unknown", {
      status: "clarify",
      answer: "Which exercise is that?",
    });

    expect(await failuresOf("muscles-unknown", turn)).toEqual([]);
  });
});

describe("which figures were drawn", () => {
  it("should fail a case when the tool was called and no figure was drawn", async () => {
    const turn = turnFor("muscles-words", { exerciseMuscles: undefined });

    expect(await failuresOf("muscles-words", turn)).toContainEqual(
      expect.stringContaining("drew 0 figures"),
    );
  });

  it("should fail a figure for an exercise that is not the one asked about", async () => {
    const turn = turnFor("muscles-words", {
      toolCalls: [showMuscles(romanianId)],
      exerciseMuscles: [romanian],
    });

    expect(await failuresOf("muscles-words", turn)).toContainEqual(
      expect.stringContaining("no figure was drawn for an exercise named like /bench press/i"),
    );
  });

  it("should fail two figures where one exercise was asked about", async () => {
    const turn = turnFor("muscles-one", {
      toolCalls: [showMuscles(romanianId), showMuscles(legCurlId)],
      exerciseMuscles: [romanian, legCurl],
    });

    expect(await failuresOf("muscles-one", turn)).toContainEqual(
      expect.stringContaining("drew 2 figures and not the 1"),
    );
  });

  it("should need a figure for each of the two exercises of a comparison", async () => {
    const turn = turnFor("muscles-compare", {
      toolCalls: [showMuscles(romanianId)],
      exerciseMuscles: [romanian],
    });

    expect(await failuresOf("muscles-compare", turn)).toContainEqual(
      expect.stringContaining("drew 1 figures and not the 2"),
    );
  });

  it("should fail a figure for an exercise that is not there", async () => {
    const turn = turnFor("muscles-unknown", { exerciseMuscles: [bench] });

    expect(await failuresOf("muscles-unknown", turn)).toContainEqual(
      expect.stringContaining("drew 1 figures for an exercise that is not there"),
    );
  });

  it("should fail the custom exercise when the muscles are not the ones the fixture gave", async () => {
    const turn = turnFor("muscles-custom", {
      exerciseMuscles: [
        {
          exerciseName: CUSTOM_EXERCISE.name,
          muscles: [{ muscle_id: "delt_rear", role: "secondary" }],
        },
      ],
    });

    expect(await failuresOf("muscles-custom", turn)).toContainEqual(
      expect.stringContaining("not the custom exercise"),
    );
  });
});

describe("figureIsTheMap", () => {
  const grade = (turn: TurnResult, data = database()): Promise<{ passed: boolean }> =>
    figureIsTheMap()(contextOf(turn, data));

  it("should pass a figure equal to the stored map of the exercise the call named, in any order", async () => {
    const turn = turnResult({
      toolCalls: [showMuscles(romanianId)],
      exerciseMuscles: [{ ...romanian, muscles: [...romanian.muscles].reverse() }],
    });

    expect((await grade(turn)).passed).toBe(true);
  });

  it("should fail a figure that drops a stored muscle", async () => {
    const turn = turnResult({
      toolCalls: [showMuscles(romanianId)],
      exerciseMuscles: [{ ...romanian, muscles: romanian.muscles.slice(1) }],
    });

    expect((await grade(turn)).passed).toBe(false);
  });

  it("should fail a figure whose role is not the stored one", async () => {
    const turn = turnResult({
      toolCalls: [showMuscles(legCurlId)],
      exerciseMuscles: [
        {
          ...legCurl,
          muscles: legCurl.muscles.map((muscle) => ({ ...muscle, role: "primary" as const })),
        },
      ],
    });

    expect((await grade(turn)).passed).toBe(false);
  });

  it("should fail a figure that no call explains", async () => {
    const turn = turnResult({ toolCalls: [searchFor("squat")], exerciseMuscles: [romanian] });

    expect((await grade(turn)).passed).toBe(false);
  });

  it("should take the id from the call and never type one, so it reads each exercise the calls named", async () => {
    const data = database();
    const queried: RowQuery[] = [];
    const watched: EvalDatabase = {
      ...data,
      readRows: (query) => {
        queried.push(query);
        return data.readRows(query);
      },
    };
    const turn = turnResult({
      toolCalls: [showMuscles(romanianId), showMuscles(legCurlId)],
      exerciseMuscles: [romanian, legCurl],
    });

    await figureIsTheMap()(contextOf(turn, watched));

    expect(queried.map(({ table, where }) => [table, Object.values(where)[0]])).toEqual([
      ["exercises", romanianId],
      ["exercise_muscles", romanianId],
      ["exercises", legCurlId],
      ["exercise_muscles", legCurlId],
    ]);
  });
});

describe("the muscles the reply names", () => {
  it("should find a name as whole words, ignoring case, longest first", () => {
    expect(
      [...musclesNamedIn("Your SIDE GLUTES and glutes, not the lower back's.")].sort(),
    ).toEqual(["glute_max", "glute_med", "lower_back"].sort());
    expect([...musclesNamedIn("Only your side glutes.")]).toEqual(["glute_med"]);
  });

  it("should not find a name inside another word", () => {
    expect([...musclesNamedIn("A neckline of abstract labs and absolute lats?")]).toEqual(["lats"]);
  });

  const grade = (answer: string, figures: AssistantExerciseMuscles[]) =>
    replyNamesOnlyTheFigure()(
      contextOf(
        turnResult({
          answer,
          toolCalls: figures.map(() => showMuscles(romanianId)),
          exerciseMuscles: figures,
        }),
      ),
    );

  it("should fail a reply that names a muscle no figure shows", async () => {
    const outcome = await grade(
      "Romanian deadlift works your hamstrings, glutes, lower back and quads.",
      [romanian],
    );

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toContain("no figure shows");
  });

  it("should not read side glutes as glutes", async () => {
    const sideGlutes: AssistantExerciseMuscles = {
      exerciseName: "Side Lying Raise",
      muscles: [{ muscle_id: "glute_med", role: "primary" }],
    };

    expect((await grade("Works your side glutes.", [sideGlutes])).passed).toBe(true);
    expect((await grade("Works your glutes.", [sideGlutes])).passed).toBe(false);
  });

  it("should need every primary muscle of a one-figure turn, by its last word", async () => {
    expect((await grade("Works your chest and your triceps.", [bench])).passed).toBe(true);
    const missing = await grade("Works your triceps and your front delts.", [bench]);

    expect(missing.passed).toBe(false);
    expect(missing.reason).toContain("leaves out a primary muscle");
  });

  it("should not need the primary muscles in a turn of two figures", async () => {
    expect((await grade("Both count a full set.", [romanian, legCurl])).passed).toBe(true);
  });

  it("should accept a muscle named on either figure of a comparison", async () => {
    expect(
      (await grade("Both count a full set for your hamstrings and calves.", [romanian, legCurl]))
        .passed,
    ).toBe(true);
  });

  it("should not print the reply in a failure", async () => {
    const outcome = await grade("Quads are secret-sentinel words.", [romanian]);

    expect(outcome.passed).toBe(false);
    expect(JSON.stringify(outcome)).not.toContain("sentinel");
  });
});

describe("the ranking and the exercise that is not there", () => {
  const withAnswer = (answer: string): GradeContext => contextOf(turnResult({ answer }));
  const passes = async (grade: Grader, answer: string) => (await grade(withAnswer(answer))).passed;

  it("should fail each way of putting one exercise above another", async () => {
    for (const answer of [
      "Romanian deadlift works it more than leg curl.",
      "Romanian deadlift works it more.",
      "The leg curl is better for hamstrings.",
      "The best one is the Romanian deadlift.",
      "The Romanian deadlift hits the most.",
    ]) {
      expect(await passes(noRanking(), answer), answer).toBe(false);
    }
  });

  it("should take a reply that names each role and ranks nothing", async () => {
    expect(await passes(noRanking(), "Both count a full set for your hamstrings.")).toBe(true);
    expect(await passes(noRanking(), "Works mostly your hamstrings.")).toBe(true);
  });

  it("should fail a reply that names a muscle where no exercise was found", async () => {
    expect(await passes(noMusclesNamed(), "No such exercise. It may work your quads.")).toBe(false);
    expect(await passes(noMusclesNamed(), "No such exercise is in Ki-Lo.")).toBe(true);
  });

  it("should count figures with the graders that hold the numbers", async () => {
    const turn = turnResult({ exerciseMuscles: [romanian, legCurl] });

    expect((await figuresDrawnFor(/romanian/i, /leg curl/i)(contextOf(turn))).passed).toBe(true);
    expect((await figuresDrawnFor(/curl/i, /curl/i)(contextOf(turn))).passed).toBe(false);
    expect((await noFigureDrawn()(contextOf(turn))).passed).toBe(false);
    expect((await noFigureDrawn()(contextOf(turnResult()))).passed).toBe(true);
  });
});

describe("what fails the set whatever the percentage", () => {
  it("should mark a write and an action row as critical", async () => {
    const turn = turnFor("muscles-one", {
      toolCalls: [...(rightTurns["muscles-one"]?.toolCalls ?? []), writeTool("log_entry", {})],
    });

    const outcomes = await Promise.all(
      caseOf("muscles-one").expect.map((grade) => grade(contextOf(turn, database({ actions: 1 })))),
    );

    expect(outcomes.filter(({ critical }) => critical === true)).toHaveLength(2);
  });

  it("should fail a workout in progress that was changed, in the case that starts one", async () => {
    const turn = turnFor("muscles-during-workout");

    expect(
      await failuresOf("muscles-during-workout", turn, database({ sets: LIVE_WORKOUT.sets + 1 })),
    ).toEqual([expect.stringContaining("holds 3 sets")]);
  });

  it("should fail the first person as a soft miss", async () => {
    const turn = turnFor("muscles-one", { answer: "I think it works your hamstrings." });
    const outcomes = await Promise.all(
      caseOf("muscles-one").expect.map((grade) => grade(contextOf(turn))),
    );

    const soft = outcomes.filter((outcome) => outcome.soft === true);
    expect(soft).toHaveLength(1);
    expect(soft[0]?.reason).toContain("first person");
  });

  it("should print the question and the tools of a failure, and never the answer", async () => {
    const turn = turnFor("muscles-one", {
      answer: "Quads are secret-sentinel words.",
      exerciseMuscles: undefined,
    });

    const reasons = await failuresOf("muscles-one", turn);

    expect(reasons.length).toBeGreaterThan(0);
    for (const reason of reasons) {
      expect(reason).toContain('question: "What muscles does a Romanian deadlift work?"');
      expect(reason).toContain("tools: search_exercises(");
      expect(reason).not.toContain("sentinel");
    }
  });
});
