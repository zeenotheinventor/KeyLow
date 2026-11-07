import { describe, expect, it } from "vitest";

import { fakeEnvironment } from "./fakeEnvironment.ts";
import { costing, readTool, scriptedStack, turnResult, writeTool } from "./helpers.ts";
import {
  cacheReadOnSecondTurn,
  clarifyingQuestion,
  noWrite,
  rowsExist,
  toolCalled,
} from "../src/case.ts";
import { runEvals } from "../src/runEvals.ts";

import type { ScriptedTurn } from "./helpers.ts";
import type { CaseEnvironment, EvalCase } from "../src/case.ts";

const simpleCase = (id: string, overrides: Partial<EvalCase> = {}): EvalCase => ({
  id,
  set: "ask",
  messages: ["How much protein did I eat?"],
  expect: [],
  ...overrides,
});

const run = (cases: EvalCase[], script: ScriptedTurn[], budgetTokens = 1_000_000) => {
  const stack = scriptedStack(script);
  return runEvals({ cases, ...stack, budgetTokens }).then((report) => ({ report, ...stack }));
};

describe("runEvals", () => {
  it("should send the messages of a case in order, in one conversation", async () => {
    const { driver } = await run(
      [simpleCase("two-turns", { messages: ["first", "second"] })],
      [
        costing(1, { conversationId: "conversation-a" }),
        costing(1, { conversationId: "conversation-a" }),
      ],
    );

    expect(driver.sent).toEqual([
      { conversationId: null, text: "first" },
      { conversationId: "conversation-a", text: "second" },
    ]);
  });

  it("should pass a case when every grader passes", async () => {
    const { report } = await run(
      [simpleCase("reads", { expect: [toolCalled("get_day"), noWrite()] })],
      [costing(40, { toolCalls: [readTool("get_day")] })],
    );

    expect(report.cases).toEqual([
      { id: "reads", set: "ask", status: "passed", failures: [], tokens: 40 },
    ]);
  });

  it("should flag a case that is must-pass and a case whose critical grader failed", async () => {
    const { report } = await run(
      [
        simpleCase("important", {
          mustPass: true,
          expect: [() => Promise.resolve({ passed: true, reason: "fine" })],
        }),
        simpleCase("wrote", {
          expect: [() => Promise.resolve({ passed: false, reason: "wrote", critical: true })],
        }),
        simpleCase("ordinary", {
          expect: [() => Promise.resolve({ passed: false, reason: "missed" })],
        }),
      ],
      [costing(1), costing(1), costing(1)],
    );

    expect(report.cases.map(({ id, mustPass, critical }) => [id, mustPass, critical])).toEqual([
      ["important", true, undefined],
      ["wrote", undefined, true],
      ["ordinary", undefined, undefined],
    ]);
  });

  it("should fail a case with the reason of each grader that failed", async () => {
    const { report } = await run(
      [
        simpleCase("guesses", {
          expect: [clarifyingQuestion(), noWrite(), toolCalled("log_entry")],
        }),
      ],
      [costing(10, { toolCalls: [writeTool("log_entry")] })],
    );

    expect(report.cases[0]).toMatchObject({
      status: "failed",
      failures: ["the last turn ended complete, not clarify", "log_entry wrote"],
    });
  });

  it("should grade the cache read of the first model call of the second turn", async () => {
    const first = turnResult();
    const second = turnResult();
    const stack = scriptedStack([
      { result: first, usage: { inputTokens: 10, cacheCreationInputTokens: 500 } },
      { result: second, usage: { inputTokens: 10, cacheReadInputTokens: 900 } },
    ]);

    const report = await runEvals({
      cases: [simpleCase("cache", { messages: ["a", "b"], expect: [cacheReadOnSecondTurn()] })],
      ...stack,
      budgetTokens: 10_000,
    });

    expect(report.cases[0]?.status).toBe("passed");
  });

  describe("what counts as spend", () => {
    it("should count input, output and cache creation tokens, and report cache reads on their own", async () => {
      const { report } = await run(
        [simpleCase("one"), simpleCase("two")],
        [
          {
            result: turnResult(),
            usage: {
              inputTokens: 10,
              outputTokens: 20,
              cacheReadInputTokens: 3_000,
              cacheCreationInputTokens: 40,
              costUsdMicros: 500,
            },
          },
          {
            result: turnResult(),
            usage: {
              inputTokens: 1,
              outputTokens: 2,
              cacheReadInputTokens: 3_000,
              costUsdMicros: 600,
            },
          },
        ],
      );

      expect(report.cases.map(({ tokens }) => tokens)).toEqual([70, 3]);
      expect(report.tokensUsed).toBe(73);
      expect(report.cacheReadTokens).toBe(6_000);
      expect(report.costUsdMicros).toBe(1_100);
    });

    it("should count the rows of the whole user, including ones no turn id points at", async () => {
      const { report } = await run(
        [simpleCase("one")],
        [{ result: turnResult(), usage: { inputTokens: 90 }, recorded: false }],
      );

      expect(report.tokensUsed).toBe(90);
    });

    it("should count the tokens of a turn whose driver threw", async () => {
      const { report } = await run(
        [simpleCase("broken")],
        [
          {
            result: turnResult(),
            usage: { inputTokens: 70 },
            throws: new Error("connection reset"),
          },
        ],
      );

      expect(report.tokensUsed).toBe(70);
      expect(report.cases[0]?.tokens).toBe(70);
    });
  });

  describe("the token budget", () => {
    const threeCasesCosting100 = () => [costing(100), costing(100), costing(100)];
    const threeCases = () => [simpleCase("one"), simpleCase("two"), simpleCase("three")];

    it("should stop before the case that would cross the budget, and never send it", async () => {
      const { report, driver } = await run(threeCases(), threeCasesCosting100(), 250);

      expect(report.cases.map(({ id, status }) => [id, status])).toEqual([
        ["one", "passed"],
        ["two", "passed"],
        ["three", "not_run"],
      ]);
      expect(driver.sent).toHaveLength(2);
      expect(report.tokensUsed).toBe(200);
      expect(report.stopReason).toBe("budget");
    });

    it("should run every case when the budget holds them all", async () => {
      const { report } = await run(threeCases(), threeCasesCosting100(), 300);

      expect(report.cases.map(({ status }) => status)).toEqual(["passed", "passed", "passed"]);
      expect(report.stopReason).toBeNull();
    });

    it("should expect the next case to cost as much as the largest case so far, not the last", async () => {
      const { report } = await run(
        [simpleCase("large"), simpleCase("small"), simpleCase("next")],
        [costing(200), costing(50), costing(10)],
        400,
      );

      // 250 used, the largest case so far cost 200, so a third could reach 450. The last case cost 50, which would not stop it.
      expect(report.cases[2]?.status).toBe("not_run");
    });

    it("should not send the second turn of a case once the first has used the whole budget", async () => {
      const { report, driver } = await run(
        [simpleCase("long", { messages: ["a", "b", "c"] })],
        [costing(100), costing(100), costing(100)],
        100,
      );

      expect(driver.sent).toHaveLength(1);
      expect(report.cases[0]).toMatchObject({
        status: "not_run",
        failures: ["the budget was reached before turn 2"],
      });
      expect(report.tokensUsed).toBe(100);
      expect(report.stopReason).toBe("budget");
    });

    it("should stop mid-case at a budget a turn overshoots, and say the run is over budget", async () => {
      const { report } = await run(
        [simpleCase("long", { messages: ["a", "b"] })],
        [costing(150), costing(10)],
        100,
      );

      expect(report.tokensUsed).toBe(150);
      expect(report.overBudget).toBe(true);
    });

    it("should not be over budget at exactly the budget", async () => {
      const { report } = await run([simpleCase("exact")], [costing(100)], 100);

      expect(report.overBudget).toBe(false);
    });

    it("should not go green when ten cases report no tokens at all", async () => {
      const silent: ScriptedTurn[] = Array.from({ length: 10 }, () => ({ result: turnResult() }));

      const { report } = await run(
        Array.from({ length: 10 }, (_, index) => simpleCase(`silent-${index}`)),
        silent,
        100,
      );

      expect(report.cases.every(({ status }) => status === "error")).toBe(true);
      expect(report.cases[0]?.failures).toEqual(["no assistant_usage rows for the turn"]);
    });

    describe("a turn with no usage row", () => {
      const asking = (label = "Archive recipe") =>
        costing(30, {
          status: "confirm",
          conversationId: "conversation-a",
          confirmation: { question: "Archive it?", confirmLabel: label, cancelLabel: "Keep it" },
        });
      const press = (): ScriptedTurn => ({
        result: turnResult({ conversationId: "conversation-a" }),
      });
      const pressCase = (message: string) =>
        simpleCase("press", { messages: ["Archive my recipe.", message] });

      it("should be allowed for the press of the confirm button, which makes no model call", async () => {
        const { report } = await run([pressCase("Archive recipe")], [asking(), press()]);

        expect(report.cases[0]).toMatchObject({ status: "passed", failures: [] });
      });

      it("should be allowed for the button's words in any case and with spaces around them", async () => {
        const { report } = await run([pressCase("  archive RECIPE ")], [asking(), press()]);

        expect(report.cases[0]?.status).toBe("passed");
      });

      it("should still be an error for a typed answer after a confirmation", async () => {
        const { report } = await run([pressCase("yes please")], [asking(), press()]);

        expect(report.cases[0]).toMatchObject({
          status: "error",
          failures: ["no assistant_usage rows for the turn"],
        });
      });

      it("should still be an error for the cancel button's words", async () => {
        const { report } = await run([pressCase("Keep it")], [asking(), press()]);

        expect(report.cases[0]?.status).toBe("error");
      });

      it("should still be an error for the button's words when the turn before did not ask", async () => {
        const answered = costing(30, { conversationId: "conversation-a" });
        const { report } = await run([pressCase("Archive recipe")], [answered, press()]);

        expect(report.cases[0]?.status).toBe("error");
      });

      it("should still be an error for the first turn of a case", async () => {
        const { report } = await run(
          [simpleCase("first", { messages: ["Archive recipe"] })],
          [press()],
        );

        expect(report.cases[0]?.status).toBe("error");
      });
    });

    it("should stop the run when the spend of the user cannot be read", async () => {
      const stack = scriptedStack([costing(10), costing(10)]);
      const database = {
        ...stack.database,
        usageOfUser: () => Promise.reject(new Error("permission denied")),
      };

      const report = await runEvals({
        cases: [simpleCase("one"), simpleCase("two")],
        driver: stack.driver,
        database,
        budgetTokens: 1_000,
      });

      expect(report.cases.map(({ status }) => status)).toEqual(["error", "not_run"]);
      expect(report.stopReason).toBe("usage_unreadable");
    });
  });

  describe("what is not an error", () => {
    it("should accept a turn that reports output tokens and no input tokens", async () => {
      const { report } = await run(
        [simpleCase("cached")],
        [{ result: turnResult(), usage: { outputTokens: 5 } }],
      );

      expect(report.cases[0]?.status).toBe("passed");
    });

    it("should accept a turn that reports only cache reads", async () => {
      const { report } = await run(
        [simpleCase("cached")],
        [{ result: turnResult(), usage: { cacheReadInputTokens: 900 } }],
      );

      expect(report.cases[0]?.status).toBe("passed");
    });
  });

  describe("infrastructure errors", () => {
    it("should mark a case that passed as an error when the spend cannot be read after it", async () => {
      const stack = scriptedStack([costing(5)]);
      let reads = 0;
      const database = {
        ...stack.database,
        usageOfUser: () => {
          reads += 1;
          // The first read is after the turn, the second is after the case.
          return reads === 1 ? stack.database.usageOfUser() : Promise.reject(new Error("timeout"));
        },
      };

      const report = await runEvals({
        cases: [simpleCase("one")],
        driver: stack.driver,
        database,
        budgetTokens: 1_000,
      });

      expect(report.cases[0]).toMatchObject({
        status: "error",
        failures: ["assistant_usage could not be read"],
      });
      expect(report.stopReason).toBe("usage_unreadable");
    });

    it("should not send the rest of a case after its ceiling fell, nor bill the next case for it", async () => {
      const stack = scriptedStack([
        { result: turnResult(), usage: { inputTokens: 5 }, delayMs: 80 },
        costing(7),
        costing(9),
        costing(11),
      ]);

      const report = await runEvals({
        cases: [
          simpleCase("slow", { messages: ["a1", "a2", "a3"] }),
          simpleCase("next", { messages: ["b1"] }),
        ],
        ...stack,
        budgetTokens: 1_000,
        caseTimeoutMs: 30,
      });
      // Long enough for the abandoned case's first turn to answer and, without the flag, to send a2.
      await new Promise((resolve) => setTimeout(resolve, 200));

      expect(stack.driver.sent.map(({ text }) => text)).toEqual(["a1", "b1"]);
      expect(report.cases.map(({ id, status }) => [id, status])).toEqual([
        ["slow", "error"],
        ["next", "passed"],
      ]);
      expect(report.cases[1]?.tokens).toBe(7);
    });

    it("should wait for the clean up of a case that hit its ceiling before the next case starts", async () => {
      const events: string[] = [];
      const stack = scriptedStack([{ ...costing(5), delayMs: 60 }, costing(7)]);

      const report = await runEvals({
        cases: [
          simpleCase("slow", {
            setup: () => {
              events.push("slow setup");
              return Promise.resolve(null);
            },
            cleanUp: async () => {
              await new Promise((resolve) => setTimeout(resolve, 20));
              events.push("slow clean up");
            },
          }),
          simpleCase("next", {
            setup: () => {
              events.push("next setup");
              return Promise.resolve(null);
            },
          }),
        ],
        ...stack,
        environment: fakeEnvironment(),
        budgetTokens: 1_000,
        caseTimeoutMs: 30,
      });

      expect(events).toEqual(["slow setup", "slow clean up", "next setup"]);
      expect(report.cases.map(({ id, status }) => [id, status])).toEqual([
        ["slow", "error"],
        ["next", "passed"],
      ]);
    });

    it("should not wait for ever for a case that never comes back", async () => {
      const stack = scriptedStack([{ ...costing(5), hangs: true }, costing(7)]);

      const report = await runEvals({
        cases: [simpleCase("hung"), simpleCase("next")],
        ...stack,
        budgetTokens: 1_000,
        caseTimeoutMs: 20,
        cleanUpGraceMs: 20,
      });

      expect(report.cases.map(({ status }) => status)).toEqual(["error", "passed"]);
    });

    it("should run the prepare of a case outside its ceiling", async () => {
      const stack = scriptedStack([costing(5)]);

      const report = await runEvals({
        cases: [
          simpleCase("prepared", {
            prepare: () => new Promise((resolve) => setTimeout(resolve, 80)),
          }),
        ],
        ...stack,
        budgetTokens: 1_000,
        caseTimeoutMs: 30,
      });

      expect(report.cases.map(({ status }) => status)).toEqual(["passed"]);
    });

    it("should end a case in error when its prepare hangs, and not wait for it again for the next case", async () => {
      const stack = scriptedStack([costing(5), costing(5)]);
      let attempts = 0;
      const prepare = () => {
        attempts += 1;
        return new Promise<void>(() => undefined);
      };

      const report = await runEvals({
        cases: [simpleCase("first", { prepare }), simpleCase("second", { prepare })],
        ...stack,
        budgetTokens: 1_000,
        prepareTimeoutMs: 20,
      });

      expect(report.cases.map(({ status }) => status)).toEqual(["error", "error"]);
      expect(report.cases[0]?.failures).toEqual([
        "the case could not be prepared: took longer than 20 ms",
      ]);
      expect(report.cases[1]?.failures[0]).toContain("an earlier case's prepare hung");
      expect(attempts).toBe(1);
      expect(stack.driver.sent).toEqual([]);
    });

    it("should end a case in error when its prepare fails, and send nothing", async () => {
      const stack = scriptedStack([costing(5)]);

      const report = await runEvals({
        cases: [simpleCase("unprepared", { prepare: () => Promise.reject(new Error("no stack")) })],
        ...stack,
        budgetTokens: 1_000,
      });

      expect(report.cases[0]).toMatchObject({
        status: "error",
        failures: ["the case could not be prepared: no stack"],
      });
      expect(stack.driver.sent).toEqual([]);
    });

    it("should record a driver error as an error, not a failure, and carry on", async () => {
      const { report } = await run(
        [simpleCase("broken"), simpleCase("fine")],
        [
          {
            result: turnResult(),
            usage: { inputTokens: 5 },
            throws: new Error("connection reset"),
          },
          costing(5),
        ],
      );

      expect(report.cases.map(({ id, status }) => [id, status])).toEqual([
        ["broken", "error"],
        ["fine", "passed"],
      ]);
      expect(report.cases[0]?.failures).toEqual(["the run failed: connection reset"]);
    });

    it("should record a database error inside a grader as an error", async () => {
      const stack = scriptedStack([costing(5)]);
      const database = {
        ...stack.database,
        countRows: () => Promise.reject(new Error("permission denied")),
      };

      const report = await runEvals({
        cases: [
          simpleCase("reads", { expect: [rowsExist({ table: "food_log_entries", where: {} })] }),
        ],
        driver: stack.driver,
        database,
        budgetTokens: 1_000,
      });

      expect(report.cases[0]).toMatchObject({
        status: "error",
        failures: ["the run failed: permission denied"],
      });
    });

    it("should record a turn that ended failed as an error and skip the graders", async () => {
      const { report } = await run(
        [simpleCase("down", { expect: [clarifyingQuestion()] })],
        [costing(5, { status: "failed" })],
      );

      expect(report.cases[0]).toMatchObject({
        status: "error",
        failures: ["the turn failed (no notice)"],
      });
    });

    it("should end a case whose driver never answers after the wall-clock ceiling, and carry on", async () => {
      const stack = scriptedStack([
        { result: turnResult(), usage: { inputTokens: 5 }, hangs: true },
        costing(5),
      ]);

      const report = await runEvals({
        cases: [simpleCase("hung"), simpleCase("fine")],
        ...stack,
        budgetTokens: 1_000,
        caseTimeoutMs: 30,
        cleanUpGraceMs: 10,
      });

      expect(report.cases.map(({ id, status }) => [id, status])).toEqual([
        ["hung", "error"],
        ["fine", "passed"],
      ]);
      expect(report.cases[0]?.failures).toEqual(["the case took longer than 30 ms"]);
    });
  });
});

