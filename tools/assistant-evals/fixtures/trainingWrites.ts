// Writes the synthetic training history of `training.ts` as the eval user, through the api-client repos the app
// writes with (`startSession`, `addSet`, `finishSession`, `saveRoutine`, `saveTrainingGoals`, `saveExercise`),
// so the snapshots, the positions and the stamps are the ones the app makes. Never a hand-written row.
//
// It only adds. Each part looks for what it would write and leaves it alone when it is there, so a second call on
// one user adds nothing, and a user's other rows are never touched. A live session is not part of the history:
// every session written here is finished.
import {
  listRoutines,
  listTrainingGoalsHistory,
  saveExercise,
  saveRoutine,
  saveTrainingGoals,
  searchExercises,
  setActiveRoutine,
  setRoutineArchived,
  startSession,
  addSet,
  finishSession,
} from "@keylow/api-client";

import {
  ACTIVE_ROUTINE,
  ARCHIVED_ROUTINE,
  CURRENT_GOAL,
  CUSTOM_EXERCISE,
  EARLIER_GOAL,
  LIBRARY_EXERCISES,
  LIBRARY_EXERCISE_KEYS,
  sessionMoments,
  setsOfSession,
  trainingSessions,
} from "./training.ts";

import type { PlannedSession, RoutinePlan, TrainingExercise } from "./training.ts";
import type { FixtureUser } from "../src/fixtureUser.ts";
import type { Database } from "@keylow/api-client";
import type { GoalAnswers } from "@keylow/core/training";
import type { SupabaseClient } from "@supabase/supabase-js";

type Writer = Pick<FixtureUser, "client" | "anchorDate">;

const EVAL_TIME_ZONE = "UTC";

type ExerciseIds = ReadonlyMap<TrainingExercise, string>;

/** The ids of the library exercises, read by `source_ref`, and the user's own exercise, made when it is not there. */
async function exerciseIdsOf(client: SupabaseClient<Database>): Promise<ExerciseIds> {
  const { data, error } = await client
    .from("exercises")
    .select("id,source_ref")
    .eq("source", "free_exercise_db")
    .in("source_ref", Object.values(LIBRARY_EXERCISES));
  if (error) {
    throw new Error(`Could not look up the library exercises (${error.code})`);
  }

  const ids = new Map<TrainingExercise, string>();
  for (const key of LIBRARY_EXERCISE_KEYS) {
    const sourceRef = LIBRARY_EXERCISES[key];
    const row = data.find((candidate) => candidate.source_ref === sourceRef);
    if (row === undefined) {
      throw new Error(
        `The library exercise ${sourceRef} is missing, so the local stack needs its migrations`,
      );
    }
    ids.set(key, row.id);
  }
  ids.set("facePull", await customExerciseIdOf(client));
  return ids;
}

async function customExerciseIdOf(client: SupabaseClient<Database>): Promise<string> {
  const found = (await searchExercises(client, CUSTOM_EXERCISE.name)).find(
    ({ name, source }) => name === CUSTOM_EXERCISE.name && source === "user",
  );
  if (found !== undefined) {
    return found.id;
  }
  const saved = await saveExercise(client, {
    draft: {
      name: CUSTOM_EXERCISE.name,
      equipment: CUSTOM_EXERCISE.equipment,
      muscles: CUSTOM_EXERCISE.muscles,
    },
  });
  return saved.id;
}

const present = <Value>(value: Value | undefined, what: string): Value => {
  if (value === undefined) {
    throw new Error(`The training history names ${what}, which it does not define`);
  }
  return value;
};

/** The moments the user's live sessions started at, as epoch milliseconds, so a session already written is skipped. */
async function startedAtOfSessions(client: SupabaseClient<Database>): Promise<ReadonlySet<number>> {
  const { data, error } = await client
    .from("workout_sessions")
    .select("started_at")
    .is("deleted_at", null);
  if (error) {
    throw new Error(`Could not read the sessions already written (${error.code})`);
  }
  return new Set(data.map(({ started_at }) => Date.parse(started_at)));
}

