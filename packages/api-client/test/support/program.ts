import { http } from "msw";

import { REST_URL, postgrestError, postgrestRows } from "./postgrest";

import type { SetupServer } from "msw/node";

/** Values nobody would pick by chance, to look for in an error message, a cause and the console. */
export const RECOGNISABLE_MU_KCAL = 2412.34;
export const RECOGNISABLE_PROTEIN_G = 143.717;

export const PROGRAM_ID = "66666666-6666-4666-8666-666666666666";
export const START_SNAPSHOT_ID = "88888888-8888-4888-8888-0000000000a1";
export const CHECKIN_SNAPSHOT_ID = "88888888-8888-4888-8888-0000000000a2";
export const TARGETS_ID = "99999999-9999-4999-8999-0000000000b1";

export type ProgramFakeRow = {
  id: string;
  goal: string;
  rate_pct_per_week: number;
  protein_g_per_kg: number;
  fat_fraction_of_remaining: number;
  split_preset: string;
  started_on: string;
  next_checkin_date: string | null;
  ended_on: string | null;
};

export type SnapshotFakeRow = {
  id: string;
  user_id: string;
  program_id: string | null;
  as_of_date: string;
  kind: string;
  mu_kcal: number;
  var_kcal2: number;
  measurement: unknown;
  trend_weight_kg: number | null;
  engine_version: string;
  params: unknown;
  created_at: string;
};

export type TargetsFakeRow = {
  id: string;
  user_id: string;
  program_id: string | null;
  expenditure_snapshot_id: string | null;
  effective_from: string;
  effective_to: string | null;
  calories_kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  dow_calories_kcal: number[];
  basis: unknown;
  engine_version: string;
  params: unknown;
  created_at: string;
};

const USER_ID = "11111111-1111-4111-8111-111111111111";

export const programRow = (overrides: Partial<ProgramFakeRow> = {}): ProgramFakeRow => ({
  id: PROGRAM_ID,
  goal: "lose",
  rate_pct_per_week: 0.5,
  protein_g_per_kg: 1.6,
  fat_fraction_of_remaining: 0.3,
  split_preset: "balanced",
  started_on: "2026-10-23",
  next_checkin_date: "2026-11-06",
  ended_on: null,
  ...overrides,
});

export const eligibleMeasurement = {
  eligible: true,
  zKcal: 2585,
  rKcal2: 62467.9,
  slopeKgPerDay: -0.05,
  seSlopeKg: 0.0198898,
  meanIntakeKcal: 2200,
  spanDays: 14,
  weighDays: 14,
  completeDays: 14,
  gain: 0.5,
  rawStepKcal: 312.5,
  stepKcal: 250,
  stepClamped: true,
};

export const ineligibleMeasurement = {
  eligible: false,
  reasons: ["complete_days"],
  spanDays: 14,
  weighDays: 14,
  completeDays: 9,
};

export const basisOf = (overrides: Record<string, unknown> = {}) => ({
  source: "checkin",
  tdeeKcal: 2640,
  trendWeightKg: 78.65,
  bmrKcal: 1755,
  goal: "lose",
  ratePctPerWeek: 0.5,
  effectiveRatePctPerWeek: 0.49,
  proteinGPerKg: 1.6,
  fatFraction: 0.3,
  dowOffsetsKcal: [0, 0, 0, 0, 0, 0, 0],
  clamps: [],
  ...overrides,
});

let rowCounter = 0;
const nextId = (prefix: string) => {
  rowCounter += 1;
  return `${prefix}-${rowCounter.toString(16).padStart(12, "0")}`;
};

/** A snapshot row as the table holds it, a check-in unless `kind` says otherwise. */
export const snapshotRow = (overrides: Partial<SnapshotFakeRow> = {}): SnapshotFakeRow => ({
  id: nextId("88888888-8888-4888-8888"),
  user_id: USER_ID,
  program_id: PROGRAM_ID,
  as_of_date: "2026-10-30",
  kind: "checkin",
  mu_kcal: 2400,
  var_kcal2: 10000,
  measurement: eligibleMeasurement,
  trend_weight_kg: 78.65,
  engine_version: "keylow-engine-v1",
  params: {},
  created_at: "2026-10-30T08:00:00+00:00",
  ...overrides,
});

export const startSnapshotRow = (overrides: Partial<SnapshotFakeRow> = {}): SnapshotFakeRow =>
  snapshotRow({
    as_of_date: "2026-10-23",
    kind: "start",
    mu_kcal: 2200,
    var_kcal2: 90000,
    measurement: null,
    created_at: "2026-10-23T09:00:00+00:00",
    ...overrides,
  });

/** A targets row as the table holds it, current unless `effective_to` is given. */
export const targetsRow = (overrides: Partial<TargetsFakeRow> = {}): TargetsFakeRow => ({
  id: nextId("99999999-9999-4999-8999"),
  user_id: USER_ID,
  program_id: PROGRAM_ID,
  expenditure_snapshot_id: null,
  effective_from: "2026-10-30",
  effective_to: null,
  calories_kcal: 2140,
  protein_g: 126,
  fat_g: 73,
  carbs_g: 245,
  dow_calories_kcal: [2140, 2140, 2140, 2140, 2140, 2140, 2140],
  basis: basisOf(),
  engine_version: "keylow-engine-v1",
  params: {},
  created_at: "2026-10-30T08:00:00+00:00",
  ...overrides,
});