describe("runEvals with a case that sets up and waits", () => {
  const environmentThatLogs = (log: string[]): CaseEnvironment => ({
    seedConversation: (turns) => {
      log.push(`seed ${turns.length}`);
      return Promise.resolve("seeded-conversation");
    },
    waitForCompaction: (conversationId) => {
      log.push(`wait ${conversationId}`);
      return Promise.resolve();
    },
    undoTurn: () => Promise.resolve([]),
    restoreTargets: () => Promise.resolve(),
  });

  it("should send the first message into the conversation that setup answered", async () => {
    const log: string[] = [];
    const stack = scriptedStack([costing(1, { conversationId: "seeded-conversation" })]);

    await runEvals({
      cases: [
        simpleCase("seeded", {
          setup: (environment) =>
            environment.seedConversation([{ user: "hi", assistant: "hello" }]),
        }),
      ],
      ...stack,
      environment: environmentThatLogs(log),
      budgetTokens: 1_000_000,
    });

    expect(stack.driver.sent).toEqual([
      { conversationId: "seeded-conversation", text: "How much protein did I eat?" },
    ]);
    expect(log).toEqual(["seed 1"]);
  });

  it("should run afterTurn after each turn, before the next message, with its index and result", async () => {
    const log: string[] = [];
    const stack = scriptedStack([
      costing(1, { conversationId: "conversation-a", turnId: "first-turn" }),
      costing(1, { conversationId: "conversation-a" }),
    ]);

    const report = await runEvals({
      cases: [
        simpleCase("waits", {
          messages: ["first", "second"],
          afterTurn: ({ index, result }, environment) => {
            log.push(`after ${index} ${result.turnId} sent ${stack.driver.sent.length}`);
            return index === 0
              ? environment.waitForCompaction(result.conversationId)
              : Promise.resolve();
          },
        }),
      ],
      ...stack,
      environment: environmentThatLogs(log),
      budgetTokens: 1_000_000,
    });

    expect(log).toEqual([
      "after 0 first-turn sent 1",
      "wait conversation-a",
      expect.stringMatching(/^after 1 turn-\d+ sent 2$/),
    ]);
    expect(report.cases[0]?.status).toBe("passed");
  });

  it("should end the case as an error, not a miss, when the wait fails", async () => {
    const stack = scriptedStack([costing(1), costing(1)]);

    const report = await runEvals({
      cases: [
        simpleCase("never-compacts", {
          messages: ["first", "second"],
          afterTurn: () => Promise.reject(new Error("no note was stored within 60000 ms")),
        }),
      ],
      ...stack,
      environment: environmentThatLogs([]),
      budgetTokens: 1_000_000,
    });

    expect(report.cases[0]).toMatchObject({
      status: "error",
      failures: ["the run failed: no note was stored within 60000 ms"],
    });
    expect(stack.driver.sent).toHaveLength(1);
  });

  it("should end the case as an error when it needs an environment the session does not have", async () => {
    const stack = scriptedStack([costing(1)]);

    const report = await runEvals({
      cases: [simpleCase("needs-one", { setup: () => Promise.resolve("never") })],
      ...stack,
      budgetTokens: 1_000_000,
    });

    expect(report.cases[0]).toMatchObject({
      status: "error",
      failures: ["the case needs a session with a case environment"],
    });
    expect(stack.driver.sent).toHaveLength(0);
  });
  describe("the size of the cached prompt", () => {
    it("should report the tokens of the first model call of the first case", async () => {
      const { report } = await run(
        [simpleCase("first"), simpleCase("second")],
        [
          {
            result: turnResult(),
            usage: { inputTokens: 12, cacheCreationInputTokens: 2_500, cacheReadInputTokens: 0 },
          },
          {
            result: turnResult(),
            usage: { inputTokens: 99, cacheCreationInputTokens: 0, cacheReadInputTokens: 2_500 },
          },
        ],
      );

      expect(report.firstModelCall).toEqual({
        inputTokens: 12,
        cacheCreationInputTokens: 2_500,
        cacheReadInputTokens: 0,
      });
    });

    it("should take the first turn of the case and not a later one", async () => {
      const { report } = await run(
        [simpleCase("two-turns", { messages: ["first", "second"] })],
        [
          { result: turnResult({ conversationId: "c" }), usage: { inputTokens: 5 } },
          { result: turnResult({ conversationId: "c" }), usage: { inputTokens: 700 } },
        ],
      );

      expect(report.firstModelCall?.inputTokens).toBe(5);
    });

    it("should never decide a verdict: a call that cannot be read leaves the line empty and the case passing", async () => {
      const stack = scriptedStack([{ result: turnResult(), usage: { inputTokens: 40 } }]);
      const database = {
        ...stack.database,
        firstModelCallOfTurn: () =>
          Promise.reject(new Error("Could not read assistant_usage (42501)")),
      };

      const report = await runEvals({
        cases: [simpleCase("reads", { expect: [noWrite()] })],
        driver: stack.driver,
        database,
        budgetTokens: 1_000_000,
      });

      expect(report.cases[0]).toMatchObject({ status: "passed", failures: [] });
      expect(report.firstModelCall).toBeNull();
    });

    it("should be null when no case ran", async () => {
      const { report } = await run([], []);

      expect(report.firstModelCall).toBeNull();
    });

    it("should be null when the first turn of the first case failed before it billed a call", async () => {
      const { report } = await run(
        [simpleCase("fails")],
        [{ result: turnResult(), throws: new Error("the stream broke") }],
      );

      expect(report.firstModelCall).toBeNull();
    });
  });
});
