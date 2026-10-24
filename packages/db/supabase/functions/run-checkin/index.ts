// run-checkin: the weekly check-in of the caller's own program (ADR 0002, Amendment 2, "`run-checkin`").
// Two modes live here. `due` runs the check-ins that are due for the signed-in user, oldest first, up
// to 8 a call. `recompute` makes the start snapshot when one is due, derives the targets again and
// sets the schedule (the end of setup, and an edit of the program). `backstop` comes with its own
// ticket and is refused as a bad mode until then.
//
// Things to know when changing this file:
// - The service client bypasses row level security, so every read is filtered by the verified user's
//   id, and the writer takes that id as an argument. Nothing here reads a user id from the request.
// - The engine is `checkinStep` in core. The pure parts (the dates, the range of rows, the loop) are in
//   `_shared/checkin.ts` and have Deno tests. This file only reads rows, calls the writer and answers.
// - The writer, `record_checkin`, is one transaction and the idempotency key is `(user_id, as_of_date)`.
//   A `duplicate` answer means another caller recorded that date first, so the loop re-reads and
//   carries on from what is stored. Two calls at once end in the same rows as one. `program_ended`
//   means the user saved their own targets between the read and the write: nothing was written.
// - Reads happen once for the run, whatever the number of dates: the diary days from 28 days before
//   the first date to the day before the last, and the weigh-ins from 90 days earlier still, so the
//   trend has warmed up and an on-time run and a late one agree. The program is read before the newest
//   snapshot, here and on a re-read. A snapshot read first could be stale by the time the date is
//   read, and the step would then be recorded from the wrong belief.
// - Health data: a weight, an intake, an expenditure or a target is never logged, never reported and
//   never in an error body. A failed read or write is reported by its database code alone, because
//   the message and the details of a refused write quote the row. Logs hold the user id, the number
//   of check-ins run and the duration.
// - A program with no snapshot to start from answers `ran: 0`. Making the start snapshot is the
//   `recompute` mode's job.
// - A check-in starts from the newest snapshot dated before its own date, not the newest of all. A
//   recompute can write a start snapshot as of today while an older check-in is still due, and that
//   check-in must not start from a belief dated after it. A rewrite keeps the start snapshot's own
//   date, so it is never dated past the program's `next_checkin_date`, and the filter covers the rest.
// - `recompute` always needs the stats, whether or not anything is due, and writes through
//   `record_targets` in one transaction. The pure choice of branch is `planRecompute`. Its logs hold
//   the user id, the branch and the duration.
import { requireUser } from "../_shared/auth.ts";
import {
  callRecordCheckin,
  callRecordTargets,
  datesToRun,
  planRecompute,
  readFailure,
  readPriorBelief,
  readRange,
  readRequestBody,
  readRunCheckinRequest,
  recomputeLogLine,
  recomputeWeighInDays,
  refusedLogLine,
  requireCompleteRead,
  requireUniqueDates,
  runCheckinLoop,
  runLogLine,
  toCheckinInput,
  toCheckinProgram,
  toWeighIns,
} from "../_shared/checkin.ts";
import { createServiceClient } from "../_shared/clients.ts";
import {
  addCalendarDays,
  checkinStep,
  localToday,
  requireStats,
  runCheckinRecomputeResponseSchema,
  runCheckinResponseSchema,
  toDayInputs,
} from "../_shared/core.ts";
import { error, handle, json } from "../_shared/http.ts";

import type {
  CheckinLoopDependencies,
  CheckinReads,
  CheckinProgramRow,
  GeneratedRecordTargetsArguments,
  NewestSnapshot,
  RecomputeBranch,
  RunCheckinMode,
  RunCheckinRefusalCode,
  StoredCheckinState,
} from "../_shared/checkin.ts";

type Service = ReturnType<typeof createServiceClient>;
type ActiveProgram = CheckinProgramRow & { id: string; next_checkin_date: string | null };
type Refusal = { code: RunCheckinRefusalCode };

const programColumns =
  "id, goal, rate_pct_per_week, protein_g_per_kg, fat_fraction_of_remaining, dow_offsets_kcal, next_checkin_date";

const refusalMessages = {
  no_program: "Set up a program before running a check-in.",
  missing_stats: "The profile is missing a detail a check-in needs.",
};

