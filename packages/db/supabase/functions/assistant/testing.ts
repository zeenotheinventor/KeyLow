// An in-memory stand-in for the service client, for the turn store and the usage recorder tests. It
// keeps the rows of each table, answers the filters the stores use, enforces the unique key on
// `assistant_messages (conversation_id, seq)`, and records every query so a test can read back what was
// asked. Nothing in production imports this.
import type { Database } from "../_shared/core/database.types.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Row = Record<string, unknown>;

export type Operation = {
  table: string;
  kind: "select" | "insert" | "update";
  values: Row | Row[] | null;
  // Equality filters by column. Other comparisons are keyed `column<`, `column>` and `column!=`.
  filters: Record<string, unknown>;
  columns: string | null;
  range: [from: number, to: number] | null;
  // The builder methods called, in order, so a test can see that `select` was never chained.
  chain: string[];
};

export type FakeError = { code: string; message?: string };

type Failure = {
  table: string;
  kind: Operation["kind"];
  error: FakeError;
  times?: number;
  // How many matching calls succeed before the failure starts.
  skip?: number;
};

export type FakeOptions = {
  now?: Date;
  tables?: Record<string, Row[]>;
  failures?: Failure[];
  // Another writer's message, stored right after the first read of `assistant_messages`, which is the
  // gap between reading the last `seq` and inserting after it.
  competingMessage?: Row;
  // Another writer's turn, stored right after the first read of `assistant_turns`, which is the gap
  // between the busy check and the insert of the new turn.
  competingTurn?: Row;
};

export const seqKeyViolation: FakeError = {
  code: "23505",
  message:
    'duplicate key value violates unique constraint "assistant_messages_conversation_id_seq_key"',
};

const compare = (left: unknown, right: unknown): number =>
  typeof left === "number" && typeof right === "number"
    ? left - right
    : String(left) < String(right)
      ? -1
      : String(left) > String(right)
        ? 1
        : 0;

export function fakeSupabase(options: FakeOptions = {}) {
  const now = options.now ?? new Date("2026-11-03T12:00:00.000Z");
  const tables: Record<string, Row[]> = {};
  for (const [name, rows] of Object.entries(options.tables ?? {})) {
    tables[name] = rows.map((row) => ({ ...row }));
  }
  const failures = (options.failures ?? []).map((failure) => ({ ...failure }));
  const operations: Operation[] = [];
  const competing: Record<string, Row | undefined> = {
    assistant_messages: options.competingMessage,
    assistant_turns: options.competingTurn,
  };

  const rowsOf = (table: string): Row[] => (tables[table] ??= []);

  const defaults = (table: string): Row => {
    const base: Row = { id: crypto.randomUUID(), created_at: now.toISOString() };
    if (table === "assistant_turns") {
      return { ...base, status: "open", finished_at: null, pending_confirmation: null };
    }
    if (table === "assistant_messages") {
      return { ...base, display: null };
    }
    return base;
  };

  const from = (table: string) => {
    const operation: Operation = {
      table,
      kind: "select",
      values: null,
      filters: {},
      columns: null,
      range: null,
      chain: [],
    };
    operations.push(operation);
    const predicates: ((row: Row) => boolean)[] = [];
    const orderBy: { column: string; ascending: boolean }[] = [];
    let limitCount: number | null = null;

    const injected = (): FakeError | null => {
      const failure = failures.find(
        (candidate) =>
          candidate.table === table && candidate.kind === operation.kind && candidate.times !== 0,
      );
      if (failure === undefined) {
        return null;
      }
      if (failure.skip !== undefined && failure.skip > 0) {
        failure.skip -= 1;
        return null;
      }
      if (failure.times !== undefined) {
        failure.times -= 1;
      }
      return failure.error;
    };

    const project = (row: Row): Row => {
      if (operation.columns === null || operation.columns === "*") {
        return row;
      }
      const names = operation.columns.split(",").map((name) => name.trim());
      return Object.fromEntries(names.map((name) => [name, row[name]]));
    };

    const run = (): { data: Row[] | null; error: FakeError | null } => {
      const error = injected();
      if (error !== null) {
        return { data: null, error };
      }
      if (operation.kind === "insert") {
        const batch = Array.isArray(operation.values) ? operation.values : [operation.values ?? {}];
        if (table === "assistant_messages") {
          const taken = new Set(
            rowsOf(table).map((row) => `${String(row["conversation_id"])}:${String(row["seq"])}`),
          );
          for (const row of batch) {
            const key = `${String(row["conversation_id"])}:${String(row["seq"])}`;
            if (taken.has(key)) {
              return { data: null, error: seqKeyViolation };
            }
            taken.add(key);
          }
        }
        const stored = batch.map((row) => ({ ...defaults(table), ...row }));
        rowsOf(table).push(...stored);
        return { data: stored.map(project), error: null };
      }
      const matching = rowsOf(table).filter((row) => predicates.every((test) => test(row)));
      if (operation.kind === "update") {
        for (const row of matching) {
          Object.assign(row, operation.values);
        }
        return { data: matching.map(project), error: null };
      }
      matching.sort((left, right) => {
        for (const { column, ascending } of orderBy) {
          const order = compare(left[column], right[column]);
          if (order !== 0) {
            return ascending ? order : -order;
          }
        }
        return 0;
      });
      const ranged = operation.range
        ? matching.slice(operation.range[0], operation.range[1] + 1)
        : matching;
      const limited = limitCount === null ? ranged : ranged.slice(0, limitCount);
      const other = competing[table];
      if (other !== undefined) {
        rowsOf(table).push({ ...defaults(table), ...other });
        competing[table] = undefined;
      }
      return { data: limited.map(project), error: null };
    };

    const first = () => {
      const { data, error } = run();
      return { data: data?.[0] ?? null, error };
    };

    const filter = (name: string, column: string, test: (value: unknown) => boolean) => {
      operation.chain.push(name);
      predicates.push((row) => test(row[column]));
    };

    const builder = {
      insert(values: Row | Row[]) {
        operation.chain.push("insert");
        operation.kind = "insert";
        operation.values = values;
        return builder;
      },
      update(values: Row) {
        operation.chain.push("update");
        operation.kind = "update";
        operation.values = values;
        return builder;
      },
      select(columns?: string) {
        operation.chain.push("select");
        operation.columns = columns ?? "*";
        return builder;
      },
      eq(column: string, value: unknown) {
        filter("eq", column, (actual) => actual === value);
        operation.filters[column] = value;
        return builder;
      },
      neq(column: string, value: unknown) {
        filter("neq", column, (actual) => actual !== value);
        operation.filters[`${column}!=`] = value;
        return builder;
      },
      lt(column: string, value: string) {
        filter("lt", column, (actual) => String(actual) < value);
        operation.filters[`${column}<`] = value;
        return builder;
      },
      order(column: string, config?: { ascending?: boolean }) {
        operation.chain.push("order");
        orderBy.push({ column, ascending: config?.ascending ?? true });
        return builder;
      },
      limit(count: number) {
        operation.chain.push("limit");
        limitCount = count;
        return builder;
      },
      range(rangeFrom: number, rangeTo: number) {
        operation.chain.push("range");
        operation.range = [rangeFrom, rangeTo];
        return builder;
      },
      single: () => Promise.resolve(first()),
      maybeSingle: () => Promise.resolve(first()),
      then: (resolve: (value: ReturnType<typeof run>) => unknown) => resolve(run()),
    };
    return builder;
  };

  // The fake answers only the calls the stores make, so it stands in for the whole client type.
  const client = { from } as unknown as SupabaseClient<Database>;
  return { client, operations, tables };
}
