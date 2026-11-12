import { KeyLowProvider, keys } from "@keylow/api-client";
import { QueryClient, onlineManager } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from "@testing-library/react-native";
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
const mockScrollToEnd = jest.fn();
jest.mock("@gorhom/bottom-sheet", () =>
  jest
    .requireActual<{ mockBottomSheet: (onScrollToEnd: () => void) => unknown }>(
      "./support/sheetScrollViewMock",
    )
    .mockBottomSheet(() => {
      mockScrollToEnd();
    }),
);
jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));

// The hooks that read the conversation and run the turn are the app's own and are tested in the api client.
// The undo hook is the real one, on a client whose network is the undo route, so what it refreshes is real.
// So is the read of the workout in progress: a test sets it by seeding the cache the read answers from.
const mockAssistant: {
  items: AssistantThreadItem[];
  send: jest.Mock;
  /** The workout in progress the app reads, or null when there is none. */
  activeSession: { id: string } | null;
} = {
  items: [],
  send: jest.fn(),
  get activeSession() {
    return queryClient.getQueryData<{ id: string } | null>(keys.training.activeSession) ?? null;
  },
  set activeSession(session) {
    queryClient.setQueryData(keys.training.activeSession, session);
  },
};

jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  useAssistantConversation: () => ({
    data: { conversationId: "00000000-0000-4000-8000-0000000000c1", items: mockAssistant.items },
    isSuccess: true,
    isError: false,
    isFetching: false,
  }),
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

