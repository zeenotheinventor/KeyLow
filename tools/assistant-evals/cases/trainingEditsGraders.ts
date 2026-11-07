// The graders of the training edits set (KEY-911). They read what the database holds and what the turn stored,
// and never what the reply says. A routine is read back from its rows (`routines`, `routine_days`,
// `routine_exercises` and the exercise each row names), so a write is proved by the rows it left and not by the
// card alone, and an Undo by the rows it brought back.
import { GOAL_PRESETS_V1, exerciseTargetFor } from "@keylow/core/training";

import { isRecord } from "./entryGraders.ts";

import type { Grader, GradeOutcome } from "../src/case.ts";
import type { ScratchRoutine } from "../src/trainingEditsWorld.ts";
import type { EvalDatabase } from "../src/types.ts";
import type { AssistantCardKind } from "@keylow/core";
import type { ExerciseMechanic, ExercisePrescription, GoalAnswers } from "@keylow/core/training";

const pass = (reason: string): GradeOutcome => ({ passed: true, reason });
const fail = (reason: string): GradeOutcome => ({ passed: false, reason });

type Row = Readonly<Record<string, unknown>>;

const textOf = (row: Row, column: string): string => {
  const value = row[column];
  if (typeof value !== "string") {
    throw new Error(`A row has no text in ${column}`);
  }
  return value;
};

const numberOf = (row: Row, column: string): number => {
  const value = row[column];
  if (typeof value !== "number") {
    throw new Error(`A row has no number in ${column}`);
  }
  return value;
};

const nullableNumberOf = (row: Row, column: string): number | null =>
  row[column] === null ? null : numberOf(row, column);

export type StoredExercise = Readonly<{
  exerciseId: string;
  name: string;
  sourceRef: string | null;
  mechanic: ExerciseMechanic;
  sets: number;
  repMin: number;
  repMax: number;
  rir: number | null;
}>;

export type StoredDay = Readonly<{
  id: string;
  name: string;
  weekday: number | null;
  exercises: readonly StoredExercise[];
}>;

export type StoredRoutine = Readonly<{
  id: string;
  name: string;
  isActive: boolean;
  isArchived: boolean;
  days: readonly StoredDay[];
}>;

const mechanicOf = (row: Row): ExerciseMechanic => {
  const mechanic = row["mechanic"];
  if (mechanic === "compound" || mechanic === "isolation") {
    return mechanic;
  }
  throw new Error("An exercise row has no mechanic");
};

const byPosition = (first: Row, second: Row): number =>
  numberOf(first, "position") - numberOf(second, "position");

/** A routine read back from its rows, as the eval user. Null when no routine has this name or id. */
export async function readRoutine(
  database: EvalDatabase,
  which: Readonly<{ name: string }> | Readonly<{ id: string }>,
): Promise<StoredRoutine | null> {
  const [routine] = await database.readRows({ table: "routines", where: { ...which } });
  if (routine === undefined) {
    return null;
  }
  const dayRows = [
    ...(await database.readRows({
      table: "routine_days",
      where: { routine_id: textOf(routine, "id") },
    })),
  ].sort(byPosition);
  const days = await Promise.all(
    dayRows.map(async (day): Promise<StoredDay> => {
      const planned = [
        ...(await database.readRows({
          table: "routine_exercises",
          where: { routine_day_id: textOf(day, "id") },
        })),
      ].sort(byPosition);
      const exercises = await Promise.all(
        planned.map(async (line): Promise<StoredExercise> => {
          const exerciseId = textOf(line, "exercise_id");
          const [exercise] = await database.readRows({
            table: "exercises",
            where: { id: exerciseId },
          });
          if (exercise === undefined) {
            throw new Error("A routine names an exercise that cannot be read");
          }
          return {
            exerciseId,
            name: textOf(exercise, "name"),
            sourceRef: typeof exercise["source_ref"] === "string" ? exercise["source_ref"] : null,
            mechanic: mechanicOf(exercise),
            sets: numberOf(line, "target_sets"),
            repMin: numberOf(line, "rep_min"),
            repMax: numberOf(line, "rep_max"),
            rir: nullableNumberOf(line, "target_rir"),
          };
        }),
      );
      return {
        id: textOf(day, "id"),
        name: textOf(day, "name"),
        weekday: nullableNumberOf(day, "weekday"),
        exercises,
      };
    }),
  );
  return {
    id: textOf(routine, "id"),
    name: textOf(routine, "name"),
    isActive: routine["is_active"] === true,
    isArchived: routine["is_archived"] === true,
    days,
  };
}

