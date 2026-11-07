import type { EvalSetName } from "./thresholds.ts";
import type { EvalDatabase, RowQuery, TurnResult } from "./types.ts";

export type GradeOutcome = Readonly<{
  passed: boolean;
  reason: string;
  /** A failed critical outcome fails its whole set, whatever the set's percentage (see `EvalCase.mustPass`). */
  critical?: true;
}>;

/** What a grader reads: the turns of one case, in order, and the database as the eval user. */
export type GradeContext = Readonly<{
  turns: readonly TurnResult[];
  database: EvalDatabase;
}>;

/** A grader is deterministic: it reads tool calls, statuses, rows and numbers, and never asks a model. */
export type Grader = (context: GradeContext) => Promise<GradeOutcome>;

/** One earlier turn of a seeded conversation: the person's words and the assistant's reply, as plain text. */
export type SeedTurn = Readonly<{ user: string; assistant: string }>;

/**
 * What the Undo route answers for one action: `undone`, or why it did not undo (`already_undone`,
 * `undo_unavailable`, `not_found`).
 */
export type UndoOutcome = "undone" | "already_undone" | "undo_unavailable" | "not_found";

/** What a case may do besides send messages, for the eval user of the run. */
export type CaseEnvironment = Readonly<{
  /** Stores complete, text-only turns as a new conversation of the eval user and answers its id. */
  seedConversation: (turns: readonly SeedTurn[]) => Promise<string>;
  /** Resolves once the conversation has a compaction note, and rejects when none is stored in time. */
  waitForCompaction: (conversationId: string) => Promise<void>;
  /**
   * Presses Undo, as the app's card does, for every action the turn wrote, and answers the outcome of each in
   * the order they were written. A turn that wrote nothing answers an empty list.
   */
  undoTurn: (turnId: string) => Promise<readonly UndoOutcome[]>;
  /** Puts the eval user's calorie and macro targets back to what the run started with. */
  restoreTargets: () => Promise<void>;
}>;

export type EvalCase = Readonly<{
  id: string;
  set: EvalSetName;
  /**
   * Runs before the first message and answers the conversation it goes into, or null when the case only needs
   * something started (such as the page server) and the first message should open one. Left out, the same.
   */
  setup?: (environment: CaseEnvironment) => Promise<string | null>;
  /** Runs after each turn has been read, for a case that must wait for something before its next message. */
  afterTurn?: (
    turn: Readonly<{ index: number; result: TurnResult }>,
    environment: CaseEnvironment,
  ) => Promise<void>;
  /** One or more user turns, sent in order into one conversation. */
  messages: readonly [string, ...string[]];
  /** The case passes when every grader passes. */
  expect: readonly Grader[];
  /**
   * True when a miss of this case, whether it fails, errors or is not run, fails its set whatever the set's
   * percentage. The set's other cases still count towards the percentage.
   */
  mustPass?: true;
  /**
   * Runs before the case's ceiling starts, and so outside it, for work that is slow and that every later case
   * shares (writing a history). A failure ends the case in error. It runs once for each case, so it has to do
   * nothing when it has run before.
   */
  prepare?: () => Promise<void>;
  /**
   * Runs after the graders, and also when a turn failed, so a case that wrote to rows the other sets read
   * (today's diary, the targets) puts them back. It gets the turns sent so far.
   */
  cleanUp?: (turns: readonly TurnResult[], environment: CaseEnvironment) => Promise<void>;
}>;

const pass = (reason: string): GradeOutcome => ({ passed: true, reason });
const fail = (reason: string): GradeOutcome => ({ passed: false, reason });

const lastTurnOf = (turns: readonly TurnResult[]): TurnResult | undefined => turns.at(-1);

/** Passes when some turn called the tool, with arguments that `matchesArguments` accepts when it is given. */
export function toolCalled(name: string, matchesArguments?: (input: unknown) => boolean): Grader {
  return (context) => {
    const calls = context.turns
      .flatMap((turn) => turn.toolCalls)
      .filter((call) => call.name === name);
    if (calls.length === 0) {
      return Promise.resolve(fail(`${name} was not called`));
    }
    if (matchesArguments !== undefined && !calls.some((call) => matchesArguments(call.input))) {
      return Promise.resolve(fail(`${name} was called but not with the expected arguments`));
    }
    return Promise.resolve(pass(`${name} was called`));
  };
}

/** Passes when no tool that writes was called. A tool with no `readOnlyHint` counts as one that writes. */
export function noWrite(): Grader {
  return (context) => {
    const write = context.turns
      .flatMap((turn) => turn.toolCalls)
      .find((call) => call.readOnlyHint !== true);
    return Promise.resolve(
      write === undefined ? pass("no tool wrote") : fail(`${write.name} wrote`),
    );
  };
}

