import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { StrictMode } from "react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { useAssistantChat } from "../../src/hooks/useAssistantChat";
import { keys } from "../../src/queryKeys";
import { createTestClient } from "../createTestClient";
import {
  CONVERSATION_ID as STORED_CONVERSATION_ID,
  createAssistantFakeState,
  installAssistantFake,
} from "../support/assistantFake";
import {
  CONVERSATION_ID as STREAMED_CONVERSATION_ID,
  FUNCTIONS_URL,
  TURN_ID,
  aCard,
  openTurnResponse,
  replyEvents,
  turnResponse,
} from "../support/assistantStream";
import {
  AUTH_USER_URL,
  REST_URL,
  SIGNED_IN_USER_ID,
  postgrestError,
  postgrestRows,
  signInAs,
} from "../support/postgrest";
import { createWrapper } from "../support/wrapper";

import type { AssistantFakeState } from "../support/assistantFake";
import type { AssistantNotice, AssistantStreamEvent } from "@keylow/core";
import type { ReactNode } from "react";

const server = setupServer();
const TURN_URL = `${FUNCTIONS_URL}/assistant/turn`;
const STATUS_URL = `${FUNCTIONS_URL}/assistant/status`;
const DAY_LIMIT: AssistantNotice = { code: "day_limit", resetsAt: "2026-11-04T00:00:00Z" };
const NEW_TURN_ID = "00000000-0000-4000-8000-0000000000a9";

let state: AssistantFakeState;
let statusNotice: AssistantNotice | null;
let turnBodies: unknown[];
let consentWrites: number;
let isConsentWriteRefused: boolean;

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  state = createAssistantFakeState();
  statusNotice = null;
  turnBodies = [];
  consentWrites = 0;
  isConsentWriteRefused = false;
  installAssistantFake(server, state);
  server.use(
    http.get(AUTH_USER_URL, () =>
      HttpResponse.json({ id: SIGNED_IN_USER_ID, aud: "authenticated", role: "authenticated" }),
    ),
    http.get(STATUS_URL, () => HttpResponse.json({ notice: statusNotice })),
    http.patch(`${REST_URL}/profiles`, ({ request }) => {
      consentWrites += 1;
      return isConsentWriteRefused
        ? postgrestError(403, "42501", "permission denied")
        : postgrestRows(request, [{ id: SIGNED_IN_USER_ID }]);
    }),
  );
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

function answerTurnsWith(respond: () => Response) {
  server.use(
    http.post(TURN_URL, async ({ request }) => {
      turnBodies.push(await request.json());
      return respond();
    }),
  );
}

const answerWith = (events: AssistantStreamEvent[]) => {
  answerTurnsWith(() => turnResponse(events));
};

/** The turn the function stores for a message: the question, and the reply when it has one. */
function storeTurn(question: string, reply: string | null) {
  const seq = state.messages.length;
  state.turns = [
    ...state.turns,
    {
      id: NEW_TURN_ID,
      status: reply === null ? "open" : "complete",
      created_at: "2026-10-27T10:00:00Z",
    },
  ];
  state.messages = [
    ...state.messages,
    {
      id: "n1",
      turn_id: NEW_TURN_ID,
      role: "user",
      content: [{ type: "text", text: question }],
      display: null,
      conversation_id: STORED_CONVERSATION_ID,
      seq: seq + 1,
    },
    ...(reply === null
      ? []
      : [
          {
            id: "n2",
            turn_id: NEW_TURN_ID,
            role: "assistant",
            content: [{ type: "text", text: reply }],
            display: null,
            conversation_id: STORED_CONVERSATION_ID,
            seq: seq + 2,
          },
        ]),
  ];
}

type ChatProps = { open: boolean };

