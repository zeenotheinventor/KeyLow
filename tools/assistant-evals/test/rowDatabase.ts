import { fakeDatabase } from "./helpers.ts";

import type { EvalDatabase, RowQuery } from "../src/types.ts";

type Row = Readonly<Record<string, string | number | boolean | null>>;

/**
 * An `EvalDatabase` whose tables hold the rows it was given, so a count depends on the filters as the real
 * one does. It records the queries it was asked.
 */
export function rowDatabase(tables: Readonly<Record<string, readonly Row[]>>): EvalDatabase & {
  queries: RowQuery[];
} {
  const queries: RowQuery[] = [];
  return {
    ...fakeDatabase(),
    queries,
    countRows: ({ table, where }) => {
      queries.push({ table, where });
      const rows = tables[table] ?? [];
      return Promise.resolve(
        rows.filter((row) =>
          Object.entries(where).every(([column, value]) => row[column] === value),
        ).length,
      );
    },
  };
}
