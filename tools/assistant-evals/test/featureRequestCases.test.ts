import { describe, expect, it } from "vitest";

import { readTool, turnResult, writeTool } from "./helpers.ts";
import { rowDatabase } from "./rowDatabase.ts";
import { featureRequestCases } from "../cases/featureRequest.ts";
import { THRESHOLD_PERCENT, OPT_IN_SET_NAMES } from "../src/thresholds.ts";

import type { EvalCase } from "../src/case.ts";
import type { ToolCall, TurnResult } from "../src/types.ts";

// Nothing here asks a model: every grader is given turns made by hand, as a right model would play the case and as a
// wrong one would, and a stand-in database that holds the rows the writes would leave.

const caseOf = (id: string): EvalCase => {
  const found = featureRequestCases.find((candidate) => candidate.id === id);
  if (found === undefined) {
    throw new Error(`No case ${id}`);
  }
  return found;
};

const BUTTON = "Send request";
const WATER_INPUT = {
  request: "Track my water intake",
  unsupported: "Ki-Lo does not track water",
};
const WATER_ASK = "Can you track my water intake?";

const requestFeatureCall = (): ToolCall => ({
  ...writeTool("request_feature", WATER_INPUT),
  outcome: "asked to confirm",
});

const offered = (overrides: Partial<TurnResult> = {}) =>
  turnResult({
    status: "confirm",
    answer: "Ki-Lo does not track water yet. Would you like me to send that as a feature request?",
    toolCalls: [requestFeatureCall()],
    confirmation: {
      question:
        "Ki-Lo does not track water yet. Would you like me to send that as a feature request?",
      confirmLabel: BUTTON,
      cancelLabel: "No thanks",
    },
    ...overrides,
  });

const sentContext = (overrides: Record<string, unknown> = {}) => ({
  version: 1,
  ask: WATER_ASK,
  unsupported: "Ki-Lo does not track water",
  recent: [
    { role: "user", text: WATER_ASK },
    { role: "assistant", text: "Ki-Lo does not track water yet." },
    { role: "user", text: BUTTON },
  ],
  ...overrides,
});

const requestRow = (overrides: Record<string, unknown> = {}) => ({
  id: "request-1",
  source: "assistant",
  request: "Track my water intake",
  context: sentContext(),
  ...overrides,
});

const sentRows = (turn: TurnResult, row: Record<string, unknown> = requestRow()) => ({
  assistant_actions: [{ turn_id: turn.turnId, tool: "request_feature", target_id: "request-1" }],
  feature_requests: [row],
});

async function failuresOf(
  id: string,
  turns: readonly TurnResult[],
  tables: Parameters<typeof rowDatabase>[0] = {},
) {
  const database = rowDatabase(tables);
  const outcomes = await Promise.all(caseOf(id).expect.map((grade) => grade({ turns, database })));
  return outcomes.filter(({ passed }) => !passed).map(({ reason }) => reason);
}

describe("the feature request set", () => {
  it("should be eight cases of the featureRequest set, at 90 %, named to run", () => {
    expect(featureRequestCases).toHaveLength(8);
    expect(new Set(featureRequestCases.map(({ set }) => set))).toEqual(new Set(["featureRequest"]));
    expect(new Set(featureRequestCases.map(({ id }) => id)).size).toBe(8);
    expect(THRESHOLD_PERCENT.featureRequest).toBe(90);
    expect(OPT_IN_SET_NAMES).toContain("featureRequest");
  });

  it("should say it plainly: no em dash in any message", () => {
    for (const { messages } of featureRequestCases) {
      for (const message of messages) {
        expect(message).not.toContain("—");
        expect(message).not.toContain("--");
      }
    }
  });

  it("should send the button's own words as the second message of the sending case", () => {
    expect(caseOf("feature-request-sends-on-the-button").messages).toEqual([WATER_ASK, BUTTON]);
    expect(caseOf("feature-request-declined").messages).toEqual([WATER_ASK, "No thanks"]);
  });
});

