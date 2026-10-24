// The pure parts of `run-checkin` (ADR 0002, Amendment 2, "`run-checkin`"): which dates a call runs,
// the range of rows to read for them, turning the rows into the inputs of `checkinStep`, the loop
// that records the check-ins one after another, the plan of a recompute (which start snapshot rule
// applies and the targets to write), and the lines and errors that leave the function.
// Nothing here reads a clock or the database, so Deno tests cover all of it. The function itself is
// `run-checkin/index.ts`.
//
// Health data: a weight, an intake, an expenditure or a target never goes into a log line or an error
// from here. The log lines take a user id, a count, a duration or a code, and a failed write is
// reported by its database code alone (see `recordCheckinFailure`).
import { z } from "zod";

import {
  addCalendarDays,
  computeTrend,
  dueCheckinDates,
  nextAfter,
  profileBmr,
  recomputeTargets,
  runCheckinRequestSchema,
  scheduleToSet,
  startSnapshot,
  startSnapshotAction,
  toDayOfWeekKcal,
} from "./core.ts";

import type {
  CheckinInput,
  CheckinProgram,
  CheckinResult,
  DayInput,
  EdgeErrorCode,
  ExpenditureBelief,
  ProfileStats,
  RecomputeTargetsRow,
  ScheduleToSet,
  StartSnapshot,
  StartSnapshotAction,
  TrendInput,
} from "./core.ts";
import type { Database } from "./core/database.types.ts";

/** A call runs at most this many check-ins for a user. The next call, or the backstop, continues. */
export const maximumCheckinsPerCall = 8;

/** A check-in measures the 28 days before its date, so the first one needs weigh-ins from that far back. */
const measurementWindowDays = 28;

/**
 * The weigh-ins are read this many days earlier than the diary days. The trend is an exponentially
 * weighted average that forgets old readings fast (0.9 to the power of 90 is under 1e-4), so starting
 * 90 days early makes the trend weight the same for an on-time run and a late one.
 */
const trendWarmUpDays = 90;

/** The most rows one read returns (`max_rows` in the API settings). A read that reaches it may be cut short. */
const rowsPerReadLimit = 1000;

/**
 * The dates this call runs: every due date from `nextCheckinDate` up to `today`, oldest first, and no
 * more than `maximumCheckinsPerCall` of them (`dueCheckinDates` has no cap of its own).
 */
export function datesToRun(nextCheckinDate: string | null, today: string): string[] {
  if (nextCheckinDate === null) {
    return [];
  }
  return dueCheckinDates(nextCheckinDate, today).slice(0, maximumCheckinsPerCall);
}

/** `from` and `to` bound the diary days. The weigh-ins start earlier, at `weighInsFrom`. */
export type ReadRange = Readonly<{ from: string; weighInsFrom: string; to: string }>;

/**
 * The days of weigh-ins and diary rows to read for `dates`: from 28 days before the first to the day
 * before the last, both included, with the weigh-ins starting `trendWarmUpDays` earlier. A check-in
 * reads nothing dated on or after its own date, so nothing later is needed, and a user who was away
 * for a long time does not read the weeks in between. Null when there is nothing to run.
 */
export function readRange(dates: readonly string[]): ReadRange | null {
  const first = dates[0];
  const last = dates.at(-1);
  if (first === undefined || last === undefined) {
    return null;
  }
  const from = addCalendarDays(first, -measurementWindowDays);
  return {
    from,
    weighInsFrom: addCalendarDays(from, -trendWarmUpDays),
    to: addCalendarDays(last, -1),
  };
}

/**
 * Returns the rows of a read, or throws when the read reached the row limit. A read that stopped there
 * may be missing days, and a check-in worked out from a cut read would be wrong without anyone knowing.
 * The message names the table and holds no value.
 */
export function requireCompleteRead<Row>(rows: readonly Row[], table: string): readonly Row[] {
  if (rows.length >= rowsPerReadLimit) {
    throw new Error(`The ${table} read reached the row limit`);
  }
  return rows;
}

