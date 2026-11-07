// Changes a routine's exercises and days, with a card and Undo. The tool reads the routine itself and lays the
// changes over it in core (`applyRoutineChanges`), then saves the whole routine as the app's own editor does
// (`save_routine`), so the model sends only the changes. A day is never removed here, because that unlinks
// the sessions logged from it. Undo saves the draft the routine had before, and only while nothing has touched
// the routine since. A routine is health data: nothing here logs a name, an id or a number.
import { z } from "zod";

import {
  GOAL_PRESETS_V1,
  REMOVE_DAY_REFUSAL,
  OPEN_IN_ROUTINE_EDITOR,
  applyRoutineChanges,
  buildRoutineUpdatedCard,
  confirmRemoveExercisesButtons,
  confirmRemoveExercisesQuestion,
  draftOfStoredRoutine,
  exerciseTargetFor,
  routineFingerprint,
} from "../../core.ts";
import { getCurrentTrainingGoals, getRoutine, readExercisesById } from "../../repos.ts";
import { notFound } from "./entryWrite.ts";

import type {
  RoutineChange,
  RoutineDraft,
  RoutineTargetWords,
  RoutineUpdatedChange,
} from "../../core.ts";
import type {
  ConfirmationNeed,
  ToolContext,
  WriteRunOutput,
  WriteToolDefinition,
} from "../tool.ts";
import type { JsonValue } from "../untrusted.ts";

const maxChanges = 10;

const changeInput = z
  .strictObject({
    op: z
      .enum(["add", "swap", "remove", "set_targets", "add_day", "update_day", "remove_day"])
      .describe("What this change does."),
    day_id: z
      .string()
      .min(1)
      .max(64)
      .nullable()
      .describe(
        "The id of the day the change is in, from get_routines. For a day this same call adds, the day_ref you gave it. Null for add_day and remove_day.",
      ),
    day_ref: z
      .string()
      .min(1)
      .max(40)
      .nullable()
      .describe(
        "For add_day only: a short name of your own for the new day, which later changes of this call use as their day_id. Null otherwise.",
      ),
    exercise_id: z
      .guid()
      .nullable()
      .describe(
        "The exercise from get_routines or search_exercises. For add the exercise to add, for swap the exercise to take out, for remove and set_targets the one planned. Null for the day ops.",
      ),
    new_exercise_id: z
      .guid()
      .nullable()
      .describe("For swap only: the exercise to put in its place. Null otherwise."),
    position: z
      .number()
      .int()
      .min(0)
      .nullable()
      .describe(
        "From 0. For swap, remove and set_targets: which one when the day plans the same exercise twice, otherwise null. For add: where in the day it goes, null for the end. For add_day and update_day: where the day goes among the days, null to leave it.",
      ),
    sets: z
      .number()
      .int()
      .nullable()
      .describe(
        "The target sets, only when the user said it. Null on add takes Ki-Lo's preset for their goal, and null on set_targets keeps it.",
      ),
    rep_min: z
      .number()
      .int()
      .nullable()
      .describe("The lowest target reps, only when the user said it. Null as for sets."),
    rep_max: z
      .number()
      .int()
      .nullable()
      .describe("The highest target reps, only when the user said it. Null as for sets."),
    target_rir: z
      .number()
      .int()
      .nullable()
      .describe(
        "The target reps in reserve, only when the user said it. Null as for sets. A set_targets cannot clear one.",
      ),
    name: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .nullable()
      .describe("For add_day: the day's name. For update_day: the new name, or null to keep it."),
    weekday: z
      .number()
      .int()
      .min(0)
      .max(6)
      .nullable()
      .describe(
        "For add_day and update_day: 0 Monday to 6 Sunday. Null on add_day means any day, and null on update_day keeps the weekday.",
      ),
  })
  .superRefine((change, context) => {
    const missing = (field: string) =>
      context.addIssue({ code: "custom", path: [field], message: "Needed for this op" });
    const needs = (...fields: (keyof typeof change)[]) => {
      for (const field of fields) {
        if (change[field] === null) {
          missing(field);
        }
      }
    };
    const isNoneOf = (...fields: (keyof typeof change)[]) =>
      fields.every((field) => change[field] === null);
    switch (change.op) {
      case "add":
      case "remove":
        needs("day_id", "exercise_id");
        break;
      case "swap":
        needs("day_id", "exercise_id", "new_exercise_id");
        break;
      case "set_targets":
        needs("day_id", "exercise_id");
        if (isNoneOf("sets", "rep_min", "rep_max", "target_rir")) {
          missing("sets");
        }
        break;
      case "add_day":
        needs("day_ref", "name");
        break;
      case "update_day":
        needs("day_id");
        if (isNoneOf("name", "weekday", "position")) {
          missing("name");
        }
        break;
      case "remove_day":
        break;
    }
  });

