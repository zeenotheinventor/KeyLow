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
  // The rows of each table. `eq` filters them and `limit` cuts them, as the database would.
  tables?: Record<string, Row[]>;
};

export function stubCaller(data: StubData = {}): StubCaller {
  const calls: RecordedCall[] = [];

  function queryOver(table: string, rows: Row[]) {
    let remaining = rows;
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
      limit(count: number) {
        record("limit", [count]);
        remaining = remaining.slice(0, count);
        return query;
      },
      maybeSingle() {
        record("maybeSingle", []);
        return Promise.resolve({ data: remaining[0] ?? null, error: null });
      },
      // The repos await the builder itself, as the real client allows.
      then: (resolve: (answer: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve({ data: remaining, error: null }).then(resolve, reject),
    };
    return query;
  }

  const client = {
    from: (table: string) => queryOver(table, data.tables?.[table] ?? []),
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
