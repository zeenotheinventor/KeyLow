// Builds a new routine from exercises the model found and the numbers of the person's goal: "Build me a 3 day
// routine". The model chooses the name, the days, the weekdays and which exercises in which order, and never
// a set, a rep or a RIR: the input has no field for one, and core gives each exercise the numbers of the
// goal, as a suggestion does. Every id is read back under the caller's JWT first, so an id the model made up,
// another user's own exercise or an archived one builds nothing. The routine is saved in one `save_routine`
// call and is never active. Undo archives it, as the routine screen does, and only while it is as the
// assistant left it.
import { z } from "zod";

import {
  MAX_DAYS_PER_ROUTINE,
  MAX_ROUTINE_DAY_NAME_LENGTH,
  MAX_ROUTINE_NAME_LENGTH,
  MAX_WEEKDAY,
  MIN_WEEKDAY,
  SUGGEST_PARAMS_V2,
  buildRoutineCreatedCard,
  buildRoutineDraft,
  draftOfStoredRoutine,
  routineFingerprint,
  summariseBuiltRoutine,
} from "../../core.ts";
import {
  getCurrentTrainingGoals,
  getRoutine,
  RoutineRuleError,
  readExercisesById,
  setRoutineArchived,
} from "../../repos.ts";
import { invalidInput } from "./entryWrite.ts";
import {
  fingerprintOfStoredRoutine,
  hasWorkoutOnDays,
  readBackQuietly,
  saveRoutineDraft,
} from "./routineWrite.ts";

import type { BuildRoutineProblem } from "../../core.ts";
import type { WriteRunOutput, WriteToolDefinition } from "../tool.ts";

const maxExercisesPerDay = SUGGEST_PARAMS_V2.maxExercises.fresh;

const createRoutineInput = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1)
    .max(MAX_ROUTINE_NAME_LENGTH)
    .describe("The routine's name, as the user said it, or a short one that fits it."),
  days: z
    .array(
      z.strictObject({
        name: z
          .string()
          .trim()
          .min(1)
          .max(MAX_ROUTINE_DAY_NAME_LENGTH)
          .describe('The day\'s name, such as "Push".'),
        weekday: z
          .number()
          .int()
          .min(MIN_WEEKDAY)
          .max(MAX_WEEKDAY)
          .nullable()
          .default(null)
          .describe("0 Monday to 6 Sunday, or null for any day. Two days never share a weekday."),
        exercise_ids: z
          .array(z.guid())
          .min(1)
          .max(maxExercisesPerDay)
          .describe(
            `1 to ${maxExercisesPerDay} exercise ids from search_exercises, in the order they are done. None twice in a day.`,
          ),
      }),
    )
    .min(1)
    .max(MAX_DAYS_PER_ROUTINE)
    .describe(`1 to ${MAX_DAYS_PER_ROUTINE} days, in the order of the week.`),
});

type CreateRoutineInput = z.infer<typeof createRoutineInput>;

// Where a problem sits, in the names of this tool's input: `days.1.exercise_ids.0`.
const fieldOf = ({ path }: BuildRoutineProblem): string =>
  path.map((part) => (part === "exercises" ? "exercise_ids" : String(part))).join(".");