type ProgramFake = {
  programs: ProgramFakeRow[];
  snapshots: SnapshotFakeRow[];
  targets: TargetsFakeRow[];
  timeZone: string | null;
};

export type ProgramTable = "programs" | "expenditure_snapshots" | "targets" | "profiles";

type RecordedRequest = { table: ProgramTable; url: URL };

const compare = (first: unknown, second: unknown): number => {
  if (typeof first === "number" && typeof second === "number") {
    return first - second;
  }
  return String(first).localeCompare(String(second));
};

const orderRows = <Row extends object>(rows: readonly Row[], url: URL): Row[] => {
  const clauses = (url.searchParams.get("order") ?? "").split(",").filter(Boolean);
  return [...rows].sort((first, second) => {
    for (const clause of clauses) {
      const [column = "", direction] = clause.split(".");
      const difference = compare(Reflect.get(first, column), Reflect.get(second, column));
      if (difference !== 0) {
        return direction === "desc" ? -difference : difference;
      }
    }
    return 0;
  });
};

const limitRows = <Row>(rows: readonly Row[], url: URL): Row[] => {
  const limit = Number(url.searchParams.get("limit") ?? Number.POSITIVE_INFINITY);
  return rows.slice(0, limit);
};

/** What PostgREST sends back for `select=a,b`: only those columns. */
const project = (rows: readonly object[], url: URL): object[] => {
  const columns = (url.searchParams.get("select") ?? "").split(",").filter(Boolean);
  return rows.map((row) =>
    Object.fromEntries(columns.map((column) => [column, Reflect.get(row, column)])),
  );
};

/** One clause of an `or=(...)` filter: `effective_to.is.null` or `effective_to.gt.2026-10-16`. */
const clauseHolds = (row: object, clause: string): boolean => {
  const [column = "", operator, value] = clause.split(".");
  const stored: unknown = Reflect.get(row, column);
  if (operator === "is" && value === "null") {
    return stored === null;
  }
  if (operator === "gt") {
    return stored !== null && compare(stored, value) > 0;
  }
  if (operator === "gte") {
    return stored !== null && compare(stored, value) >= 0;
  }
  throw new Error(`The program fake does not read the filter ${operator ?? ""}`);
};

/**
 * A stand-in for the tables the program reads touch, behind MSW. It honours the filters the reads are
 * meant to send and no others: `ended_on is null` on programs, `as_of_date >= x` on snapshots, the
 * `or=(effective_to.is.null,effective_to.gt.x)` range of the targets history, and the `order`, `limit`
 * and `select` of each read. A read that leaves one out gets rows it should not, or columns it did not
 * ask for, so a test sees it. `failWith` makes a table fail with a code and a message that quotes a value.
 */
export function installProgramFake(server: SetupServer, fake: Partial<ProgramFake> = {}) {
  const tables: ProgramFake = {
    programs: [],
    snapshots: [],
    targets: [],
    timeZone: "Europe/London",
    ...fake,
  };
  const requests: RecordedRequest[] = [];
  const failures = new Map<ProgramTable, string>();

  const answer = (table: ProgramTable, request: Request, rows: readonly object[]) => {
    const url = new URL(request.url);
    requests.push({ table, url });
    const code = failures.get(table);
    return code === undefined
      ? postgrestRows(request, project(rows, url))
      : postgrestError(500, code, `a value of ${RECOGNISABLE_MU_KCAL} was refused`);
  };

  server.use(
    http.get(`${REST_URL}/profiles`, ({ request }) =>
      answer("profiles", request, tables.timeZone === null ? [] : [{ timezone: tables.timeZone }]),
    ),
    http.get(`${REST_URL}/programs`, ({ request }) => {
      const url = new URL(request.url);
      const activeOnly = url.searchParams.get("ended_on") === "is.null";
      return answer(
        "programs",
        request,
        tables.programs.filter((row) => !activeOnly || row.ended_on === null),
      );
    }),
    http.get(`${REST_URL}/expenditure_snapshots`, ({ request }) => {
      const url = new URL(request.url);
      const from = url.searchParams.get("as_of_date")?.replace(/^gte\./, "");
      const inRange = tables.snapshots.filter(
        (row) => from === undefined || compare(row.as_of_date, from) >= 0,
      );
      return answer("expenditure_snapshots", request, limitRows(orderRows(inRange, url), url));
    }),
    http.get(`${REST_URL}/targets`, ({ request }) => {
      const url = new URL(request.url);
      const either = url.searchParams.get("or")?.replace(/^\(/, "").replace(/\)$/, "");
      const inRange = tables.targets.filter(
        (row) =>
          either === undefined || either.split(",").some((clause) => clauseHolds(row, clause)),
      );
      return answer("targets", request, limitRows(orderRows(inRange, url), url));
    }),
  );

  return {
    requests,
    requestsTo: (table: ProgramTable) => requests.filter((request) => request.table === table),
    failWith: (table: ProgramTable, code: string) => failures.set(table, code),
    /** Lets the table answer again, as a connection that came back does. */
    recover: (table: ProgramTable) => failures.delete(table),
  };
}
