import { describe, expect, it } from "vitest";

import { fakeEnvironment } from "./fakeEnvironment.ts";
import { readTool, turnResult, writeTool } from "./helpers.ts";
import { rowDatabase } from "./rowDatabase.ts";
import {
  actionRows,
  anyOfRoutes,
  askedAboutFoodOrAmount,
  askedAboutSize,
  askedOnce,
  calledWith,
  cardOfKind,
  confirmationEndsWith,
  confirmationLacks,
  loggedItems,
  loggedRows,
  noGuessedAmounts,
  oneRowPerToolPerMessage,
  onlyFoodsOf,
  noQuestionsAsked,
  noActionRowsInTurn,
  onlyTheseTools,
  readBeforeFirstLog,
  rowCount,
  turnEnded,
  undoOnTurn,
  undoWrites,
  withContext,
} from "../cases/entryGraders.ts";

import type { ExpectedItem } from "../cases/entryGraders.ts";
import type { Grader, UndoOutcome } from "../src/case.ts";
import type { EvalDatabase } from "../src/types.ts";
import type { AssistantCard } from "@keylow/core";

const TODAY = "2026-11-05";
const EGG_ID = "egg-id";
const EGG_PORTION_ID = "egg-portion-id";
const TOAST_ID = "toast-id";

// The database of a seed that holds a boiled egg with a portion and a toasted slice, as the real one does.
const seedRows = {
  foods: [
    { id: EGG_ID, source: "cofid", source_ref: "12-940" },
    { id: TOAST_ID, source: "cofid", source_ref: "11-982" },
  ],
  food_portions: [{ id: EGG_PORTION_ID, food_id: EGG_ID }],
};

const eggs: ExpectedItem = { codes: ["12-937", "12-940"], amount: { count: 2 } };

const logEggs = (overrides: Record<string, unknown> = {}) =>
  writeTool("log_entry", {
    kind: "portion",
    food_id: EGG_ID,
    portion_id: EGG_PORTION_ID,
    count: 2,
    grams: null,
    local_date: null,
    time: null,
    ...overrides,
  });

const run = (grade: Grader, calls: ReturnType<typeof writeTool>[], database: EvalDatabase) =>
  grade({ turns: [turnResult({ toolCalls: calls })], database });

describe("loggedItems", () => {
  const database = rowDatabase(seedRows);

  it("should pass when each item has a call with its food, portion and count", async () => {
    const toast: ExpectedItem = { codes: ["11-982"], amount: { grams: 40 } };
    const calls = [
      logEggs(),
      writeTool("log_entry", { kind: "grams", food_id: TOAST_ID, grams: 40, time: null }),
    ];

    expect((await run(loggedItems([eggs, toast], TODAY), calls, database)).passed).toBe(true);
  });

  it("should fail when the food is not one of the item's codes in the database", async () => {
    const outcome = await run(
      loggedItems([{ codes: ["11-982"], amount: { count: 2 } }], TODAY),
      [logEggs()],
      database,
    );

    expect(outcome).toEqual({
      passed: false,
      reason: "no log_entry call matched item 1 of 1 (11-982 2 portions)",
    });
  });

  it("should fail when the portion belongs to another food", async () => {
    const outcome = await run(
      loggedItems([eggs], TODAY),
      [logEggs({ portion_id: "another-portion" })],
      database,
    );

    expect(outcome.passed).toBe(false);
  });

  it("should fail when a portion count was logged as grams, which is a guess", async () => {
    const outcome = await run(
      loggedItems([eggs], TODAY),
      [logEggs({ kind: "grams", portion_id: null, count: null, grams: 100 })],
      database,
    );

    expect(outcome.passed).toBe(false);
  });

  it("should fail when the count is wrong", async () => {
    expect((await run(loggedItems([eggs], TODAY), [logEggs({ count: 3 })], database)).passed).toBe(
      false,
    );
  });

  it("should fail when two items are asked for and one call was made", async () => {
    const outcome = await run(loggedItems([eggs, eggs], TODAY), [logEggs()], database);

    expect(outcome.reason).toBe("no log_entry call matched item 2 of 2 (12-937|12-940 2 portions)");
  });

  it("should accept the time and the day the message named, and none it did not", async () => {
    const named: ExpectedItem = { ...eggs, time: "08:00", date: "2026-11-04" };

    expect(
      (
        await run(
          loggedItems([named], TODAY),
          [logEggs({ time: "08:00", local_date: "2026-11-04" })],
          database,
        )
      ).passed,
    ).toBe(true);
    expect((await run(loggedItems([named], TODAY), [logEggs()], database)).passed).toBe(false);
    expect(
      (await run(loggedItems([eggs], TODAY), [logEggs({ time: "08:00" })], database)).passed,
    ).toBe(false);
  });

  it("should take today's date for no date, and another day for a wrong one", async () => {
    expect(
      (await run(loggedItems([eggs], TODAY), [logEggs({ local_date: TODAY })], database)).passed,
    ).toBe(true);
    expect(
      (await run(loggedItems([eggs], TODAY), [logEggs({ local_date: "2026-11-04" })], database))
        .passed,
    ).toBe(false);
  });

  it("should use a call once, so one call cannot stand for two items", async () => {
    const outcome = await run(loggedItems([eggs, eggs], TODAY), [logEggs(), logEggs()], database);

    expect(outcome.passed).toBe(true);
  });

  it("should fail on an input that is not an object", async () => {
    expect(
      (await run(loggedItems([eggs], TODAY), [writeTool("log_entry", "two eggs")], database))
        .passed,
    ).toBe(false);
  });
});

