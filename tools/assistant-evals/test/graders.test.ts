import { describe, expect, it } from "vitest";

import { fakeDatabase, readTool, turnResult, writeTool } from "./helpers.ts";
import {
  answerContainsNumber,
  cacheReadOnSecondTurn,
  clarifyingQuestion,
  noActionRows,
  noWrite,
  refused,
  rowsExist,
  toolCalled,
} from "../src/case.ts";

import type { GradeContext } from "../src/case.ts";
import type { RowQuery, TurnResult } from "../src/types.ts";

const contextOf = (turns: TurnResult[], database = fakeDatabase()): GradeContext => ({
  turns,
  database,
});

describe("toolCalled", () => {
  it("should pass when a turn called the tool", async () => {
    const turn = turnResult({ toolCalls: [readTool("get_day")] });

    const outcome = await toolCalled("get_day")(contextOf([turn]));

    expect(outcome.passed).toBe(true);
  });

  it("should fail and name the tool when no turn called it", async () => {
    const turn = turnResult({ toolCalls: [readTool("get_day")] });

    const outcome = await toolCalled("log_entry")(contextOf([turn]));

    expect(outcome).toEqual({ passed: false, reason: "log_entry was not called" });
  });

  it("should find a call in a later turn of the case", async () => {
    const turns = [turnResult(), turnResult({ toolCalls: [writeTool("log_entry")] })];

    const outcome = await toolCalled("log_entry")(contextOf(turns));

    expect(outcome.passed).toBe(true);
  });

  it("should pass only when the arguments match", async () => {
    const turn = turnResult({ toolCalls: [readTool("get_day", { date: "2026-10-12" })] });
    const sameDay = (input: unknown) =>
      typeof input === "object" && input !== null && "date" in input && input.date === "2026-10-12";

    const matching = await toolCalled("get_day", sameDay)(contextOf([turn]));
    const otherDay = await toolCalled("get_day", () => false)(contextOf([turn]));

    expect(matching.passed).toBe(true);
    expect(otherDay).toEqual({
      passed: false,
      reason: "get_day was called but not with the expected arguments",
    });
  });

  it("should pass when only one of several calls of the tool has the arguments", async () => {
    const turn = turnResult({
      toolCalls: [
        readTool("get_day", { date: "2026-10-11" }),
        readTool("get_day", { date: "2026-10-12" }),
      ],
    });
    const secondDay = (input: unknown) =>
      typeof input === "object" && input !== null && "date" in input && input.date === "2026-10-12";

    expect((await toolCalled("get_day", secondDay)(contextOf([turn]))).passed).toBe(true);
  });
});

describe("noWrite", () => {
  it("should pass when every tool call was a read", async () => {
    const turn = turnResult({ toolCalls: [readTool("get_day"), readTool("search_foods")] });

    expect((await noWrite()(contextOf([turn]))).passed).toBe(true);
  });

  it("should pass when no tool was called", async () => {
    expect((await noWrite()(contextOf([turnResult()]))).passed).toBe(true);
  });

  it("should fail and name the write tool when one was called", async () => {
    const turn = turnResult({ toolCalls: [readTool("get_day"), writeTool("delete_entry")] });

    const outcome = await noWrite()(contextOf([turn]));

    expect(outcome).toEqual({ passed: false, reason: "delete_entry wrote" });
  });

  it("should treat a tool with no read-only hint as a write", async () => {
    const turn = turnResult({ toolCalls: [{ name: "mystery_tool", input: {} }] });

    const outcome = await noWrite()(contextOf([turn]));

    expect(outcome).toEqual({ passed: false, reason: "mystery_tool wrote" });
  });

  it("should find a write in the last turn of several", async () => {
    const turns = [turnResult(), turnResult(), turnResult({ toolCalls: [writeTool("log_entry")] })];

    expect((await noWrite()(contextOf(turns))).passed).toBe(false);
  });

  it("should find a write in an earlier turn", async () => {
    const turns = [turnResult({ toolCalls: [writeTool("log_entry")] }), turnResult()];

    expect((await noWrite()(contextOf(turns))).passed).toBe(false);
  });
});

describe("noActionRows", () => {
  it("should pass when no assistant_actions row belongs to any turn of the case", async () => {
    const turns = [turnResult(), turnResult()];
    const database = fakeDatabase();

    const outcome = await noActionRows()(contextOf(turns, database));

    expect(outcome.passed).toBe(true);
    expect(database.queries).toEqual(
      turns.map(({ turnId }) => ({ table: "assistant_actions", where: { turn_id: turnId } })),
    );
  });

  it("should fail when only the last turn of the case left an action row", async () => {
    const turns = [turnResult(), turnResult(), turnResult()];
    const lastTurnId = turns.at(-1)?.turnId;
    const database = {
      ...fakeDatabase(),
      countRows: (query: RowQuery) =>
        Promise.resolve(query.where["turn_id"] === lastTurnId ? 1 : 0),
    };

    expect((await noActionRows()(contextOf(turns, database))).passed).toBe(false);
  });

  it("should fail when a turn of the case left an action row", async () => {
    const database = fakeDatabase({ rowCounts: { assistant_actions: 1 } });

    const outcome = await noActionRows()(contextOf([turnResult()], database));

    expect(outcome).toEqual({ passed: false, reason: "the case left rows in assistant_actions" });
  });
});

