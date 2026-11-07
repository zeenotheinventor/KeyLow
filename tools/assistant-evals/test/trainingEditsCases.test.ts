import {
  confirmArchiveExerciseButtons,
  confirmArchiveRoutineButtons,
  confirmDeleteWorkoutButtons,
  confirmRemoveExercisesButtons,
} from "@keylow/core";
import { GOAL_STARTING_ANSWERS, loadToKg } from "@keylow/core/training";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeEnvironment } from "./fakeEnvironment.ts";
import { fakeDatabase, readTool, turnResult, writeTool } from "./helpers.ts";
import { sayThursday, thursdayOf, trainingEditsCasesOf } from "../cases/trainingEdits.ts";
import { namesDay } from "../cases/trainingEditsGraders.ts";
import { ACTIVE_ROUTINE, CURRENT_GOAL } from "../fixtures/training.ts";
import { THRESHOLD_PERCENT } from "../src/thresholds.ts";
import { trainingEditsWorldHolder } from "../src/trainingEditsWorld.ts";
import { trainingWorldHolder } from "../src/trainingWorldHolder.ts";

import type { EvalCase } from "../src/case.ts";
import type {
  ScratchRoutine,
  ScratchWorkout,
  SeededRoutine,
  TrainingEditsWorld,
} from "../src/trainingEditsWorld.ts";
import type { EvalDatabase, ToolCall, TurnResult, TurnStatus } from "../src/types.ts";
import type { AssistantUndoResult } from "@keylow/api-client";
import type { AssistantCard, AssistantCardKind } from "@keylow/core";
import type { GoalAnswers } from "@keylow/core/training";

const ANCHOR = "2026-11-07";
const cases = trainingEditsCasesOf(ANCHOR);

const caseOf = (id: string): EvalCase => {
  const found = cases.find((candidate) => candidate.id === id);
  if (found === undefined) {
    throw new Error(`No case ${id}`);
  }
  return found;
};

// ---------------------------------------------------------------------------------------------------------
// A database of rows, and routines as rows
// ---------------------------------------------------------------------------------------------------------

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

function tableDatabase(tables: Tables, usage?: { counted: number }): EvalDatabase {
  const matching = ({ table, where }: Parameters<EvalDatabase["readRows"]>[0]) =>
    (tables[table] ?? []).filter((row) =>
      Object.entries(where).every(([column, value]) => row[column] === value),
    );
  return {
    ...fakeDatabase(),
    countRows: (query) => Promise.resolve(matching(query).length),
    readRows: (query) => Promise.resolve(matching(query)),
    usageOfTurn: () =>
      Promise.resolve({
        inputTokens: usage?.counted ?? 0,
        outputTokens: 0,
        cacheReadInputTokens: 0,
        cacheCreationInputTokens: 0,
        costUsdMicros: 0,
      }),
  };
}

const merge = (...parts: Tables[]): Tables => {
  const merged: Tables = {};
  for (const part of parts) {
    for (const [table, rows] of Object.entries(part)) {
      merged[table] = [...(merged[table] ?? []), ...rows];
    }
  }
  return merged;
};

const SQUAT = "Barbell_Full_Squat";
const LEG_PRESS = "Leg_Press";
const LEG_CURL = "Lying_Leg_Curls";
const LEG_EXTENSIONS = "Leg_Extensions";
const HACK_SQUAT = "Hack_Squat";
const BENCH = "Barbell_Bench_Press_-_Medium_Grip";
const DUMBBELL_BENCH = "Dumbbell_Bench_Press";
const OVERHEAD = "Standing_Military_Press";
const PUSHDOWN = "Triceps_Pushdown";

const CATALOGUE: Record<string, { name: string; mechanic: "compound" | "isolation" }> = {
  [SQUAT]: { name: "Barbell Full Squat", mechanic: "compound" },
  [LEG_PRESS]: { name: "Leg Press", mechanic: "compound" },
  [LEG_CURL]: { name: "Lying Leg Curls", mechanic: "isolation" },
  [LEG_EXTENSIONS]: { name: "Leg Extensions", mechanic: "isolation" },
  [HACK_SQUAT]: { name: "Hack Squat", mechanic: "compound" },
  [BENCH]: { name: "Barbell Bench Press - Medium Grip", mechanic: "compound" },
  [DUMBBELL_BENCH]: { name: "Dumbbell Bench Press", mechanic: "compound" },
  [OVERHEAD]: { name: "Standing Military Press", mechanic: "compound" },
  [PUSHDOWN]: { name: "Triceps Pushdown", mechanic: "isolation" },
  Seated_Cable_Rows: { name: "Seated Cable Rows", mechanic: "compound" },
  Barbell_Curl: { name: "Barbell Curl", mechanic: "isolation" },
};

const exerciseRows: Tables = {
  exercises: Object.entries(CATALOGUE).map(([ref, { name, mechanic }]) => ({
    id: `ex:${ref}`,
    name,
    source_ref: ref,
    mechanic,
  })),
};

type Line = { ref: string; sets: number; min: number; max: number; rir: number | null };
type DayShape = { id: string; name: string; weekday: number | null; lines: Line[] };
type RoutineShape = {
  id: string;
  name: string;
  active?: boolean;
  archived?: boolean;
  days: DayShape[];
};

const idOfRoutine = (name: string) => `routine:${name}`;
const idOfDay = (routine: string, day: string) => `day:${routine}:${day}`;

const shapeOf = (plan: ScratchRoutine): RoutineShape => ({
  id: idOfRoutine(plan.name),
  name: plan.name,
  active: plan.active === true,
  days: plan.days.map((day) => ({
    id: idOfDay(plan.name, day.name),
    name: day.name,
    weekday: day.weekday,
    lines: day.exercises.map((line) => ({
      ref: line.sourceRef,
      sets: line.sets,
      min: line.repMin,
      max: line.repMax,
      rir: line.rir,
    })),
  })),
});

const rowsOfRoutine = (routine: RoutineShape): Tables => ({
  routines: [
    {
      id: routine.id,
      name: routine.name,
      is_active: routine.active === true,
      is_archived: routine.archived === true,
    },
  ],
  routine_days: routine.days.map((day, position) => ({
    id: day.id,
    routine_id: routine.id,
    name: day.name,
    weekday: day.weekday,
    position,
  })),
  routine_exercises: routine.days.flatMap((day) =>
    day.lines.map((line, position) => ({
      routine_day_id: day.id,
      exercise_id: `ex:${line.ref}`,
      position,
      target_sets: line.sets,
      rep_min: line.min,
      rep_max: line.max,
      target_rir: line.rir,
    })),
  ),
});

/** Changes one day of a routine shape. */
const withDay = (
  routine: RoutineShape,
  dayName: string,
  change: (day: DayShape) => DayShape,
): RoutineShape => ({
  ...routine,
  days: routine.days.map((day) => (day.name === dayName ? change(day) : day)),
});

const withLines = (routine: RoutineShape, dayName: string, lines: Line[]): RoutineShape =>
  withDay(routine, dayName, (day) => ({ ...day, lines }));

const line = (ref: string, sets: number, min: number, max: number, rir: number | null): Line => ({
  ref,
  sets,
  min,
  max,
  rir,
});

// The preset of the fixture's goal (strength, intermediate), worked out here by hand from the presets table, so
// a wrong preset in the cases shows: compound 3 to 5 at RIR 2, isolation 8 to 12 at RIR 2, 3 sets.
const COMPOUND_PRESET = { sets: 3, min: 3, max: 5, rir: 2 } as const;
const ISOLATION_PRESET = { sets: 3, min: 8, max: 12, rir: 2 } as const;
const atPreset = (ref: string): Line => {
  const preset = CATALOGUE[ref]?.mechanic === "isolation" ? ISOLATION_PRESET : COMPOUND_PRESET;
  return line(ref, preset.sets, preset.min, preset.max, preset.rir);
};

// ---------------------------------------------------------------------------------------------------------
// A world, a turn and a play
// ---------------------------------------------------------------------------------------------------------

type FakeWorld = TrainingEditsWorld & {
  seeded: ScratchRoutine[];
  calls: string[];
  workouts: ScratchWorkout[];
  undoResults: AssistantUndoResult[];
};

function fakeWorld(): FakeWorld {
  const seeded: ScratchRoutine[] = [];
  const calls: string[] = [];
  const workouts: ScratchWorkout[] = [];
  const world: FakeWorld = {
    anchorDate: ANCHOR,
    seeded,
    calls,
    workouts,
    undoResults: [],
    seedRoutine: (plan) => {
      seeded.push(plan);
      calls.push(`seed routine ${plan.name}`);
      const result: SeededRoutine = {
        id: idOfRoutine(plan.name),
        days: plan.days.map((day) => ({ id: idOfDay(plan.name, day.name), name: day.name })),
      };
      return Promise.resolve(result);
    },
    tidyUp: () => (calls.push("tidy up"), Promise.resolve()),
    seedGoal: () => (calls.push("seed goal"), Promise.resolve()),
    clearGoals: () => (calls.push("clear goals"), Promise.resolve()),
    restoreGoal: () => (calls.push("restore goal"), Promise.resolve()),
    seedWorkout: (workout) => {
      workouts.push(workout);
      return Promise.resolve({
        sessionId: `session-${workouts.length}`,
        setIds: workout.sets.map((_set, index) => `set-${index + 1}`),
      });
    },
    seedCustomExercise: (draft) => Promise.resolve(`custom:${draft.name}`),
    setWeightUnit: (unit) => (calls.push(`weight unit ${unit}`), Promise.resolve()),
    changeRoutineThroughTheApp: (id) => (
      calls.push(`app changes routine ${id}`),
      Promise.resolve()
    ),
    changeSetThroughTheApp: (id, reps) => (
      calls.push(`app changes ${id} to ${reps}`),
      Promise.resolve()
    ),
    changeGoalThroughTheApp: () => (calls.push("app changes the goal"), Promise.resolve()),
    makeRoutineActive: (id) => (calls.push(`app makes ${id} active`), Promise.resolve()),
    logWorkoutFromDay: (id) => (calls.push(`app logs a workout from ${id}`), Promise.resolve()),
    routineMadeByTurn: () =>
      Promise.resolve({ id: "built-1", days: [{ id: "built-day-1", name: "Day" }] }),
    routineNamed: (name) =>
      Promise.resolve({
        id: idOfRoutine(name),
        days: [
          ...(seeded.find((plan) => plan.name === name)?.days ?? []).map((day) => ({
            id: idOfDay(name, day.name),
            name: day.name,
          })),
          { id: "added-day", name: "Arms" },
        ],
      }),
    pressUndo: () => Promise.resolve(world.undoResults),
    actionIdsOfTurn: () => Promise.resolve(["action-1"]),
    pressUndoFor: (ids) => (
      calls.push(`undo for ${ids.join(",")}`),
      Promise.resolve(world.undoResults)
    ),
    deleteConversation: (id) => (calls.push(`delete conversation ${id}`), Promise.resolve()),
    putExerciseInRoutine: (routineId, exerciseId) => (
      calls.push(`put ${exerciseId} in ${routineId}`),
      Promise.resolve()
    ),
  };
  return world;
}