const editRoutineInput = z.strictObject({
  routine_id: z.guid().describe("The id of the routine, from get_routines."),
  changes: z
    .array(changeInput)
    .min(1)
    .max(maxChanges)
    .describe(`1 to ${maxChanges} changes, applied in order.`),
});

type EditRoutineInput = z.infer<typeof editRoutineInput>;
type ChangeInput = EditRoutineInput["changes"][number];

type StoredRoutine = NonNullable<Awaited<ReturnType<typeof getRoutine>>>;

type ExerciseName = { name: string };

// What the call would change, or why it cannot be applied. A refusal is the answer `run` gives, so a call
// that `run` would refuse never asks for a confirmation.
type Plan =
  | { ok: false; output: WriteRunOutput }
  | {
      ok: true;
      stored: StoredRoutine;
      before: RoutineDraft;
      after: RoutineDraft;
      changes: readonly RoutineChange[];
      // The numbers each `add` was given, by the change's place in the call.
      addedTargets: ReadonlyMap<number, RoutineTargetWords>;
      // The names of the exercises the call puts in, by id. The routine holds the others' names.
      newExercises: ReadonlyMap<string, ExerciseName>;
    };

// The change's index and the rule it broke, never a value, because a routine is health data.
// The rules are core's and the tool's own (an exercise that is unavailable, numbers that need a goal).
type Problem = { index: number | null; rule: string };

const refused = (problems: readonly Problem[]): WriteRunOutput => ({
  data: {
    error: "invalid_input",
    problems: problems.map(({ index, rule }) => ({ index, rule })),
  },
  target: null,
});

const addNumbersNeedGoals = (index: number): WriteRunOutput =>
  refused([{ index, rule: "numbers_need_goals" }]);

const removeDayAnswer = (routineId: string): WriteRunOutput => ({
  data: {
    applied: false,
    changed: false,
    reason: REMOVE_DAY_REFUSAL,
    instruction:
      "None of the changes in this call were applied. Tell the user, then send the other changes again without remove_day.",
  },
  structured: {
    link: {
      label: OPEN_IN_ROUTINE_EDITOR,
      target: { screen: "routine_editor", routineId },
    },
  },
  target: null,
});

const isPresetNeeded = (change: ChangeInput): boolean =>
  change.op === "add" &&
  (change.sets === null ||
    change.rep_min === null ||
    change.rep_max === null ||
    change.target_rir === null);

// The exercises an `add` or a `swap` puts in, which must be live and visible to the person.
const idsPutIn = (changes: readonly ChangeInput[]): string[] => [
  ...new Set(
    changes.flatMap(({ op, exercise_id, new_exercise_id }) => {
      const id = op === "add" ? exercise_id : op === "swap" ? new_exercise_id : null;
      return id === null ? [] : [id];
    }),
  ),
];

