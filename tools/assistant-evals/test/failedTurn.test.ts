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

  it("should point at the assistant, not the infrastructure, when it failed after a call to a tool that asks first", async () => {
    const [reason] = await reasonOf({
      noticeCode: "turn_failed",
      toolCalls: [readTool("get_day"), writeTool("delete_entry", { ids: ["a", "b"] })],
    });

    expect(reason).toBe(
      "the turn failed (notice turn_failed) after a call to delete_entry, a tool that asks first: most likely confirm_unavailable, the model gave no question to put above the buttons, so this is the assistant's fault and not the infrastructure's",
    );
  });

  it("should not blame the assistant for a failure after a call to a tool that does not ask first", async () => {
    const [reason] = await reasonOf({
      noticeCode: "turn_failed",
      toolCalls: [writeTool("log_entry", {})],
    });

    expect(reason).toBe("the turn failed (notice turn_failed)");
  });
});
