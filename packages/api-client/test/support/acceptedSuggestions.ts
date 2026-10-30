import {
  equipmentSchema,
  exerciseMechanicSchema,
  exerciseMuscleEntrySchema,
  setTypeSchema,
} from "@keylow/core/schemas";
import {
  SUGGEST_PARAMS_V2,
  TRAINING_PARAMS_V2,
  muscleState,
  suggestSession,
  toAcceptedExercises,
} from "@keylow/core/training";
import { HttpResponse, http } from "msw";

import { goldenLibraryRows } from "./goldenLibraryRows";
import { goldenRoutine, goldenSets } from "./goldenWeekRows";
import { REST_URL, postgrestError, postgrestRows } from "./postgrest";
import { trainingGoalsRow, vTaperAnswers } from "./trainingGoals";

import type { PlanAdjusted, PlanRoutineDay, SuggestExercise } from "@keylow/core/training";
import type { SetupServer } from "msw/node";

/*
 * The golden accepted suggestion of Zee's agreement on KEY-396, as the api-client works it: on
 * Wednesday 14 October 2026 at 12:00 the V-taper user is suggested 3 sets of incline dumbbell press,
 * 8 to 10 reps at RIR 2, added to Thursday's Legs. It is worked out by core from the golden week's
 * rows, and the tests that use it pin the exercise and the sets, so a change of the suggestion shows.
 */

export const WEDNESDAY_NOON = "2026-10-14T12:00:00+01:00";
export const THURSDAY = "2026-10-15";
export const LEGS_DAY_ID = "00000003-0000-4000-8000-000000000003";
export const INCLINE_DUMBBELL_PRESS_ID = "00000001-0000-4000-8000-000000000002";

/** A name and a reason figure nobody would pick by chance, to look for in a key, an error or a log. */
export const RECOGNISABLE_SUGGESTION_TEXT = "key406-recognisable-suggestion";

export const goldenLibrary: SuggestExercise[] = goldenLibraryRows.map((row) => ({
  id: row.id,
  name: row.name,
  equipment: equipmentSchema.parse(row.equipment),
  mechanic: exerciseMechanicSchema.parse(row.mechanic),
  muscles: exerciseMuscleEntrySchema.array().parse(row.exercise_muscles),
}));

const legsDay: PlanRoutineDay = (() => {
  const day = goldenRoutine.routine_days.find(({ id }) => id === LEGS_DAY_ID);
  if (day === undefined) {
    throw new Error("The golden routine has a Legs day");
  }
  return {
    id: day.id,
    position: day.position,
    weekday: day.weekday,
    exercises: day.routine_exercises.map((planned) => ({
      id: planned.id,
      position: planned.position,
      exercise_id: planned.exercise_id,
      target_sets: planned.target_sets,
      target_rir: planned.target_rir,
      exercise: {
        id: planned.exercises.id,
        name: planned.exercises.name,
        equipment: equipmentSchema.parse(planned.exercises.equipment),
        mechanic: exerciseMechanicSchema.parse(planned.exercises.mechanic),
      },
      muscles: exerciseMuscleEntrySchema.array().parse(planned.exercises.exercise_muscles),
    })),
  };
})();

const suggestion = suggestSession(
  muscleState(
    goldenSets
      .filter((set) => set.performed_at < "2026-10-14T00:00:00+00:00")
      .map((set) => ({ ...set, set_type: setTypeSchema.parse(set.set_type) })),
    WEDNESDAY_NOON,
    TRAINING_PARAMS_V2,
  ),
  { ...trainingGoalsRow(vTaperAnswers), equipment: ["barbell", "dumbbell"] },
  goldenLibrary,
  { plannedDay: legsDay },
  SUGGEST_PARAMS_V2,
);

if (suggestion.kind !== "plan_adjusted") {
  throw new Error("The golden suggestion adds to Thursday's Legs");
}

/** What the suggestion card holds for Thursday's Legs on Wednesday noon: Legs kept, the press added. */
export const goldenSuggestion: PlanAdjusted = suggestion;

/** The `exercises` an accept stores for the golden suggestion. */
export const goldenAcceptedExercises = toAcceptedExercises(goldenSuggestion, goldenLibrary);

type Row = Record<string, unknown>;

let rowCounter = 0;

/** A live `accepted_suggestions` row as PostgREST returns it, of the golden suggestion unless overridden. */
export const acceptedRow = (overrides: Row = {}): Row => {
  rowCounter += 1;
  return {
    id: `66666666-6666-4666-8666-${rowCounter.toString(16).padStart(12, "0")}`,
    local_date: THURSDAY,
    routine_day_id: LEGS_DAY_ID,
    exercises: structuredClone(goldenAcceptedExercises),
    reasons: {
      picks: goldenSuggestion.exercises.flatMap((each) =>
        each.origin === "added"
          ? [{ exercise_id: each.exercise_id, reasons: structuredClone(each.reasons) }]
          : [],
      ),
    },
    params_version: SUGGEST_PARAMS_V2.version,
    deleted_at: null,
    ...overrides,
  };
};

/** The value of a PostgREST filter such as `eq.abc`, or null when the request has none. */
const filterValues = (url: URL, column: string, operator: string): string[] =>
  url.searchParams
    .getAll(column)
    .filter((value) => value.startsWith(`${operator}.`))
    .map((value) => value.slice(operator.length + 1));