function toChange(
  change: ChangeInput,
  index: number,
  presets: ReadonlyMap<number, RoutineTargetWords>,
): RoutineChange | null {
  const { day_id: dayId, exercise_id: exerciseId, new_exercise_id: newExerciseId } = change;
  switch (change.op) {
    case "add": {
      const targets = presets.get(index);
      return dayId === null || exerciseId === null || targets === undefined
        ? null
        : {
            op: "add",
            dayId,
            exerciseId,
            position: change.position,
            sets: targets.sets,
            repMin: targets.repMin,
            repMax: targets.repMax,
            targetRir: targets.targetRir,
          };
    }
    case "swap":
      return dayId === null || exerciseId === null || newExerciseId === null
        ? null
        : { op: "swap", dayId, exerciseId, newExerciseId, position: change.position };
    case "remove":
      return dayId === null || exerciseId === null
        ? null
        : { op: "remove", dayId, exerciseId, position: change.position };
    case "set_targets":
      return dayId === null || exerciseId === null
        ? null
        : {
            op: "set_targets",
            dayId,
            exerciseId,
            sets: change.sets,
            repMin: change.rep_min,
            repMax: change.rep_max,
            targetRir: change.target_rir,
            position: change.position,
          };
    case "add_day":
      return change.day_ref === null || change.name === null
        ? null
        : {
            op: "add_day",
            dayRef: change.day_ref,
            name: change.name,
            weekday: change.weekday,
            position: change.position,
          };
    case "update_day":
      return dayId === null
        ? null
        : {
            op: "update_day",
            dayId,
            name: change.name,
            weekday: change.weekday,
            position: change.position,
          };
    case "remove_day":
      return null;
  }
}

async function planOf(ctx: ToolContext, input: EditRoutineInput): Promise<Plan> {
  const stored = await getRoutine(ctx.caller, input.routine_id);
  if (stored === null) {
    return { ok: false, output: notFound };
  }
  // Nothing in the call is applied when it asks for a day to go, so the person's other changes are asked
  // for again, and a half-made edit never sits beside the refusal.
  if (input.changes.some(({ op }) => op === "remove_day")) {
    return { ok: false, output: removeDayAnswer(input.routine_id) };
  }

  const putIn = idsPutIn(input.changes);
  const found = new Map(
    (await readExercisesById(ctx.caller, putIn)).map((line) => [line.id, line] as const),
  );
  const unavailable = input.changes.flatMap((change, index): Problem[] => {
    const id = change.op === "add" ? change.exercise_id : change.new_exercise_id;
    return (change.op === "add" || change.op === "swap") && id !== null && !found.has(id)
      ? [{ index, rule: "exercise_unavailable" }]
      : [];
  });
  if (unavailable.length > 0) {
    return { ok: false, output: refused(unavailable) };
  }

  // The preset is read only when an added exercise has a number the person did not say.
  const presetIndexes = input.changes.flatMap((change, index) =>
    isPresetNeeded(change) ? [index] : [],
  );
  const goals = presetIndexes.length === 0 ? null : await getCurrentTrainingGoals(ctx.caller);
  const addedTargets = new Map<number, RoutineTargetWords>();
  for (const [index, change] of input.changes.entries()) {
    if (change.op !== "add") {
      continue;
    }
    const mechanic =
      change.exercise_id === null ? undefined : found.get(change.exercise_id)?.mechanic;
    const preset =
      goals === null || mechanic === undefined
        ? null
        : exerciseTargetFor(
            { goal: goals.goal, experience: goals.experience, mechanic },
            GOAL_PRESETS_V1,
          );
    // With no goal there is no preset, and a target RIR may stay unset, so only the sets and the reps are needed.
    if (
      preset === null &&
      (change.sets === null || change.rep_min === null || change.rep_max === null)
    ) {
      return { ok: false, output: addNumbersNeedGoals(index) };
    }
    addedTargets.set(index, {
      sets: change.sets ?? preset?.sets ?? 0,
      repMin: change.rep_min ?? preset?.repMin ?? 0,
      repMax: change.rep_max ?? preset?.repMax ?? 0,
      targetRir: change.target_rir ?? preset?.targetRir ?? null,
    });
  }

  const changes = input.changes.flatMap((change, index) => {
    const resolved = toChange(change, index, addedTargets);
    return resolved === null ? [] : [resolved];
  });
  const before = draftOfStoredRoutine(stored);
  const applied = applyRoutineChanges(before, changes);
  if (!applied.ok) {
    return { ok: false, output: refused(applied.problems) };
  }
  return {
    ok: true,
    stored,
    before,
    after: applied.draft,
    changes,
    addedTargets,
    newExercises: new Map(
      putIn.flatMap((id) => {
        const line = found.get(id);
        return line === undefined ? [] : [[id, { name: line.name }] as const];
      }),
    ),
  };
}

const fallbackExerciseName = "an exercise";

