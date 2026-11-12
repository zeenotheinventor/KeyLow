import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useAssistantCardUndo } from "../../src/hooks/useAssistantCardUndo";
import { keys } from "../../src/queryKeys";
import {
  FIRST_ACTION_ID,
  FUNCTIONS_URL,
  SECOND_ACTION_ID,
  createAssistantFakeState,
  installAssistantFake,
  loggedCard,
} from "../support/assistantFake";
import { installTrainingFake, openSessionRow } from "../support/training";
import { createWrapper } from "../support/wrapper";

import type { AssistantCard } from "@keylow/core";

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

const THIRD_ACTION_ID = "00000000-0000-4000-8000-0000000000d3";

// The assistant's own wire shape, which the fake serves, read by the same type the app uses.
const diaryCard: AssistantCard = { ...loggedCard, kind: "logged", undo: "available" };

const threeSetsCard: AssistantCard = {
  actionIds: [FIRST_ACTION_ID, SECOND_ACTION_ID, THIRD_ACTION_ID],
  kind: "set_updated",
  title: "Changed 3 sets in Legs",
  sub: null,
  rows: [],
  totalText: null,
  note: null,
  link: null,
  undo: "available",
  undoneSub: "Put the sets back as they were",
};

function setUp(card: AssistantCard, options: Parameters<typeof createAssistantFakeState>[0] = {}) {
  const state = createAssistantFakeState(options);
  installAssistantFake(server, state);
  const training = installTrainingFake(server, { sessions: [] });
  const { wrapper, queryClient } = createWrapper();
  const rendered = renderHook(() => useAssistantCardUndo(card), { wrapper });
  return { state, training, queryClient, ...rendered };
}