Deno.serve(
  handle("run-checkin", async (request) => {
    const user = await requireUser(request);
    if (user instanceof Response) {
      return user;
    }
    const mode = await readMode(request);
    if (mode instanceof Response) {
      return mode;
    }

    const startedAt = performance.now();
    const service = createServiceClient();
    const nowIso = new Date().toISOString();
    if (mode === "recompute") {
      const recomputed = await runRecompute(service, user.id, nowIso);
      if ("code" in recomputed) {
        console.info(refusedLogLine(user.id, recomputed.code));
        return error(recomputed.code, refusalMessages[recomputed.code]);
      }
      console.info(
        recomputeLogLine({
          userId: user.id,
          branch: recomputed.branch,
          durationMilliseconds: Math.round(performance.now() - startedAt),
        }),
      );
      return json(runCheckinRecomputeResponseSchema.parse({ targetsId: recomputed.targetsId }));
    }

    const outcome = await runDueCheckins(service, user.id, nowIso);
    if ("code" in outcome) {
      console.info(refusedLogLine(user.id, outcome.code));
      return error(outcome.code, refusalMessages[outcome.code]);
    }
    console.info(
      runLogLine({
        userId: user.id,
        ran: outcome.ran,
        durationMilliseconds: Math.round(performance.now() - startedAt),
      }),
    );
    return json(runCheckinResponseSchema.parse(outcome));
  }),
);

async function readMode(request: Request): Promise<RunCheckinMode | Response> {
  const text = readRequestBody(await request.text());
  if (!text.ok) {
    return error("invalid_request", "The request body must be JSON.");
  }
  const read = readRunCheckinRequest(text.body);
  if (read.ok) {
    return read.mode;
  }
  return read.code === "bad_mode"
    ? error("bad_mode", "Send no mode, or the mode due or recompute.")
    : error("invalid_request", "The request body must be a JSON object.");
}

async function runDueCheckins(
  service: Service,
  userId: string,
  nowIso: string,
): Promise<{ ran: number; nextCheckinDate: string | null } | Refusal> {
  const program = await readActiveProgram(service, userId);
  if (program === null) {
    return { code: "no_program" };
  }
  const profile = await readProfile(service, userId);
  const today = localToday(nowIso, profile.timezone);
  const dates = datesToRun(program.next_checkin_date, today);
  const range = readRange(dates);
  if (range === null) {
    return { ran: 0, nextCheckinDate: program.next_checkin_date };
  }

  const required = requireStats(profile);
  if (!required.ok) {
    return { code: "missing_stats" };
  }
  const prior = await readNewestBelief(service, userId, dates[0] ?? null);
  if (prior === null) {
    return { ran: 0, nextCheckinDate: program.next_checkin_date };
  }

  const reads: CheckinReads = {
    program: toCheckinProgram(program),
    stats: required.stats,
    onboardingWeightKg: required.onboardingWeightKg,
    ...(await readDiaryRange(service, userId, range)),
  };
  const dependencies: CheckinLoopDependencies = {
    step: (asOfDate, belief) => checkinStep(toCheckinInput(reads, asOfDate, belief)),
    record: (result, nextCheckinDate) =>
      callRecordCheckin(
        (args) => service.rpc("record_checkin", args),
        userId,
        program.id,
        result,
        nextCheckinDate,
      ),
    reload: () => readStoredState(service, userId),
  };
  return await runCheckinLoop(
    dates,
    { prior, nextCheckinDate: program.next_checkin_date },
    dependencies,
  );
}

async function readActiveProgram(service: Service, userId: string): Promise<ActiveProgram | null> {
  const { data, error: readError } = await service
    .from("programs")
    .select(programColumns)
    .eq("user_id", userId)
    .is("ended_on", null)
    .maybeSingle();
  if (readError !== null) {
    throw readFailure("programs", readError.code);
  }
  return data;
}

async function readProfile(service: Service, userId: string) {
  const { data, error: readError } = await service
    .from("profiles")
    .select("sex, birth_date, height_cm, activity, onboarding_weight_kg, timezone")
    .eq("id", userId)
    .maybeSingle();
  if (readError !== null) {
    throw readFailure("profiles", readError.code);
  }
  return (
    data ?? {
      sex: null,
      birth_date: null,
      height_cm: null,
      activity: null,
      onboarding_weight_kg: null,
      timezone: null,
    }
  );
}

// The newest snapshot is the one with the latest date, whatever its kind, among those dated before
// `before` (all of them for null). See the note at the top on why a check-in reads under its own date.
function readNewestBelief(service: Service, userId: string, before: string | null) {
  return readPriorBelief(async (cutoff) => {
    const query = service
      .from("expenditure_snapshots")
      .select("mu_kcal, var_kcal2")
      .eq("user_id", userId);
    return await (cutoff === null ? query : query.lt("as_of_date", cutoff))
      .order("as_of_date", { ascending: false })
      .limit(1)
      .maybeSingle();
  }, before);
}