// The words of a card row, found in the routine as it was before the call.
function cardChangesOf(plan: Extract<Plan, { ok: true }>, input: EditRoutineInput) {
  const { stored, before, after, addedTargets, newExercises } = plan;
  const exerciseNames = new Map<string, string>([
    ...stored.days.flatMap((day) =>
      day.exercises.map(({ exercise }) => [exercise.id, exercise.name] as const),
    ),
    ...[...newExercises].map(([id, { name }]) => [id, name] as const),
  ]);
  const nameOf = (id: string | null): string =>
    (id === null ? undefined : exerciseNames.get(id)) ?? fallbackExerciseName;

  const addedDayNames = new Map(
    input.changes.flatMap((change) =>
      change.op === "add_day" && change.day_ref !== null && change.name !== null
        ? [[change.day_ref, change.name] as const]
        : [],
    ),
  );
  const dayNameOf = (dayKey: string | null): string =>
    after.days.find((day) => day.id === dayKey)?.name ??
    (dayKey === null ? undefined : addedDayNames.get(dayKey)) ??
    "this day";

  const beforeDay = (dayKey: string | null) => before.days.find((day) => day.id === dayKey);
  const beforeExercise = (change: ChangeInput) => {
    const planned = beforeDay(change.day_id)?.exercises;
    const byPosition = change.position === null ? undefined : planned?.[change.position];
    return byPosition?.exercise_id === change.exercise_id
      ? byPosition
      : planned?.find((exercise) => exercise.exercise_id === change.exercise_id);
  };
  const wordsOf = (planned: RoutineDraft["days"][number]["exercises"][number] | undefined) =>
    planned === undefined
      ? null
      : {
          sets: planned.target_sets,
          repMin: planned.rep_min,
          repMax: planned.rep_max,
          targetRir: planned.target_rir,
        };

  // An exercise this call puts in (an add or a swap) can be changed, swapped or removed again by a later
  // change of the same call. Its row is then folded into the one row of what ended up there, with the numbers
  // the routine was saved with, so the card never says "Added, 3 sets" over 5 stored sets.
  type PutIn = { dayKey: string | null; exerciseId: string };
  type Entry = { row: RoutineUpdatedChange; putIn: PutIn | null };
  const entries: Entry[] = [];
  const latestPutIn = (dayKey: string | null, exerciseId: string | null): Entry | undefined =>
    entries.findLast(
      ({ putIn }) => putIn !== null && putIn.dayKey === dayKey && putIn.exerciseId === exerciseId,
    );
  const others = (row: RoutineUpdatedChange) => entries.push({ row, putIn: null });

  for (const [index, change] of input.changes.entries()) {
    const dayName = dayNameOf(change.day_id);
    switch (change.op) {
      case "add": {
        const targets = addedTargets.get(index);
        if (targets !== undefined && change.exercise_id !== null) {
          entries.push({
            row: { op: "add", dayName, exerciseName: nameOf(change.exercise_id), targets },
            putIn: { dayKey: change.day_id, exerciseId: change.exercise_id },
          });
        }
        break;
      }
      case "swap": {
        const earlier = latestPutIn(change.day_id, change.exercise_id);
        if (change.exercise_id === change.new_exercise_id || change.new_exercise_id === null) {
          break;
        }
        if (earlier !== undefined && earlier.putIn !== null) {
          // Added or swapped in by this call, and swapped again: one row for the exercise that ended up there.
          earlier.putIn.exerciseId = change.new_exercise_id;
          if (earlier.row.op === "add") {
            earlier.row.exerciseName = nameOf(change.new_exercise_id);
          } else if (earlier.row.op === "swap") {
            earlier.row.newExerciseName = nameOf(change.new_exercise_id);
          }
          break;
        }
        entries.push({
          row: {
            op: "swap",
            dayName,
            oldExerciseName: nameOf(change.exercise_id),
            newExerciseName: nameOf(change.new_exercise_id),
            targets: wordsOf(beforeExercise(change)),
          },
          putIn: { dayKey: change.day_id, exerciseId: change.new_exercise_id },
        });
        break;
      }
      case "remove": {
        const earlier = latestPutIn(change.day_id, change.exercise_id);
        if (earlier === undefined) {
          others({ op: "remove", dayName, exerciseName: nameOf(change.exercise_id) });
        } else if (earlier.row.op === "add") {
          // Added and removed in one call: nothing happened.
          entries.splice(entries.indexOf(earlier), 1);
        } else if (earlier.row.op === "swap") {
          // Swapped in and removed in one call: the old exercise is what was removed.
          earlier.row = { op: "remove", dayName, exerciseName: earlier.row.oldExerciseName };
          earlier.putIn = null;
        }
        break;
      }
      case "set_targets": {
        if (latestPutIn(change.day_id, change.exercise_id) !== undefined) {
          break;
        }
        const was = wordsOf(beforeExercise(change));
        const now =
          was === null
            ? null
            : {
                sets: change.sets ?? was.sets,
                repMin: change.rep_min ?? was.repMin,
                repMax: change.rep_max ?? was.repMax,
                targetRir: change.target_rir ?? was.targetRir,
              };
        const isUnchanged =
          now !== null &&
          was !== null &&
          now.sets === was.sets &&
          now.repMin === was.repMin &&
          now.repMax === was.repMax &&
          now.targetRir === was.targetRir;
        if (!isUnchanged) {
          others({
            op: "set_targets",
            dayName,
            exerciseName: nameOf(change.exercise_id),
            now,
            was,
          });
        }
        break;
      }
      case "add_day": {
        const ref = change.day_ref;
        if (ref !== null && change.name !== null) {
          others({
            op: "add_day",
            dayName: change.name,
            weekday: change.weekday,
            exerciseCount: input.changes.filter(
              (other) => other.op === "add" && other.day_id === ref,
            ).length,
          });
        }
        break;
      }
      case "update_day": {
        const current = beforeDay(change.day_id);
        if (change.name !== null && change.name !== current?.name) {
          others({
            op: "rename_day",
            oldName: current?.name ?? dayName,
            newName: change.name,
            weekday: change.weekday ?? current?.weekday ?? null,
          });
        }
        if (change.weekday !== null && change.weekday !== current?.weekday) {
          others({
            op: "move_day_weekday",
            dayName,
            weekday: change.weekday,
            was: current?.weekday ?? null,
          });
        }
        const placeNow = after.days.findIndex((day) => day.id === change.day_id);
        const placeWas = before.days.findIndex((day) => day.id === change.day_id);
        if (change.position !== null && placeNow !== placeWas) {
          others({ op: "reorder_day", dayName, place: placeNow + 1 });
        }
        break;
      }
      case "remove_day":
        break;
    }
  }

  // The numbers of an exercise put in are the ones in the routine as saved. The day of a day this call added has
  // no id yet, so it is found by its name, and a number that cannot be found keeps the one the call resolved.
  const savedNumbers = (put: PutIn) => {
    const day = after.days.find((candidate) =>
      put.dayKey !== null && candidate.id === put.dayKey
        ? true
        : candidate.id === null && candidate.name === addedDayNames.get(put.dayKey ?? ""),
    );
    return wordsOf(day?.exercises.find(({ exercise_id }) => exercise_id === put.exerciseId));
  };
  return entries.map(({ row, putIn }): RoutineUpdatedChange => {
    const saved = putIn === null ? null : savedNumbers(putIn);
    if (saved === null) {
      return row;
    }
    if (row.op === "add") {
      return { ...row, targets: saved };
    }
    return row.op === "swap" ? { ...row, targets: saved } : row;
  });
}

