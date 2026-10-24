import { ageInYears, isCalendarDay } from "@keylow/core/dates";
import {
  expenditureMeasurementSchema,
  runCheckinRecomputeResponseSchema,
  runCheckinRequestSchema,
  targetsBasisSchema,
} from "@keylow/core/schemas";
import {
  DIET_FAT_FRACTION_OF_REMAINDER,
  DIET_STYLES,
  GOALS,
  PROTEIN_G_PER_KG,
  RATE_PRESETS_PCT_PER_WEEK,
  goalsAllowed,
} from "@keylow/core/setup";
import { z } from "zod";

import { invokeEdgeFunction } from "../edge";

import type { SetupProgram } from "./setup";
import type { Database } from "../database.types";
import type {
  ExpenditureMeasurement,
  RunCheckinRecomputeResponse,
  TargetsBasis,
} from "@keylow/core/schemas";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

// The program, its expenditure estimates and its targets are health data. A failure names the action and
// a code only: the database's own code, or one of ours for a row that is not what the table promises
// (`invalid_row`, `invalid_measurement`, `invalid_basis`). The database message and a schema issue can
// quote a value, so neither is put in a message or a cause.

const PROGRAM_COLUMNS =
  "id,goal,rate_pct_per_week,protein_g_per_kg,fat_fraction_of_remaining,split_preset,started_on,next_checkin_date";
const SNAPSHOT_COLUMNS = "id,program_id,as_of_date,kind,mu_kcal,var_kcal2,measurement";
const TARGETS_COLUMNS =
  "id,program_id,effective_from,effective_to,calories_kcal,protein_g,fat_g,carbs_g,dow_calories_kcal,basis";

/**
 * How many of the newest targets rows the summary reads to find the current row and the one before it.
 * A row replaced on the day it began held for no days and is skipped, and every recompute, edit or
 * collapsed catch-up on one day adds one, so far more than two are read.
 */
const RECENT_TARGETS_ROWS = 25;

/**
 * How many of the newest snapshots the summary reads before it keeps the newest two of the active
 * program. A few more than two, so that a row of another program among the newest does not leave the
 * program with fewer than it has.
 */
const RECENT_SNAPSHOT_ROWS = 5;

type ProgramColumns = Pick<
  Database["public"]["Tables"]["programs"]["Row"],
  | "id"
  | "goal"
  | "rate_pct_per_week"
  | "protein_g_per_kg"
  | "fat_fraction_of_remaining"
  | "split_preset"
  | "started_on"
  | "next_checkin_date"
>;
type SnapshotColumns = Pick<
  Database["public"]["Tables"]["expenditure_snapshots"]["Row"],
  "id" | "program_id" | "as_of_date" | "kind" | "mu_kcal" | "var_kcal2" | "measurement"
>;
type TargetsColumns = Pick<
  Database["public"]["Tables"]["targets"]["Row"],
  | "id"
  | "program_id"
  | "effective_from"
  | "effective_to"
  | "calories_kcal"
  | "protein_g"
  | "fat_g"
  | "carbs_g"
  | "dow_calories_kcal"
  | "basis"
>;

/**
 * The active program as the setup reads it (`SetupProgram`), with the two dates the program screen
 * shows. `nextCheckinDate` is null until a schedule is set. `startedOn` is the local date it began.
 */
export type ProgramDetails = SetupProgram & {
  startedOn: string;
  nextCheckinDate: string | null;
};

type SnapshotFields = {
  id: string;
  asOfDate: string;
  muKcal: number;
  varKcal2: number;
};

/**
 * One expenditure estimate. A `start` snapshot is the starting estimate made at setup and has no
 * measurement. A `checkin` snapshot always has one, which says whether the week measured and, when it
 * did, what the step was (`rawStepKcal`, `stepClamped`) and which counts it rested on.
 */
export type ExpenditureSnapshot =
  | (SnapshotFields & { kind: "start"; measurement: null })
  | (SnapshotFields & { kind: "checkin"; measurement: ExpenditureMeasurement });

/**
 * The targets of one range of days. `effectiveFrom` is inclusive and `effectiveTo` exclusive, and a null
 * `effectiveTo` means the row is open. An open row is in force only while the active program exists
 * (ADR 0003, Amendment 13), so `isCurrent` is true only for an open row of an active program, and an
 * open row left by an ended program is not labelled current.
 */
export type TargetsRow = {
  id: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isCurrent: boolean;
  caloriesKcal: number;
  proteinG: number;
  fatG: number;
  carbsG: number;
  dowCaloriesKcal: number[];
  basis: TargetsBasis;
};

