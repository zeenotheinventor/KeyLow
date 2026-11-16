import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { runAssistantTurn } from "../src/runAssistantTurn";
import {
  CONVERSATION_ID,
  FUNCTIONS_URL,
  TURN_ID,
  eventText,
  openTurnResponse,
  replyEvents,
  turnResponse,
} from "./support/assistantStream";

import type { StreamingFetch } from "../src/runAssistantTurn";

const server = setupServer();
const TURN_URL = `${FUNCTIONS_URL}/assistant/turn`;

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const request = { conversationId: null, text: "Hi", localDate: "2026-11-13", localTime: null };

const run = (
  options: { resumeDetachedTurns?: boolean; fetch?: StreamingFetch; signal?: AbortSignal } = {},
) =>
  runAssistantTurn(
    {
      fetch: options.fetch ?? fetch,
      turnUrl: TURN_URL,
      accessToken: "token",
      request,
      signal: options.signal ?? new AbortController().signal,
      resumeDetachedTurns: options.resumeDetachedTurns,
    },
    () => undefined,
  );

// Aborts once the words have arrived, as closing the sheet does.
function runUntilWordsThenAbort(resumeDetachedTurns: boolean) {
  const controller = new AbortController();
  return runAssistantTurn(
    {
      fetch,
      turnUrl: TURN_URL,
      accessToken: "token",
      request,
      signal: controller.signal,
      resumeDetachedTurns,
    },
    (live) => {
      if (live.text === "Half an" && !controller.signal.aborted) {
        controller.abort();
      }
    },
  );
}

const turnAndWords = [
  eventText({ type: "turn", turnId: TURN_ID, conversationId: CONVERSATION_ID }),
  eventText({ type: "text", delta: "Half an" }),
].join("");

describe("runAssistantTurn, a stream that ends without done", () => {
  it("should leave the turn detached, with the ids and the words so far, when resume is on", async () => {
    server.use(http.post(TURN_URL, () => turnResponse(replyEvents("Half an").slice(0, 2))));

    const { live, streamed } = await run({ resumeDetachedTurns: true });

    expect(streamed).toBe(true);
    expect(live).toMatchObject({
      turnId: TURN_ID,
      conversationId: CONVERSATION_ID,
      text: "Half an",
      notice: null,
      outcome: null,
      stopped: false,
    });
    expect(typeof live.detached?.atMs).toBe("number");
  });

  it("should leave the turn failed when resume is off", async () => {
    server.use(http.post(TURN_URL, () => turnResponse(replyEvents("Half an").slice(0, 2))));

    const { live } = await run();

    expect(live).toMatchObject({ outcome: "failed", notice: { code: "turn_failed" } });
    expect(live.detached).toBeUndefined();
  });

  it("should leave the turn detached when the connection breaks mid-stream and resume is on", async () => {
    server.use(
      http.post(
        TURN_URL,
        () =>
          new HttpResponse(
            new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(new TextEncoder().encode(turnAndWords));
                setTimeout(() => {
                  controller.error(new Error("connection reset"));
                }, 20);
              },
            }),
            { headers: { "Content-Type": "text/event-stream" } },
          ),
      ),
    );

    const { live } = await run({ resumeDetachedTurns: true });

    expect(live.detached).toBeDefined();
    expect(live.turnId).toBe(TURN_ID);
  });

  it("should leave the turn detached, not stopped, when it is aborted and resume is on", async () => {
    server.use(http.post(TURN_URL, () => openTurnResponse(turnAndWords)));

    const { live } = await runUntilWordsThenAbort(true);

    expect(live.detached).toBeDefined();
    expect(live.stopped).toBe(false);
    expect(live.text).toBe("Half an");
  });

  it("should leave the turn stopped when it is aborted and resume is off", async () => {
    server.use(http.post(TURN_URL, () => openTurnResponse(turnAndWords)));

    const { live } = await runUntilWordsThenAbort(false);

    expect(live).toMatchObject({ stopped: true, text: "Half an" });
    expect(live.detached).toBeUndefined();
  });

  it("should leave the turn failed, not detached, when a line cannot be read, even with resume on", async () => {
    server.use(
      http.post(TURN_URL, () => openTurnResponse(`${turnAndWords}data: {"not":"an event"}\n\n`)),
    );

    const { live } = await run({ resumeDetachedTurns: true });

    expect(live).toMatchObject({ outcome: "failed", notice: { code: "turn_failed" } });
    expect(live.detached).toBeUndefined();
  });
});

describe("runAssistantTurn, a request that gets no answer", () => {
  const rejectingFetch: StreamingFetch = () =>
    Promise.reject(new TypeError("Network request failed"));

  it.each([true, false])(
    "should be the failed turn when fetch rejects, with resume %s",
    async (resume) => {
      const { live, streamed } = await run({ fetch: rejectingFetch, resumeDetachedTurns: resume });

      expect(streamed).toBe(false);
      expect(live).toMatchObject({ outcome: "failed", notice: { code: "turn_failed" } });
      expect(live.detached).toBeUndefined();
    },
  );

  it("should be the failed turn for an answer that is not an event stream, with resume on", async () => {
    server.use(http.post(TURN_URL, () => HttpResponse.json({ error: "no" }, { status: 401 })));

    const { live } = await run({ resumeDetachedTurns: true });

    expect(live).toMatchObject({ outcome: "failed" });
    expect(live.detached).toBeUndefined();
  });
});

describe("runAssistantTurn, a finished turn", () => {
  it("should not be detached when done arrives, with resume on", async () => {
    server.use(http.post(TURN_URL, () => turnResponse(replyEvents("Hello"))));

    const { live } = await run({ resumeDetachedTurns: true });

    expect(live).toMatchObject({ outcome: "complete", text: "Hello" });
    expect(live.detached).toBeUndefined();
  });
});
