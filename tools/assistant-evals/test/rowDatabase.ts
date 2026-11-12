import { fakeDatabase } from "./helpers.ts";

import type { EvalDatabase, RowQuery } from "../src/types.ts";

type Row = Readonly<Record<string, unknown>>;

/**
 * An `EvalDatabase` whose tables hold the rows it was given, so a count or a read depends on the filters as
 * the real one does. It records the queries it was asked.
 */
export function rowDatabase(tables: Readonly<Record<string, readonly Row[]>>): EvalDatabase & {
  queries: RowQuery[];
} {
  const queries: RowQuery[] = [];
  const matching = ({ table, where }: RowQuery): readonly Row[] => {
    queries.push({ table, where });
    return (tables[table] ?? []).filter((row) =>
      Object.entries(where).every(([column, value]) => row[column] === value),
    );
  };
  return {
    ...fakeDatabase(),
    queries,
    countRows: (query) => Promise.resolve(matching(query).length),
    readRows: (query) => Promise.resolve(matching(query)),
  };
}
