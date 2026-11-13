import type { Database } from "@keylow/api-client";
import type {
  AssistantCard,
  AssistantExerciseFormMedia,
  AssistantExerciseMuscles,
  AssistantRecipeDraft,
} from "@keylow/core";

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
  /**
   * The error code the tool answered, such as `not_found` or `invalid_input`, read from the stored tool result.
   * Only the code, never the result, because a result is the person's data. Absent when the tool did not fail.
   */
  errorCode?: string | undefined;
  /**
   * What became of a call that did not fail with a code: `asked to confirm` when its result was a request for a
   * yes, and `no result` when the turn stored the call and no result for it, so the loop never ran it.
   */
  outcome?: "asked to confirm" | "no result" | undefined;
  /**
   * The amounts an `estimate_portions` call answered, in the order of its items: the food, the unit and the
   * size, read from the stored tool result. Only those three, because a name or a nutrient is the person's
   * diary and the graders need the amount alone, to check `log_entry` logged what the tool said. Absent for
   * every other tool, and when the call was refused.
   */
  estimatedAmounts?: readonly EstimatedAmount[] | undefined;
  /**
   * The parsed answer of a kitchen tool (`get_palate_profile`, `suggest_recipe` and `adjust_recipe`), so a grader can
   * compare its figures with core's. Kept for those three tools only, on a refusal too (its `error` and `misses`),
   * and read by graders, never printed. Absent for every other tool and when the text was not JSON.
   */
  result?: Readonly<Record<string, unknown>> | undefined;
}>;

/** One food an `estimate_portions` call sized: grams, or millilitres for a food per 100 ml. */
export type EstimatedAmount = Readonly<{ foodId: string; unit: "g" | "ml"; amount: number }>;

/** What the app prints under an answer from the person's data. Either is null when the turn had none. */
export type AnswerMeta = Readonly<{ citation: string | null; estimate: string | null }>;

/** What the app draws for a write that waits for a yes: the question, with the note the code added, and the buttons. */
export type Confirmation = Readonly<{
  question: string;
  confirmLabel: string;
  cancelLabel: string;
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
  /** The line under the answer and the Estimate label, from the turn's `answer_meta` event. Absent when the turn sent none. */
  answerMeta?: AnswerMeta | undefined;
  /** The `confirm` event of a turn that ended waiting for a yes. Absent otherwise. */
  confirmation?: Confirmation | undefined;
  /** The action cards the turn sent, in order. Absent when it sent none. */
  cards?: readonly AssistantCard[] | undefined;
  /** The muscles of each exercise the turn showed (`exercise_muscles` events), in call order. Absent when it showed none. */
  exerciseMuscles?: readonly AssistantExerciseMuscles[] | undefined;
  /** The form card (a video or two photos) of each exercise the turn showed (`exercise_form_media` events), in call order. Absent when it showed none. */
  exerciseFormMedia?: readonly AssistantExerciseFormMedia[] | undefined;
  /** The recipes the turn drafted (`recipe_draft` events), in call order. Absent when it drafted none. */
  recipeDrafts?: readonly AssistantRecipeDraft[] | undefined;
  /** The code of the last `notice` event, such as `turn_failed`. Absent when the turn sent none. */
  noticeCode?: string | undefined;
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
  /** Every column of every row that matches, for a grader that has to compare values and not only count rows. */
  readRows: (query: RowQuery) => Promise<readonly Readonly<Record<string, unknown>>[]>;
  /** The sum of the `assistant_usage` rows of one turn. */
  usageOfTurn: (turnId: string) => Promise<TurnUsage>;
  /** The sum of every `assistant_usage` row of the eval user: its turns, their compactions, anything else. */
  usageOfUser: () => Promise<TurnUsage>;
  /** The earliest `assistant_usage` row of a turn, which is its first model call. Null when it has none. */
  firstModelCallOfTurn: (turnId: string) => Promise<TurnUsage | null>;
}>;
