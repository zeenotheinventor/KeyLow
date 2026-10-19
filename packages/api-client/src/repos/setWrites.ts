import { exerciseMuscleEntrySchema, exerciseRowSchema } from "@keylow/core/schemas";
import {
  FULL_SESSION_RULE,
  MAX_LOAD_KG,
  MAX_REPS,
  MAX_RIR,
  MAX_RPE,
  MAX_SETS_PER_SESSION,
  MIN_REPS,
  MIN_RIR,
  MIN_RPE,
  RPE_STEP,
  buildWorkoutSetInsert,
  loadToKg,
  validateSetDraft,
} from "@keylow/core/training";
import { z } from "zod";

import { parseRow } from "./diaryRows";
import { trainingRepoError } from "./training";
import { SESSION_SET_COLUMNS } from "./trainingSchemas";
import { parseSessionSet } from "./trainingSessions";

import type { SessionSet } from "./trainingSchemas";
import type { Database } from "../database.types";
import type { EffortMode, LoadUnit, SetDraft, SetType } from "@keylow/core/training";
import type { SupabaseClient } from "@supabase/supabase-js";

// The set writes. A set holds an exercise name, a load, reps and an effort: all health data. A failure
// here names the action and the error code only, as the reads do, and a check that fails before a
// request names the rule and never a value. Every write needs a connection: nothing is queued.

const ROW_ID = z.guid();

const SET_RULE_MESSAGE = (rules: readonly string[]) =>
  `The set breaks the rules: ${rules.join(", ")}.`;

function assertId(id: string, what: string): void {
  if (!ROW_ID.safeParse(id).success) {
    throw new RangeError(`A ${what} id must be a UUID`);
  }
}

/** An exercise as the snapshot needs it: its identity and its muscle map. */
const exerciseWithMapSchema = z.object({
  id: exerciseRowSchema.shape.id,
  name: exerciseRowSchema.shape.name,
  equipment: exerciseRowSchema.shape.equipment,
  mechanic: exerciseRowSchema.shape.mechanic,
  exercise_muscles: z.array(exerciseMuscleEntrySchema),
});

/**
 * The exercise with its muscle map as it is now, for the snapshot a new set freezes. An exercise that
 * does not exist, is not visible to the caller (another user's private one) or was deleted fails with
 * the code PGRST116, the same in all three cases.
 */
async function readExerciseWithMap(client: SupabaseClient<Database>, exerciseId: string) {
  const { data, error } = await client
    .from("exercises")
    .select("id,name,equipment,mechanic,exercise_muscles(muscle_id,role,weight)")
    .eq("id", exerciseId)
    .is("deleted_at", null)
    .single();
  if (error) {
    throw trainingRepoError("log the set", error);
  }
  return parseRow(exerciseWithMapSchema, data, "log the set", () => exerciseId);
}

/** How many live sets a session holds, and the highest position among them (null for none). One request. */
async function liveSetsOf(client: SupabaseClient<Database>, sessionId: string, action: string) {
  const { data, count, error } = await client
    .from("workout_sets")
    .select("position", { count: "exact" })
    .eq("session_id", sessionId)
    .is("deleted_at", null)
    .order("position", { ascending: false })
    .limit(1);
  if (error) {
    throw trainingRepoError(action, error);
  }
  if (count === null) {
    throw new Error(`Could not ${action}`);
  }
  return { count, highestPosition: data[0]?.position ?? null };
}

export type SetAdd = {
  sessionId: string;
  exerciseId: string;
  /** The text of the set as the form holds it. Only the effort measure in use may be filled. */
  draft: SetDraft;
  /** The unit the load was typed in. It is stored in kilograms. */
  unit: LoadUnit;
  /** The effort measure the setting uses: the other one is never stored. */
  effortMode: EffortMode;
  /** The moment of the press, stored as when the set was performed. */
  now: Date;
};