/**
 * Returns the rows of a read that should hold one row for each local date, or throws when two rows
 * share a date. The check-in keeps one row for a date, so a repeated date means the read picked up rows
 * it should not have, and the figures would be wrong without anyone knowing. The error names the table
 * and a code, never a value. Not for weigh-ins, which may be several on a day.
 */
export function requireUniqueDates<Row extends Readonly<{ local_date: string }>>(
  rows: readonly Row[],
  table: string,
): readonly Row[] {
  const dates = new Set(rows.map(({ local_date }) => local_date));
  if (dates.size !== rows.length) {
    throw readFailure(table, "duplicate_date");
  }
  return rows;
}

type ProgramRow = Database["public"]["Tables"]["programs"]["Row"];

/** The columns of the active program a check-in reads. */
export type CheckinProgramRow = Pick<
  ProgramRow,
  | "goal"
  | "rate_pct_per_week"
  | "protein_g_per_kg"
  | "fat_fraction_of_remaining"
  | "dow_offsets_kcal"
>;

/** Throws a `RangeError`, with no value in it, when the offsets are not seven whole numbers. */
export function toCheckinProgram(row: CheckinProgramRow): CheckinProgram {
  return {
    goal: row.goal,
    ratePctPerWeek: row.rate_pct_per_week,
    proteinGPerKg: row.protein_g_per_kg,
    fatFraction: row.fat_fraction_of_remaining,
    dowOffsetsKcal: toDayOfWeekKcal(row.dow_offsets_kcal),
  };
}

/** The live weigh-ins the trend reads. The caller has already left out the soft-deleted ones. */
export function toWeighIns(
  rows: readonly Readonly<{ local_date: string; weight_kg: number }>[],
): TrendInput[] {
  return rows.map(({ local_date, weight_kg }) => ({ localDate: local_date, weightKg: weight_kg }));
}

/** Everything one run reads, shaped for the engine. The same reads serve every date of the run. */
export type CheckinReads = Readonly<{
  program: CheckinProgram;
  stats: ProfileStats;
  onboardingWeightKg: number;
  weighIns: readonly TrendInput[];
  days: readonly DayInput[];
}>;

/**
 * The input of `checkinStep` for one date. The floor's BMR is Mifflin-St Jeor of the stats at the
 * onboarding weight, with the age on the check-in date (ADR 0002, Amendment 2, "Key sets and the 6000 cap").
 */
export function toCheckinInput(
  { program, stats, onboardingWeightKg, weighIns, days }: CheckinReads,
  asOfDate: string,
  prior: ExpenditureBelief,
): CheckinInput {
  return {
    asOfDate,
    prior,
    weighIns,
    days,
    program,
    bmrKcal: profileBmr(stats, onboardingWeightKg, asOfDate),
    onboardingWeightKg,
  };
}

/** What `record_checkin` answers (ADR 0003, Amendment 13). Only `recorded` wrote anything. */
export type RecordOutcome = "recorded" | "duplicate" | "program_ended";

const recordOutcomeSchema = z.enum(["recorded", "duplicate", "program_ended"]);

/** What is stored for the user: the newest snapshot's belief and the program's next check-in date. */
export type StoredCheckinState = Readonly<{
  prior: ExpenditureBelief;
  nextCheckinDate: string | null;
}>;

export type CheckinLoopDependencies = Readonly<{
  /** The check-in for one date from the belief before it: `checkinStep` over this run's reads. */
  step: (asOfDate: string, prior: ExpenditureBelief) => CheckinResult;
  /** One `record_checkin` call. It throws for any failure. */
  record: (result: CheckinResult, nextCheckinDate: string) => Promise<RecordOutcome>;
  /** Reads the newest snapshot and the program's next check-in date again. */
  reload: () => Promise<StoredCheckinState>;
}>;

export type CheckinLoopResult = Readonly<{ ran: number; nextCheckinDate: string | null }>;

/**
 * Records `dates` one at a time, oldest first, each from the belief the one before it left. `ran`
 * counts the check-ins this call recorded.
 *
 * - `duplicate`: another caller got to that date first. Its snapshot and the moved date are read again
 *   and the loop carries on from the stored values, so a second caller never repeats a step. A date
 *   before the stored one is already done and is skipped. A stored date that is not on the plan
 *   (none, or earlier than the date in hand) ends the loop.
 * - `program_ended`: the user saved their own targets between the read and the write, and nothing
 *   was written. The loop stops without an error and the program has no next check-in date.
 */
