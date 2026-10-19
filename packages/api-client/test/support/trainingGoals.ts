import { GOAL_PRESETS_V1, trainingGoalsPayload } from "@keylow/core/training";
import { HttpResponse, http } from "msw";
import { z } from "zod";

import { REST_URL, postgrestError, postgrestRows } from "./postgrest";

import type { GoalAnswers } from "@keylow/core/training";
import type { SetupServer } from "msw/node";

/** A server message and detail that quote a value nobody would pick by chance, to look for in a key, an error or a log. */
export const RECOGNISABLE_GOAL_TEXT = "key404-recognisable-goal-text";

export const GOAL_ROW_ID = "55555555-5555-4555-8555-555555555555";
export const NEW_GOAL_ROW_ID = "55555555-5555-4555-8555-666666666666";
export const OTHER_GOAL_ROW_ID = "55555555-5555-4555-8555-777777777777";
const USER_ID = "11111111-1111-4111-8111-111111111111";

/** The aesthetic V-taper answers the golden suggestions are worked out for. */
export const vTaperAnswers: GoalAnswers = {
  goal: "aesthetic",
  focus: ["v_taper"],
  days_per_week: 4,
  session_minutes: 60,
  equipment: ["barbell", "dumbbell"],
  experience: "intermediate",
};

export const strengthAnswers: GoalAnswers = {
  goal: "strength",
  focus: [],
  days_per_week: 3,
  session_minutes: 75,
  equipment: ["barbell"],
  experience: "advanced",
};

/** A `training_goals` row as PostgREST returns it, current unless `effective_to` is given. */
export const trainingGoalsRow = (
  answers: GoalAnswers = vTaperAnswers,
  overrides: Record<string, unknown> = {},
) => ({
  id: GOAL_ROW_ID,
  user_id: USER_ID,
  ...trainingGoalsPayload(answers, GOAL_PRESETS_V1),
  effective_from: "2026-10-10T09:00:00+00:00",
  effective_to: null,
  created_at: "2026-10-10T09:00:00+00:00",
  ...overrides,
});

type StoredRow = Omit<ReturnType<typeof trainingGoalsRow>, "effective_to"> & {
  effective_to: string | null;
};

const saveRequestSchema = z.object({ p_goals: z.record(z.string(), z.unknown()) });

export type TrainingGoalsFake = ReturnType<typeof installTrainingGoalsFake>;

/**
 * A stand-in for the `training_goals` table and its `save_training_goals` function behind MSW. A read
 * answers the rows it was given (the current one when the request asks for `effective_to is null`, the
 * one with an id when it asks for one, otherwise every row in the order given) and records its URL. A
 * save records its body, answers with the id of the next row, and then closes the current row and adds
 * the next, as the function does. `failNextSaves` makes the next saves fail with these database error
 * codes in turn, with a message and detail that quote a value, and `goOffline` makes every call fail as a
 * connection that is down does, so a test can look for a value in what the repo throws.
 */
export function installTrainingGoalsFake(server: SetupServer, data: { rows?: StoredRow[] } = {}) {
  const rows: StoredRow[] = [...(data.rows ?? [])];
  const reads: URL[] = [];
  const saves: unknown[] = [];
  let savedCount = 0;
  const control: {
    failures: string[];
    readFailure: string | null;
    offline: boolean;
    gate: Promise<void> | null;
  } = { failures: [], readFailure: null, offline: false, gate: null };

  server.use(
    http.get(`${REST_URL}/training_goals`, ({ request }) => {
      const url = new URL(request.url);
      reads.push(url);
      if (control.offline) {
        return HttpResponse.error();
      }
      if (control.readFailure !== null) {
        return postgrestError(
          400,
          control.readFailure,
          `failing row contains ${RECOGNISABLE_GOAL_TEXT}`,
          { details: `Failing row contains ${RECOGNISABLE_GOAL_TEXT}` },
        );
      }
      const id = url.searchParams.get("id");
      const matching =
        url.searchParams.get("effective_to") === "is.null"
          ? rows.filter((row) => row.effective_to === null)
          : id?.startsWith("eq.")
            ? rows.filter((row) => row.id === id.slice(3))
            : rows;
      return postgrestRows(request, matching);
    }),
    http.post(`${REST_URL}/rpc/save_training_goals`, async ({ request }) => {
      const body = saveRequestSchema.parse(await request.clone().json());
      saves.push(body);
      await control.gate;
      if (control.offline) {
        return HttpResponse.error();
      }
      const failure = control.failures.shift();
      if (failure !== undefined) {
        return postgrestError(400, failure, `failing row contains ${RECOGNISABLE_GOAL_TEXT}`, {
          details: `Failing row contains ${RECOGNISABLE_GOAL_TEXT}`,
        });
      }
      // The first save is NEW_GOAL_ROW_ID and each one after it has an id of its own.
      const savedId =
        savedCount === 0
          ? NEW_GOAL_ROW_ID
          : `55555555-5555-4555-8555-${(0x666666666666 + savedCount).toString(16)}`;
      savedCount += 1;
      const savedAt = new Date().toISOString();
      for (const row of rows) {
        if (row.effective_to === null) {
          row.effective_to = savedAt;
        }
      }
      rows.unshift({
        ...trainingGoalsRow(vTaperAnswers),
        ...body.p_goals,
        id: savedId,
        effective_from: savedAt,
        effective_to: null,
        created_at: savedAt,
      });
      return HttpResponse.json(savedId);
    }),
  );

  return {
    rows,
    reads,
    saves,
    /** Makes the next saves fail with these database error codes, one each, and then succeed. */
    failNextSaves: (...codes: string[]) => {
      control.failures = codes;
    },
    /** Makes every read fail with this database error code, or stops it with null. */
    failReadsWith: (code: string | null) => {
      control.readFailure = code;
    },
    goOffline: (offline = true) => {
      control.offline = offline;
    },
    /** Holds every save after it has arrived, until the returned function is called. */
    holdSaves: () => {
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
