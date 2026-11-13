import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { useAssistantTurn } from "../../src/hooks/useAssistantTurn";
import { keys } from "../../src/queryKeys";
import { createTestClient } from "../createTestClient";
import {
  CONFIRMATION_ID,
  CONVERSATION_ID,
  FUNCTIONS_URL,
  TURN_ID,
  aCard,
  eventText,
  openTurnResponse,
  replyEvents,
  turnResponse,
} from "../support/assistantStream";
import { AUTH_USER_URL, SIGNED_IN_USER_ID, signInAs } from "../support/postgrest";
import { createWrapper } from "../support/wrapper";

import type { SkippedKind, StreamingFetch } from "../../src/runAssistantTurn";
import type { AssistantNotice, AssistantStreamEvent } from "@keylow/core";
import type { QueryClient } from "@tanstack/react-query";

const server = setupServer();
const TURN_URL = `${FUNCTIONS_URL}/assistant/turn`;
// What a sheet that opens on no earlier conversation sends: a new one.
const sheetDay = { localDate: "2026-11-03", conversationId: null };

let turnRequests: { headers: Headers; body: unknown }[] = [];

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  turnRequests = [];
  server.use(
    http.get(AUTH_USER_URL, () =>
      HttpResponse.json({ id: SIGNED_IN_USER_ID, aud: "authenticated", role: "authenticated" }),
    ),
  );
});
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => {
  server.close();
});

// Answers the turn route with what `respond` gives, and keeps what each request carried.
function answerTurns(respond: () => Response | Promise<Response>) {
  server.use(
    http.post(TURN_URL, async ({ request }) => {
      turnRequests.push({ headers: request.headers, body: await request.clone().json() });
      return respond();
    }),
  );
}

function answerWith(events: AssistantStreamEvent[]) {
  answerTurns(() => turnResponse(events));
}

async function renderTurn({
  signedIn = true,
  fetchOverride,
  onKindSkipped,
}: {
  signedIn?: boolean;
  fetchOverride?: StreamingFetch;
  onKindSkipped?: (skipped: SkippedKind) => void;
} = {}) {
  const client = createTestClient();
  if (signedIn) {
    await signInAs(client, SIGNED_IN_USER_ID);
  }
  const { queryClient, wrapper } = createWrapper(client, { functionsUrl: FUNCTIONS_URL });
  // The spy passes the request on, so a test can read the signal the hook gave it.
  const injectedFetch = vi.fn<StreamingFetch>((url, init) => (fetchOverride ?? fetch)(url, init));
  const rendered = renderHook(() => useAssistantTurn({ fetch: injectedFetch, onKindSkipped }), {
    wrapper,
  });
  return { ...rendered, client, queryClient, injectedFetch };
}

type Rendered = Awaited<ReturnType<typeof renderTurn>>;

async function sendAndSettle(
  { result }: Rendered,
  text = "What did I eat yesterday?",
  options: Parameters<Rendered["result"]["current"]["send"]>[1] = sheetDay,
) {
  await act(async () => {
    await result.current.send(text, options);
  });
  await waitFor(() => {
    expect(result.current.isStreaming).toBe(false);
  });
}

function watchInvalidations(queryClient: QueryClient, ...queryKeys: (readonly unknown[])[]) {
  for (const queryKey of queryKeys) {
    queryClient.setQueryData(queryKey, "cached");
  }
  return (queryKey: readonly unknown[]) => queryClient.getQueryState(queryKey)?.isInvalidated;
}