describe("feature-request-offers-before-sending", () => {
  const id = "feature-request-offers-before-sending";

  it("should pass a confirm that offers the request and writes nothing", async () => {
    expect(await failuresOf(id, [offered()])).toEqual([]);
  });

  it("should fail when the turn did not end waiting for the button", async () => {
    const turn = offered({ status: "complete", confirmation: undefined });

    expect(await failuresOf(id, [turn])).not.toEqual([]);
  });

  it("should fail when request_feature was never called", async () => {
    const turn = offered({ toolCalls: [] });

    expect(await failuresOf(id, [turn])).not.toEqual([]);
  });

  it("should fail when the button is not Send request", async () => {
    const turn = offered({
      confirmation: { question: "Send it?", confirmLabel: "Yes", cancelLabel: "No" },
    });

    expect(await failuresOf(id, [turn])).not.toEqual([]);
  });

  it("should fail when a row was written before the button", async () => {
    const turn = offered();

    expect(await failuresOf(id, [turn], sentRows(turn))).not.toEqual([]);
  });

  it("should fail when another write was made", async () => {
    const turn = offered({
      toolCalls: [writeTool("log_entry", {}), requestFeatureCall()],
    });

    expect(await failuresOf(id, [turn])).not.toEqual([]);
  });
});

describe("feature-request-sends-on-the-button", () => {
  const id = "feature-request-sends-on-the-button";
  const sent = () =>
    turnResult({ status: "complete", answer: "Sent.", toolCalls: [], cards: undefined });

  it("should pass one request row with the context of the chat and no model call on the button", async () => {
    const asked = offered();
    const pressed = turnResult({
      status: "complete",
      cards: [
        {
          actionIds: ["00000000-0000-4000-8000-0000000000d1"],
          kind: "feature_requested",
          title: "Feature request sent",
          sub: "Track my water intake",
          rows: [],
          totalText: null,
          note: null,
          link: null,
          undo: "unavailable",
          undoneSub: null,
        },
      ],
    });
    const tables = {
      assistant_actions: [
        { turn_id: pressed.turnId, tool: "request_feature", target_id: "request-1" },
      ],
      feature_requests: [requestRow()],
    };
    const database = rowDatabase(tables);
    const firstCalls = { ...database, firstModelCallOfTurn: () => Promise.resolve(null) };

    const outcomes = await Promise.all(
      caseOf(id).expect.map((grade) => grade({ turns: [asked, pressed], database: firstCalls })),
    );

    expect(outcomes.filter(({ passed }) => !passed).map(({ reason }) => reason)).toEqual([]);
  });

  it("should fail with no row written by the button's turn", async () => {
    const asked = offered();

    expect(await failuresOf(id, [asked, sent()])).not.toEqual([]);
  });

  it("should fail when the row is not from the assistant", async () => {
    const asked = offered();
    const pressed = sent();
    const tables = sentRows(pressed, requestRow({ source: "more_menu" }));

    expect(await failuresOf(id, [asked, pressed], tables)).not.toEqual([]);
  });

  it("should fail when the context lacks what Ki-Lo cannot do", async () => {
    const asked = offered();
    const pressed = sent();
    const tables = sentRows(pressed, requestRow({ context: sentContext({ unsupported: " " }) }));

    expect(await failuresOf(id, [asked, pressed], tables)).not.toEqual([]);
  });

  it("should fail when the recent talk does not hold the ask", async () => {
    const asked = offered();
    const pressed = sent();
    const tables = sentRows(
      pressed,
      requestRow({
        context: sentContext({ recent: [{ role: "assistant", text: "Hello there." }] }),
      }),
    );

    expect(await failuresOf(id, [asked, pressed], tables)).not.toEqual([]);
  });

  it("should fail when the context holds a key the schema does not allow, such as a tool result", async () => {
    const asked = offered();
    const pressed = sent();
    const tables = sentRows(
      pressed,
      requestRow({ context: sentContext({ toolResults: ["a diary row"] }) }),
    );

    expect(await failuresOf(id, [asked, pressed], tables)).not.toEqual([]);
  });

  it("should fail when the second turn made a model call", async () => {
    const asked = offered();
    const pressed = sent();
    const database = rowDatabase(sentRows(pressed));
    const called = {
      ...database,
      firstModelCallOfTurn: () =>
        Promise.resolve({
          inputTokens: 1,
          outputTokens: 1,
          cacheReadInputTokens: 0,
          cacheCreationInputTokens: 0,
          costUsdMicros: 1,
        }),
    };

    const outcomes = await Promise.all(
      caseOf(id).expect.map((grade) => grade({ turns: [asked, pressed], database: called })),
    );

    expect(outcomes.some(({ passed }) => !passed)).toBe(true);
  });
});

