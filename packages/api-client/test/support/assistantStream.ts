import { HttpResponse } from "msw";

import type { AssistantCard, AssistantStreamEvent } from "@keylow/core";

export const TURN_ID = "00000000-0000-4000-8000-0000000000a1";
export const CONVERSATION_ID = "00000000-0000-4000-8000-0000000000c1";
export const CONFIRMATION_ID = "00000000-0000-4000-8000-0000000000f1";
export const FUNCTIONS_URL = "http://127.0.0.1:54321/functions/v1";

/** A card with the least a card has, titled as the test needs. */
export const aCard = (title: string): AssistantCard => ({
  actionIds: ["00000000-0000-4000-8000-0000000000d1"],
  kind: "logged",
  title,
  sub: null,
  rows: [],
  totalText: null,
  note: null,
  link: null,
  undo: "available",
  undoneSub: null,
});

const encoder = new TextEncoder();

/** One event as the function writes it: a `data:` line and a blank line. */
export const eventText = (event: AssistantStreamEvent) => `data: ${JSON.stringify(event)}\n\n`;

const streamHeaders = { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" };

/** A finished turn: every event arrives and the stream ends. */
export const turnResponse = (events: AssistantStreamEvent[]) =>
  new HttpResponse(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const event of events) {
          controller.enqueue(encoder.encode(eventText(event)));
        }
        controller.close();
      },
    }),
    { headers: streamHeaders },
  );

/** A stream that sends the text it is given and then waits, as a turn still being written does. */
export function openTurnResponse(text: string) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
    },
  });

  return new HttpResponse(body, { headers: streamHeaders });
}

/** The events of an ordinary reply: the turn, the words in two pieces, and the end. */
export const replyEvents = (...deltas: string[]): AssistantStreamEvent[] => [
  { type: "turn", turnId: TURN_ID, conversationId: CONVERSATION_ID },
  ...deltas.map((delta) => ({ type: "text" as const, delta })),
  { type: "done", outcome: "complete" },
];
