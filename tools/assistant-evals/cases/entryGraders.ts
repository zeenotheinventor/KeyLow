// The graders the describe set (KEY-700) and the write set share: a `log_entry` call checked against the
// database, the `assistant_actions` rows a turn left, the rows a write changed, and Undo. A write is graded by
// the database and by the arguments, and never by the wording of the reply. Every reason names an expected
// value or a count, and never a row, a reply or a tool result, because those are the person's diary.
import type { CaseEnvironment, EvalCase, GradeOutcome, Grader, UndoOutcome } from "../src/case.ts";
import type { EvalDatabase, RowQuery, ToolCall, TurnResult, TurnStatus } from "../src/types.ts";

const pass = (reason: string): GradeOutcome => ({ passed: true, reason });
const fail = (reason: string): GradeOutcome => ({ passed: false, reason });

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toolCallsOf = (turns: readonly TurnResult[]): ToolCall[] =>
  turns.flatMap((turn) => turn.toolCalls);

/** The inputs of every call of a tool, over all the turns of the case, in order. */
export const inputsOf = (turns: readonly TurnResult[], tool: string): unknown[] =>
  toolCallsOf(turns)
    .filter(({ name }) => name === tool)
    .map(({ input }) => input);

const toolsLine = (calls: readonly ToolCall[]): string =>
  calls.length === 0
    ? "none"
    : calls.map(({ name, input }) => `${name}(${JSON.stringify(input).slice(0, 200)})`).join(", ");

/**
 * A failing case says what it was asked and which tools it called with which arguments, and never the answer
 * or a tool result, which are the person's diary.
 */
export function withContext(grade: Grader, messages: readonly string[]): Grader {
  return async (context) => {
    const outcome = await grade(context);
    return outcome.passed
      ? outcome
      : {
          passed: false,
          reason: `${outcome.reason}; messages: ${messages.map((message) => `"${message}"`).join(" then ")}; tools: ${toolsLine(toolCallsOf(context.turns))}`,
        };
  };
}

// What one thing the person said they ate comes to: any of these foods, a count of its portions or grams.
export type ExpectedAmount = Readonly<{ count: number }> | Readonly<{ grams: number }>;

export type ExpectedItem = Readonly<{
  /** The CoFID codes of the foods that are right for the words, any one of them. */
  codes: readonly [string, ...string[]];
  amount: ExpectedAmount;
  /** `HH:MM`, only when the message names a time. Otherwise the call carries none, unless this is `"any"`. */
  time?: string;
  /** `YYYY-MM-DD`, only when the message names another day than today. */
  date?: string;
}>;

const describeItem = ({ codes, amount, time, date }: ExpectedItem): string =>
  `${codes.join("|")} ${"count" in amount ? `${amount.count} portions` : `${amount.grams} g`}${time === undefined ? "" : ` at ${time}`}${date === undefined ? "" : ` on ${date}`}`;

async function matchesItem(
  input: unknown,
  item: ExpectedItem,
  today: string,
  database: EvalDatabase,
): Promise<boolean> {
  if (!isRecord(input)) {
    return false;
  }
  const foodId = input["food_id"];
  const portionId = input["portion_id"];
  if (typeof foodId !== "string") {
    return false;
  }
  const { amount } = item;
  const amountMatches =
    "count" in amount
      ? input["kind"] === "portion" &&
        input["count"] === amount.count &&
        typeof portionId === "string"
      : input["kind"] === "grams" && input["grams"] === amount.grams;
  const day = input["local_date"] ?? null;
  const dayMatches = item.date === undefined ? day === null || day === today : day === item.date;
  const timeMatches = item.time === "any" || (input["time"] ?? null) === (item.time ?? null);
  if (!amountMatches || !dayMatches || !timeMatches) {
    return false;
  }
  const foodCounts = await Promise.all(
    item.codes.map((code) =>
      database.countRows({
        table: "foods",
        where: { id: foodId, source: "cofid", source_ref: code },
      }),
    ),
  );
  if (!foodCounts.some((count) => count > 0)) {
    return false;
  }
  return typeof portionId !== "string"
    ? true
    : (await database.countRows({
        table: "food_portions",
        where: { id: portionId, food_id: foodId },
      })) > 0;
}

/**
 * Passes when each expected item has a `log_entry` call of its own with the right food (one of its codes, as
 * the database holds it), the right kind and amount, a portion of that food for a count, and the day and time
 * the message named. A call that failed and was tried again leaves an extra call, which is no fault: the
 * rows the turn left are checked by `actionRows`.
 */