// Saves the draft through `save_routine`, which writes the routine, its days and their exercises or none of them,
// and is the call the app's own editor makes. It is called here and not through the repo's `saveRoutine`, which
// reads the routine back after the call: a read that fails after the write landed would answer `tool_failed`
// for a write that is done, and the model would repeat it. A failed call means nothing was written, and a
// refused one names the code only, because the message can quote the routine. The draft is what core's
// `applyRoutineChanges` returned (names cleaned and every bound checked), or one this tool stored.
async function saveDraft(ctx: ToolContext, routineId: string, draft: RoutineDraft): Promise<void> {
  const { error } = await ctx.caller.rpc("save_routine", {
    p_routine_id: routineId,
    p_routine: { name: draft.name },
    p_days: draft.days.map((day) => ({
      id: day.id,
      weekday: day.weekday,
      name: day.name,
      exercises: day.exercises.map((exercise) => ({
        exercise_id: exercise.exercise_id,
        target_sets: exercise.target_sets,
        rep_min: exercise.rep_min,
        rep_max: exercise.rep_max,
        target_rir: exercise.target_rir,
      })),
    })),
  });
  if (error) {
    throw new Error(`Could not save the routine (${error.code || "no code"})`);
  }
}

// The previous draft as the store holds it, which is JSON the person's own routine was read from. Read
// again before it is saved, because the store is not trusted to hold what it was given.
const exerciseDraftSchema = z.strictObject({
  exercise_id: z.guid(),
  target_sets: z.number(),
  rep_min: z.number(),
  rep_max: z.number(),
  target_rir: z.number().nullable(),
});
const draftSchema = z.strictObject({
  name: z.string(),
  days: z.array(
    z.strictObject({
      id: z.guid().nullable(),
      weekday: z.number().nullable(),
      name: z.string(),
      exercises: z.array(exerciseDraftSchema),
    }),
  ),
});