describe("useAssistantTurn, the request", () => {
  it("should post the message to the turn route with the session's access token", async () => {
    answerWith(replyEvents("Hello"));
    const rendered = await renderTurn();

    await sendAndSettle(rendered, "What did I eat yesterday?", {
      localDate: "2026-11-03",
      localTime: "13:00",
      conversationId: null,
    });

    expect(turnRequests).toHaveLength(1);
    expect(turnRequests[0]?.headers.get("authorization")).toMatch(/^Bearer .+\..+\..+$/);
    expect(turnRequests[0]?.headers.get("content-type")).toBe("application/json");
    expect(turnRequests[0]?.body).toEqual({
      conversationId: null,
      text: "What did I eat yesterday?",
      localDate: "2026-11-03",
      localTime: "13:00",
    });
  });

  it("should send no local time when the caller gives none", async () => {
    answerWith(replyEvents("Hello"));
    const rendered = await renderTurn();

    await sendAndSettle(rendered);

    expect(turnRequests[0]?.body).toMatchObject({ localTime: null });
  });

  it("should send into the conversation the caller names, or start a new one for null", async () => {
    answerWith(replyEvents("Hello"));
    const rendered = await renderTurn();
    const otherConversation = "00000000-0000-4000-8000-0000000000c2";

    await sendAndSettle(rendered, "First", { ...sheetDay, conversationId: otherConversation });
    await sendAndSettle(rendered, "Second", { ...sheetDay, conversationId: null });

    expect(turnRequests.map((request) => request.body)).toMatchObject([
      { conversationId: otherConversation },
      { conversationId: null },
    ]);
  });
});

