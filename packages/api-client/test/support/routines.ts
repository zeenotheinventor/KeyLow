import { HttpResponse, http } from "msw";

import { REST_URL, postgrestError, postgrestRows } from "./postgrest";
import { keys } from "../../src/queryKeys";

import type { QueryClient } from "@tanstack/react-query";
import type { SetupServer } from "msw/node";

/** A routine name, a day name and an exercise name nobody would pick by chance, to look for in a key, an error or a log. */
export const RECOGNISABLE_ROUTINE_NAME = "key385-recognisable-routine";
export const RECOGNISABLE_ROUTINE_DAY_NAME = "key385-recognisable-day";
export const RECOGNISABLE_ROUTINE_EXERCISE_NAME = "key385-recognisable-exercise";

export const ROUTINE_ID = "88888888-8888-4888-8888-888888888888";
export const OTHER_ROUTINE_ID = "88888888-8888-4888-8888-999999999999";
export const DAY_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
export const SECOND_DAY_ID = "cccccccc-cccc-4ccc-8ccc-dddddddddddd";
export const PLANNED_EXERCISE_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
export const EXERCISE_ID = "77777777-7777-4777-8777-777777777777";

/** A routine as the library read returns it: its flags and its days with each exercise's sets. */
export const routineListRow = (overrides: Record<string, unknown> = {}) => ({
  id: ROUTINE_ID,
  name: RECOGNISABLE_ROUTINE_NAME,
  is_active: false,
  is_archived: false,
  activated_at: null,
  routine_days: [
    {
      id: DAY_ID,
      position: 0,
      weekday: 0,
      name: RECOGNISABLE_ROUTINE_DAY_NAME,
      routine_exercises: [{ target_sets: 3 }, { target_sets: 4 }],
    },
    {
      id: SECOND_DAY_ID,
      position: 1,
      weekday: null,
      name: "Pull",
      routine_exercises: [{ target_sets: 5 }],
    },
  ],
  ...overrides,
});

/** One planned exercise as the routine read returns it, with the exercise's name, equipment and id. */
export const plannedExerciseRow = (overrides: Record<string, unknown> = {}) => ({
  id: PLANNED_EXERCISE_ID,
  position: 0,
  exercise_id: EXERCISE_ID,
  target_sets: 3,
  rep_min: 8,
  rep_max: 12,
  target_rir: 2,
  exercises: {
    id: EXERCISE_ID,
    name: RECOGNISABLE_ROUTINE_EXERCISE_NAME,
    equipment: "barbell",
  },
  ...overrides,
});

/** A routine as the single routine read returns it. */
export const routineDetailRow = (overrides: Record<string, unknown> = {}) => ({
  id: ROUTINE_ID,
  name: RECOGNISABLE_ROUTINE_NAME,
  is_active: false,
  is_archived: false,
  activated_at: null,
  routine_days: [
    {
      id: DAY_ID,
      position: 0,
      weekday: 0,
      name: RECOGNISABLE_ROUTINE_DAY_NAME,
      routine_exercises: [plannedExerciseRow()],
    },
  ],
  ...overrides,
});

/** A routine as the archive update returns it: its flags and nothing else. */
export const routineFlagsRow = (overrides: Record<string, unknown> = {}) => ({
  id: ROUTINE_ID,
  name: RECOGNISABLE_ROUTINE_NAME,
  is_active: false,
  is_archived: false,
  activated_at: null,
  ...overrides,
});

export type RoutinesFake = ReturnType<typeof installRoutinesFake>;

/**
 * A stand-in for the routines table and its two functions behind MSW. Reads answer the rows they were
 * given and record the request. Calls of `save_routine` and `set_active_routine` record their body and
 * answer with the id of the saved routine. `failWith` makes the next calls fail with a database error
 * that quotes a value, and `goOffline` makes them fail as a connection that is down does, so a test can
 * look for a value in what the repo throws.
 */
export function installRoutinesFake(
  server: SetupServer,
  data: {
    /** The rows a routines read answers. */
    routines?: unknown[];
    /** The rows a read of one routine (the editor's, with exercises) answers, when they differ from `routines`. */
    details?: unknown[];
    /** What `save_routine` answers with. The routine's id unless given. */
    savedId?: string;
    /** The row the archive update answers with. */
    archived?: unknown;
  } = {},
) {
  const reads: URL[] = [];
  const saves: unknown[] = [];
  const activations: unknown[] = [];
  const archives: { url: URL; body: unknown }[] = [];
  const control: {
    failure: { code: string; message: string } | null;
    offline: boolean;
    gate: Promise<void> | null;
  } = { failure: null, offline: false, gate: null };

  const refuse = () => {
    if (control.offline) {
      return HttpResponse.error();
    }
    if (control.failure !== null) {
      return postgrestError(400, control.failure.code, control.failure.message, {
        details: `Failing row contains ${RECOGNISABLE_ROUTINE_EXERCISE_NAME}`,
      });
    }
    return null;
  };

  server.use(
    http.get(`${REST_URL}/routines`, ({ request }) => {
      const url = new URL(request.url);
      reads.push(url);
      const isDetail = url.searchParams.get("select")?.includes("rep_min") === true;
      return (
        refuse() ??
        postgrestRows(request, (isDetail ? data.details : undefined) ?? data.routines ?? [])
      );
    }),
    http.patch(`${REST_URL}/routines`, async ({ request }) => {
      archives.push({ url: new URL(request.url), body: await request.clone().json() });
      await control.gate;
      return refuse() ?? postgrestRows(request, data.archived === undefined ? [] : [data.archived]);
    }),
    http.post(`${REST_URL}/rpc/save_routine`, async ({ request }) => {
      saves.push(await request.clone().json());
      await control.gate;
      return refuse() ?? HttpResponse.json(data.savedId ?? ROUTINE_ID);
    }),
    http.post(`${REST_URL}/rpc/set_active_routine`, async ({ request }) => {
      activations.push(await request.clone().json());
      await control.gate;
      return refuse() ?? new HttpResponse(null, { status: 204 });
    }),
  );

  return {
    reads,
    saves,
    activations,
    archives,
    /** Every request of any kind, to see that nothing was asked. */
    get requestCount() {
      return reads.length + saves.length + activations.length + archives.length;
    },
    /** Makes every call fail with this database error code and message, or stops it with null. */
    failWith: (
      code: string | null,
      message = `failing row contains ${RECOGNISABLE_ROUTINE_NAME}`,
    ) => {
      control.failure = code === null ? null : { code, message };
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
 * Puts a read in the cache under every training family, so a test can see which a write marks stale:
 * the plan, the week, the sets, a session, the routines and a routine, and the last performance.
 */
export function seedTrainingQueries(queryClient: QueryClient) {
  const queryKeys = {
    activeRoutine: keys.training.activeRoutine,
    weekSessions: keys.training.weekSessions("2026-10-12"),
    sets: keys.training.sets("2026-10-02"),
    session: keys.training.session("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"),
    lastPerformance: keys.training.lastPerformance(EXERCISE_ID),
    routines: keys.training.routines(false),
    routine: keys.training.routine(OTHER_ROUTINE_ID),
    exerciseTrend: keys.training.exerciseTrend(EXERCISE_ID, "2026-09-28"),
    routineTrend: keys.training.routineTrend(OTHER_ROUTINE_ID, "2026-09-28"),
  };
  for (const queryKey of Object.values(queryKeys)) {
    queryClient.setQueryData(queryKey, null);
  }
  return {
    queryKeys,
    isStale: (queryKey: readonly unknown[]) =>
      queryClient.getQueryState(queryKey)?.isInvalidated === true,
  };
}
