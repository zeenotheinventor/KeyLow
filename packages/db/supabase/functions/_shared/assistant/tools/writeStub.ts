// A caller client with the writes of the diary tables kept in memory, for the write tools' tests. It
// answers what the repos ask of PostgREST (select, insert, update, eq, in, is, single, maybeSingle),
// fills in what the database fills in (the id, `created_at`, the generated `kcal`, and an `updated_at`
// stamped once per statement, as the trigger does) and hides the rows of another user, as row level
// security does. A select may embed the rows a row holds under the name of the embedded table
// (`recipe_ingredients(position,food_id)`) or as an object (`routine_days(name)`), and an RPC is answered by the handler a test passes in.
// Nothing in production imports this.
import type { Database } from "../../core/database.types.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

type Row = Record<string, unknown>;

export type WriteCall = { table: string; method: string; patch?: Row };

// What a test stands in for a database function with. It gets the arguments and the tables, and answers as
// the client does.
export type RpcHandler = (
  args: Record<string, unknown>,
  tables: Record<string, Row[]>,
) => { data: unknown; error: { code: string; message: string } | null };

export type WriteStub = {
  caller: SupabaseClient<Database>;
  tables: Record<string, Row[]>;
  calls: WriteCall[];
  // The next statement that writes to this table fails, `times` times in a row (once by default).
  // `afterWrites` lets that many writes to the table land first, for a failure part way through a run.
  failNextWriteTo(table: string, afterWrites?: number, times?: number): void;
  // The next read of this table fails, once. `afterReads` lets that many reads of the table answer first.
  failNextReadFrom(table: string, afterReads?: number): void;
  // Runs once, just before the next write to this table, as another request could between two steps.
  beforeNextWriteTo(table: string, change: () => void): void;
};

const stampOf = (statement: number) =>
  `2026-11-03T09:00:${String(statement).padStart(2, "0")}.000000+00:00`;

// Postgres `@>`: an array holds every item the other does, an object every key, and anything else is equal.
const jsonContains = (whole: unknown, part: unknown): boolean => {
  if (Array.isArray(part)) {
    return (
      Array.isArray(whole) && part.every((item) => whole.some((held) => jsonContains(held, item)))
    );
  }
  if (typeof part === "object" && part !== null) {
    return (
      typeof whole === "object" &&
      whole !== null &&
      Object.entries(part).every(([key, item]) => jsonContains(Reflect.get(whole, key), item))
    );
  }
  return whole === part;
};