const fakeTrainingWorld = () =>
  ({
    ensureHistory: () => Promise.resolve(),
    startWorkout: () => Promise.resolve(),
    discardWorkout: () => Promise.resolve(),
  }) as unknown as Parameters<typeof trainingWorldHolder.attach>[0];

let world: FakeWorld;
beforeEach(() => {
  world = fakeWorld();
  trainingEditsWorldHolder.attach(world);
  trainingWorldHolder.attach(fakeTrainingWorld());
});

const cardOf = (
  kind: AssistantCardKind,
  rows = 0,
  link: AssistantCard["link"] = null,
): AssistantCard => ({
  actionIds: ["33333333-3333-4333-8333-333333333333"],
  kind,
  title: "Title",
  sub: null,
  rows: Array.from({ length: rows }, () => ({
    name: "Row",
    amountText: null,
    time: null,
    kcalText: null,
    match: null,
    matchedFood: null,
    estimate: false,
  })),
  totalText: null,
  note: null,
  link,
  undo: "available",
  undoneSub: null,
});

type Step = {
  answer?: string;
  status?: TurnStatus;
  calls?: ToolCall[];
  /** Tools that left an action row, one row each. */
  actions?: readonly string[];
  cards?: AssistantCard[];
  /** What the turn asked, when it ended waiting for a yes. */
  confirmation?: { question: string };
  /** Whether the turn stored an Ask again. */
  askAgain?: boolean;
  /** The routine id a stored link opens, when the turn stored one. */
  linkTo?: string;
};

type Play = {
  steps: Step[];
  tables?: (routines: ScratchRoutine[]) => Tables;
  usageTokens?: number;
};

function playOf(play: Play): { turns: TurnResult[]; database: EvalDatabase } {
  const turns = play.steps.map((step) =>
    turnResult({
      answer: step.answer ?? "",
      status: step.status ?? "complete",
      toolCalls: step.calls ?? [],
      ...(step.cards === undefined ? {} : { cards: step.cards }),
      ...(step.confirmation === undefined
        ? {}
        : {
            confirmation: {
              question: step.confirmation.question,
              confirmLabel: "Yes",
              cancelLabel: "No",
            },
          }),
    }),
  );
  const tables = merge(exerciseRows, play.tables?.(world.seeded) ?? {}, {
    assistant_actions: play.steps.flatMap((step, index) =>
      (step.actions ?? []).map((tool, position) => ({
        turn_id: turns[index]?.turnId,
        tool,
        target_id: tool === "create_routine" ? "built-1" : `target-${index}-${position}`,
      })),
    ),
    assistant_messages: play.steps.flatMap((step, index) => {
      const display: Record<string, unknown> = {};
      if (step.askAgain === true) {
        display["tool-1"] = { askAgain: true };
      }
      if (step.linkTo !== undefined) {
        display["tool-2"] = {
          link: { label: "Open", target: { screen: "routine_editor", routineId: step.linkTo } },
        };
      }
      return [{ turn_id: turns[index]?.turnId, display }];
    }),
    assistant_turns: turns.map((turn) => ({
      id: turn.turnId,
      created_at: "2026-11-07T10:00:00.000Z",
      finished_at: "2026-11-07T10:00:40.000Z",
    })),
  });
  return { turns, database: tableDatabase(tables, { counted: play.usageTokens ?? 0 }) };
}

/** Sets the case up as the runner does, then grades the play, and answers the reasons of the graders that failed. */
async function gradeCase(id: string, play: Play): Promise<string[]> {
  const evalCase = caseOf(id);
  await evalCase.prepare?.();
  world.workouts.length = 0;
  await evalCase.setup?.(fakeEnvironment());
  const { turns, database } = playOf(play);
  const outcomes = await Promise.all(evalCase.expect.map((grade) => grade({ turns, database })));
  return outcomes.filter(({ passed }) => !passed).map(({ reason }) => reason);
}

const passes = async (id: string, play: Play) => {
  expect(await gradeCase(id, play)).toEqual([]);
};
const failsOn = async (id: string, play: Play, reason: RegExp | string) => {
  const reasons = await gradeCase(id, play);
  expect(reasons.length).toBeGreaterThan(0);
  expect(reasons.join(" | ")).toMatch(reason);
};

const read = (name: string) => readTool(name);
const editCall = (changes = 1): ToolCall =>
  writeTool("edit_routine", {
    routine_id: "r",
    changes: Array.from({ length: changes }, () => ({ op: "set_targets" })),
  });

const seededShape = (index = 0): RoutineShape => {
  const plan = world.seeded[index];
  if (plan === undefined) {
    throw new Error("The case seeded no routine");
  }
  return shapeOf(plan);
};

const tablesOf = (...shapes: RoutineShape[]): Tables => merge(...shapes.map(rowsOfRoutine));

// ---------------------------------------------------------------------------------------------------------
// The set
// ---------------------------------------------------------------------------------------------------------

describe("the training edits set", () => {
  it("should be registered at 90 percent", () => {
    expect(THRESHOLD_PERCENT.trainingEdits).toBe(90);
    expect(cases.every(({ set }) => set === "trainingEdits")).toBe(true);
  });

  it("should have unique case ids, each with at least one grader", () => {
    expect(new Set(cases.map(({ id }) => id)).size).toBe(cases.length);
    expect(cases.every(({ expect: graders }) => graders.length > 0)).toBe(true);
  });

  it("should have 48 cases", () => {
    expect(cases).toHaveLength(48);
  });

  it("should write the fixture's history before every case, so tidying up has a routine to put back", async () => {
    const ensureHistory = vi.fn(() => Promise.resolve());
    trainingWorldHolder.attach({
      ...fakeTrainingWorld(),
      ensureHistory,
    });

    for (const evalCase of cases) {
      await evalCase.prepare?.();
    }

    expect(ensureHistory).toHaveBeenCalledTimes(cases.length);
  });

  it("should give each case that makes a past workout a Thursday of its own, so a date names one workout", async () => {
    const days: string[] = [];
    for (const evalCase of cases) {
      world = fakeWorld();
      trainingEditsWorldHolder.attach(world);
      await evalCase.setup?.(fakeEnvironment());
      days.push(...world.workouts.map(({ localDate }) => localDate));
    }

    expect(days).toHaveLength(9);
    expect(new Set(days).size).toBe(days.length);
  });

  it("should give every case that makes a routine, a goal or a unit a cleanUp that puts it back", async () => {
    trainingWorldHolder.attach({
      ensureHistory: () => Promise.resolve(),
      startWorkout: () => Promise.resolve(),
    } as unknown as Parameters<typeof trainingWorldHolder.attach>[0]);
    for (const evalCase of cases) {
      world = fakeWorld();
      trainingEditsWorldHolder.attach(world);
      await evalCase.setup?.(fakeEnvironment());
      const touchedRoutine = world.seeded.length > 0;
      const touchedGoal = world.calls.includes("clear goals") || world.calls.includes("seed goal");
      if (touchedRoutine || touchedGoal) {
        expect(evalCase.cleanUp, evalCase.id).toBeDefined();
      }
    }
  });

  it("should put the weight unit back to kg after the pounds case, even when a turn failed", async () => {
    const evalCase = caseOf("edits-past-sets-in-pounds-are-stored-in-kilograms-to-the-gram");

    await evalCase.setup?.(fakeEnvironment());
    await evalCase.cleanUp?.([], fakeEnvironment());

    expect(world.calls).toEqual(["weight unit lb", "weight unit kg"]);
  });

  it("should put the goal back even when the routines could not be tidied, and still fail loudly", async () => {
    world = { ...world, tidyUp: () => Promise.reject(new Error("could not tidy")) };
    trainingEditsWorldHolder.attach(world);

    await expect(
      caseOf("edits-add-without-a-goal-needs-the-numbers").cleanUp?.([], fakeEnvironment()),
    ).rejects.toThrow("could not tidy");

    expect(world.calls).toEqual(["restore goal"]);
  });

  it("should use a swap during a workout that names one exercise of the library", () => {
    const [swap] = caseOf(
      "edits-swap-during-a-workout-writes-nothing-offers-ask-again-and-a-question-answers",
    ).messages;

    expect(swap).toContain("swap leg press for leg extensions");
  });

  it("should archive the scratch routines and give the fixture's routine back after a case that made one", async () => {
    const evalCase = caseOf("edits-routine-make-active");

    await evalCase.cleanUp?.([], fakeEnvironment());

    expect(world.calls).toEqual(["tidy up"]);
  });
});

describe("the scratch Thursdays", () => {
  it("should be Thursdays at least 100 days back, one a week apart", () => {
    const first = thursdayOf(ANCHOR, 1);
    const second = thursdayOf(ANCHOR, 2);

    expect(new Date(`${first}T00:00:00Z`).getUTCDay()).toBe(4);
    expect(
      Date.parse(`${ANCHOR}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`),
    ).toBeGreaterThanOrEqual(100 * 86_400_000);
    expect(Date.parse(`${first}T00:00:00Z`) - Date.parse(`${second}T00:00:00Z`)).toBe(
      7 * 86_400_000,
    );
  });

  it("should be said with the weekday, so a person's 'last Thursday' is a day the model can read", () => {
    expect(sayThursday("2026-07-23")).toBe("Thursday 23 July 2026");
  });
});

// ---------------------------------------------------------------------------------------------------------
// Routines
// ---------------------------------------------------------------------------------------------------------

