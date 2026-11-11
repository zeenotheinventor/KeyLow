// The graders of the feature request set (KEY-977). A request is graded by state: the `assistant_actions` rows
// the turns left, the `feature_requests` row such an action points at, and the buttons the app drew. The reply's
// words are read in one place only, where the rule is about the words (the Train tab). A reason names a count, a
// turn or a field and never the request, the context or a reply, because a request can hold diary talk.
import { confirmFeatureRequestButtons } from "@keylow/core";
import { featureRequestContextSchema } from "@keylow/core/featureRequests";

import { isRecord } from "./entryGraders.ts";

import type { GradeOutcome, Grader } from "../src/case.ts";
import type { ToolCall, TurnResult } from "../src/types.ts";

const pass = (reason: string): GradeOutcome => ({ passed: true, reason });
const fail = (reason: string): GradeOutcome => ({ passed: false, reason });

const TOOL = "request_feature";

const callsOf = (turns: readonly TurnResult[]): ToolCall[] =>
  turns.flatMap((turn) => turn.toolCalls);

/** Passes when no turn called the tool. */
export function toolNotCalled(name: string): Grader {
  return ({ turns }) =>
    Promise.resolve(
      callsOf(turns).some((call) => call.name === name)
        ? fail(`${name} was called`)
        : pass(`${name} was not called`),
    );
}

/** Passes when no tool that writes was called, `allowed` apart. A tool with no `readOnlyHint` counts as one that writes. */
export function noWriteBut(allowed: string): Grader {
  return ({ turns }) => {
    const write = callsOf(turns).find(
      (call) => call.readOnlyHint !== true && call.name !== allowed,
    );
    return Promise.resolve(
      write === undefined ? pass(`no tool wrote but ${allowed}`) : fail(`${write.name} wrote`),
    );
  };
}

/**
 * Passes when the turn, counted from 0, ended waiting for the button, called `request_feature`, and the app drew
 * the Send request button. The question above it is the model's own words, so it is not read.
 */
export function offeredFeatureRequest(turnIndex: number): Grader {
  return ({ turns }) => {
    const turn = turns[turnIndex];
    if (turn === undefined) {
      return Promise.resolve(fail(`turn ${turnIndex + 1} never happened`));
    }
    if (turn.status !== "confirm") {
      return Promise.resolve(fail(`turn ${turnIndex + 1} ended ${turn.status}, not confirm`));
    }
    if (!turn.toolCalls.some((call) => call.name === TOOL)) {
      return Promise.resolve(fail(`turn ${turnIndex + 1} did not call ${TOOL}`));
    }
    const wanted = confirmFeatureRequestButtons().confirmLabel;
    return Promise.resolve(
      turn.confirmation?.confirmLabel === wanted
        ? pass(`turn ${turnIndex + 1} offered the ${wanted} button`)
        : fail(`turn ${turnIndex + 1} did not draw the ${wanted} button`),
    );
  };
}

/** Passes when the turn, counted from 0, did not call `request_feature`. */
export function noRequestInTurn(turnIndex: number): Grader {
  return ({ turns }) =>
    Promise.resolve(
      turns[turnIndex]?.toolCalls.some((call) => call.name === TOOL) === true
        ? fail(`turn ${turnIndex + 1} called ${TOOL}`)
        : pass(`turn ${turnIndex + 1} did not call ${TOOL}`),
    );
}

/**
 * Passes when the turn, counted from 0, wrote exactly one request, from the assistant, with a context the
 * schema accepts (so no id, tool call or tool result in it), what Ki-Lo cannot do, and the person's ask among
 * the recent talk. The row is found through the turn's own action, so another case's request is never read.
 */
export function featureRequestSent(turnIndex: number, ask: RegExp): Grader {
  return async ({ turns, database }) => {
    const turn = turns[turnIndex];
    if (turn === undefined) {
      return fail(`turn ${turnIndex + 1} never happened`);
    }
    const actions = await database.readRows({
      table: "assistant_actions",
      where: { turn_id: turn.turnId, tool: TOOL },
    });
    const [action] = actions;
    const targetId = isRecord(action) ? action["target_id"] : null;
    if (actions.length !== 1 || typeof targetId !== "string") {
      return fail(`turn ${turnIndex + 1} left ${actions.length} ${TOOL} actions with a row, not 1`);
    }
    const rows = await database.readRows({ table: "feature_requests", where: { id: targetId } });
    const [row] = rows;
    if (rows.length !== 1 || !isRecord(row)) {
      return fail("the action points at no feature_requests row");
    }
    if (row["source"] !== "assistant") {
      return fail("the request row is not from the assistant");
    }
    if (typeof row["request"] !== "string" || row["request"].trim() === "") {
      return fail("the request row has no request");
    }
    const context = featureRequestContextSchema.safeParse(row["context"]);
    if (!context.success) {
      return fail("the context is not a feature request context");
    }
    if (context.data.unsupported.trim() === "") {
      return fail("the context does not say what Ki-Lo cannot do");
    }
    return context.data.recent.some(({ role, text }) => role === "user" && ask.test(text))
      ? pass("one request was written, with its context and the ask in the recent talk")
      : fail("the recent talk of the context does not hold the ask");
  };
}

const TRAIN_TAB = /\btrain tab\b/i;

/** Passes when the last answer names the Train tab, where a workout is started. */
export function answerNamesTheTrainTab(): Grader {
  return ({ turns }) =>
    Promise.resolve(
      TRAIN_TAB.test(turns.at(-1)?.answer ?? "")
        ? pass("the answer names the Train tab")
        : fail("the answer does not name the Train tab"),
    );
}
