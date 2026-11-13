// The kitchen probe set (KEY-1022, ADR 0006 Amendment 5). One two-turn conversation through the real stack with
// ASSISTANT_KITCHEN=1 and ASSISTANT_KITCHEN_PROBE=1, to prove the hidden kitchen group on the live API:
//
// - the beta, a deferred tool and a `tool_addition` are accepted (no turn fails, each has a model call),
// - the stored `system` row exists after the first turn and is not stored a second time on the second,
// - the model can call `kitchen_probe` on the kitchen turn,
// - the first model call of the second turn reads the prompt cache from the first, and
// - a plain first turn of another conversation stores no system row and cannot call the probe, which shows that
//   `defer_loading` is honoured.
//
// It is opt in (`--set kitchenProbe`) and needs the switches above, so the workflow's `kitchen` input turns them on.
// Every reason is a count of tokens or rows, never a message.
import { toolCalled } from "../src/case.ts";

import type { EvalCase, GradeOutcome, Grader } from "../src/case.ts";

const pass = (reason: string): GradeOutcome => ({ passed: true, reason });
const fail = (reason: string): GradeOutcome => ({ passed: false, reason });

const KITCHEN_TURN = "Make me a meal plan for next week";
// A read with no kitchen word, so it neither logs to the diary nor surfaces the group.
const PLAIN_TURN = "How many calories are in an apple?";
const FOLLOW_UP = "Thanks, and what is a good source of fibre?";

// The user message and the addition sit after the visible prefix in the first call's prompt, and they are well
// under this. The second turn must read the cache at least as far as the visible prefix, which is the first
// call's prompt less these.
const MESSAGE_AND_ADDITION_ALLOWANCE_TOKENS = 800;

/** Passes when both turns ended complete and each made a model call, so the API took the request. */
export function betaAccepted(): Grader {
  return async ({ turns, database }) => {
    if (turns.length !== 2) {
      return fail(`the case ran ${turns.length} turns, not 2`);
    }
    for (const [index, turn] of turns.entries()) {
      const call = await database.firstModelCallOfTurn(turn.turnId);
      if (turn.status !== "complete" || call === null) {
        return fail(
          `turn ${index + 1} ended ${turn.status} with ${call === null ? "no" : "a"} model call (notice ${turn.noticeCode ?? "none"})`,
        );
      }
    }
    return pass(
      "both turns ended complete, so the API took the beta, the deferred tools and the addition",
    );
  };
}

/** Passes when the conversation holds one stored system row, made on the first turn and not repeated on the second. */
export function additionStoredOnce(): Grader {
  return async ({ turns, database }) => {
    const [first, second] = turns;
    if (first === undefined || second === undefined) {
      return fail("the case has fewer than 2 turns");
    }
    const count = (turnId: string) =>
      database.countRows({
        table: "assistant_messages",
        where: { turn_id: turnId, role: "system" },
      });
    const [onFirst, onSecond] = [await count(first.turnId), await count(second.turnId)];
    return onFirst === 1 && onSecond === 0
      ? pass("one system row on turn 1 and none on turn 2")
      : fail(`system rows: ${onFirst} on turn 1 (want 1) and ${onSecond} on turn 2 (want 0)`);
  };
}

/** Passes when the first call of turn 2 read at least the visible prefix from the cache. Prints the counts. */
export function secondTurnReadsThePrefix(): Grader {
  return async ({ turns, database }) => {
    const [first, second] = turns;
    if (first === undefined || second === undefined) {
      return fail("the case has fewer than 2 turns");
    }
    const [firstCall, secondCall] = [
      await database.firstModelCallOfTurn(first.turnId),
      await database.firstModelCallOfTurn(second.turnId),
    ];
    if (firstCall === null || secondCall === null) {
      return fail("a turn has no assistant_usage row");
    }
    const prompt =
      firstCall.inputTokens + firstCall.cacheReadInputTokens + firstCall.cacheCreationInputTokens;
    const wanted = prompt - MESSAGE_AND_ADDITION_ALLOWANCE_TOKENS;
    const counts = `turn 1 first call: input ${firstCall.inputTokens}, cache_read ${firstCall.cacheReadInputTokens}, cache_creation ${firstCall.cacheCreationInputTokens}. Turn 2 first call: input ${secondCall.inputTokens}, cache_read ${secondCall.cacheReadInputTokens}, cache_creation ${secondCall.cacheCreationInputTokens}. Wanted a read of at least ${wanted}`;
    return secondCall.cacheReadInputTokens >= wanted ? pass(counts) : fail(counts);
  };
}

/**
 * Passes when the first turn stored no system row and called no kitchen tool, so the deferred tool stayed hidden
 * on a turn that had no kitchen words. This catches `defer_loading` being ignored, which would show the probe to
 * every conversation.
 */
export function kitchenStaysHidden(): Grader {
  return async ({ turns, database }) => {
    const [turn] = turns;
    if (turn === undefined) {
      return fail("the case has no turn");
    }
    const rows = await database.countRows({
      table: "assistant_messages",
      where: { turn_id: turn.turnId, role: "system" },
    });
    const called = turn.toolCalls.filter((call) => call.name === "kitchen_probe").length;
    return rows === 0 && called === 0
      ? pass("no system row and no kitchen_probe call on a plain turn")
      : fail(`a plain turn stored ${rows} system rows and called kitchen_probe ${called} times`);
  };
}

export const kitchenProbeCases: readonly EvalCase[] = [
  {
    id: "kitchen-probe-two-turns",
    set: "kitchenProbe",
    messages: [KITCHEN_TURN, FOLLOW_UP],
    mustPass: true,
    expect: [
      betaAccepted(),
      additionStoredOnce(),
      toolCalled("kitchen_probe"),
      secondTurnReadsThePrefix(),
    ],
  },
  {
    id: "kitchen-probe-plain-turn-stays-hidden",
    set: "kitchenProbe",
    messages: [PLAIN_TURN],
    mustPass: true,
    expect: [kitchenStaysHidden()],
  },
];
