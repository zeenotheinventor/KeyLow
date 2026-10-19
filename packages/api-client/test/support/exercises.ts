import { HttpResponse, http } from "msw";

import { REST_URL, postgrestError, postgrestRows } from "./postgrest";
import { keys } from "../../src/queryKeys";

import type { QueryClient } from "@tanstack/react-query";
import type { SetupServer } from "msw/node";

/** An exercise name and a muscle share nobody would pick by chance, to look for in an error, a key or a log. */
export const RECOGNISABLE_EXERCISE_NAME = "key389-recognisable-exercise";
export const RECOGNISABLE_MUSCLE_WEIGHT = 0.6173;

export const OWN_EXERCISE_ID = "77777777-7777-4777-8777-777777777771";
export const GLOBAL_EXERCISE_ID = "77777777-7777-4777-8777-777777777772";
export const SECOND_GLOBAL_EXERCISE_ID = "77777777-7777-4777-8777-777777777773";

/**
 * An `exercises` row with its `exercise_muscles` embedded, as PostgREST returns it for the search and the
 * single read. It is the user's own custom exercise unless overridden.
 */
export const exerciseRow = (overrides: Record<string, unknown> = {}) => ({
  id: OWN_EXERCISE_ID,
  name: RECOGNISABLE_EXERCISE_NAME,
  equipment: "cable",
  mechanic: "isolation",
  source: "user",
  exercise_muscles: [
    { muscle_id: "traps_upper", role: "secondary", weight: 0.5 },
    { muscle_id: "delt_side", role: "primary", weight: 1 },
  ],
  ...overrides,
});

/** An imported library row. */
export const globalExerciseRow = (overrides: Record<string, unknown> = {}) =>
  exerciseRow({
    id: GLOBAL_EXERCISE_ID,
    name: "Cable lateral raise",
    source: "free_exercise_db",
    exercise_muscles: [{ muscle_id: "delt_side", role: "primary", weight: 1 }],
    ...overrides,
  });

export type ExercisesFake = ReturnType<typeof installExercisesFake>;

/**
 * A stand-in for the exercises table and `save_exercise` behind MSW. Reads answer the rows they were
 * given and record the request. A call of `save_exercise` records its body and answers with the id of
 * the saved exercise. The archive update records its body and answers with the row it was given.
 * `failSaveWith` and `failArchiveWith` make that write fail with a database error that quotes a value,
 * and `goOffline` makes every call fail as a connection that is down does, so a test can look for a value
 * in what the repo throws.
 */
export function installExercisesFake(
  server: SetupServer,
  data: {
    /** The rows a read answers. */
    rows?: unknown[];
    /** What `save_exercise` answers with. The own exercise's id unless given. */
    savedId?: string;
    /** The rows the archive update answers with. One row unless given. */
    archived?: unknown[];
  } = {},
) {
  const reads: URL[] = [];
  const saves: unknown[] = [];
  const archives: { url: URL; body: unknown }[] = [];
  const control: {
    saveFailure: { code: string; message: string } | null;
    archiveFailure: { code: string; message: string } | null;
    readFailure: { code: string; message: string } | null;
    offline: boolean;
    gate: Promise<void> | null;
  } = { saveFailure: null, archiveFailure: null, readFailure: null, offline: false, gate: null };

  const refuse = (failure: { code: string; message: string } | null) => {
    if (control.offline) {
      return HttpResponse.error();
    }
    if (failure !== null) {
      return postgrestError(400, failure.code, failure.message, {
        details: `Failing row contains ${RECOGNISABLE_EXERCISE_NAME}`,
      });
    }
    return null;
  };

  server.use(
    http.get(`${REST_URL}/exercises`, ({ request }) => {
      reads.push(new URL(request.url));
      return refuse(control.readFailure) ?? postgrestRows(request, data.rows ?? []);
    }),
    http.patch(`${REST_URL}/exercises`, async ({ request }) => {
      archives.push({ url: new URL(request.url), body: await request.clone().json() });
      await control.gate;
      return (
        refuse(control.archiveFailure) ??
        postgrestRows(request, data.archived ?? [{ id: OWN_EXERCISE_ID }])
      );
    }),
    http.post(`${REST_URL}/rpc/save_exercise`, async ({ request }) => {
      saves.push(await request.clone().json());
      await control.gate;
      return refuse(control.saveFailure) ?? HttpResponse.json(data.savedId ?? OWN_EXERCISE_ID);
    }),
  );

  return {
    reads,
    saves,
    archives,
    /** Every request of any kind, to see that nothing was asked. */
    get requestCount() {
      return reads.length + saves.length + archives.length;
    },
    failSaveWith: (
      code: string | null,
      message = `failing row contains ${RECOGNISABLE_EXERCISE_NAME}`,
    ) => {
      control.saveFailure = code === null ? null : { code, message };
    },
    failArchiveWith: (
      code: string | null,
      message = `failing row contains ${RECOGNISABLE_EXERCISE_NAME}`,
    ) => {
      control.archiveFailure = code === null ? null : { code, message };
    },
    failReadsWith: (
      code: string | null,
      message = `failing row contains ${RECOGNISABLE_EXERCISE_NAME}`,
    ) => {
      control.readFailure = code === null ? null : { code, message };
    },
    goOffline: (offline = true) => {
      control.offline = offline;
    },
    /** Holds every write after it has arrived, until the returned function is called. */
    holdWrites: () => {
      let open: () => void = () => undefined;
      control.gate = new Promise<void>((resolve) => {
        open = resolve;
      });
      return () => {
        control.gate = null;
        open();
      };
    },
  };
}

/**
 * Puts a read in the cache under every training family, plus an exercise search and an exercise, so a
 * test can see which a write marks stale. Saving an exercise changes no logged set, so only the exercise
 * keys may go stale.
 */
export function seedExerciseAndTrainingQueries(queryClient: QueryClient) {
  const queryKeys = {
    exerciseSearch: keys.training.exerciseSearch("raise"),
    otherExerciseSearch: keys.training.exerciseSearch("press"),
    exercise: keys.training.exercise(OWN_EXERCISE_ID),
    otherExercise: keys.training.exercise(GLOBAL_EXERCISE_ID),
  };
  const trainingKeys = {
    activeRoutine: keys.training.activeRoutine,
    weekSessions: keys.training.weekSessions("2026-10-12"),
    sets: keys.training.sets("2026-10-02"),
    session: keys.training.session("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
    activeSession: keys.training.activeSession,
    lastPerformance: keys.training.lastPerformance(OWN_EXERCISE_ID),
    routines: keys.training.routines(false),
    routine: keys.training.routine("88888888-8888-4888-8888-888888888888"),
  };
  for (const queryKey of [...Object.values(queryKeys), ...Object.values(trainingKeys)]) {
    queryClient.setQueryData(queryKey, null);
  }
  return {
    queryKeys,
    trainingKeys,
    isStale: (queryKey: readonly unknown[]) =>
      queryClient.getQueryState(queryKey)?.isInvalidated === true,
  };
}