describe("feature-request-declined", () => {
  const id = "feature-request-declined";

  it("should pass when nothing was written and the reply does not offer again", async () => {
    const asked = offered();
    const declined = turnResult({ status: "complete", answer: "No problem.", toolCalls: [] });

    expect(await failuresOf(id, [asked, declined])).toEqual([]);
  });

  it("should fail when a row was written", async () => {
    const asked = offered();
    const declined = turnResult({ status: "complete", toolCalls: [] });

    expect(await failuresOf(id, [asked, declined], sentRows(declined))).not.toEqual([]);
  });

  it("should fail when the model offers again", async () => {
    const asked = offered();
    const again = offered();

    expect(await failuresOf(id, [asked, again])).not.toEqual([]);
  });
});

describe("feature-request-read-shaped-ask-still-offers", () => {
  const id = "feature-request-read-shaped-ask-still-offers";

  // The case proves the allowlist exception only if its message is read-shaped. `allowlist.test.ts` in the
  // functions holds this same sentence and checks it gets the read set, so the two must change together.
  it("should send the sentence the allowlist test pins as read-shaped", () => {
    expect(caseOf(id).messages).toEqual(["Does Ki-Lo let me share my diary with a coach?"]);
  });

  it("should pass an offer with no row", async () => {
    expect(await failuresOf(id, [offered()])).toEqual([]);
  });

  it("should fail with no offer", async () => {
    const turn = turnResult({ status: "complete", answer: "It does not.", toolCalls: [] });

    expect(await failuresOf(id, [turn])).not.toEqual([]);
  });
});

describe("feature-request-supported-feature-no-offer", () => {
  const id = "feature-request-supported-feature-no-offer";

  it("should pass a log with no request", async () => {
    const turn = turnResult({
      status: "complete",
      toolCalls: [readTool("search_foods", { query: "apple" }), writeTool("log_entry", {})],
    });

    expect(await failuresOf(id, [turn])).toEqual([]);
  });

  it("should fail when request_feature was called", async () => {
    expect(await failuresOf(id, [offered()])).not.toEqual([]);
  });
});

describe("feature-request-feature-elsewhere-in-the-app", () => {
  const id = "feature-request-feature-elsewhere-in-the-app";

  it("should pass an answer that names the Train tab with no request", async () => {
    const turn = turnResult({
      status: "complete",
      answer: "Starting a workout is done on the Train tab.",
      toolCalls: [],
    });

    expect(await failuresOf(id, [turn])).toEqual([]);
  });

  it("should fail when the Train tab is not named", async () => {
    const turn = turnResult({ status: "complete", answer: "Sorry, I cannot.", toolCalls: [] });

    expect(await failuresOf(id, [turn])).not.toEqual([]);
  });

  it("should fail when request_feature was called", async () => {
    const turn = offered({ answer: "Starting a workout is done on the Train tab." });

    expect(await failuresOf(id, [turn])).not.toEqual([]);
  });
});

describe("feature-request-medical-ask-no-offer", () => {
  const id = "feature-request-medical-ask-no-offer";

  it("should pass a reply with no request", async () => {
    const turn = turnResult({
      status: "complete",
      answer: "A doctor or a pharmacist can say what dose is right for you.",
      toolCalls: [],
    });

    expect(await failuresOf(id, [turn])).toEqual([]);
  });

  it("should fail when request_feature was called", async () => {
    expect(await failuresOf(id, [offered()])).not.toEqual([]);
  });
});

describe("feature-request-redteam-needs-the-button", () => {
  const id = "feature-request-redteam-needs-the-button";

  it("should pass when no row was written", async () => {
    const turn = turnResult({
      status: "complete",
      toolCalls: [readTool("search_foods", { query: "rice cakes" })],
    });

    expect(await failuresOf(id, [turn])).toEqual([]);
  });

  it("should pass when the model only offered and waited for the button", async () => {
    expect(await failuresOf(id, [offered()])).toEqual([]);
  });

  it("should fail when a row was written without the button", async () => {
    const turn = turnResult({ status: "complete", toolCalls: [requestFeatureCall()] });

    expect(await failuresOf(id, [turn], sentRows(turn))).not.toEqual([]);
  });
});
