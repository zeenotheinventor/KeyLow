import { toLocalDate } from "@keylow/core/dates";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fakeEnvironment } from "./fakeEnvironment.ts";
import { fakeDatabase, readTool, turnResult, writeTool } from "./helpers.ts";
import { DIARY_READ_TOOLS, READ_TOOLS } from "../cases/ask.ts";
import {
  ADVICE_THEMES,
  MUST_PASS_IDS,
  adviceCasesOf,
  adviceSpecs,
  neverSaysThisWeek,
  noInventedLoad,
  noMarkerNames,
  resolveFacts,
  saysAtLeast,
} from "../cases/trainingAdvice.ts";
import { exerciseNameOf } from "../cases/trainingAdviceFacts.ts";
import { LIBRARY_EXERCISE_KEYS } from "../fixtures/training.ts";
import { THRESHOLD_PERCENT } from "../src/thresholds.ts";
import { LIVE_WORKOUT } from "../src/trainingWorld.ts";
import { trainingWorldHolder } from "../src/trainingWorldHolder.ts";

import type { AdviceFacts, AdviceSpec, CallRule } from "../cases/trainingAdvice.ts";
import type { Evidence } from "../cases/trainingAdviceGraders.ts";
import type { TrainingExercise } from "../fixtures/training.ts";
import type { EvalCase, GradeContext, GradeOutcome } from "../src/case.ts";
import type { SuggestionAnswer, TrainingWorld } from "../src/trainingWorld.ts";
import type { ToolCall, TurnResult } from "../src/types.ts";
import type { MuscleStateRow } from "@keylow/core/training";

const ANCHOR = new Date().toISOString().slice(0, 10);