/** What a stored routine must hold: null when it does, and the first thing it does not otherwise. */
export type RoutineCheck = (routine: StoredRoutine) => string | null;

/** Passes when the routine of this name is stored and the check finds nothing wrong with it. */
export function routineIs(name: string, check: RoutineCheck, description: string): Grader {
  return async ({ database }) => {
    const routine = await readRoutine(database, { name });
    if (routine === null) {
      return fail(`no routine holds the name the case gave it, so ${description} cannot be true`);
    }
    const problem = check(routine);
    return problem === null ? pass(description) : fail(`${description}: ${problem}`);
  };
}

/** The routine a plan describes, as a check: the same days in order, the same exercises and the same numbers. */
export function matchesPlan(plan: ScratchRoutine): RoutineCheck {
  return (routine) => {
    if (routine.days.length !== plan.days.length) {
      return `it has ${routine.days.length} days and not ${plan.days.length}`;
    }
    for (const [dayIndex, planned] of plan.days.entries()) {
      const day = routine.days[dayIndex];
      if (day === undefined || day.name !== planned.name || day.weekday !== planned.weekday) {
        return `day ${dayIndex + 1} is not the day the case made`;
      }
      if (day.exercises.length !== planned.exercises.length) {
        return `day ${dayIndex + 1} has ${day.exercises.length} exercises and not ${planned.exercises.length}`;
      }
      for (const [index, line] of planned.exercises.entries()) {
        const stored = day.exercises[index];
        if (
          stored === undefined ||
          stored.sourceRef !== line.sourceRef ||
          stored.sets !== line.sets ||
          stored.repMin !== line.repMin ||
          stored.repMax !== line.repMax ||
          stored.rir !== line.rir
        ) {
          return `exercise ${index + 1} of day ${dayIndex + 1} is not as the case made it`;
        }
      }
    }
    return null;
  };
}

/** The day of a routine by name, or undefined. */
export const dayNamed = (routine: StoredRoutine, name: string): StoredDay | undefined =>
  routine.days.find((day) => day.name === name);

/** The exercise of a day by its library `source_ref`, or undefined. */
export const exerciseOf = (day: StoredDay, sourceRef: string): StoredExercise | undefined =>
  day.exercises.find((line) => line.sourceRef === sourceRef);

/** What Ki-Lo gives an exercise for a goal: the preset, worked out by core as the tools work it out. */
export const presetFor = (
  goal: Pick<GoalAnswers, "goal" | "experience">,
  mechanic: ExerciseMechanic,
): ExercisePrescription =>
  exerciseTargetFor({ goal: goal.goal, experience: goal.experience, mechanic }, GOAL_PRESETS_V1);

/** Whether a stored exercise holds exactly the preset numbers of the goal. */
export const holdsPreset = (
  line: StoredExercise,
  goal: Pick<GoalAnswers, "goal" | "experience">,
): boolean => {
  const preset = presetFor(goal, line.mechanic);
  return (
    line.sets === preset.sets &&
    line.repMin === preset.repMin &&
    line.repMax === preset.repMax &&
    line.rir === preset.targetRir
  );
};

/** Every exercise of the routine, in day order. */
export const exercisesOf = (routine: StoredRoutine): readonly StoredExercise[] =>
  routine.days.flatMap((day) => day.exercises);

// ---------------------------------------------------------------------------------------------------------
// The cards and the stored display of a turn
// ---------------------------------------------------------------------------------------------------------

