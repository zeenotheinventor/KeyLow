import "./support/gestureHandler";

import { KeyLowProvider } from "@keylow/api-client";
import { themes } from "@keylow/tokens";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { impactAsync, ImpactFeedbackStyle } from "expo-haptics";
import { setUpTests } from "react-native-reanimated";

import { DiaryScreen } from "../components/DiaryScreen";
import { ToastProvider } from "../components/ui";
import { announceNewTargets, hasNewTargets, takeNewTargets } from "../lib/checkinToast";
import { ThemeProvider } from "../lib/theme";
import {
  createDiaryQueryClient,
  diaryBackend,
  diaryClient,
  resetDiaryBackend,
  sampleDay,
} from "./support/diaryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

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

setUpTests();

const mockImpact = jest.mocked(impactAsync);
const TOAST_WORDS = "Check-in done: new targets";

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

// The `d` of a drawn path, which is what says which icon it is.
const pathData = (path: { props: unknown }): string[] => {
  const { d }: { d?: unknown } = path.props ?? {};
  return typeof d === "string" ? [d] : [];
};

const toast = () => screen.queryByRole("status", { name: TOAST_WORDS });

// A tab that is left and come back to: the screen loses focus, then gets it again.
async function changeFocus(isFocused: boolean) {
  routerMock.isFocused = isFocused;
  await screen.rerender(diaryTree());
}

describe("the diary's check-in toast", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/DiaryScreen"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
    diaryBackend.entries = sampleDay();
    mockImpact.mockClear();
    takeNewTargets();
  });

  afterEach(async () => {
    takeNewTargets();
    jest.restoreAllMocks();
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  it("should show the toast with its words and See why when the check-in landed before the diary opened", async () => {
    announceNewTargets();

    await renderLoadedDiary();

    expect(await screen.findByRole("status", { name: TOAST_WORDS })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "See why" })).toBeOnTheScreen();
  });

  it("should show the toast when the check-in lands while the diary is on screen", async () => {
    await renderLoadedDiary();
    expect(toast()).not.toBeOnTheScreen();

    await act(() => {
      announceNewTargets();
    });

    expect(await screen.findByRole("status", { name: TOAST_WORDS })).toBeOnTheScreen();
  });

  it("should draw the refresh icon in the neutral tone, which colours the icon only", async () => {
    announceNewTargets();

    await renderLoadedDiary();

    const words = await screen.findByRole("status", { name: TOAST_WORDS });
    const drawing = words.queryAll((node) => node.type === "RNSVGSvgView");
    expect(drawing).toHaveLength(1);
    expect(drawing[0]).toHaveProp("stroke", themes.dark["text-secondary"]);
    expect(words.queryAll((node) => node.type === "RNSVGPath").flatMap(pathData)).toEqual([
      "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8",
      "M21 3v5h-5",
      "M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16",
      "M8 16H3v5",
    ]);
  });

  it("should play the complete haptic, which is two heavy impacts", async () => {
    announceNewTargets();

    await renderLoadedDiary();
    await screen.findByRole("status", { name: TOAST_WORDS });

    expect(mockImpact).toHaveBeenCalledTimes(2);
    expect(mockImpact).toHaveBeenNthCalledWith(1, ImpactFeedbackStyle.Heavy);
    expect(mockImpact).toHaveBeenNthCalledWith(2, ImpactFeedbackStyle.Heavy);
  });

  it("should open the Programme when See why is pressed", async () => {
    announceNewTargets();
    await renderLoadedDiary();
    const user = userEvent.setup();

    await user.press(await screen.findByRole("button", { name: "See why" }));

    expect(routerMock.push).toHaveBeenCalledWith("/more/program");
  });

  it("should use the signal up, so a second focus shows nothing and plays nothing", async () => {
    announceNewTargets();
    await renderLoadedDiary();
    const user = userEvent.setup();
    await user.press(await screen.findByRole("button", { name: "See why" }));
    expect(hasNewTargets()).toBe(false);
    mockImpact.mockClear();

    await changeFocus(false);
    await changeFocus(true);

    expect(toast()).not.toBeOnTheScreen();
    expect(mockImpact).not.toHaveBeenCalled();
  });

  it("should wait for the diary to be focused, and show the toast on the next visit", async () => {
    routerMock.isFocused = false;
    announceNewTargets();

    await renderLoadedDiary();

    expect(toast()).not.toBeOnTheScreen();
    expect(hasNewTargets()).toBe(true);
    expect(mockImpact).not.toHaveBeenCalled();

    await changeFocus(true);

    expect(await screen.findByRole("status", { name: TOAST_WORDS })).toBeOnTheScreen();
  });

  it("should show nothing and play nothing when no check-in changed the target", async () => {
    await renderLoadedDiary();

    expect(toast()).not.toBeOnTheScreen();
    expect(mockImpact).not.toHaveBeenCalled();
  });
});
