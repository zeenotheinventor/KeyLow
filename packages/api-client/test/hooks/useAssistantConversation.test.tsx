import { act, renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useAssistantConversation } from "../../src/hooks/useAssistantConversation";
import { keys } from "../../src/queryKeys";
import {
  CONVERSATION_ID,
  FIRST_ACTION_ID,
  SECOND_TURN_ID,
  actionRow,
  loggedCard,
  createAssistantFakeState,
  installAssistantFake,
  longConversation,
} from "../support/assistantFake";
import { REST_URL, postgrestError } from "../support/postgrest";
import { createWrapper } from "../support/wrapper";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

describe("useAssistantConversation", () => {
  it("should give the newest conversation by updated_at with its thread", async () => {
    const state = createAssistantFakeState();
    installAssistantFake(server, state);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useAssistantConversation(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.conversationId).toBe(CONVERSATION_ID);
    expect(result.current.data?.items.map((item) => item.kind)).toEqual([
      "user",
      "card",
      "user",
      "reply",
    ]);
    expect(state.conversationRead?.get("order")).toBe("updated_at.desc");
    expect(state.conversationRead?.get("limit")).toBe("1");
  });

  it("should give the card the live undo state of its actions", async () => {
    const state = createAssistantFakeState();
    installAssistantFake(server, state);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useAssistantConversation(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.items[1]).toMatchObject({
      kind: "card",
      card: { undo: "available" },
    });
  });

  it("should draw the card of a message whose display also holds an undo", async () => {
    const state = createAssistantFakeState();
    state.messages = state.messages.map((row) =>
      row.id === "m3"
        ? {
            ...row,
            display: {
              "call-1": {
                card: loggedCard,
                undo: {
                  actionId: FIRST_ACTION_ID,
                  previous: { routineName: "Sentinel routine 4471" },
                  fingerprint: "fingerprint-8832",
                },
              },
            },
          }
        : row,
    );
    installAssistantFake(server, state);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useAssistantConversation(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.items[1]).toMatchObject({
      kind: "card",
      card: { kind: "logged", undo: "available" },
    });
    expect(JSON.stringify(result.current.data?.items)).not.toContain("Sentinel routine 4471");
  });

  it("should keep the object of an exercise's muscles when the conversation is read again", async () => {
    const state = createAssistantFakeState();
    state.messages = state.messages.map((row) =>
      row.id === "m3"
        ? {
            ...row,
            display: {
              "call-1": {
                exerciseMuscles: {
                  exerciseName: "Seated Leg Curl",
                  muscles: [{ muscle_id: "hamstrings", role: "primary" }],
                },
              },
            },
          }
        : row,
    );
    installAssistantFake(server, state);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAssistantConversation(), { wrapper });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const exercise = result.current.data?.items.find((item) => item.kind === "exercise_muscles");
    expect(exercise).toBeDefined();

    const read = await result.current.refetch();

    // The cards are memoised on this object, so a read that changed nothing must not replace it.
    expect(read.data?.items.find((item) => item.kind === "exercise_muscles")).toBe(exercise);
  });

  it("should keep the object of an exercise's form media when the conversation is read again", async () => {
    const state = createAssistantFakeState();
    state.messages = state.messages.map((row) =>
      row.id === "m3"
        ? {
            ...row,
            display: {
              "call-1": {
                exerciseFormMedia: {
                  exerciseName: "Dumbbell Curl",
                  media: {
                    kind: "photos",
                    imagePaths: ["Dumbbell_Curl/0.jpg", "Dumbbell_Curl/1.jpg"],
                  },
                },
              },
            },
          }
        : row,
    );
    installAssistantFake(server, state);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAssistantConversation(), { wrapper });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const exercise = result.current.data?.items.find((item) => item.kind === "exercise_form_media");
    expect(exercise).toBeDefined();

    const read = await result.current.refetch();

    // The cards are memoised on this object, so a read that changed nothing must not replace it.
    expect(read.data?.items.find((item) => item.kind === "exercise_form_media")).toBe(exercise);
  });

  it("should show the card as undone once every one of its actions is", async () => {
    const state = createAssistantFakeState();
    state.actions = state.actions.map((row) =>
      actionRow({ ...row, undone_at: "2026-10-27T09:00:00Z" }),
    );
    installAssistantFake(server, state);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useAssistantConversation(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.items[1]).toMatchObject({ kind: "card", card: { undo: "undone" } });
  });

  it("should give no conversation and no items when the person has none", async () => {
    installAssistantFake(server, createAssistantFakeState({ conversationIds: [] }));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useAssistantConversation(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual({ conversationId: null, items: [], openTurn: null });
  });

  it("should give the newest turn as the open turn while it is still open, and none once it has ended", async () => {
    const state = createAssistantFakeState();
    state.turns = state.turns.map((turn) =>
      turn.id === SECOND_TURN_ID ? { ...turn, status: "open" } : turn,
    );
    installAssistantFake(server, state);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAssistantConversation(), { wrapper });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    const firstSeen = result.current.data?.openTurn?.firstSeenAtMs;
    expect(result.current.data?.openTurn).toMatchObject({ turnId: SECOND_TURN_ID });
    expect(typeof firstSeen).toBe("number");

    // A later read of the same open turn keeps the time it was first read.
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => {
      expect(state.turnReads.length).toBeGreaterThan(1);
    });
    expect(result.current.data?.openTurn?.firstSeenAtMs).toBe(firstSeen);

    state.turns = state.turns.map((turn) => ({ ...turn, status: "complete" }));
    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.data?.openTurn).toBeNull();
    });
  });

  it("should cache under the assistant conversation key", async () => {
    installAssistantFake(server, createAssistantFakeState());
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useAssistantConversation(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(queryClient.getQueryData(keys.assistant.conversation)).toMatchObject({
      pages: [{ conversationId: CONVERSATION_ID }],
      pageParams: [null],
    });
  });

  it("should not read when disabled", () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useAssistantConversation({ enabled: false }), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
  });
});