describe("actionRows", () => {
  const turn = turnResult();
  const database = rowDatabase({
    assistant_actions: [
      { turn_id: turn.turnId, tool: "log_entry" },
      { turn_id: turn.turnId, tool: "log_entry" },
      { turn_id: turn.turnId, tool: "copy_day" },
    ],
  });

  it("should pass when the turn left that many rows for the tool", async () => {
    expect((await actionRows("log_entry", 2)({ turns: [turn], database })).passed).toBe(true);
  });

  it("should fail with the count found when a write was repeated", async () => {
    expect(await actionRows("log_entry", 1)({ turns: [turn], database })).toEqual({
      passed: false,
      reason: "log_entry left 2 action rows, not 1",
    });
  });

  it("should count only the turns it was given", async () => {
    const other = turnResult();

    const outcome = await actionRows("log_entry", 2, [0])({ turns: [turn, other], database });

    expect(outcome.passed).toBe(true);
    expect((await actionRows("log_entry", 2, [1])({ turns: [turn, other], database })).passed).toBe(
      false,
    );
  });
});

describe("noActionRowsInTurn", () => {
  const written = turnResult();
  const quiet = turnResult();
  const database = rowDatabase({ assistant_actions: [{ turn_id: written.turnId, tool: "x" }] });

  it("should pass for a turn that left no row", async () => {
    expect((await noActionRowsInTurn(1)({ turns: [written, quiet], database })).passed).toBe(true);
  });

  it("should fail for a turn that left a row", async () => {
    expect((await noActionRowsInTurn(0)({ turns: [written, quiet], database })).passed).toBe(false);
  });

  it("should fail when the case has no such turn", async () => {
    expect((await noActionRowsInTurn(3)({ turns: [written], database })).reason).toBe(
      "the case has no turn 4",
    );
  });
});

describe("turnEnded", () => {
  it("should pass for the status of that turn and fail for another", async () => {
    const turns = [turnResult({ status: "confirm" }), turnResult({ status: "complete" })];
    const database = rowDatabase({});

    expect((await turnEnded(0, "confirm")({ turns, database })).passed).toBe(true);
    expect((await turnEnded(1, "confirm")({ turns, database })).reason).toBe(
      "turn 2 ended complete, not confirm",
    );
    expect((await turnEnded(5, "confirm")({ turns, database })).reason).toBe(
      "turn 6 ended never, not confirm",
    );
  });
});

