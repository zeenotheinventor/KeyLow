import { runCheckinRequestSchema, runCheckinResponseSchema } from "@keylow/core/schemas";
import { FunctionsHttpError } from "@supabase/supabase-js";

import { getMyTimeZone } from "./targets";
import { invokeEdgeFunction } from "../edge";

import type { Database } from "../database.types";
import type { RunCheckinResponse } from "@keylow/core/schemas";
import type { SupabaseClient } from "@supabase/supabase-js";

// The schedule is health data. A failure names the action and a code only: the database's own message can
// quote a value, so it is never put in a message or a cause.

/**
 * What the app needs to know whether a check-in is due: the active program's next check-in date
 * (`YYYY-MM-DD`, null until a schedule is set) and the profile's time zone (null when it has none).
 */
export type CheckinSchedule = {
  nextCheckinDate: string | null;
  timeZone: string | null;
};

/** `run-checkin` answers 409 when there is nothing to run: no active program, or a stat the check-in needs is missing. */
const NOTHING_TO_RUN_STATUS = 409;

/**
 * Reads the active program's next check-in date and the profile's time zone, or null when there is no
 * active program. Row level security shows a user their own rows, so no id is needed.
 */
export async function getMyCheckinSchedule(
  client: SupabaseClient<Database>,
): Promise<CheckinSchedule | null> {
  const [program, timeZone] = await Promise.all([
    client.from("programs").select("next_checkin_date").is("ended_on", null).maybeSingle(),
    getMyTimeZone(client),
  ]);

  if (program.error) {
    throw new Error(`Could not load your check-in schedule (${program.error.code})`, {
      cause: { code: program.error.code },
    });
  }

  return program.data === null
    ? null
    : { nextCheckinDate: program.data.next_checkin_date, timeZone };
}

const hasStatus = (response: unknown, status: number) =>
  typeof response === "object" &&
  response !== null &&
  "status" in response &&
  response.status === status;

/**
 * Whether a failed call was the function's 409. The edge helpers pass the `FunctionsHttpError` as the
 * cause of every error they throw, whether or not the body's code is one the shared edge error schema
 * knows, so the status is read from the cause in either case.
 */
const isNothingToRun = (failure: unknown): boolean =>
  failure instanceof Error &&
  failure.cause instanceof FunctionsHttpError &&
  hasStatus(failure.cause.context, NOTHING_TO_RUN_STATUS);

/**
 * Runs every check-in of the signed in user that is due, through the `run-checkin` Edge Function in `due`
 * mode, and returns what it answers: how many it recorded (`ran`, 0 when another caller got there first)
 * and the program's next check-in date. Resolves to null when there is nothing to run (no active program,
 * or a stat missing), which is not a failure. A rate limit throws a `RateLimitedError`, any other typed
 * refusal an `EdgeFunctionError`, and anything the edge helpers cannot classify a plain error.
 */
export async function runMyDueCheckins(
  client: SupabaseClient<Database>,
): Promise<RunCheckinResponse | null> {
  const body = runCheckinRequestSchema.parse({ mode: "due" });

  try {
    const response = await invokeEdgeFunction<unknown>(client, "run-checkin", body);
    return runCheckinResponseSchema.parse(response);
  } catch (failure) {
    if (isNothingToRun(failure)) {
      return null;
    }
    throw failure;
  }
}
