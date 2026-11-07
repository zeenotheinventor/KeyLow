import { describe, expect, it } from "vitest";

import { fakeEnvironment } from "./fakeEnvironment.ts";
import { fakeDatabase, readTool, turnResult, writeTool } from "./helpers.ts";
import { DIARY_READ_TOOLS, READ_TOOLS } from "../cases/ask.ts";
import {
  ADVICE_THEMES,
  adviceCasesOf,
  adviceSpecs,
  neverSaysThisWeek,
  noInventedLoad,
  noMarkerNames,
  resolveFacts,
  saysAtLeast,
  saysLastSevenDays,
} from "../cases/trainingAdvice.ts";
import { LIBRARY_EXERCISE_KEYS } from "../fixtures/training.ts";
import { THRESHOLD_PERCENT } from "../src/thresholds.ts";
import { LIVE_WORKOUT } from "../src/trainingWorld.ts";
import { trainingWorldHolder } from "../src/trainingWorldHolder.ts";

import type { AdviceFacts, AdviceSpec, CallRule } from "../cases/trainingAdvice.ts";
import type { TrainingExercise } from "../fixtures/training.ts";
import type { EvalCase, GradeContext } from "../src/case.ts";
import type { TrainingWorld } from "../src/trainingWorld.ts";
import type { ToolCall, TurnResult } from "../src/types.ts";
import type { MuscleStateRow } from "@keylow/core/training";

const ANCHOR = new Date().toISOString().slice(0, 10);

