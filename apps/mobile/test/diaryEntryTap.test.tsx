import "./support/gestureHandler";

import { KeyLowProvider } from "@keylow/api-client";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { DiaryScreen } from "../components/DiaryScreen";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import {
  createDiaryQueryClient,
  diaryBackend,
  diaryClient,
  recipeEntry,
  resetDiaryBackend,
  sampleDay,
} from "./support/diaryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

import type { QueryClient } from "@tanstack/react-query";

// A tap on a food in the diary opens the entry screen for that entry.

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

// The rows of `sampleDay`, in the order it lists them.
const CHICKEN_INDEX = 3;
const CRISPS_INDEX = 5;
const idOfEntry = (index: number) => String(diaryBackend.entries[index]?.["id"]);

let queryClient: QueryClient;

async function renderLoadedDiary() {
  queryClient = createDiaryQueryClient();
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={diaryClient} queryClient={queryClient}>
        <ToastProvider>
          <DiaryScreen />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
  await screen.findByRole("button", { name: "Add food at 08:00" });
  return user;
}

describe("tapping a food in the diary", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/DiaryScreen"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
    diaryBackend.entries = sampleDay();
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  it("should open the entry screen for that entry, by its id", async () => {
    const user = await renderLoadedDiary();

    await user.press(screen.getByRole("button", { name: /^Chicken breast, grilled/ }));

    expect(routerMock.push).toHaveBeenCalledTimes(1);
    expect(routerMock.push).toHaveBeenCalledWith(`/entry/${idOfEntry(CHICKEN_INDEX)}`);
  });

  it("should open a quick add the same way", async () => {
    const user = await renderLoadedDiary();

    await user.press(screen.getByRole("button", { name: /^Meal deal crisps/ }));

    expect(routerMock.push).toHaveBeenCalledWith(`/entry/${idOfEntry(CRISPS_INDEX)}`);
  });

  it("should open the entry offline too, where it can be read but not changed", async () => {
    const user = await renderLoadedDiary();
    await act(() => {
      onlineManager.setOnline(false);
    });

    await user.press(screen.getByRole("button", { name: /^Chicken breast, grilled/ }));

    expect(routerMock.push).toHaveBeenCalledWith(`/entry/${idOfEntry(CHICKEN_INDEX)}`);
  });

  it("should open nothing when a recipe entry is pressed, and not fail", async () => {
    diaryBackend.entries = [...sampleDay(), recipeEntry({ date: "2026-10-15", utcTime: "17:00" })];
    const user = await renderLoadedDiary();

    await user.press(screen.getByLabelText(/^Chicken and rice, 18:00/));

    expect(routerMock.push).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/^Chicken and rice, 18:00/)).toBeOnTheScreen();
  });
});
