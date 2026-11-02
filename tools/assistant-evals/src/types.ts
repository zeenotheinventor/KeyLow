import type { Database } from "@keylow/api-client";

// What the harness knows about a finished turn and about the database. Both are plain data, so a grader is
// a function over them and a stub can stand in for the real thing.

/** How a turn ended. These are the turn statuses of ADR 0003, Amendment 14, without `open`. */
export type TurnStatus = "complete" | "clarify" | "confirm" | "stopped" | "failed" | "refused";

export type ToolCall = Readonly<{
  name: string;
  input: unknown;
  /**
   * The tool's `readOnlyHint` annotation from the `mcp` function's `tools/list`. A tool with no hint is
   * treated as one that writes.
   */
  readOnlyHint?: boolean | undefined;
}>;

/** The result of one user turn, once its stream has ended. */
export type TurnResult = Readonly<{
  conversationId: string;
  /** The id of the turn, which is the `turn_id` of its `assistant_usage` rows. */
  turnId: string;
  status: TurnStatus;
  /** The assistant's final text. */
  answer: string;
  toolCalls: readonly ToolCall[];
}>;

/** The sum of the `assistant_usage` rows of one turn (a turn with tool rounds writes several). */
export type TurnUsage = Readonly<{
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  costUsdMicros: number;
}>;

export type RowQuery = Readonly<{
  table: keyof Database["public"]["Tables"];
  /** Every column must equal its value. */
  where: Readonly<Record<string, string | number | boolean | null>>;
}>;

/** What the graders and the runner read from the database, as the eval user. */
export type EvalDatabase = Readonly<{
  countRows: (query: RowQuery) => Promise<number>;
  /** The sum of the `assistant_usage` rows of one turn. */
  usageOfTurn: (turnId: string) => Promise<TurnUsage>;
  /** The sum of every `assistant_usage` row of the eval user: its turns, their compactions, anything else. */
  usageOfUser: () => Promise<TurnUsage>;
  /** The earliest `assistant_usage` row of a turn, which is its first model call. Null when it has none. */
  firstModelCallOfTurn: (turnId: string) => Promise<TurnUsage | null>;
}>;
