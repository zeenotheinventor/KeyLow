// Changes one set of a finished workout: its reps, load, effort or type. The load is given in the unit the
// person trains in and stored in kilograms to the gram by core's `loadToKg`, so the model never converts
// it. One set to a call, so a partial failure can never leave a write that landed and looks failed, and
// several sets take several of the turn's slots. `workout_sets` has no change time, so Undo compares a
// fingerprint of the values the write left with the set as it is now, and puts the old values back only when
// they match.
import { z } from "zod";

import { MAX_LOAD_KG, buildSetUpdatedCard, loadToKg, sessionExercises } from "../../core.ts";
import { getMyWeightUnit, getSession, getSet, updateSet } from "../../repos.ts";
import { invalidInput, notFound } from "./entryWrite.ts";

import type { SetValues } from "../../core.ts";
import type { SessionSet, SetPatch } from "../../repos.ts";
import type { InverseOutcome, WriteRunOutput, WriteToolDefinition } from "../tool.ts";

const setTypeSchema = z.enum(["warmup", "working", "drop", "failure"]);

const updatePastSetInput = z
  .strictObject({
    set_id: z.guid().describe("The id of the set, from get_workouts with a session_id."),
    reps: z
      .number()
      .int()
      .min(1)
      .max(100)
      .nullable()
      .describe("The new reps, a whole number from 1 to 100, or null to keep them."),
    load: z
      .number()
      .min(0)
      .nullable()
      .describe(
        "The new load in the user's own unit, kg or lb, exactly as they said it and as get_workouts shows it. " +
          "Never convert it. Null to keep it.",
      ),
    rir: z
      .number()
      .int()
      .min(0)
      .max(10)
      .nullable()
      .describe("The new reps in reserve, 0 to 10, or null to keep the effort. Clears RPE."),
    rpe: z
      .number()
      .min(1)
      .max(10)
      .multipleOf(0.5)
      .nullable()
      .describe("The new RPE, 1 to 10 in halves, or null to keep the effort. Clears RIR."),
    set_type: setTypeSchema.nullable().describe("The new type of the set, or null to keep it."),
  })
  .refine(
    ({ reps, load, rir, rpe, set_type }) =>
      [reps, load, rir, rpe, set_type].some((field) => field !== null),
    { path: ["reps"] },
  )
  .refine(({ rir, rpe }) => rir === null || rpe === null, { path: ["rpe"] });

type UpdatePastSetInput = z.infer<typeof updatePastSetInput>;

// The columns Undo puts back, as the write found them. Stored beside the card, and never anywhere else.
const previousSchema = z.strictObject({
  set_type: setTypeSchema,
  reps: z.number().int(),
  load_kg: z.number().nullable(),
  rir: z.number().int().nullable(),
  rpe: z.number().nullable(),
});

type EditableColumns = z.infer<typeof previousSchema>;

const columnsOf = (set: SessionSet): EditableColumns => ({
  set_type: set.set_type,
  reps: set.reps,
  load_kg: set.load_kg,
  rir: set.rir,
  rpe: set.rpe,
});

const valuesOf = (set: SessionSet): SetValues => ({
  setType: set.set_type,
  loadKg: set.load_kg,
  reps: set.reps,
  rir: set.rir,
  rpe: set.rpe,
});

// What the write left, as one string. Both ends read it from the row as the database answers it, so the
// two strings are the same whenever the set is.
const fingerprintOf = ({ set_type, reps, load_kg, rir, rpe }: EditableColumns): string =>
  JSON.stringify([set_type, reps, load_kg, rir, rpe]);

// The set's columns after the call. An effort given clears the other measure, as the app's edit does.
function nextColumns(
  set: SessionSet,
  { reps, rir, rpe, set_type }: UpdatePastSetInput,
  loadKg: number | undefined,
): EditableColumns {
  const keepsEffort = rir === null && rpe === null;
  return {
    set_type: set_type ?? set.set_type,
    reps: reps ?? set.reps,
    load_kg: loadKg ?? set.load_kg,
    rir: keepsEffort ? set.rir : rir,
    rpe: keepsEffort ? set.rpe : rpe,
  };
}

const unavailable: InverseOutcome = { status: "unavailable", reason: "changed" };