describe("useAssistantTurn, what each board shows", () => {
  it("should have nothing live before the first send", async () => {
    const { result } = await renderTurn();

    expect(result.current.live).toBeNull();
    expect(result.current.isStreaming).toBe(false);
  });

  it("should build the reply from the text pieces and end complete (assistant · streaming)", async () => {
    answerWith(replyEvents("Yesterday you ", "ate 1,840 kcal."));
    const rendered = await renderTurn();

    await sendAndSettle(rendered);

    expect(rendered.result.current.live).toEqual({
      turnId: TURN_ID,
      conversationId: CONVERSATION_ID,
      text: "Yesterday you ate 1,840 kcal.",
      cards: [],
      clarify: null,
      confirm: null,
      answerMeta: null,
      link: null,
      exerciseMuscles: [],
      exerciseFormMedia: [],
      askAgain: false,
      status: null,
      notice: null,
      stopped: false,
      outcome: "complete",
    });
  });

  it("should hold the logged card with the words around it (assistant-card · logged)", async () => {
    const card = aCard("Logged 2 eggs and toast at 08:10");
    answerWith([
      { type: "turn", turnId: TURN_ID, conversationId: CONVERSATION_ID },
      { type: "text", delta: "Done." },
      { type: "card", card },
      { type: "done", outcome: "complete" },
    ]);
    const rendered = await renderTurn();

    await sendAndSettle(rendered);

    expect(rendered.result.current.live).toMatchObject({
      text: "Done.",
      cards: [card],
      outcome: "complete",
    });
  });

  it("should hold the question and quick replies (assistant · clarify)", async () => {
    answerWith([
      { type: "turn", turnId: TURN_ID, conversationId: CONVERSATION_ID },
      {
        type: "clarify",
        question: "How much chicken and how much rice?",
        quickReplies: ["1 chicken breast, 150 g rice", "1 chicken breast, 200 g rice"],
        fieldHint: "Or say it your way",
      },
      { type: "done", outcome: "clarify" },
    ]);
    const rendered = await renderTurn();

    await sendAndSettle(rendered);

    expect(rendered.result.current.live).toMatchObject({
      clarify: {
        question: "How much chicken and how much rice?",
        quickReplies: ["1 chicken breast, 150 g rice", "1 chicken breast, 200 g rice"],
        fieldHint: "Or say it your way",
      },
      outcome: "clarify",
    });
  });

  it("should hold the confirm with its labels and tone (assistant · confirm)", async () => {
    answerWith([
      { type: "turn", turnId: TURN_ID, conversationId: CONVERSATION_ID },
      {
        type: "confirm",
        confirmationId: CONFIRMATION_ID,
        question: "Delete 3 entries at 13:00 today?",
        confirmLabel: "Delete 3 entries",
        cancelLabel: "Keep them",
        tone: "danger",
      },
      { type: "done", outcome: "confirm" },
    ]);
    const rendered = await renderTurn();

    await sendAndSettle(rendered);

    expect(rendered.result.current.live).toMatchObject({
      confirm: {
        confirmationId: CONFIRMATION_ID,
        question: "Delete 3 entries at 13:00 today?",
        confirmLabel: "Delete 3 entries",
        cancelLabel: "Keep them",
        tone: "danger",
      },
      outcome: "confirm",
    });
  });

  it("should hold the citation and the estimate under an answer (assistant · answer-estimate)", async () => {
    answerWith([
      { type: "turn", turnId: TURN_ID, conversationId: CONVERSATION_ID },
      { type: "text", delta: "Your trend weight is 81.2 kg." },
      {
        type: "answer_meta",
        citation: "Based on 24 weigh-ins, 21 Sep to 18 Oct",
        estimate: "Trend weight is an estimate",
      },
      { type: "done", outcome: "complete" },
    ]);
    const rendered = await renderTurn();

    await sendAndSettle(rendered);

    expect(rendered.result.current.live?.answerMeta).toEqual({
      citation: "Based on 24 weigh-ins, 21 Sep to 18 Oct",
      estimate: "Trend weight is an estimate",
    });
  });

  it("should show the recipe being read while it is read, then drop it (assistant · recipe-import)", async () => {
    let finishReading: () => void = () => undefined;
    const reading = new Promise<void>((resolve) => {
      finishReading = resolve;
    });
    const encoder = new TextEncoder();
    answerTurns(
      () =>
        new HttpResponse(
          new ReadableStream<Uint8Array>({
            async start(controller) {
              controller.enqueue(
                encoder.encode(
                  eventText({ type: "turn", turnId: TURN_ID, conversationId: CONVERSATION_ID }) +
                    eventText({ type: "status", code: "reading_recipe", host: "example.com" }),
                ),
              );
              await reading;
              controller.enqueue(
                encoder.encode(
                  eventText({ type: "card", card: aCard("Saved Lemon chicken") }) +
                    eventText({ type: "done", outcome: "complete" }),
                ),
              );
              controller.close();
            },
          }),
          { headers: { "Content-Type": "text/event-stream" } },
        ),
    );
    const { result } = await renderTurn();

    act(() => {
      void result.current.send("Import https://example.com/lemon-chicken", sheetDay);
    });
    await waitFor(() => {
      expect(result.current.live?.status).toEqual({ code: "reading_recipe", host: "example.com" });
    });
    expect(result.current.isStreaming).toBe(true);
    finishReading();

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });
    expect(result.current.live).toMatchObject({ status: null, outcome: "complete" });
    expect(result.current.live?.cards).toHaveLength(1);
  });

  it.each<[string, AssistantNotice]>([
    ["assistant · consent-needed", { code: "consent_needed" }],
    ["assistant · day-limit", { code: "day_limit", resetsAt: "2026-11-04T00:00:00Z" }],
    ["assistant · plus", { code: "plus" }],
    ["assistant · resting", { code: "resting", resumesOn: "2026-12-01" }],
    ["assistant · unavailable (switched off)", { code: "switched_off" }],
    ["assistant · unavailable (failed turn)", { code: "turn_failed" }],
  ])("should hold the notice for %s", async (_board, notice) => {
    answerWith([
      { type: "notice", notice },
      { type: "done", outcome: "failed" },
    ]);
    const rendered = await renderTurn();

    await sendAndSettle(rendered);

    expect(rendered.result.current.live).toMatchObject({ notice, text: "", outcome: "failed" });
  });

  it("should show a day limit from the stream even though the status said open", async () => {
    answerWith([
      { type: "notice", notice: { code: "day_limit", resetsAt: "2026-11-04T00:00:00Z" } },
      { type: "done", outcome: "failed" },
    ]);
    const rendered = await renderTurn();
    rendered.queryClient.setQueryData(keys.assistant.status, { notice: null });

    await sendAndSettle(rendered);

    expect(rendered.result.current.live?.notice).toEqual({
      code: "day_limit",
      resetsAt: "2026-11-04T00:00:00Z",
    });
  });

  it("should start the next turn from nothing", async () => {
    answerWith([...replyEvents("First reply")]);
    const rendered = await renderTurn();
    await sendAndSettle(rendered, "First");
    answerWith([
      { type: "turn", turnId: TURN_ID, conversationId: CONVERSATION_ID },
      { type: "done", outcome: "complete" },
    ]);

    await sendAndSettle(rendered, "Second");

    expect(rendered.result.current.live?.text).toBe("");
  });
});

