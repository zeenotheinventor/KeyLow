import { KeyLowProvider } from "@keylow/api-client";
import { QueryClient } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { AssistantSheet } from "../components/AssistantSheet";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { undoClient } from "./support/assistantUndoBackend";
import { installVirtualClock } from "./support/virtualClock";

import type { AssistantThreadItem } from "@keylow/core";

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

// The hook that pages the conversation is tested in the api client. Here it is a fake the test moves by hand.
// Like the hook's, it starts no read while one is in flight.
let readsStarted = 0;
let isReadInFlight = false;
const mockLoadOlder = jest.fn(() => {
  if (!isReadInFlight) {
    isReadInFlight = true;
    readsStarted += 1;
  }
});
const mockConversation: {
  items: AssistantThreadItem[];
  hasOlder: boolean;
  isLoadingOlder: boolean;
} = { items: [], hasOlder: false, isLoadingOlder: false };

jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  useAssistantConversation: () => ({
    data: { conversationId: "00000000-0000-4000-8000-0000000000c1", items: mockConversation.items },
    isSuccess: true,
    isError: false,
    isFetching: false,
    hasOlder: mockConversation.hasOlder,
    isLoadingOlder: mockConversation.isLoadingOlder,
    loadOlder: mockLoadOlder,
  }),
  useAssistantTurn: () => ({ send: jest.fn(), stop: jest.fn(), live: null, isStreaming: false }),
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

const CONTENT_HEIGHT = 3000;
const VIEW_HEIGHT = 600;
const AT_THE_END = CONTENT_HEIGHT - VIEW_HEIGHT;
const NEAR_THE_TOP = 250;
const MID_THREAD = 1200;
const SETTLED_MS = 200;

let queryClient: QueryClient;

const sheetTree = () => (
  <ThemeProvider fixedPreference="dark">
    <KeyLowProvider client={undoClient} queryClient={queryClient}>
      <ToastProvider>
        <AssistantSheet localDate="2026-11-07" open onClose={jest.fn()} />
      </ToastProvider>
    </KeyLowProvider>
  </ThemeProvider>
);

const reply = (id: string, text: string): AssistantThreadItem => ({
  kind: "reply",
  id,
  text,
  answerMeta: null,
  stopped: false,
});

const newerTurns = [reply("r3", "Third turn reply"), reply("r4", "Fourth turn reply")];
const olderTurns = [reply("r1", "First turn reply"), reply("r2", "Second turn reply")];

// Jest lays nothing out, so the scroll view's events are fired by hand on a child, and they bubble up to it.
const threadChild = () => screen.getByText("Fourth turn reply");
const scrollEvent = (offset: number) => ({
  nativeEvent: {
    contentOffset: { y: offset },
    contentSize: { height: CONTENT_HEIGHT },
    layoutMeasurement: { height: VIEW_HEIGHT },
  },
});
const layOut = async () => {
  await fireEvent(threadChild(), "layout", { nativeEvent: { layout: { height: VIEW_HEIGHT } } });
};
const grow = async () => {
  await fireEvent(threadChild(), "contentSizeChange", 390, CONTENT_HEIGHT);
};
// The person drags to `offset` and lets go, and the scroll comes to rest.
const dragTo = async (offset: number) => {
  await fireEvent(threadChild(), "scrollBeginDrag", scrollEvent(AT_THE_END));
  await fireEvent(threadChild(), "scroll", scrollEvent(offset));
  await fireEvent(threadChild(), "scrollEndDrag", scrollEvent(offset));
  await act(() => {
    jest.advanceTimersByTime(SETTLED_MS);
  });
};
const loadingStatus = () => screen.queryByRole("status", { name: "Loading your conversation" });

describe("paging the assistant thread", () => {
  beforeEach(() => {
    installVirtualClock();
    mockScrollToEnd.mockClear();
    mockLoadOlder.mockClear();
    readsStarted = 0;
    isReadInFlight = false;
    mockConversation.items = newerTurns;
    mockConversation.hasOlder = true;
    mockConversation.isLoadingOlder = false;
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
    jest.useRealTimers();
  });

  describe("opening at the newest message", () => {
    it("should scroll to the end once the scroll view has its height, after the content settled first", async () => {
      await render(sheetTree());
      await grow();
      mockScrollToEnd.mockClear();

      await layOut();

      expect(mockScrollToEnd).toHaveBeenCalledTimes(1);
    });

    it("should not scroll to the end on a layout after the person scrolled away from the end", async () => {
      await render(sheetTree());
      await grow();
      await dragTo(MID_THREAD);
      mockScrollToEnd.mockClear();

      await layOut();

      expect(mockScrollToEnd).not.toHaveBeenCalled();
    });
  });

  describe("loading older turns", () => {
    it("should load older turns once when the person scrolls near the top", async () => {
      await render(sheetTree());

      await dragTo(NEAR_THE_TOP);

      expect(readsStarted).toBe(1);
    });

    it("should not load older turns while the person is far from the top", async () => {
      await render(sheetTree());

      await dragTo(MID_THREAD);

      expect(mockLoadOlder).not.toHaveBeenCalled();
    });

    it("should not load older turns from a scroll the person did not make", async () => {
      await render(sheetTree());

      await fireEvent(threadChild(), "scroll", scrollEvent(0));

      expect(mockLoadOlder).not.toHaveBeenCalled();
    });

    it("should stop following the end once older turns start to load", async () => {
      await render(sheetTree());
      await dragTo(NEAR_THE_TOP);
      mockScrollToEnd.mockClear();

      await grow();

      expect(mockScrollToEnd).not.toHaveBeenCalled();
    });

    it("should show the loading status above the turns while older turns load", async () => {
      mockConversation.isLoadingOlder = true;

      await render(sheetTree());

      expect(loadingStatus()).toBeOnTheScreen();
      expect(screen.getByText("Fourth turn reply")).toBeOnTheScreen();
    });

    it("should show no loading status when nothing older is loading", async () => {
      await render(sheetTree());

      expect(loadingStatus()).not.toBeOnTheScreen();
    });

    it("should not start a second load while one is in flight", async () => {
      const rendered = await render(sheetTree());
      await dragTo(NEAR_THE_TOP);
      mockConversation.isLoadingOlder = true;
      await rendered.rerender(sheetTree());

      const callsSoFar = mockLoadOlder.mock.calls.length;

      await dragTo(0);

      expect(mockLoadOlder).toHaveBeenCalledTimes(callsSoFar);
    });

    it("should draw the older turns above the newer ones once they land", async () => {
      const rendered = await render(sheetTree());
      mockConversation.items = [...olderTurns, ...newerTurns];

      await rendered.rerender(sheetTree());

      const turns = screen.getAllByText(/turn reply/);
      expect(turns).toHaveLength(4);
      ["First", "Second", "Third", "Fourth"].forEach((ordinal, index) => {
        expect(turns[index]).toHaveTextContent(`${ordinal} turn reply`);
      });
    });

    it("should never show the loading status or load for a short conversation", async () => {
      mockConversation.hasOlder = false;
      await render(sheetTree());

      await dragTo(0);

      expect(mockLoadOlder).not.toHaveBeenCalled();
      expect(loadingStatus()).not.toBeOnTheScreen();
    });
  });
});
