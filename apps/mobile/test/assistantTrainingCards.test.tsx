import { KeyLowProvider, keys } from "@keylow/api-client";
import { QueryClient, onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { AssistantSheet } from "../components/AssistantSheet";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { FIRST_ACTION_ID } from "./support/assistantCardFixtures";
import { resetUndoBackend, undoClient } from "./support/assistantUndoBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { installVirtualClock } from "./support/virtualClock";

import type { AssistantCard, AssistantThreadItem } from "@keylow/core";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
jest.mock("@gorhom/bottom-sheet", () =>
  jest
    .requireActual<{ mockBottomSheet: () => unknown }>("./support/sheetScrollViewMock")
    .mockBottomSheet(),
);
jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));

// The hooks that read the conversation and run the turn are the app's own and are tested in the api client.
// The undo hook is the real one, on a client whose network is the undo route, so what it refreshes is real.
const mockAssistant: {
  items: AssistantThreadItem[];
  send: jest.Mock;
  /** The workout in progress the app reads, or null when there is none. */
  activeSession: { id: string } | null;
} = { items: [], send: jest.fn(), activeSession: null };

jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  useAssistantConversation: () => ({
    data: { conversationId: "00000000-0000-4000-8000-0000000000c1", items: mockAssistant.items },
    isSuccess: true,
    isError: false,
    isFetching: false,
  }),
  useActiveSession: () => ({ data: mockAssistant.activeSession }),
  useAssistantTurn: () => ({
    send: mockAssistant.send,
    stop: jest.fn(),
    live: null,
    isStreaming: false,
  }),
  useNewAssistantConversation: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useAssistantStatus: () => ({
    data: { notice: null },
    isSuccess: true,
    isError: false,
    failureCount: 0,
    refetch: () => Promise.resolve({ isSuccess: true }),
  }),
  useSetAssistantConsent: () => ({ mutate: jest.fn(), isPending: false }),
  useProfileTimeZone: () => ({ data: "Europe/London" }),
}));

setUpTests();

const OPENED_ON = "2026-11-07";
const YOUR_WORDS = "Swap leg press for hack squat";
const ROUTINE_ID = "00000000-0000-4000-8000-0000000000e2";
const SESSION_ID = "00000000-0000-4000-8000-0000000000e3";

let onClose: jest.Mock;
let queryClient: QueryClient;

const routineCreatedCard: AssistantCard = {
  actionIds: [FIRST_ACTION_ID],
  kind: "routine_created",
  title: "Built routine Push Pull Legs, 3 days",
  sub: null,
  rows: [],
  days: [
    {
      name: "Monday · Push",
      summary: "5 exercises · 15 sets · about 50 min",
      exercises: [{ name: "Bench press", detail: "3 sets · 8 to 10 reps · RIR 2" }],
    },
    {
      name: "Wednesday · Pull",
      summary: "5 exercises · 15 sets · about 50 min",
      exercises: [{ name: "Barbell row", detail: "3 sets · 8 to 10 reps · RIR 2" }],
    },
  ],
  totalText: "The week: 45 sets · 3 days",
  note: null,
  link: {
    label: "Open in routine editor",
    target: { screen: "routine_editor", routineId: ROUTINE_ID },
  },
  undo: "available",
  undoneSub: "Archived Push Pull Legs",
};

const setUpdatedCard: AssistantCard = {
  actionIds: [FIRST_ACTION_ID],
  kind: "set_updated",
  title: "Changed a set in Legs",
  sub: "Thursday 8 October",
  rows: [],
  totalText: null,
  note: null,
  link: { label: "Open the session", target: { screen: "session_detail", sessionId: SESSION_ID } },
  undo: "available",
  undoneSub: "Put the set back as it was",
};

const removedDayLink = {
  label: "Open in routine editor",
  target: { screen: "routine_editor", routineId: ROUTINE_ID },
} as const;

const sheetTree = () => (
  <ThemeProvider fixedPreference="dark">
    <KeyLowProvider client={undoClient} queryClient={queryClient}>
      <ToastProvider>
        <AssistantSheet localDate={OPENED_ON} open onClose={onClose} />
      </ToastProvider>
    </KeyLowProvider>
  </ThemeProvider>
);

async function showItems(...items: AssistantThreadItem[]) {
  mockAssistant.items = [{ kind: "user", id: "u1", text: YOUR_WORDS }, ...items];
  return await render(sheetTree());
}

const userSetup = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