describe("rowCount", () => {
  const database = rowDatabase({ food_log_entries: [{ local_date: "2026-11-20", id: "a" }] });
  const turns = [turnResult()];

  it("should pass when exactly that many rows match", async () => {
    const query = { table: "food_log_entries", where: { local_date: "2026-11-20" } } as const;

    expect((await rowCount(query, 1)({ turns, database })).passed).toBe(true);
  });

  it("should fail with the count found", async () => {
    const query = { table: "food_log_entries", where: { local_date: "2026-11-21" } } as const;

    expect(await rowCount(query, 1)({ turns, database })).toEqual({
      passed: false,
      reason: "0 rows of food_log_entries matched, not 1",
    });
  });
});

describe("askedOnce, askedAboutFoodOrAmount and askedAboutSize", () => {
  const database = rowDatabase({});
  const ask = (question: string, replies: string[] = []) =>
    readTool("ask_user", { question, quick_replies: replies });

  it("should pass for exactly one question and fail for none or two", async () => {
    const one = [turnResult({ toolCalls: [ask("How much rice?")] })];
    const two = [turnResult({ toolCalls: [ask("How much rice?"), ask("And chicken?")] })];

    expect((await askedOnce()({ turns: one, database })).passed).toBe(true);
    expect((await askedOnce()({ turns: two, database })).reason).toBe(
      "2 questions were asked, not 1",
    );
    expect((await askedOnce()({ turns: [turnResult()], database })).passed).toBe(false);
  });

  it("should pass when the question or a quick reply speaks of grams", async () => {
    const inQuestion = [turnResult({ toolCalls: [ask("How many grams of rice?")] })];
    const inReplies = [turnResult({ toolCalls: [ask("How much rice?", ["100 g", "150 g"])] })];

    expect((await askedAboutFoodOrAmount()({ turns: inQuestion, database })).passed).toBe(true);
    expect((await askedAboutFoodOrAmount()({ turns: inReplies, database })).passed).toBe(true);
  });

  it("should pass a question about the food or how much of it, in any words", async () => {
    for (const question of [
      "How much rice was it?",
      "Which rice, and how many spoons?",
      "What kind of pasta?",
    ]) {
      const turns = [turnResult({ toolCalls: [ask(question)] })];

      expect((await askedAboutFoodOrAmount()({ turns, database })).passed).toBe(true);
    }
  });

  it("should fail a question about something else, or no question at all", async () => {
    const vague = [turnResult({ toolCalls: [ask("Was it nice?", ["yes", "no"])] })];

    expect((await askedAboutFoodOrAmount()({ turns: vague, database })).passed).toBe(false);
    expect((await askedAboutFoodOrAmount()({ turns: [turnResult()], database })).passed).toBe(
      false,
    );
  });

  it("should pass a question about the size, and fail one that is not about it", async () => {
    const size = [
      turnResult({ toolCalls: [ask("Which size banana?", ["small", "medium", "large"])] }),
    ];
    const other = [turnResult({ toolCalls: [ask("Was it ripe?")] })];

    expect((await askedAboutSize()({ turns: size, database })).passed).toBe(true);
    expect((await askedAboutSize()({ turns: other, database })).passed).toBe(false);
  });
});

describe("onlyTheseTools", () => {
  const database = rowDatabase({});
  const allowed = new Set(["search_foods", "ask_user"]);

  it("should pass when every call is allowed and fail naming the first that is not", async () => {
    const reads = [turnResult({ toolCalls: [readTool("search_foods"), readTool("ask_user")] })];
    const writes = [turnResult({ toolCalls: [readTool("search_foods"), writeTool("log_entry")] })];

    expect((await onlyTheseTools(allowed)({ turns: reads, database })).passed).toBe(true);
    expect((await onlyTheseTools(allowed)({ turns: writes, database })).reason).toBe(
      "log_entry was called",
    );
  });
});

