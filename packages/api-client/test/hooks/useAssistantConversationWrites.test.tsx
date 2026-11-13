import { act, renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useAssistantConversation } from "../../src/hooks/useAssistantConversation";
import { useDeleteAllAssistantConversations } from "../../src/hooks/useDeleteAllAssistantConversations";
import { useNewAssistantConversation } from "../../src/hooks/useNewAssistantConversation";
import { keys } from "../../src/queryKeys";
import {
  NEW_CONVERSATION_ID,
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

describe("useNewAssistantConversation", () => {
  it("should call the conversations route and resolve to the new id", async () => {
    const state = createAssistantFakeState();
    installAssistantFake(server, state);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useNewAssistantConversation(), { wrapper });

    const conversationId = await act(() => result.current.mutateAsync());

    expect(conversationId).toBe(NEW_CONVERSATION_ID);
    expect(state.conversationRequests).toBe(1);
  });

  it("should make the new conversation the current one, with an empty thread", async () => {
    installAssistantFake(server, createAssistantFakeState());
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => ({ conversation: useAssistantConversation(), start: useNewAssistantConversation() }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.conversation.data?.items).toHaveLength(4);
    });

    await act(() => result.current.start.mutateAsync());

    await waitFor(() => {
      expect(result.current.conversation.data).toEqual({
        conversationId: NEW_CONVERSATION_ID,
        items: [],
        openTurn: null,
      });
    });
  });
});

describe("useDeleteAllAssistantConversations", () => {
  it.each([
    ["the thread", keys.assistant.conversation],
    ["the changes list", keys.assistant.changes],
    ["the consent", keys.assistant.consent],
  ] as const)("should refresh %s", async (_name, queryKey) => {
    installAssistantFake(server, createAssistantFakeState());
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(queryKey, "cached");
    const { result } = renderHook(() => useDeleteAllAssistantConversations(), { wrapper });

    await act(() => result.current.mutateAsync());

    expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(true);
  });

  it("should leave a closed sheet's thread empty on its first render, before any read", async () => {
    installAssistantFake(server, createAssistantFakeState());
    const { queryClient, wrapper } = createWrapper();
    // The sheet is closed, so its read is disabled and only the thread from its last open is cached.
    queryClient.setQueryData(keys.assistant.conversation, {
      pages: [
        { conversationId: "old", messages: [], actions: [], olderCursor: null, openTurn: null },
      ],
      pageParams: [null],
    });
    renderHook(() => useAssistantConversation({ enabled: false }), { wrapper });
    const { result: deleteAll } = renderHook(() => useDeleteAllAssistantConversations(), {
      wrapper,
    });

    await act(() => deleteAll.current.mutateAsync());
    const { result: opened } = renderHook(() => useAssistantConversation(), { wrapper });

    expect(opened.current.data).toEqual({ conversationId: null, items: [], openTurn: null });
  });

  it("should delete the conversations and leave the sheet with no thread", async () => {
    const state = createAssistantFakeState();
    installAssistantFake(server, state);
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => ({
        conversation: useAssistantConversation(),
        remove: useDeleteAllAssistantConversations(),
      }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.conversation.data?.items).toHaveLength(4);
    });

    await act(() => result.current.remove.mutateAsync());

    expect(state.deletedAllConversations).toBe(1);
    expect(state.deleteQuery).not.toBe("");
    await waitFor(() => {
      expect(result.current.conversation.data).toEqual({
        conversationId: null,
        items: [],
        openTurn: null,
      });
    });
  });
});