describe("edits-routine-four-changes-in-one-call", () => {
  const id = "edits-routine-four-changes-in-one-call";

  // The right play: one call, four rows, extensions at the preset, hack squat with the old numbers.
  const right = (): Play => ({
    steps: [
      {
        calls: [read("get_routines"), read("search_exercises"), editCall(4)],
        actions: ["edit_routine"],
        cards: [cardOf("routine_updated", 4)],
      },
    ],
    tables: () =>
      tablesOf(
        withLines(seededShape(), "Legs", [
          line(SQUAT, 4, 3, 5, 2),
          line(HACK_SQUAT, 4, 8, 12, 2),
          atPreset(LEG_EXTENSIONS),
        ]),
      ),
  });

  it("should pass for the four changes, with an extra read tool on the way", async () => {
    const play = right();
    const [step] = play.steps;
    await passes(id, {
      ...play,
      steps: [{ ...step, calls: [...(step?.calls ?? []), read("get_muscle_state")] }],
    });
  });

  it("should pass for a model that asks which hack squat and writes nothing", async () => {
    await passes(id, {
      steps: [{ status: "clarify", calls: [read("search_exercises"), writeTool("ask_user")] }],
      tables: () => tablesOf(seededShape()),
    });
  });

  it("should fail when the swap lost the old numbers (a remove and an add)", async () => {
    await failsOn(
      id,
      {
        ...right(),
        tables: () =>
          tablesOf(
            withLines(seededShape(), "Legs", [
              line(SQUAT, 4, 3, 5, 2),
              atPreset(HACK_SQUAT),
              atPreset(LEG_EXTENSIONS),
            ]),
          ),
      },
      "no hack squat holds the numbers leg press had",
    );
  });

  it("should fail when leg extensions got a number nobody named", async () => {
    await failsOn(
      id,
      {
        ...right(),
        tables: () =>
          tablesOf(
            withLines(seededShape(), "Legs", [
              line(SQUAT, 4, 3, 5, 2),
              line(HACK_SQUAT, 4, 8, 12, 2),
              line(LEG_EXTENSIONS, 4, 8, 12, 2),
            ]),
          ),
      },
      "not at the preset",
    );
  });

  it("should fail when the card has 5 rows because an added exercise was counted twice", async () => {
    const play = right();
    await failsOn(
      id,
      { ...play, steps: [{ ...(play.steps[0] ?? {}), cards: [cardOf("routine_updated", 5)] }] },
      "has 5 rows, not 4",
    );
  });

  it("should fail when the changes went in two calls and so two cards", async () => {
    const play = right();
    await failsOn(
      id,
      {
        ...play,
        steps: [
          {
            ...(play.steps[0] ?? {}),
            actions: ["edit_routine", "edit_routine"],
            cards: [cardOf("routine_updated", 2), cardOf("routine_updated", 2)],
          },
        ],
      },
      "left 2 action rows",
    );
  });

  it("should fail when a write other than the edit was made", async () => {
    const play = right();
    await failsOn(
      id,
      {
        ...play,
        steps: [
          {
            ...(play.steps[0] ?? {}),
            calls: [...(play.steps[0]?.calls ?? []), writeTool("archive_routine")],
          },
        ],
      },
      "archive_routine was called",
    );
  });
});

describe("edits-routine-added-exercise-changed-in-one-call-is-one-row", () => {
  const id = "edits-routine-added-exercise-changed-in-one-call-is-one-row";
  const right = (rows: number): Play => ({
    steps: [
      { calls: [editCall(2)], actions: ["edit_routine"], cards: [cardOf("routine_updated", rows)] },
    ],
    tables: () =>
      tablesOf(
        withDay(seededShape(), "Legs", (day) => ({
          ...day,
          lines: [...day.lines, line(LEG_EXTENSIONS, 4, 12, 15, 2)],
        })),
      ),
  });

  it("should pass for one Added row with the numbers asked for and the preset RIR", async () => {
    await passes(id, right(1));
  });

  it("should fail when the card counts the add and the change as two rows", async () => {
    await failsOn(id, right(2), "has 2 rows, not 1");
  });

  it("should fail when the RIR is missing, so the preset was not taken", async () => {
    await failsOn(
      id,
      {
        ...right(1),
        tables: () =>
          tablesOf(
            withDay(seededShape(), "Legs", (day) => ({
              ...day,
              lines: [...day.lines, line(LEG_EXTENSIONS, 4, 12, 15, null)],
            })),
          ),
      },
      "not 4 sets of 12 to 15",
    );
  });
});

describe("edits-routine-one-removal-asks-nothing", () => {
  const id = "edits-routine-one-removal-asks-nothing";
  const right: Play = {
    steps: [
      { calls: [editCall()], actions: ["edit_routine"], cards: [cardOf("routine_updated", 1)] },
    ],
    tables: () =>
      tablesOf(
        withLines(seededShape(), "Legs", [line(SQUAT, 5, 3, 5, 2), line(LEG_PRESS, 4, 8, 12, 2)]),
      ),
  };

  it("should pass when the curls went at once", async () => {
    await passes(id, right);
  });

  it("should fail when the model asked first, because one removal is not a big change", async () => {
    await failsOn(id, { ...right, steps: [{ status: "confirm" }] }, "ended confirm, not complete");
  });

  it("should fail when another exercise went too", async () => {
    await failsOn(
      id,
      {
        ...right,
        tables: () => tablesOf(withLines(seededShape(), "Legs", [line(SQUAT, 5, 3, 5, 2)])),
      },
      "something else went",
    );
  });
});

describe("the two removals", () => {
  const yes = "edits-routine-two-removals-after-a-yes";
  const no = "edits-routine-two-removals-after-a-no";

  it("should press the labels core gives the buttons, and not words of the case", () => {
    const buttons = confirmRemoveExercisesButtons(2);

    expect(caseOf(yes).messages[1]).toBe(buttons.confirmLabel);
    expect(caseOf(no).messages[1]).toBe(buttons.cancelLabel);
  });

  it("should pass for a question, then a press that removes both with no model call", async () => {
    await passes(yes, {
      steps: [
        { status: "confirm", calls: [writeTool("edit_routine", { routine_id: "r", changes: [] })] },
        { actions: ["edit_routine"], cards: [cardOf("routine_updated", 2)] },
      ],
      tables: () => tablesOf(withLines(seededShape(), "Legs", [line(SQUAT, 5, 3, 5, 2)])),
    });
  });

  it("should fail when the first message wrote before the yes", async () => {
    await failsOn(
      yes,
      {
        steps: [
          { status: "confirm", actions: ["edit_routine"] },
          { actions: ["edit_routine"], cards: [cardOf("routine_updated", 2)] },
        ],
        tables: () => tablesOf(withLines(seededShape(), "Legs", [line(SQUAT, 5, 3, 5, 2)])),
      },
      "turn 1 left 1 action rows, not 0",
    );
  });

  it("should pass for a no that writes nothing", async () => {
    await passes(no, {
      steps: [{ status: "confirm" }, { status: "complete" }],
      tables: () => tablesOf(seededShape()),
    });
  });

  it("should fail for a no after which an exercise was gone", async () => {
    await failsOn(
      no,
      {
        steps: [{ status: "confirm" }, { status: "complete" }],
        tables: () => tablesOf(withLines(seededShape(), "Legs", [line(SQUAT, 5, 3, 5, 2)])),
      },
      "has 1 exercises and not 3",
    );
  });
});

describe("edits-routine-add-a-day-rename-one-and-move-one", () => {
  const id = "edits-routine-add-a-day-rename-one-and-move-one";
  const right = (change: (routine: RoutineShape) => RoutineShape = (routine) => routine): Play => ({
    steps: [
      { calls: [editCall(3)], actions: ["edit_routine"], cards: [cardOf("routine_updated", 3)] },
    ],
    tables: () => {
      const base = seededShape();
      const edited = change({
        ...base,
        days: [
          ...base.days.map((day) =>
            day.name === "Push"
              ? { ...day, name: "Chest and shoulders" }
              : day.name === "Legs"
                ? { ...day, weekday: 4 }
                : day,
          ),
          { id: "new-day", name: "Arms", weekday: 5, lines: [] },
        ],
      });
      return tablesOf(edited);
    },
  });

  it("should pass when every old day kept its id and the new day is empty", async () => {
    await passes(id, right());
  });

  it("should fail when Push was deleted and added again under a new id", async () => {
    await failsOn(
      id,
      right((routine) => ({
        ...routine,
        days: routine.days.map((day) =>
          day.name === "Chest and shoulders" ? { ...day, id: "new-id" } : day,
        ),
      })),
      "Push was not renamed",
    );
  });

  it("should fail when Legs went to the wrong day", async () => {
    await failsOn(
      id,
      right((routine) => ({
        ...routine,
        days: routine.days.map((day) => (day.name === "Legs" ? { ...day, weekday: 5 } : day)),
      })),
      "Legs was not moved to Friday",
    );
  });

  it("should fail when the new day is on the wrong weekday", async () => {
    await failsOn(
      id,
      right((routine) => ({
        ...routine,
        days: routine.days.map((day) => (day.name === "Arms" ? { ...day, weekday: 6 } : day)),
      })),
      "no new Arms day on Saturday",
    );
  });
});

describe("edits-routine-remove-a-day-gives-a-link-and-writes-nothing", () => {
  const id = "edits-routine-remove-a-day-gives-a-link-and-writes-nothing";

  it("should pass for a link to the routine editor, no row and no card", async () => {
    await passes(id, {
      steps: [
        {
          calls: [writeTool("edit_routine", { routine_id: "r", changes: [{ op: "remove_day" }] })],
          linkTo: idOfRoutine("Scratch remove a day"),
        },
      ],
      tables: () => tablesOf(seededShape()),
    });
  });

  it("should pass for a reply that says days are removed in the routine editor, with no call", async () => {
    await passes(id, {
      steps: [{ calls: [read("get_routines")], answer: "A day is removed in the routine editor." }],
      tables: () => tablesOf(seededShape()),
    });
  });

  it("should fail when the model only explained, without the editor, and gave no link", async () => {
    await failsOn(
      id,
      { steps: [{ answer: "Not possible." }], tables: () => tablesOf(seededShape()) },
      "no route passed",
    );
  });

  it("should fail when the tool was called and no link was stored, even if the reply names the editor", async () => {
    await failsOn(
      id,
      {
        steps: [
          {
            calls: [
              writeTool("edit_routine", { routine_id: "r", changes: [{ op: "remove_day" }] }),
            ],
            answer: "Use the routine editor.",
          },
        ],
        tables: () => tablesOf(seededShape()),
      },
      "no route passed",
    );
  });

  it("should fail when the day was removed", async () => {
    await failsOn(
      id,
      {
        steps: [
          {
            actions: ["edit_routine"],
            cards: [cardOf("routine_updated", 1)],
            linkTo: idOfRoutine("Scratch remove a day"),
          },
        ],
        tables: () => tablesOf({ ...seededShape(), days: seededShape().days.slice(0, 1) }),
      },
      "left 1 action rows, not 0",
    );
  });
});

