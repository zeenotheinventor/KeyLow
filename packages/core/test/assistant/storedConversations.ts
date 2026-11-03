import { loggedCard } from "./cardFixtures";

import type { AssistantStoredMessage } from "../../src/assistant";

// Hand-written stored conversations, as `assistant_messages` holds them: raw Messages API content blocks
// in `content`. A tool result block holds the executor's model-facing text, and what the app draws for it
// (the card, the confirmation, the citation) is in the message's `display`, keyed by `tool_use_id`.

const preamble = (localDate: string) => ({
  type: "text",
  text: `Today is ${localDate}. The user is looking at ${localDate}.`,
});

export const wrapToolResult = (source: string, outcome: unknown): string =>
  `<untrusted_data source="${source}">${JSON.stringify(outcome).replaceAll("<", "\\u003c")}</untrusted_data>`;

type MessageInput = Omit<AssistantStoredMessage, "turnStatus" | "display"> & {
  turnStatus?: AssistantStoredMessage["turnStatus"];
  display?: unknown;
};

export const message = (input: MessageInput): AssistantStoredMessage => ({
  turnStatus: "complete",
  display: null,
  ...input,
});

export const userMessage = (id: string, turnId: string, text: string, withPreamble = true) =>
  message({
    id,
    turnId,
    role: "user",
    content: withPreamble
      ? [preamble("Mon 26 Oct"), { type: "text", text }]
      : [{ type: "text", text }],
  });

export const toolUseMessage = (
  id: string,
  turnId: string,
  calls: { id: string; name: string; input?: unknown }[],
  text?: string,
) =>
  message({
    id,
    turnId,
    role: "assistant",
    content: [
      ...(text === undefined ? [] : [{ type: "text", text }]),
      ...calls.map((call) => ({
        type: "tool_use",
        id: call.id,
        name: call.name,
        input: call.input ?? {},
      })),
    ],
  });

export const toolResultMessage = (
  id: string,
  turnId: string,
  results: { toolUseId: string; source: string; outcome: unknown }[],
) =>
  message({
    id,
    turnId,
    role: "user",
    content: results.map((result) => ({
      type: "tool_result",
      tool_use_id: result.toolUseId,
      content: wrapToolResult(result.source, { status: "done" }),
    })),
    display: Object.fromEntries(results.map((result) => [result.toolUseId, result.outcome])),
  });

export const replyMessage = (id: string, turnId: string, text: string) =>
  message({ id, turnId, role: "assistant", content: [{ type: "text", text }] });

export const firstTurnId = "00000000-0000-4000-8000-0000000000a1";
export const secondTurnId = "00000000-0000-4000-8000-0000000000a2";

/** `assistant · conversation`: "2 eggs and toast at 8:10", its card, then "What's left for today?" and the answer. */
export const boardConversation: AssistantStoredMessage[] = [
  userMessage("m1", firstTurnId, "2 eggs and toast at 8:10"),
  toolUseMessage("m2", firstTurnId, [{ id: "call-1", name: "log_entry" }]),
  toolResultMessage("m3", firstTurnId, [
    { toolUseId: "call-1", source: "log_entry", outcome: { card: loggedCard } },
  ]),
  userMessage("m4", secondTurnId, "What's left for today?"),
  toolUseMessage("m5", secondTurnId, [{ id: "call-2", name: "get_day" }]),
  toolResultMessage("m6", secondTurnId, [
    {
      toolUseId: "call-2",
      source: "get_day",
      outcome: { citation: "Based on 4 entries today and your targets", kcal: 1193 },
    },
  ]),
  replyMessage("m7", secondTurnId, "You have 1,693 kcal and 117 g of protein left today."),
];