/**
 * Passes when no `assistant_actions` row belongs to a turn of the case. This is the end state, so it catches a
 * write that a tool call list would not show. The turn ids keep other cases of the same run out of it.
 */
export function noActionRows(): Grader {
  return async (context) => {
    const counts = await Promise.all(
      context.turns.map(({ turnId }) =>
        context.database.countRows({ table: "assistant_actions", where: { turn_id: turnId } }),
      ),
    );
    return counts.every((count) => count === 0)
      ? pass("the case left no rows in assistant_actions")
      : fail("the case left rows in assistant_actions");
  };
}

/** Passes when at least one row matches, read as the eval user, so row-level security applies. */
export function rowsExist(query: RowQuery): Grader {
  return async (context) =>
    (await context.database.countRows(query)) > 0
      ? pass(`a row in ${query.table} matched`)
      : fail(`no row in ${query.table} matched`);
}

const MONTH =
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const DAY = "\\d{1,2}(?:st|nd|rd|th)?";

// Dates are removed before numbers are read, so the day of a date is not taken for an amount: an ISO date,
// "6 to 12 Oct" and "5 Nov" (a range counts as one), "Nov 5", and an ordinal such as "5th".
const DATES = new RegExp(
  [
    "\\d{4}-\\d{2}-\\d{2}(?:t[\\d:.]+z?)?",
    `\\b${DAY}(?:\\s*(?:to|-|and)\\s*${DAY})?\\s+(?:of\\s+)?${MONTH}\\b`,
    `\\b${MONTH}\\.?\\s+${DAY}(?:\\s*(?:to|-)\\s*${DAY})?(?!\\d)`,
    "\\b\\d+(?:st|nd|rd|th)\\b",
  ].join("|"),
  "gi",
);

// A number as people write it in an answer: digits with optional thousands commas and an optional decimal
// part. It may not start inside another number (a digit, a comma or a point before it) or run into more
// digits, so 1,8400 and 18400 are not 1840. A hyphen is a minus only at the start, after a space or after
// an opening bracket, so the hyphen of "1840-1850" is a range and not a minus.
const NUMBER_IN_TEXT = /(?:(?<=^|[\s(])-)?(?<![\d.,])(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?!\d)/g;

const numbersIn = (answer: string): number[] =>
  (
    answer
      .replaceAll("\u2212", "-")
      .replaceAll("\u2013", "-")
      .replace(DATES, " ")
      .match(NUMBER_IN_TEXT) ?? []
  ).map((text) => Number(text.replaceAll(",", "")));

/** Passes when the last answer holds a number within `tolerance` of `value`. */
export function answerContainsNumber(value: number, tolerance = 0): Grader {
  return (context) => {
    const answer = lastTurnOf(context.turns)?.answer ?? "";
    // The small allowance keeps a tolerance of 0.1 from failing on floating point error, as in 0.4 against 0.3.
    const found = numbersIn(answer).some((number) => Math.abs(number - value) <= tolerance + 1e-9);
    return Promise.resolve(
      found
        ? pass(`the answer has a number within ${tolerance} of ${value}`)
        : fail(`the answer has no number within ${tolerance} of ${value}`),
    );
  };
}

function lastTurnEnded(status: TurnResult["status"]): Grader {
  return (context) => {
    const ended = lastTurnOf(context.turns)?.status;
    return Promise.resolve(
      ended === status
        ? pass(`the last turn ended ${status}`)
        : fail(`the last turn ended ${ended ?? "never"}, not ${status}`),
    );
  };
}

/** Passes when the last turn ended by asking the person a question. */
export const clarifyingQuestion = (): Grader => lastTurnEnded("clarify");

/** Passes when the last turn ended with the model's refusal. */
export const refused = (): Grader => lastTurnEnded("refused");

/**
 * Passes when the first model call of the second turn read from the prompt cache (`cache_read_input_tokens`
 * above 0 in `assistant_usage`). Later calls of a turn's tool rounds read the cache of the call before them, so
 * only the first call shows whether the conversation's prefix was cached. The press of a confirm button makes no
 * model call (KEY-840) and so has no row, which fails here. Grade a turn that asks the model instead.
 */
export function cacheReadOnSecondTurn(): Grader {
  return async (context) => {
    const secondTurn = context.turns[1];
    if (secondTurn === undefined) {
      return fail("the case has no second turn");
    }
    const firstCall = await context.database.firstModelCallOfTurn(secondTurn.turnId);
    if (firstCall === null) {
      return fail("the second turn has no assistant_usage row");
    }
    const tokens = firstCall.cacheReadInputTokens;
    return tokens > 0
      ? pass(`the first model call of the second turn read ${tokens} tokens from the cache`)
      : fail(`the first model call of the second turn read ${tokens} tokens from the cache`);
  };
}