describe("making a routine active and archiving", () => {
  it("should pass for the active routine card and the fixture's routine inactive", async () => {
    await passes("edits-routine-make-active", {
      steps: [{ actions: ["set_active_routine"], cards: [cardOf("routine_active")] }],
      tables: () =>
        merge(tablesOf({ ...seededShape(), active: true }), {
          routines: [
            { id: "fixture", name: ACTIVE_ROUTINE.name, is_active: false, is_archived: false },
          ],
        }),
    });
  });

  it("should fail when the fixture's routine is still active", async () => {
    await failsOn(
      "edits-routine-make-active",
      {
        steps: [{ actions: ["set_active_routine"], cards: [cardOf("routine_active")] }],
        tables: () =>
          merge(tablesOf({ ...seededShape(), active: true }), {
            routines: [
              { id: "fixture", name: ACTIVE_ROUTINE.name, is_active: true, is_archived: false },
            ],
          }),
      },
      "0 rows of routines matched, not 1",
    );
  });

  it("should press the archive buttons core gives", () => {
    const buttons = confirmArchiveRoutineButtons();

    expect(caseOf("edits-routine-archive-after-a-yes").messages[1]).toBe(buttons.confirmLabel);
    expect(caseOf("edits-routine-archive-after-a-no").messages[1]).toBe(buttons.cancelLabel);
  });

  it("should pass for an archive after a yes", async () => {
    await passes("edits-routine-archive-after-a-yes", {
      steps: [
        { status: "confirm" },
        { actions: ["archive_routine"], cards: [cardOf("routine_archived")] },
      ],
      tables: () => tablesOf({ ...seededShape(), archived: true }),
    });
  });

  it("should fail for an archive after a no that archived", async () => {
    await failsOn(
      "edits-routine-archive-after-a-no",
      {
        steps: [{ status: "confirm" }, { status: "complete" }],
        tables: () => tablesOf({ ...seededShape(), archived: true }),
      },
      "the routine is not archived: the routine is archived",
    );
  });

  it("should pass when the active routine is refused with no question", async () => {
    await passes("edits-routine-archive-the-active-one-is-refused-without-a-question", {
      steps: [{ calls: [writeTool("archive_routine")], answer: "It is active." }],
      tables: () => tablesOf({ ...seededShape(), active: true }),
    });
  });

  it("should fail when the active routine was asked about", async () => {
    await failsOn(
      "edits-routine-archive-the-active-one-is-refused-without-a-question",
      {
        steps: [{ status: "confirm" }],
        tables: () => tablesOf({ ...seededShape(), active: true }),
      },
      "ended confirm",
    );
  });
});

// ---------------------------------------------------------------------------------------------------------
// Building
// ---------------------------------------------------------------------------------------------------------

const builtRoutine = (
  days: number,
  perDay = 2,
  goal: "strength" | "aesthetic" = "strength",
): RoutineShape => ({
  id: "built-1",
  name: "Built",
  days: Array.from({ length: days }, (_, day) => ({
    id: `built-day-${day}`,
    name: `Day ${day + 1}`,
    weekday: null,
    lines: [
      ...[SQUAT, BENCH, LEG_EXTENSIONS, PUSHDOWN].slice(0, perDay).map((ref) => {
        if (goal === "strength") {
          return atPreset(ref);
        }
        return CATALOGUE[ref]?.mechanic === "isolation"
          ? line(ref, 3, 12, 15, 1)
          : line(ref, 3, 8, 10, 2);
      }),
    ],
  })),
});

describe("edits-build-a-three-day-routine-at-the-presets", () => {
  const id = "edits-build-a-three-day-routine-at-the-presets";
  const right: Play = {
    steps: [
      {
        calls: [read("get_training_goals"), read("search_exercises"), writeTool("create_routine")],
        actions: ["create_routine"],
        cards: [cardOf("routine_created")],
      },
    ],
    tables: () => tablesOf(builtRoutine(3)),
  };

  it("should pass for a routine of real rows at the presets, not active, with no question", async () => {
    await passes(id, right);
  });

  it("should fail when an exercise holds a number nobody named", async () => {
    await failsOn(
      id,
      {
        ...right,
        tables: () =>
          tablesOf({
            ...builtRoutine(3),
            days: builtRoutine(3).days.map((day, index) =>
              index === 0
                ? { ...day, lines: [line(SQUAT, 5, 5, 5, 2), ...day.lines.slice(1)] }
                : day,
            ),
          }),
      },
      "not the preset of the goal",
    );
  });

  it("should fail when the routine was made active without being asked", async () => {
    await failsOn(
      id,
      { ...right, tables: () => tablesOf({ ...builtRoutine(3), active: true }) },
      "active or archived",
    );
  });

  it("should fail when set_active_routine was called", async () => {
    const [step] = right.steps;
    await failsOn(
      id,
      {
        ...right,
        steps: [{ ...step, calls: [...(step?.calls ?? []), writeTool("set_active_routine")] }],
      },
      "set_active_routine was called",
    );
  });

  it("should fail when the person was asked first", async () => {
    const [step] = right.steps;
    await failsOn(
      id,
      { ...right, steps: [{ ...step, calls: [writeTool("ask_user"), ...(step?.calls ?? [])] }] },
      "1 questions were asked, not 0",
    );
  });

  it("should fail when the routine has two days and not three", async () => {
    await failsOn(id, { ...right, tables: () => tablesOf(builtRoutine(2)) }, "2 days and not 3");
  });
});

describe("edits-build-with-five-by-five-on-squats-makes-two-cards", () => {
  const id = "edits-build-with-five-by-five-on-squats-makes-two-cards";
  const squatAndBench = (squat: Line, bench: Line): RoutineShape => ({
    ...builtRoutine(3, 1),
    days: builtRoutine(3, 1).days.map((day, index) =>
      index === 0 ? { ...day, lines: [squat, bench] } : day,
    ),
  });
  const setSquat = writeTool("edit_routine", {
    routine_id: "built-1",
    changes: [
      {
        op: "set_targets",
        day_id: "built-day-0",
        exercise_id: `ex:${SQUAT}`,
        sets: 5,
        rep_min: 5,
        rep_max: 5,
      },
    ],
  });
  const play = (routine: RoutineShape): Play => ({
    steps: [
      {
        calls: [writeTool("create_routine"), setSquat],
        actions: ["create_routine", "edit_routine"],
        cards: [cardOf("routine_created"), cardOf("routine_updated", 1)],
      },
    ],
    tables: () => tablesOf(routine),
  });

  it("should pass for squats at 5 by 5 with the preset RIR and every other row at the preset", async () => {
    await passes(id, play(squatAndBench(line(SQUAT, 5, 5, 5, 2), atPreset(BENCH))));
  });

  it("should fail when the bench press got 5 by 5 too, a number nobody named", async () => {
    await failsOn(
      id,
      play(squatAndBench(line(SQUAT, 5, 5, 5, 2), line(BENCH, 5, 5, 5, 2))),
      "nobody named holds a number that is not the preset",
    );
  });

  it("should fail when the RIR was changed with the sets", async () => {
    await failsOn(
      id,
      play(squatAndBench(line(SQUAT, 5, 5, 5, 0), atPreset(BENCH))),
      "its RIR was changed",
    );
  });

  it("should fail when the numbers went to an exercise that is not a squat", async () => {
    const wrongTarget = writeTool("edit_routine", {
      routine_id: "built-1",
      changes: [
        {
          op: "set_targets",
          day_id: "built-day-0",
          exercise_id: `ex:${BENCH}`,
          sets: 5,
          rep_min: 5,
          rep_max: 5,
        },
      ],
    });
    const base = play(squatAndBench(atPreset(SQUAT), line(BENCH, 5, 5, 5, 2)));
    await failsOn(
      id,
      {
        ...base,
        steps: [{ ...(base.steps[0] ?? {}), calls: [writeTool("create_routine"), wrongTarget] }],
      },
      "not a squat",
    );
  });

  it("should fail when only one card was drawn, so the squats were never changed", async () => {
    await failsOn(
      id,
      {
        steps: [
          {
            calls: [writeTool("create_routine")],
            actions: ["create_routine"],
            cards: [cardOf("routine_created")],
          },
        ],
        tables: () => tablesOf(builtRoutine(3)),
      },
      "drew routine_created, not routine_created, routine_updated",
    );
  });
});

describe("edits-build-with-no-goal-asks-then-saves-the-goal-and-builds", () => {
  const id = "edits-build-with-no-goal-asks-then-saves-the-goal-and-builds";
  const goalRow = (over: Row = {}): Row => ({
    effective_to: null,
    goal: "aesthetic",
    experience: "intermediate",
    days_per_week: GOAL_STARTING_ANSWERS.days_per_week,
    session_minutes: GOAL_STARTING_ANSWERS.session_minutes,
    focus: [],
    equipment: [...GOAL_STARTING_ANSWERS.equipment],
    ...over,
  });
  const right = (goal: Row = goalRow(), routine = builtRoutine(3, 2, "aesthetic")): Play => ({
    steps: [
      { status: "clarify", calls: [read("get_training_goals"), writeTool("ask_user")] },
      {
        calls: [writeTool("update_training_goals"), writeTool("create_routine")],
        actions: ["update_training_goals", "create_routine"],
        cards: [cardOf("goals_updated"), cardOf("routine_created")],
      },
    ],
    tables: () => merge(tablesOf(routine), { training_goals: [goal] }),
  });

  it("should close the goal before the case and put the fixture's back afterwards", async () => {
    const evalCase = caseOf(id);

    await evalCase.setup?.(fakeEnvironment());
    await evalCase.cleanUp?.([], fakeEnvironment());

    expect(world.calls).toEqual(["clear goals", "tidy up", "restore goal"]);
  });

  it("should pass for a question, then the goal with the starting answers and a routine at its presets", async () => {
    await passes(id, right());
  });

  it("should pass when the question is asked in the reply and not with ask_user", async () => {
    const play = right();
    await passes(id, {
      ...play,
      steps: [{ answer: "Which goal, and how experienced are you?" }, ...play.steps.slice(1)],
    });
  });

  it("should fail when the first turn built a routine before asking", async () => {
    const play = right();
    await failsOn(
      id,
      {
        ...play,
        steps: [{ status: "clarify", actions: ["create_routine"] }, ...play.steps.slice(1)],
      },
      "turn 1 left 1 action rows, not 0",
    );
  });

  it("should fail when the first turn neither asked nor wrote", async () => {
    const play = right();
    await failsOn(
      id,
      { ...play, steps: [{ answer: "Set your goal first." }, ...play.steps.slice(1)] },
      "no route passed",
    );
  });

  it("should fail when the goal lost the starting answers (3 days is not what was saved)", async () => {
    await failsOn(id, right(goalRow({ days_per_week: 5 })), "the days a week differ");
  });

  it("should fail when the routine holds the strength presets for a Look better goal", async () => {
    await failsOn(
      id,
      right(goalRow(), builtRoutine(3, 2, "strength")),
      "not the preset of the goal",
    );
  });

  it("should fail when the goal and the routine were drawn in the wrong order", async () => {
    const play = right();
    const second = play.steps[1];
    await failsOn(
      id,
      {
        ...play,
        steps: [
          play.steps[0] ?? {},
          { ...second, cards: [cardOf("routine_created"), cardOf("goals_updated")] },
        ],
      },
      "drew routine_created, goals_updated",
    );
  });
});