/** Passes when the turn drew exactly these cards, in order, by kind. A turn that drew none has an empty list. */
export function cardKinds(turnIndex: number, kinds: readonly AssistantCardKind[]): Grader {
  return ({ turns }) => {
    const drawn = (turns[turnIndex]?.cards ?? []).map((card) => card.kind);
    return Promise.resolve(
      drawn.length === kinds.length && drawn.every((kind, index) => kind === kinds[index])
        ? pass(`turn ${turnIndex + 1} drew ${kinds.join(", ") || "no card"}`)
        : fail(
            `turn ${turnIndex + 1} drew ${drawn.join(", ") || "no card"}, not ${kinds.join(", ") || "no card"}`,
          ),
    );
  };
}

/** Passes when the turn's only card of the kind has this many rows. Rows count: one for each change. */
export function cardRowCount(turnIndex: number, kind: AssistantCardKind, rows: number): Grader {
  return ({ turns }) => {
    const cards = (turns[turnIndex]?.cards ?? []).filter((card) => card.kind === kind);
    const [card] = cards;
    if (cards.length !== 1 || card === undefined) {
      return Promise.resolve(
        fail(`turn ${turnIndex + 1} drew ${cards.length} ${kind} cards, not 1`),
      );
    }
    return Promise.resolve(
      card.rows.length === rows
        ? pass(`the ${kind} card has ${rows} rows`)
        : fail(`the ${kind} card has ${card.rows.length} rows, not ${rows}`),
    );
  };
}

/** Passes when no card of the turn holds a link: the exercise cards open nothing, because no screen edits one. */
export function noCardLink(turnIndex: number): Grader {
  return ({ turns }) =>
    Promise.resolve(
      (turns[turnIndex]?.cards ?? []).every((card) => card.link === null)
        ? pass("no card holds a link")
        : fail("a card holds a link"),
    );
}

/** The `display` objects of every message of a turn, as the app reads them to draw cards, links and Ask again. */
async function displaysOfTurn(database: EvalDatabase, turnId: string): Promise<readonly Row[]> {
  const rows = await database.readRows({ table: "assistant_messages", where: { turn_id: turnId } });
  return rows.flatMap((row) => (isRecord(row["display"]) ? [row["display"]] : []));
}

/** Every entry of those displays (one for each tool result that left something to draw). */
const entriesOf = (displays: readonly Row[]): readonly Row[] =>
  displays.flatMap((display) => Object.values(display).filter(isRecord));

/** The links the turn stored, as the label and the screen they open. */
export async function linksOfTurn(
  database: EvalDatabase,
  turnId: string,
): Promise<readonly Readonly<{ screen: string; routineId: string | null }>[]> {
  const entries = entriesOf(await displaysOfTurn(database, turnId));
  return entries.flatMap(({ link }) => {
    if (!isRecord(link) || !isRecord(link["target"])) {
      return [];
    }
    const { screen, routineId } = link["target"];
    return typeof screen === "string"
      ? [{ screen, routineId: typeof routineId === "string" ? routineId : null }]
      : [];
  });
}

/**
 * Passes when the turn stored one link, to the routine editor of the routine, and drew no card: the answer to a
 * request the assistant cannot make (a day is removed in the editor only).
 */
export function linkToRoutineEditor(turnIndex: number, routineIdOf: () => string): Grader {
  return async ({ turns, database }) => {
    const turn = turns[turnIndex];
    if (turn === undefined) {
      return fail(`the case has no turn ${turnIndex + 1}`);
    }
    const links = await linksOfTurn(database, turn.turnId);
    const wanted = routineIdOf();
    return links.some(
      ({ screen, routineId }) => screen === "routine_editor" && routineId === wanted,
    )
      ? pass("the turn stored a link to the routine editor of the routine")
      : fail(`the turn stored ${links.length} links, none to the routine editor of the routine`);
  };
}

