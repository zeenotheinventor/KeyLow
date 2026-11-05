// The graders the describe set (KEY-700) and the write set share: a `log_entry` call checked against the
// database, the `assistant_actions` rows a turn left, the rows a write changed, and Undo. A write is graded by
// the database and by the arguments, and never by the wording of the reply. Every reason names an expected
// value or a count, and never a row, a reply or a tool result, because those are the person's diary.
import type { CaseEnvironment, EvalCase, GradeOutcome, Grader, UndoOutcome } from "../src/case.ts";
import type { EvalDatabase, RowQuery, ToolCall, TurnResult, TurnStatus } from "../src/types.ts";
import type { AssistantCardKind } from "@keylow/core";

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
export type ExpectedAmount =
  | Readonly<{ count: number }>
  | Readonly<{ grams: number }>
  /** Any positive count of one of the food's own portions, for a message that gave no count. */
  | Readonly<{ portion: true }>;

export type ExpectedItem = Readonly<{
  /** The CoFID codes of the foods that are right for the words, any one of them. */
  codes: readonly [string, ...string[]];
  amount: ExpectedAmount;
  /**
   * `HH:MM`, only when the message names a time. Otherwise the call carries none, unless this is `"any"`, or
   * `"morning"` for a message that says "for breakfast", which invites a time before noon.
   */
  time?: string;
  /** `YYYY-MM-DD`, only when the message names another day than today. */
  date?: string;
}>;

const describeAmount = (amount: ExpectedAmount): string =>
  "count" in amount
    ? `${amount.count} portions`
    : "grams" in amount
      ? `${amount.grams} g`
      : "a portion";

const describeItem = ({ codes, amount, time, date }: ExpectedItem): string =>
  `${codes.join("|")} ${describeAmount(amount)}${time === undefined ? "" : ` at ${time}`}${date === undefined ? "" : ` on ${date}`}`;

// Whether a time in the call is one the item accepts: none unless the message named one, any, or before noon.
const timeAccepted = (given: unknown, wanted: string | undefined): boolean => {
  if (wanted === "any") {
    return true;
  }
  if (wanted === "morning") {
    return (
      given === null ||
      given === undefined ||
      (typeof given === "string" && given >= "05:00" && given < "12:00")
    );
  }
  return (given ?? null) === (wanted ?? null);
};

const dayAccepted = (given: unknown, wanted: string | undefined, today: string): boolean =>
  wanted === undefined
    ? given === null || given === undefined || given === today
    : given === wanted;

/** Whether the food is the row of one of the codes, as the database holds it. */
async function isFoodOf(
  foodId: string,
  codes: readonly string[],
  database: EvalDatabase,
): Promise<boolean> {
  const counts = await Promise.all(
    codes.map((code) =>
      database.countRows({
        table: "foods",
        where: { id: foodId, source: "cofid", source_ref: code },
      }),
    ),
  );
  return counts.some((count) => count > 0);
}

const isPortionOf = async (portionId: string, foodId: string, database: EvalDatabase) =>
  (await database.countRows({
    table: "food_portions",
    where: { id: portionId, food_id: foodId },
  })) > 0;

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
  const count = input["count"];
  const amountMatches =
    "grams" in amount
      ? input["kind"] === "grams" && input["grams"] === amount.grams
      : input["kind"] === "portion" &&
        typeof portionId === "string" &&
        ("count" in amount ? count === amount.count : typeof count === "number" && count > 0);
  if (
    !amountMatches ||
    !dayAccepted(input["local_date"], item.date, today) ||
    !timeAccepted(input["time"], item.time)
  ) {
    return false;
  }
  return (
    (await isFoodOf(foodId, item.codes, database)) &&
    (typeof portionId !== "string" || (await isPortionOf(portionId, foodId, database)))
  );
}

/** Whether a stored entry is the item: the right food, portion and amount, on the right day, and not deleted. */
async function rowMatchesItem(
  row: Readonly<Record<string, unknown>>,
  item: ExpectedItem,
  today: string,
  database: EvalDatabase,
): Promise<boolean> {
  const { food_id: foodId, portion_id: portionId, unit, local_date: day } = row;
  const quantity = Number(row["quantity"]);
  const { amount } = item;
  if (typeof foodId !== "string" || day !== (item.date ?? today)) {
    return false;
  }
  const amountMatches =
    "grams" in amount
      ? unit === "g" && quantity === amount.grams
      : unit === "portion" &&
        typeof portionId === "string" &&
        ("count" in amount ? quantity === amount.count : quantity > 0);
  return (
    amountMatches &&
    (await isFoodOf(foodId, item.codes, database)) &&
    (typeof portionId !== "string" || (await isPortionOf(portionId, foodId, database)))
  );
}

