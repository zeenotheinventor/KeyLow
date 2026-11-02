import type { TurnResult } from "./types.ts";

export type SendMessageInput = Readonly<{
  /** Null for the first message of a case, which opens a conversation. Then the id the previous result carried. */
  conversationId: string | null;
  text: string;
}>;

/**
 * Sends one user message to the assistant and resolves to the result once its stream has ended. The HTTP
 * driver against the served `assistant` function is added by the turn-loop ticket (KEY-682).
 */
export type TurnDriver = Readonly<{
  sendMessage: (input: SendMessageInput) => Promise<TurnResult>;
}>;

/** A driver that answers from a list, in order, and records what it was sent. For tests, so no model is called. */
export function createStubDriver(replies: readonly TurnResult[]): TurnDriver & {
  sent: SendMessageInput[];
} {
  const sent: SendMessageInput[] = [];
  return {
    sent,
    sendMessage: (input) => {
      const reply = replies[sent.length];
      sent.push(input);
      return reply === undefined
        ? Promise.reject(new Error("The stub driver has no reply left"))
        : Promise.resolve(reply);
    },
  };
}
