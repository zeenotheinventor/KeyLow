// The conversation, the caller and the two turns the request_feature tests share. Nothing in production
// imports this.
import {
  createFakeActionStore,
  createFakeContext,
  turnsOfConversation,
  userId,
} from "../testing.ts";
import { writeStub } from "./writeStub.ts";
import { requestFeatureTool } from "./requestFeature.ts";

import type { ToolContext } from "../tool.ts";

export const earlier = "00000000-0000-4000-8000-0000000000d1";
export const later = "00000000-0000-4000-8000-0000000000d2";
export const otherConversationId = "00000000-0000-4000-8000-0000000000c9";

export const waterRequest = {
  request: "Track my water intake",
  unsupported: "Ki-Lo does not track water",
};

const contextBlock = {
  type: "text",
  text: "Today is Tue 3 Nov (2026-11-03) in Europe/London.\nThe user is looking at Tue 3 Nov (2026-11-03).",
};

export const userRow = (
  seq: number,
  words: string,
  conversationId: string,
  extra: unknown[] = [],
) => ({
  user_id: userId,
  conversation_id: conversationId,
  seq,
  role: "user",
  content: [...extra, contextBlock, { type: "text", text: words }],
});

export const assistantRow = (seq: number, content: unknown[], conversationId: string) => ({
  user_id: userId,
  conversation_id: conversationId,
  seq,
  role: "assistant",
  content,
});

// `messages` is newest first, which is the order the tool reads them in (`order` does nothing in the stub).
export function requestFeatureContexts(
  messages: (conversationId: string) => Record<string, unknown>[],
) {
  const store = createFakeActionStore({ turns: turnsOfConversation([earlier, later]) });
  const conversationId = store.turns[0]?.conversationId ?? "";
  const stub = writeStub(
    { assistant_messages: messages(conversationId), feature_requests: [] },
    { callerUserId: userId },
  );
  const contextOn = (turnId: string, personsWords: string): ToolContext => ({
    ...createFakeContext([requestFeatureTool], {
      store,
      personsWords,
      userMessageText: personsWords,
      turn: { id: turnId, conversationId },
    }).ctx,
    caller: stub.caller,
  });
  return {
    stub,
    store,
    conversationId,
    asking: contextOn(earlier, "Can you track my water intake?"),
    confirming: contextOn(later, "Send request"),
    contextOn,
  };
}
