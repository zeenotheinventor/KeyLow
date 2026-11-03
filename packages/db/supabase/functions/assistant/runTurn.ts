// The seam between the routes and the turn loop (`turn.ts`). The routes build a `TurnContext` once the
// gates have passed and the turn's rows exist, and the loop streams the rest of the turn.
import type { EventStream } from "./sse.ts";

export type TurnContext = {
  // The verified caller.
  userId: string;
  conversationId: string;
  turnId: string;
  // The id of the user message `startTurn` stored, which the loop replaces with the blocks the model sees.
  userMessageId: string;
  text: string;
  localDate: string;
  localTime: string | null;
  // Carries the caller's JWT, for a client that acts as them, and the signal of the app's request.
  request: Request;
};

export type RunTurn = (context: TurnContext, stream: EventStream) => Promise<void>;
