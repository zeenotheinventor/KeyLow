import { describe, expect, it } from "vitest";

import { fakeEnvironment } from "./fakeEnvironment.ts";
import { readTool, turnResult, writeTool } from "./helpers.ts";
import { rowDatabase } from "./rowDatabase.ts";
import { workoutRefusalCasesOf } from "../cases/workoutRefusals.ts";
import { LIVE_WORKOUT } from "../src/trainingWorld.ts";

import type { EvalCase } from "../src/case.ts";
import type { ToolCall, TurnResult } from "../src/types.ts";

const DAY = "2026-08-17";
const [swapCase, goalCase] = workoutRefusalCasesOf(
  DAY,
  "Log two large eggs on 17 August 2026 at 08:00 and swap bench press for incline bench press.",
);

type Row = Record<string, string | number | boolean | null>;

const liveWorkout: Record<string, Row[]> = {
  workout_sessions: [{ id: "live", ended_at: null, deleted_at: null }],
  workout_sets: Array.from({ length: LIVE_WORKOUT.sets }, () => ({
    session_id: "live",
    deleted_at: null,
  })),
};

async function reasonsOf(
  evalCase: EvalCase | undefined,
  turn: TurnResult,
  tables: Record<string, Row[]> = {},
) {
  if (evalCase === undefined) {
    throw new Error("No case");
  }
  const database = rowDatabase({ ...liveWorkout, ...tables });
  const outcomes = await Promise.all(
    evalCase.expect.map((check) => check({ turns: [turn], database })),
  );
  return outcomes.filter(({ passed }) => !passed).map(({ reason }) => reason);
}

const eggsLogged = (turn: TurnResult): Record<string, Row[]> => ({
  food_log_entries: [{ local_date: DAY, deleted_at: null }],
  assistant_actions: [{ turn_id: turn.turnId, tool: "log_entry", target_id: "entry" }],
});

const swapTurn = (overrides: Partial<TurnResult> = {}): TurnResult =>
  turnResult({
    toolCalls: [writeTool("log_entry"), readTool("get_routines"), writeTool("edit_routine")],
    answer: "The eggs are logged. The swap to incline waits until the workout is finished.",
    cards: [
      {
        actionIds: ["33333333-3333-4333-8333-333333333333"],
        kind: "logged",
        title: "Title",
        sub: null,
        rows: [],
        totalText: null,
        note: null,
        link: null,
        undo: "available",
        undoneSub: null,
      },
    ],
    ...overrides,
  });

describe("the workout cases of the write set", () => {
  it("should be two cases of the writes set that start a workout and discard it afterwards", async () => {
    for (const evalCase of [swapCase, goalCase]) {
      expect(evalCase?.set).toBe("writes");
      expect(evalCase?.setup).toBeDefined();
      expect(evalCase?.prepare).toBeDefined();
    }
    const environment = fakeEnvironment();
    // The world holder has no world in a test, so the clean up fails loudly rather than leaving a workout open.
    await expect(swapCase?.cleanUp?.([], environment)).rejects.toThrow();
  });

  it("should pass a reply that logs the eggs, leaves the swap and says so", async () => {
    const turn = swapTurn();

    expect(await reasonsOf(swapCase, turn, eggsLogged(turn))).toEqual([]);
  });

  it("should pass a fair question about which incline exercise, with nothing written", async () => {
    const turn = turnResult({
      status: "clarify",
      toolCalls: [readTool("search_exercises"), readTool("ask_user")],
      answer: "Which incline press?",
    });

    expect(await reasonsOf(swapCase, turn)).toEqual([]);
  });

  it("should fail when the swap landed during the workout", async () => {
    const turn = swapTurn();
    const tables = eggsLogged(turn);
    tables["assistant_actions"]?.push({
      turn_id: turn.turnId,
      tool: "edit_routine",
      target_id: "routine",
    });

    expect(await reasonsOf(swapCase, turn, tables)).not.toEqual([]);
  });

  it("should fail when the reply does not name what was not made", async () => {
    const turn = swapTurn({ answer: "The eggs are logged." });

    expect(await reasonsOf(swapCase, turn, eggsLogged(turn))).not.toEqual([]);
  });

  it("should fail when an Ask again was stored for a turn that also wrote", async () => {
    const turn = swapTurn();
    const tables = {
      ...eggsLogged(turn),
      assistant_messages: [{ turn_id: turn.turnId, display: '{"call-1":{"askAgain":true}}' }],
    };

    expect(await reasonsOf(swapCase, turn, tables)).not.toEqual([]);
  });

  it("should pass a refused change of the training days that says the workout is the reason", async () => {
    const toolCalls: ToolCall[] = [writeTool("update_training_goals", { days_per_week: 5 })];
    const turn = turnResult({
      toolCalls,
      answer: "A workout is in progress, so nothing can change until it ends.",
    });

    expect(await reasonsOf(goalCase, turn)).toEqual([]);
  });

  it("should fail a change of the training days that never called the tool", async () => {
    const turn = turnResult({ answer: "A workout is in progress." });

    expect(await reasonsOf(goalCase, turn)).not.toEqual([]);
  });

  it("should fail a reply that does not mention the workout", async () => {
    const turn = turnResult({
      toolCalls: [writeTool("update_training_goals", { days_per_week: 5 })],
      answer: "That change is not possible right now.",
    });

    expect(await reasonsOf(goalCase, turn)).not.toEqual([]);
  });
});