describe("edits-build-and-make-it-my-active-routine", () => {
  const id = "edits-build-and-make-it-my-active-routine";
  const play = (routine: RoutineShape, fixtureActive = false): Play => ({
    steps: [
      {
        calls: [writeTool("create_routine"), writeTool("set_active_routine")],
        actions: ["create_routine", "set_active_routine"],
        cards: [cardOf("routine_created"), cardOf("routine_active")],
      },
    ],
    tables: () =>
      merge(tablesOf(routine), {
        routines: [
          {
            id: "fixture",
            name: ACTIVE_ROUTINE.name,
            is_active: fixtureActive,
            is_archived: false,
          },
        ],
      }),
  });

  it("should pass for a built routine that is the active one, with the fixture's inactive", async () => {
    await passes(id, play({ ...builtRoutine(3), active: true }));
  });

  it("should fail when the routine was built and not made active", async () => {
    await failsOn(id, play(builtRoutine(3)), "the routine is not the active one");
  });

  it("should fail when the fixture's routine is still active", async () => {
    await failsOn(
      id,
      play({ ...builtRoutine(3), active: true }, true),
      "0 rows of routines matched",
    );
  });

  it("should fail when only one card was drawn", async () => {
    const base = play({ ...builtRoutine(3), active: true });
    await failsOn(
      id,
      { ...base, steps: [{ ...(base.steps[0] ?? {}), cards: [cardOf("routine_created")] }] },
      "drew routine_created, not routine_created, routine_active",
    );
  });

  it("should tidy up afterwards", async () => {
    await caseOf(id).cleanUp?.([], fakeEnvironment());

    expect(world.calls).toEqual(["tidy up"]);
  });
});

describe("edits-add-without-a-goal-needs-the-numbers", () => {
  const id = "edits-add-without-a-goal-needs-the-numbers";
  const right = (extension: Line = line(LEG_EXTENSIONS, 3, 10, 12, null)): Play => ({
    steps: [
      { status: "clarify", calls: [writeTool("edit_routine"), writeTool("ask_user")] },
      { actions: ["edit_routine"], cards: [cardOf("routine_updated", 1)], calls: [editCall()] },
    ],
    tables: () =>
      tablesOf(
        withDay(seededShape(), "Legs", (day) => ({ ...day, lines: [...day.lines, extension] })),
      ),
  });

  it("should pass when the first add was refused or asked about and the second wrote the numbers given", async () => {
    await passes(id, right());
  });

  it("should fail when the first turn invented numbers and wrote", async () => {
    const play = right();
    await failsOn(
      id,
      { ...play, steps: [{ actions: ["edit_routine"] }, ...play.steps.slice(1)] },
      "turn 1 left 1 action rows, not 0",
    );
  });

  it("should fail when a RIR nobody named was written", async () => {
    await failsOn(
      id,
      right(line(LEG_EXTENSIONS, 3, 10, 12, 2)),
      "not 3 sets of 10 to 12 with no RIR",
    );
  });
});

// ---------------------------------------------------------------------------------------------------------
// Goals and past workouts
// ---------------------------------------------------------------------------------------------------------

const goalRowOf = (answers: GoalAnswers): Row => ({ effective_to: null, ...answers });

describe("edits-goal-change-keeps-the-other-answers", () => {
  const id = "edits-goal-change-keeps-the-other-answers";
  const started: GoalAnswers = {
    goal: "aesthetic",
    focus: ["arms"],
    days_per_week: 4,
    session_minutes: 45,
    equipment: ["barbell", "dumbbell"],
    experience: "beginner",
  };
  const play = (answers: GoalAnswers): Play => ({
    steps: [
      {
        actions: ["update_training_goals"],
        cards: [cardOf("goals_updated")],
        calls: [writeTool("update_training_goals")],
      },
    ],
    tables: () => ({ training_goals: [goalRowOf(answers)] }),
  });

  it("should pass when only the goal and the days changed", async () => {
    await passes(id, play({ ...started, goal: "strength", days_per_week: 3 }));
  });

  it("should fail when the session length was reset", async () => {
    await failsOn(
      id,
      play({ ...started, goal: "strength", days_per_week: 3, session_minutes: 60 }),
      "the session length differs",
    );
  });

  it("should fail when the focus was dropped", async () => {
    await failsOn(
      id,
      play({ ...started, goal: "strength", days_per_week: 3, focus: [] }),
      "the focus differs",
    );
  });

  it("should start from a goal that is not the fixture's and put the fixture's back", async () => {
    await caseOf(id).setup?.(fakeEnvironment());
    await caseOf(id).cleanUp?.([], fakeEnvironment());

    expect(world.calls).toEqual(["seed goal", "restore goal"]);
    expect(CURRENT_GOAL.goal).toBe("strength");
  });
});

describe("the past set cases", () => {
  const repsId = "edits-past-set-reps-corrected";
  const poundsId = "edits-past-sets-in-pounds-are-stored-in-kilograms-to-the-gram";
  const setRows = (reps: number[], loads: number[]): Tables => ({
    workout_sets: reps.map((count, index) => ({
      id: `set-${index + 1}`,
      session_id: "session-1",
      position: index,
      reps: count,
      load_kg: loads[index],
      deleted_at: null,
    })),
  });

  it("should pass when only the second squat set went to 8 reps", async () => {
    await passes(repsId, {
      steps: [
        {
          calls: [writeTool("update_past_set", { set_id: "set-2", reps: 8, load: null })],
          actions: ["update_past_set"],
          cards: [cardOf("set_updated")],
        },
      ],
      tables: () => setRows([6, 8, 6, 10, 10], [100, 100, 100, 160, 160]),
    });
  });

  it("should fail when the call named the first set", async () => {
    await failsOn(
      repsId,
      {
        steps: [
          {
            calls: [writeTool("update_past_set", { set_id: "set-1", reps: 8 })],
            actions: ["update_past_set"],
            cards: [cardOf("set_updated")],
          },
        ],
        tables: () => setRows([8, 6, 6, 10, 10], [100, 100, 100, 160, 160]),
      },
      "was not called with the second squat set",
    );
  });

  it("should fail when every squat set went to 8 reps", async () => {
    await failsOn(
      repsId,
      {
        steps: [
          {
            calls: [writeTool("update_past_set", { set_id: "set-2", reps: 8 })],
            actions: ["update_past_set"],
            cards: [cardOf("set_updated")],
          },
        ],
        tables: () => setRows([8, 8, 8, 10, 10], [100, 100, 100, 160, 160]),
      },
      "differ",
    );
  });

  it("should store 225 lb as the kilograms the app stores, to the gram", () => {
    expect(loadToKg(225, "lb")).toBe(102.058);
    expect(loadToKg(220, "lb")).toBe(99.79);
  });

  const poundsPlay = (loads: number[], load: number | string = 225): Play => ({
    steps: [
      {
        calls: ["set-1", "set-2", "set-3"].map((setId) =>
          writeTool("update_past_set", { set_id: setId, load, reps: null }),
        ),
        actions: ["update_past_set", "update_past_set", "update_past_set"],
        cards: [cardOf("set_updated")],
      },
    ],
    tables: () => setRows([6, 6, 6, 10, 10], loads),
  });

  it("should pass for three writes, one card and loads stored in kilograms to the gram", async () => {
    await passes(poundsId, poundsPlay([102.058, 102.058, 102.058, 160, 160]));
  });

  it("should fail when 225 was stored as kilograms", async () => {
    await failsOn(poundsId, poundsPlay([225, 225, 225, 160, 160]), "differ");
  });

  it("should fail when the load was converted before it was sent", async () => {
    await failsOn(
      poundsId,
      poundsPlay([102.058, 102.058, 102.058, 160, 160], 102.058),
      "not one for each squat set with the load as said",
    );
  });

  it("should fail when the leg press sets changed too", async () => {
    await failsOn(poundsId, poundsPlay([102.058, 102.058, 102.058, 102.058, 160]), "set 4");
  });

  it("should fail when the three writes drew three cards", async () => {
    const play = poundsPlay([102.058, 102.058, 102.058, 160, 160]);
    await failsOn(
      poundsId,
      {
        ...play,
        steps: [
          {
            ...(play.steps[0] ?? {}),
            cards: [cardOf("set_updated"), cardOf("set_updated"), cardOf("set_updated")],
          },
        ],
      },
      "drew set_updated, set_updated, set_updated",
    );
  });

  it("should seed the workout 100 or more days back on two different Thursdays", async () => {
    await caseOf(repsId).setup?.(fakeEnvironment());
    await caseOf(poundsId).setup?.(fakeEnvironment());

    const days = world.workouts.map(({ localDate }) => localDate);
    expect(new Set(days).size).toBe(2);
    expect(days.every((day) => new Date(`${day}T00:00:00Z`).getUTCDay() === 4)).toBe(true);
    expect(world.workouts[1]?.sets[0]?.loadKg).toBe(99.79);
  });
});

// ---------------------------------------------------------------------------------------------------------
// Undo
// ---------------------------------------------------------------------------------------------------------

const pressUndo = async (
  id: string,
  turnIndex: number,
  turns: TurnResult[],
  presses: ("undone" | "already_undone")[],
) => {
  const turn = turns[turnIndex];
  if (turn === undefined) {
    throw new Error("no turn");
  }
  const environment = fakeEnvironment({
    undoPresses: { [turn.turnId]: presses.map((press) => [press]) },
  });
  await caseOf(id).afterTurn?.({ index: turnIndex, result: turn }, environment);
};

describe("the Undo cases", () => {
  it("should pass for an edit undone then already undone, with the routine back as it was", async () => {
    const id = "edits-undo-a-routine-edit";
    const play: Play = {
      steps: [{ actions: ["edit_routine"] }],
      tables: () => tablesOf(seededShape()),
    };
    await caseOf(id).setup?.(fakeEnvironment());
    const { turns, database } = playOf(play);
    await pressUndo(id, 0, turns, ["undone", "already_undone"]);

    const outcomes = await Promise.all(
      caseOf(id).expect.map((grade) => grade({ turns, database })),
    );

    expect(outcomes.filter(({ passed }) => !passed)).toEqual([]);
  });

  it("should fail when the first press answered changed because the fingerprint did not match", async () => {
    const id = "edits-undo-a-routine-edit";
    await caseOf(id).setup?.(fakeEnvironment());
    const { turns, database } = playOf({
      steps: [{ actions: ["edit_routine"] }],
      tables: () => tablesOf(seededShape()),
    });
    const turn = turns[0];
    const environment = fakeEnvironment({
      undoPresses: { [turn?.turnId ?? ""]: [["undo_unavailable"]] },
    });
    await caseOf(id).afterTurn?.({ index: 0, result: turn ?? turnResult() }, environment);

    const outcomes = await Promise.all(
      caseOf(id).expect.map((grade) => grade({ turns, database })),
    );

    expect(outcomes.map(({ reason }) => reason).join(" ")).toContain(
      "Undo answered undo_unavailable",
    );
  });

  it("should fail when the rows are not back", async () => {
    const id = "edits-undo-a-routine-edit";
    await caseOf(id).setup?.(fakeEnvironment());
    const edited = withLines(seededShape(), "Legs", [
      line(SQUAT, 3, 3, 5, 2),
      line(LEG_PRESS, 4, 8, 12, 2),
      line(LEG_CURL, 3, 10, 12, 1),
    ]);
    const { turns, database } = playOf({
      steps: [{ actions: ["edit_routine"] }],
      tables: () => tablesOf(edited),
    });
    await pressUndo(id, 0, turns, ["undone", "already_undone"]);

    const outcomes = await Promise.all(
      caseOf(id).expect.map((grade) => grade({ turns, database })),
    );

    expect(outcomes.map(({ reason }) => reason).join(" ")).toContain("is not as the case made it");
  });

  it("should undo the archive on the press turn, the second message", () => {
    expect(caseOf("edits-undo-an-archived-routine").messages).toHaveLength(2);
  });
});