export const updatePastSetTool: WriteToolDefinition<UpdatePastSetInput> = {
  name: "update_past_set",
  description:
    "Changes one set of a finished workout, with Undo. Take the set_id from get_workouts with a session_id, " +
    "never from memory, and call once for each set, at most ten writes in a turn, so say so when more sets are asked for. Give the load in the user's own unit, exactly as they " +
    "said it, and never convert it. Set what you are not changing to null. Giving rir clears rpe and giving " +
    "rpe clears rir. This cannot remove a load or an effort. It cannot change a workout in progress, and " +
    "then the answer is workout_in_progress. A set that is not the user's or was deleted is reported as not found.",
  kind: "write",
  input: updatePastSetInput,
  // Six nullable fields would not fit the strict budget (D2 of KEY-881).
  strict: false,
  annotations: { readOnlyHint: false, destructiveHint: true },
  targetTable: "workout_sets",
  refusesDuringWorkout: true,
  async run(ctx, input): Promise<WriteRunOutput> {
    const set = await getSet(ctx.caller, input.set_id);
    if (set === null || set.deleted_at !== null) {
      return notFound;
    }
    // A deleted session reads as null. A session with no end is a workout in progress, which the executor
    // has refused already, so this only holds if a workout began between that read and this one.
    const session = await getSession(ctx.caller, set.session_id);
    if (session === null) {
      return notFound;
    }
    if (session.ended_at === null) {
      return { data: { error: "workout_in_progress" }, target: null };
    }

    const unit = await getMyWeightUnit(ctx.caller);
    const loadKg = input.load === null ? undefined : loadToKg(input.load, unit);
    if (loadKg !== undefined && loadKg > MAX_LOAD_KG) {
      return invalidInput(["load"]);
    }
    const next = nextColumns(set, input, loadKg);
    if (fingerprintOf(next) === fingerprintOf(columnsOf(set))) {
      return { data: { updated: input.set_id, changed: false }, target: null };
    }
    // Numbered as the edit sheet numbers it, after the change, since a warm-up made a working set has a number.
    const setNumber =
      sessionExercises(
        null,
        session.sets.map((each) =>
          each.id === set.id ? { ...each, set_type: next.set_type } : each,
        ),
      )
        .flatMap((exercise) => exercise.rows)
        .find((row) => row.set?.id === set.id)?.setNumber ?? 1;
    // Only the columns that differ from the read, so an edit made in the app since is not written over.
    const current = columnsOf(set);
    const patch: SetPatch = {
      ...(next.set_type === current.set_type ? {} : { set_type: next.set_type }),
      ...(next.reps === current.reps ? {} : { reps: next.reps }),
      ...(next.load_kg === current.load_kg ? {} : { load_kg: next.load_kg }),
      ...(next.rir === current.rir ? {} : { rir: next.rir }),
      ...(next.rpe === current.rpe ? {} : { rpe: next.rpe }),
    };

    // The write is last. Nothing below it may throw.
    const updated = await updateSet(ctx.caller, input.set_id, patch);
    return {
      data: { updated: input.set_id, changed: true },
      structured: {
        card: buildSetUpdatedCard({
          dayName: session.routine_day_name,
          localDate: session.local_date,
          sessionId: session.id,
          exerciseName: set.snapshot.name,
          setNumber,
          unit,
          before: valuesOf(set),
          after: valuesOf(updated),
        }),
        undo: { previous: columnsOf(set), fingerprint: fingerprintOf(columnsOf(updated)) },
      },
      target: { targetId: input.set_id },
    };
  },
  // Puts the old values back, unless the set no longer holds what the write left: the person edited it in
  // the app, removed it, or deleted its workout. Then Undo is off, and the person's own change stays.
  async inverse(ctx, action) {
    const stored = await ctx.previousValueOf(action);
    const previous = previousSchema.safeParse(stored?.previous);
    const { targetId } = action;
    if (stored === null || !previous.success || targetId === null) {
      return unavailable;
    }
    const current = await getSet(ctx.caller, targetId);
    if (current === null || current.deleted_at !== null) {
      return unavailable;
    }
    if ((await getSession(ctx.caller, current.session_id)) === null) {
      return unavailable;
    }
    if (fingerprintOf(columnsOf(current)) !== stored.fingerprint) {
      return unavailable;
    }
    const { set_type, reps, load_kg, rir, rpe } = previous.data;
    await updateSet(ctx.caller, targetId, { set_type, reps, load_kg, rir, rpe });
    return "undone";
  },
};