export function loggedItems(items: readonly ExpectedItem[], today: string): Grader {
  return async ({ turns, database }) => {
    const inputs = inputsOf(turns, "log_entry");
    const used = new Set<number>();
    for (const [position, item] of items.entries()) {
      let found = -1;
      for (const [index, input] of inputs.entries()) {
        if (!used.has(index) && (await matchesItem(input, item, today, database))) {
          found = index;
          break;
        }
      }
      if (found === -1) {
        return fail(
          `no log_entry call matched item ${position + 1} of ${items.length} (${describeItem(item)})`,
        );
      }
      used.add(found);
    }
    return pass(`log_entry was called for ${items.length} items`);
  };
}

/** Passes when a call of the tool has an input that `matches`, which is named by `description` when none does. */
export function calledWith(
  tool: string,
  matches: (input: Record<string, unknown>) => boolean,
  description: string,
): Grader {
  return ({ turns }) =>
    Promise.resolve(
      inputsOf(turns, tool).some((input) => isRecord(input) && matches(input))
        ? pass(`${tool} was called with ${description}`)
        : fail(`${tool} was not called with ${description}`),
    );
}

/** Passes when no question was asked: a person who gave every figure is not asked for one. */
export const noQuestionsAsked = (): Grader => askedTimes(0);

const askedTimes =
  (expected: number): Grader =>
  ({ turns }) => {
    const asked = inputsOf(turns, "ask_user").length;
    return Promise.resolve(
      asked === expected
        ? pass(`${expected} questions were asked`)
        : fail(`${asked} questions were asked, not ${expected}`),
    );
  };

/**
 * Passes when the entries of the day were read before the first `log_entry`, by `get_entries` over a range that
 * holds the day or by `get_day`, so "again" repeats what the diary holds and not what the model remembers.
 */
export function readBeforeFirstLog(localDate: string): Grader {
  return ({ turns }) => {
    const calls = toolCallsOf(turns);
    const firstLog = calls.findIndex(({ name }) => name === "log_entry");
    const read = calls.findIndex(({ name, input }) => {
      if (!isRecord(input)) {
        return false;
      }
      if (name === "get_day") {
        return input["local_date"] === localDate;
      }
      const { from, to } = input;
      return (
        name === "get_entries" &&
        typeof from === "string" &&
        typeof to === "string" &&
        from <= localDate &&
        localDate <= to
      );
    });
    return Promise.resolve(
      firstLog !== -1 && read !== -1 && read < firstLog
        ? pass("the day was read before anything was logged")
        : fail(`the entries of ${localDate} were not read before the first log_entry`),
    );
  };
}

/** Passes when the question of a turn that waits for a yes ends with the line (the code adds a line after the model's question). */
export function confirmationEndsWith(turnIndex: number, line: string): Grader {
  return ({ turns }) => {
    const question = turns[turnIndex]?.confirmation?.question;
    if (question === undefined) {
      return Promise.resolve(fail(`turn ${turnIndex + 1} asked for no confirmation`));
    }
    return Promise.resolve(
      question.trimEnd().endsWith(line)
        ? pass("the question ends with the expected line")
        : fail(`the question of turn ${turnIndex + 1} does not end with the expected line`),
    );
  };
}

/** Passes when the question of a turn that waits for a yes does not hold the text. */
export function confirmationLacks(turnIndex: number, text: string): Grader {
  return ({ turns }) => {
    const question = turns[turnIndex]?.confirmation?.question;
    if (question === undefined) {
      return Promise.resolve(fail(`turn ${turnIndex + 1} asked for no confirmation`));
    }
    return Promise.resolve(
      question.includes(text)
        ? fail(`the question of turn ${turnIndex + 1} holds text it should not`)
        : pass("the question holds no such text"),
    );
  };
}

/**
 * Passes when the turns left exactly `expected` `assistant_actions` rows for the tool. A write that landed has
 * one row, a write that failed has none, and a write repeated has two, so this is the proof that nothing was
 * written twice. `turnIndexes` limits it to those turns, counted from 0, and is every turn when left out.
 */
export function actionRows(
  tool: string,
  expected: number,
  turnIndexes?: readonly number[],
): Grader {
  return async ({ turns, database }) => {
    const chosen = turns.filter((_turn, index) => turnIndexes?.includes(index) ?? true);
    const counts = await Promise.all(
      chosen.map(({ turnId }) =>
        database.countRows({ table: "assistant_actions", where: { turn_id: turnId, tool } }),
      ),
    );
    const found = counts.reduce((sum, count) => sum + count, 0);
    return found === expected
      ? pass(`${tool} left ${expected} action rows`)
      : fail(`${tool} left ${found} action rows, not ${expected}`);
  };
}