export function writeStub(
  initial: Record<string, Row[]> = {},
  options: {
    callerUserId?: string;
    rpc?: Record<string, RpcHandler>;
    // The columns a table fills in on insert beyond the ones the stub knows (`source_ref` on a food).
    insertDefaults?: Record<string, Row>;
  } = {},
): WriteStub {
  const tables: Record<string, Row[]> = Object.fromEntries(
    Object.entries(initial).map(([table, rows]) => [table, rows.map((row) => ({ ...row }))]),
  );
  const calls: WriteCall[] = [];
  const failing = new Map<string, { afterWrites: number; times: number }>();
  const failingReads = new Map<string, number>();
  const beforeWrite = new Map<string, () => void>();
  let statement = 0;
  let nextId = 1;

  // A table keeps its rows under the column that names their owner.
  const ownerColumnOf = (table: string) =>
    table === "recipes" || table === "recipe_ingredients" || table === "exercises"
      ? "owner_id"
      : "user_id";

  // The library's exercises have no owner and everyone sees them, as the select policy of `exercises` says.
  const visible = (table: string, row: Row) =>
    options.callerUserId === undefined ||
    row[ownerColumnOf(table)] === undefined ||
    row[ownerColumnOf(table)] === options.callerUserId ||
    (table === "exercises" && row["owner_id"] === null);

  // The commas that are not inside the brackets of an embedded table.
  const topLevelColumns = (columns: string): string[] => {
    const found: string[] = [];
    let depth = 0;
    let start = 0;
    for (let index = 0; index < columns.length; index += 1) {
      const character = columns[index];
      depth += character === "(" ? 1 : character === ")" ? -1 : 0;
      if (character === "," && depth === 0) {
        found.push(columns.slice(start, index).trim());
        start = index + 1;
      }
    }
    return [...found, columns.slice(start).trim()];
  };

  const project = (row: Row, columns: string): Row =>
    columns === "*"
      ? { ...row }
      : Object.fromEntries(
          topLevelColumns(columns).flatMap((column) => {
            const embedded = /^(\w+)\((.*)\)$/s.exec(column);
            if (embedded?.[1] === undefined || embedded[2] === undefined) {
              return column in row ? [[column, row[column]]] : [];
            }
            const inner = row[embedded[1]];
            if (Array.isArray(inner)) {
              return [[embedded[1], inner.map((item: Row) => project(item, embedded[2] ?? "*"))]];
            }
            // A row that belongs to one other row (a session's routine day) is embedded as an object.
            return typeof inner === "object" && inner !== null
              ? [[embedded[1], project(inner as Row, embedded[2] ?? "*")]]
              : [];
          }),
        );

  function queryOver(table: string) {
    const filters: ((row: Row) => boolean)[] = [(row) => visible(table, row)];
    let operation: "select" | "insert" | "update" = "select";
    let columns = "*";
    let returning = false;
    let payload: Row[] = [];
    let patch: Row = {};
    let wantsOne: "single" | "maybeSingle" | null = null;
    let rowLimit = Number.POSITIVE_INFINITY;

    const run = (): { data: unknown; error: { code: string; message: string } | null } => {
      calls.push({ table, method: operation, ...(operation === "update" ? { patch } : {}) });
      if (operation === "select" && failingReads.has(table)) {
        const readsToLetAnswer = failingReads.get(table) ?? 0;
        if (readsToLetAnswer === 0) {
          failingReads.delete(table);
          return { data: null, error: { code: "XX000", message: "unavailable" } };
        }
        failingReads.set(table, readsToLetAnswer - 1);
      }
      if (operation !== "select") {
        beforeWrite.get(table)?.();
        beforeWrite.delete(table);
      }
      if (operation !== "select" && failing.has(table)) {
        const plan = failing.get(table) ?? { afterWrites: 0, times: 1 };
        if (plan.afterWrites === 0) {
          if (plan.times <= 1) {
            failing.delete(table);
          } else {
            failing.set(table, { afterWrites: 0, times: plan.times - 1 });
          }
          return { data: null, error: { code: "XX000", message: "unavailable" } };
        }
        failing.set(table, { ...plan, afterWrites: plan.afterWrites - 1 });
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
            ...(table === "day_logs" ? { note: null } : {}),
            ...(options.insertDefaults?.[table] ?? {}),
            user_id: options.callerUserId,
            ...row,
            ...("nutrients" in row
              ? { kcal: (row["nutrients"] as { kcal?: number } | undefined)?.kcal ?? null }
              : {}),
          };
          rows.push(inserted);
          return inserted;
        });
      } else if (operation === "update") {
        statement += 1;
        affected = rows.filter((row) => filters.every((filter) => filter(row)));
        // A stamp the caller writes itself (a program's `updated_at`) wins over the one the database would give.
        affected.forEach((row) => Object.assign(row, { updated_at: stampOf(statement) }, patch));
      } else {
        affected = rows.filter((row) => filters.every((filter) => filter(row))).slice(0, rowLimit);
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
      // The jsonb containment as the client sends it: a JSON string. An array or an object operand is turned
      // into a Postgres array literal by the client, which a real server refuses, so it fails here too.
      contains(column: string, value: unknown) {
        if (typeof value !== "string") {
          throw new TypeError("contains takes the JSON as a string, as the client sends it");
        }
        const part: unknown = JSON.parse(value);
        filters.push((row) => jsonContains(row[column], part));
        return query;
      },
      gte(column: string, value: unknown) {
        filters.push((row) => String(row[column] ?? "") >= String(value));
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
      // Only `.not(column, "is", null)`, the one form the repos use.
      not(column: string, _operator: string, value: unknown) {
        filters.push((row) => (row[column] ?? null) !== value);
        return query;
      },
      order: () => query,
      // `order` does nothing, so a table is listed in the order its read should answer in.
      limit(count: number) {
        rowLimit = count;
        return query;
      },
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

  const client = {
    from: (table: string) => queryOver(table),
    rpc(name: string, args: Record<string, unknown>) {
      calls.push({ table: `rpc:${name}`, method: "rpc" });
      const handler = options.rpc?.[name];
      return Promise.resolve(
        handler === undefined
          ? { data: null, error: { code: "42883", message: "no such function" } }
          : handler(args, tables),
      );
    },
  };
  return {
    // The repos only call the methods above. The stub cannot satisfy the whole client type.
    caller: client as unknown as SupabaseClient<Database>,
    tables,
    calls,
    failNextWriteTo: (table, afterWrites = 0, times = 1) => {
      failing.set(table, { afterWrites, times });
    },
    failNextReadFrom: (table, afterReads = 0) => {
      failingReads.set(table, afterReads);
    },
    beforeNextWriteTo: (table, change) => {
      beforeWrite.set(table, change);
    },
  };
}