describe("rowsExist", () => {
  const query: RowQuery = { table: "food_log_entries", where: { local_date: "2026-10-12" } };

  it("should pass when the database holds at least one matching row", async () => {
    const database = fakeDatabase({ rowCounts: { food_log_entries: 2 } });

    const outcome = await rowsExist(query)(contextOf([turnResult()], database));

    expect(outcome.passed).toBe(true);
    expect(database.queries).toEqual([query]);
  });

  it("should fail and name the table when no row matches", async () => {
    const outcome = await rowsExist(query)(contextOf([turnResult()]));

    expect(outcome).toEqual({ passed: false, reason: "no row in food_log_entries matched" });
  });
});

describe("answerContainsNumber", () => {
  const passes = async (value: number, answer: string, tolerance = 0) =>
    (await answerContainsNumber(value, tolerance)(contextOf([turnResult({ answer })]))).passed;

  it("should fail with the number it wanted when the answer has none near it", async () => {
    const outcome = await answerContainsNumber(1840)(
      contextOf([turnResult({ answer: "I could not find that." })]),
    );

    expect(outcome).toEqual({ passed: false, reason: "the answer has no number within 0 of 1840" });
  });

  it("should read the answer of the last turn only", async () => {
    const turns = [turnResult({ answer: "1840" }), turnResult({ answer: "No idea." })];

    expect((await answerContainsNumber(1840)(contextOf(turns))).passed).toBe(false);
  });

  it("should fail when there are no turns", async () => {
    expect((await answerContainsNumber(0)(contextOf([]))).passed).toBe(false);
  });

  describe("reading a number", () => {
    it.each([
      [1840, "You averaged 1840 kcal.", true],
      [1840, "About 1,840 kcal a day.", true],
      [1840, "1840.0", true],
      [1840, "approximately 1840kcal", true],
      [1234567, "1,234,567", true],
      [1234.5, "1,234.5", true],
      [81.4, "Down to 81.4 kg", true],
      [0, "no entries, 0 kcal", true],
      [1840, "You ate 18400 kcal", false],
      [1840, "Total: 1,8400", false],
      [1000, "1,0000", false],
      [1840, "1840.5 kcal", false],
      [1234, "1,234.5", false],
      [1840, "1 840 kcal", false],
      [1840, "1.840 kcal", false],
      [840, "1.840 kcal", false],
      [1840, "1.84e3", false],
      [18, "1,8 and 40", false],
      [100, "1,00 0", false],
      [1.5, "1,5 kg", false],
      [150, "1,50", false],
      [0, "nothing", false],
      [3, "three", false],
      [1840, "NaN", false],
    ])("should read %d in %j as %s", async (value, answer, expected) => {
      expect(await passes(value, answer)).toBe(expected);
    });
  });

  describe("reading a minus sign", () => {
    it.each([
      [-0.5, "lost -0.5 kg", true],
      [0.5, "lost -0.5 kg", false],
      [0.5, "lost 0.5 kg", true],
      [-5, "a change of (-5) kg", true],
      [-5, "-5 kg overall", true],
      [-1840, "−1840", true],
      [1840, "−1840", false],
      [1840, "1840–1850", true],
      [1850, "1840-1850", true],
      [-1850, "1840-1850", false],
      [1850, "1840–1850", true],
      [-1850, "1840–1850", false],
    ])("should read %d in %j as %s", async (value, answer, expected) => {
      expect(await passes(value, answer)).toBe(expected);
    });
  });

  describe("leaving out dates", () => {
    it.each([
      [5, "on 2026-11-05 you ate", false],
      [2026, "on 2026-11-05 you ate", false],
      [11, "on 2026-11-05 you ate", false],
      [5, "the 5th", false],
      [5, "on 5 Nov you ate", false],
      [5, "on Nov 5 you ate", false],
      [3, "on the 3rd of March", false],
      [6, "12 entries, 6 to 12 Oct", false],
      [12, "12 entries, 6 to 12 Oct", true],
      [12, "6 to 12 Oct, 12 entries", true],
      [6, "6 to 12 Oct", false],
      [6, "6–12 Oct, 12 entries", false],
      [12, "6–12 Oct, 12 entries", true],
      [1840, "On 5 Nov you ate 1840 kcal.", true],
      [12, "12/10", true],
    ])("should read %d in %j as %s", async (value, answer, expected) => {
      expect(await passes(value, answer)).toBe(expected);
    });
  });

  describe("the tolerance", () => {
    it("should pass within the tolerance and fail outside it", async () => {
      expect(await passes(1840, "Roughly 1,832 kcal.", 10)).toBe(true);
      expect(await passes(1840, "Roughly 1,832 kcal.", 5)).toBe(false);
    });

    it.each([
      [10, "9.5", 0.5, true],
      [10, "10.6", 0.5, false],
      [10, "10.1", 0.1, true],
      [0.3, "0.4", 0.1, true],
      [0.3, "0.2", 0.1, true],
      [0.3, "0.5", 0.1, false],
      [0.3, "0.1", 0.1, false],
    ])("should read %d in %j within ±%d as %s", async (value, answer, tolerance, expected) => {
      expect(await passes(value, answer, tolerance)).toBe(expected);
    });
  });
});

