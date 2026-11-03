// A caller client with the writes of the diary tables kept in memory, for the write tools' tests. It
// answers what the repos ask of PostgREST (select, insert, update, eq, in, is, single, maybeSingle),
// fills in what the database fills in (the id, `created_at`, the generated `kcal`, and an `updated_at`
// stamped once per statement, as the trigger does) and hides the rows of another user, as row level
// security does. Nothing in production imports this.
import type { Database } from "../../core/database.types.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;

export type WriteCall = { table: string; method: string; patch?: Row };

export type WriteStub = {
  caller: SupabaseClient<Database>;
  tables: Record<string, Row[]>;
  calls: WriteCall[];
  // The next statement that writes to this table fails, once.
  failNextWriteTo(table: string): void;
  // The next read of this table fails, once.
  failNextReadFrom(table: string): void;
  // Runs once, just before the next write to this table, as another request could between two steps.
  beforeNextWriteTo(table: string, change: () => void): void;
};

const stampOf = (statement: number) =>
  `2026-11-03T09:00:${String(statement).padStart(2, "0")}.000000+00:00`;

export function writeStub(
  initial: Record<string, Row[]> = {},
  options: { callerUserId?: string } = {},
): WriteStub {
  const tables: Record<string, Row[]> = Object.fromEntries(
    Object.entries(initial).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))]),
  );
  const calls: WriteCall[] = [];
  const failing = new Set<string>();
  const failingReads = new Set<string>();
  const beforeWrite = new Map<string, () => void>();
  let statement = 0;
  let nextId = 1;

  const visible = (row: Row) =>
    options.callerUserId === undefined ||
    row["user_id"] === undefined ||
    row["user_id"] === options.callerUserId;

  const project = (row: Row, columns: string): Row =>
    columns === "*"
      ? { ...row }
      : Object.fromEntries(
          columns
            .split(",")
            .map((column) => column.trim())
            .filter((column) => column in row)
            .map((column) => [column, row[column]]),
        );

  function queryOver(table: string) {
    const filters: ((row: Row) => boolean)[] = [(row) => visible(row)];
    let operation: "select" | "insert" | "update" = "select";
    let columns = "*";
    let returning = false;
    let payload: Row[] = [];
    let patch: Row = {};
    let wantsOne: "single" | "maybeSingle" | null = null;

    const run = (): { data: unknown; error: { code: string; message: string } | null } => {
      calls.push({ table, method: operation, ...(operation === "update" ? { patch } : {}) });
      if (operation === "select" && failingReads.delete(table)) {
        return { data: null, error: { code: "XX000", message: "unavailable" } };
      }
      if (operation !== "select") {
        beforeWrite.get(table)?.();
        beforeWrite.delete(table);
      }
      if (operation !== "select" && failing.delete(table)) {
        return { data: null, error: { code: "XX000", message: "unavailable" } };
      }
      const rows = (tables[table] ??= []);
      let affected: Row[];
      if (operation === "insert") {
        statement += 1;
        affected = payload.map((row) => {
          const inserted: Row = {
            id: `00000000-0000-4000-8000-0000000b${String(nextId++).padStart(4, "0")}`,
            created_at: stampOf(statement),
            updated_at: stampOf(statement),
            deleted_at: null,
            user_id: options.callerUserId,
            ...row,
            kcal: (row["nutrients"] as { kcal?: number } | undefined)?.kcal ?? null,
          };
          rows.push(inserted);
          return inserted;
        });
      } else if (operation === "update") {
        statement += 1;
        affected = rows.filter((row) => filters.every((filter) => filter(row)));
        affected.forEach((row) => Object.assign(row, patch, { updated_at: stampOf(statement) }));
      } else {
        affected = rows.filter((row) => filters.every((filter) => filter(row)));
      }
      if (operation !== "select" && !returning) {
        return { data: null, error: null };
      }
      const projected = affected.map((row) => project(row, columns));
      if (wantsOne === null) {
        return { data: projected, error: null };
      }
      if (projected.length === 1 || (wantsOne === "maybeSingle" && projected.length === 0)) {
        return { data: projected[0] ?? null, error: null };
      }
      return { data: null, error: { code: "PGRST116", message: "no single row" } };
    };

    const query = {
      select(selected: string) {
        columns = selected;
        returning = true;
        return query;
      },
      insert(rows: Row | Row[]) {
        operation = "insert";
        payload = Array.isArray(rows) ? rows : [rows];
        return query;
      },
      update(values: Row) {
        operation = "update";
        patch = values;
        return query;
      },
      eq(column: string, value: unknown) {
        filters.push((row) => row[column] === value);
        return query;
      },
      in(column: string, values: unknown[]) {
        filters.push((row) => values.includes(row[column]));
        return query;
      },
      is(column: string, value: unknown) {
        filters.push((row) => (row[column] ?? null) === value);
        return query;
      },
      order: () => query,
      limit: () => query,
      single() {
        wantsOne = "single";
        return query;
      },
      maybeSingle() {
        wantsOne = "maybeSingle";
        return query;
      },
      then: (resolve: (answer: unknown) => unknown, reject: (reason: unknown) => unknown) =>
        Promise.resolve(run()).then(resolve, reject),
    };
    return query;
  }

  const client = { from: (table: string) => queryOver(table) };
  return {
    // The repos only call the methods above. The stub cannot satisfy the whole client type.
    caller: client as unknown as SupabaseClient<Database>,
    tables,
    calls,
    failNextWriteTo: (table) => {
      failing.add(table);
    },
    failNextReadFrom: (table) => {
      failingReads.add(table);
    },
    beforeNextWriteTo: (table, change) => {
      beforeWrite.set(table, change);
    },
  };
}