async function renderChat({
  expectedAccess = "open",
  isStrict = false,
}: { expectedAccess?: string; isStrict?: boolean } = {}) {
  const client = createTestClient();
  await signInAs(client, SIGNED_IN_USER_ID);
  const { queryClient, wrapper: providers } = createWrapper(client, {
    functionsUrl: FUNCTIONS_URL,
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    isStrict ? <StrictMode>{providers({ children })}</StrictMode> : providers({ children });
  const onAnswerFinished = vi.fn<(words: string) => void>();
  const onTurnOnFailed = vi.fn<() => void>();
  const rendered = renderHook(
    ({ open }: ChatProps) =>
      useAssistantChat({
        open,
        localDate: "2026-10-27",
        fetch,
        isOnline: true,
        deviceTimeZone: "Europe/London",
        onAnswerFinished,
        onTurnOnFailed,
      }),
    { wrapper, initialProps: { open: true } },
  );
  // The conversation and the status are read, so the chat is ready to send.
  await waitFor(() => {
    expect(rendered.result.current.isThreadKnown && rendered.result.current.access.kind).toBe(
      expectedAccess,
    );
  });
  return { ...rendered, queryClient, onAnswerFinished, onTurnOnFailed };
}

const texts = (entries: { kind: string; text?: string; paragraphs?: string[] }[]) =>
  entries.map((entry) => entry.text ?? entry.paragraphs?.join(" ") ?? entry.kind);

describe("useAssistantChat", () => {
  describe("a turn streamed to the end", () => {
    it("should send into the stored conversation and draw the reply", async () => {
      answerWith(replyEvents("Hello ", "there"));
      const chat = await renderChat();

      act(() => {
        chat.result.current.sendMessage("  Hi  ");
      });

      await waitFor(() => {
        expect(texts(chat.result.current.thread.entries)).toContain("Hello there");
      });
      expect(turnBodies).toEqual([
        {
          conversationId: STORED_CONVERSATION_ID,
          text: "Hi",
          localDate: "2026-10-27",
          localTime: null,
        },
      ]);
    });

    it("should announce the finished answer once", async () => {
      answerWith(replyEvents("Hello ", "there"));
      const chat = await renderChat();

      act(() => {
        chat.result.current.sendMessage("Hi");
      });

      await waitFor(() => {
        expect(chat.onAnswerFinished).toHaveBeenCalledTimes(1);
      });
      expect(chat.onAnswerFinished).toHaveBeenCalledWith("Hello there");
    });

    it("should clear the draft when it is sent", async () => {
      answerWith(replyEvents("Ok"));
      const chat = await renderChat();
      act(() => {
        chat.result.current.setDraft("  Hi there ");
      });
      expect(chat.result.current.canSendDraft).toBe(true);

      act(() => {
        chat.result.current.sendDraft();
      });

      await waitFor(() => {
        expect(chat.result.current.draft).toBe("");
      });
      expect(turnBodies).toMatchObject([{ text: "Hi there" }]);
    });
  });

  describe("under React strict mode", () => {
    it("should send one request, announce once and read the status once on open", async () => {
      let statusReads = 0;
      server.use(
        http.get(STATUS_URL, () => {
          statusReads += 1;
          return HttpResponse.json({ notice: null });
        }),
      );
      answerWith(replyEvents("Hello"));
      const chat = await renderChat({ isStrict: true });

      act(() => {
        chat.result.current.sendMessage("Hi");
      });

      await waitFor(() => {
        expect(chat.onAnswerFinished).toHaveBeenCalledTimes(1);
      });
      expect(turnBodies).toHaveLength(1);
      // One read for the open, and one when the turn ended, never one per effect run.
      expect(statusReads).toBeLessThanOrEqual(2);
    });
  });

  describe("a turn that fails", () => {
    it("should show the failure and send the same words again from Try again", async () => {
      answerTurnsWith(() => new HttpResponse(null, { status: 500 }));
      const chat = await renderChat();
      act(() => {
        chat.result.current.sendMessage("Hi");
      });
      await waitFor(() => {
        expect(chat.result.current.thread.entries.at(-1)).toMatchObject({ kind: "notice" });
      });
      answerWith(replyEvents("Back"));

      act(() => {
        chat.result.current.sendLastMessageAgain();
      });

      await waitFor(() => {
        expect(texts(chat.result.current.thread.entries)).toContain("Back");
      });
      expect(turnBodies).toMatchObject([{ text: "Hi" }, { text: "Hi" }]);
    });

    it("should not announce a failed turn", async () => {
      answerTurnsWith(() => new HttpResponse(null, { status: 500 }));
      const chat = await renderChat();

      act(() => {
        chat.result.current.sendMessage("Hi");
      });

      await waitFor(() => {
        expect({
          isStreaming: chat.result.current.isStreaming,
          last: chat.result.current.thread.entries.at(-1),
        }).toMatchObject({ isStreaming: false, last: { kind: "notice" } });
      });
      expect(chat.onAnswerFinished).not.toHaveBeenCalled();
    });
  });

  describe("a turn that is cancelled", () => {
    it("should keep the words that arrived as stopped and not announce them", async () => {
      const turnText = `data: ${JSON.stringify({ type: "turn", turnId: TURN_ID, conversationId: STREAMED_CONVERSATION_ID })}\n\ndata: ${JSON.stringify({ type: "text", delta: "Half an" })}\n\n`;
      answerTurnsWith(() => openTurnResponse(turnText));
      const chat = await renderChat();
      act(() => {
        chat.result.current.sendMessage("Hi");
      });
      await waitFor(() => {
        expect(texts(chat.result.current.thread.entries)).toContain("Half an");
      });

      act(() => {
        chat.result.current.stop();
      });

      await waitFor(() => {
        expect(chat.result.current.isStreaming).toBe(false);
      });
      expect(chat.result.current.thread.entries.at(-1)).toMatchObject({
        kind: "assistant",
        isStopped: true,
      });
      expect(chat.onAnswerFinished).not.toHaveBeenCalled();
    });
  });

  describe("a turn that ends early after a write", () => {
    it("should keep the card and say the change was saved, once", async () => {
      answerWith([
        { type: "turn", turnId: TURN_ID, conversationId: STREAMED_CONVERSATION_ID },
        { type: "card", card: aCard("Logged 2 eggs") },
      ]);
      const chat = await renderChat();

      act(() => {
        chat.result.current.sendMessage("2 eggs");
      });

      // The turn has ended, with its card drawn, in the one check.
      await waitFor(() => {
        const kinds = chat.result.current.thread.entries.map((entry) => entry.kind);
        expect([
          chat.result.current.isStreaming,
          kinds.includes("card"),
          kinds.includes("assistant"),
        ]).toEqual([false, true, true]);
      });
      expect(chat.onAnswerFinished).toHaveBeenCalledTimes(1);
      expect(chat.onAnswerFinished).toHaveBeenCalledWith(
        expect.stringContaining("Your change was saved"),
      );
    });
  });

  describe("the message sent from the chat", () => {
    it("should be let go once the stored conversation holds the reply", async () => {
      answerWith(replyEvents("Live reply"));
      const chat = await renderChat();
      act(() => {
        chat.result.current.sendMessage("Question");
      });
      await waitFor(() => {
        expect(texts(chat.result.current.thread.entries)).toContain("Live reply");
      });

      storeTurn("Question", "Stored reply");
      await act(() =>
        chat.queryClient.invalidateQueries({ queryKey: keys.assistant.conversation }),
      );

      await waitFor(() => {
        expect(texts(chat.result.current.thread.entries)).toContain("Stored reply");
      });
      expect(texts(chat.result.current.thread.entries)).not.toContain("Live reply");
    });

    it("should not come back when the thread goes empty again after it was let go", async () => {
      state.messages = [];
      state.turns = [];
      answerWith(replyEvents("Live reply"));
      const chat = await renderChat();
      act(() => {
        chat.result.current.sendMessage("Question");
      });
      await waitFor(() => {
        expect(texts(chat.result.current.thread.entries)).toContain("Live reply");
      });
      storeTurn("Question", "Stored reply");
      await act(() =>
        chat.queryClient.invalidateQueries({ queryKey: keys.assistant.conversation }),
      );
      await waitFor(() => {
        expect(texts(chat.result.current.thread.entries)).toContain("Stored reply");
      });
      state.conversationIds = [];
      state.messages = [];
      state.turns = [];

      await act(() =>
        chat.queryClient.invalidateQueries({ queryKey: keys.assistant.conversation }),
      );

      await waitFor(() => {
        expect(chat.result.current.isEmpty).toBe(true);
      });
    });

    it("should be kept while only your message is stored", async () => {
      answerWith(replyEvents("Live reply"));
      const chat = await renderChat();
      storeTurn("Question", null);
      act(() => {
        chat.result.current.sendMessage("Question");
      });
      await waitFor(() => {
        expect(texts(chat.result.current.thread.entries)).toContain("Live reply");
      });

      await act(() =>
        chat.queryClient.invalidateQueries({ queryKey: keys.assistant.conversation }),
      );

      expect(texts(chat.result.current.thread.entries)).toContain("Live reply");
    });

    it("should be let go with a day limit's notice once the status is read again on reopen", async () => {
      answerWith([
        { type: "notice", notice: DAY_LIMIT },
        { type: "done", outcome: "failed" },
      ]);
      const chat = await renderChat();
      act(() => {
        chat.result.current.sendMessage("Question");
      });
      await waitFor(() => {
        expect(chat.result.current.access.kind).toBe("limited");
      });

      chat.rerender({ open: false });
      chat.rerender({ open: true });

      await waitFor(() => {
        expect(chat.result.current.access.kind).toBe("open");
      });
    });

    it("should be let go with the consent notice once consent is turned on", async () => {
      answerWith([
        { type: "notice", notice: { code: "consent_needed" } },
        { type: "done", outcome: "failed" },
      ]);
      const chat = await renderChat();
      act(() => {
        chat.result.current.sendMessage("Question");
      });
      await waitFor(() => {
        expect(chat.result.current.access.kind).toBe("consent");
      });

      act(() => {
        chat.result.current.turnOnAssistant();
      });

      await waitFor(() => {
        expect(chat.result.current.access.kind).toBe("open");
      });
      expect(consentWrites).toBe(1);
    });

    it("should be let go with a new conversation, which empties the thread", async () => {
      answerWith(replyEvents("Live reply"));
      const chat = await renderChat();
      act(() => {
        chat.result.current.sendMessage("Question");
      });
      await waitFor(() => {
        expect(chat.result.current.isStreaming).toBe(false);
      });

      await act(() => chat.result.current.startNewConversation());

      await waitFor(() => {
        expect(chat.result.current.isEmpty).toBe(true);
      });
      expect(state.conversationRequests).toBe(1);
    });
  });

  describe("the conversation a message goes into", () => {
    it("should not reuse the dead id of the live turn after Delete all conversations", async () => {
      answerWith(replyEvents("First"));
      const chat = await renderChat();
      act(() => {
        chat.result.current.sendMessage("One");
      });
      await waitFor(() => {
        expect(chat.result.current.isStreaming).toBe(false);
      });
      state.conversationIds = [];
      state.messages = [];
      state.turns = [];
      await act(() =>
        chat.queryClient.invalidateQueries({ queryKey: keys.assistant.conversation }),
      );
      await waitFor(() => {
        expect(chat.result.current.isEmpty).toBe(true);
      });
      answerWith(replyEvents("Second"));

      act(() => {
        chat.result.current.sendMessage("Two");
      });

      await waitFor(() => {
        expect(turnBodies).toHaveLength(2);
      });
      expect(turnBodies[1]).toMatchObject({ conversationId: null });
    });
  });

  describe("New conversation", () => {
    it("should be on for a conversation that is stored", async () => {
      const chat = await renderChat();

      expect(chat.result.current.isNewDisabled).toBe(false);
    });

    it("should be off while a turn streams", async () => {
      answerTurnsWith(() => openTurnResponse(""));
      const chat = await renderChat();

      act(() => {
        chat.result.current.sendMessage("Hi");
      });

      await waitFor(() => {
        expect(chat.result.current.isStreaming).toBe(true);
      });
      expect(chat.result.current.isNewDisabled).toBe(true);
    });

    it("should be off when there is nothing to clear", async () => {
      state.conversationIds = [];
      state.messages = [];
      state.turns = [];
      const chat = await renderChat();

      expect(chat.result.current.isEmpty).toBe(true);
      expect(chat.result.current.isNewDisabled).toBe(true);
    });

    it("should be off under the consent card", async () => {
      statusNotice = { code: "consent_needed" };
      const chat = await renderChat({ expectedAccess: "consent" });

      expect(chat.result.current.isNewDisabled).toBe(true);
    });
  });

  describe("consent and limits", () => {
    it("should say consent is needed, then open once it is turned on", async () => {
      statusNotice = { code: "consent_needed" };
      const chat = await renderChat({ expectedAccess: "consent" });
      statusNotice = null;

      act(() => {
        chat.result.current.turnOnAssistant();
      });

      await waitFor(() => {
        expect(chat.result.current.access.kind).toBe("open");
      });
      expect(chat.result.current.isTurningOn).toBe(false);
      expect(chat.onTurnOnFailed).not.toHaveBeenCalled();
    });

    it("should call onTurnOnFailed and keep the card when the write is refused", async () => {
      statusNotice = { code: "consent_needed" };
      isConsentWriteRefused = true;
      const chat = await renderChat({ expectedAccess: "consent" });

      act(() => {
        chat.result.current.turnOnAssistant();
      });

      await waitFor(() => {
        expect(chat.onTurnOnFailed).toHaveBeenCalledTimes(1);
      });
      expect(chat.result.current.access.kind).toBe("consent");
    });

    it("should lock the field under a day limit", async () => {
      statusNotice = DAY_LIMIT;
      const chat = await renderChat({ expectedAccess: "limited" });

      expect(chat.result.current.composer).toMatchObject({ isShown: true, isFieldDisabled: true });
      expect(chat.result.current.canSendDraft).toBe(false);
    });
  });
});
