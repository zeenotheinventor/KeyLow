import { describe, expect, it } from "vitest";

import { costing, fakeDatabase, scriptedStack } from "./helpers.ts";
import { compactionCases, compactionSeed } from "../cases/compaction.ts";
import { runEvals } from "../src/runEvals.ts";

import type { CaseEnvironment, SeedTurn } from "../src/case.ts";

const EARLY_REPLY = "Your average last week was 1,850 kcal a day";

describe("the compaction seed", () => {
  const seed = compactionSeed();
  const allText = seed.flatMap((turn) => [turn.user, turn.assistant]);

  it("should be long enough that the next turn passes the 40,000 token threshold with room to spare", () => {
    // 40,000 is DEFAULT_COMPACT_AT_TOKENS in the assistant's compact.ts, which this folder cannot import. The
    // system prompt and the tools are at least 22,000 tokens (the first call of a one-message conversation
    // measured 22,396 in KEY-927). Plain English is at most about 4.5 characters a token, so dividing by it
    // gives the fewest tokens the history can be. The turn must land 10 % above the threshold even then.
    const fewestPrefixTokens = 22_000;
    const mostCharactersPerToken = 4.5;
    const thresholdTokens = 40_000;
    const fewestPromptTokens =
      fewestPrefixTokens + allText.join("").length / mostCharactersPerToken;

    expect(fewestPromptTokens).toBeGreaterThanOrEqual(thresholdTokens * 1.1);
  });

  it("should hold the early reply once, near the start", () => {
    const holders = seed.flatMap((turn, index) =>
      turn.assistant.includes(EARLY_REPLY) ? [index] : [],
    );

    expect(holders).toHaveLength(1);
    expect(holders[0]).toBeLessThan(5);
  });

  it("should say 1,850 nowhere else", () => {
    expect(allText.filter((text) => text.includes("1,850"))).toHaveLength(1);
  });

  it("should be plain text with no tags, em dash or tool trace", () => {
    for (const text of allText) {
      expect(text).not.toMatch(/[<>—]/);
      expect(text.trim()).not.toBe("");
    }
  });
});

describe("the compaction case", () => {
  const [compactionCase] = compactionCases;

  const environment = (log: string[]): CaseEnvironment => ({
    seedConversation: (turns: readonly SeedTurn[]) => {
      log.push(`seed ${turns.length}`);
      return Promise.resolve("seeded");
    },
    waitForCompaction: (conversationId) => {
      log.push(`wait ${conversationId}`);
      return Promise.resolve();
    },
    undoTurn: () => Promise.resolve([]),
    restoreTargets: () => Promise.resolve(),
  });

  async function play(secondAnswer: string, log: string[] = []) {
    if (compactionCase === undefined) {
      throw new Error("the compaction case is not registered");
    }
    const stack = scriptedStack([
      costing(25_000, {
        conversationId: "seeded",
        turnId: "trigger-turn",
        answer: "Glad to help.",
      }),
      costing(3_000, { conversationId: "seeded", answer: secondAnswer }),
    ]);
    const database = fakeDatabase({ rowCounts: { assistant_conversations: 1 } });
    const report = await runEvals({
      cases: [compactionCase],
      driver: stack.driver,
      database: { ...stack.database, countRows: database.countRows },
      environment: environment(log),
      budgetTokens: 300_000,
    });
    return { report, sent: stack.driver.sent, queries: database.queries, log };
  }

  it("should be the one case of the compaction set", () => {
    expect(compactionCases).toHaveLength(1);
    expect(compactionCase?.set).toBe("compaction");
  });

  it("should seed the conversation, send the trigger and then the question, waiting in between", async () => {
    const { sent, log } = await play("You told me 1,850 kcal a day.");

    expect(log).toEqual(["seed 66", "wait seeded"]);
    expect(sent.map(({ conversationId }) => conversationId)).toEqual(["seeded", "seeded"]);
    expect(sent[1]?.text).toBe("What did you tell me my daily average was last week?");
  });

  it("should pass when the note was stored for the first turn and the answer holds 1,850", async () => {
    const { report, queries } = await play("You told me 1,850 kcal a day.");

    expect(report.cases[0]).toMatchObject({ status: "passed", failures: [] });
    expect(queries).toContainEqual({
      table: "assistant_conversations",
      where: { id: "seeded", compacted_through_turn_id: "trigger-turn" },
    });
  });

  it("should fail when the answer has another number", async () => {
    const { report } = await play("You told me 1,950 kcal a day.");

    expect(report.cases[0]).toMatchObject({ status: "failed" });
    expect(report.cases[0]?.failures).toEqual(["the answer has no number within 0 of 1850"]);
  });

  it("should fail when no note was stored", async () => {
    if (compactionCase === undefined) {
      throw new Error("the compaction case is not registered");
    }
    const stack = scriptedStack([
      costing(25_000, { conversationId: "seeded", turnId: "trigger-turn" }),
      costing(3_000, { conversationId: "seeded", answer: "1,850 kcal a day." }),
    ]);

    const report = await runEvals({
      cases: [compactionCase],
      ...stack,
      environment: environment([]),
      budgetTokens: 300_000,
    });

    expect(report.cases[0]).toMatchObject({
      status: "failed",
      failures: ["no row in assistant_conversations matched"],
    });
  });
});