describe("undoOnTurn", () => {
  const turn = turnResult();
  const database = rowDatabase({});

  async function press(outcomes: readonly (readonly UndoOutcome[])[], actions: number) {
    const undo = undoOnTurn(0, actions);
    const answers = [...outcomes];
    const environment = {
      ...fakeEnvironment(),
      undoTurn: () => Promise.resolve(answers.shift() ?? []),
    };
    await undo.afterTurn({ index: 0, result: turn }, environment);
    return undo.undone({ turns: [turn], database });
  }

  it("should pass when the first press undoes every action and the second finds them undone", async () => {
    expect((await press([["undone"], ["already_undone"]], 1)).passed).toBe(true);
  });

  it("should fail when the first press could not undo", async () => {
    expect(await press([["undo_unavailable"], ["already_undone"]], 1)).toEqual({
      passed: false,
      reason:
        "Undo answered undo_unavailable, then already_undone, not 1 undone then 1 already_undone",
    });
  });

  it("should fail when the second press undid it again", async () => {
    expect((await press([["undone"], ["undone"]], 1)).passed).toBe(false);
  });

  it("should fail when the turn wrote fewer actions than the case expects", async () => {
    expect((await press([["undone"], ["already_undone"]], 2)).passed).toBe(false);
  });

  it("should fail when Undo was never pressed", async () => {
    expect(await undoOnTurn(0, 1).undone({ turns: [turn], database })).toEqual({
      passed: false,
      reason: "Undo was not pressed",
    });
  });

  it("should press only on the turn it was made for", async () => {
    const undo = undoOnTurn(1, 1);
    const environment = fakeEnvironment();

    await undo.afterTurn({ index: 0, result: turn }, environment);

    expect(environment.calls).toEqual([]);
  });
});

describe("undoWrites", () => {
  it("should throw, naming what Undo answered, when a write could not be undone", async () => {
    const turn = turnResult();
    const environment = fakeEnvironment({
      undoPresses: { [turn.turnId]: [["undone", "undo_unavailable"]] },
    });

    await expect(undoWrites([turn], environment)).rejects.toThrow(
      "the writes of the case could not be undone (Undo answered undone, undo_unavailable), so they may be left in the diary",
    );
  });

  it("should accept an action that was already undone, as the Undo cases leave it", async () => {
    const turn = turnResult();
    const environment = fakeEnvironment({ undoPresses: { [turn.turnId]: [["already_undone"]] } });

    await expect(undoWrites([turn], environment)).resolves.toBeUndefined();
  });

  it("should press Undo for each turn, the newest first", async () => {
    const environment = fakeEnvironment();
    const first = turnResult();
    const second = turnResult();

    await undoWrites([first, second], environment);

    expect(environment.calls).toEqual([`undo ${second.turnId}`, `undo ${first.turnId}`]);
  });
});

describe("withContext", () => {
  const failing: Grader = () => Promise.resolve({ passed: false, reason: "no row matched" });
  const passing: Grader = () => Promise.resolve({ passed: true, reason: "fine" });
  const database = rowDatabase({});

  it("should add the messages and the tools called, with their arguments, to a failure", async () => {
    const turns = [turnResult({ toolCalls: [writeTool("log_entry", { count: 2 })] })];

    const outcome = await withContext(failing, ["Log two eggs.", "Make it three."])({
      turns,
      database,
    });

    expect(outcome.reason).toBe(
      'no row matched; messages: "Log two eggs." then "Make it three."; tools: log_entry({"count":2})',
    );
  });

  it("should never add the answer of the turn", async () => {
    const turns = [turnResult({ answer: "You ate a secret meal." })];

    const outcome = await withContext(failing, ["Log it."])({ turns, database });

    expect(outcome.reason).not.toContain("secret");
    expect(outcome.reason).toContain("tools: none");
  });

  it("should leave a pass alone", async () => {
    expect(await withContext(passing, ["Log it."])({ turns: [], database })).toEqual({
      passed: true,
      reason: "fine",
    });
  });
});

describe("calledWith", () => {
  const database = rowDatabase({});
  const turns = [
    turnResult({ toolCalls: [writeTool("update_entry", { id: "a", amount: 3, time: null })] }),
  ];

  it("should pass when a call of the tool satisfies the predicate", async () => {
    const outcome = await calledWith(
      "update_entry",
      ({ amount }) => amount === 3,
      "amount 3",
    )({
      turns,
      database,
    });

    expect(outcome.passed).toBe(true);
  });

  it("should fail naming what was wanted when no call satisfies it, or the tool was not called", async () => {
    const wrongArguments = await calledWith(
      "update_entry",
      ({ amount }) => amount === 4,
      "amount 4",
    )({
      turns,
      database,
    });
    const notCalled = await calledWith("delete_entry", () => true, "any")({ turns, database });

    expect(wrongArguments.reason).toBe("update_entry was not called with amount 4");
    expect(notCalled.reason).toBe("delete_entry was not called with any");
  });

  it("should not take an input that is not an object for a match", async () => {
    const strings = [turnResult({ toolCalls: [writeTool("update_entry", "three")] })];

    expect(
      (await calledWith("update_entry", () => true, "any")({ turns: strings, database })).passed,
    ).toBe(false);
  });
});