/**
 * Logs a set and resolves to it as stored. The draft is checked and converted by core (`validateSetDraft`,
 * the load in whole grams whatever the unit), and the row is built by `buildWorkoutSetInsert` with the
 * snapshot taken here, once, from the exercise and its muscle map as they are now. Editing the exercise
 * later never touches it. The position is one past the highest of the session's live sets.
 *
 * A draft that breaks a rule, a session already holding 200 live sets, an id that is not a UUID and a
 * `now` that is not a date throw a `RangeError` naming the rule and never a value. A session that is
 * not the caller's fails with the code of the insert policy, the same as one that does not exist, and
 * an exercise that is not visible fails with PGRST116, the same as one that does not exist. The
 * count and the insert are two requests, so two devices logging at the same moment can pass 200 by one.
 */
export async function addSet(
  client: SupabaseClient<Database>,
  { sessionId, exerciseId, draft, unit, effortMode, now }: SetAdd,
): Promise<SessionSet> {
  assertId(sessionId, "session");
  assertId(exerciseId, "exercise");
  if (Number.isNaN(now.getTime())) {
    throw new RangeError("A set's time must be a valid date");
  }
  const checked = validateSetDraft(draft, { unit, effortMode });
  if (!checked.ok) {
    throw new RangeError(SET_RULE_MESSAGE(checked.issues.map(({ rule }) => rule)));
  }

  const { exercise_muscles, ...exercise } = await readExerciseWithMap(client, exerciseId);
  const { count, highestPosition } = await liveSetsOf(client, sessionId, "log the set");

  const row = buildWorkoutSetInsert({
    sessionId,
    exercise,
    muscles: exercise_muscles,
    draft: checked.values,
    position: highestPosition === null ? 0 : highestPosition + 1,
    performedAt: now.toISOString(),
    liveSetsInSession: count,
  });

  const { data, error } = await client
    .from("workout_sets")
    .insert(row)
    .select(SESSION_SET_COLUMNS)
    .single();
  if (error) {
    throw trainingRepoError("log the set", error);
  }
  return parseSessionSet(data, "log the set");
}

/**
 * What a set update may change. A set never changes its session, its exercise or its snapshot, and
 * `deleted_at` is `removeSet` and `restoreSet`. The load is in kilograms. Setting an effort measure to
 * a value clears the other one, so at most one is stored.
 */
export type SetPatch = {
  position?: number;
  set_type?: SetType;
  reps?: number;
  load_kg?: number | null;
  rir?: number | null;
  rpe?: number | null;
};

type SetUpdate = Database["public"]["Tables"]["workout_sets"]["Update"];

const PATCH_COLUMNS = ["position", "set_type", "reps", "load_kg", "rir", "rpe"];
const FROZEN_COLUMNS = ["snapshot", "session_id", "exercise_id"];

const isWhole = (value: number) => Number.isInteger(value);

/** The rules a patch breaks, as the codes of core's set rules, with the load as it is stored (to the gram). A position's rule is named here. */
function patchRuleCodes(patch: SetPatch, loadKg: number | null | undefined): string[] {
  const rules: string[] = [];
  if (patch.position !== undefined && !(isWhole(patch.position) && patch.position >= 0)) {
    rules.push("position_whole_from_0");
  }
  if (
    patch.reps !== undefined &&
    !(isWhole(patch.reps) && patch.reps >= MIN_REPS && patch.reps <= MAX_REPS)
  ) {
    rules.push("reps_whole_1_to_100");
  }
  if (typeof loadKg === "number" && !(loadKg >= 0 && loadKg <= MAX_LOAD_KG)) {
    rules.push("load_0_to_1000_kg");
  }
  if (
    typeof patch.rir === "number" &&
    !(isWhole(patch.rir) && patch.rir >= MIN_RIR && patch.rir <= MAX_RIR)
  ) {
    rules.push("rir_whole_0_to_10");
  }
  if (
    typeof patch.rpe === "number" &&
    !(patch.rpe >= MIN_RPE && patch.rpe <= MAX_RPE && isWhole(patch.rpe / RPE_STEP))
  ) {
    rules.push("rpe_1_to_10_in_halves");
  }
  if (typeof patch.rir === "number" && typeof patch.rpe === "number") {
    rules.push("effort_one_measure_only");
  }
  return rules;
}