const EXERCISE_IDS = new Map<TrainingExercise, string>(
  [...LIBRARY_EXERCISE_KEYS, "facePull" as const].map((key, index) => [
    key,
    `e5e70000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  ]),
);

const muscleRow = (muscle: string, heatPercent: number, readyAt: string): MuscleStateRow => ({
  muscle,
  heat: "Warm",
  heat_percent: heatPercent,
  ready_at: readyAt,
  sets: 4.5,
  target: 10,
  status: "Productive",
  targeted: true,
});

type WorldCalls = string[];

function fakeWorld(calls: WorldCalls = []): TrainingWorld {
  return {
    anchorDate: ANCHOR,
    ensureHistory: () => {
      calls.push("history");
      return Promise.resolve();
    },
    exerciseIds: () => Promise.resolve(EXERCISE_IDS),
    // Every day has the same session, except that a limit of 15 minutes leaves nothing to suggest.
    suggestionFacts: ({ minutes }) =>
      Promise.resolve(minutes === 15 ? null : { sets: 14, minutes: 52, repRanges: [[6, 10]] }),
    muscleFacts: (area) =>
      Promise.resolve({
        rows: [muscleRow("Quads", 62, "Thu 14:30"), muscleRow("Lats", 8, "now")],
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
    case "get_exercise_progress":
      return readTool(rule.tool, { exercise_id: EXERCISE_IDS.get(rule.exercise), range: "3m" });
    case "get_muscle_state":
      return readTool(rule.tool, { area: rule.area });
    case "get_routines":
      return readTool(rule.tool, { routine_id: rule.reads === "routine" ? "routine-1" : null });
    case "get_workouts": {
      const days = rule.covers ?? [ANCHOR];
      return readTool(rule.tool, {
        from: days[0],
        to: days.at(-1),
        session_id: null,
      });
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

// The reply a model that did everything right would give, made from the facts and nothing else.
function perfectTurn(
  spec: AdviceSpec,
  facts: AdviceFacts,
  overrides: Partial<TurnResult> = {},
): TurnResult {
  return turnResult({
    answer: [
      ...facts.mentions.map(([firstWord]) => firstWord),
      ...(facts.routes[0] ?? []).map(({ value }) => String(value)),
      spec.sevenDays ? "over the last 7 days" : "",
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

async function failuresOf(
  evalCase: EvalCase,
  turn: TurnResult,
  database = fakeDatabase(),
): Promise<string[]> {
  const context: GradeContext = { turns: [turn], database };
  const outcomes = await Promise.all(evalCase.expect.map((grade) => grade(context)));
  return outcomes.filter(({ passed }) => !passed).map(({ reason }) => reason);
}

const databaseFor = (spec: AdviceSpec) => (spec.duringWorkout ? liveDatabase() : fakeDatabase());
const nowIso = () => new Date().toISOString();

describe("the training advice set", () => {
  it("should have 25 cases in the five themes of the ticket", () => {
    expect(cases).toHaveLength(25);
    expect(
      ADVICE_THEMES.map((theme) => specs.filter((spec) => spec.theme === theme).length),
    ).toEqual([6, 6, 6, 5, 2]);
  });

  it("should belong to the trainingAdvice set, which has the 90 % threshold", () => {
    expect(cases.every(({ set }) => set === "trainingAdvice")).toBe(true);
    expect(THRESHOLD_PERCENT.trainingAdvice).toBe(90);
  });

  it("should give every case its own id and its own question", () => {
    expect(new Set(cases.map(({ id }) => id)).size).toBe(25);
    expect(new Set(cases.flatMap(({ messages }) => messages)).size).toBe(25);
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
});

describe("a reply a right model would give", () => {
  it.each(specs.map((spec) => [spec.id, spec] as const))("should pass %s", async (id, spec) => {
    const facts = await resolveFacts(spec, world, nowIso());

    expect(await failuresOf(caseOf(id), perfectTurn(spec, facts), databaseFor(spec))).toEqual([]);
  });

  it("should pass a suggestion for any day the Today card could pick, with its own minutes", async () => {
    const spec = specOf("train-today");
    const facts = await resolveFacts(spec, world, nowIso());

    expect(facts.routes[0]?.map(({ value }) => value)).toEqual([14, 52]);
    expect(
      await failuresOf(
        caseOf("train-today"),
        perfectTurn(spec, facts, { answer: "A session of 14 sets and 52 minutes." }),
      ),
    ).toEqual([]);
  });

  it("should accept the nothing to suggest of a tight limit, with no figure in the answer", async () => {
    const spec = specOf("train-fifteen-minutes");
    const facts = await resolveFacts(spec, world, nowIso());

    expect(facts.routes).toEqual([[]]);
    expect(
      await failuresOf(
        caseOf("train-fifteen-minutes"),
        perfectTurn(spec, facts, { answer: "Nothing fits in 15 minutes today." }),
      ),
    ).toEqual([]);
  });

  it("should take a load in pounds as well as in kilograms", async () => {
    const spec = specOf("progress-squat-rising");
    const facts = await resolveFacts(spec, world, nowIso());
    const pounds = facts.routes[1]?.[0]?.value;

    expect(pounds).toBeGreaterThan(200);
    expect(
      await failuresOf(
        caseOf("progress-squat-rising"),
        perfectTurn(spec, facts, { answer: `Your squat is up to ${pounds} lb.` }),
      ),
    ).toEqual([]);
  });

  it("should take the exercise read after a search", async () => {
    const spec = specOf("progress-own-exercise");
    const facts = await resolveFacts(spec, world, nowIso());

    expect(
      await failuresOf(
        caseOf("progress-own-exercise"),
        perfectTurn(spec, facts, {
          toolCalls: [
            readTool("search_exercises", { query: "face pull" }),
            ...spec.calls.map(callFor),
          ],
        }),
      ),
    ).toEqual([]);
  });
});

describe("the numbers come from core", () => {
  it("should count the weeks of the bench stall from the fixture's story", async () => {
    const facts = await resolveFacts(specOf("progress-bench-stalled"), world, nowIso());

    expect(facts.routes).toEqual([[{ value: 3, tolerance: 0 }]]);
    expect(facts.stallIsAtLeast).toBe(false);
  });

  it("should give the squat's latest load when it has not stalled", async () => {
    const facts = await resolveFacts(specOf("progress-squat-rising"), world, nowIso());

    expect(facts.routes[0]?.[0]).toEqual({ value: 112.5, tolerance: 0.05 });
  });

  it("should give the top loads of the day a workout was on", async () => {
    const facts = await resolveFacts(specOf("workouts-yesterday"), world, nowIso());

    expect(facts.routes[0]?.map(({ value }) => value)).toEqual([112.5, 190, 90]);
  });

  it("should expect no workout, and allow no figure, before the first one", async () => {
    const facts = await resolveFacts(specOf("workouts-before-the-first"), world, nowIso());

    expect(facts.routes).toEqual([[]]);
    expect(facts.allowed).toEqual({ loads: [], setCounts: [], repRanges: [] });
  });
});

describe("what makes a case fail", () => {
  const run = async (id: string, change: Partial<TurnResult>) => {
    const spec = specOf(id);
    const facts = await resolveFacts(spec, world, nowIso());
    return failuresOf(caseOf(id), perfectTurn(spec, facts, change), databaseFor(spec));
  };

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

  it("should fail the wrong exercise's progress", async () => {
    const failures = await run("progress-bench-stalled", {
      toolCalls: [readTool("get_exercise_progress", { exercise_id: "somebody-else" })],
    });

    expect(failures).toEqual([expect.stringContaining("not with the expected arguments")]);
  });

  it("should fail an answer that misses the weeks of the stall", async () => {
    expect(await run("progress-bench-stalled", { answer: "It has stalled for 5 weeks." })).toEqual([
      expect.stringContaining("wanted 3"),
    ]);
  });

  it("should fail a load that no tool gave", async () => {
    const failures = await run("progress-bench-stalled", { answer: "3 weeks. Try 80 kg next." });

    expect(failures).toEqual([expect.stringContaining("a load of 80")]);
  });

  it("should fail a set count that no tool gave", async () => {
    const failures = await run("train-today", {
      answer: "14 sets, 52 minutes, then 7 sets of curls.",
    });

    expect(failures).toEqual([expect.stringContaining("7 sets")]);
  });

  it("should fail a rep range that no tool gave", async () => {
    const failures = await run("train-today", { answer: "14 sets, 52 minutes, at 15-20 reps." });

    expect(failures).toEqual([expect.stringContaining("a rep range of 15 to 20")]);
  });

  it("should allow a rep range the suggestion gave", async () => {
    expect(await run("train-today", { answer: "14 sets, 52 minutes, at 6-10 reps." })).toEqual([]);
  });

  it("should fail the name of a marker", async () => {
    expect(await run("train-no-goal", { answer: "The needs_goal flag is on." })).toEqual([
      expect.stringContaining("prints the name of a marker"),
    ]);
  });

  it('should fail a volume that is called "this week"', async () => {
    const failures = await run("recovery-back-volume", {
      answer: "5.5, 12, over the last 7 days, so this week is fine.",
    });

    expect(failures).toEqual([expect.stringContaining('"this week"')]);
  });

  it("should fail a volume answer that never says the last 7 days", async () => {
    expect(await run("recovery-back-volume", { answer: "5.5 sets of 12." })).toEqual([
      expect.stringContaining("the last 7 days"),
    ]);
  });

  it("should fail a line under the answer that is not a tool's", async () => {
    const failures = await run("progress-bench-stalled", {
      answerMeta: { citation: "Based on 3 entries today and your targets", estimate: null },
    });

    expect(failures).toEqual([expect.stringContaining("not the tool's")]);
  });

  it("should fail a tool that is not a read tool", async () => {
    const failures = await run("train-today", {
      toolCalls: [readTool("suggest_next_session", {}), writeTool("log_entry", {})],
    });

    expect(failures).toEqual([expect.stringContaining("log_entry is not a read tool")]);
  });

  it("should fail the first person", async () => {
    expect(await run("train-today", { answer: "14, 52. I would start with squats." })).toEqual([
      expect.stringContaining("first person"),
    ]);
  });

  it("should fail a case that left an action row", async () => {
    const spec = specOf("train-today");
    const facts = await resolveFacts(spec, world, nowIso());
    const failures = await failuresOf(
      caseOf("train-today"),
      perfectTurn(spec, facts),
      fakeDatabase({ rowCounts: { assistant_actions: 1 } }),
    );

    expect(failures).toEqual([expect.stringContaining("left rows in assistant_actions")]);
  });

  it("should fail a workout in progress that was changed", async () => {
    const spec = specOf("workout-what-next");
    const facts = await resolveFacts(spec, world, nowIso());
    const failures = await failuresOf(
      caseOf("workout-what-next"),
      perfectTurn(spec, facts),
      fakeDatabase({
        rows: { workout_sessions: [{ id: "live-session" }] },
        rowCounts: { workout_sets: LIVE_WORKOUT.sets + 1 },
      }),
    );

    expect(failures).toEqual([expect.stringContaining("holds 3 sets")]);
  });

  it("should fail a workout in progress that was finished", async () => {
    const spec = specOf("workout-what-next");
    const facts = await resolveFacts(spec, world, nowIso());
    const failures = await failuresOf(
      caseOf("workout-what-next"),
      perfectTurn(spec, facts),
      fakeDatabase(),
    );

    expect(failures).toEqual([expect.stringContaining("not the one open workout")]);
  });
});

describe("the failure line", () => {
  it("should print the question and the tools with their arguments and how they ended, and never the answer", async () => {
    const spec = specOf("progress-bench-stalled");
    const facts = await resolveFacts(spec, world, nowIso());
    const secret = "SECRET-ANSWER-TEXT 80 kg";
    const failures = await failuresOf(
      caseOf("progress-bench-stalled"),
      perfectTurn(spec, facts, {
        answer: secret,
        toolCalls: [
          {
            name: "get_exercise_progress",
            input: { exercise_id: "somebody-else" },
            readOnlyHint: true,
            errorCode: "not_found",
          },
        ],
      }),
    );

    expect(failures.length).toBeGreaterThan(0);
    for (const reason of failures) {
      expect(reason).toContain('question: "Why has my bench stalled?"');
      expect(reason).toContain(
        'get_exercise_progress({"exercise_id":"somebody-else"}) [not_found]',
      );
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

  it("should read the last 7 days in the ways a person writes them", async () => {
    for (const answer of ["in the last 7 days", "over the past seven days", "a 7-day count"]) {
      expect((await saysLastSevenDays()(answerContext(answer))).passed).toBe(true);
    }
    expect((await saysLastSevenDays()(answerContext("in the last week"))).passed).toBe(false);
    expect((await neverSaysThisWeek()(answerContext("This week you did 6 sets."))).passed).toBe(
      false,
    );
  });

  it("should name the markers by their tool names only", async () => {
    expect((await noMarkerNames()(answerContext("You have no goal set yet."))).passed).toBe(true);
    expect((await noMarkerNames()(answerContext("first_visit is true"))).passed).toBe(false);
  });

  it("should not take a date or a plain number for a set count", async () => {
    const allowed = { loads: [], setCounts: [], repRanges: [] };

    expect(
      (await noInventedLoad(allowed)(answerContext("On 3 November you trained for 52 minutes.")))
        .passed,
    ).toBe(true);
  });
});

describe("the world a case needs", () => {
  it("should write the history before every case, close the goal for the goal-less one and restore it after", async () => {
    const calls: WorldCalls = [];
    const [evalCase] = adviceCasesOf(ANCHOR, () => fakeWorld(calls)).filter(
      ({ id }) => id === "train-no-goal",
    );

    await evalCase?.setup?.(fakeEnvironment());
    await evalCase?.cleanUp?.([], fakeEnvironment());

    expect(calls).toEqual(["history", "clear goal", "restore goal"]);
  });

  it("should start a workout for the live cases and discard it after", async () => {
    const calls: WorldCalls = [];
    const [evalCase] = adviceCasesOf(ANCHOR, () => fakeWorld(calls)).filter(
      ({ id }) => id === "workout-so-far",
    );

    await evalCase?.setup?.(fakeEnvironment());
    await evalCase?.cleanUp?.([], fakeEnvironment());

    expect(calls).toEqual(["history", "start workout", "discard workout"]);
  });

  it("should only write the history for a case that needs nothing else, and clean up nothing", async () => {
    const calls: WorldCalls = [];
    const evalCase = adviceCasesOf(ANCHOR, () => fakeWorld(calls)).find(
      ({ id }) => id === "train-today",
    );

    await evalCase?.setup?.(fakeEnvironment());

    expect(calls).toEqual(["history"]);
    expect(evalCase?.cleanUp).toBeUndefined();
  });

  it("should say so when no session attached the training world", () => {
    trainingWorldHolder.detach().catch(() => undefined);

    expect(() => trainingWorldHolder.current()).toThrow(/attached the training world/);
  });
});
