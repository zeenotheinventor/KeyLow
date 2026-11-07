import { describe, expect, it } from "vitest";

import { fakeEnvironment } from "./fakeEnvironment.ts";
import { readTool, turnResult, writeTool } from "./helpers.ts";
import { rowDatabase } from "./rowDatabase.ts";
import { loggedCard, storedRows } from "./storedTurnRows.ts";
import { trainingPromptCasesOf } from "../cases/trainingPromptCases.ts";
import { LIVE_WORKOUT } from "../src/trainingWorld.ts";

import type { EvalCase } from "../src/case.ts";
import type { TurnResult } from "../src/types.ts";

const DAY = "2026-08-17";
const [swapCase, goalCase, noGoalCase] = trainingPromptCasesOf(
  DAY,
  "Log two large eggs on 17 August 2026 at 08:00 and swap the triceps pushdown for the barbell curl.",
);

type Row = Record<string, unknown>;

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
  assistant_messages: storedRows(turn, true),
});

const swapTurn = (overrides: Partial<TurnResult> = {}): TurnResult =>
  turnResult({
    toolCalls: [writeTool("log_entry"), readTool("get_routines"), writeTool("edit_routine")],
    answer:
      "The eggs are logged. The swap to the barbell curl waits until the workout is finished.",
    cards: [loggedCard],
    ...overrides,
  });

const refusalTurn = (overrides: Partial<TurnResult> = {}): TurnResult =>
  turnResult({
    toolCalls: [writeTool("update_training_goals", { days_per_week: 5 })],
    answer:
      "A workout is in progress, so nothing can change yet. Finish it or discard it on the Train tab, then ask again.",
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

  it("should pass a reply that logs the eggs, leaves the swap and says so, with no Ask again drawn", async () => {
    const turn = swapTurn();

    expect(await reasonsOf(swapCase, turn, eggsLogged(turn))).toEqual([]);
  });

  it("should fail a question about the exercise, because the eggs must be logged", async () => {
    const turn = turnResult({
      status: "clarify",
      toolCalls: [readTool("search_exercises"), readTool("ask_user")],
      answer: "Which curl?",
    });

    expect(await reasonsOf(swapCase, turn)).not.toEqual([]);
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

  it("should fail when the thread would draw an Ask again beside a write", async () => {
    // No card in the stored rows: the person would see the Ask again that could log the eggs twice.
    const turn = swapTurn();
    const tables = { ...eggsLogged(turn), assistant_messages: storedRows(turn, false) };

    expect(await reasonsOf(swapCase, turn, tables)).not.toEqual([]);
  });

  it("should pass a refused change of the training days that shows Ask again and points to the Train tab", async () => {
    const turn = refusalTurn();

    expect(
      await reasonsOf(goalCase, turn, { assistant_messages: storedRows(turn, false) }),
    ).toEqual([]);
  });

  it("should fail a refusal that shows no Ask again", async () => {
    const turn = refusalTurn();
    const rows = storedRows(turn, false).map((row) => ({ ...row, display: null }));

    expect(await reasonsOf(goalCase, turn, { assistant_messages: rows })).not.toEqual([]);
  });

  it("should fail a change of the training days that never called the tool", async () => {
    const turn = refusalTurn({ toolCalls: [] });

    expect(
      await reasonsOf(goalCase, turn, { assistant_messages: storedRows(turn, false) }),
    ).not.toEqual([]);
  });

  it("should fail a reply that does not point to the Train tab", async () => {
    const turn = refusalTurn({ answer: "A workout is in progress." });

    expect(
      await reasonsOf(goalCase, turn, { assistant_messages: storedRows(turn, false) }),
    ).not.toEqual([]);
  });

  it("should pass one question with quick replies and nothing written for a build with no goal", async () => {
    const turn = turnResult({
      status: "clarify",
      toolCalls: [
        readTool("get_training_goals"),
        readTool("ask_user", { question: "Goal?", quick_replies: ["Look better, intermediate"] }),
      ],
    });

    expect(await reasonsOf(noGoalCase, turn)).toEqual([]);
  });

  it("should fail a build that went ahead with no goal", async () => {
    const turn = turnResult({
      toolCalls: [writeTool("create_routine", { name: "Scratch no goal", days: [] })],
    });
    const tables = {
      assistant_actions: [{ turn_id: turn.turnId, tool: "create_routine", target_id: "routine" }],
    };

    expect(await reasonsOf(noGoalCase, turn, tables)).not.toEqual([]);
  });

  it("should fail a question with no quick replies", async () => {
    const turn = turnResult({
      status: "clarify",
      toolCalls: [readTool("ask_user", { question: "Goal?", quick_replies: [] })],
    });

    expect(await reasonsOf(noGoalCase, turn)).not.toEqual([]);
  });
});