// Whether a workout was logged from any of these days, which restoring would unlink.
async function isLoggedFrom(ctx: ToolContext, dayIds: readonly string[]): Promise<boolean> {
  if (dayIds.length === 0) {
    return false;
  }
  const { data, error } = await ctx.caller
    .from("workout_sessions")
    .select("id")
    .in("routine_day_id", [...dayIds])
    .limit(1);
  if (error) {
    // The database's message can quote a row, so only its code is kept.
    throw new Error(`Could not read the sessions of the days ${error.code}`);
  }
  return data.length > 0;
}

const removedNames = (plan: Extract<Plan, { ok: true }>, input: EditRoutineInput) => {
  const exerciseNames = new Map(
    plan.stored.days.flatMap((day) =>
      day.exercises.map(({ exercise }) => [exercise.id, exercise.name] as const),
    ),
  );
  const dayNames = new Map(plan.stored.days.map(({ id, name }) => [id, name] as const));
  const removals = input.changes.filter(({ op }) => op === "remove");
  return {
    exerciseNames: removals.map(
      ({ exercise_id }) =>
        (exercise_id === null ? undefined : exerciseNames.get(exercise_id)) ?? fallbackExerciseName,
    ),
    dayIds: new Set(removals.map(({ day_id }) => day_id)),
    dayNames,
  };
};