export const createRoutineTool: WriteToolDefinition<CreateRoutineInput> = {
  name: "create_routine",
  description:
    "Builds a new routine and saves it, with a card, Undo and a link into the routine editor. Read " +
    "get_training_goals first: when the user gave no number of days, use its days_per_week. Find every " +
    "exercise with search_exercises, passing the user's equipment from get_training_goals, and use only " +
    "the ids it gave, never one you have not seen. Make all " +
    "the searches in one response and not one by one, because a turn has a time limit. Choose the name, " +
    "the days, their weekdays (0 Monday to 6 Sunday, or null) and which exercises, in which order. You " +
    "cannot send sets, reps or RIR: Ki-Lo gives every exercise the numbers of the user's goal. When the " +
    "user names numbers, build first and then change them with edit_routine. The routine is never " +
    "active. Offer to make it active, and when the user's own message asked for that, call " +
    "set_active_routine next. The answer has the routine_id, is_active false, each day's id, name, " +
    "exercises, sets and minutes, sets_per_week and two flags to mention: over_session_minutes lists the " +
    "days, counted from 0, that run longer than the user's session length, and outside_equipment lists " +
    "[day, exercise] pairs, counted from 0, for an exercise their equipment does not cover. When a " +
    "day's id in the answer is null, read the routine with get_routines before edit_routine. An id that " +
    "is not a live exercise of the library or the user's own is invalid_input with its place " +
    "(days.0.exercise_ids.2): search again and replace it. An answer of needs_goal true means the user " +
    "has no training goal yet and nothing was saved: ask for their goal and experience together in one " +
    'ask_user, with 3 quick replies that each give both, such as "Look better, intermediate", and say ' +
    "nothing is saved yet. Their answer is the request to save it with update_training_goals " +
    "(days_per_week is the number of days the user named for the routine), then call create_routine again.",
  kind: "write",
  input: createRoutineInput,
  // Nested optional fields would not fit the strict budget (D2 of KEY-881).
  strict: false,
  annotations: { readOnlyHint: false, destructiveHint: false },
  targetTable: "routines",
  refusesDuringWorkout: true,
  async run(ctx, { name, days }): Promise<WriteRunOutput> {
    const goals = await getCurrentTrainingGoals(ctx.caller);
    if (goals === null) {
      return { data: { needs_goal: true }, target: null };
    }
    const lines = await readExercisesById(ctx.caller, [
      ...new Set(days.flatMap((day) => day.exercise_ids)),
    ]);
    const byId = new Map(lines.map((line) => [line.id, line]));
    const built = buildRoutineDraft(
      {
        name,
        days: days.map((day) => ({
          name: day.name,
          weekday: day.weekday,
          exerciseIds: day.exercise_ids,
        })),
      },
      byId,
      goals,
      SUGGEST_PARAMS_V2.presets,
    );
    if (!built.ok) {
      return invalidInput([...new Set(built.problems.map(fieldOf))]);
    }

    const routineId = await saveRoutineDraft(ctx, null, built.draft);

    // The write has landed, so nothing below may throw. The routine is read back for the day ids and the
    // names as stored, and when that read fails the draft, the exercises read before the save and the id
    // the call gave say the same. The draft's fingerprint is the one a read gives, so Undo still works.
    const stored = await readBackQuietly(ctx, routineId);
    const draft = stored === null ? built.draft : draftOfStoredRoutine(stored);
    const summary = summariseBuiltRoutine(draft, SUGGEST_PARAMS_V2.sessionTime);
    const shown = (stored?.days ?? []).map((day) => ({
      id: day.id as string | null,
      exercises: day.exercises.map((planned) => planned.exercise),
    }));
    const planned = draft.days.map((day, dayIndex) => {
      const exercises =
        shown[dayIndex]?.exercises ??
        day.exercises.map((planned) => ({
          name: byId.get(planned.exercise_id)?.name ?? "",
          equipment: byId.get(planned.exercise_id)?.equipment,
        }));
      return { day, id: shown[dayIndex]?.id ?? null, exercises };
    });
    const outsideEquipment = planned.flatMap(({ exercises }, dayIndex) =>
      exercises.flatMap((exercise, exerciseIndex) =>
        exercise.equipment !== undefined && goals.equipment.includes(exercise.equipment)
          ? []
          : [[dayIndex, exerciseIndex]],
      ),
    );
    const overSessionMinutes = summary.days.flatMap((day, dayIndex) =>
      day.minutes > goals.session_minutes ? [dayIndex] : [],
    );
    const card = buildRoutineCreatedCard({
      routineId,
      name: draft.name,
      goal: goals.goal,
      experience: goals.experience,
      days: planned.map(({ day, exercises }, dayIndex) => ({
        name: day.name,
        weekday: day.weekday,
        exerciseCount: summary.days[dayIndex]?.exerciseCount ?? day.exercises.length,
        setCount: summary.days[dayIndex]?.setCount ?? 0,
        minutes: summary.days[dayIndex]?.minutes ?? 0,
        exercises: day.exercises.map((planned, exerciseIndex) => ({
          name: exercises[exerciseIndex]?.name ?? "",
          sets: planned.target_sets,
          repMin: planned.rep_min,
          repMax: planned.rep_max,
          targetRir: planned.target_rir,
        })),
      })),
      setsPerWeek: summary.setsPerWeek,
    });
    return {
      data: {
        routine_id: routineId,
        is_active: false,
        days: planned.map(({ day, id }, dayIndex) => ({
          id,
          name: day.name,
          exercises: summary.days[dayIndex]?.exerciseCount ?? day.exercises.length,
          sets: summary.days[dayIndex]?.setCount ?? 0,
          minutes: summary.days[dayIndex]?.minutes ?? 0,
        })),
        sets_per_week: summary.setsPerWeek,
        over_session_minutes: overSessionMinutes,
        outside_equipment: outsideEquipment,
      },
      structured: {
        card,
        // Nothing to put back: Undo archives the routine, and only if it is still as it was.
        undo: { previous: null, fingerprint: routineFingerprint(draft) },
      },
      target: { targetId: routineId },
    };
  },
  // Archives the routine, unless it changed, is the active one, or a workout was logged from it since.
  // The change check is the fingerprint the turn stored, and a turn that is gone (the conversation was
  // deleted) has none to compare, so it answers changed.
  async inverse(ctx, action) {
    const stored = await ctx.previousValueOf(action);
    const { targetId } = action;
    if (stored === null || typeof stored.fingerprint !== "string" || targetId === null) {
      return { status: "unavailable", reason: "changed" };
    }
    const routine = await getRoutine(ctx.caller, targetId);
    if (
      routine === null ||
      routine.is_archived ||
      fingerprintOfStoredRoutine(routine) !== stored.fingerprint
    ) {
      return { status: "unavailable", reason: "changed" };
    }
    if (routine.is_active) {
      return { status: "unavailable", reason: "active" };
    }
    if (
      await hasWorkoutOnDays(
        ctx,
        routine.days.map((day) => day.id),
      )
    ) {
      return { status: "unavailable", reason: "logged" };
    }
    try {
      await setRoutineArchived(ctx.caller, targetId, true);
    } catch (caught) {
      // The person made the routine active between the read above and this write, and the table refuses to
      // archive the active routine. Nothing was changed.
      if (caught instanceof RoutineRuleError && caught.rule === "active_routine") {
        return { status: "unavailable", reason: "active" };
      }
      throw caught;
    }
    return "undone";
  },
};