describe("useAssistantTurn, one send at a time", () => {
  it("should be streaming from the send until the stream ends", async () => {
    answerTurns(() => openTurnResponse(eventText({ type: "text", delta: "Yesterday" })));
    const { result } = await renderTurn();

    act(() => {
      void result.current.send("What did I eat?", sheetDay);
    });

    expect(result.current.isStreaming).toBe(true);
    await waitFor(() => {
      expect(result.current.live?.text).toBe("Yesterday");
    });
    expect(result.current.isStreaming).toBe(true);
  });

  it("should ignore a second send while one is streaming", async () => {
    answerTurns(() => openTurnResponse(eventText({ type: "text", delta: "Yesterday" })));
    const { result } = await renderTurn();

    act(() => {
      void result.current.send("First", sheetDay);
      void result.current.send("Second", sheetDay);
    });
    await waitFor(() => {
      expect(result.current.live?.text).toBe("Yesterday");
    });

    expect(turnRequests).toHaveLength(1);
    expect(turnRequests[0]?.body).toMatchObject({ text: "First" });
  });
});

describe("useAssistantTurn, stop", () => {
  it("should keep the text that arrived and mark the turn stopped", async () => {
    answerTurns(() =>
      openTurnResponse(
        eventText({ type: "turn", turnId: TURN_ID, conversationId: CONVERSATION_ID }) +
          eventText({ type: "text", delta: "Yesterday you ate" }),
      ),
    );
    const { result, injectedFetch } = await renderTurn();
    act(() => {
      void result.current.send("What did I eat?", sheetDay);
    });
    await waitFor(() => {
      expect(result.current.live?.text).toBe("Yesterday you ate");
    });

    act(() => {
      result.current.stop();
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });
    expect(result.current.live).toMatchObject({
      text: "Yesterday you ate",
      stopped: true,
      notice: null,
      outcome: null,
    });
    expect(injectedFetch.mock.calls[0]?.[1].signal.aborted).toBe(true);
  });

  it("should keep the conversation id on the stopped turn, for the next send to name", async () => {
    answerTurns(() =>
      openTurnResponse(
        eventText({ type: "turn", turnId: TURN_ID, conversationId: CONVERSATION_ID }) +
          eventText({ type: "text", delta: "Yesterday" }),
      ),
    );
    const { result } = await renderTurn();
    act(() => {
      void result.current.send("First", sheetDay);
    });
    await waitFor(() => {
      expect(result.current.live?.text).toBe("Yesterday");
    });

    act(() => {
      result.current.stop();
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });
    expect(result.current.live?.conversationId).toBe(CONVERSATION_ID);
  });

  it("should not send before the session is read when stop came first", async () => {
    answerWith(replyEvents("Hello"));
    const rendered = await renderTurn();
    let openGate: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      openGate = resolve;
    });
    const readSession = rendered.client.auth.getSession.bind(rendered.client.auth);
    vi.spyOn(rendered.client.auth, "getSession").mockImplementationOnce(async () => {
      await gate;
      return readSession();
    });
    act(() => {
      void rendered.result.current.send("First", sheetDay);
    });

    act(() => {
      rendered.result.current.stop();
    });
    openGate();

    await waitFor(() => {
      expect(rendered.result.current.isStreaming).toBe(false);
    });
    expect(rendered.injectedFetch).not.toHaveBeenCalled();
    expect(rendered.result.current.live).toMatchObject({ stopped: true, notice: null });
  });

  it("should do nothing when no turn is streaming", async () => {
    answerWith(replyEvents("Hello"));
    const rendered = await renderTurn();
    await sendAndSettle(rendered);

    act(() => {
      rendered.result.current.stop();
    });

    expect(rendered.result.current.live).toMatchObject({ stopped: false, outcome: "complete" });
  });

  it("should abort the request when the hook unmounts mid-turn", async () => {
    answerTurns(() => openTurnResponse(eventText({ type: "text", delta: "Yesterday" })));
    const { result, unmount, injectedFetch } = await renderTurn();
    act(() => {
      void result.current.send("What did I eat?", sheetDay);
    });
    await waitFor(() => {
      expect(result.current.live?.text).toBe("Yesterday");
    });

    unmount();

    expect(injectedFetch.mock.calls[0]?.[1].signal.aborted).toBe(true);
  });
});