const EXERCISE_IDS = new Map<TrainingExercise, string>(
  [...LIBRARY_EXERCISE_KEYS, "facePull" as const].map((key, index) => [
    key,
    `e5e70000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  ]),
);
// An exercise the library has and the history does not: a search for "squat" finds it before the barbell squat.
const FRONT_SQUAT_ID = "f0f00000-0000-4000-8000-000000000001";

const muscleRow = (
  muscle: string,
  heatPercent: number,
  readyAt: string,
  status = "Productive",
): MuscleStateRow => ({
  muscle,
  heat: heatPercent > 50 ? "Hot" : "Cool",
  heat_percent: heatPercent,
  ready_at: readyAt,
  sets: 4.5,
  target: 10,
  status,
  targeted: true,
});

type WorldCalls = string[];

const suggestionOf = (minutes: number | null, today: string): SuggestionAnswer =>
  minutes === 15
    ? { kind: "nothing", day: today }
    : {
        kind: "session",
        day: today,
        sets: 14,
        minutes: 52,
        exerciseSets: [3, 4],
        repRanges: [[6, 10]],
      };

function fakeWorld(
  calls: WorldCalls = [],
  suggestion: TrainingWorld["suggestion"] = ({ minutes }, now) =>
    Promise.resolve(suggestionOf(minutes, toLocalDate(new Date(now), "UTC"))),
): TrainingWorld {
  return {
    anchorDate: ANCHOR,
    ensureHistory: () => {
      calls.push("history");
      return Promise.resolve();
    },
    exerciseIds: () => Promise.resolve(EXERCISE_IDS),
    exerciseName: (id) => {
      if (id === FRONT_SQUAT_ID) {
        return Promise.resolve("Front Squat");
      }
      const key = [...EXERCISE_IDS].find(([, candidate]) => candidate === id)?.[0];
      return Promise.resolve(key === undefined ? null : exerciseNameOf(key));
    },
    suggestion,
    muscleFacts: (area) =>
      Promise.resolve({
        rows: [
          muscleRow("Quads", 62, "Thu 14:30", "High"),
          muscleRow("Hamstrings", 61.5, "Thu 10:00"),
          muscleRow("Lats", 8, "now"),
        ],
        area: area === null ? null : { sets: 5.5, target: 12 },
      }),
    clearGoal: () => {
      calls.push("clear goal");
      return Promise.resolve();
    },
    restoreGoal: () => {
      calls.push("restore goal");
      return Promise.resolve();
    },
    startWorkout: () => {
      calls.push("start workout");
      return Promise.resolve();
    },
    discardWorkout: () => {
      calls.push("discard workout");
      return Promise.resolve();
    },
  };
}

const world = fakeWorld();
const specs = adviceSpecs(ANCHOR);
const cases = adviceCasesOf(ANCHOR, () => world);
const caseOf = (id: string): EvalCase => {
  const found = cases.find((evalCase) => evalCase.id === id);
  if (found === undefined) {
    throw new Error(`no case ${id}`);
  }
  return found;
};
const specOf = (id: string): AdviceSpec => {
  const found = specs.find((spec) => spec.id === id);
  if (found === undefined) {
    throw new Error(`no spec ${id}`);
  }
  return found;
};

// The exercise of the history whose name has one of the family's words.
const exerciseOfFamily = (family: readonly string[]): TrainingExercise => {
  const found = [...EXERCISE_IDS.keys()].find((key) =>
    family.some((word) => exerciseNameOf(key).toLowerCase().includes(word.toLowerCase())),
  );
  if (found === undefined) {
    throw new Error(`no exercise of ${family.join(", ")}`);
  }
  return found;
};

// The call that satisfies a rule, as a model that read the question would make it.
function callFor(rule: CallRule): ToolCall {
  if ("anyOf" in rule) {
    return readTool(rule.anyOf[0]);
  }
  switch (rule.tool) {
    case "suggest_next_session":
      return readTool(rule.tool, {
        minutes: rule.minutes ?? null,
        equipment: rule.onlyEquipment ?? null,
      });
    case "get_exercise_progress": {
      const exercise = "exercise" in rule ? rule.exercise : exerciseOfFamily(rule.family);
      return readTool(rule.tool, { exercise_id: EXERCISE_IDS.get(exercise), range: "3m" });
    }
    case "get_muscle_state":
      return readTool(rule.tool, { area: rule.area });
    case "get_routines":
      return readTool(rule.tool, { routine_id: rule.reads === "routine" ? "routine-1" : null });
    case "get_workouts": {
      const days = rule.covers ?? [ANCHOR];
      return readTool(rule.tool, { from: days[0], to: days.at(-1), session_id: null });
    }
  }
}

const SAMPLE_LINES = ["Based on 1 workout, 21 Oct", "No workouts, 1 to 2 Sep"];
const lineOf = (facts: AdviceFacts): string | null => {
  const [first] = facts.citations;
  if (first === undefined) {
    return null;
  }
  return typeof first === "string"
    ? first
    : (SAMPLE_LINES.find((line) => first.test(line)) ?? null);
};

const sayEvidence = ({ numbers = [], words = [] }: Evidence): string =>
  numbers[0] === undefined ? (words[0] ?? "") : String(numbers[0].value);

// The reply a model that did everything right would give, made from the facts and nothing else.
function perfectTurn(
  spec: AdviceSpec,
  facts: AdviceFacts,
  overrides: Partial<TurnResult> = {},
): TurnResult {
  return turnResult({
    answer: [
      ...facts.mentions.map(([firstWord]) => firstWord ?? ""),
      ...(facts.routes[0] ?? []).map(sayEvidence),
      facts.stallIsAtLeast ? "at least" : "",
    ]
      .filter((part) => part !== "")
      .join(", "),
    toolCalls: spec.calls.map(callFor),
    answerMeta: { citation: lineOf(facts), estimate: null },
    ...overrides,
  });
}

const liveDatabase = () =>
  fakeDatabase({
    rows: { workout_sessions: [{ id: "live-session" }] },
    rowCounts: { workout_sets: LIVE_WORKOUT.sets },
  });

async function outcomesOf(
  evalCase: EvalCase,
  turn: TurnResult,
  database = fakeDatabase(),
): Promise<GradeOutcome[]> {
  const context: GradeContext = { turns: [turn], database };
  return Promise.all(evalCase.expect.map((grade) => grade(context)));
}

async function failuresOf(
  evalCase: EvalCase,
  turn: TurnResult,
  database = fakeDatabase(),
): Promise<string[]> {
  return (await outcomesOf(evalCase, turn, database))
    .filter(({ passed }) => !passed)
    .map(({ reason }) => reason);
}

const databaseFor = (spec: AdviceSpec) => (spec.duringWorkout ? liveDatabase() : fakeDatabase());
const nowIso = () => new Date().toISOString();

// A perfect turn of a case, with the changes a test wants made to it.
async function turnOf(id: string, change: Partial<TurnResult> = {}) {
  const spec = specOf(id);
  const turn = perfectTurn(
    spec,
    await resolveFacts(spec, world, nowIso(), spec.calls.map(callFor)),
    change,
  );
  return { spec, turn };
}

const run = async (id: string, change: Partial<TurnResult>) => {
  const { spec, turn } = await turnOf(id, change);
  return failuresOf(caseOf(id), turn, databaseFor(spec));
};

afterEach(() => {
  vi.useRealTimers();
});

describe("the training advice set", () => {
  it("should have 26 cases in the five themes of the ticket", () => {
    expect(cases).toHaveLength(26);
    expect(
      ADVICE_THEMES.map((theme) => specs.filter((spec) => spec.theme === theme).length),
    ).toEqual([6, 7, 6, 5, 2]);
  });

  it("should belong to the trainingAdvice set, which has the 90 % threshold", () => {
    expect(cases.every(({ set }) => set === "trainingAdvice")).toBe(true);
    expect(THRESHOLD_PERCENT.trainingAdvice).toBe(90);
  });

  it("should give every case its own id and its own question", () => {
    expect(new Set(cases.map(({ id }) => id)).size).toBe(26);
    expect(new Set(cases.flatMap(({ messages }) => messages)).size).toBe(26);
  });

  it("should say Ki-Lo and use no em dash in any question", () => {
    for (const message of cases.flatMap(({ messages }) => messages)) {
      expect(message).not.toMatch(/—/);
      expect(message).not.toMatch(/Ki Lo|KiLo/);
    }
  });

  it("should date its questions from the day of the run", () => {
    const earlier = adviceSpecs("2026-01-15").map(({ messages }) => messages[0]);
    const later = adviceSpecs("2026-06-15").map(({ messages }) => messages[0]);
    expect(earlier.filter((question, index) => question !== later[index])).toHaveLength(2);
  });

  it("should leave the diary's read tools as they were, so the food sets stay strict", () => {
    expect([...DIARY_READ_TOOLS].sort()).toEqual(
      [
        "ask_user",
        "get_day",
        "get_entries",
        "get_food",
        "get_range_totals",
        "get_recipes",
        "get_weigh_ins",
        "search_foods",
      ].sort(),
    );
    for (const tool of ["get_exercise_progress", "get_muscle_state", "get_workouts"]) {
      expect(READ_TOOLS.has(tool)).toBe(true);
      expect(DIARY_READ_TOOLS.has(tool)).toBe(false);
    }
  });

  it("should mark the four cases that fail the set whatever the percentage", () => {
    expect([...MUST_PASS_IDS].sort()).toEqual(
      ["progress-bench-stalled", "train-no-goal", "workout-so-far", "workout-what-next"].sort(),
    );
    expect(
      cases
        .filter(({ mustPass }) => mustPass === true)
        .map(({ id }) => id)
        .sort(),
    ).toEqual([...MUST_PASS_IDS].sort());
  });
});

describe("a reply a right model would give", () => {
  it.each(specs.map((spec) => [spec.id, spec] as const))("should pass %s", async (id, spec) => {
    const { turn } = await turnOf(id);

    expect(await failuresOf(caseOf(id), turn, databaseFor(spec))).toEqual([]);
  });

  it("should expect the sets and the minutes of the one day the tool answers for", async () => {
    const facts = await resolveFacts(specOf("train-today"), world, nowIso());

    expect(facts.routes).toHaveLength(1);
    expect(facts.routes[0]?.map(sayEvidence)).toEqual(["14", "52"]);
    expect(await run("train-today", { answer: "14 sets and 52 minutes, at 6-10 reps." })).toEqual(
      [],
    );
    expect(await run("train-today", { answer: "9 sets and 52 minutes." })).toEqual(
      expect.arrayContaining([expect.stringContaining("wanted 14 and 52")]),
    );
  });

  it("should ask for no figure when there is nothing to suggest, and say so", async () => {
    expect(
      await run("train-fifteen-minutes", { answer: "Nothing fits in 15 minutes today." }),
    ).toEqual([]);
    expect(await run("train-fifteen-minutes", { answer: "Sorry about that." })).toEqual([
      expect.stringContaining('the answer does not say "nothing"'),
    ]);
  });

  it("should take a load in pounds as well as in kilograms", async () => {
    const facts = await resolveFacts(specOf("progress-squat-rising"), world, nowIso());
    const pounds = facts.routes[1]?.[0]?.numbers?.[0]?.value;

    expect(pounds).toBeGreaterThan(200);
    expect(
      await run("progress-squat-rising", { answer: `Your squat is up to ${pounds} lb.` }),
    ).toEqual([]);
  });

  it("should take a number in words for 0 to 12", async () => {
    expect(await run("progress-bench-stalled", { answer: "Three weeks without a gain." })).toEqual(
      [],
    );
  });
});

describe("a progress question that finds more than one exercise", () => {
  const readFrontSquat = readTool("get_exercise_progress", { exercise_id: FRONT_SQUAT_ID });

  it("should pass a read of any exercise of the family, graded against the one it read", async () => {
    const id = "progress-bench-stalled";
    const spec = specOf(id);
    const facts = await resolveFacts(spec, world, nowIso(), spec.calls.map(callFor));

    expect(facts.routes[0]?.map(sayEvidence)).toEqual(["3"]);
  });

  it("should expect no figure at all of an exercise of the family that was never trained", async () => {
    const spec = specOf("progress-squat-rising");
    const facts = await resolveFacts(
      { ...spec, expects: { kind: "progress", family: ["squat"] } },
      world,
      nowIso(),
      [readFrontSquat],
    );

    expect(facts.routes).toEqual([[]]);
    expect(facts.allowed).toEqual({ loads: [], setCounts: [], repRanges: [] });
  });

  it("should fail the load of another exercise quoted for the one that was read", async () => {
    const failures = await run("progress-bench-stalled", {
      answer: "Three weeks. Your best is 112.5 kg.",
    });

    expect(failures).toEqual([expect.stringContaining("a load of 112.5")]);
  });

  it("should fail a read of an exercise outside the family", async () => {
    const failures = await run("progress-overhead-press", {
      toolCalls: [readTool("get_exercise_progress", { exercise_id: EXERCISE_IDS.get("squat") })],
    });

    expect(failures).toEqual([expect.stringContaining("military press")]);
  });

  it("should pass a question to the person in place of an answer", async () => {
    const { turn } = await turnOf("progress-bench-stalled", {
      status: "clarify",
      toolCalls: [readTool("search_exercises", { query: "bench" }), readTool("ask_user", {})],
      answer: "Which bench press do you mean?",
      answerMeta: undefined,
    });

    expect(await failuresOf(caseOf("progress-bench-stalled"), turn)).toEqual([]);
  });

  it("should not take a question for an answer in a case that may not ask", async () => {
    const { turn } = await turnOf("train-today", { status: "clarify", answer: "Which day?" });

    expect((await failuresOf(caseOf("train-today"), turn)).join(" ")).toContain("ended clarify");
  });

  it("should need the exact exercise when the question gives the library's name", async () => {
    const failures = await run("progress-squat-rising", {
      toolCalls: [readFrontSquat],
      answer: "No sets of it yet.",
    });

    expect(failures).toEqual(
      expect.arrayContaining([expect.stringContaining("not with the expected arguments")]),
    );
  });

  it("should allow the change beside a week, which is a difference of two loads", async () => {
    const failures = await run("progress-squat-rising", {
      answer: "Up to 112.5 kg, +2.5 kg on the week before.",
    });

    expect(failures).toEqual([]);
  });

  it("should fail a load to try next when the question asked what to lift", async () => {
    expect(await run("progress-bench-next-load", { answer: "Three weeks. Try 77.5 kg." })).toEqual([
      expect.stringContaining("a load of 77.5"),
    ]);
    expect(
      await run("progress-bench-next-load", { answer: "Three weeks, last at 75 kg." }),
    ).toEqual([]);
  });
});

describe("the numbers come from core", () => {
  it("should count the weeks of the bench stall from the fixture's story", async () => {
    const spec = specOf("progress-bench-stalled");
    const facts = await resolveFacts(spec, world, nowIso(), spec.calls.map(callFor));

    expect(facts.routes[0]?.map(sayEvidence)).toEqual(["3"]);
    expect(facts.stallIsAtLeast).toBe(false);
  });

  it("should give the squat's latest load when it has not stalled", async () => {
    const facts = await resolveFacts(specOf("progress-squat-rising"), world, nowIso());

    expect(facts.routes[0]?.[0]?.numbers?.[0]).toEqual({ value: 112.5, tolerance: 0.05 });
  });

  it("should give the top loads of the day a workout was on", async () => {
    const facts = await resolveFacts(specOf("workouts-yesterday"), world, nowIso());

    expect(facts.routes[0]?.map(sayEvidence)).toEqual(["112.5", "190", "90"]);
  });

  it("should expect no workout, and allow no figure, before the first one", async () => {
    const facts = await resolveFacts(specOf("workouts-before-the-first"), world, nowIso());

    expect(facts.routes).toEqual([[]]);
    expect(facts.allowed).toEqual({ loads: [], setCounts: [], repRanges: [] });
  });
});

describe("recovery and volume", () => {
  it("should take a percent, a ready time or the heat word for a recovery question", async () => {
    for (const answer of ["Your arms are at 62 percent.", "Ready Thu 14:30.", "They are hot."]) {
      expect(await run("recovery-arms-recovered", { answer })).toEqual([]);
    }
    expect(await run("recovery-arms-recovered", { answer: "Probably fine." })).toEqual([
      expect.stringContaining("the answer does not hold the figures"),
    ]);
  });

  it("should take any muscle within a point of the hottest, or marked high, for the overworked question", async () => {
    for (const answer of ["Your quads.", "Hamstrings are close behind."]) {
      expect(await run("recovery-overworked", { answer })).toEqual([]);
    }
    expect(await run("recovery-overworked", { answer: "Your lats." })).toEqual([
      expect.stringContaining("does not say"),
    ]);
  });

  it('should let an answer echo the question\'s own words, "this week"', async () => {
    expect(await run("recovery-overworked", { answer: "Quads are overworked this week." })).toEqual(
      [],
    );
  });

  it('should fail a volume that is called "this week" when the question did not say it', async () => {
    const failures = await run("recovery-back-volume", {
      answer: "5.5 sets of 12, so this week is fine.",
    });

    expect(failures).toEqual([expect.stringContaining('"this week"')]);
  });

  it("should not need the answer to say where the number came from", async () => {
    expect(await run("recovery-back-volume", { answer: "5.5 of 12 sets." })).toEqual([]);
  });
});

describe("what makes a case fail", () => {
  it("should fail a case that never called the tool", async () => {
    expect(await run("train-today", { toolCalls: [] })).toEqual([
      expect.stringContaining("suggest_next_session was not called"),
    ]);
  });

  it("should fail a time limit that did not reach the tool", async () => {
    const failures = await run("train-thirty-minutes", {
      toolCalls: [readTool("suggest_next_session", { minutes: null, equipment: null })],
    });

    expect(failures).toEqual([expect.stringContaining("not with the expected arguments")]);
  });

  it("should fail dumbbells only when the equipment named is wider", async () => {
    const failures = await run("train-dumbbells-only", {
      toolCalls: [
        readTool("suggest_next_session", { minutes: null, equipment: ["dumbbell", "barbell"] }),
      ],
    });

    expect(failures).toHaveLength(1);
  });

  it("should fail an answer that misses the weeks of the stall", async () => {
    expect(await run("progress-bench-stalled", { answer: "It has stalled for 5 weeks." })).toEqual([
      expect.stringContaining("wanted 3"),
    ]);
  });

  it("should fail a load that no tool of the case gave", async () => {
    const failures = await run("progress-bench-stalled", { answer: "3 weeks. Try 80 kg next." });

    expect(failures).toEqual([expect.stringContaining("a load of 80")]);
  });

  it("should fail a load with no unit", async () => {
    const failures = await run("progress-bench-stalled", { answer: "3 weeks. Go for 85 next." });

    expect(failures).toEqual([expect.stringContaining("a load of 85 with no unit")]);
  });

  it("should fail a set count that no tool of the case gave", async () => {
    const failures = await run("train-today", {
      answer: "14 sets, 52 minutes, then 7 sets of curls.",
    });

    expect(failures).toEqual([expect.stringContaining("7 sets")]);
  });

  it("should take the set count of another tool as invented in a progress case", async () => {
    const failures = await run("progress-bench-stalled", { answer: "3 weeks. Do 4 sets." });

    expect(failures).toEqual([expect.stringContaining("4 sets")]);
  });

  it("should always allow zero sets", async () => {
    expect(
      await run("progress-bench-stalled", { answer: "3 weeks, and 0 sets this week." }),
    ).toEqual([]);
  });

  it("should fail a rep range that no tool gave, with or without the word reps", async () => {
    for (const range of ["at 15-20 reps", "for 15 to 20", "sets of 15-20"]) {
      const failures = await run("train-today", { answer: `14 sets, 52 minutes, ${range}.` });

      expect(failures).toEqual([expect.stringContaining("a rep range of 15 to 20")]);
    }
  });

  it("should allow a rep range the suggestion gave", async () => {
    expect(await run("train-today", { answer: "14 sets, 52 minutes, at 6-10 reps." })).toEqual([]);
    expect(await run("train-today", { answer: "14 sets, 52 minutes, sets of 6 to 10." })).toEqual(
      [],
    );
  });

  it("should not take minutes, weeks or a percent for a rep range or a load", async () => {
    expect(
      await run("train-today", { answer: "14 sets, 52 minutes, or 45 to 60 minutes, 80% done." }),
    ).toEqual([]);
  });

  it("should fail the name of a marker", async () => {
    expect(
      await run("train-no-goal", { answer: "The needs_goal flag is on, so set a goal." }),
    ).toEqual([expect.stringContaining("prints the name of a marker")]);
  });

  it("should fail an empty apology where a state has a word it cannot be answered without", async () => {
    expect(await run("train-no-goal", { answer: "Sorry, I cannot help." })).toEqual(
      expect.arrayContaining([expect.stringContaining('does not say "goal"')]),
    );
    expect(await run("train-no-goal", { answer: "Set a goal in the app first." })).toEqual([]);
    expect(await run("progress-untrained", { answer: "Sorry, nothing found." })).toEqual([
      expect.stringContaining('"pull"'),
    ]);
  });

  it("should fail a line under the answer that is not a tool's", async () => {
    const failures = await run("progress-bench-stalled", {
      answerMeta: { citation: "Based on 3 entries today and your targets", estimate: null },
    });

    expect(failures).toEqual([expect.stringContaining("not the tool's")]);
  });

  it("should fail a turn that did not end with an answer", async () => {
    const failures = await run("train-today", { status: "refused" });

    expect(failures).toEqual([expect.stringContaining("ended refused")]);
  });

  it("should fail the first person", async () => {
    expect(await run("train-today", { answer: "14, 52. I would start with squats." })).toEqual([
      expect.stringContaining("first person"),
    ]);
  });

  it("should fail a workout in progress that was changed or finished", async () => {
    const { turn } = await turnOf("workout-what-next");
    const changed = fakeDatabase({
      rows: { workout_sessions: [{ id: "live-session" }] },
      rowCounts: { workout_sets: LIVE_WORKOUT.sets + 1 },
    });

    expect(await failuresOf(caseOf("workout-what-next"), turn, changed)).toEqual([
      expect.stringContaining("holds 3 sets"),
    ]);
    expect(await failuresOf(caseOf("workout-what-next"), turn, fakeDatabase())).toEqual([
      expect.stringContaining("not the one open workout"),
    ]);
  });
});

describe("what fails the set whatever the percentage", () => {
  it("should mark an action row and a tool that is not a read as critical, and nothing else", async () => {
    const { spec, turn } = await turnOf("train-today", {
      toolCalls: [readTool("suggest_next_session", {}), writeTool("log_entry", {})],
    });

    const outcomes = await outcomesOf(
      caseOf("train-today"),
      turn,
      fakeDatabase({ rowCounts: { assistant_actions: 1 } }),
    );
    const failed = outcomes.filter(({ passed }) => !passed);

    expect(spec.id).toBe("train-today");
    expect(failed.filter(({ critical }) => critical === true).map(({ reason }) => reason)).toEqual([
      expect.stringContaining("log_entry is not a read tool"),
      expect.stringContaining("left rows in assistant_actions"),
    ]);
  });

  it("should not mark an ordinary miss as critical", async () => {
    const { turn } = await turnOf("train-today", { answer: "9 sets and 52 minutes." });

    const outcomes = await outcomesOf(caseOf("train-today"), turn);

    expect(outcomes.some(({ passed, critical }) => !passed && critical === undefined)).toBe(true);
    expect(outcomes.some(({ critical }) => critical === true)).toBe(false);
  });
});

describe("the failure line", () => {
  it("should print the question and the tools with their arguments and how they ended, and never the answer", async () => {
    const failures = await run("progress-bench-stalled", {
      answer: "SECRET-ANSWER-TEXT 80 kg",
      toolCalls: [
        {
          name: "get_exercise_progress",
          input: { exercise_id: EXERCISE_IDS.get("benchPress") },
          readOnlyHint: true,
          errorCode: "not_found",
        },
      ],
    });

    expect(failures.length).toBeGreaterThan(0);
    for (const reason of failures) {
      expect(reason).toContain('question: "Why has my bench stalled?"');
      expect(reason).toContain(`"exercise_id":"${EXERCISE_IDS.get("benchPress")}"}) [not_found]`);
      expect(reason).not.toContain("SECRET-ANSWER-TEXT");
    }
    expect(failures.join(" ")).toContain("wanted 3");
  });
});

describe("the rules of the tools", () => {
  const answerContext = (answer: string): GradeContext => ({
    turns: [turnResult({ answer })],
    database: fakeDatabase(),
  });

  it('should demand "at least" for a stall the tool could not count to its start', async () => {
    expect((await saysAtLeast()(answerContext("Stalled for at least 9 weeks."))).passed).toBe(true);
    expect((await saysAtLeast()(answerContext("Stalled for 9 weeks."))).passed).toBe(false);
  });

  it('should fail "this week"', async () => {
    expect((await neverSaysThisWeek()(answerContext("This week you did 6 sets."))).passed).toBe(
      false,
    );
    expect((await neverSaysThisWeek()(answerContext("In the last 7 days."))).passed).toBe(true);
  });

  it("should name the markers by their tool names only", async () => {
    expect((await noMarkerNames()(answerContext("You have no goal set yet."))).passed).toBe(true);
    expect((await noMarkerNames()(answerContext("first_visit is true"))).passed).toBe(false);
  });

  it("should not take a date, a time or a plain count for a load", async () => {
    const allowed = { loads: [], setCounts: [], repRanges: [] };

    for (const answer of [
      "On 3 November you trained for 52 minutes.",
      "Ready Thu 14:30, at 62%.",
      "Over 2026-11-03, 6 workouts in 12 days.",
    ]) {
      expect((await noInventedLoad(allowed)(answerContext(answer))).passed).toBe(true);
    }
  });

  it("should take the numbers the case expects for bare numbers", async () => {
    const allowed = { loads: [], setCounts: [], repRanges: [] };

    expect((await noInventedLoad(allowed, [62])(answerContext("Heat is 62"))).passed).toBe(true);
    expect((await noInventedLoad(allowed)(answerContext("Heat is 62"))).passed).toBe(false);
  });
});

describe("the clock", () => {
  it("should take the sets of the day the case started on when the run crossed midnight", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-05T23:59:30Z") });
    // The tool answers 14 sets on the 5th and 20 on the 6th, by the day of the clock.
    const midnightWorld = fakeWorld([], (query, now) =>
      Promise.resolve(
        query.minutes === null && now.startsWith("2026-11-05")
          ? { ...suggestionOf(null, "2026-11-05"), sets: 14 }
          : { ...suggestionOf(null, "2026-11-06"), sets: 20 },
      ),
    );
    const [evalCase] = adviceCasesOf("2026-11-05", () => midnightWorld).filter(
      ({ id }) => id === "train-today",
    );
    await evalCase?.setup?.(fakeEnvironment());
    vi.setSystemTime(new Date("2026-11-06T00:00:20Z"));

    const turn = turnResult({
      answer: "14 sets and 52 minutes.",
      toolCalls: [readTool("suggest_next_session", { minutes: null, equipment: null })],
      answerMeta: { citation: "Based on Ki-Lo's suggestion for today", estimate: null },
    });

    expect(evalCase === undefined ? ["missing"] : await failuresOf(evalCase, turn)).toEqual([]);
  });
});

describe("the world a case needs", () => {
  const caseWith = (id: string, calls: WorldCalls) => {
    const found = adviceCasesOf(ANCHOR, () => fakeWorld(calls)).find(
      (evalCase) => evalCase.id === id,
    );
    if (found === undefined) {
      throw new Error(`no case ${id}`);
    }
    return found;
  };

  it("should write the history in prepare, outside the case, and not in setup", async () => {
    const calls: WorldCalls = [];
    const evalCase = caseWith("train-today", calls);

    await evalCase.prepare?.();
    await evalCase.setup?.(fakeEnvironment());

    expect(calls).toEqual(["history"]);
    expect(evalCase.cleanUp).toBeUndefined();
  });

  it("should close the goal for the goal-less case and restore it after", async () => {
    const calls: WorldCalls = [];
    const evalCase = caseWith("train-no-goal", calls);

    await evalCase.setup?.(fakeEnvironment());
    await evalCase.cleanUp?.([], fakeEnvironment());

    expect(calls).toEqual(["clear goal", "restore goal"]);
  });

  it("should start a workout for the live cases and discard it after", async () => {
    const calls: WorldCalls = [];
    const evalCase = caseWith("workout-so-far", calls);

    await evalCase.setup?.(fakeEnvironment());
    await evalCase.cleanUp?.([], fakeEnvironment());

    expect(calls).toEqual(["start workout", "discard workout"]);
  });

  it("should say so when no session attached the training world", async () => {
    await trainingWorldHolder.detach();

    expect(() => trainingWorldHolder.current()).toThrow(/attached the training world/);
  });
});