const sheetTree = (open = true) => (
  <ThemeProvider fixedPreference="dark">
    <KeyLowProvider client={undoClient} queryClient={queryClient}>
      <ToastProvider>
        <AssistantSheet localDate={OPENED_ON} open={open} onClose={onClose} />
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
    mockScrollToEnd.mockClear();
    mockAssistant.items = [];
    mockAssistant.send = jest.fn();
    // Reads stay fresh, so the workout in progress seeded below is not read again from the fake network.
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity },
        mutations: { retry: false },
      },
    });
    mockAssistant.activeSession = null;
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
    it("should draw the chip under the reply with no Try again, when the turn ended as normal", async () => {
      await showItems(
        {
          kind: "reply",
          id: "r1",
          text: "Your Legs workout is in progress.",
          answerMeta: null,
          stopped: false,
        },
        { kind: "ask_again", id: "a1", answered: false },
      );

      expect(screen.getByRole("button", { name: "Ask again" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Try again" })).not.toBeOnTheScreen();
    });

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

  // Where the thread scrolls. The sheet follows the end of the thread while the person is at it, and lets go only
  // when their own drag takes them away. The scroll view here is a plain one that reports scrollToEnd, and its
  // events are fired by hand, because Jest lays nothing out.
  describe("the thread's scroll position", () => {
    const CONTENT_HEIGHT = 2000;
    const VIEW_HEIGHT = 600;
    const AT_THE_END = CONTENT_HEIGHT - VIEW_HEIGHT;
    const SCROLLED_UP = 0;
    const NEAR_THE_END = AT_THE_END - 20;
    const SETTLED_MS = 200;

    const monday = () =>
      screen.getByRole("button", { name: "Monday · Push, 5 exercises · 15 sets · about 50 min" });
    const reply = (text: string): AssistantThreadItem => ({
      kind: "reply",
      id: "r1",
      text,
      answerMeta: null,
      stopped: false,
    });
    const scrollEvent = (offset: number) => ({
      nativeEvent: {
        contentOffset: { y: offset },
        contentSize: { height: CONTENT_HEIGHT },
        layoutMeasurement: { height: VIEW_HEIGHT },
      },
    });
    // The thread has grown, as it does when a day opens, a reply streams or a message is sent.
    const grow = async () => {
      await fireEvent(monday(), "contentSizeChange", 390, CONTENT_HEIGHT);
    };
    // A scroll event that is not the person's: the sheet's own scroll to the end reports one, behind the end while it runs.
    const programmaticScrollTo = async (offset: number) => {
      await fireEvent(monday(), "scroll", scrollEvent(offset));
    };
    // The person drags to `offset` and lets go, and the scroll comes to rest.
    const dragTo = async (offset: number) => {
      await fireEvent(monday(), "scrollBeginDrag", scrollEvent(AT_THE_END));
      await fireEvent(monday(), "scroll", scrollEvent(offset));
      await fireEvent(monday(), "scrollEndDrag", scrollEvent(offset));
      await act(() => {
        jest.advanceTimersByTime(SETTLED_MS);
      });
    };
    async function send(words: string) {
      await userSetup().type(screen.getByLabelText("Message"), words);
      await userSetup().press(screen.getByRole("button", { name: "Send" }));
    }
    const showRoutineThenReply = () =>
      showItems(
        { kind: "card", id: "c1", card: routineCreatedCard },
        reply("Here is your routine."),
      );

    it("should land at the end when the sheet opens", async () => {
      await showRoutineThenReply();

      await grow();

      expect(mockScrollToEnd).toHaveBeenCalledTimes(1);
    });

    it("should not scroll to the end when a day opens while the person is scrolled up", async () => {
      await showRoutineThenReply();
      await dragTo(SCROLLED_UP);
      mockScrollToEnd.mockClear();

      await userSetup().press(monday());
      await grow();

      expect(mockScrollToEnd).not.toHaveBeenCalled();
    });

    it("should still scroll to the end for the next message after days opened and closed, even one that changed no height", async () => {
      await showRoutineThenReply();
      await grow();

      // Monday opens and closes, and Wednesday opens over it with no change of height the thread reports.
      await userSetup().press(monday());
      await grow();
      await userSetup().press(monday());
      await userSetup().press(
        screen.getByRole("button", {
          name: "Wednesday · Pull, 5 exercises · 15 sets · about 50 min",
        }),
      );
      mockScrollToEnd.mockClear();
      await send("Swap leg press for hack squat");
      await grow();

      expect(mockScrollToEnd).toHaveBeenCalledTimes(1);
    });

    it("should scroll to the end and follow again when the person sends from scrolled up", async () => {
      await showRoutineThenReply();
      await dragTo(SCROLLED_UP);
      mockScrollToEnd.mockClear();

      await send("Swap leg press for hack squat");
      await grow();
      await grow();

      expect(mockScrollToEnd).toHaveBeenCalledTimes(2);
    });

    it("should scroll to the end and follow again on a new conversation", async () => {
      await showRoutineThenReply();
      await dragTo(SCROLLED_UP);
      mockScrollToEnd.mockClear();

      await userSetup().press(screen.getByRole("button", { name: "New conversation" }));
      await grow();

      expect(mockScrollToEnd).toHaveBeenCalledTimes(1);
    });

    it("should land at the end again when the sheet is opened again", async () => {
      const rendered = await showRoutineThenReply();
      await dragTo(SCROLLED_UP);
      await rendered.rerender(sheetTree(false));
      await rendered.rerender(sheetTree(true));
      mockScrollToEnd.mockClear();

      await grow();

      expect(mockScrollToEnd).toHaveBeenCalledTimes(1);
    });

    it("should keep following a streaming reply at the end, through scroll events that are not a drag", async () => {
      await showRoutineThenReply();
      await grow();
      mockScrollToEnd.mockClear();

      // The scroll to the end reports an offset behind the end while the reply grows under it.
      await programmaticScrollTo(AT_THE_END - 300);
      await grow();
      await programmaticScrollTo(AT_THE_END - 150);
      await grow();

      expect(mockScrollToEnd).toHaveBeenCalledTimes(2);
    });

    it("should not follow a reply that streams while the person is scrolled up, and follow again when they return to the end", async () => {
      await showRoutineThenReply();
      await dragTo(SCROLLED_UP);
      mockScrollToEnd.mockClear();

      await grow();
      await grow();
      expect(mockScrollToEnd).not.toHaveBeenCalled();

      await dragTo(NEAR_THE_END);
      await grow();

      expect(mockScrollToEnd).toHaveBeenCalledTimes(1);
    });

    it("should let a drag that stays near the end leave the thread following", async () => {
      await showRoutineThenReply();
      await dragTo(NEAR_THE_END);
      mockScrollToEnd.mockClear();

      await grow();

      expect(mockScrollToEnd).toHaveBeenCalledTimes(1);
    });

    it("should read the scroll that carries on after the finger lifts as the person's own, until it comes to rest", async () => {
      await showRoutineThenReply();
      await fireEvent(monday(), "scrollBeginDrag", scrollEvent(AT_THE_END));
      await fireEvent(monday(), "scrollEndDrag", scrollEvent(AT_THE_END - 10));
      // The flick carries the thread up, with no drag event after the finger is lifted.
      await act(() => {
        jest.advanceTimersByTime(50);
      });
      await programmaticScrollTo(SCROLLED_UP);
      await act(() => {
        jest.advanceTimersByTime(SETTLED_MS);
      });
      mockScrollToEnd.mockClear();

      await grow();

      expect(mockScrollToEnd).not.toHaveBeenCalled();
    });
  });
});