export const editRoutineTool: WriteToolDefinition<EditRoutineInput> = {
  name: "edit_routine",
  description:
    "Changes the exercises and days of one of the user's routines, with a card and Undo. Take the routine, " +
    "day and exercise ids from get_routines and search_exercises, never from memory. Send up to " +
    `${maxChanges} changes in one call, applied in order, as one edit. Each change has an op. ` +
    "add puts exercise_id in a day (position null for the end), and when the user gave no sets, reps or " +
    "RIR leave them null and Ki-Lo uses its preset for their goal: send a number only when the user said it. " +
    "If the user has no goal saved there is no preset: sets and reps are then needed, and the answer " +
    "invalid_input with the rule numbers_need_goals means ask the user for them or point them to the Goal " +
    "screen, while a null RIR is then left unset. " +
    "swap takes exercise_id out for new_exercise_id and keeps the old one's sets, reps and RIR. remove takes " +
    "an exercise out of a day. set_targets changes sets, rep_min, rep_max or target_rir, and a null keeps " +
    "that number. A RIR cannot be cleared from here: set_targets keeps a null and an add with a null RIR " +
    "takes the preset, so tell the user to clear it in the routine editor. add_day adds a day with a day_ref of your own, a " +
    "name and a weekday (0 Monday to 6 Sunday, null any day), and later changes in the same call can use " +
    "that day_ref as their day_id. update_day renames a day, moves it to a weekday, or moves it among the " +
    "days, and a null keeps that field, so update_day cannot clear a weekday. A day cannot be removed " +
    "here: for remove_day nothing is changed, the whole call is not applied, and you tell the user what " +
    "the answer says (a day can only be removed in the routine editor, because it unlinks the sessions they " +
    "logged from it) and that exercises can be changed here. When the same exercise is planned twice in a " +
    "day, say which with position. If the call is refused with invalid_input, the problems say which change " +
    "(by its place in the list) and which rule, so correct that change and call again, or ask the user. " +
    "When a call removes more than one exercise it first answers needs_confirmation with a " +
    "confirmation_id: in the same response as the call, before it, write the question in your own words, " +
    "naming the exercises, the day and the routine, and also name any other changes in the call, because the " +
    "buttons name only the removals. When they say yes call again with the same input " +
    "and that confirmation_id. When they say no, do not call again. Removing one exercise, adding, " +
    "swapping, changing numbers and changing days ask nothing. If the answer is workout_in_progress " +
    "nothing was changed: tell the user their workout is in progress so nothing in their training can " +
    "change yet, that questions are still fine, and that they can finish or discard it on the Train tab " +
    "and then ask again.",
  kind: "write",
  // Many nullable fields in a list of changes would use more than the strict budget of a request.
  strict: false,
  input: editRoutineInput,
  annotations: { readOnlyHint: false, destructiveHint: true },
  targetTable: "routines",
  refusesDuringWorkout: true,
  async needsConfirmation(input, ctx): Promise<ConfirmationNeed> {
    if (input.changes.filter(({ op }) => op === "remove").length < 2) {
      return false;
    }
    const plan = await planOf(ctx, input);
    if (!plan.ok) {
      return false;
    }
    const { exerciseNames, dayIds, dayNames } = removedNames(plan, input);
    const [onlyDayId] = dayIds;
    const dayName =
      dayIds.size === 1 && onlyDayId !== null && onlyDayId !== undefined
        ? (dayNames.get(onlyDayId) ?? null)
        : null;
    return {
      question: confirmRemoveExercisesQuestion({
        exerciseNames,
        dayName,
        routineName: plan.stored.name,
      }),
      confirmLabel: confirmRemoveExercisesButtons(exerciseNames.length).confirmLabel,
    };
  },
  async run(ctx, input): Promise<WriteRunOutput> {
    const plan = await planOf(ctx, input);
    if (!plan.ok) {
      return plan.output;
    }
    const { before, after, stored } = plan;
    const fingerprintAfter = routineFingerprint(after);
    const cardChanges = cardChangesOf(plan, input);
    if (routineFingerprint(before) === fingerprintAfter || cardChanges.length === 0) {
      return { data: { changed: false }, target: null };
    }
    // All of the answer is built before the write, from the draft this call already has, so nothing after the
    // write can throw and make the model repeat it.
    const card = buildRoutineUpdatedCard({
      routineId: stored.id,
      routineName: stored.name,
      changes: cardChanges,
    });
    const undo: JsonValue = JSON.parse(
      JSON.stringify({ previous: before, fingerprint: fingerprintAfter }),
    );
    await saveDraft(ctx, input.routine_id, after);
    return {
      data: { updated: true, change_count: cardChanges.length },
      structured: { card, undo },
      target: { targetId: stored.id },
    };
  },
  // Saves the draft the routine had before, and only while the routine is as the call left it and no workout
  // was logged from a day the call added, because saving would remove that day and unlink the workout.
  async inverse(ctx, action) {
    const { targetId } = action;
    const stored = await ctx.previousValueOf(action);
    if (targetId === null || stored === null || typeof stored.fingerprint !== "string") {
      return "unavailable";
    }
    const previous = draftSchema.safeParse(stored.previous);
    const routine = await getRoutine(ctx.caller, targetId);
    if (!previous.success || routine === null) {
      return "unavailable";
    }
    const current = draftOfStoredRoutine(routine);
    const currentDayIds = new Set(current.days.map(({ id }) => id));
    const previousDayIds = new Set(previous.data.days.map(({ id }) => id));
    // The days the app deleted since would be sent with an id that no longer exists, and the fingerprint
    // does not hold day ids, so they are checked here.
    if (
      routineFingerprint(current) !== stored.fingerprint ||
      previous.data.days.some(({ id }) => id !== null && !currentDayIds.has(id))
    ) {
      return { status: "unavailable", reason: "changed" };
    }
    const addedDayIds = current.days.flatMap(({ id }) =>
      id === null || previousDayIds.has(id) ? [] : [id],
    );
    if (await isLoggedFrom(ctx, addedDayIds)) {
      return { status: "unavailable", reason: "logged" };
    }
    await saveDraft(ctx, targetId, previous.data);
    return "undone";
  },
};