/**
 * What the program screen reads. With no active program every field is null: an ended program's rows
 * are history and are read through the two lists. `latestSnapshot` and `previousSnapshot` are the
 * newest two snapshots of that program, newest first. `currentTargets` is the open row and
 * `previousTargets` the newest row of that program before it that held for at least a day.
 */
export type ProgramSummary = {
  program: ProgramDetails | null;
  latestSnapshot: ExpenditureSnapshot | null;
  previousSnapshot: ExpenditureSnapshot | null;
  currentTargets: TargetsRow | null;
  previousTargets: TargetsRow | null;
};

const snapshotKindSchema = z.enum(["start", "checkin"]);

const readError = (action: string, code: string) =>
  new Error(`Could not ${action} (${code})`, { cause: { code } });

const databaseError = (action: string, cause: PostgrestError) => readError(action, cause.code);

/** Parses a stored jsonb, and on failure names the code and nothing the value held. */
function parseOrFail<Schema extends z.ZodType>(
  schema: Schema,
  value: unknown,
  action: string,
  code: string,
): z.output<Schema> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw readError(action, code);
  }
  return result.data;
}

function assertCalendarDay(fromDate: string): void {
  if (!isCalendarDay(fromDate)) {
    throw new RangeError("A history must start on a calendar date written YYYY-MM-DD");
  }
}

const toProgram = (row: ProgramColumns): ProgramDetails => ({
  id: row.id,
  goal: row.goal,
  ratePctPerWeek: row.rate_pct_per_week,
  proteinGPerKg: row.protein_g_per_kg,
  fatFraction: row.fat_fraction_of_remaining,
  splitPreset: row.split_preset,
  startedOn: row.started_on,
  nextCheckinDate: row.next_checkin_date,
});

function toSnapshot(row: SnapshotColumns, action: string): ExpenditureSnapshot {
  const fields = {
    id: row.id,
    asOfDate: row.as_of_date,
    muKcal: row.mu_kcal,
    varKcal2: row.var_kcal2,
  };
  const kind = parseOrFail(snapshotKindSchema, row.kind, action, "invalid_row");

  // The table's own check ties the two together: a start has no measurement and a check-in has one.
  if (kind === "start") {
    if (row.measurement !== null) {
      throw readError(action, "invalid_row");
    }
    return { ...fields, kind, measurement: null };
  }
  if (row.measurement === null) {
    throw readError(action, "invalid_row");
  }
  return {
    ...fields,
    kind,
    measurement: parseOrFail(
      expenditureMeasurementSchema,
      row.measurement,
      action,
      "invalid_measurement",
    ),
  };
}

function toTargetsRow(row: TargetsColumns, programIsActive: boolean, action: string): TargetsRow {
  return {
    id: row.id,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to,
    isCurrent: row.effective_to === null && programIsActive,
    caloriesKcal: row.calories_kcal,
    proteinG: row.protein_g,
    fatG: row.fat_g,
    carbsG: row.carbs_g,
    dowCaloriesKcal: row.dow_calories_kcal,
    basis: parseOrFail(targetsBasisSchema, row.basis, action, "invalid_basis"),
  };
}

/** A row replaced on the day it began: the writer closes it at its own start, so it held for no days. */
const heldForNoDays = (row: TargetsColumns): boolean => row.effective_to === row.effective_from;

/**
 * Reads what the program screen needs in one call: the active program, the newest two expenditure
 * snapshots and the current and previous targets rows. Row level security shows a user their own rows,
 * so no id is needed. With no active program the result is all null, even though an ended program's
 * rows remain, because its open targets row is no longer in force. The two snapshots and the two targets
 * rows are the newest of the active program, so a restarted program never shows the ended one's estimate
 * or targets. `measurement` and `basis` are parsed with core's schemas, and a row that does not match
 * throws with the action and a code only. Nothing here writes.
 */
