import { describe, expect, it } from "vitest";

import { fakeDatabase, readTool, turnResult } from "./helpers.ts";
import { rowDatabase } from "./rowDatabase.ts";
import {
  additionStoredOnce,
  betaAccepted,
  kitchenStaysHidden,
  kitchenProbeCases,
  secondTurnReadsThePrefix,
} from "../cases/kitchenProbe.ts";
import { OPT_IN_SET_NAMES, THRESHOLD_PERCENT } from "../src/thresholds.ts";

// Nothing here asks a model: the graders get turns made by hand, as a working stack would leave them and as a broken one would.

const first = turnResult({ toolCalls: [readTool("kitchen_probe")] });
const second = turnResult();
const turns = [first, second];

const systemRow = (turnId: string) => ({ turn_id: turnId, role: "system" });

describe("the kitchenProbe set", () => {
  it("should be two opt-in cases that must pass, at 100 %", () => {
    expect(kitchenProbeCases).toHaveLength(2);
    expect(kitchenProbeCases.every((candidate) => candidate.mustPass === true)).toBe(true);
    expect(THRESHOLD_PERCENT.kitchenProbe).toBe(100);
    expect(OPT_IN_SET_NAMES).toContain("kitchenProbe");
  });

  it("should send the kitchen turn first and a plain follow-up second", () => {
    expect(kitchenProbeCases[0]?.messages).toEqual([
      "Make me a meal plan for next week",
      "Thanks, and what is a good source of fibre?",
    ]);
  });
});

describe("betaAccepted", () => {
  const usage = { [first.turnId]: { inputTokens: 5 }, [second.turnId]: { inputTokens: 5 } };

  it("should pass when both turns completed with a model call", async () => {
    const outcome = await betaAccepted()({
      turns,
      database: fakeDatabase({ usageByTurnId: usage }),
    });

    expect(outcome.passed).toBe(true);
  });

  it("should fail when the API refused the request and the turn failed", async () => {
    const failed = turnResult({ status: "failed", noticeCode: "turn_failed" });

    const outcome = await betaAccepted()({
      turns: [failed, second],
      database: fakeDatabase({ usageByTurnId: { ...usage, [failed.turnId]: { inputTokens: 5 } } }),
    });

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toContain("turn_failed");
  });

  it("should fail when a turn made no model call", async () => {
    const outcome = await betaAccepted()({
      turns,
      database: fakeDatabase({ usageByTurnId: { [first.turnId]: { inputTokens: 5 } } }),
    });

    expect(outcome.passed).toBe(false);
  });
});

describe("additionStoredOnce", () => {
  it("should pass with one system row on turn 1 and none on turn 2", async () => {
    const outcome = await additionStoredOnce()({
      turns,
      database: rowDatabase({ assistant_messages: [systemRow(first.turnId)] }),
    });

    expect(outcome.passed).toBe(true);
  });

  it("should fail when the row is missing", async () => {
    const outcome = await additionStoredOnce()({ turns, database: rowDatabase({}) });

    expect(outcome.passed).toBe(false);
  });

  it("should fail when turn 2 stored a second one", async () => {
    const outcome = await additionStoredOnce()({
      turns,
      database: rowDatabase({
        assistant_messages: [systemRow(first.turnId), systemRow(second.turnId)],
      }),
    });

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toContain("1 on turn 2");
  });
});

describe("secondTurnReadsThePrefix", () => {
  const database = (read: number) =>
    fakeDatabase({
      firstCallByTurnId: {
        [first.turnId]: { inputTokens: 300, cacheCreationInputTokens: 27_000 },
        [second.turnId]: { inputTokens: 400, cacheReadInputTokens: read },
      },
    });

  it("should pass when turn 2 reads the first call's prompt less the message and the addition", async () => {
    const outcome = await secondTurnReadsThePrefix()({ turns, database: database(26_600) });

    expect(outcome.passed).toBe(true);
    expect(outcome.reason).toContain("cache_read 26600");
  });

  it("should fail when turn 2 reads only part of the prefix", async () => {
    const outcome = await secondTurnReadsThePrefix()({ turns, database: database(0) });

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toContain("at least 26500");
  });

  it("should fail when a turn has no usage row", async () => {
    const outcome = await secondTurnReadsThePrefix()({ turns, database: fakeDatabase() });

    expect(outcome.passed).toBe(false);
  });
});

describe("kitchenStaysHidden", () => {
  const plain = turnResult();

  it("should pass when a plain turn stored no system row and called no kitchen tool", async () => {
    const outcome = await kitchenStaysHidden()({ turns: [plain], database: rowDatabase({}) });

    expect(outcome.passed).toBe(true);
  });

  it("should fail when a plain turn stored a system row", async () => {
    const outcome = await kitchenStaysHidden()({
      turns: [plain],
      database: rowDatabase({ assistant_messages: [systemRow(plain.turnId)] }),
    });

    expect(outcome.passed).toBe(false);
  });

  it("should fail when a plain turn called kitchen_probe, so defer_loading was ignored", async () => {
    const called = turnResult({ toolCalls: [readTool("kitchen_probe")] });

    const outcome = await kitchenStaysHidden()({ turns: [called], database: rowDatabase({}) });

    expect(outcome.passed).toBe(false);
    expect(outcome.reason).toContain("1 times");
  });
});
