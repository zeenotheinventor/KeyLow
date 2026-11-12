import { describeTurnEndedAfterWrite } from "@keylow/core";
import { describe, expect, it } from "vitest";

import { costing, readTool, scriptedStack, writeTool } from "./helpers.ts";
import { runEvals } from "../src/runEvals.ts";

import type { EvalCase } from "../src/case.ts";
import type { TurnResult } from "../src/types.ts";

const caseOf = (): EvalCase => ({
  id: "writes-several",
  set: "ask",
  messages: ["Delete everything I logged on 3 March 2026."],
  expect: [],
});

async function reasonOf(turn: Partial<TurnResult>): Promise<string[]> {
  const stack = scriptedStack([costing(1, { status: "failed", ...turn })]);
  const report = await runEvals({ cases: [caseOf()], ...stack, budgetTokens: 1_000_000 });
  expect(report.cases[0]?.status).toBe("error");
  return [...(report.cases[0]?.failures ?? [])];
}

describe("a turn that ended failed", () => {
  it("should name the notice the turn sent", async () => {
    expect(await reasonOf({ noticeCode: "turn_failed" })).toEqual([
      "the turn failed (notice turn_failed)",
    ]);
  });

  it("should say so when the turn sent no notice", async () => {
    expect(await reasonOf({})).toEqual(["the turn failed (no notice)"]);
  });

  it("should name confirm_unavailable as a possible cause, and point at the function log, after a tool that asks first", async () => {
    const [reason] = await reasonOf({
      noticeCode: "turn_failed",
      toolCalls: [readTool("get_day"), writeTool("delete_entry", { ids: ["a", "b"] })],
    });

    expect(reason).toBe(
      "the turn failed (notice turn_failed) after a call to delete_entry, a tool that asks first: may be confirm_unavailable (the model gave no question to put above the buttons), check the function log for the ending",
    );
  });

  it("should not name a cause for a failure after a call to a tool that does not ask first", async () => {
    const [reason] = await reasonOf({
      noticeCode: "turn_failed",
      toolCalls: [writeTool("log_entry", {})],
    });

    expect(reason).toBe("the turn failed (notice turn_failed)");
  });
});

describe("a turn that ended early after a write landed", () => {
  const reason = "the turn ended early after a write landed, check the function log for the ending";

  async function reportOf(turn: Partial<TurnResult>) {
    const stack = scriptedStack([costing(1, { status: "complete", ...turn })]);
    const report = await runEvals({
      cases: [{ ...caseOf(), expect: [() => Promise.resolve({ passed: true, reason: "" })] }],
      ...stack,
      budgetTokens: 1_000_000,
    });
    return report.cases[0];
  }

  it.each([1, 2])(
    "should be an error with its reason, and no grader runs, when the answer ends in the words for %i change(s)",
    async (writes) => {
      const result = await reportOf({
        answer: `Logging both now.\n\n${describeTurnEndedAfterWrite(writes)}`,
      });

      expect(result?.status).toBe("error");
      expect(result?.failures).toEqual([reason]);
    },
  );

  it("should be an error when the words are the whole answer", async () => {
    const result = await reportOf({ answer: describeTurnEndedAfterWrite(1) });

    expect(result?.status).toBe("error");
  });

  it("should grade a complete answer that does not end in the words", async () => {
    const result = await reportOf({ answer: "Logged. Your change was saved to the diary." });

    expect(result?.status).toBe("passed");
  });
});