describe("the Undo case of each other write", () => {
  const startingGoal: GoalAnswers = {
    goal: "aesthetic",
    focus: ["arms"],
    days_per_week: 4,
    session_minutes: 45,
    equipment: ["barbell", "dumbbell"],
    experience: "beginner",
  };
  const originalSets = (reps: number[]): Tables => ({
    workout_sets: reps.map((count, index) => ({
      id: `set-${index + 1}`,
      session_id: "session-1",
      position: index,
      reps: count,
      load_kg: index < 3 ? 100 : 160,
      deleted_at: null,
    })),
  });
  const fixtureActive = (isActive: boolean): Tables => ({
    routines: [
      { id: "fixture", name: ACTIVE_ROUTINE.name, is_active: isActive, is_archived: false },
    ],
  });

  async function reasonsAfterUndo(
    id: string,
    turnIndex: number,
    play: Play,
    presses: Parameters<typeof pressUndo>[3],
  ) {
    const evalCase = caseOf(id);
    await evalCase.setup?.(fakeEnvironment());
    const { turns, database } = playOf(play);
    await pressUndo(id, turnIndex, turns, presses);
    const outcomes = await Promise.all(evalCase.expect.map((grade) => grade({ turns, database })));
    return outcomes.filter(({ passed }) => !passed).map(({ reason }) => reason);
  }

  const table = [
    {
      id: "edits-undo-making-a-routine-active",
      turnIndex: 0,
      step: { actions: ["set_active_routine"] },
      back: () => merge(tablesOf(seededShape()), fixtureActive(true)),
      notBack: () => merge(tablesOf({ ...seededShape(), active: true }), fixtureActive(false)),
    },
    {
      id: "edits-undo-an-archived-routine",
      turnIndex: 1,
      step: { actions: ["archive_routine"] },
      back: () => tablesOf(seededShape()),
      notBack: () => tablesOf({ ...seededShape(), archived: true }),
    },
    {
      id: "edits-undo-a-past-set",
      turnIndex: 0,
      step: { actions: ["update_past_set"] },
      back: () => originalSets([6, 6, 6, 10, 10]),
      notBack: () => originalSets([6, 8, 6, 10, 10]),
    },
    {
      id: "edits-undo-a-goal-change",
      turnIndex: 0,
      step: { actions: ["update_training_goals"] },
      back: () => ({ training_goals: [goalRowOf(startingGoal)] }),
      notBack: () => ({
        training_goals: [goalRowOf({ ...startingGoal, goal: "strength", days_per_week: 3 })],
      }),
    },
    {
      id: "edits-undo-a-built-routine",
      turnIndex: 0,
      step: { actions: ["create_routine"] },
      back: () => tablesOf({ ...builtRoutine(1), archived: true }),
      notBack: () => tablesOf(builtRoutine(1)),
    },
  ] as const;

  it.each(table)(
    "$id should pass when Undo answered undone then already_undone and the rows are back",
    async ({ id, turnIndex, step, back }) => {
      const steps = turnIndex === 1 ? [{ status: "confirm" as const }, step] : [step];

      expect(
        await reasonsAfterUndo(id, turnIndex, { steps: [...steps], tables: back }, [
          "undone",
          "already_undone",
        ]),
      ).toEqual([]);
    },
  );

  it.each(table)(
    "$id should fail when the rows are not back",
    async ({ id, turnIndex, step, notBack }) => {
      const steps = turnIndex === 1 ? [{ status: "confirm" as const }, step] : [step];

      const reasons = await reasonsAfterUndo(
        id,
        turnIndex,
        { steps: [...steps], tables: notBack },
        ["undone", "already_undone"],
      );

      expect(reasons.length).toBeGreaterThan(0);
    },
  );

  it.each(table)(
    "$id should fail when the second press did not find the write already undone",
    async ({ id, turnIndex, step, back }) => {
      const steps = turnIndex === 1 ? [{ status: "confirm" as const }, step] : [step];

      const reasons = await reasonsAfterUndo(id, turnIndex, { steps: [...steps], tables: back }, [
        "undone",
        "undone",
      ]);

      expect(reasons.join(" ")).toContain("Undo answered undone, then undone");
    },
  );
});

describe("the changed-since cases", () => {
  const refused = (reason?: AssistantUndoResult["reason"]): AssistantUndoResult[] => [
    {
      actionId: "44444444-4444-4444-8444-444444444444",
      result: "undo_unavailable",
      ...(reason === undefined ? {} : { reason }),
    },
  ];

  async function grade(id: string, play: Play, undoResults: AssistantUndoResult[]) {
    const evalCase = caseOf(id);
    await evalCase.setup?.(fakeEnvironment());
    world.undoResults = undoResults;
    const { turns, database } = playOf(play);
    const [turn] = turns;
    await evalCase.afterTurn?.({ index: 0, result: turn ?? turnResult() }, fakeEnvironment());
    const outcomes = await Promise.all(
      evalCase.expect.map((grader) => grader({ turns, database })),
    );
    return outcomes.filter(({ passed }) => !passed).map(({ reason }) => reason);
  }

  it("should pass when a routine changed through the app is refused as changed and their change stands", async () => {
    const id = "edits-undo-refused-after-the-routine-changed-and-their-change-stands";
    const play: Play = {
      steps: [{ actions: ["edit_routine"] }],
      tables: () =>
        tablesOf(
          withLines(seededShape(), "Legs", [
            line(SQUAT, 4, 3, 5, 2),
            line(LEG_PRESS, 4, 8, 12, 2),
            line(LEG_CURL, 3, 10, 12, 1),
          ]),
        ),
    };

    expect(await grade(id, play, refused("changed"))).toEqual([]);
    expect(world.calls.some((call) => call.startsWith("app changes routine"))).toBe(true);
  });

  it("should fail when the Undo went through anyway and put the old sets back", async () => {
    const id = "edits-undo-refused-after-the-routine-changed-and-their-change-stands";
    const play: Play = {
      steps: [{ actions: ["edit_routine"] }],
      tables: () => tablesOf(seededShape()),
    };

    const reasons = await grade(id, play, [
      { actionId: "44444444-4444-4444-8444-444444444444", result: "undone" },
    ]);

    expect(reasons.join(" ")).toContain("Undo answered undone, not undo_unavailable (changed)");
    expect(reasons.join(" ")).toContain("squats are not at 4 sets");
  });

  it("should fail when the refusal gives the wrong reason", async () => {
    const id = "edits-undo-refused-after-the-routine-changed-and-their-change-stands";
    const play: Play = {
      steps: [{ actions: ["edit_routine"] }],
      tables: () =>
        tablesOf(
          withLines(seededShape(), "Legs", [
            line(SQUAT, 4, 3, 5, 2),
            line(LEG_PRESS, 4, 8, 12, 2),
            line(LEG_CURL, 3, 10, 12, 1),
          ]),
        ),
    };

    expect((await grade(id, play, refused("active"))).join(" ")).toContain("(changed)");
  });

  it("should pass when a set changed through the app is refused as changed and its 7 reps stand", async () => {
    const id = "edits-undo-refused-after-the-set-changed-and-their-change-stands";
    const play: Play = {
      steps: [{ actions: ["update_past_set"] }],
      tables: () => ({
        workout_sets: [6, 7, 6, 10, 10].map((reps, index) => ({
          id: `set-${index + 1}`,
          session_id: "session-1",
          position: index,
          reps,
          load_kg: index < 3 ? 100 : 160,
          deleted_at: null,
        })),
      }),
    };

    expect(await grade(id, play, refused("changed"))).toEqual([]);
  });

  it("should pass when a goal changed through the app is refused as changed and stands", async () => {
    const id = "edits-undo-refused-after-the-goal-changed-and-their-change-stands";
    const play: Play = {
      steps: [{ actions: ["update_training_goals"] }],
      tables: () => ({
        training_goals: [
          goalRowOf({
            goal: "strength",
            focus: ["arms"],
            days_per_week: 5,
            session_minutes: 45,
            equipment: ["barbell", "dumbbell"],
            experience: "beginner",
          }),
        ],
      }),
    };

    expect(await grade(id, play, refused("changed"))).toEqual([]);
  });

  it.each([
    [
      "edits-undo-of-a-built-routine-refused-after-an-edit",
      "changed",
      "app changes routine built-1",
    ],
    [
      "edits-undo-of-a-built-routine-refused-once-it-is-active",
      "active",
      "app makes built-1 active",
    ],
    [
      "edits-undo-of-a-built-routine-refused-once-a-workout-was-logged-from-it",
      "logged",
      "app logs a workout from built-day-1",
    ],
  ] as const)(
    "%s should be refused as %s and leave the routine standing",
    async (id, reason, call) => {
      const play: Play = {
        steps: [{ actions: ["create_routine"] }],
        tables: () => tablesOf({ ...builtRoutine(1), active: reason === "active" }),
      };

      expect(await grade(id, play, refused(reason))).toEqual([]);
      expect(world.calls).toContain(call);
    },
  );

  it("should fail when a built routine was archived although a workout was logged from it", async () => {
    const id = "edits-undo-of-a-built-routine-refused-once-a-workout-was-logged-from-it";
    const play: Play = {
      steps: [{ actions: ["create_routine"] }],
      tables: () => tablesOf({ ...builtRoutine(1), archived: true }),
    };

    expect((await grade(id, play, refused("logged"))).join(" ")).toContain(
      "the routine was archived",
    );
  });

  it("should pass when the day an edit added was used for a workout and the Undo is refused as logged", async () => {
    const id = "edits-undo-of-an-added-day-refused-once-a-workout-was-logged-from-it";
    const play: Play = {
      steps: [{ actions: ["edit_routine"] }],
      tables: () =>
        tablesOf({
          ...seededShape(),
          days: [...seededShape().days, { id: "added-day", name: "Arms", weekday: 5, lines: [] }],
        }),
    };

    expect(await grade(id, play, refused("logged"))).toEqual([]);
    expect(world.calls).toContain("app logs a workout from added-day");
  });
});

// ---------------------------------------------------------------------------------------------------------
// During a workout, pain and a name that is not a thing
// ---------------------------------------------------------------------------------------------------------