export async function getMyProgramSummary(
  client: SupabaseClient<Database>,
): Promise<ProgramSummary> {
  const action = "load your program";
  const [program, snapshots, targets] = await Promise.all([
    client.from("programs").select(PROGRAM_COLUMNS).is("ended_on", null).maybeSingle(),
    client
      .from("expenditure_snapshots")
      .select(SNAPSHOT_COLUMNS)
      .order("as_of_date", { ascending: false })
      .limit(RECENT_SNAPSHOT_ROWS),
    client
      .from("targets")
      .select(TARGETS_COLUMNS)
      .order("effective_from", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(RECENT_TARGETS_ROWS),
  ]);

  if (program.error) {
    throw databaseError(action, program.error);
  }
  if (snapshots.error) {
    throw databaseError(action, snapshots.error);
  }
  if (targets.error) {
    throw databaseError(action, targets.error);
  }

  if (program.data === null) {
    return {
      program: null,
      latestSnapshot: null,
      previousSnapshot: null,
      currentTargets: null,
      previousTargets: null,
    };
  }

  // An ended program's estimate and targets are not shown to the program that replaced it, so only the
  // active program's own snapshots and targets rows are kept.
  const activeProgram = program.data;
  const [latest, previous] = snapshots.data.filter((row) => row.program_id === activeProgram.id);
  const ownTargets = targets.data.filter((row) => row.program_id === activeProgram.id);
  const inForce = ownTargets.filter((row) => !heldForNoDays(row));
  const current = inForce.find((row) => row.effective_to === null);
  const before = inForce.find((row) => row !== current);

  return {
    program: toProgram(program.data),
    latestSnapshot: latest === undefined ? null : toSnapshot(latest, action),
    previousSnapshot: previous === undefined ? null : toSnapshot(previous, action),
    currentTargets: current === undefined ? null : toTargetsRow(current, true, action),
    previousTargets: before === undefined ? null : toTargetsRow(before, true, action),
  };
}

/**
 * The signed in user's expenditure snapshots from `fromDate` (`YYYY-MM-DD`, inclusive) on, oldest first,
 * for the chart. A `fromDate` that is not a calendar date throws a `RangeError` before any request.
 */
export async function listMyExpenditureSnapshots(
  client: SupabaseClient<Database>,
  { fromDate }: { fromDate: string },
): Promise<ExpenditureSnapshot[]> {
  assertCalendarDay(fromDate);
  const action = "load your expenditure history";

  const { data, error } = await client
    .from("expenditure_snapshots")
    .select(SNAPSHOT_COLUMNS)
    .gte("as_of_date", fromDate)
    .order("as_of_date", { ascending: true });

  if (error) {
    throw databaseError(action, error);
  }

  return data.map((row) => toSnapshot(row, action));
}

/**
 * The signed in user's targets rows whose range touches `fromDate` (`YYYY-MM-DD`) and every day after,
 * oldest first: the rows that ended after it, and the open row. A row that ended on `fromDate` is out,
 * because its end is exclusive. A row that held for no days is left out, unless `keepZeroDayRows` is true:
 * a check-in's row that an edit replaced on the same day held for no days, and is the only record of that
 * check-in's targets. It then stands before the row that replaced it. `isCurrent` is true only for an
 * open row while a program is active (see `TargetsRow`), which is why the active program is read as
 * well. A `fromDate` that is not a calendar date throws a `RangeError` before any request.
 */
export async function listMyTargetsHistory(
  client: SupabaseClient<Database>,
  { fromDate, keepZeroDayRows = false }: { fromDate: string; keepZeroDayRows?: boolean },
): Promise<TargetsRow[]> {
  assertCalendarDay(fromDate);
  const action = "load your targets history";

  const [program, targets] = await Promise.all([
    client.from("programs").select("id").is("ended_on", null).maybeSingle(),
    client
      .from("targets")
      .select(TARGETS_COLUMNS)
      .or(`effective_to.is.null,effective_to.gt.${fromDate}`)
      .order("effective_from", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
  ]);

  if (program.error) {
    throw databaseError(action, program.error);
  }
  if (targets.error) {
    throw databaseError(action, targets.error);
  }

  const programIsActive = program.data !== null;

  return targets.data
    .filter((row) => keepZeroDayRows || !heldForNoDays(row))
    .map((row) => toTargetsRow(row, programIsActive, action));
}

const programChangesSchema = z
  .object({
    goal: z.enum(GOALS),
    ratePctPerWeek: z.number(),
    proteinGPerKg: z.number(),
    fatFraction: z.number(),
    splitPreset: z.enum(DIET_STYLES),
  })
  .superRefine((changes, context) => {
    if (!RATE_PRESETS_PCT_PER_WEEK[changes.goal].includes(changes.ratePctPerWeek)) {
      context.addIssue({ code: "custom", path: ["ratePctPerWeek"] });
    }
    if (!Object.values(PROTEIN_G_PER_KG).includes(changes.proteinGPerKg)) {
      context.addIssue({ code: "custom", path: ["proteinGPerKg"] });
    }
    if (DIET_FAT_FRACTION_OF_REMAINDER[changes.splitPreset] !== changes.fatFraction) {
      context.addIssue({ code: "custom", path: ["fatFraction"] });
    }
  });

/**
 * What the program screen's edit changes: the five values of the active program that the wizard also
 * writes. They are the values the wizard's presets hold (`@keylow/core/setup`): `ratePctPerWeek` is a
 * magnitude and one of the goal's rate presets, `proteinGPerKg` is a protein preset, and `fatFraction`
 * is the fraction of the chosen diet style, which is also the stored `splitPreset`, with no mapping.
 */
export type ProgramChanges = z.infer<typeof programChangesSchema>;

/**
 * Asks `run-checkin` to work out the targets again from the program and the profile as they are now
 * (`recompute` mode, ADR 0002, Amendment 2, "The modes"), and gives back the id of the new targets row.
 * A rate limit throws a `RateLimitedError`, a typed refusal an `EdgeFunctionError` (`no_program` when the
 * user has no active program, `missing_stats` when a stat the engine needs is missing), and anything the
 * edge helpers cannot classify, or an answer that is not a targets id, a plain error.
 */
export async function recomputeMyTargets(
  client: SupabaseClient<Database>,
): Promise<RunCheckinRecomputeResponse> {
  const body = runCheckinRequestSchema.parse({ mode: "recompute" });
  const response = await invokeEdgeFunction<unknown>(client, "run-checkin", body);

  return runCheckinRecomputeResponseSchema.parse(response);
}

const updateError = (cause: PostgrestError) =>
  new Error(`Could not update your program (${cause.code})`, { cause: { code: cause.code } });

/**
 * Edits the active program of `userId` in place and then recomputes the targets, so the new goal is in
 * force at once. `today` is the user's local date (`YYYY-MM-DD`), which the age rule needs.
 *
 * The changes are checked first, with no request: a value that is not one of the wizard's presets throws a
 * `RangeError` naming the fields. Then the birth date is read, and a goal that `goalsAllowed` in core does
 * not offer at that age (a lose goal under 18, ADR 0002, Amendment 1) throws a `RangeError` that names the
 * rule and never the age. A profile with no birth date is treated as too young for any goal that needs an
 * adult. Only after that is anything written.
 *
 * The update carries exactly `goal`, `rate_pct_per_week`, `protein_g_per_kg`, `fat_fraction_of_remaining`,
 * `split_preset` and `updated_at`, which is what ADR 0003, Amendment 12 lets a recalculation write. It
 * never writes `started_on`, `dow_offsets_kcal`, `goal_weight_kg`, `next_checkin_date` or `ended_on`.
 * A user with no active program matches no row and fails with `PGRST116`. A database failure names the
 * action and the code only.
 *
 * The recompute is a second step, not part of the write. When it is refused the program stays as edited
 * and the typed edge error from `recomputeMyTargets` is thrown, so the screen can say the targets are
 * not up to date and offer a retry.
 */
export async function updateMyProgram(
  client: SupabaseClient<Database>,
  userId: string,
  changes: ProgramChanges,
  { today }: { today: string },
): Promise<RunCheckinRecomputeResponse> {
  if (!isCalendarDay(today)) {
    throw new RangeError("Today must be a calendar date written YYYY-MM-DD");
  }

  const parsed = programChangesSchema.safeParse(changes);
  if (!parsed.success) {
    const fields = new Set(parsed.error.issues.map((issue) => String(issue.path[0])));
    throw new RangeError(`Invalid program changes: ${[...fields].join(", ")}`);
  }
  const valid = parsed.data;

  const profile = await client.from("profiles").select("birth_date").eq("id", userId).maybeSingle();
  if (profile.error) {
    throw updateError(profile.error);
  }
  const birthDate = profile.data?.birth_date ?? null;
  // No birth date means no proof of age, so the age is taken as 0 and `goalsAllowed` decides from that.
  const ageYears = birthDate === null ? 0 : ageInYears(birthDate, today);
  if (!goalsAllowed(ageYears).includes(valid.goal)) {
    throw new RangeError("The lose goal is not allowed under 18");
  }

  // Named one by one and not spread: nothing but Amendment 12's six columns can reach the row.
  const { error } = await client
    .from("programs")
    .update({
      goal: valid.goal,
      rate_pct_per_week: valid.ratePctPerWeek,
      protein_g_per_kg: valid.proteinGPerKg,
      fat_fraction_of_remaining: valid.fatFraction,
      split_preset: valid.splitPreset,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .is("ended_on", null)
    .select("id")
    .single();
  if (error) {
    throw updateError(error);
  }

  return recomputeMyTargets(client);
}