export async function runCheckinLoop(
  dates: readonly string[],
  start: StoredCheckinState,
  { step, record, reload }: CheckinLoopDependencies,
): Promise<CheckinLoopResult> {
  let state = start;
  let ran = 0;
  for (const asOfDate of dates) {
    if (state.nextCheckinDate === null || state.nextCheckinDate < asOfDate) {
      break;
    }
    if (state.nextCheckinDate > asOfDate) {
      continue;
    }
    const result = step(asOfDate, state.prior);
    const nextCheckinDate = nextAfter(asOfDate);
    const outcome = await record(result, nextCheckinDate);
    if (outcome === "program_ended") {
      return { ran, nextCheckinDate: null };
    }
    if (outcome === "duplicate") {
      state = await reload();
      continue;
    }
    ran += 1;
    state = {
      prior: { muKcal: result.snapshot.mu_kcal, varKcal2: result.snapshot.var_kcal2 },
      nextCheckinDate,
    };
  }
  return { ran, nextCheckinDate: state.nextCheckinDate };
}

const jsonObjectSchema = z.record(z.string(), z.json());

/**
 * The arguments of `record_checkin`. Every key is one the writer reads, and none names a user: the
 * user is `p_user_id` alone, and the writer builds `kind`, the ids and the dates from its own rules.
 * The values go through a JSON schema, so what is sent is plain JSON and the types agree with it.
 */
export function toRecordCheckinArguments(
  userId: string,
  programId: string,
  { snapshot, targets }: CheckinResult,
  nextCheckinDate: string,
) {
  return {
    p_user_id: userId,
    p_snapshot: jsonObjectSchema.parse({
      program_id: programId,
      as_of_date: snapshot.as_of_date,
      mu_kcal: snapshot.mu_kcal,
      var_kcal2: snapshot.var_kcal2,
      measurement: snapshot.measurement,
      trend_weight_kg: snapshot.trend_weight_kg,
      engine_version: snapshot.engine_version,
      params: snapshot.params,
    }),
    p_targets: jsonObjectSchema.parse({
      calories_kcal: targets.calories_kcal,
      protein_g: targets.protein_g,
      fat_g: targets.fat_g,
      carbs_g: targets.carbs_g,
      dow_calories_kcal: targets.dow_calories_kcal,
      basis: targets.basis,
      engine_version: targets.engine_version,
      params: targets.params,
    }),
    p_next_checkin_date: nextCheckinDate,
  };
}

/** The error of a refused write. Its message holds the database code and nothing else. */
export class RecordCheckinError extends Error {
  constructor(code: string) {
    super(`record_checkin was refused with code ${code}`);
    this.name = "RecordCheckinError";
  }
}

// A database code is five characters of SQLSTATE or a PostgREST code such as PGRST202, and this
// function's own codes are short words with underscores. Anything else might be text, so it is not
// repeated.
const databaseCodePattern = /^[A-Za-z0-9_]{1,16}$/;

/**
 * The error to throw when `record_checkin` answers an error. A refused write puts the failing row
 * in the error's details, calories and macros, and for a profile the birth date and height, and a
 * failed cast quotes the text. So only the code is forwarded, never the message, the details or the hint.
 */
export function recordCheckinFailure(code: string): RecordCheckinError {
  return new RecordCheckinError(safeDatabaseCode(code));
}

/** The error to throw when a read answers an error. It names the table and the code, never the message. */
export function readFailure(table: string, code: string): Error {
  return new Error(`Reading ${table} failed with code ${safeDatabaseCode(code)}`);
}

/**
 * The outcome in a `record_checkin` answer. An error answer throws `recordCheckinFailure` with the code
 * alone, so the message, the details and the hint of the answer go no further than this function.
 */
export function toRecordOutcome(answer: {
  data: unknown;
  error: Readonly<{ code: string }> | null;
}): RecordOutcome {
  if (answer.error !== null) {
    throw recordCheckinFailure(answer.error.code);
  }
  return recordOutcomeSchema.parse(answer.data);
}