/**
 * Whether the person is offered Ask again for the turn, as the app draws it: the turn stored the flag (the
 * executor stores it on the first write a workout refused), ended complete, and drew no card. The app never offers
 * it after a write landed, because pressing it would send the whole message again and repeat that write, and the
 * live turn sends no `ask_again` event then either. The flag can be stored on a turn that also wrote, so the stored
 * flag alone is not what the person sees.
 */
export function askAgainOffered(turnIndex: number, expected: boolean): Grader {
  return async ({ turns, database }) => {
    const turn = turns[turnIndex];
    if (turn === undefined) {
      return fail(`the case has no turn ${turnIndex + 1}`);
    }
    const stored = entriesOf(await displaysOfTurn(database, turn.turnId)).some(
      (entry) => entry["askAgain"] === true,
    );
    const wroteSomething = (turn.cards ?? []).length > 0;
    const offered = stored && turn.status === "complete" && !wroteSomething;
    return offered === expected
      ? pass(expected ? "Ask again is offered" : "no Ask again is offered")
      : fail(
          expected
            ? "Ask again is not offered for a turn a workout refused"
            : "Ask again is offered after a write landed or a question",
        );
  };
}

/** Passes when a call of the tool answered with this error code (the code the stored result carried). */
export function toolAnswered(tool: string, errorCode: string): Grader {
  return ({ turns }) =>
    Promise.resolve(
      turns.some((turn) =>
        turn.toolCalls.some((call) => call.name === tool && call.errorCode === errorCode),
      )
        ? pass(`${tool} answered ${errorCode}`)
        : fail(`${tool} never answered ${errorCode}`),
    );
}

/** Passes when the turn made at least one call of the tool, whatever it answered. */
export function toolWasCalled(tool: string): Grader {
  return ({ turns }) =>
    Promise.resolve(
      turns.some((turn) => turn.toolCalls.some((call) => call.name === tool))
        ? pass(`${tool} was called`)
        : fail(`${tool} was not called`),
    );
}

/** Passes when the tool was not called at all, in any turn. */
export function toolNotCalled(tool: string): Grader {
  return ({ turns }) =>
    Promise.resolve(
      turns.some((turn) => turn.toolCalls.some((call) => call.name === tool))
        ? fail(`${tool} was called`)
        : pass(`${tool} was not called`),
    );
}

// ---------------------------------------------------------------------------------------------------------
// A routine the assistant built, a goal, a set and the time of a turn
// ---------------------------------------------------------------------------------------------------------

/**
 * Passes when the check finds nothing wrong with the routine the turn's `create_routine` made, found through the
 * action the turn left (its target), so the case needs no name to look it up by.
 */
export function routineMadeIn(
  turnIndex: number,
  check: (routine: StoredRoutine, context: Parameters<Grader>[0]) => string | null,
  description: string,
): Grader {
  return async (context) => {
    const turn = context.turns[turnIndex];
    if (turn === undefined) {
      return fail(`the case has no turn ${turnIndex + 1}`);
    }
    const [action] = await context.database.readRows({
      table: "assistant_actions",
      where: { turn_id: turn.turnId, tool: "create_routine" },
    });
    const id = action?.["target_id"];
    if (typeof id !== "string") {
      return fail(`turn ${turnIndex + 1} made no routine, so ${description} cannot be true`);
    }
    const routine = await readRoutine(context.database, { id });
    if (routine === null) {
      return fail(`the routine the turn made cannot be read, so ${description} cannot be true`);
    }
    const problem = check(routine, context);
    return problem === null ? pass(description) : fail(`${description}: ${problem}`);
  };
}

/** The key of a place: a day of a routine and an exercise in it. */
export const placeKey = (dayId: string, exerciseId: string): string => `${dayId}|${exerciseId}`;

