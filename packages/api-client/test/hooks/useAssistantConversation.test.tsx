import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useAssistantConversation } from "../../src/hooks/useAssistantConversation";
import { keys } from "../../src/queryKeys";
import {
  CONVERSATION_ID,
  FIRST_ACTION_ID,
  actionRow,
  loggedCard,
  createAssistantFakeState,
  installAssistantFake,
} from "../support/assistantFake";
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
    expect(result.current.data).toEqual({ conversationId: null, items: [] });
  });

  it("should cache under the assistant conversation key", async () => {
    installAssistantFake(server, createAssistantFakeState());
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useAssistantConversation(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(queryClient.getQueryData(keys.assistant.conversation)).toEqual(result.current.data);
  });

  it("should not read when disabled", () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useAssistantConversation({ enabled: false }), { wrapper });

    expect(result.current.fetchStatus).toBe("idle");
  });
});