type RecordCheckinArguments = ReturnType<typeof toRecordCheckinArguments>;

/** The `record_checkin` call of the service client, as far as `callRecordCheckin` needs it. */
export type RecordCheckinRpc = (
  args: RecordCheckinArguments,
) => PromiseLike<{ data: unknown; error: Readonly<{ code: string }> | null }>;

/**
 * Records one check-in through the writer and answers its outcome. A refused write throws the code
 * alone (see `toRecordOutcome`), so nothing of the row reaches the response, the log or Sentry.
 */
export async function callRecordCheckin(
  rpc: RecordCheckinRpc,
  userId: string,
  programId: string,
  result: CheckinResult,
  nextCheckinDate: string,
): Promise<RecordOutcome> {
  return toRecordOutcome(
    await rpc(toRecordCheckinArguments(userId, programId, result, nextCheckinDate)),
  );
}

/**
 * The JSON body of a call as text. No body at all asks for `due`, so an empty text reads as an empty
 * object (ADR 0002, Amendment 2). Text that is not JSON is not ok.
 */
export function readRequestBody(text: string): { ok: true; body: unknown } | { ok: false } {
  if (text === "") {
    return { ok: true, body: {} };
  }
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

function safeDatabaseCode(code: string): string {
  return databaseCodePattern.test(code) ? code : "unknown";
}

export type RunCheckinMode = "due" | "recompute" | "backstop";

export type RunCheckinRequestRead =
  | Readonly<{ ok: true; mode: RunCheckinMode }>
  | Readonly<{ ok: false; code: Extract<EdgeErrorCode, "invalid_request" | "bad_mode"> }>;

/**
 * Reads the JSON body of a call. A body with no mode asks for `due`. A body that names a mode this
 * function does not have is `bad_mode`, and one that is not an object is `invalid_request`.
 */
export function readRunCheckinRequest(body: unknown): RunCheckinRequestRead {
  const parsed = runCheckinRequestSchema.safeParse(body);
  if (parsed.success) {
    return { ok: true, mode: parsed.data.mode ?? "due" };
  }
  const namesAMode = typeof body === "object" && body !== null && "mode" in body;
  return { ok: false, code: namesAMode ? "bad_mode" : "invalid_request" };
}

/** The line a finished run logs: the user id, the number of check-ins run and the duration. */
export function runLogLine({
  userId,
  ran,
  durationMilliseconds,
}: Readonly<{ userId: string; ran: number; durationMilliseconds: number }>): string {
  return `run-checkin due user=${userId} ran=${ran} duration_ms=${durationMilliseconds}`;
}

/** The code of a call that is refused for its user's rows: no program, or a profile with a stat missing. */
export type RunCheckinRefusalCode = Extract<EdgeErrorCode, "no_program" | "missing_stats">;

/** The line a refused run logs: the user id and the code. */
export function refusedLogLine(userId: string, code: RunCheckinRefusalCode): string {
  return `run-checkin refused user=${userId} code=${code}`;
}

/** The line a finished recompute logs: the user id, which branch ran and the duration. */
export function recomputeLogLine({
  userId,
  branch,
  durationMilliseconds,
}: Readonly<{ userId: string; branch: RecomputeBranch; durationMilliseconds: number }>): string {
  return `run-checkin recompute user=${userId} branch=${branch} duration_ms=${durationMilliseconds}`;
}

/**
 * The snapshot a due check-in starts from: the newest one dated before `before`, or the newest of all
 * when `before` is null. A start snapshot can carry a later date than a check-in that is still due (a
 * recompute writes one as of today), and a check-in must not start from a belief that is dated after
 * it. `read` answers the newest snapshot under that date. A failed read throws its code alone. Null
 * when there is no such snapshot.
 */
export async function readPriorBelief(
  read: PriorSnapshotRead,
  before: string | null,
): Promise<ExpenditureBelief | null> {
  const { data, error } = await read(before);
  if (error !== null) {
    throw readFailure("expenditure_snapshots", error.code);
  }
  return data === null ? null : { muKcal: data.mu_kcal, varKcal2: data.var_kcal2 };
}

/** The newest snapshot dated before a date (any, for null), as far as `readPriorBelief` needs it. */
export type PriorSnapshotRead = (before: string | null) => PromiseLike<{
  data: Readonly<{ mu_kcal: number; var_kcal2: number }> | null;
  error: Readonly<{ code: string }> | null;
}>;

/** `startSnapshotAction` rewrites a start snapshot up to this many days old and makes a new one after that. */
const oldestRewrittenStartSnapshotDays = 28;

/**
 * The days of weigh-ins a recompute reads, back from today. The oldest rewrite is dated today minus 28
 * and needs the trend on the day before that (29 days back), warmed up by `trendWarmUpDays` more.
 */
export const recomputeWeighInDays = oldestRewrittenStartSnapshotDays + 1 + trendWarmUpDays;

/**
 * The trend weight on `date`: the newest trend point of the weigh-ins dated on or before it, or null
 * when there is none. The trend is worked out from those weigh-ins only, as `checkinStep` does for the
 * day before a check-in, so a later weigh-in never moves it.
 */
export function trendWeightOn(weighIns: readonly TrendInput[], date: string): number | null {
  const upToDate = weighIns.filter(({ localDate }) => localDate <= date);
  return computeTrend(upToDate).at(-1)?.trendKg ?? null;
}

/** The newest snapshot of the user, as far as a recompute reads it. */
export type NewestSnapshot = Readonly<{
  id: string;
  kind: "start" | "checkin";
  as_of_date: string;
  mu_kcal: number;
}>;

/** Everything a recompute reads. The weigh-ins are live ones and may reach back as far as `recomputeWeighInDays`. */
export type RecomputeReads = Readonly<{
  program: CheckinProgram;
  /** The program's stored `next_checkin_date`, null for a program the wizard made. */
  nextCheckinDate: string | null;
  stats: ProfileStats;
  onboardingWeightKg: number;
  newest: NewestSnapshot | null;
  weighIns: readonly TrendInput[];
  /** The user's local today, `YYYY-MM-DD`. */
  today: string;
}>;

/** What a recompute does with the start snapshot: `new`, `rewrite` or `none` (ADR 0002, Amendment 2). */
export type RecomputeBranch = StartSnapshotAction;

/** What a recompute writes: the start snapshot (or none), the targets and the schedule (or none). */
export type RecomputePlan = Readonly<{
  branch: RecomputeBranch;
  startSnapshot: StartSnapshot | null;
  /** The newest snapshot the targets point at, for the `none` branch. The writer sets it otherwise. */
  expenditureSnapshotId: string | null;
  targets: RecomputeTargetsRow;
  schedule: ScheduleToSet | null;
}>;

/**
 * The recompute of one user (ADR 0002, Amendment 2, "The start snapshot and the schedule" and
 * "Recompute"). `startSnapshotAction` picks the branch. A `rewrite` keeps the existing start snapshot's
 * own date, so a start snapshot is never dated later than the program's `next_checkin_date`. The
 * schedule is decided apart from the branch, from the program alone, except that a `new` start
 * snapshot also sets it again when the program's date is already due.
 *
 * The trend weight of a start snapshot is the trend on the day before its date, null with no weigh-in
 * (ADR 0003, Amendment 13). The targets use the trend on yesterday, the onboarding weight standing in
 * when there is none. Only the `none` branch reads the targets' expenditure from the stored snapshot.
 */
export function planRecompute({
  program,
  nextCheckinDate,
  stats,
  onboardingWeightKg,
  newest,
  weighIns,
  today,
}: RecomputeReads): RecomputePlan {
  const branch = startSnapshotAction({
    latest: newest,
    today,
    settling: newest?.kind === "start",
  });
  const asOfDate = branch === "rewrite" && newest !== null ? newest.as_of_date : today;
  const start =
    branch === "none"
      ? null
      : startSnapshot({
          stats,
          onboardingWeightKg,
          asOfDate,
          trendWeightKg: trendWeightOn(weighIns, addCalendarDays(asOfDate, -1)),
        });
  const snapshot = start ?? newest;
  if (snapshot === null) {
    // `none` is only ever chosen when there is a newest snapshot.
    throw new RangeError("A recompute needs a snapshot to start from.");
  }
  const targets = recomputeTargets({
    snapshot,
    trendWeightKg: trendWeightOn(weighIns, addCalendarDays(today, -1)) ?? onboardingWeightKg,
    program,
    bmrKcal: profileBmr(stats, onboardingWeightKg, today),
    today,
  });
  // A new start snapshot begins a fresh settling period. When the program's date is already due, the
  // due mode would otherwise answer `duplicate` for today's date and never move it, so the schedule
  // is set again (a null date, to `scheduleToSet`, is one that is set again).
  const dateIsDue = nextCheckinDate !== null && nextCheckinDate <= today;
  return {
    branch,
    startSnapshot: start,
    expenditureSnapshotId: branch === "none" ? (newest?.id ?? null) : null,
    targets,
    schedule: scheduleToSet(
      { next_checkin_date: branch === "new" && dateIsDue ? null : nextCheckinDate },
      today,
    ),
  };
}

/**
 * The arguments of `record_targets`. Every key is one the writer reads, and none names a user but
 * `p_user_id`. A null start snapshot, date or weekday is sent as null, and the writer then leaves that
 * part alone.
 */
export function toRecordTargetsArguments(
  userId: string,
  programId: string,
  { startSnapshot: start, expenditureSnapshotId, targets, schedule }: RecomputePlan,
) {
  return {
    p_user_id: userId,
    p_targets: jsonObjectSchema.parse({
      program_id: programId,
      expenditure_snapshot_id: expenditureSnapshotId,
      effective_from: targets.effective_from,
      calories_kcal: targets.calories_kcal,
      protein_g: targets.protein_g,
      fat_g: targets.fat_g,
      carbs_g: targets.carbs_g,
      dow_calories_kcal: targets.dow_calories_kcal,
      basis: targets.basis,
      engine_version: targets.engine_version,
      params: targets.params,
    }),
    p_start_snapshot:
      start === null
        ? null
        : jsonObjectSchema.parse({
            program_id: programId,
            as_of_date: start.as_of_date,
            mu_kcal: start.mu_kcal,
            var_kcal2: start.var_kcal2,
            measurement: start.measurement,
            trend_weight_kg: start.trend_weight_kg,
            engine_version: start.engine_version,
            params: start.params,
          }),
    p_next_checkin_date: schedule === null ? null : schedule.nextCheckinDate,
    p_checkin_weekday: schedule === null ? null : schedule.checkinWeekday,
  };
}

/** The error of a refused `record_targets` write. Its message holds the database code and nothing else. */
export class RecordTargetsError extends Error {
  constructor(code: string) {
    super(`record_targets was refused with code ${code}`);
    this.name = "RecordTargetsError";
  }
}

type RecordTargetsArguments = ReturnType<typeof toRecordTargetsArguments>;

/**
 * `record_targets` arguments as the generated database types have them. They call every argument
 * non-null, though the writer takes a null start snapshot, date and weekday to mean "leave alone".
 * Sending `RecordTargetsArguments` as these is safe because the types differ only in that nullability.
 */
export type GeneratedRecordTargetsArguments =
  Database["public"]["Functions"]["record_targets"]["Args"];

/** The `record_targets` call of the service client, as far as `callRecordTargets` needs it. */
export type RecordTargetsRpc = (
  args: RecordTargetsArguments,
) => PromiseLike<{ data: unknown; error: Readonly<{ code: string }> | null }>;

const targetsIdSchema = z.uuid();

/**
 * Writes the recompute through `record_targets` and answers the id of the new targets row. A refused
 * write throws the code alone, for the reason `recordCheckinFailure` gives, so nothing of the rows reaches
 * the response, the log or Sentry.
 */
export async function callRecordTargets(
  rpc: RecordTargetsRpc,
  userId: string,
  programId: string,
  plan: RecomputePlan,
): Promise<string> {
  const answer = await rpc(toRecordTargetsArguments(userId, programId, plan));
  if (answer.error !== null) {
    throw new RecordTargetsError(safeDatabaseCode(answer.error.code));
  }
  return targetsIdSchema.parse(answer.data);
}