describe("the confirmation graders", () => {
  const database = rowDatabase({});
  const asked = turnResult({
    status: "confirm",
    confirmation: {
      question:
        "Change your calorie target from 1,300 to 2,000 kcal?\n\nYour macros will be adjusted.",
      confirmLabel: "Change target",
      cancelLabel: "Keep 1,300",
    },
  });

  it("should pass when the question ends with the line, and fail when it does not", async () => {
    const turns = [asked];

    expect(
      (await confirmationEndsWith(0, "Your macros will be adjusted.")({ turns, database })).passed,
    ).toBe(true);
    expect((await confirmationEndsWith(0, "Something else.")({ turns, database })).reason).toBe(
      "the question of turn 1 does not end with the expected line",
    );
  });

  it("should fail when the turn asked for no confirmation", async () => {
    const turns = [turnResult()];

    expect((await confirmationEndsWith(0, "x")({ turns, database })).reason).toBe(
      "turn 1 asked for no confirmation",
    );
    expect((await confirmationLacks(0, "x")({ turns, database })).reason).toBe(
      "turn 1 asked for no confirmation",
    );
  });

  it("should pass when the question lacks the text, and fail when it holds it", async () => {
    const turns = [asked];

    expect((await confirmationLacks(0, "gram")({ turns, database })).passed).toBe(true);
    expect((await confirmationLacks(0, "adjusted")({ turns, database })).passed).toBe(false);
  });
});

describe("noQuestionsAsked", () => {
  const database = rowDatabase({});

  it("should pass when ask_user was never called and fail when it was", async () => {
    const asking = [turnResult({ toolCalls: [readTool("ask_user", { question: "How many?" })] })];

    expect((await noQuestionsAsked()({ turns: [turnResult()], database })).passed).toBe(true);
    expect((await noQuestionsAsked()({ turns: asking, database })).reason).toBe(
      "1 questions were asked, not 0",
    );
  });
});

describe("readBeforeFirstLog", () => {
  const database = rowDatabase({});
  const day = "2026-11-04";

  it("should pass when the day was read by get_entries before the first log_entry", async () => {
    const turns = [
      turnResult({
        toolCalls: [
          readTool("get_entries", { from: day, to: day, from_time: "12:00", to_time: "14:00" }),
          writeTool("log_entry", {}),
        ],
      }),
    ];

    expect((await readBeforeFirstLog(day)({ turns, database })).passed).toBe(true);
  });

  it("should pass for get_day of that day", async () => {
    const turns = [
      turnResult({
        toolCalls: [readTool("get_day", { local_date: day }), writeTool("log_entry", {})],
      }),
    ];

    expect((await readBeforeFirstLog(day)({ turns, database })).passed).toBe(true);
  });

  it("should fail when the first log_entry came before the read", async () => {
    const turns = [
      turnResult({
        toolCalls: [writeTool("log_entry", {}), readTool("get_entries", { from: day, to: day })],
      }),
    ];

    expect((await readBeforeFirstLog(day)({ turns, database })).reason).toBe(
      "the entries of 2026-11-04 were not read before the first log_entry",
    );
  });

  it("should fail when another day was read, or nothing was logged", async () => {
    const otherDay = [
      turnResult({
        toolCalls: [
          readTool("get_entries", { from: "2026-11-01", to: "2026-11-02" }),
          writeTool("log_entry", {}),
        ],
      }),
    ];
    const nothingLogged = [turnResult({ toolCalls: [readTool("get_day", { local_date: day })] })];

    expect((await readBeforeFirstLog(day)({ turns: otherDay, database })).passed).toBe(false);
    expect((await readBeforeFirstLog(day)({ turns: nothingLogged, database })).passed).toBe(false);
  });
});