/** The columns an update writes: the load to the gram, and the other effort measure cleared when one is set. */
function updateOf(patch: SetPatch): SetUpdate {
  const update: SetUpdate = {};
  if (patch.position !== undefined) {
    update.position = patch.position;
  }
  if (patch.set_type !== undefined) {
    update.set_type = patch.set_type;
  }
  if (patch.reps !== undefined) {
    update.reps = patch.reps;
  }
  if (patch.load_kg !== undefined) {
    update.load_kg = patch.load_kg === null ? null : loadToKg(patch.load_kg, "kg");
  }
  if (patch.rir !== undefined) {
    update.rir = patch.rir;
    if (patch.rir !== null && patch.rpe === undefined) {
      update.rpe = null;
    }
  }
  if (patch.rpe !== undefined) {
    update.rpe = patch.rpe;
    if (patch.rpe !== null && patch.rir === undefined) {
      update.rir = null;
    }
  }
  return update;
}

/**
 * Changes a live set's position, type, reps, load or effort, and resolves to it as stored. Only what
 * the patch names is written. The snapshot, the session and the exercise are never sent: a patch that
 * names them (or any other column) throws a `RangeError` stating the rule, and so does an empty one, a
 * value that breaks a set rule (the message lists the rule codes) and an id that is not a UUID. All
 * are checked before any request. A set that does not exist, is not the caller's or was removed fails
 * with the code PGRST116, the same in all three cases.
 */
export async function updateSet(
  client: SupabaseClient<Database>,
  id: string,
  patch: SetPatch,
): Promise<SessionSet> {
  assertId(id, "set");

  const named = Object.keys(patch);
  if (named.some((column) => FROZEN_COLUMNS.includes(column))) {
    throw new RangeError("A set never changes its session, its exercise or its snapshot");
  }
  if (named.some((column) => !PATCH_COLUMNS.includes(column))) {
    throw new RangeError(
      "A set update can change only its position, type, reps, load, RIR and RPE",
    );
  }
  const update = updateOf(patch);
  if (Object.keys(update).length === 0) {
    throw new RangeError("A set update needs at least one field");
  }
  const rules = patchRuleCodes(patch, update.load_kg);
  if (rules.length > 0) {
    throw new RangeError(SET_RULE_MESSAGE(rules));
  }

  const { data, error } = await client
    .from("workout_sets")
    .update(update)
    .eq("id", id)
    .is("deleted_at", null)
    .select(SESSION_SET_COLUMNS)
    .single();
  if (error) {
    throw trainingRepoError("update the set", error);
  }
  return parseSessionSet(data, "update the set");
}

/** A set by its id, removed or not. A set that does not exist or is not the caller's fails with PGRST116. */
async function readSet(client: SupabaseClient<Database>, id: string, action: string) {
  const { data, error } = await client
    .from("workout_sets")
    .select(SESSION_SET_COLUMNS)
    .eq("id", id)
    .single();
  if (error) {
    throw trainingRepoError(action, error);
  }
  return parseSessionSet(data, action);
}

/**
 * Removes a set by stamping `deleted_at` (a soft delete: the database grants no delete) and resolves
 * to it as stored. The Undo toast calls `restoreSet`. A set that is already removed resolves to it as
 * it is, so a second press changes nothing. A set that does not exist or is not the caller's fails
 * with the code PGRST116, and an id that is not a UUID throws a `RangeError` before any request.
 */
export async function removeSet(client: SupabaseClient<Database>, id: string): Promise<SessionSet> {
  assertId(id, "set");

  const { data, error } = await client
    .from("workout_sets")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select(SESSION_SET_COLUMNS);
  if (error) {
    throw trainingRepoError("remove the set", error);
  }

  const [removed] = data;
  return removed === undefined
    ? readSet(client, id, "remove the set")
    : parseSessionSet(removed, "remove the set");
}