async function writeSession(
  client: SupabaseClient<Database>,
  anchorDate: string,
  session: PlannedSession,
  exerciseIds: ExerciseIds,
) {
  const { startedAt, setTimes, endedAt } = sessionMoments(anchorDate, session);
  const started = await startSession(client, { now: startedAt, tz: EVAL_TIME_ZONE });
  if (Date.parse(started.started_at) !== startedAt.getTime()) {
    // `startSession` hands back a session already in progress, and sets must not be logged into someone else's.
    throw new Error("The eval user has a session in progress, so the history cannot be written");
  }

  const sets = setsOfSession(session);
  for (const [index, set] of sets.entries()) {
    await addSet(client, {
      sessionId: started.id,
      exerciseId: present(exerciseIds.get(set.exercise), set.exercise),
      draft: {
        setType: set.setType,
        load: String(set.loadKg),
        reps: String(set.reps),
        rir: set.rir === null ? "" : String(set.rir),
        rpe: "",
      },
      unit: "kg",
      effortMode: "rir",
      now: present(setTimes[index], "a set time"),
    });
  }
  await finishSession(client, started.id, { endedAt, note: session.note });
}

async function writeSessions(
  client: SupabaseClient<Database>,
  anchorDate: string,
  exerciseIds: ExerciseIds,
) {
  const written = await startedAtOfSessions(client);
  // One at a time and the oldest first: a user has one session in progress at most.
  for (const session of trainingSessions()) {
    if (!written.has(sessionMoments(anchorDate, session).startedAt.getTime())) {
      await writeSession(client, anchorDate, session, exerciseIds);
    }
  }
}

const draftOf = ({ name, days }: RoutinePlan, exerciseIds: ExerciseIds) => ({
  name,
  days: days.map((day) => ({
    id: null,
    weekday: day.weekday,
    name: day.name,
    exercises: day.exercises.map(({ exercise, sets, repMin, repMax, rir }) => ({
      exercise_id: present(exerciseIds.get(exercise), exercise),
      target_sets: sets,
      rep_min: repMin,
      rep_max: repMax,
      target_rir: rir,
    })),
  })),
});

/** The two routines: the older one archived, the other made the active one. Each is made once, by name. */
async function writeRoutines(client: SupabaseClient<Database>, exerciseIds: ExerciseIds) {
  const stored = await listRoutines(client, { archived: true });
  const ensure = async (plan: RoutinePlan) => {
    const found = stored.find(({ name }) => name === plan.name);
    return found ?? (await saveRoutine(client, { id: null, draft: draftOf(plan, exerciseIds) }));
  };

  const archived = await ensure(ARCHIVED_ROUTINE);
  if (!archived.is_archived) {
    await setRoutineArchived(client, archived.id, true);
  }
  const active = await ensure(ACTIVE_ROUTINE);
  if (!active.is_active) {
    await setActiveRoutine(client, active.id);
  }
}

const sameAnswers = (
  row: Pick<
    GoalAnswers,
    "goal" | "focus" | "days_per_week" | "session_minutes" | "equipment" | "experience"
  >,
  answers: GoalAnswers,
): boolean =>
  row.goal === answers.goal &&
  row.days_per_week === answers.days_per_week &&
  row.session_minutes === answers.session_minutes &&
  row.experience === answers.experience &&
  [...row.focus].sort().join() === [...answers.focus].sort().join() &&
  [...row.equipment].sort().join() === [...answers.equipment].sort().join();

/** The earlier goal, then the current one, which closes it. Each is saved when no goal holds its answers. */
async function writeGoals(client: SupabaseClient<Database>) {
  const history = await listTrainingGoalsHistory(client);
  if (history.some((row) => row.effective_to === null && sameAnswers(row, CURRENT_GOAL))) {
    return;
  }
  if (!history.some((row) => sameAnswers(row, EARLIER_GOAL))) {
    await saveTrainingGoals(client, EARLIER_GOAL);
  }
  await saveTrainingGoals(client, CURRENT_GOAL);
}

/**
 * Adds six weeks of workouts, two routines (one active, one archived), a current goal and an earlier one, one
 * custom exercise and a session note to the eval user, as the user. Calling it again on the same user adds
 * nothing. The sessions are dated back from the user's `anchorDate`, yesterday being the newest.
 */
export async function writeTrainingHistory({ client, anchorDate }: Writer): Promise<void> {
  const exerciseIds = await exerciseIdsOf(client);
  await writeSessions(client, anchorDate, exerciseIds);
  await writeRoutines(client, exerciseIds);
  await writeGoals(client);
}