describe("the training cards in the assistant sheet", () => {
  beforeEach(() => {
    installVirtualClock();
    onClose = jest.fn();
    resetRouterMock();
    resetUndoBackend();
    mockAssistant.items = [];
    mockAssistant.send = jest.fn();
    mockAssistant.activeSession = null;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
    jest.useRealTimers();
  });

  describe("the days of a routine", () => {
    const monday = () =>
      screen.getByRole("button", { name: "Monday · Push, 5 exercises · 15 sets · about 50 min" });

    it("should draw every day closed", async () => {
      await showItems({ kind: "card", id: "c1", card: routineCreatedCard });

      expect(monday()).toBeOnTheScreen();
      expect(screen.queryByText("Bench press")).not.toBeOnTheScreen();
    });

    it("should open a day to its exercises, and close it again", async () => {
      await showItems({ kind: "card", id: "c1", card: routineCreatedCard });

      await userSetup().press(monday());
      expect(screen.getByText("Bench press")).toBeOnTheScreen();
      expect(screen.getByText("3 sets · 8 to 10 reps · RIR 2")).toBeOnTheScreen();

      await userSetup().press(monday());
      expect(screen.queryByText("Bench press")).not.toBeOnTheScreen();
    });

    it("should keep one day open at a time", async () => {
      await showItems({ kind: "card", id: "c1", card: routineCreatedCard });

      await userSetup().press(monday());
      await userSetup().press(
        screen.getByRole("button", {
          name: "Wednesday · Pull, 5 exercises · 15 sets · about 50 min",
        }),
      );

      expect(screen.queryByText("Bench press")).not.toBeOnTheScreen();
      expect(screen.getByText("Barbell row")).toBeOnTheScreen();
    });
  });

  describe("the links", () => {
    it("should open the routine editor from a link on its own, closing the sheet first", async () => {
      await showItems(
        {
          kind: "reply",
          id: "r1",
          text: "A day can only be removed in the routine editor.",
          answerMeta: null,
          stopped: false,
        },
        { kind: "link", id: "l1", link: removedDayLink },
      );

      await userSetup().press(screen.getByRole("button", { name: "Open in routine editor" }));

      expect(routerMock.push).toHaveBeenCalledWith(`/train/routines/${ROUTINE_ID}`);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(onClose.mock.invocationCallOrder[0]).toBeLessThan(
        routerMock.push.mock.invocationCallOrder[0] ?? 0,
      );
    });

    it("should open the session from the card of a changed set", async () => {
      await showItems({ kind: "card", id: "c1", card: setUpdatedCard });

      await userSetup().press(screen.getByRole("button", { name: "Open the session" }));

      expect(routerMock.push).toHaveBeenCalledWith(`/train/history/${SESSION_ID}`);
    });
  });

  describe("Ask again", () => {
    const refused = (isAnswered: boolean): AssistantThreadItem[] => [
      {
        kind: "reply",
        id: "r1",
        text: "Your Legs workout is in progress.",
        answerMeta: null,
        stopped: false,
      },
      { kind: "ask_again", id: "a1", answered: isAnswered },
    ];

    it("should send your last message again from the chip", async () => {
      await showItems(...refused(false));

      await userSetup().press(screen.getByRole("button", { name: "Ask again" }));

      expect(mockAssistant.send).toHaveBeenCalledTimes(1);
      expect(mockAssistant.send).toHaveBeenCalledWith(
        YOUR_WORDS,
        expect.objectContaining({ localDate: OPENED_ON }),
      );
    });

    it("should take the chip away once a later turn has answered", async () => {
      await showItems(...refused(true));

      expect(screen.queryByRole("button", { name: "Ask again" })).not.toBeOnTheScreen();
    });
  });

  describe("Undo", () => {
    it("should refresh the Train tab after an Undo", async () => {
      queryClient.setQueryData(keys.training.activeRoutine, "cached");
      await showItems({ kind: "card", id: "c1", card: setUpdatedCard });

      await userSetup().press(screen.getByRole("button", { name: "Undo" }));

      await waitFor(() => {
        expect(queryClient.getQueryState(keys.training.activeRoutine)?.isInvalidated).toBe(true);
      });
      expect(screen.getByText("Undone")).toBeOnTheScreen();
    });
  });

  describe("Can't undo yet", () => {
    it("should draw the plain words and the note, with no Undo, while a workout is in progress", async () => {
      mockAssistant.activeSession = { id: "s1" };
      await showItems({ kind: "card", id: "c1", card: setUpdatedCard });

      expect(screen.getByText("Can't undo yet")).toBeOnTheScreen();
      expect(
        screen.getByText(
          "Your workout is in progress, so Undo waits until it ends. Finish it, then press Undo.",
        ),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Undo" })).not.toBeOnTheScreen();
    });

    it("should bring Undo back by itself when the workout ends", async () => {
      mockAssistant.activeSession = { id: "s1" };
      const rendered = await showItems({ kind: "card", id: "c1", card: setUpdatedCard });

      mockAssistant.activeSession = null;
      await rendered.rerender(sheetTree());

      expect(screen.getByRole("button", { name: "Undo" })).toBeOnTheScreen();
      expect(screen.queryByText("Can't undo yet")).not.toBeOnTheScreen();
    });

    it("should leave a diary card with its Undo during a workout", async () => {
      mockAssistant.activeSession = { id: "s1" };
      await showItems({ kind: "card", id: "c1", card: { ...setUpdatedCard, kind: "logged" } });

      expect(screen.getByRole("button", { name: "Undo" })).toBeOnTheScreen();
    });
  });
});