describe("useAssistantConversation, older turns", () => {
  const OLDER_READ = "or";

  /** Holds the request for the older page, or for the newest one, until `release` is called. */
  const holdTurnReads = (which: "older" | "newest") => {
    let release: () => void = () => undefined;
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(`${REST_URL}/assistant_turns`, async ({ request }) => {
        if (new URL(request.url).searchParams.has(OLDER_READ) === (which === "older")) {
          await released;
        }
        return undefined;
      }),
    );
    return release;
  };

  const openLongConversation = async (turnCount = 45) => {
    const state = createAssistantFakeState(longConversation(turnCount));
    installAssistantFake(server, state);
    const wrapped = createWrapper();
    const hook = renderHook(
      ({ enabled }: { enabled: boolean }) => useAssistantConversation({ enabled }),
      { wrapper: wrapped.wrapper, initialProps: { enabled: true } },
    );
    await waitFor(() => {
      expect(hook.result.current.isSuccess).toBe(true);
    });
    return { state, ...wrapped, ...hook };
  };

  const texts = (items: { kind: string }[] | undefined) =>
    (items ?? []).flatMap((item) =>
      "text" in item && typeof item.text === "string" ? [item.text] : [],
    );

  it("should hold the newest 20 turns and say an older page exists", async () => {
    const { result } = await openLongConversation();

    expect(result.current.data?.items).toHaveLength(40);
    expect(result.current.hasOlder).toBe(true);
    expect(result.current.isLoadingOlder).toBe(false);
  });

  it("should put the items of an older page before the newest page's", async () => {
    const { result } = await openLongConversation();

    act(() => {
      result.current.loadOlder();
    });

    await waitFor(() => {
      expect(result.current.data?.items).toHaveLength(80);
    });
    expect(texts(result.current.data?.items).at(0)).toBe("user 5");
    expect(texts(result.current.data?.items).at(-1)).toBe("assistant 44");
    expect(result.current.hasOlder).toBe(true);
  });

  it("should say there is nothing older once the last page is loaded", async () => {
    const { result } = await openLongConversation();

    act(() => {
      result.current.loadOlder();
    });
    await waitFor(() => {
      expect(result.current.data?.items).toHaveLength(80);
    });
    act(() => {
      result.current.loadOlder();
    });

    await waitFor(() => {
      expect(result.current.data?.items).toHaveLength(90);
    });
    expect(result.current.hasOlder).toBe(false);
  });

  it("should mark a question answered on the last turn of an older page", async () => {
    const state = createAssistantFakeState(longConversation(45));
    state.messages = state.messages.map((row) =>
      row.id === "00000004-0000-4000-8000-000000000049"
        ? {
            ...row,
            role: "assistant",
            content: [
              {
                type: "tool_use",
                id: "call-9",
                name: "ask_user",
                input: { question: "How much?", quick_replies: [] },
              },
            ],
          }
        : row,
    );
    installAssistantFake(server, state);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAssistantConversation(), { wrapper });
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    act(() => {
      result.current.loadOlder();
    });

    await waitFor(() => {
      expect(result.current.data?.items.some((item) => item.kind === "clarify")).toBe(true);
    });
    expect(result.current.data?.items.find((item) => item.kind === "clarify")).toMatchObject({
      answered: true,
    });
  });

  it("should not count an older page's read as the thread being read again", async () => {
    const { result } = await openLongConversation();
    const release = holdTurnReads("older");

    act(() => {
      result.current.loadOlder();
    });

    await waitFor(() => {
      expect(result.current.isLoadingOlder).toBe(true);
    });
    expect(result.current.isFetching).toBe(false);
    expect(result.current.isSuccess).toBe(true);
    release();
    await waitFor(() => {
      expect(result.current.isLoadingOlder).toBe(false);
    });
  });

  it("should read the thread again as fetching when the whole thread is refetched", async () => {
    const { result } = await openLongConversation();
    const release = holdTurnReads("newest");

    act(() => {
      void result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.isFetching).toBe(true);
    });
    release();
  });

  it("should not start a second older read while one is in flight", async () => {
    const { result, state } = await openLongConversation();
    const release = holdTurnReads("older");

    act(() => {
      result.current.loadOlder();
      result.current.loadOlder();
    });
    await waitFor(() => {
      expect(result.current.isLoadingOlder).toBe(true);
    });
    act(() => {
      result.current.loadOlder();
    });
    release();

    await waitFor(() => {
      expect(result.current.isLoadingOlder).toBe(false);
    });
    expect(state.turnReads.filter((read) => read.has(OLDER_READ))).toHaveLength(1);
  });

  it("should not start an older read while the thread is being read again", async () => {
    const { result, state } = await openLongConversation();
    const release = holdTurnReads("newest");
    state.turnReads.length = 0;

    act(() => {
      void result.current.refetch();
    });
    await waitFor(() => {
      expect(result.current.isFetching).toBe(true);
    });
    act(() => {
      result.current.loadOlder();
    });
    release();

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });
    expect(state.turnReads.some((read) => read.has(OLDER_READ))).toBe(false);
  });

  it("should do nothing when there is nothing older", async () => {
    const { result, state } = await openLongConversation(10);
    state.turnReads.length = 0;

    act(() => {
      result.current.loadOlder();
    });

    expect(result.current.hasOlder).toBe(false);
    expect(state.turnReads).toEqual([]);
  });

  it("should keep the items and not report an error when an older page fails", async () => {
    const { result } = await openLongConversation();
    server.use(
      http.get(`${REST_URL}/assistant_turns`, ({ request }) =>
        new URL(request.url).searchParams.has(OLDER_READ)
          ? postgrestError(500, "XX000", "failing")
          : undefined,
      ),
    );

    act(() => {
      result.current.loadOlder();
    });

    await waitFor(() => {
      expect(result.current.isLoadingOlder).toBe(false);
    });
    expect(result.current.data?.items).toHaveLength(40);
    expect(result.current.isError).toBe(false);
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.hasOlder).toBe(true);
  });

  it("should keep reading as success while the thread is read again after an older page failed", async () => {
    const { result } = await openLongConversation();
    server.use(
      http.get(
        `${REST_URL}/assistant_turns`,
        ({ request }) =>
          new URL(request.url).searchParams.has(OLDER_READ)
            ? postgrestError(500, "XX000", "failing")
            : undefined,
        { once: true },
      ),
    );
    act(() => {
      result.current.loadOlder();
    });
    await waitFor(() => {
      expect(result.current.isLoadingOlder).toBe(false);
    });
    const release = holdTurnReads("newest");

    act(() => {
      void result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.isFetching).toBe(true);
    });
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.isError).toBe(false);
    release();
    await waitFor(() => {
      expect(result.current.isFetching).toBe(false);
    });
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.isError).toBe(false);
  });

  it("should report an error when the thread's own read fails after an older page failed", async () => {
    const { result } = await openLongConversation();
    server.use(
      http.get(`${REST_URL}/assistant_turns`, () => postgrestError(500, "XX000", "failing"), {
        once: true,
      }),
    );
    act(() => {
      result.current.loadOlder();
    });
    await waitFor(() => {
      expect(result.current.isLoadingOlder).toBe(false);
    });
    server.use(
      http.get(`${REST_URL}/assistant_turns`, () => postgrestError(500, "XX000", "failing")),
    );

    act(() => {
      void result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it("should load the older page again on the next ask after a failure", async () => {
    const { result } = await openLongConversation();
    server.use(
      http.get(
        `${REST_URL}/assistant_turns`,
        ({ request }) =>
          new URL(request.url).searchParams.has(OLDER_READ)
            ? postgrestError(500, "XX000", "failing")
            : undefined,
        { once: true },
      ),
    );
    act(() => {
      result.current.loadOlder();
    });
    await waitFor(() => {
      expect(result.current.isLoadingOlder).toBe(false);
    });

    act(() => {
      result.current.loadOlder();
    });

    await waitFor(() => {
      expect(result.current.data?.items).toHaveLength(80);
    });
  });

  it("should read every loaded page again, newest first, when the thread is invalidated", async () => {
    const { result, state, queryClient } = await openLongConversation();
    act(() => {
      result.current.loadOlder();
    });
    await waitFor(() => {
      expect(result.current.data?.items).toHaveLength(80);
    });
    state.turnReads.length = 0;

    await act(() => queryClient.invalidateQueries({ queryKey: keys.assistant.conversation }));

    expect(state.turnReads.map((read) => read.has(OLDER_READ))).toEqual([false, true]);
    expect(result.current.data?.items).toHaveLength(80);
  });

  it("should trim the cache to its first page when the sheet closes", async () => {
    const { result, rerender, queryClient } = await openLongConversation();
    act(() => {
      result.current.loadOlder();
    });
    await waitFor(() => {
      expect(result.current.data?.items).toHaveLength(80);
    });

    rerender({ enabled: false });

    await waitFor(() => {
      expect(result.current.data?.items).toHaveLength(40);
    });
    expect(queryClient.getQueryData(keys.assistant.conversation)).toMatchObject({
      pageParams: [null],
    });
    expect(result.current.hasOlder).toBe(true);
  });
});