/** Takes each item, in order, to a candidate of its own that `matches`, and answers the position of the first it cannot. */
async function firstUnmatched<Candidate>(
  items: readonly ExpectedItem[],
  candidates: readonly Candidate[],
  matches: (candidate: Candidate, item: ExpectedItem) => Promise<boolean>,
): Promise<number> {
  const used = new Set<number>();
  for (const [position, item] of items.entries()) {
    let found = -1;
    for (const [index, candidate] of candidates.entries()) {
      if (!used.has(index) && (await matches(candidate, item))) {
        found = index;
        break;
      }
    }
    if (found === -1) {
      return position;
    }
    used.add(found);
  }
  return -1;
}

const chosenTurns = (turns: readonly TurnResult[], turnIndexes?: readonly number[]) =>
  turns.filter((_turn, index) => turnIndexes?.includes(index) ?? true);

/**
 * Passes when each expected item has a `log_entry` call of its own with the right food (one of its codes, as
 * the database holds it), the right kind and amount, a portion of that food for a count, and the day and time
 * the message named. A call that failed and was tried again leaves an extra call, which is no fault: the
 * rows the turn left are checked by `actionRows`.
 */
export function loggedItems(
  items: readonly ExpectedItem[],
  today: string,
  turnIndexes?: readonly number[],
): Grader {
  return async ({ turns, database }) => {
    const inputs = inputsOf(chosenTurns(turns, turnIndexes), "log_entry");
    const missing = await firstUnmatched(items, inputs, (input, item) =>
      matchesItem(input, item, today, database),
    );
    const item = items[missing];
    return item === undefined
      ? pass(`log_entry was called for ${items.length} items`)
      : fail(
          `no log_entry call matched item ${missing + 1} of ${items.length} (${describeItem(item)})`,
        );
  };
}

/**
 * Passes when the entries the turns left in the diary are the items: for each `log_entry` action the entry it
 * names is read, not deleted, and is the right food, portion and amount on the right day. This is the end
 * state, so a call that looked right but landed otherwise does not pass.
 */