/** The places every `set_targets` change of every `edit_routine` call named, over the turns. */
export function placesSetByTheModel(turns: Parameters<Grader>[0]["turns"]): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const call of turns.flatMap((turn) => turn.toolCalls)) {
    if (
      call.name !== "edit_routine" ||
      !isRecord(call.input) ||
      !Array.isArray(call.input["changes"])
    ) {
      continue;
    }
    for (const change of call.input["changes"]) {
      if (
        isRecord(change) &&
        change["op"] === "set_targets" &&
        typeof change["day_id"] === "string" &&
        typeof change["exercise_id"] === "string"
      ) {
        ids.add(placeKey(change["day_id"], change["exercise_id"]));
      }
    }
  }
  return ids;
}

/** The current goal as the database holds it (the row that is not closed), or null when there is none. */
export async function readCurrentGoal(database: EvalDatabase): Promise<Row | null> {
  const [goal] = await database.readRows({
    table: "training_goals",
    where: { effective_to: null },
  });
  return goal ?? null;
}

const sameList = (value: unknown, expected: readonly string[]): boolean =>
  Array.isArray(value) &&
  value.length === expected.length &&
  expected.every((item) => value.includes(item));

/** Passes when the current goal holds these answers, every one of the six. */
export function currentGoalIs(answers: GoalAnswers, description: string): Grader {
  return async ({ database }) => {
    const goal = await readCurrentGoal(database);
    if (goal === null) {
      return fail(`the user has no current goal, so ${description} cannot be true`);
    }
    const problem =
      goal["goal"] !== answers.goal
        ? "the goal differs"
        : goal["experience"] !== answers.experience
          ? "the experience differs"
          : goal["days_per_week"] !== answers.days_per_week
            ? "the days a week differ"
            : goal["session_minutes"] !== answers.session_minutes
              ? "the session length differs"
              : !sameList(goal["focus"], answers.focus)
                ? "the focus differs"
                : !sameList(goal["equipment"], answers.equipment)
                  ? "the equipment differs"
                  : null;
    return problem === null ? pass(description) : fail(`${description}: ${problem}`);
  };
}

/** The sets of a workout as the database holds them, in the order they were logged. */
export async function readSetsOfSession(
  database: EvalDatabase,
  sessionId: string,
): Promise<readonly Readonly<{ id: string; reps: number; loadKg: number | null }>[]> {
  const rows = [
    ...(await database.readRows({
      table: "workout_sets",
      where: { session_id: sessionId, deleted_at: null },
    })),
  ].sort((first, second) => numberOf(first, "position") - numberOf(second, "position"));
  return rows.map((row) => ({
    id: textOf(row, "id"),
    reps: numberOf(row, "reps"),
    loadKg: nullableNumberOf(row, "load_kg"),
  }));
}

/**
 * Prints how long the turn took and what it cost, and fails when it did not end or took longer than the turn
 * deadline of `turn.ts`. The tokens are the ones the run's budget counts: input, output and cache creation.
 */
export function turnTimeAndTokens(turnIndex: number, deadlineSeconds: number): Grader {
  return async ({ turns, database }) => {
    const turn = turns[turnIndex];
    if (turn === undefined) {
      return fail(`the case has no turn ${turnIndex + 1}`);
    }
    const [row] = await database.readRows({ table: "assistant_turns", where: { id: turn.turnId } });
    const started = Date.parse(String(row?.["created_at"]));
    const finished = Date.parse(String(row?.["finished_at"]));
    if (Number.isNaN(started) || Number.isNaN(finished)) {
      return fail("the turn row has no start or no end");
    }
    const seconds = (finished - started) / 1000;
    const usage = await database.usageOfTurn(turn.turnId);
    const counted = usage.inputTokens + usage.outputTokens + usage.cacheCreationInputTokens;
    console.log(
      `training edits build timing: ${seconds.toFixed(1)} s for the turn (deadline ${deadlineSeconds} s), ${turn.toolCalls.length} tool calls, ${counted} counted tokens`,
    );
    return seconds < deadlineSeconds
      ? pass(`the turn took ${seconds.toFixed(1)} s`)
      : fail(`the turn took ${seconds.toFixed(1)} s, over the ${deadlineSeconds} s deadline`);
  };
}