// After a duplicate: the program's date first, then the newest snapshot dated before that date (see
// the note at the top). When the program is no longer active there is no date, and the loop stops.
// A duplicate means a snapshot exists, so finding none is a broken invariant and not a case to fall
// back from.
async function readStoredState(service: Service, userId: string): Promise<StoredCheckinState> {
  const program = await readActiveProgram(service, userId);
  const prior = await readNewestBelief(
    service,
    userId,
    program === null ? null : program.next_checkin_date,
  );
  if (prior === null) {
    throw readFailure("expenditure_snapshots", "absent");
  }
  return {
    prior,
    nextCheckinDate: program === null ? null : program.next_checkin_date,
  };
}

async function readDiaryRange(
  service: Service,
  userId: string,
  { from, weighInsFrom, to }: { from: string; weighInsFrom: string; to: string },
) {
  const [weighIns, dayTotals, dayLogs] = await Promise.all([
    liveWeighIns(service, userId, weighInsFrom, to),
    service
      .from("day_totals")
      .select("local_date, kcal")
      .eq("user_id", userId)
      .gte("local_date", from)
      .lte("local_date", to),
    service
      .from("day_logs")
      .select("local_date, is_complete")
      .eq("user_id", userId)
      .gte("local_date", from)
      .lte("local_date", to),
  ]);
  if (weighIns.error !== null) {
    throw readFailure("weigh_ins", weighIns.error.code);
  }
  if (dayTotals.error !== null) {
    throw readFailure("day_totals", dayTotals.error.code);
  }
  if (dayLogs.error !== null) {
    throw readFailure("day_logs", dayLogs.error.code);
  }
  return {
    weighIns: toWeighIns(requireCompleteRead(weighIns.data, "weigh_ins")),
    days: toDayInputs(
      requireUniqueDates(
        requireCompleteRead(dayTotals.data, "day_totals").flatMap(({ local_date, kcal }) =>
          // A grouped row always has a date. The view's type just cannot say so.
          local_date === null ? [] : [{ local_date, kcal }],
        ),
        "day_totals",
      ),
      requireUniqueDates(requireCompleteRead(dayLogs.data, "day_logs"), "day_logs"),
    ),
  };
}

// The user's live weigh-ins from `from` to `to`, both included, oldest first.
function liveWeighIns(service: Service, userId: string, from: string, to: string) {
  return service
    .from("weigh_ins")
    .select("local_date, weight_kg")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .gte("local_date", from)
    .lte("local_date", to)
    .order("local_date");
}

// The recompute (see the note at the top). The program is read before the newest snapshot, as in the
// due mode, and the stats are required before anything is read for the plan or written.
async function runRecompute(
  service: Service,
  userId: string,
  nowIso: string,
): Promise<{ targetsId: string; branch: RecomputeBranch } | Refusal> {
  const program = await readActiveProgram(service, userId);
  if (program === null) {
    return { code: "no_program" };
  }
  const profile = await readProfile(service, userId);
  const required = requireStats(profile);
  if (!required.ok) {
    return { code: "missing_stats" };
  }
  const today = localToday(nowIso, profile.timezone);
  const newest = await readNewestSnapshot(service, userId);
  const weighIns = await liveWeighIns(
    service,
    userId,
    addCalendarDays(today, -recomputeWeighInDays),
    addCalendarDays(today, -1),
  );
  if (weighIns.error !== null) {
    throw readFailure("weigh_ins", weighIns.error.code);
  }

  const plan = planRecompute({
    program: toCheckinProgram(program),
    nextCheckinDate: program.next_checkin_date,
    stats: required.stats,
    onboardingWeightKg: required.onboardingWeightKg,
    newest,
    weighIns: toWeighIns(requireCompleteRead(weighIns.data, "weigh_ins")),
    today,
  });
  const targetsId = await callRecordTargets(
    // The generated types call every argument non-null, so the writer's nulls need the cast (see its type).
    (args) => service.rpc("record_targets", args as GeneratedRecordTargetsArguments),
    userId,
    program.id,
    plan,
  );
  return { targetsId, branch: plan.branch };
}

// The newest snapshot by date, whatever its kind, with what a recompute reads of it.
async function readNewestSnapshot(
  service: Service,
  userId: string,
): Promise<NewestSnapshot | null> {
  const { data, error: readError } = await service
    .from("expenditure_snapshots")
    .select("id, kind, as_of_date, mu_kcal")
    .eq("user_id", userId)
    .order("as_of_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (readError !== null) {
    throw readFailure("expenditure_snapshots", readError.code);
  }
  if (data === null) {
    return null;
  }
  const { id, kind, as_of_date, mu_kcal } = data;
  if (kind !== "start" && kind !== "checkin") {
    throw readFailure("expenditure_snapshots", "unknown_kind");
  }
  return { id, kind, as_of_date, mu_kcal };
}