describe("an item at any time", () => {
  it("should accept a log_entry that carries a time when the item allows any", async () => {
    const database = rowDatabase(seedRows);
    const anyTime: ExpectedItem = { ...eggs, time: "any" };

    expect(
      (await run(loggedItems([anyTime], TODAY), [logEggs({ time: "12:30" })], database)).passed,
    ).toBe(true);
    expect((await run(loggedItems([anyTime], TODAY), [logEggs()], database)).passed).toBe(true);
  });
});

describe("an item as a portion of any count, and a time in the morning", () => {
  const database = rowDatabase(seedRows);

  it("should accept any positive count of a portion of the food", async () => {
    const anyCount: ExpectedItem = { codes: ["12-940"], amount: { portion: true } };

    expect(
      (await run(loggedItems([anyCount], TODAY), [logEggs({ count: 3 })], database)).passed,
    ).toBe(true);
    expect(
      (
        await run(
          loggedItems([anyCount], TODAY),
          [logEggs({ kind: "grams", portion_id: null, count: null, grams: 100 })],
          database,
        )
      ).passed,
    ).toBe(false);
  });

  it("should accept no time or a morning time, and fail an afternoon one", async () => {
    const morning: ExpectedItem = { ...eggs, time: "morning" };

    expect((await run(loggedItems([morning], TODAY), [logEggs()], database)).passed).toBe(true);
    expect(
      (await run(loggedItems([morning], TODAY), [logEggs({ time: "08:00" })], database)).passed,
    ).toBe(true);
    expect(
      (await run(loggedItems([morning], TODAY), [logEggs({ time: "15:00" })], database)).passed,
    ).toBe(false);
  });

  it("should look only at the turns it was given", async () => {
    const turns = [turnResult({ toolCalls: [] }), turnResult({ toolCalls: [logEggs()] })];

    expect((await loggedItems([eggs], TODAY, [0])({ turns, database })).passed).toBe(false);
    expect((await loggedItems([eggs], TODAY, [1])({ turns, database })).passed).toBe(true);
  });
});

describe("loggedRows", () => {
  const turn = turnResult();
  const rows = (
    entry: Record<string, string | number | null>,
    extra: Record<string, unknown> = {},
  ) =>
    rowDatabase({
      ...seedRows,
      assistant_actions: [{ turn_id: turn.turnId, tool: "log_entry", target_id: "entry-1" }],
      food_log_entries: [
        {
          id: "entry-1",
          food_id: EGG_ID,
          portion_id: EGG_PORTION_ID,
          unit: "portion",
          quantity: 2,
          local_date: TODAY,
          deleted_at: null,
          ...entry,
          ...(extra as Record<string, string | number | null>),
        },
      ],
    });

  it("should pass when the row the write left is the food, the portion and the count", async () => {
    expect((await loggedRows([eggs], TODAY)({ turns: [turn], database: rows({}) })).passed).toBe(
      true,
    );
  });

  it("should fail when the row holds another count, which a right-looking call would not show", async () => {
    const outcome = await loggedRows(
      [eggs],
      TODAY,
    )({ turns: [turn], database: rows({ quantity: 3 }) });

    expect(outcome).toEqual({
      passed: false,
      reason: "no logged entry matched item 1 of 1 (12-937|12-940 2 portions)",
    });
  });

  it("should fail when the row is on another day or another food", async () => {
    expect(
      (
        await loggedRows(
          [eggs],
          TODAY,
        )({ turns: [turn], database: rows({ local_date: "2026-11-04" }) })
      ).passed,
    ).toBe(false);
    expect(
      (await loggedRows([eggs], TODAY)({ turns: [turn], database: rows({ food_id: TOAST_ID }) }))
        .passed,
    ).toBe(false);
  });

  it("should read grams as the unit g and the quantity", async () => {
    const grams: ExpectedItem = { codes: ["11-982"], amount: { grams: 40 } };
    const database = rows({ food_id: TOAST_ID, portion_id: null, unit: "g", quantity: 40 });

    expect((await loggedRows([grams], TODAY)({ turns: [turn], database })).passed).toBe(true);
  });

  it("should fail when the write left no row", async () => {
    const database = rowDatabase({ ...seedRows });

    expect((await loggedRows([eggs], TODAY)({ turns: [turn], database })).passed).toBe(false);
  });
});

