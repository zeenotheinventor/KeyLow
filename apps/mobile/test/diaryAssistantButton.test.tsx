import { KeyLowProvider } from "@keylow/api-client";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { Text as MockText } from "react-native";

import { DiaryScreen } from "../components/DiaryScreen";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import {
  createDiaryQueryClient,
  diaryClient,
  resetDiaryBackend,
  sampleDay,
  diaryBackend,
} from "./support/diaryBackend";
import { resetRouterMock } from "./support/expoRouterMock";
import { expectAccessibleNamesInOrder } from "./support/namesInOrder";
import { installVirtualClock } from "./support/virtualClock";

import type { AssistantSheetProps } from "../components/AssistantSheet";
import type { QueryClient } from "@tanstack/react-query";

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
// 11:20 in London on Thursday 15 October 2026.
jest.mock("../lib/useNow", () => {
  const mockNow = new Date("2026-10-15T10:20:00Z");

  return { useNow: () => mockNow };
});

// The sheet has its own tests. Here it is a stand-in that says whether it is open and which day it was given,
// so the diary's side of it is what is tested: the button, the day, and when the sheet starts.
const mockSheetMounts = jest.fn();
jest.mock("../components/AssistantSheet", () => ({
  AssistantSheet: ({ open, localDate, onClose }: AssistantSheetProps) => {
    mockSheetMounts();
    return (
      <MockText
        onPress={onClose}
      >{`${open ? "Assistant sheet open" : "Assistant sheet closed"} on ${localDate}`}</MockText>
    );
  },
}));

let queryClient: QueryClient;

const diaryTree = () => (
  <ThemeProvider fixedPreference="dark">
    <KeyLowProvider client={diaryClient} queryClient={queryClient}>
      <ToastProvider>
        <DiaryScreen />
      </ToastProvider>
    </KeyLowProvider>
  </ThemeProvider>
);

async function renderLoadedDiary() {
  queryClient = createDiaryQueryClient();
  await render(diaryTree());
  await screen.findByRole("button", { name: "Add food at 08:00" });
}

const userSetup = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

describe("the assistant button on the diary", () => {
  beforeEach(() => {
    installVirtualClock();
    resetRouterMock();
    resetDiaryBackend();
    diaryBackend.entries = sampleDay();
    mockSheetMounts.mockClear();
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

  it("should draw the Assistant button first among the header's buttons, as assistant · empty does", async () => {
    await renderLoadedDiary();

    expectAccessibleNamesInOrder(
      screen.getAllByRole("button", { name: /^(Assistant|Choose a date|More)$/ }),
      ["Assistant", "Choose a date", "More"],
    );
  });

  it("should not start the assistant until the button is pressed", async () => {
    await renderLoadedDiary();

    expect(mockSheetMounts).not.toHaveBeenCalled();
    expect(screen.queryByText(/Assistant sheet/)).not.toBeOnTheScreen();
  });

  it("should open the sheet on the day on view, today", async () => {
    await renderLoadedDiary();

    await userSetup().press(screen.getByRole("button", { name: "Assistant" }));

    expect(screen.getByText("Assistant sheet open on 2026-10-15")).toBeOnTheScreen();
  });

  it("should open the sheet on another day when that is the day on view", async () => {
    await renderLoadedDiary();
    await userSetup().press(screen.getByRole("button", { name: "Monday 12 October" }));

    await userSetup().press(screen.getByRole("button", { name: "Assistant" }));

    expect(screen.getByText("Assistant sheet open on 2026-10-12")).toBeOnTheScreen();
  });

  it("should keep the sheet mounted, closed, after it is closed, so a stopped answer is still there", async () => {
    await renderLoadedDiary();
    await userSetup().press(screen.getByRole("button", { name: "Assistant" }));

    await userSetup().press(screen.getByText("Assistant sheet open on 2026-10-15"));

    expect(screen.getByText("Assistant sheet closed on 2026-10-15")).toBeOnTheScreen();
  });
});