export function loggedRows(
  items: readonly ExpectedItem[],
  today: string,
  turnIndexes?: readonly number[],
): Grader {
  return async ({ turns, database }) => {
    const actions = (
      await Promise.all(
        chosenTurns(turns, turnIndexes).map(({ turnId }) =>
          database.readRows({
            table: "assistant_actions",
            where: { turn_id: turnId, tool: "log_entry" },
          }),
        ),
      )
    ).flat();
    const entryIds = actions.flatMap(({ target_id: id }) => (typeof id === "string" ? [id] : []));
    const rows = (
      await Promise.all(
        entryIds.map((id) =>
          database.readRows({ table: "food_log_entries", where: { id, deleted_at: null } }),
        ),
      )
    ).flat();
    const missing = await firstUnmatched(items, rows, (row, item) =>
      rowMatchesItem(row, item, today, database),
    );
    const item = items[missing];
    return item === undefined
      ? pass(`the diary holds the ${items.length} items`)
      : fail(
          `no logged entry matched item ${missing + 1} of ${items.length} (${describeItem(item)})`,
        );
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

const FOOD_OR_AMOUNT =
  /\bgrams?\b|\d\s*g\b|\bhow (?:much|many|big)\b|\bamount\b|\bquantity\b|\bportions?\b|\bservings?\b|\bsize\b|\bwhich\b|\bwhat (?:kind|type|sort)\b|\bwhat (?:was|were|is|are) (?:it|the|in)\b/i;
const SIZE = /\bsize\b|\bsmall\b|\bmedium\b|\blarge\b|\bbig\b|\bhow (?:big|large)\b|\bwhich one\b/i;

const askedAbout =
  (pattern: RegExp, what: string): Grader =>
  ({ turns }) => {
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
      pattern.test(text)
        ? pass(`the question asks about ${what}`)
        : fail(`the question does not ask about ${what}`),
    );
  };

/** Passes when the question, or a quick reply, asks about the food or how much of it (grams, a portion, which one). */
export const askedAboutFoodOrAmount = (): Grader =>
  askedAbout(FOOD_OR_AMOUNT, "the food or the amount");

/** Passes when the question, or a quick reply, asks about the size of the food. */
export const askedAboutSize = (): Grader => askedAbout(SIZE, "the size");

/** Passes when every `log_entry` call is for a portion of a food, so no weight was guessed. */
export function noGuessedAmounts(): Grader {
  return ({ turns }) => {
    const guess = inputsOf(turns, "log_entry").find(
      (input) => !isRecord(input) || input["kind"] !== "portion",
    );
    return Promise.resolve(
      guess === undefined
        ? pass("every log_entry was a portion")
        : fail(
            `log_entry guessed an amount (kind ${isRecord(guess) ? String(guess["kind"]) : "unknown"})`,
          ),
    );
  };
}

/** Passes when every `log_entry` call is for one of the foods with these codes, as the database holds them. */
export function onlyFoodsOf(codes: readonly string[]): Grader {
  return async ({ turns, database }) => {
    for (const input of inputsOf(turns, "log_entry")) {
      const foodId = isRecord(input) ? input["food_id"] : undefined;
      if (typeof foodId !== "string" || !(await isFoodOf(foodId, codes, database))) {
        return fail("log_entry logged a food that is not one of the real ones");
      }
    }
    return pass("only the real foods were logged");
  };
}

/**
 * Passes when each turn left at most one row for a tool, and no turn names a target (a tool and an id) that an
 * earlier turn wrote. It is for a case whose messages each ask for one write, such as saying the same thing
 * twice: the second turn may be its own write, or none, but never the first turn's write again and never two.
 * It would fail a message that logs three foods, which leaves three `log_entry` rows.
 */
export function oneRowPerToolPerMessage(): Grader {
  return async ({ turns, database }) => {
    const seen = new Map<string, number>();
    for (const [index, { turnId }] of turns.entries()) {
      const rows = await database.readRows({
        table: "assistant_actions",
        where: { turn_id: turnId },
      });
      const perTool = new Map<string, number>();
      for (const { tool, target_id: target } of rows) {
        const name = String(tool);
        perTool.set(name, (perTool.get(name) ?? 0) + 1);
        const key = `${name} ${String(target)}`;
        const earlier = seen.get(key);
        if (earlier !== undefined && earlier !== index) {
          return fail(`a write of turn ${earlier + 1} was written again in turn ${index + 1}`);
        }
        seen.set(key, index);
      }
      for (const [name, count] of perTool) {
        if (count > 1) {
          return fail(`turn ${index + 1} left ${count} ${name} rows for one message`);
        }
      }
    }
    return pass("no write was replayed");
  };
}

/** Passes when the turn, counted from 0, sent a card of that kind (the card the app draws for the write). */
export function cardOfKind(turnIndex: number, kind: AssistantCardKind): Grader {
  return ({ turns }) =>
    Promise.resolve(
      turns[turnIndex]?.cards?.some((card) => card.kind === kind) === true
        ? pass(`turn ${turnIndex + 1} sent a ${kind} card`)
        : fail(`turn ${turnIndex + 1} sent no ${kind} card`),
    );
}

/**
 * Passes when every grader of at least one route passes. A fair case has more than one good answer (log it, or
 * ask once), and each is a route. A failure names what the closest route failed on.
 */
export function anyOfRoutes(routes: readonly (readonly Grader[])[]): Grader {
  return async (context) => {
    const outcomes = await Promise.all(
      routes.map((route) => Promise.all(route.map((grade) => grade(context)))),
    );
    if (outcomes.some((route) => route.every(({ passed }) => passed))) {
      return pass("a route passed");
    }
    const failedReasons = outcomes.map((route) =>
      route.filter(({ passed }) => !passed).map(({ reason }) => reason),
    );
    const closest = failedReasons.reduce((best, reasons) =>
      reasons.length < best.length ? reasons : best,
    );
    return fail(`no route passed, the closest failed on: ${closest.join("; ")}`);
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

/**
 * Presses Undo for every turn of the case, newest first, so what the case wrote does not stay in the diary.
 * It throws unless every action answered `undone` or `already_undone`: an entry that stays would change what
 * the copy cases, the lunch case and the ask set count, and a quiet failure would show as those failing.
 */
export async function undoWrites(
  turns: readonly TurnResult[],
  environment: CaseEnvironment,
): Promise<void> {
  for (const turn of [...turns].reverse()) {
    const outcomes = await environment.undoTurn(turn.turnId);
    if (outcomes.some((outcome) => outcome !== "undone" && outcome !== "already_undone")) {
      throw new Error(
        `the writes of the case could not be undone (Undo answered ${outcomes.join(", ")}), so they may be left in the diary`,
      );
    }
  }
}
