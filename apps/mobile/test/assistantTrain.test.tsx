import { ASSISTANT_NOT_MEDICAL_ADVICE } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { AssistantSheet } from "../components/AssistantSheet";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
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
jest.mock("@gorhom/bottom-sheet", () =>
  jest
    .requireActual<{ mockBottomSheet: () => unknown }>("./support/sheetScrollViewMock")
    .mockBottomSheet(),
);
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

const OPENED_ON = "2026-10-15";

const sheetTree = (from?: "train") => (
  <ThemeProvider fixedPreference="dark">
    <ToastProvider>
      <AssistantSheet from={from} localDate={OPENED_ON} open onClose={jest.fn()} />
    </ToastProvider>
  </ThemeProvider>
);

const userSetup = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

describe("the assistant sheet opened from the Train header", () => {
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

  it("should draw the training heading, the diary's lede, the three starters and the not-medical line, as assistant · empty-train does", async () => {
    await render(sheetTree("train"));

    expect(screen.getByRole("heading", { name: "Ask about your training" })).toBeOnTheScreen();
    expect(
      screen.getByText("Say it in your own words. Every change shows here with Undo."),
    ).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "What should I train today?" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Why has my bench stalled?" })).toBeOnTheScreen();
    expect(
      screen.getByRole("button", { name: "Am I doing enough for my back?" }),
    ).toBeOnTheScreen();
    expect(screen.getByText(ASSISTANT_NOT_MEDICAL_ADVICE)).toBeOnTheScreen();
  });

  it("should draw none of the diary's starters", async () => {
    await render(sheetTree("train"));

    expect(screen.queryByRole("button", { name: "What's left for today?" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Log food or ask about your diary" })).toBeNull();
  });

  it("should ask about training in the field", async () => {
    await render(sheetTree("train"));

    expect(screen.getByPlaceholderText("Ask about your training")).toBe(
      screen.getByLabelText("Message"),
    );
  });

  it("should send a starter's words as your message, with the day and no time", async () => {
    await render(sheetTree("train"));

    await userSetup().press(screen.getByRole("button", { name: "What should I train today?" }));

    expect(mockAssistant.turn.send).toHaveBeenCalledWith("What should I train today?", {
      conversationId: null,
      localDate: OPENED_ON,
    });
  });

  it("should show the conversation that exists, and not the starters", async () => {
    mockAssistant.conversation = {
      data: { conversationId: "c1", items: [{ kind: "user", id: "u1", text: "Hello" }] },
      isSuccess: true,
      isError: false,
      isFetching: false,
    };
    await render(sheetTree("train"));

    expect(screen.getByText("Hello")).toBeOnTheScreen();
    expect(screen.queryByRole("heading", { name: "Ask about your training" })).toBeNull();
    expect(screen.queryByRole("button", { name: "What should I train today?" })).toBeNull();
  });

  it("should keep the diary's heading, starters and field when opened from the diary", async () => {
    await render(sheetTree());

    expect(
      screen.getByRole("heading", { name: "Log food or ask about your diary" }),
    ).toBeOnTheScreen();
    expect(screen.getByPlaceholderText("Log food or ask about your diary")).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: "What should I train today?" })).toBeNull();
  });
});
