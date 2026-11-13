import { parseAssistantEvent } from "@keylow/core";

import {
  applyAssistantEvent,
  failedTurn,
  newLiveTurn,
  stoppedTurn,
  type AssistantLiveTurn,
} from "./assistantLiveTurn";
import { readServerSentData } from "./readServerSentData";

import type { AssistantTurnRequest } from "@keylow/core";

/** What `runAssistantTurn` reads of a response. `expo/fetch` and the platform `fetch` both fit it. */
export type StreamingResponse = {
  ok: boolean;
  headers: { get: (name: string) => string | null };
  body: ReadableStream<Uint8Array> | null;
};

/**
 * The fetch a turn is sent with. It is injected because React Native's own `fetch` cannot read a body as it
 * arrives, so the app passes the `fetch` of `expo/fetch`, and a test or the web passes the global one.
 */
export type StreamingFetch = (
  url: string,
  init: { method: "POST"; headers: Record<string, string>; body: string; signal: AbortSignal },
) => Promise<StreamingResponse>;

/** An event type, a card kind or a card link screen that the server sent and this app has no schema for. */
export type SkippedKind = { subject: "event" | "card" | "link"; kind: string };

type RunAssistantTurnOptions = {
  fetch: StreamingFetch;
  turnUrl: string;
  accessToken: string;
  request: AssistantTurnRequest;
  signal: AbortSignal;
  /** Called with the name of each event type or card kind that was skipped, and nothing else of it. */
  onKindSkipped?: ((skipped: SkippedKind) => void) | undefined;
};

const isEventStream = (response: StreamingResponse) =>
  response.headers.get("Content-Type")?.startsWith("text/event-stream") === true;

// A turn that broke off with no `done` event: stopped when the person aborted it, failed otherwise.
function endedWithoutDone(live: AssistantLiveTurn, signal: AbortSignal) {
  if (live.outcome !== null) {
    return live;
  }
  return signal.aborted ? stoppedTurn(live) : failedTurn(live);
}

/** `streamed` is whether the answer was an event stream, which is when the function may have written. */
export type AssistantTurnEnd = { live: AssistantLiveTurn; streamed: boolean };

/**
 * Sends one message to the `turn` route and reads the answer as it arrives, folding each event into the
 * turn and calling `onChange` with it. Resolves with the turn as it ended and never rejects, because every
 * way a turn can break is a state the sheet draws:
 * - an answer that is not an event stream (the route answers 400 JSON for a body it refuses and 401 JSON
 *   for no sign-in, and a proxy can answer anything) or a connection that fails is the failed turn notice,
 *   without waiting for events,
 * - an event type or a card kind the contract does not know, which is a server ahead of the app, is skipped
 *   and the turn goes on, with its name (and nothing of what it held) given to `onKindSkipped`,
 * - a card whose link screen the contract does not know is drawn with no link, and the screen's name goes to
 *   `onKindSkipped` the same way,
 * - a line that is not an event the contract knows otherwise stops the reading with the failed turn notice, and
 * - an abort through `signal` keeps what arrived and marks the turn stopped, and a signal that is already
 *   aborted sends nothing.
 * It also says whether the answer was an event stream, because from then on the function may have written,
 * whatever way the turn ended. A refused or non-stream answer has its body released and wrote nothing.
 * The message and the events are never logged, because they hold what the person said and ate.
 */
export async function runAssistantTurn(
  { fetch, turnUrl, accessToken, request, signal, onKindSkipped }: RunAssistantTurnOptions,
  onChange: (live: AssistantLiveTurn) => void,
): Promise<AssistantTurnEnd> {
  let live = newLiveTurn();
  const show = (next: AssistantLiveTurn) => {
    live = next;
    onChange(next);
  };
  show(live);
  if (signal.aborted) {
    show(stoppedTurn(live));
    return { live, streamed: false };
  }

  let streamed = false;
  try {
    const response = await fetch(turnUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(request),
      signal,
    });

    if (!response.ok || !isEventStream(response) || response.body === null) {
      void response.body?.cancel().catch(() => undefined);
      show(failedTurn(live));
      return { live, streamed: false };
    }

    streamed = true;
    await readServerSentData(response.body, (data) => {
      const parsed = parseAssistantEvent(data);
      if (!parsed.ok) {
        if (parsed.reason !== "unknown_kind") {
          return false;
        }
        onKindSkipped?.({ subject: parsed.subject, kind: parsed.kind });
        return true;
      }
      if (parsed.skipped !== undefined) {
        onKindSkipped?.(parsed.skipped);
      }
      show(applyAssistantEvent(live, parsed.event));
      // Nothing follows `done`, so a connection a proxy holds open is not waited on.
      return parsed.event.type !== "done";
    });
    show(endedWithoutDone(live, signal));
  } catch {
    show(endedWithoutDone(live, signal));
  }

  return { live, streamed };
}