/** Passes when one turn, counted from 0, wrote nothing at all: it left no `assistant_actions` row. */
export function noActionRowsInTurn(turnIndex: number): Grader {
  return async ({ turns, database }) => {
    const turn = turns[turnIndex];
    if (turn === undefined) {
      return fail(`the case has no turn ${turnIndex + 1}`);
    }
    const found = await database.countRows({
      table: "assistant_actions",
      where: { turn_id: turn.turnId },
    });
    return found === 0
      ? pass(`turn ${turnIndex + 1} wrote nothing`)
      : fail(`turn ${turnIndex + 1} left ${found} action rows, not 0`);
  };
}

/** Passes when one turn, counted from 0, ended with the status. */
export function turnEnded(turnIndex: number, status: TurnStatus): Grader {
  return ({ turns }) => {
    const ended = turns[turnIndex]?.status;
    return Promise.resolve(
      ended === status
        ? pass(`turn ${turnIndex + 1} ended ${status}`)
        : fail(`turn ${turnIndex + 1} ended ${ended ?? "never"}, not ${status}`),
    );
  };
}

/** Passes when exactly `expected` rows match, read as the eval user. */
export function rowCount(query: RowQuery, expected: number): Grader {
  return async ({ database }) => {
    const found = await database.countRows(query);
    return found === expected
      ? pass(`${expected} rows of ${query.table} matched`)
      : fail(`${found} rows of ${query.table} matched, not ${expected}`);
  };
}

/** Passes when exactly one `ask_user` call was made over all the turns. */
export function askedOnce(): Grader {
  return ({ turns }) => {
    const asked = inputsOf(turns, "ask_user").length;
    return Promise.resolve(
      asked === 1 ? pass("one question was asked") : fail(`${asked} questions were asked, not 1`),
    );
  };
}

const GRAMS = /\bgrams?\b|\d\s*g\b/i;

/** Passes when the question, or one of its quick replies, asks for or offers an amount in grams. */
export function askedForGrams(): Grader {
  return ({ turns }) => {
    const text = inputsOf(turns, "ask_user")
      .flatMap((input): unknown[] => {
        if (!isRecord(input)) {
          return [];
        }
        // `Array.isArray` narrows to `any[]`, and the cast keeps `any` out of the spread.
        const replies: unknown = input["quick_replies"];
        return [input["question"], ...(Array.isArray(replies) ? (replies as unknown[]) : [])];
      })
      .filter((part): part is string => typeof part === "string")
      .join(" ");
    return Promise.resolve(
      GRAMS.test(text)
        ? pass("the question asks for grams")
        : fail("the question does not ask for an amount in grams"),
    );
  };
}

/** Passes when no tool wrote: every call is one of `readTools`. The driver gives no `readOnlyHint` yet. */
export function onlyTheseTools(allowed: ReadonlySet<string>): Grader {
  return ({ turns }) => {
    const other = toolCallsOf(turns).find(({ name }) => !allowed.has(name));
    return Promise.resolve(
      other === undefined
        ? pass("only the allowed tools were called")
        : fail(`${other.name} was called`),
    );
  };
}

/**
 * Pressing Undo in a case. `afterTurn` presses it twice on one turn, as a person who taps the button and then
 * taps it again would. The first press must undo every action the turn wrote, and the second must answer
 * `already_undone` for each. Make one for each case, because it holds what the presses answered.
 */
export function undoOnTurn(turnIndex: number, actions: number) {
  let presses: UndoOutcome[][] = [];
  const afterTurn: NonNullable<EvalCase["afterTurn"]> = async ({ index, result }, environment) => {
    if (index === turnIndex) {
      const first = await environment.undoTurn(result.turnId);
      const second = await environment.undoTurn(result.turnId);
      presses = [[...first], [...second]];
    }
  };
  const undone: Grader = () => {
    const [first, second] = presses;
    if (first === undefined || second === undefined) {
      return Promise.resolve(fail("Undo was not pressed"));
    }
    const everyAction = (outcomes: readonly UndoOutcome[], wanted: UndoOutcome) =>
      outcomes.length === actions && outcomes.every((outcome) => outcome === wanted);
    return Promise.resolve(
      everyAction(first, "undone") && everyAction(second, "already_undone")
        ? pass("Undo undid the write, and a second press found it already undone")
        : fail(
            `Undo answered ${first.join(", ") || "nothing"}, then ${second.join(", ") || "nothing"}, not ${actions} undone then ${actions} already_undone`,
          ),
    );
  };
  return { afterTurn, undone };
}

/** Presses Undo for every turn of the case, newest first, so what the case wrote does not stay in the diary. */
export async function undoWrites(
  turns: readonly TurnResult[],
  environment: CaseEnvironment,
): Promise<void> {
  for (const turn of [...turns].reverse()) {
    await environment.undoTurn(turn.turnId);
  }
}