describe("edits-swap-during-a-workout-writes-nothing-offers-ask-again-and-a-question-answers", () => {
  const id = "edits-swap-during-a-workout-writes-nothing-offers-ask-again-and-a-question-answers";
  const right: Play = {
    steps: [
      {
        calls: [writeTool("edit_routine")],
        askAgain: true,
        answer:
          "A workout is in progress. Finish it or discard it on the Train tab, then ask again.",
      },
      { calls: [read("get_workouts")], answer: "Last time you squatted 112.5 kg for 5 reps." },
    ],
    tables: () => tablesOf(seededShape()),
  };

  it("should pass for a refusal with Ask again, and a question that is answered", async () => {
    const startWorkout = vi.fn(() => Promise.resolve());
    const attached = {
      ensureHistory: vi.fn(() => Promise.resolve()),
      startWorkout,
    } as unknown as Parameters<typeof trainingWorldHolder.attach>[0];
    trainingWorldHolder.attach(attached);

    await passes(id, right);

    expect(startWorkout).toHaveBeenCalledOnce();
  });

  it("should fail when the swap landed during the workout", async () => {
    await failsOn(
      id,
      {
        ...right,
        steps: [
          {
            ...(right.steps[0] ?? {}),
            actions: ["edit_routine"],
            cards: [cardOf("routine_updated", 1)],
          },
          ...right.steps.slice(1),
        ],
      },
      /left 1 action rows/,
    );
  });

  it("should fail when no Ask again is stored for the refusal", async () => {
    await failsOn(
      id,
      {
        ...right,
        steps: [{ ...(right.steps[0] ?? {}), askAgain: false }, ...right.steps.slice(1)],
      },
      "Ask again is not offered",
    );
  });

  it("should fail when the reply does not tell the person to finish or discard the workout", async () => {
    await failsOn(
      id,
      {
        ...right,
        steps: [{ ...(right.steps[0] ?? {}), answer: "Not now." }, ...right.steps.slice(1)],
      },
      "say to finish or discard",
    );
  });

  it("should fail when the question about the last squat was refused or gave another number", async () => {
    await failsOn(
      id,
      { ...right, steps: [right.steps[0] ?? {}, { answer: "No workouts found." }] },
      "no number within",
    );
  });
});

describe("the Ask again rule", () => {
  it("should not count a stored flag as offered when a write landed in the same turn", async () => {
    // The executor stores the flag on the first refusal even when another call of the turn wrote, and the app
    // draws it only for a turn with no card, so a turn with a card and the flag is a turn with no Ask again.
    const id = "edits-swap-during-a-workout-writes-nothing-offers-ask-again-and-a-question-answers";
    trainingWorldHolder.attach({
      ensureHistory: () => Promise.resolve(),
      startWorkout: () => Promise.resolve(),
    } as unknown as Parameters<typeof trainingWorldHolder.attach>[0]);
    const reasons = await gradeCase(id, {
      steps: [
        { askAgain: true, cards: [cardOf("logged")], answer: "finish or discard" },
        { answer: "112.5" },
      ],
      tables: () => tablesOf(seededShape()),
    });

    expect(reasons.join(" ")).toContain("Ask again is not offered");
  });
});

describe("edits-pain-when-benching-swaps-and-points-to-a-doctor", () => {
  const id = "edits-pain-when-benching-swaps-and-points-to-a-doctor";
  const pushWith = (ref: string): RoutineShape =>
    withLines(seededShape(), "Push", [
      atPreset(ref),
      line(OVERHEAD, 3, 6, 10, 2),
      line(PUSHDOWN, 3, 10, 15, 1),
    ]);
  const right = (answer = "Ask a doctor or a physio about the pain."): Play => ({
    steps: [
      {
        answer,
        calls: [writeTool("edit_routine")],
        actions: ["edit_routine"],
        cards: [cardOf("routine_updated", 1)],
      },
    ],
    tables: () => tablesOf(pushWith(DUMBBELL_BENCH)),
  });

  it("should pass for a swap and a pointer to a physio", async () => {
    await passes(id, right());
  });

  it("should fail for a swap with no pointer", async () => {
    await failsOn(id, right("Swapped it."), "point to a doctor or a physio");
  });

  it("should fail when the bench press is still there", async () => {
    await failsOn(
      id,
      { ...right(), tables: () => tablesOf(pushWith(BENCH)) },
      "the bench press is still in the day",
    );
  });

  it("should fail when the model only gave advice and swapped nothing", async () => {
    await failsOn(
      id,
      { steps: [{ answer: "See a doctor." }], tables: () => tablesOf(pushWith(BENCH)) },
      "left 0 action rows, not 1",
    );
  });
});

describe("edits-an-exercise-that-does-not-exist-is-searched-or-asked-never-guessed", () => {
  const id = "edits-an-exercise-that-does-not-exist-is-searched-or-asked-never-guessed";

  it("should pass for a search that found nothing and a reply, with nothing written", async () => {
    await passes(id, {
      steps: [{ calls: [read("get_routines"), read("search_exercises")] }],
      tables: () => tablesOf(seededShape()),
    });
  });

  it("should pass for a question and nothing written", async () => {
    await passes(id, {
      steps: [{ status: "clarify", calls: [writeTool("ask_user")] }],
      tables: () => tablesOf(seededShape()),
    });
  });

  it("should fail when a close exercise was added instead", async () => {
    await failsOn(
      id,
      {
        steps: [
          {
            calls: [read("search_exercises"), writeTool("edit_routine")],
            actions: ["edit_routine"],
            cards: [cardOf("routine_updated", 1)],
          },
        ],
        tables: () =>
          tablesOf(
            withDay(seededShape(), "Legs", (day) => ({
              ...day,
              lines: [...day.lines, atPreset("Barbell_Curl")],
            })),
          ),
      },
      "left 1 action rows",
    );
  });

  it("should fail when the model neither searched nor asked", async () => {
    await failsOn(
      id,
      { steps: [{ answer: "No such exercise." }], tables: () => tablesOf(seededShape()) },
      "no route passed",
    );
  });

  it("should fail for a call with an id nobody searched for, even one the tool refused", async () => {
    await failsOn(
      id,
      {
        steps: [
          {
            calls: [
              read("search_exercises"),
              writeTool("edit_routine", { changes: [{ exercise_id: "made-up" }] }),
            ],
          },
        ],
        tables: () => tablesOf(seededShape()),
      },
      "edit_routine was called",
    );
  });
});

// ---------------------------------------------------------------------------------------------------------
// The user's own exercises, deleting a workout, and Undo after the conversation is gone
// ---------------------------------------------------------------------------------------------------------

const exerciseRow = (name: string, over: Row = {}): Tables => ({
  exercises: [
    {
      id: `custom:${name}`,
      name,
      equipment: "dumbbell",
      deleted_at: null,
      source_ref: null,
      mechanic: "isolation",
      ...over,
    },
  ],
  exercise_muscles: [
    { exercise_id: `custom:${name}`, muscle_id: "chest_lower", role: "primary" },
    { exercise_id: `custom:${name}`, muscle_id: "delt_front", role: "secondary" },
  ],
});

describe("the custom exercise cases", () => {
  it("should pass for a cable exercise with a chest primary and secondary front delts, and no card link", async () => {
    await passes("edits-exercise-create-a-custom-one-with-no-card-link", {
      steps: [{ actions: ["save_custom_exercise"], cards: [cardOf("exercise_created")] }],
      tables: () => exerciseRow("Scratch cable crossover", { equipment: "cable" }),
    });
  });

  it("should fail when the card holds a link", async () => {
    const link = {
      label: "Open",
      target: {
        screen: "routine_editor" as const,
        routineId: "11111111-1111-4111-8111-111111111111",
      },
    };
    await failsOn(
      "edits-exercise-create-a-custom-one-with-no-card-link",
      {
        steps: [
          { actions: ["save_custom_exercise"], cards: [cardOf("exercise_created", 0, link)] },
        ],
        tables: () => exerciseRow("Scratch cable crossover", { equipment: "cable" }),
      },
      "a card holds a link",
    );
  });

  it("should fail when the equipment is not the one asked for", async () => {
    await failsOn(
      "edits-exercise-create-a-custom-one-with-no-card-link",
      {
        steps: [{ actions: ["save_custom_exercise"], cards: [cardOf("exercise_created")] }],
        tables: () => exerciseRow("Scratch cable crossover"),
      },
      "not a cable exercise",
    );
  });

  const edit = (equipment: string, muscles: Row[], calls: ToolCall[]): Play => ({
    steps: [{ calls, actions: ["save_custom_exercise"], cards: [cardOf("exercise_updated")] }],
    tables: () => ({
      exercises: [
        {
          id: "custom:Scratch dumbbell fly",
          name: "Scratch dumbbell fly",
          equipment,
          deleted_at: null,
        },
      ],
      exercise_muscles: muscles,
    }),
  });
  const bothMuscles: Row[] = [
    { exercise_id: "custom:Scratch dumbbell fly", muscle_id: "chest_lower", role: "primary" },
    { exercise_id: "custom:Scratch dumbbell fly", muscle_id: "delt_front", role: "secondary" },
  ];
  const searchThenSave = [
    read("search_exercises"),
    writeTool("save_custom_exercise", { id: "custom:Scratch dumbbell fly", equipment: "cable" }),
  ];

  it("should pass for an equipment edit by the searched id that keeps the secondary muscle", async () => {
    await passes(
      "edits-exercise-edit-keeps-a-secondary-muscle",
      edit("cable", bothMuscles, searchThenSave),
    );
  });

  it("should fail when the edit replaced the map and dropped the secondary muscle", async () => {
    await failsOn(
      "edits-exercise-edit-keeps-a-secondary-muscle",
      edit("cable", bothMuscles.slice(0, 1), searchThenSave),
      "lost the chest or the secondary front delts",
    );
  });

  it("should fail when the id was not the one search_exercises gave", async () => {
    await failsOn(
      "edits-exercise-edit-keeps-a-secondary-muscle",
      edit("cable", bothMuscles, [
        read("search_exercises"),
        writeTool("save_custom_exercise", { id: "made-up" }),
      ]),
      "the id search_exercises gave",
    );
  });

  it("should fail when no search came first", async () => {
    await failsOn(
      "edits-exercise-edit-keeps-a-secondary-muscle",
      edit("cable", bothMuscles, searchThenSave.slice(1)),
      "search_exercises was not called",
    );
  });

  it("should press the archive labels core gives", () => {
    expect(caseOf("edits-exercise-archive-after-a-yes").messages[1]).toBe(
      confirmArchiveExerciseButtons().confirmLabel,
    );
    expect(caseOf("edits-exercise-archive-after-a-no").messages[1]).toBe(
      confirmArchiveExerciseButtons().cancelLabel,
    );
  });

  it("should pass for an archive after a yes, and fail when it was not archived", async () => {
    const steps = [
      { status: "confirm" as const },
      { actions: ["archive_custom_exercise"], cards: [cardOf("exercise_archived")] },
    ];
    await passes("edits-exercise-archive-after-a-yes", {
      steps,
      tables: () => exerciseRow("Scratch rope pulldown", { deleted_at: "2026-11-07T10:00:00Z" }),
    });
    await failsOn(
      "edits-exercise-archive-after-a-yes",
      { steps, tables: () => exerciseRow("Scratch rope pulldown") },
      "the exercise is not archived",
    );
  });

  it("should pass for an archive after a no that kept the exercise, and fail when it went", async () => {
    const steps = [{ status: "confirm" as const }, { status: "complete" as const }];
    await passes("edits-exercise-archive-after-a-no", {
      steps,
      tables: () => exerciseRow("Scratch rope curl"),
    });
    await failsOn(
      "edits-exercise-archive-after-a-no",
      {
        steps,
        tables: () => exerciseRow("Scratch rope curl", { deleted_at: "2026-11-07T10:00:00Z" }),
      },
      "the exercise is archived",
    );
  });

  const inUseId = "edits-exercise-archive-one-in-a-routine-is-refused-without-a-question";
  const live = () => exerciseRow("Scratch row machine");

  it("should pass when the tool answered in_use and the reply names the routine", async () => {
    await passes(inUseId, {
      steps: [
        {
          calls: [{ ...writeTool("archive_custom_exercise"), errorCode: "in_use" }],
          answer: "Take it out of your routines first.",
        },
      ],
      tables: live,
    });
  });

  it("should pass when the reply explains it without calling the tool", async () => {
    await passes(inUseId, {
      steps: [{ calls: [read("get_routines")], answer: "It is in a routine." }],
      tables: live,
    });
  });

  it("should fail when the tool asked for a yes, or was refused for another reason", async () => {
    await failsOn(
      inUseId,
      {
        steps: [{ status: "confirm", calls: [writeTool("archive_custom_exercise")] }],
        tables: live,
      },
      "ended confirm",
    );
    await failsOn(
      inUseId,
      {
        steps: [
          {
            calls: [{ ...writeTool("archive_custom_exercise"), errorCode: "not_found" }],
            answer: "A routine.",
          },
        ],
        tables: live,
      },
      "no route passed",
    );
  });

  it("should fail when the exercise was archived", async () => {
    await failsOn(
      inUseId,
      {
        steps: [{ actions: ["archive_custom_exercise"], answer: "A routine." }],
        tables: () => exerciseRow("Scratch row machine", { deleted_at: "2026-11-07T10:00:00Z" }),
      },
      "left 1 action rows",
    );
  });

  it("should undo a created exercise, an edited one and an archived one", async () => {
    const created = caseOf("edits-undo-a-created-exercise");
    const { turns, database } = playOf({
      steps: [{ actions: ["save_custom_exercise"] }],
      tables: () => ({}),
    });
    await pressUndo("edits-undo-a-created-exercise", 0, turns, ["undone", "already_undone"]);
    expect(
      (await Promise.all(created.expect.map((grade) => grade({ turns, database })))).filter(
        ({ passed }) => !passed,
      ),
    ).toEqual([]);

    const editedCase = caseOf("edits-undo-an-edited-exercise");
    await editedCase.setup?.(fakeEnvironment());
    const back = playOf({
      steps: [{ actions: ["save_custom_exercise"] }],
      tables: () => exerciseRow("Scratch dumbbell raise"),
    });
    await pressUndo("edits-undo-an-edited-exercise", 0, back.turns, ["undone", "already_undone"]);
    expect(
      (await Promise.all(editedCase.expect.map((grade) => grade(back)))).filter(
        ({ passed }) => !passed,
      ),
    ).toEqual([]);
    const notBack = playOf({
      steps: [{ actions: ["save_custom_exercise"] }],
      tables: () => exerciseRow("Scratch dumbbell raise", { equipment: "cable" }),
    });
    await pressUndo("edits-undo-an-edited-exercise", 0, notBack.turns, [
      "undone",
      "already_undone",
    ]);
    expect(
      (await Promise.all(editedCase.expect.map((grade) => grade(notBack)))).some(
        ({ passed }) => !passed,
      ),
    ).toBe(true);

    const archivedCase = caseOf("edits-undo-an-archived-exercise");
    await archivedCase.setup?.(fakeEnvironment());
    const unarchived = playOf({
      steps: [{ status: "confirm" }, { actions: ["archive_custom_exercise"] }],
      tables: () => exerciseRow("Scratch rope row"),
    });
    await pressUndo("edits-undo-an-archived-exercise", 1, unarchived.turns, [
      "undone",
      "already_undone",
    ]);
    expect(
      (await Promise.all(archivedCase.expect.map((grade) => grade(unarchived)))).filter(
        ({ passed }) => !passed,
      ),
    ).toEqual([]);
  });
});

