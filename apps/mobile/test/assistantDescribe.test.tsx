import { ASSISTANT_NOT_MEDICAL_ADVICE } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { AssistantSheet } from "../components/AssistantSheet";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { screenWords } from "./support/screenWords";
import { installVirtualClock } from "./support/virtualClock";

import type { AssistantThreadItem } from "@keylow/core";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
// The sheet library's sheet stands in as the plain one, with a note of the snap point it was given.
const mockSheet: { index: unknown } = { index: undefined };
jest.mock("@gorhom/bottom-sheet", () => {
  const { createElement, forwardRef } = jest.requireActual<typeof import("react")>("react");
  const plain = jest
    .requireActual<{
      mockBottomSheet: () => {
        default: React.ComponentType<{ index: unknown } & React.RefAttributes<unknown>>;
      };
    }>("./support/sheetScrollViewMock")
    .mockBottomSheet();
  const Recording = forwardRef<unknown, { index: unknown }>(function Recording(props, ref) {
    mockSheet.index = props.index;
    return createElement(plain.default, { ...props, ref });
  });
  return { ...plain, default: Recording };
});
jest.mock("expo/fetch", () => ({ fetch: jest.fn() }));

// The hooks the sheet reads are the app's own and are tested in the api client. They are given invented
// data here, so a test says what the person sees.
const mockAssistant: {
  conversation: {
    data: { conversationId: string | null; items: AssistantThreadItem[] } | undefined;
    isSuccess: boolean;
    isError: boolean;
    isFetching: boolean;
  };
  turn: { send: jest.Mock; stop: jest.Mock; live: null; isStreaming: boolean };
} = {
  conversation: {
    data: { conversationId: null, items: [] },
    isSuccess: true,
    isError: false,
    isFetching: false,
  },
  turn: { send: jest.fn(), stop: jest.fn(), live: null, isStreaming: false },
};

jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  useAssistantStatus: () => ({
    data: { notice: null },
    isSuccess: true,
    isError: false,
    failureCount: 0,
    refetch: jest.fn().mockResolvedValue({ isSuccess: true }),
  }),
  useSetAssistantConsent: () => ({ mutate: jest.fn(), isPending: false }),
  useAssistantConversation: () => mockAssistant.conversation,
  useAssistantTurn: () => mockAssistant.turn,
  useNewAssistantConversation: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useProfileTimeZone: () => ({ data: "Europe/London" }),
}));

setUpTests();

const LOGGED_ON = "2026-10-12";
const DESCRIBE_INTRO =
  "Name each food and how much, in your own words: 2 eggs, a slice of toast, 150 g of rice. If a portion is unclear, the assistant asks.";

const sheetTree = (describeAt?: string) => (
  <ThemeProvider fixedPreference="dark">
    <ToastProvider>
      <AssistantSheet describeAt={describeAt} localDate={LOGGED_ON} open onClose={jest.fn()} />
    </ToastProvider>
  </ThemeProvider>
);

const userSetup = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

describe("the assistant sheet opened from Describe in Log food", () => {
  beforeEach(() => {
    installVirtualClock();
    mockAssistant.conversation = {
      data: { conversationId: null, items: [] },
      isSuccess: true,
      isError: false,
      isFetching: false,
    };
    mockAssistant.turn = { send: jest.fn(), stop: jest.fn(), live: null, isStreaming: false };
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    jest.useRealTimers();
  });

  it("should open at the taller snap point, which is full height", async () => {
    await render(sheetTree("13:00"));

    expect(mockSheet.index).toBe(1);
  });

  it("should open at the usual height from the diary", async () => {
    await render(sheetTree());

    expect(mockSheet.index).toBe(0);
  });

  it("should draw the intro, with no starters and no not-medical line, as assistant · describe does", async () => {
    await render(sheetTree("13:00"));

    expect(screen.getByRole("heading", { name: "Describe a meal" })).toBeOnTheScreen();
    expect(screen.getByText(DESCRIBE_INTRO)).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "Log 2 eggs and toast at 08:10" })).toBeNull();
    expect(screen.queryByText(ASSISTANT_NOT_MEDICAL_ADVICE)).toBeNull();
  });

  it("should draw the hint over the composer, in the order of the board", async () => {
    await render(sheetTree("13:00"));

    const words = screenWords();
    expect(words.indexOf("Logs at 13:00")).toBeGreaterThan(words.indexOf(DESCRIBE_INTRO));
    expect(words.indexOf("Say what and how much")).toBe(words.indexOf("Logs at 13:00") + 1);
    expect(words.indexOf("Message")).toBeGreaterThan(words.indexOf("Say what and how much"));
  });

  it("should focus the field and ask for a meal", async () => {
    await render(sheetTree("13:00"));

    expect(screen.getByLabelText("Message")).toHaveProp("autoFocus", true);
    expect(screen.getByPlaceholderText("Describe a meal")).toBe(screen.getByLabelText("Message"));
  });

  it("should send the message with the day and time it logs at", async () => {
    await render(sheetTree("13:00"));

    await userSetup().type(screen.getByLabelText("Message"), "2 eggs and toast");
    await userSetup().press(screen.getByRole("button", { name: "Send" }));

    expect(mockAssistant.turn.send).toHaveBeenCalledWith("2 eggs and toast", {
      conversationId: null,
      localDate: LOGGED_ON,
      localTime: "13:00",
    });
  });

  it("should keep the hint over a conversation that already has messages, and the intro goes", async () => {
    mockAssistant.conversation = {
      data: { conversationId: "c1", items: [{ kind: "user", id: "u1", text: "Hello" }] },
      isSuccess: true,
      isError: false,
      isFetching: false,
    };
    await render(sheetTree("13:00"));

    expect(screen.getByText("Logs at 13:00")).toBeOnTheScreen();
    expect(screen.queryByText(DESCRIBE_INTRO)).toBeNull();
  });

  it("should draw no hint and leave the field alone when opened from the diary", async () => {
    await render(sheetTree());

    expect(screen.queryByText("Logs at 13:00")).toBeNull();
    expect(screen.queryByText("Say what and how much")).toBeNull();
    expect(screen.getByLabelText("Message")).not.toHaveProp("autoFocus", true);
  });

  it("should send no time when opened from the diary", async () => {
    await render(sheetTree());

    await userSetup().type(screen.getByLabelText("Message"), "What's left?");
    await userSetup().press(screen.getByRole("button", { name: "Send" }));

    expect(mockAssistant.turn.send).toHaveBeenCalledWith("What's left?", {
      conversationId: null,
      localDate: LOGGED_ON,
    });
  });
});
