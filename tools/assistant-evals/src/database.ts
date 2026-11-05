import type { EvalDatabase, RowQuery, TurnUsage } from "./types.ts";
import type { Database } from "@keylow/api-client";
import type { SupabaseClient } from "@supabase/supabase-js";

// An error here names the action and the database's error code, never its message or a row, as in the
// api-client repos.

const USAGE_COLUMNS =
  "input_tokens,output_tokens,cache_read_input_tokens,cache_creation_input_tokens,cost_usd_micros";

type UsageRow = Readonly<{
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
  cost_usd_micros: number;
}>;

const usageOfRow = (row: UsageRow): TurnUsage => ({
  inputTokens: row.input_tokens,
  outputTokens: row.output_tokens,
  cacheReadInputTokens: row.cache_read_input_tokens,
  cacheCreationInputTokens: row.cache_creation_input_tokens,
  costUsdMicros: row.cost_usd_micros,
});

const sumOfUsage = (rows: readonly UsageRow[]): TurnUsage =>
  rows.map(usageOfRow).reduce<TurnUsage>(
    (total, usage) => ({
      inputTokens: total.inputTokens + usage.inputTokens,
      outputTokens: total.outputTokens + usage.outputTokens,
      cacheReadInputTokens: total.cacheReadInputTokens + usage.cacheReadInputTokens,
      cacheCreationInputTokens: total.cacheCreationInputTokens + usage.cacheCreationInputTokens,
      costUsdMicros: total.costUsdMicros + usage.costUsdMicros,
    }),
    {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadInputTokens: 0,
      cacheCreationInputTokens: 0,
      costUsdMicros: 0,
    },
  );

const unreadable = (code: string) => new Error(`Could not read assistant_usage (${code})`);

/**
 * An `EvalDatabase` that reads as the person the client is signed in as, so row-level security scopes every
 * count and every usage row to the eval user. The service role cannot read `assistant_usage` at all.
 */
export function createEvalDatabase(client: SupabaseClient<Database>): EvalDatabase {
  return {
    countRows: async ({ table, where }: RowQuery) => {
      let query = client.from(table).select("*", { count: "exact", head: true });
      for (const [column, value] of Object.entries(where)) {
        query = value === null ? query.is(column, null) : query.eq(column, value);
      }
      const { count, error } = await query;
      if (error) {
        throw new Error(`Could not count the rows of ${table} (${error.code})`);
      }
      return count ?? 0;
    },

    readRows: async ({ table, where }: RowQuery) => {
      let query = client.from(table).select("*");
      for (const [column, value] of Object.entries(where)) {
        query = value === null ? query.is(column, null) : query.eq(column, value);
      }
      const { data, error } = await query;
      if (error) {
        throw new Error(`Could not read the rows of ${table} (${error.code})`);
      }
      return data;
    },

    usageOfTurn: async (turnId) => {
      const { data, error } = await client
        .from("assistant_usage")
        .select(USAGE_COLUMNS)
        .eq("turn_id", turnId);
      if (error) {
        throw unreadable(error.code);
      }
      return sumOfUsage(data);
    },

    // The eval user is new for the run, so the total of its days is the run's. This reads the daily view and
    // not the table, because the stack caps one select at 1000 rows and a run can make more model calls than
    // that, which would undercount the spend without an error. The view has one row per UTC day for the
    // caller (security invoker, so row-level security applies) and its sums cover every route. A run that
    // crosses midnight UTC reads two rows.
    usageOfUser: async () => {
      const { data, error } = await client.from("assistant_usage_daily").select(USAGE_COLUMNS);
      if (error) {
        throw unreadable(error.code);
      }
      return sumOfUsage(
        data.map((day) => ({
          input_tokens: day.input_tokens ?? 0,
          output_tokens: day.output_tokens ?? 0,
          cache_read_input_tokens: day.cache_read_input_tokens ?? 0,
          cache_creation_input_tokens: day.cache_creation_input_tokens ?? 0,
          cost_usd_micros: day.cost_usd_micros ?? 0,
        })),
      );
    },

    firstModelCallOfTurn: async (turnId) => {
      const { data, error } = await client
        .from("assistant_usage")
        .select(USAGE_COLUMNS)
        .eq("turn_id", turnId)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(1);
      if (error) {
        throw unreadable(error.code);
      }
      const [first] = data;
      return first === undefined ? null : usageOfRow(first);
    },
  };
}
