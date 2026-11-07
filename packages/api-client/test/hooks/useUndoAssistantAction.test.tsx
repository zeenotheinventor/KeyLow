import { act, renderHook } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useUndoAssistantAction } from "../../src/hooks/useUndoAssistantAction";
import { keys } from "../../src/queryKeys";
import {
  FIRST_ACTION_ID,
  FUNCTIONS_URL,
  SECOND_ACTION_ID,
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

const refreshedKeys = [
  ["the thread", keys.assistant.conversation],
  ["the changes list", keys.assistant.changes],
  ["a diary day", keys.diary.day("2026-10-27")],
  ["a recipe", keys.recipes.detail("r1")],
  ["a food", keys.foods.detail("f1")],
  ["the targets", keys.profiles.targets],
  ["the Train tab's routine", keys.training.activeRoutine],
  ["an exercise search", keys.training.exerciseSearchAll],
] as const;

describe("useUndoAssistantAction", () => {
  it("should send the action ids to the undo route and resolve to one code per id", async () => {
    const state = createAssistantFakeState({
      undoResults: { [SECOND_ACTION_ID]: "already_undone" },
    });
    installAssistantFake(server, state);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUndoAssistantAction(), { wrapper });

    const results = await act(() =>
      result.current.mutateAsync({ actionIds: [FIRST_ACTION_ID, SECOND_ACTION_ID] }),
    );

    expect(state.undoBodies).toEqual([{ actionIds: [FIRST_ACTION_ID, SECOND_ACTION_ID] }]);
    expect(results).toEqual([
      { actionId: FIRST_ACTION_ID, result: "undone" },
      { actionId: SECOND_ACTION_ID, result: "already_undone" },
    ]);
  });

  it("should keep the reason the route gives for a refusal, and read an answer without one", async () => {
    const state = createAssistantFakeState({
      undoResults: { [FIRST_ACTION_ID]: "undo_unavailable" },
      undoReasons: { [FIRST_ACTION_ID]: "workout_in_progress" },
    });
    installAssistantFake(server, state);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUndoAssistantAction(), { wrapper });

    const results = await act(() =>
      result.current.mutateAsync({ actionIds: [FIRST_ACTION_ID, SECOND_ACTION_ID] }),
    );

    expect(results).toEqual([
      { actionId: FIRST_ACTION_ID, result: "undo_unavailable", reason: "workout_in_progress" },
      { actionId: SECOND_ACTION_ID, result: "undone" },
    ]);
  });

  it("should read a reason it does not know as no reason, so a server ahead of the app never fails an Undo", async () => {
    const state = createAssistantFakeState({
      undoResults: { [FIRST_ACTION_ID]: "undo_unavailable" },
      undoReasons: { [FIRST_ACTION_ID]: "a_reason_from_the_future" },
    });
    installAssistantFake(server, state);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUndoAssistantAction(), { wrapper });

    const results = await act(() => result.current.mutateAsync({ actionIds: [FIRST_ACTION_ID] }));

    expect(results).toEqual([{ actionId: FIRST_ACTION_ID, result: "undo_unavailable" }]);
  });

  it("should send the ids in requests of at most 10 and join the answers in order", async () => {
    const state = createAssistantFakeState();
    installAssistantFake(server, state);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUndoAssistantAction(), { wrapper });
    const actionIds = Array.from(
      { length: 23 },
      (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    );

    const results = await act(() => result.current.mutateAsync({ actionIds }));

    expect(state.undoBodies).toEqual([
      { actionIds: actionIds.slice(0, 10) },
      { actionIds: actionIds.slice(10, 20) },
      { actionIds: actionIds.slice(20) },
    ]);
    expect(results.map((answer) => answer.actionId)).toEqual(actionIds);
  });

  it.each(refreshedKeys)("should refresh %s", async (_name, queryKey) => {
    installAssistantFake(server, createAssistantFakeState());
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(queryKey, "cached");
    const { result } = renderHook(() => useUndoAssistantAction(), { wrapper });

    await act(() => result.current.mutateAsync({ actionIds: [FIRST_ACTION_ID] }));

    expect(queryClient.getQueryState(queryKey)?.isInvalidated).toBe(true);
  });

  it("should refresh the reads even when the route answers undo_unavailable", async () => {
    installAssistantFake(
      server,
      createAssistantFakeState({ undoResults: { [FIRST_ACTION_ID]: "undo_unavailable" } }),
    );
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(keys.assistant.changes, "cached");
    const { result } = renderHook(() => useUndoAssistantAction(), { wrapper });

    const results = await act(() => result.current.mutateAsync({ actionIds: [FIRST_ACTION_ID] }));

    expect(results).toEqual([{ actionId: FIRST_ACTION_ID, result: "undo_unavailable" }]);
    expect(queryClient.getQueryState(keys.assistant.changes)?.isInvalidated).toBe(true);
  });

  it("should fail, and still refresh the reads, when the route refuses the request", async () => {
    server.use(
      http.post(`${FUNCTIONS_URL}/undo`, () =>
        HttpResponse.json(
          { error: { code: "invalid_request", message: "Send the ids of the actions to undo." } },
          { status: 400 },
        ),
      ),
    );
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(keys.assistant.changes, "cached");
    const { result } = renderHook(() => useUndoAssistantAction(), { wrapper });

    await expect(
      act(() => result.current.mutateAsync({ actionIds: [FIRST_ACTION_ID] })),
    ).rejects.toThrow();
    expect(queryClient.getQueryState(keys.assistant.changes)?.isInvalidated).toBe(true);
  });
});