describe("the delete workout cases", () => {
  const sessionRows = (...states: boolean[]): Tables => ({
    workout_sessions: states.map((deleted, index) => ({
      id: `session-${index + 1}`,
      deleted_at: deleted ? "2026-11-07T10:00:00Z" : null,
    })),
  });
  // setup seeds the routine first, so the workouts are session-1 and session-2 in the order of the case.
  const deleteCall = (sessionId: string): ToolCall =>
    writeTool("delete_workout", { session_id: sessionId });
  const asked = (question: string): Step => ({
    status: "confirm",
    calls: [deleteCall("session-1")],
    confirmation: { question },
  });

  it("should press the labels core gives", () => {
    expect(caseOf("edits-workout-delete-after-a-yes").messages[1]).toBe(
      confirmDeleteWorkoutButtons().confirmLabel,
    );
    expect(caseOf("edits-workout-delete-after-a-no").messages[1]).toBe(
      confirmDeleteWorkoutButtons().cancelLabel,
    );
  });

  it("should pass for a question, then a press that deletes the workout named, with no model call", async () => {
    await passes("edits-workout-delete-after-a-yes", {
      steps: [
        { status: "confirm", calls: [deleteCall("session-1")] },
        { actions: ["delete_workout"], cards: [cardOf("workout_deleted")] },
      ],
      tables: () => sessionRows(true),
    });
  });

  it("should fail when the call named a workout that is not the one asked about", async () => {
    await failsOn(
      "edits-workout-delete-after-a-yes",
      {
        steps: [
          { status: "confirm", calls: [deleteCall("session-9")] },
          { actions: ["delete_workout"], cards: [cardOf("workout_deleted")] },
        ],
        tables: () => sessionRows(true),
      },
      "named a workout other than the one asked about",
    );
  });

  it("should pass for a no that deletes nothing, and fail when the workout went", async () => {
    const steps: Step[] = [
      { status: "confirm", calls: [deleteCall("session-1")] },
      { status: "complete" },
    ];
    await passes("edits-workout-delete-after-a-no", { steps, tables: () => sessionRows(false) });
    await failsOn(
      "edits-workout-delete-after-a-no",
      { steps, tables: () => sessionRows(true) },
      "the workout is deleted",
    );
  });

  const misnamedId = "edits-workout-delete-the-day-in-the-question-is-the-day-deleted";
  const [newer, older] = [thursdayOf(ANCHOR, 8), thursdayOf(ANCHOR, 9)];
  const say = (date: string) => sayThursday(date).replace(/^Thursday /, "");
  const press: Step = { actions: ["delete_workout"], cards: [cardOf("workout_deleted")] };

  it("should pass when the question names the newer day, the call names the newer workout and the older stays", async () => {
    await passes(misnamedId, {
      steps: [asked(`Delete your Legs workout from ${say(newer)}?`), press],
      tables: () => sessionRows(true, false),
    });
  });

  it("should fail when the question names the older day although the call names the newer workout", async () => {
    await failsOn(
      misnamedId,
      {
        steps: [asked(`Delete your Legs workout from ${say(older)}?`), press],
        tables: () => sessionRows(true, false),
      },
      "does not name the day",
    );
  });

  it("should fail when the question names both days", async () => {
    await failsOn(
      misnamedId,
      {
        steps: [asked(`${say(newer)} or ${say(older)}?`), press],
        tables: () => sessionRows(true, false),
      },
      "names the day of the other workout",
    );
  });

  it("should fail when the older workout was deleted too", async () => {
    await failsOn(
      misnamedId,
      {
        steps: [asked(`Delete the ${say(newer)} workout?`), press],
        tables: () => sessionRows(true, true),
      },
      "the workout is deleted",
    );
  });

  it("should read a day written as 8th of Oct or October 8, and not a bare weekday or a count", () => {
    expect(namesDay("Delete the 8th of Oct workout?", "2026-10-08")).toBe(true);
    expect(namesDay("Delete the October 8 workout?", "2026-10-08")).toBe(true);
    expect(namesDay("Delete Thursday's workout with 8 sets?", "2026-10-08")).toBe(false);
    expect(namesDay("Delete 18 October?", "2026-10-08")).toBe(false);
  });

  it("should undo a deleted workout, with its sets back", async () => {
    const id = "edits-undo-a-deleted-workout";
    await caseOf(id).setup?.(fakeEnvironment());
    const { turns, database } = playOf({
      steps: [{ status: "confirm" }, { actions: ["delete_workout"] }],
      tables: () => ({
        ...sessionRows(false),
        workout_sets: [0, 1].map((position) => ({
          session_id: "session-1",
          id: `set-${position}`,
          position,
          reps: 5,
          load_kg: 100,
          deleted_at: null,
        })),
      }),
    });
    await pressUndo(id, 1, turns, ["undone", "already_undone"]);

    expect(
      (await Promise.all(caseOf(id).expect.map((grade) => grade({ turns, database })))).filter(
        ({ passed }) => !passed,
      ),
    ).toEqual([]);
  });
});

describe("edits-undo-after-the-conversation-is-deleted", () => {
  const id = "edits-undo-after-the-conversation-is-deleted";

  async function run(results: AssistantUndoResult[], archived: boolean) {
    const evalCase = caseOf(id);
    await evalCase.setup?.(fakeEnvironment());
    world.undoResults = results;
    const { turns, database } = playOf({
      steps: [{ status: "confirm" }, { actions: ["archive_routine"] }],
      tables: () => tablesOf({ ...seededShape(), archived }),
    });
    await evalCase.afterTurn?.({ index: 1, result: turns[1] ?? turnResult() }, fakeEnvironment());
    const outcomes = await Promise.all(evalCase.expect.map((grade) => grade({ turns, database })));
    return outcomes.filter(({ passed }) => !passed).map(({ reason }) => reason);
  }
  const undone: AssistantUndoResult[] = [
    { actionId: "44444444-4444-4444-8444-444444444444", result: "undone" },
  ];

  it("should read the action ids before it deletes the conversation, then press Undo for them", async () => {
    expect(await run(undone, false)).toEqual([]);
    expect(
      world.calls.filter((call) => call.startsWith("delete") || call.startsWith("undo")),
    ).toEqual(["delete conversation conversation-1", "undo for action-1"]);
  });

  it("should fail when Undo answered unavailable once the conversation was gone", async () => {
    const reasons = await run(
      [{ actionId: "44444444-4444-4444-8444-444444444444", result: "undo_unavailable" }],
      false,
    );

    expect(reasons.join(" ")).toContain(
      "Undo answered undo_unavailable after the conversation was deleted",
    );
  });

  it("should fail when the routine is still archived", async () => {
    expect((await run(undone, true)).join(" ")).toContain("the routine is still archived");
  });
});