const bodyOf = async (request: Request): Promise<Row> => {
  const body: unknown = await request.clone().json();
  return typeof body === "object" && body !== null && !Array.isArray(body)
    ? Object.fromEntries(Object.entries(body))
    : {};
};

export type AcceptedSuggestionsFake = ReturnType<typeof installAcceptedSuggestionsFake>;

/**
 * A stand-in for the `accepted_suggestions` table behind MSW that keeps the rows it was given. It
 * understands the filters the repo uses (`id` and `local_date` with eq, `local_date` with gte and lte,
 * `deleted_at` is null), and the one live row per day rule: an insert onto a day that already holds a
 * live row is refused with 23505, as the partial unique index does. An insert adds a row, an update
 * changes the rows that match. `failNextInserts` makes the next inserts fail with these database
 * error codes in turn, with a message that quotes a value, and `goOffline` makes every call fail as a
 * connection that is down does.
 */
export function installAcceptedSuggestionsFake(server: SetupServer, data: { rows?: Row[] } = {}) {
  const rows: Row[] = [...(data.rows ?? [])];
  const reads: URL[] = [];
  const inserts: Row[] = [];
  const updates: { url: URL; body: Row }[] = [];
  const control: {
    insertFailures: string[];
    readFailure: string | null;
    updateFailure: string | null;
    offline: boolean;
    gate: Promise<void> | null;
  } = { insertFailures: [], readFailure: null, updateFailure: null, offline: false, gate: null };
  let created = 0;

  const matching = (url: URL) => {
    const ids = filterValues(url, "id", "eq");
    const idList = filterValues(url, "id", "in").flatMap((value) => value.slice(1, -1).split(","));
    const dates = filterValues(url, "local_date", "eq");
    const from = filterValues(url, "local_date", "gte");
    const to = filterValues(url, "local_date", "lte");
    const live = filterValues(url, "deleted_at", "is").includes("null");
    return rows.filter(
      (row) =>
        ids.every((id) => row["id"] === id) &&
        (idList.length === 0 || idList.includes(String(row["id"]))) &&
        dates.every((date) => row["local_date"] === date) &&
        from.every((first) => String(row["local_date"]) >= first) &&
        to.every((last) => String(row["local_date"]) <= last) &&
        (!live || row["deleted_at"] === null),
    );
  };

  const failure = (code: string) =>
    postgrestError(400, code, `failing row contains ${RECOGNISABLE_SUGGESTION_TEXT}`, {
      details: `Failing row contains ${RECOGNISABLE_SUGGESTION_TEXT}`,
    });

  server.use(
    http.get(`${REST_URL}/accepted_suggestions`, async ({ request }) => {
      const url = new URL(request.url);
      reads.push(url);
      await control.gate;
      if (control.offline) {
        return HttpResponse.error();
      }
      if (control.readFailure !== null) {
        return failure(control.readFailure);
      }
      const ordered = [...matching(url)].sort((first, second) =>
        String(first["local_date"]).localeCompare(String(second["local_date"])),
      );
      return postgrestRows(request, ordered);
    }),
    http.post(`${REST_URL}/accepted_suggestions`, async ({ request }) => {
      const body = await bodyOf(request);
      inserts.push(body);
      await control.gate;
      if (control.offline) {
        return HttpResponse.error();
      }
      const failing = control.insertFailures.shift();
      if (failing !== undefined) {
        return failure(failing);
      }
      const liveOnTheDay = rows.some(
        (row) => row["local_date"] === body["local_date"] && row["deleted_at"] === null,
      );
      if (liveOnTheDay) {
        return failure("23505");
      }
      created += 1;
      const stored = {
        id: `66666666-6666-4666-8666-${(0xa00000000000 + created).toString(16)}`,
        deleted_at: null,
        ...body,
      };
      rows.push(stored);
      return postgrestRows(request, [stored], 201);
    }),
    http.patch(`${REST_URL}/accepted_suggestions`, async ({ request }) => {
      const url = new URL(request.url);
      const body = await bodyOf(request);
      updates.push({ url, body });
      await control.gate;
      if (control.offline) {
        return HttpResponse.error();
      }
      if (control.updateFailure !== null) {
        return failure(control.updateFailure);
      }
      const changed = matching(url);
      for (const row of changed) {
        Object.assign(row, body);
      }
      return postgrestRows(request, changed);
    }),
  );

  return {
    rows,
    reads,
    inserts,
    updates,
    liveRows: () => rows.filter((row) => row["deleted_at"] === null),
    /** Makes the next inserts fail with these database error codes, one each, and then succeed. */
    failNextInserts: (...codes: string[]) => {
      control.insertFailures = codes;
    },
    /** Makes every read fail with this database error code, or stops it with null. */
    failReadsWith: (code: string | null) => {
      control.readFailure = code;
    },
    /** Makes every update fail with this database error code, or stops it with null. */
    failUpdatesWith: (code: string | null) => {
      control.updateFailure = code;
    },
    goOffline: (offline = true) => {
      control.offline = offline;
    },
    /** Holds every call after it has arrived, until the returned function is called. */
    hold: () => {
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