/**
 * Brings a removed set back by clearing `deleted_at` (the Undo of `removeSet`) and resolves to it as
 * stored. A set that is already live resolves to it as it is. A session that already holds 200 live
 * sets refuses with a `RangeError`, and a session that was deleted fails with the code 42501, which
 * the database's trigger raises. A set that does not exist or is not the caller's fails with PGRST116.
 * The count and the update are two requests, so two devices restoring at the same moment can pass 200
 * by one.
 */
export async function restoreSet(
  client: SupabaseClient<Database>,
  id: string,
): Promise<SessionSet> {
  assertId(id, "set");

  const set = await readSet(client, id, "restore the set");
  if (set.deleted_at === null) {
    return set;
  }
  const { count } = await liveSetsOf(client, set.session_id, "restore the set");
  if (count >= MAX_SETS_PER_SESSION) {
    throw new RangeError(FULL_SESSION_RULE);
  }

  const { data, error } = await client
    .from("workout_sets")
    .update({ deleted_at: null })
    .eq("id", id)
    .select(SESSION_SET_COLUMNS)
    .single();
  if (error) {
    throw trainingRepoError("restore the set", error);
  }
  return parseSessionSet(data, "restore the set");
}

const placeSchema = z.object({ id: z.guid(), position: z.number() });

/**
 * The places the sets take, in the order the sets are given. They are the places the sets hold now,
 * lowest first, so a reorder of some of a session's sets leaves the others where they are. Two sets
 * that share a place are given distinct ones, so the new order shows.
 */
function placesFor(currentPositions: readonly number[]): number[] {
  const places: number[] = [];
  for (const position of [...currentPositions].sort((first, second) => first - second)) {
    const previous = places.at(-1);
    places.push(previous === undefined ? position : Math.max(position, previous + 1));
  }
  return places;
}

/**
 * Puts the given live sets of a session in the order given, by rewriting their `position`. The sets
 * move among the places they hold now and no other set is written. Positions have no uniqueness rule,
 * so each set is a plain update of its own row, and only the sets that move are written. Fewer than
 * two sets, a set listed twice, an id that is not a UUID and a set that is not a live set of the
 * session throw a `RangeError` naming the rule, the last the same for a session of another user as
 * for one that does not exist. The updates are separate requests, so a failure part way leaves some
 * sets moved: the caller refreshes the session after, also after a failure.
 */
export async function reorderSets(
  client: SupabaseClient<Database>,
  sessionId: string,
  orderedIds: readonly string[],
): Promise<void> {
  assertId(sessionId, "session");
  for (const id of orderedIds) {
    assertId(id, "set");
  }
  if (orderedIds.length < 2) {
    throw new RangeError("A reorder needs at least two sets");
  }
  if (new Set(orderedIds).size !== orderedIds.length) {
    throw new RangeError("A set can be listed once in a reorder");
  }
  if (orderedIds.length > MAX_SETS_PER_SESSION) {
    throw new RangeError(FULL_SESSION_RULE);
  }

  const { data, error } = await client
    .from("workout_sets")
    .select("id,position")
    .eq("session_id", sessionId)
    .is("deleted_at", null)
    .in("id", [...orderedIds]);
  if (error) {
    throw trainingRepoError("reorder the sets", error);
  }
  if (data.length !== orderedIds.length) {
    throw new RangeError("Every set to reorder must be a live set of the session");
  }

  const current = new Map(
    data.map((row) => {
      const { id, position } = parseRow(placeSchema, row, "reorder the sets", () => sessionId);
      return [id, position];
    }),
  );
  const places = placesFor([...current.values()]);
  const moves = orderedIds.flatMap((id, index) => {
    const position = places[index];
    return position === undefined || position === current.get(id) ? [] : [{ id, position }];
  });

  const results = await Promise.all(
    moves.map(({ id, position }) =>
      client
        .from("workout_sets")
        .update({ position })
        .eq("id", id)
        .eq("session_id", sessionId)
        .is("deleted_at", null),
    ),
  );
  const failed = results.find(({ error: failure }) => failure !== null);
  if (failed?.error) {
    throw trainingRepoError("reorder the sets", failed.error);
  }
}
