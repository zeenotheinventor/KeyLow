// The seam the turn loop plugs into (KEY-682). This stub streams the turn's first event and ends it,
// so the gates and the routes can be proved before any model is called.
import { writeEvent } from "./sse.ts";

import type { EventStream } from "./sse.ts";

export type TurnContext = {
  // The verified caller.
  userId: string;
  conversationId: string;
  turnId: string;
  text: string;
  localDate: string;
  localTime: string | null;
  // Carries the caller's JWT, for a client that acts as them.
  request: Request;
};

export type RunTurn = (context: TurnContext, stream: EventStream) => Promise<void>;

export const runTurn: RunTurn = (context, stream) => {
  writeEvent(stream, {
    type: "turn",
    turnId: context.turnId,
    conversationId: context.conversationId,
  });
  writeEvent(stream, { type: "done", outcome: "complete" });
  return Promise.resolve();
};