describe("useAssistantTurn, a turn that breaks", () => {
  const failedTurnNotice = { code: "turn_failed" };

  it("should give the failed turn notice, and not throw, for a line that is not JSON", async () => {
    answerTurns(() =>
      openTurnResponse(
        `${eventText({ type: "text", delta: "Yesterday you" })}data: this is not json\n\n${eventText({ type: "text", delta: " never shown" })}`,
      ),
    );
    const rendered = await renderTurn();

    await sendAndSettle(rendered);

    expect(rendered.result.current.live).toMatchObject({
      text: "Yesterday you",
      notice: failedTurnNotice,
      outcome: "failed",
      stopped: false,
    });
  });

  it("should read a status the app does not know as the default step, and carry on to the words", async () => {
    answerTurns(() =>
      openTurnResponse(
        `${eventText({ type: "turn", turnId: TURN_ID, conversationId: CONVERSATION_ID })}data: ${JSON.stringify({ type: "status", code: "dreaming", detail: "a new field" })}\n\n${eventText({ type: "text", delta: "You had " })}${eventText({ type: "text", delta: "toast." })}${eventText({ type: "done", outcome: "complete" })}`,
      ),
    );
    const rendered = await renderTurn();

    await sendAndSettle(rendered);

    expect(rendered.result.current.live).toMatchObject({
      text: "You had toast.",
      notice: null,
      outcome: "complete",
    });
  });

  it.each([
    ["an event with a field of the wrong kind", { type: "done", outcome: "stopped" }],
    ["an event with a key the app does not know", { type: "text", delta: "x", extra: true }],
  ])("should give the failed turn notice for %s", async (_name, event) => {
    answerTurns(() => openTurnResponse(`data: ${JSON.stringify(event)}\n\n`));
    const rendered = await renderTurn();

    await sendAndSettle(rendered);

    expect(rendered.result.current.live?.notice).toEqual(failedTurnNotice);
  });

  it("should give the failed turn notice when the connection fails", async () => {
    answerTurns(() => HttpResponse.error());
    const rendered = await renderTurn();

    await sendAndSettle(rendered);

    expect(rendered.result.current.live).toMatchObject({
      notice: failedTurnNotice,
      outcome: "failed",
    });
  });

  it("should give the failed turn notice when the stream ends with no done event", async () => {
    answerWith([
      { type: "turn", turnId: TURN_ID, conversationId: CONVERSATION_ID },
      { type: "text", delta: "Yesterday you" },
    ]);
    const rendered = await renderTurn();

    await sendAndSettle(rendered);

    expect(rendered.result.current.live).toMatchObject({
      text: "Yesterday you",
      notice: failedTurnNotice,
      outcome: "failed",
    });
  });

  it.each([
    ["400 for a body the function refuses", 400, "invalid_request"],
    ["401 for a missing sign-in", 401, "unauthorised"],
    ["500 for a function that fell over", 500, "internal_error"],
  ])("should give the failed turn notice at once for a %s", async (_name, status, code) => {
    answerTurns(() => HttpResponse.json({ error: { code, message: "A message." } }, { status }));
    const rendered = await renderTurn();

    await sendAndSettle(rendered);

    expect(rendered.result.current.live).toMatchObject({
      text: "",
      notice: failedTurnNotice,
      outcome: "failed",
    });
  });

  it("should not wait for a refused request's body to end before giving the failed turn notice", async () => {
    answerTurns(() => {
      const refusal = openTurnResponse("");
      return new HttpResponse(refusal.body, {
        status: 400,
        headers: { "Content-Type": "text/event-stream" },
      });
    });
    const rendered = await renderTurn();

    await sendAndSettle(rendered);

    expect(rendered.result.current.live?.notice).toEqual({ code: "turn_failed" });
  });

  it("should give the failed turn notice for an answer that is not an event stream", async () => {
    answerTurns(() => HttpResponse.json({ hello: "world" }));
    const rendered = await renderTurn();

    await sendAndSettle(rendered);

    expect(rendered.result.current.live?.notice).toEqual(failedTurnNotice);
  });

  it("should give the failed turn notice without sending when nobody is signed in", async () => {
    answerWith(replyEvents("Hello"));
    const rendered = await renderTurn({ signedIn: false });

    await sendAndSettle(rendered);

    expect(rendered.injectedFetch).not.toHaveBeenCalled();
    expect(rendered.result.current.live?.notice).toEqual(failedTurnNotice);
  });

  it("should give the failed turn notice, and stay ready for the next send, when the session cannot be read", async () => {
    answerWith(replyEvents("Hello"));
    const rendered = await renderTurn();
    vi.spyOn(rendered.client.auth, "getSession").mockRejectedValueOnce(new Error("storage failed"));

    await sendAndSettle(rendered, "First");
    expect(rendered.result.current.live?.notice).toEqual({ code: "turn_failed" });
    await sendAndSettle(rendered, "Second");

    expect(rendered.result.current.live?.text).toBe("Hello");
  });

  it("should keep a notice that arrived when the stream then drops", async () => {
    answerWith([
      { type: "notice", notice: { code: "day_limit", resetsAt: "2026-11-04T00:00:00Z" } },
    ]);
    const rendered = await renderTurn();

    await sendAndSettle(rendered);

    expect(rendered.result.current.live).toMatchObject({
      notice: { code: "day_limit", resetsAt: "2026-11-04T00:00:00Z" },
      outcome: "failed",
    });
  });

  describe("a stream from a server that is ahead of this app", () => {
    const line = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`;
    const aheadOfTheApp =
      line({ type: "turn", turnId: TURN_ID, conversationId: CONVERSATION_ID }) +
      line({ type: "text", delta: "Here is " }) +
      line({ type: "meal_plan_draft", days: [{ name: "Chicken and rice" }] }) +
      line({ type: "card", card: { ...aCard("Planned your week"), kind: "future_card" } }) +
      line({ type: "card", card: aCard("Logged 2 eggs") }) +
      line({ type: "text", delta: "your week." }) +
      line({ type: "done", outcome: "complete" });

    it("should skip an unknown event and an unknown card kind and finish the turn", async () => {
      answerTurns(() => openTurnResponse(aheadOfTheApp));
      const rendered = await renderTurn();

      await sendAndSettle(rendered);

      expect(rendered.result.current.live).toMatchObject({
        text: "Here is your week.",
        outcome: "complete",
        notice: null,
      });
      expect(rendered.result.current.live?.cards.map((card) => card.title)).toEqual([
        "Logged 2 eggs",
      ]);
    });

    it("should draw a known card whose link screen is unknown, with no link, and finish the turn", async () => {
      const planLink = {
        label: "Open the plan",
        target: { screen: "shopping_list", planId: CONVERSATION_ID },
      };
      answerTurns(() =>
        openTurnResponse(
          line({ type: "turn", turnId: TURN_ID, conversationId: CONVERSATION_ID }) +
            line({ type: "card", card: { ...aCard("Planned your meals"), link: planLink } }) +
            line({ type: "done", outcome: "complete" }),
        ),
      );
      const onKindSkipped = vi.fn();
      const rendered = await renderTurn({ onKindSkipped });

      await sendAndSettle(rendered);

      expect(rendered.result.current.live).toMatchObject({ outcome: "complete", notice: null });
      expect(rendered.result.current.live?.cards).toEqual([
        { ...aCard("Planned your meals"), link: null },
      ]);
      expect(onKindSkipped.mock.calls).toEqual([[{ subject: "link", kind: "shopping_list" }]]);
    });

    it("should tell the caller each skipped kind by name and nothing else", async () => {
      answerTurns(() => openTurnResponse(aheadOfTheApp));
      const onKindSkipped = vi.fn();
      const rendered = await renderTurn({ onKindSkipped });

      await sendAndSettle(rendered);

      expect(onKindSkipped.mock.calls).toEqual([
        [{ subject: "event", kind: "meal_plan_draft" }],
        [{ subject: "card", kind: "future_card" }],
      ]);
    });

    it("should finish the turn when no one is told of a skipped kind", async () => {
      answerTurns(() => openTurnResponse(aheadOfTheApp));
      const rendered = await renderTurn();

      await sendAndSettle(rendered);

      expect(rendered.result.current.live?.outcome).toBe("complete");
    });

    it("should still fail the turn for an event of a known type that is malformed", async () => {
      answerTurns(() =>
        openTurnResponse(
          line({ type: "turn", turnId: TURN_ID, conversationId: CONVERSATION_ID }) +
            line({ type: "text", delta: 7 }) +
            line({ type: "done", outcome: "complete" }),
        ),
      );
      const onKindSkipped = vi.fn();
      const rendered = await renderTurn({ onKindSkipped });

      await sendAndSettle(rendered);

      expect(rendered.result.current.live).toMatchObject({ outcome: "failed" });
      expect(onKindSkipped).not.toHaveBeenCalled();
    });
  });

  it("should stop streaming at the done event even when the connection is held open", async () => {
    answerTurns(() =>
      openTurnResponse(
        eventText({ type: "turn", turnId: TURN_ID, conversationId: CONVERSATION_ID }) +
          eventText({ type: "text", delta: "Hello" }) +
          eventText({ type: "done", outcome: "complete" }),
      ),
    );
    const rendered = await renderTurn();

    await sendAndSettle(rendered);

    expect(rendered.result.current.live).toMatchObject({ text: "Hello", outcome: "complete" });
  });

  it.each([
    ["a refused request", { ok: false, contentType: "application/json" }],
    ["an answer that is not an event stream", { ok: true, contentType: "text/html" }],
  ])("should release the body of %s", async (_name, { ok, contentType }) => {
    let released = false;
    const refusal = {
      ok,
      headers: new Headers({ "Content-Type": contentType }),
      body: new ReadableStream<Uint8Array>({
        cancel() {
          released = true;
        },
      }),
    };
    const rendered = await renderTurn({ fetchOverride: () => Promise.resolve(refusal) });

    await sendAndSettle(rendered);

    expect(rendered.result.current.live?.notice).toEqual({ code: "turn_failed" });
    expect(released).toBe(true);
  });

  it("should be ready for the next send even when something after the stream throws", async () => {
    answerWith(replyEvents("Hello"));
    const rendered = await renderTurn();
    vi.spyOn(rendered.queryClient, "invalidateQueries").mockImplementationOnce(() => {
      throw new Error("invalidation failed");
    });

    await act(async () => {
      await rendered.result.current.send("First", sheetDay).catch(() => undefined);
    });
    await waitFor(() => {
      expect(rendered.result.current.isStreaming).toBe(false);
    });
    await sendAndSettle(rendered, "Second");

    expect(turnRequests).toHaveLength(2);
  });

  it("should take a new turn after a failed one", async () => {
    answerTurns(() => HttpResponse.error());
    const rendered = await renderTurn();
    await sendAndSettle(rendered, "First");
    answerWith(replyEvents("Better"));

    await sendAndSettle(rendered, "Try again");

    expect(rendered.result.current.live).toMatchObject({ text: "Better", notice: null });
  });
});

describe("useAssistantTurn, what the end of a turn refreshes", () => {
  it("should read everything again when a stream ends, even a reply with no card, because the server may have written", async () => {
    answerWith(replyEvents("Hello"));
    const rendered = await renderTurn();
    const isInvalidated = watchInvalidations(
      rendered.queryClient,
      keys.assistant.conversation,
      keys.assistant.changes,
      keys.assistant.status,
      keys.diary.all,
      keys.training.activeRoutine,
    );

    await sendAndSettle(rendered);

    expect(isInvalidated(keys.assistant.conversation)).toBe(true);
    expect(isInvalidated(keys.assistant.changes)).toBe(true);
    expect(isInvalidated(keys.assistant.status)).toBe(true);
    expect(isInvalidated(keys.diary.all)).toBe(true);
    expect(isInvalidated(keys.training.activeRoutine)).toBe(true);
  });

  it("should read everything again when the person stops before the card arrives", async () => {
    answerTurns(() =>
      openTurnResponse(
        eventText({ type: "turn", turnId: TURN_ID, conversationId: CONVERSATION_ID }) +
          eventText({ type: "text", delta: "Logging" }),
      ),
    );
    const { result, queryClient } = await renderTurn();
    const isInvalidated = watchInvalidations(
      queryClient,
      keys.assistant.conversation,
      keys.assistant.changes,
      keys.diary.all,
    );
    act(() => {
      void result.current.send("Log 2 eggs", sheetDay);
    });
    await waitFor(() => {
      expect(result.current.live?.text).toBe("Logging");
    });

    act(() => {
      result.current.stop();
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });
    expect(isInvalidated(keys.assistant.conversation)).toBe(true);
    expect(isInvalidated(keys.assistant.changes)).toBe(true);
    expect(isInvalidated(keys.diary.all)).toBe(true);
  });

  it("should read everything again when the stream drops before the turn event", async () => {
    answerWith([]);
    const rendered = await renderTurn();
    const isInvalidated = watchInvalidations(
      rendered.queryClient,
      keys.assistant.conversation,
      keys.assistant.changes,
      keys.diary.all,
    );

    await sendAndSettle(rendered);

    expect(rendered.result.current.live?.notice).toEqual({ code: "turn_failed" });
    expect(isInvalidated(keys.assistant.conversation)).toBe(true);
    expect(isInvalidated(keys.assistant.changes)).toBe(true);
    expect(isInvalidated(keys.diary.all)).toBe(true);
  });

  it("should also read the changes, diary, recipes, foods and targets again when a card arrived", async () => {
    answerWith([
      { type: "turn", turnId: TURN_ID, conversationId: CONVERSATION_ID },
      { type: "card", card: aCard("Logged 2 eggs") },
      { type: "done", outcome: "complete" },
    ]);
    const rendered = await renderTurn();
    const isInvalidated = watchInvalidations(
      rendered.queryClient,
      keys.assistant.conversation,
      keys.assistant.changes,
      keys.diary.day("2026-11-03"),
      keys.recipes.list(false),
      keys.foods.detail("food-1"),
      keys.profiles.targets,
    );

    await sendAndSettle(rendered);

    expect(isInvalidated(keys.assistant.conversation)).toBe(true);
    expect(isInvalidated(keys.assistant.changes)).toBe(true);
    expect(isInvalidated(keys.diary.day("2026-11-03"))).toBe(true);
    expect(isInvalidated(keys.recipes.list(false))).toBe(true);
    expect(isInvalidated(keys.foods.detail("food-1"))).toBe(true);
    expect(isInvalidated(keys.profiles.targets)).toBe(true);
  });

  it("should read the changes again when the stream broke after a card, because the write happened", async () => {
    answerWith([
      { type: "turn", turnId: TURN_ID, conversationId: CONVERSATION_ID },
      { type: "card", card: aCard("Logged 2 eggs") },
    ]);
    const rendered = await renderTurn();
    const isInvalidated = watchInvalidations(
      rendered.queryClient,
      keys.assistant.changes,
      keys.diary.all,
    );

    await sendAndSettle(rendered);

    expect(isInvalidated(keys.assistant.changes)).toBe(true);
    expect(isInvalidated(keys.diary.all)).toBe(true);
  });

  it.each([
    [
      "a request the function refused outright",
      () => HttpResponse.json({ error: { code: "invalid_request" } }, { status: 400 }),
    ],
    ["an answer that is not an event stream", () => HttpResponse.json({ hello: "world" })],
  ])("should read nothing again for %s", async (_name, respond) => {
    answerTurns(respond);
    const rendered = await renderTurn();
    const isInvalidated = watchInvalidations(
      rendered.queryClient,
      keys.assistant.conversation,
      keys.assistant.changes,
      keys.assistant.status,
      keys.diary.all,
    );

    await sendAndSettle(rendered);

    expect(isInvalidated(keys.assistant.conversation)).toBe(false);
    expect(isInvalidated(keys.assistant.changes)).toBe(false);
    expect(isInvalidated(keys.assistant.status)).toBe(false);
    expect(isInvalidated(keys.diary.all)).toBe(false);
  });
});
