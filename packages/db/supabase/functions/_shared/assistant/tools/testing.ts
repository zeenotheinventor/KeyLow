// Stand-ins for the food read tools' tests: a caller client that answers from rows kept in memory and
// records what was asked of it. Nothing in production imports this.
import type { Database } from "../../core/database.types.ts";
import type { ExecutionResult } from "../executor.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;

export type RecordedCall = { table: string | null; method: string; args: unknown[] };

export type StubCaller = { caller: SupabaseClient<Database>; calls: RecordedCall[] };

export type StubData = {
  // The rows each RPC answers with, by function name.
  rpc?: Record<string, Row[]>;
  // The rows of each table. `eq`, `neq`, `in`, `is`, `gte`, `lte` and `lt` filter them and `limit` and `range`
  // cut them, as the database would. `eq`, `in` and `is` do not model a filter on an embedded table
  // (`exercise_muscles.role`), while `neq`, `gte`, `lte` and `lt` read an embedded object by its path
  // (`workout_sessions.local_date`). `order` does nothing, so a table is listed in the order its read should
  // answer in.
  tables?: Record<string, Row[]>;
  // The rows a table answers from its second read on, for a row that was there at the first read and
  // gone at the next, such as a session deleted between a list and its detail. A table named here that
  // is not in `tables` answers nothing at its first read.
  laterTables?: Record<string, Row[]>;
  // The tables whose reads fail with this database error code, as a request the database refused.
  failingTables?: Record<string, string>;
};

const isRow = (value: unknown): value is Row =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// A column of a row, reading `workout_sessions.local_date` out of the object embedded under `workout_sessions`.
const valueAt = (row: Row, column: string): unknown =>
  column.split(".").reduce<unknown>((value, key) => (isRow(value) ? value[key] : undefined), row);

export function stubCaller(data: StubData = {}): StubCaller {
  const calls: RecordedCall[] = [];

  function queryOver(table: string, rows: Row[]) {
    let remaining = rows;
    const failure = data.failingTables?.[table];
    const record = (method: string, args: unknown[]) => calls.push({ table, method, args });
    const recorded =
      (method: string) =>
      (...args: unknown[]) => {
        record(method, args);
        return query;
      };
    const query = {
      select: recorded("select"),
      ilike: recorded("ilike"),
      order: recorded("order"),
      eq(column: string, value: unknown) {
        record("eq", [column, value]);
        remaining = remaining.filter((row) => row[column] === value);
        return query;
      },
      neq(column: string, value: unknown) {
        record("neq", [column, value]);
        remaining = remaining.filter((row) => valueAt(row, column) !== value);
        return query;
      },
      in(column: string, values: unknown[]) {
        record("in", [column, values]);
        if (!column.includes(".")) {
          remaining = remaining.filter((row) => values.includes(row[column]));
        }
        return query;
      },
      // A column that is absent is null, as a row of the database would say.
      is(column: string, value: unknown) {
        record("is", [column, value]);
        remaining = remaining.filter((row) => (row[column] ?? null) === value);
        return query;
      },
      // Dates are `YYYY-MM-DD` text, which orders the same as the dates do.
      gte(column: string, value: string) {
        record("gte", [column, value]);
        remaining = remaining.filter((row) => String(valueAt(row, column)) >= value);
        return query;
      },
      lte(column: string, value: string) {
        record("lte", [column, value]);
        remaining = remaining.filter((row) => String(valueAt(row, column)) <= value);
        return query;
      },
      lt(column: string, value: string) {
        record("lt", [column, value]);
        remaining = remaining.filter((row) => String(valueAt(row, column)) < value);
        return query;
      },
      limit(count: number) {
        record("limit", [count]);
        remaining = remaining.slice(0, count);
        return query;
      },
      // Both ends included, as PostgREST reads them.
      range(first: number, last: number) {
        record("range", [first, last]);
        remaining = remaining.slice(first, last + 1);
        return query;
      },
      maybeSingle() {
        record("maybeSingle", []);
        return Promise.resolve(
          failure === undefined
            ? { data: remaining[0] ?? null, error: null }
            : { data: null, error: { code: failure } },
        );
      },
      // The repos await the builder itself, as the real client allows.
      then: (resolve: (answer: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(
          failure === undefined
            ? { data: remaining, error: null }
            : { data: null, error: { code: failure } },
        ).then(resolve, reject),
    };
    return query;
  }

  const readsOfTable = new Map<string, number>();
  const rowsToRead = (table: string): Row[] => {
    const reads = (readsOfTable.get(table) ?? 0) + 1;
    readsOfTable.set(table, reads);
    const later = data.laterTables?.[table];
    return (reads > 1 && later !== undefined ? later : data.tables?.[table]) ?? [];
  };

  const client = {
    from: (table: string) => queryOver(table, rowsToRead(table)),
    rpc(name: string, args: unknown) {
      calls.push({ table: null, method: `rpc:${name}`, args: [args] });
      return Promise.resolve({ data: data.rpc?.[name] ?? [], error: null });
    },
  };
  // The repos only call the methods above. The stub cannot satisfy the whole client type.
  return { caller: client as unknown as SupabaseClient<Database>, calls };
}

// What the model would read out of a result's wrapper.
export function payloadOf(result: ExecutionResult): unknown {
  const match = /^<untrusted_data source="[a-z0-9_]+">(.*)<\/untrusted_data>$/s.exec(result.text);
  if (match === null || match[1] === undefined) {
    throw new Error("Not a wrapped result");
  }
  return JSON.parse(match[1]);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// The list under one key of the payload the model would read, each item an object.
export function listOf(result: ExecutionResult, key: string): Record<string, unknown>[] {
  const payload = payloadOf(result);
  const list = isRecord(payload) ? payload[key] : undefined;
  if (!Array.isArray(list)) {
    throw new Error(`No list under ${key}`);
  }
  return list.filter(isRecord);
}