describe("clarifyingQuestion", () => {
  it("should pass when the last turn ended asking a question", async () => {
    const turn = turnResult({ status: "clarify" });

    expect((await clarifyingQuestion()(contextOf([turn]))).passed).toBe(true);
  });

  it("should fail and name the status when the turn answered instead", async () => {
    const outcome = await clarifyingQuestion()(contextOf([turnResult({ status: "complete" })]));

    expect(outcome).toEqual({ passed: false, reason: "the last turn ended complete, not clarify" });
  });

  it("should read the last turn, not the first", async () => {
    const asksFirst = [turnResult({ status: "clarify" }), turnResult({ status: "complete" })];
    const asksLast = [turnResult({ status: "complete" }), turnResult({ status: "clarify" })];

    expect((await clarifyingQuestion()(contextOf(asksFirst))).passed).toBe(false);
    expect((await clarifyingQuestion()(contextOf(asksLast))).passed).toBe(true);
  });
});

describe("refused", () => {
  it("should pass when the last turn ended refused", async () => {
    expect((await refused()(contextOf([turnResult({ status: "refused" })]))).passed).toBe(true);
  });

  it("should fail and name the status when the turn did not refuse", async () => {
    const outcome = await refused()(contextOf([turnResult({ status: "complete" })]));

    expect(outcome).toEqual({ passed: false, reason: "the last turn ended complete, not refused" });
  });
});

describe("cacheReadOnSecondTurn", () => {
  const turnsWithUsage = (
    first: Record<string, number>,
    second: Record<string, number>,
    secondFirstCall?: Record<string, number>,
  ) => {
    const turns = [turnResult(), turnResult()];
    const [firstTurn, secondTurn] = turns;
    const database = fakeDatabase({
      usageByTurnId: { [firstTurn?.turnId ?? ""]: first, [secondTurn?.turnId ?? ""]: second },
      ...(secondFirstCall === undefined
        ? {}
        : { firstCallByTurnId: { [secondTurn?.turnId ?? ""]: secondFirstCall } }),
    });
    return contextOf(turns, database);
  };

  it("should pass when the second turn read from the cache", async () => {
    const outcome = await cacheReadOnSecondTurn()(
      turnsWithUsage({}, { cacheReadInputTokens: 2_048 }),
    );

    expect(outcome.passed).toBe(true);
  });

  it("should fail when the second turn read nothing from the cache", async () => {
    const outcome = await cacheReadOnSecondTurn()(turnsWithUsage({}, { inputTokens: 5 }));

    expect(outcome).toEqual({
      passed: false,
      reason: "the first model call of the second turn read 0 tokens from the cache",
    });
  });

  it("should not count a cache read in the first turn", async () => {
    const outcome = await cacheReadOnSecondTurn()(
      turnsWithUsage({ cacheReadInputTokens: 2_048 }, { inputTokens: 5 }),
    );

    expect(outcome.passed).toBe(false);
  });

  it("should judge the first model call of the second turn, not the later calls of its tool rounds", async () => {
    const coldFirstCall = turnsWithUsage(
      {},
      { cacheReadInputTokens: 2_048 },
      { cacheReadInputTokens: 0, inputTokens: 5 },
    );
    const warmFirstCall = turnsWithUsage(
      {},
      { cacheReadInputTokens: 2_048 },
      { cacheReadInputTokens: 2_048 },
    );

    expect((await cacheReadOnSecondTurn()(coldFirstCall)).passed).toBe(false);
    expect((await cacheReadOnSecondTurn()(warmFirstCall)).passed).toBe(true);
  });

  it("should fail when the second turn has no usage row", async () => {
    const outcome = await cacheReadOnSecondTurn()(contextOf([turnResult(), turnResult()]));

    expect(outcome).toEqual({
      passed: false,
      reason: "the second turn has no assistant_usage row",
    });
  });

  it("should fail when the case has only one turn", async () => {
    const outcome = await cacheReadOnSecondTurn()(contextOf([turnResult()]));

    expect(outcome).toEqual({ passed: false, reason: "the case has no second turn" });
  });
});