describe("cardOfKind", () => {
  const database = rowDatabase({});
  const card = (kind: AssistantCard["kind"]): AssistantCard => ({
    actionIds: ["33333333-3333-4333-8333-333333333333"],
    kind,
    title: "Title",
    sub: null,
    rows: [],
    totalText: null,
    note: null,
    link: null,
    undo: "available",
    undoneSub: null,
  });

  it("should pass when the turn sent a card of that kind and fail when it sent another or none", async () => {
    const turns = [turnResult({ cards: [card("logged")] }), turnResult()];

    expect((await cardOfKind(0, "logged")({ turns, database })).passed).toBe(true);
    expect((await cardOfKind(0, "deleted")({ turns, database })).reason).toBe(
      "turn 1 sent no deleted card",
    );
    expect((await cardOfKind(1, "logged")({ turns, database })).reason).toBe(
      "turn 2 sent no logged card",
    );
  });
});

describe("anyOfRoutes", () => {
  const database = rowDatabase({});
  const passes: Grader = () => Promise.resolve({ passed: true, reason: "yes" });
  const fails =
    (reason: string): Grader =>
    () =>
      Promise.resolve({ passed: false, reason });

  it("should pass when every grader of one route passes", async () => {
    const outcome = await anyOfRoutes([
      [fails("a"), passes],
      [passes, passes],
    ])({ turns: [], database });

    expect(outcome.passed).toBe(true);
  });

  it("should fail with the reasons of the route that came closest", async () => {
    const outcome = await anyOfRoutes([
      [fails("a"), fails("b")],
      [passes, fails("c")],
    ])({ turns: [], database });

    expect(outcome).toEqual({ passed: false, reason: "no route passed, the closest failed on: c" });
  });
});

describe("noGuessedAmounts and onlyFoodsOf", () => {
  const database = rowDatabase(seedRows);

  it("should pass only portion kinds, and fail a gram or millilitre guess", async () => {
    expect((await run(noGuessedAmounts(), [logEggs()], database)).passed).toBe(true);
    expect(
      (await run(noGuessedAmounts(), [logEggs({ kind: "grams", grams: 10 })], database)).reason,
    ).toBe("log_entry guessed an amount (kind grams)");
  });

  it("should pass foods of the codes and fail another food", async () => {
    expect((await run(onlyFoodsOf(["12-940"]), [logEggs()], database)).passed).toBe(true);
    expect((await run(onlyFoodsOf(["11-982"]), [logEggs()], database)).passed).toBe(false);
  });
});

describe("oneRowPerToolPerMessage", () => {
  const first = turnResult();
  const second = turnResult();
  const action = (turn: { turnId: string }, tool: string, target: string) => ({
    turn_id: turn.turnId,
    tool,
    target_id: target,
  });

  it("should pass when each turn wrote its own entry", async () => {
    const database = rowDatabase({
      assistant_actions: [action(first, "log_entry", "a"), action(second, "log_entry", "b")],
    });

    expect((await oneRowPerToolPerMessage()({ turns: [first, second], database })).passed).toBe(
      true,
    );
  });

  it("should pass when the second turn wrote nothing", async () => {
    const database = rowDatabase({ assistant_actions: [action(first, "log_entry", "a")] });

    expect((await oneRowPerToolPerMessage()({ turns: [first, second], database })).passed).toBe(
      true,
    );
  });

  it("should fail when two turns name the same target, which is a write replayed", async () => {
    const database = rowDatabase({
      assistant_actions: [action(first, "log_entry", "a"), action(second, "log_entry", "a")],
    });

    expect((await oneRowPerToolPerMessage()({ turns: [first, second], database })).reason).toBe(
      "a write of turn 1 was written again in turn 2",
    );
  });

  it("should fail when one turn left two rows for one tool, which is a write repeated", async () => {
    const database = rowDatabase({
      assistant_actions: [action(first, "log_entry", "a"), action(first, "log_entry", "b")],
    });

    expect((await oneRowPerToolPerMessage()({ turns: [first, second], database })).reason).toBe(
      "turn 1 left 2 log_entry rows for one message",
    );
  });
});