describe("useAssistantCardUndo", () => {
  describe("a card whose Undo is available", () => {
    it("should draw Undo, with the card's words as sent", () => {
      const { result } = setUp(diaryCard);

      expect(result.current.undoState).toBe("available");
      expect(result.current.look.undo).toEqual({ state: "available", label: "Undo" });
      expect(result.current.look.title).toBe(diaryCard.title);
    });

    it("should not ask whether a workout is in progress, which only a training card cares about", async () => {
      const { training } = setUp(diaryCard);

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(training.requests).toEqual([]);
    });
  });

  describe("pressing Undo", () => {
    it("should send the card's action ids and draw the card undone with the words it was sent with", async () => {
      const { result, state } = setUp(diaryCard);

      await act(() => result.current.undo());

      expect(state.undoBodies).toEqual([{ actionIds: diaryCard.actionIds }]);
      await waitFor(() => {
        expect(result.current.undoState).toBe("done");
        expect(result.current.look).toMatchObject({
          title: "Undone",
          subtitle: diaryCard.undoneSub,
        });
      });
    });

    it("should be busy while the request is out, then take the state the answer gives", async () => {
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const { result } = setUp(diaryCard);
      server.use(
        http.post(`${FUNCTIONS_URL}/undo`, async () => {
          await gate;
          return HttpResponse.json({
            results: diaryCard.actionIds.map((actionId) => ({ actionId, result: "undone" })),
          });
        }),
      );

      let pressed: Promise<void> = Promise.resolve();
      act(() => {
        pressed = result.current.undo();
      });
      await waitFor(() => {
        expect(result.current.undoState).toBe("busy");
      });
      // The card keeps its Undo behind the busy state, so a request that fails shows it again.
      expect(result.current.look.undo.state).toBe("available");

      release();
      await act(() => pressed);

      await waitFor(() => {
        expect(result.current.undoState).toBe("done");
      });
    });

    it("should ignore a second press while one is out, and send the ids once", async () => {
      const { result, state } = setUp(diaryCard);

      await act(async () => {
        await Promise.all([result.current.undo(), result.current.undo()]);
      });

      expect(state.undoBodies).toHaveLength(1);
    });

    it("should let a press through again once the last one has failed", async () => {
      const { result, state } = setUp(diaryCard);
      server.use(
        http.post(`${FUNCTIONS_URL}/undo`, () =>
          HttpResponse.json(
            { error: { code: "internal", message: "raw database text" } },
            { status: 500 },
          ),
        ),
      );
      await act(() => result.current.undo());
      await waitFor(() => {
        expect(result.current.undoState).toBe("available");
      });
      server.resetHandlers();
      installAssistantFake(server, state);
      installTrainingFake(server, { sessions: [] });

      await act(() => result.current.undo());

      await waitFor(() => {
        expect(result.current.undoState).toBe("done");
      });
      expect(state.undoBodies).toHaveLength(1);
    });

    it("should keep Undo, and not throw, when the request fails", async () => {
      const { result } = setUp(diaryCard);
      server.use(
        http.post(`${FUNCTIONS_URL}/undo`, () =>
          HttpResponse.json(
            { error: { code: "internal", message: "raw database text" } },
            { status: 500 },
          ),
        ),
      );

      await act(() => result.current.undo());

      await waitFor(() => {
        expect(result.current.undoState).toBe("available");
        expect(result.current.look.undo).toEqual({ state: "available", label: "Undo" });
        expect(result.current.look.title).toBe(diaryCard.title);
      });
    });

    it("should keep Undo, and not throw, when the connection is down", async () => {
      const { result } = setUp(diaryCard);
      server.use(http.post(`${FUNCTIONS_URL}/undo`, () => HttpResponse.error()));

      await act(() => result.current.undo());

      await waitFor(() => {
        expect(result.current.undoState).toBe("available");
      });
    });

    it("should draw Can't undo, with the reason's words kept, when the route says it cannot", async () => {
      const { result } = setUp(diaryCard, {
        undoResults: { [FIRST_ACTION_ID]: "undo_unavailable" },
      });

      await act(() => result.current.undo());

      await waitFor(() => {
        expect(result.current.undoState).toBe("unavailable");
        expect(result.current.look.undo).toEqual({ state: "unavailable", label: "Can't undo" });
      });
    });

    it("should refresh the thread and the changes list after the press, so the card is read again", async () => {
      const { result, queryClient } = setUp(diaryCard);
      queryClient.setQueryData(keys.assistant.conversation, "cached");
      queryClient.setQueryData(keys.assistant.changes, "cached");

      await act(() => result.current.undo());

      expect(queryClient.getQueryState(keys.assistant.conversation)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(keys.assistant.changes)?.isInvalidated).toBe(true);
    });
  });

  describe("a card that was sent without an Undo", () => {
    it("should stay Can't undo, and take no state from a press", () => {
      const { result } = setUp({ ...diaryCard, undo: "unavailable" });

      expect(result.current.undoState).toBe("unavailable");
      expect(result.current.look.undo.label).toBe("Can't undo");
    });

    it("should stay Undone for a card that was undone elsewhere", () => {
      const { result } = setUp({ ...diaryCard, undo: "undone" });

      expect(result.current.undoState).toBe("done");
    });
  });

  describe("a training card that groups three writes", () => {
    it("should draw a merged partial Undo, with how many were put back and why the rest were not", async () => {
      const { result, state } = setUp(threeSetsCard, {
        undoResults: { [THIRD_ACTION_ID]: "undo_unavailable" },
        undoReasons: { [THIRD_ACTION_ID]: "changed" },
      });

      await act(() => result.current.undo());

      expect(state.undoBodies).toEqual([{ actionIds: threeSetsCard.actionIds }]);
      await waitFor(() => {
        expect(result.current.undoState).toBe("unavailable");
        expect(result.current.look.note).toBe(
          "Put back 2 of 3 sets. The rest changed since, so Undo is off for them.",
        );
      });
    });

    it("should say neutrally that the rest can't be undone when the refusal gave no reason", async () => {
      const { result } = setUp(threeSetsCard, {
        undoResults: { [THIRD_ACTION_ID]: "undo_unavailable" },
      });

      await act(() => result.current.undo());

      await waitFor(() => {
        expect(result.current.look.note).toBe("Put back 2 of 3 sets. The rest can't be undone.");
      });
    });

    it("should count an action someone else already undid as put back", async () => {
      const { result } = setUp(threeSetsCard, {
        undoResults: { [FIRST_ACTION_ID]: "already_undone", [THIRD_ACTION_ID]: "not_found" },
      });

      await act(() => result.current.undo());

      await waitFor(() => {
        expect(result.current.look.note).toContain("Put back 2 of 3 sets.");
      });
    });

    it("should hold Undo back as Can't undo yet while a workout is in progress", async () => {
      const state = createAssistantFakeState();
      installAssistantFake(server, state);
      installTrainingFake(server, { sessions: [openSessionRow()] });
      const { wrapper } = createWrapper();

      const { result } = renderHook(() => useAssistantCardUndo(threeSetsCard), { wrapper });

      await waitFor(() => {
        expect(result.current.look.undo).toEqual({
          state: "unavailable",
          label: "Can't undo yet",
        });
      });
      expect(result.current.undoState).toBe("unavailable");
    });

    it("should bring Undo back when the workout ends", async () => {
      installAssistantFake(server, createAssistantFakeState());
      installTrainingFake(server, { sessions: [openSessionRow()] });
      const { wrapper, queryClient } = createWrapper();
      const { result } = renderHook(() => useAssistantCardUndo(threeSetsCard), { wrapper });
      await waitFor(() => {
        expect(result.current.undoState).toBe("unavailable");
      });

      act(() => {
        queryClient.setQueryData(keys.training.activeSession, null);
      });

      await waitFor(() => {
        expect(result.current.undoState).toBe("available");
      });
    });

    it("should draw Undo when no workout is in progress", async () => {
      const { result, queryClient } = setUp(threeSetsCard);

      await waitFor(() => {
        expect(queryClient.getQueryState(keys.training.activeSession)?.status).toBe("success");
      });

      expect(queryClient.getQueryData(keys.training.activeSession)).toBeNull();
      expect(result.current.undoState).toBe("available");
    });

    it("should keep a press refused for a workout waiting while the workout lasts, with what was put back", async () => {
      installAssistantFake(
        server,
        createAssistantFakeState({
          undoResults: { [THIRD_ACTION_ID]: "undo_unavailable" },
          undoReasons: { [THIRD_ACTION_ID]: "workout_in_progress" },
        }),
      );
      installTrainingFake(server, { sessions: [openSessionRow()] });
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useAssistantCardUndo(threeSetsCard), { wrapper });

      await act(() => result.current.undo());

      await waitFor(() => {
        expect(result.current.look.undo).toEqual({ state: "unavailable", label: "Can't undo yet" });
        expect(result.current.look.note).toMatch(
          /^Put back 2 of 3 sets\. Your workout is in progress/,
        );
      });
    });

    it("should read no workout for a training card that cannot be undone anyway", async () => {
      const { training } = setUp({ ...threeSetsCard, undo: "unavailable" });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(training.requests).toEqual([]);
    });
  });
});
