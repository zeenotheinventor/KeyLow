// The parts of the `run-checkin` backstop mode that can be tested without a database (ADR 0002,
// Amendment 2, "`run-checkin`" and "The backstop"): the secret check, which users one run visits, the
// loop over them, and the lines it logs. The function itself is `run-checkin/index.ts`.
//
// Health data: nothing here sees a weight, an intake or a target. A log line holds a user id, a count,
// a duration or a code, and a failed user is reported by its id and a code alone.
import { readFailure } from "./checkin.ts";
import { addCalendarDays, localToday } from "./core.ts";

import type { RunCheckinRefusalCode } from "./checkin.ts";
import type { EdgeErrorCode } from "./core.ts";

/** The header the backstop's secret arrives in. A user's JWT is never accepted in its place. */
export const backstopSecretHeader = "x-checkin-secret";

/** One run handles at most this many users, oldest first. The next hourly run takes the rest. */
export const maximumBackstopUsers = 200;

async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

/**
 * Whether the header holds the function's secret. The comparison takes time that does not depend on
 * where the two texts differ or how long either is: both are hashed to 32 bytes first, and every byte
 * of the two hashes is compared with no early exit. An unset or empty secret never authorises, so the
 * mode fails closed, and neither does a missing or empty header. The answer is a bare boolean, so the
 * caller cannot tell a wrong header from a missing secret.
 */
export async function isBackstopAuthorised(
  provided: string | null,
  expected: string | undefined,
): Promise<boolean> {
  const [providedHash, expectedHash] = await Promise.all([
    sha256(provided ?? ""),
    sha256(expected ?? ""),
  ]);
  let difference = 0;
  for (let index = 0; index < expectedHash.length; index += 1) {
    difference |= (providedHash[index] ?? 0) ^ (expectedHash[index] ?? 0);
  }
  const secretIsSet = expected !== undefined && expected !== "";
  return difference === 0 && secretIsSet;
}

/**
 * The latest `next_checkin_date` the backstop looks at: tomorrow in UTC. A user's own today is at
 * most one day ahead of UTC's, so this leaves nobody who is due out. It is a cheap pre-filter, and
 * the due mode's own code decides what is really due for each user.
 */
export function backstopCutoffDate(nowIso: string): string {
  return addCalendarDays(localToday(nowIso, "UTC"), 1);
}

/** The columns the backstop reads of an active program. */
export type BackstopCandidate = Readonly<{ user_id: string; next_checkin_date: string }>;

/**
 * The users of one run: the oldest `next_checkin_date` first (users with the same date keep the order
 * they were read in) and no more than `maximumBackstopUsers`.
 */
export function pickBackstopUsers(candidates: readonly BackstopCandidate[]): string[] {
  return [...candidates]
    .sort((left, right) =>
      left.next_checkin_date < right.next_checkin_date
        ? -1
        : left.next_checkin_date > right.next_checkin_date
          ? 1
          : 0,
    )
    .slice(0, maximumBackstopUsers)
    .map(({ user_id }) => user_id);
}

/** What the query is asked for: the active programs due on or before a date, at most `limit` of them. */
export type BackstopRead = (
  query: Readonly<{ dueOnOrBefore: string; limit: number }>,
) => PromiseLike<{
  data: readonly BackstopCandidate[] | null;
  error: Readonly<{ code: string }> | null;
}>;

/**
 * The ids of the users one run visits. The query orders and limits, which keeps the read small and
 * below the row limit of one read, and `pickBackstopUsers` holds the rule whatever the reader returns.
 * A failed read throws its database code alone.
 */
export async function readBackstopUsers(read: BackstopRead, nowIso: string): Promise<string[]> {
  const { data, error } = await read({
    dueOnOrBefore: backstopCutoffDate(nowIso),
    limit: maximumBackstopUsers,
  });
  if (error !== null) {
    throw readFailure("programs", error.code);
  }
  return pickBackstopUsers(data ?? []);
}

/** The due mode's answer for one user, as far as the backstop reads it: a count, or a refusal code. */
export type BackstopUserRun = Readonly<{ ran: number }> | Readonly<{ code: RunCheckinRefusalCode }>;

/** Why a user failed: the due mode refused them, or something threw. */
export type BackstopFailureCode = RunCheckinRefusalCode | Extract<EdgeErrorCode, "internal_error">;

/** What a run answers: the users handled, the check-ins recorded and the users that failed. */
export type BackstopRun = Readonly<{ users: number; ran: number; failed: number }>;

/**
 * Runs the due mode for each user in turn. A user the due mode refuses, or whose run throws, is a
 * failure: `onFailure` gets the id and a code (and, for a throw, the thrown value, for the reporter
 * that strips its message), and the loop carries on with the next user, so one user never stops
 * another. At most `maximumBackstopUsers` users are run, whatever is passed in.
 */
export async function runBackstop(
  userIds: readonly string[],
  runUser: (userId: string) => Promise<BackstopUserRun>,
  onFailure: (userId: string, code: BackstopFailureCode, caught?: unknown) => void,
): Promise<BackstopRun> {
  // A user whose run throws midway keeps the check-ins it already recorded and is counted only as
  // failed, and the next run carries on through the writer's duplicate path.
  const visited = userIds.slice(0, maximumBackstopUsers);
  let ran = 0;
  let failed = 0;
  for (const userId of visited) {
    let outcome: BackstopUserRun;
    try {
      outcome = await runUser(userId);
    } catch (caught) {
      failed += 1;
      onFailure(userId, "internal_error", caught);
      continue;
    }
    if ("code" in outcome) {
      failed += 1;
      onFailure(userId, outcome.code);
    } else {
      ran += outcome.ran;
    }
  }
  return { users: visited.length, ran, failed };
}

/** The line a finished run logs: the counts and the duration. */
export function backstopLogLine({
  users,
  ran,
  failed,
  durationMilliseconds,
}: BackstopRun & Readonly<{ durationMilliseconds: number }>): string {
  return `run-checkin backstop users=${users} ran=${ran} failed=${failed} duration_ms=${durationMilliseconds}`;
}

/** The line a failed user logs: the user id and the code. */
export function backstopFailureLogLine(userId: string, code: BackstopFailureCode): string {
  return `run-checkin backstop failed user=${userId} code=${code}`;
}
